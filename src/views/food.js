// food.js: the food log. Meals can be added from a photo, from a typed
// description, or by hand. The AI's guess always lands in an editor first,
// so you can fix it before saving.

import * as store from '../store.js';
import { data, settings } from '../store.js';
import { esc, icon, num, round, on, meter, niceDate, toast, openSheet, pickImage, shrinkImage } from '../ui.js';
import { refresh } from '../router.js';
import { analyzeFoodPhoto, analyzeFoodText, hasKey } from '../ai.js';
import { openSettings } from './settings.js';

export const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

let viewDate = null; // which day the Food tab is showing

export function mealForNow(d = new Date()) {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 4 && h < 10.5) return 'Breakfast';
  if (h >= 10.5 && h < 15) return 'Lunch';
  if (h >= 17 && h < 21.5) return 'Dinner';
  return 'Snack';
}

const nowTime = () => new Date().toTimeString().slice(0, 5);

// One line in a list of meals. Tapping it opens the editor.
export function foodRow(f) {
  return `
    <button class="item" data-act="edit-food" data-id="${esc(f.id)}">
      ${f.thumb ? `<img class="thumb" src="${f.thumb}" alt="">` : `<span class="thumb">${icon('food', 24)}</span>`}
      <span class="grow">
        <span class="t">${esc(f.name)}</span>
        <span class="s" style="display:block">${esc(f.meal)}${f.items?.length > 1 ? ` · ${f.items.length} items` : ''}</span>
      </span>
      <span class="kcal">${num(f.calories)}<small>${num(f.protein)} g protein</small></span>
    </button>`;
}

// ---------- The Food tab ----------

export function render(screen) {
  const today = store.dateKey();
  if (!viewDate || viewDate > today) viewDate = today;
  const key = viewDate;
  const t = store.totalsOn(key);
  const foods = store.foodsOn(key);
  const isToday = key === today;
  const label = isToday ? 'Today' : key === store.shiftKey(today, -1) ? 'Yesterday' : niceDate(store.keyToDate(key), { weekday: 'short', month: 'short', day: 'numeric' });

  // Recently eaten foods (by name) for one-tap re-logging.
  const seen = new Set();
  const recent = [];
  for (const f of [...data.foods].sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')))) {
    const k = f.name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    recent.push(f);
    if (recent.length >= 8) break;
  }

  const groups = MEALS.map((meal) => {
    const list = foods.filter((f) => f.meal === meal);
    if (!list.length) return '';
    const kcal = list.reduce((s, f) => s + (f.calories || 0), 0);
    return `
      <div class="meal-head"><h3>${meal}</h3><span>${num(kcal)} cal</span></div>
      <ul class="list">${list.map((f) => `<li>${foodRow(f)}</li>`).join('')}</ul>`;
  }).join('');

  screen.innerHTML = `
    <header class="top"><h1>Food</h1></header>

    <div class="day-switch">
      <button class="icon-btn plain" data-act="prev" aria-label="Previous day">${icon('left')}</button>
      <strong>${esc(label)}</strong>
      <button class="icon-btn plain" data-act="next" aria-label="Next day" ${isToday ? 'disabled style="opacity:.3"' : ''}>${icon('right')}</button>
    </div>

    <section class="card">
      ${meter('Calories', t.calories, settings.calories, '', 'calories')}
      ${meter('Protein', t.protein, settings.protein, ' g', 'protein')}
      <div class="grid-2">
        ${meter('Carbs', t.carbs, settings.carbs, ' g', 'carbs')}
        ${meter('Fat', t.fat, settings.fat, ' g', 'fat')}
      </div>
    </section>

    <div class="add-row" style="margin-top:14px">
      <button data-act="photo">${icon('camera')}Photo</button>
      <button data-act="describe">${icon('pencil')}Describe</button>
      <button data-act="manual">${icon('plus')}By hand</button>
    </div>

    ${
      recent.length
        ? `<div class="section-title"><h2>Eat it again</h2></div>
           <div class="chips">${recent.map((f) => `<button class="chip" data-act="again" data-id="${esc(f.id)}">${esc(f.name)}</button>`).join('')}</div>`
        : ''
    }

    ${groups || `<div class="card empty" style="margin-top:22px">${icon('food')}<p>No meals logged ${isToday ? 'today' : 'this day'}.</p></div>`}`;

  on(screen, {
    prev: () => {
      viewDate = store.shiftKey(key, -1);
      refresh();
    },
    next: () => {
      if (!isToday) {
        viewDate = store.shiftKey(key, 1);
        refresh();
      }
    },
    photo: () => snapMeal({ date: key }),
    describe: () => describeMeal({ date: key }),
    manual: () => openEditor({ date: key, meal: isToday ? mealForNow() : 'Dinner', name: '', items: [blankItem()] }),
    again: (el) => {
      const f = data.foods.find((x) => x.id === el.dataset.id);
      if (f) openEditor({ ...copyFood(f), date: key, meal: isToday ? mealForNow() : f.meal });
    },
    'edit-food': (el) => editFood(el.dataset.id),
  });
}

const blankItem = () => ({ name: '', portion: '', calories: 0, protein: 0, carbs: 0, fat: 0 });

function copyFood(f) {
  return {
    name: f.name,
    meal: f.meal,
    thumb: f.thumb || null,
    items: (f.items?.length ? f.items : [{ name: f.name, portion: '', calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat }]).map((i) => ({ ...i })),
  };
}

// ---------- Adding by photo ----------

function needKey() {
  openSheet({
    title: 'Photo reading is off',
    html: `
      <div class="stack">
        <p>Reading photos uses Claude, an AI from Anthropic. To turn it on, add your API key in Settings. Settings has step-by-step instructions.</p>
        <p class="muted small">Until then you can still log meals by hand.</p>
        <div class="sheet-actions"><button class="btn primary" data-sheet-close data-open-settings>Open settings</button></div>
      </div>`,
    onMount(sheet) {
      sheet.el.querySelector('[data-open-settings]').addEventListener('click', () => setTimeout(openSettings, 200));
    },
  });
}

export async function snapMeal({ date = store.dateKey() } = {}) {
  if (!hasKey()) return needKey();
  const file = await pickImage();
  if (!file) return;

  let photo;
  let thumb;
  try {
    photo = await shrinkImage(file);
    thumb = (await shrinkImage(file, 320, 0.7)).dataUrl;
  } catch (error) {
    toast(error.message || 'That photo could not be opened.');
    return;
  }

  const meal = date === store.dateKey() ? mealForNow() : 'Dinner';
  const sheet = openSheet({ title: 'Reading your meal', html: '' });

  async function read(hint) {
    sheet.setTitle('Reading your meal');
    sheet.setBody(`
      <div class="reading"><img class="photo" src="${photo.dataUrl}" alt="Your meal"><div class="scan"></div></div>
      <div class="reading-label"><span class="spinner"></span>Estimating portions and calories</div>`);
    try {
      const answer = await analyzeFoodPhoto(photo.base64, hint);
      if (!answer.is_food || !answer.items.length) {
        sheet.setTitle('No food found');
        sheet.setBody(`
          <img class="photo" src="${photo.dataUrl}" alt="">
          <div class="stack" style="margin-top:14px">
            <p>Fuel could not find food in this photo. Add a note about what it is, or enter it by hand.</p>
            ${hintForm('Try again')}
            <button class="btn block" data-manual>Enter by hand</button>
          </div>`);
        wireHint();
        sheet.el.querySelector('[data-manual]').addEventListener('click', () => {
          sheet.close();
          openEditor({ date, meal, name: '', thumb, items: [blankItem()] });
        });
        return;
      }
      sheet.close();
      openEditor({ date, meal, name: answer.title, thumb, items: answer.items.map(cleanItem), confidence: answer.confidence, note: answer.note, reread: true, photo, hint });
    } catch (error) {
      showError(error);
    }
  }

  function hintForm(label) {
    return `
      <form class="stack" data-hint>
        <label class="field"><span>Note for the AI (optional)</span>
          <input class="input" name="hint" placeholder="For example: large bowl, no cheese, 2 eggs"></label>
        <button class="btn primary block" type="submit">${label}</button>
      </form>`;
  }

  function wireHint() {
    const form = sheet.el.querySelector('[data-hint]');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      read(form.hint.value.trim());
    });
  }

  function showError(error) {
    sheet.setTitle('Could not read the photo');
    sheet.setBody(`
      <img class="photo" src="${photo.dataUrl}" alt="">
      <div class="stack" style="margin-top:14px">
        <div class="error-box">${esc(error.message || 'Something went wrong.')}</div>
        ${hintForm('Try again')}
        <button class="btn block" data-manual>Enter by hand</button>
      </div>`);
    wireHint();
    sheet.el.querySelector('[data-manual]').addEventListener('click', () => {
      sheet.close();
      openEditor({ date, meal, name: '', thumb, items: [blankItem()] });
    });
  }

  read('');
}

// ---------- Adding by description ----------

export function describeMeal({ date = store.dateKey() } = {}) {
  if (!hasKey()) return needKey();
  const meal = date === store.dateKey() ? mealForNow() : 'Dinner';
  openSheet({
    title: 'Describe what you ate',
    html: `
      <form class="stack">
        <label class="field"><span>What did you eat?</span>
          <textarea class="input" name="text" required autofocus placeholder="For example: 2 scrambled eggs, 2 slices of toast with butter, a glass of whole milk"></textarea></label>
        <p class="hint">Amounts help. Brand names and restaurant names help too.</p>
        <div class="sheet-actions"><button class="btn primary" type="submit">Estimate</button></div>
      </form>`,
    onMount(sheet) {
      const form = sheet.el.querySelector('form');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = form.text.value.trim();
        if (!text) return;
        sheet.setBody(`<div class="reading-label" style="margin:40px 0"><span class="spinner"></span>Estimating calories</div>`);
        try {
          const answer = await analyzeFoodText(text);
          sheet.close();
          if (!answer.is_food || !answer.items.length) {
            toast('That did not sound like food. Try again with more detail.');
            return;
          }
          openEditor({ date, meal, name: answer.title, items: answer.items.map(cleanItem), confidence: answer.confidence, note: answer.note });
        } catch (error) {
          sheet.setBody(`<div class="stack"><div class="error-box">${esc(error.message)}</div><button class="btn block" data-sheet-close>Close</button></div>`);
        }
      });
    },
  });
}

const cleanItem = (i) => ({
  name: i.name,
  portion: i.portion || '',
  calories: round(i.calories),
  protein: round(i.protein),
  carbs: round(i.carbs),
  fat: round(i.fat),
});

// ---------- Editing an existing entry ----------

export function editFood(id) {
  const f = data.foods.find((x) => x.id === id);
  if (!f) return;
  openEditor({ ...copyFood(f), id: f.id, date: f.date, time: f.time, meal: f.meal });
}

// ---------- The editor ----------
// `draft` holds the meal while you edit it. Typing updates the draft and the
// totals; adding or removing an item redraws the list.

function openEditor(draft) {
  const existing = Boolean(draft.id);
  const sumOf = (field) => draft.items.reduce((s, i) => s + (Number(i[field]) || 0), 0);

  const totalsHtml = () => `
    <div><b>${num(sumOf('calories'))}</b><span>calories</span></div>
    <div><b>${num(sumOf('protein'))} g</b><span>protein</span></div>
    <div><b>${num(sumOf('carbs'))} g</b><span>carbs</span></div>
    <div><b>${num(sumOf('fat'))} g</b><span>fat</span></div>`;

  const itemHtml = (item, i) => `
    <div class="edit-item" data-i="${i}">
      <div class="row">
        <input class="input grow" data-f="name" value="${esc(item.name)}" placeholder="Food name" aria-label="Food name">
        <button type="button" class="icon-btn plain" data-remove="${i}" aria-label="Remove ${esc(item.name || 'item')}">${icon('trash', 20)}</button>
      </div>
      <input class="input" style="margin-top:8px" data-f="portion" value="${esc(item.portion)}" placeholder="Portion, for example 1 cup" aria-label="Portion">
      <div class="grid-4" style="margin-top:8px">
        ${[['calories', 'Cal'], ['protein', 'Protein g'], ['carbs', 'Carbs g'], ['fat', 'Fat g']]
          .map(([f, l]) => `<label class="field"><span>${l}</span><input class="input" data-f="${f}" type="number" inputmode="decimal" min="0" step="any" value="${item[f] ?? ''}"></label>`)
          .join('')}
      </div>
    </div>`;

  const body = () => `
    <form class="stack" novalidate>
      ${draft.thumb ? `<img class="photo" src="${draft.thumb}" alt="" style="max-height:180px">` : ''}
      ${draft.confidence && draft.confidence !== 'high' ? `<div class="confidence">AI estimate, ${esc(draft.confidence)} confidence. ${esc(draft.note || 'Check the portions.')}</div>` : draft.note ? `<div class="confidence">${esc(draft.note)}</div>` : ''}
      <label class="field"><span>Meal name</span><input class="input" name="name" value="${esc(draft.name)}" placeholder="For example: Chicken and rice" required></label>
      <div class="chips" role="group" aria-label="Meal">
        ${MEALS.map((m) => `<button type="button" class="chip" data-meal="${m}" aria-pressed="${draft.meal === m}">${m}</button>`).join('')}
      </div>
      <div data-items>${draft.items.map(itemHtml).join('')}</div>
      <button type="button" class="btn block" data-add>${icon('plus', 20)}Add another food</button>
      <div class="totals" data-totals>${totalsHtml()}</div>
      ${draft.reread ? `<details><summary class="small muted" style="cursor:pointer">Estimate looks off? Re-read the photo with a note</summary>
        <div class="row" style="margin-top:8px"><input class="input grow" data-hint placeholder="For example: it was a large plate"><button type="button" class="btn sm" data-reread>Re-read</button></div></details>` : ''}
      <div class="sheet-actions">
        ${existing ? `<button type="button" class="btn danger" data-delete>${icon('trash', 20)}Delete</button>` : ''}
        <button type="submit" class="btn primary">${existing ? 'Save changes' : 'Log meal'}</button>
      </div>
      ${existing && draft.date !== store.dateKey() ? `<button type="button" class="btn block ghost" data-again>${icon('repeat', 20)}Log this again today</button>` : ''}
    </form>`;

  openSheet({
    title: existing ? 'Edit meal' : 'Check and save',
    html: body(),
    onMount(sheet) {
      const root = sheet.el;
      const form = () => root.querySelector('form');

      root.addEventListener('input', (e) => {
        const box = e.target.closest('[data-i]');
        if (e.target.name === 'name') draft.name = e.target.value;
        if (!box || !e.target.dataset.f) return;
        const item = draft.items[Number(box.dataset.i)];
        const f = e.target.dataset.f;
        item[f] = f === 'name' || f === 'portion' ? e.target.value : Number(e.target.value) || 0;
        root.querySelector('[data-totals]').innerHTML = totalsHtml();
      });

      const redrawItems = () => {
        root.querySelector('[data-items]').innerHTML = draft.items.map(itemHtml).join('');
        root.querySelector('[data-totals]').innerHTML = totalsHtml();
      };

      root.addEventListener('click', async (e) => {
        const chip = e.target.closest('[data-meal]');
        if (chip) {
          draft.meal = chip.dataset.meal;
          root.querySelectorAll('[data-meal]').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
        }
        const rm = e.target.closest('[data-remove]');
        if (rm) {
          draft.items.splice(Number(rm.dataset.remove), 1);
          if (!draft.items.length) draft.items.push(blankItem());
          redrawItems();
        }
        if (e.target.closest('[data-add]')) {
          draft.items.push(blankItem());
          redrawItems();
          const inputs = root.querySelectorAll('[data-items] [data-f="name"]');
          inputs[inputs.length - 1]?.focus();
        }
        if (e.target.closest('[data-reread]')) {
          const hint = root.querySelector('[data-hint]').value.trim();
          sheet.setBody(`<div class="reading"><img class="photo" src="${draft.photo.dataUrl}" alt=""><div class="scan"></div></div><div class="reading-label"><span class="spinner"></span>Reading again</div>`);
          try {
            const answer = await analyzeFoodPhoto(draft.photo.base64, hint);
            if (answer.is_food && answer.items.length) {
              Object.assign(draft, { name: answer.title, items: answer.items.map(cleanItem), confidence: answer.confidence, note: answer.note });
            } else toast('No food found on the second try. Your earlier estimate is kept.');
          } catch (error) {
            toast(error.message);
          }
          sheet.setBody(body());
        }
        if (e.target.closest('[data-delete]')) {
          const gone = await store.remove('foods', draft.id);
          sheet.close();
          refresh();
          toast(`Deleted ${gone?.name || 'meal'}`, {
            action: 'Undo',
            onAction: async () => {
              await store.save('foods', gone);
              refresh();
            },
          });
        }
        if (e.target.closest('[data-again]')) {
          await saveDraft({ ...draft, id: null, date: store.dateKey(), time: nowTime(), meal: mealForNow() });
          sheet.close();
          refresh();
          toast(`Logged ${draft.name} for today`);
        }
      });

      root.addEventListener('submit', async (e) => {
        e.preventDefault();
        draft.name = form().name.value.trim();
        const items = draft.items.filter((i) => i.name.trim() || i.calories);
        if (!items.length) {
          toast('Add at least one food with a name or calories.');
          return;
        }
        if (!draft.name) draft.name = items.map((i) => i.name).filter(Boolean).slice(0, 3).join(', ') || 'Meal';
        draft.items = items;
        await saveDraft(draft);
        sheet.close();
        refresh();
        const p = round(sumOf('protein'));
        toast(existing ? 'Changes saved' : `Logged ${num(sumOf('calories'))} cal and ${p} g protein`);
      });
    },
  });
}

async function saveDraft(draft) {
  const sum = (f) => round(draft.items.reduce((s, i) => s + (Number(i[f]) || 0), 0));
  return store.save('foods', {
    id: draft.id || undefined,
    date: draft.date,
    time: draft.time || nowTime(),
    meal: draft.meal || mealForNow(),
    name: draft.name,
    calories: sum('calories'),
    protein: sum('protein'),
    carbs: sum('carbs'),
    fat: sum('fat'),
    items: draft.items.map((i) => ({ ...i, name: i.name.trim(), portion: (i.portion || '').trim() })),
    thumb: draft.thumb || null,
  });
}

// Used by the pantry's "I ate this" button.
export function logMeal({ name, calories, protein, carbs, fat, meal }) {
  return store.save('foods', {
    date: store.dateKey(),
    time: nowTime(),
    meal: meal || mealForNow(),
    name,
    calories: round(calories),
    protein: round(protein),
    carbs: round(carbs),
    fat: round(fat),
    items: [{ name, portion: '1 serving', calories: round(calories), protein: round(protein), carbs: round(carbs), fat: round(fat) }],
    thumb: null,
  });
}
