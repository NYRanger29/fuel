// pantry.js: what food you have at home. Fill it by scanning a receipt (or a
// photo of your groceries), then ask for meal ideas built from it.

import * as store from '../store.js';
import { data } from '../store.js';
import { esc, icon, num, on, toast, openSheet, pickImage, shrinkImage, formValues } from '../ui.js';
import { refresh } from '../router.js';
import { analyzeReceipt, suggestMeals, hasKey, PANTRY_CATEGORIES } from '../ai.js';
import { logMeal, MEALS, mealForNow } from './food.js';
import { openSettings } from './settings.js';

let query = '';

const norm = (s) => String(s || '').trim().toLowerCase();
const qtyText = (p) => (p.quantity ? `${+Number(p.quantity).toFixed(2)} ${p.unit && p.unit !== 'count' ? p.unit : ''}`.trim() : '');

function findByName(name) {
  const n = norm(name);
  return data.pantry.find((p) => norm(p.name) === n);
}

// ---------- The Pantry tab ----------

export function render(screen) {
  const total = data.pantry.length;
  screen.innerHTML = `
    <header class="top">
      <div><h1>Pantry</h1><div class="date">${total ? `${total} item${total === 1 ? '' : 's'} at home` : 'Nothing here yet'}</div></div>
      <button class="icon-btn" data-act="add" aria-label="Add an item">${icon('plus')}</button>
    </header>

    <div class="add-row" style="grid-template-columns:1fr 1fr">
      <button data-act="scan">${icon('receipt')}Scan receipt</button>
      <button data-act="ideas" style="background:var(--turf);color:#fff">${icon('spark')}Meal ideas</button>
    </div>

    ${
      total
        ? `<div class="search" style="margin-top:16px"><input class="input" type="search" placeholder="Search your pantry" aria-label="Search your pantry" value="${esc(query)}" data-search></div>
           <div data-list></div>`
        : `<div class="card empty" style="margin-top:16px">${icon('pantry')}
             <p>Take a photo of a grocery receipt and Fuel will add everything on it. A photo of your fridge or shelf works too.</p>
             <button class="btn go" data-act="scan">${icon('receipt', 20)}Scan a receipt</button>
           </div>`
    }

    ${
      data.recipes.length
        ? `<div class="section-title"><h2>Saved recipes</h2></div>
           <ul class="list">${[...data.recipes]
             .sort((a, b) => (b.saved || '').localeCompare(a.saved || ''))
             .map(
               (r) => `<li><button class="item" data-act="recipe" data-id="${esc(r.id)}">
                 <span class="grow"><span class="t">${esc(r.title)}</span><span class="s" style="display:block">${num(r.minutes)} min · ${num(r.calories)} cal · ${num(r.protein)} g protein</span></span>${icon('right', 20)}</button></li>`,
             )
             .join('')}</ul>`
        : ''
    }`;

  const listEl = screen.querySelector('[data-list]');
  const drawList = () => {
    if (!listEl) return;
    const q = norm(query);
    const items = data.pantry.filter((p) => !q || norm(p.name).includes(q));
    if (!items.length) {
      listEl.innerHTML = `<p class="empty">No items match "${esc(query)}".</p>`;
      return;
    }
    listEl.innerHTML = PANTRY_CATEGORIES.map((cat) => {
      const inCat = items.filter((p) => (PANTRY_CATEGORIES.includes(p.category) ? p.category : 'Other') === cat).sort((a, b) => a.name.localeCompare(b.name));
      if (!inCat.length) return '';
      return `
        <div class="pantry-cat">${esc(cat)}<span>${inCat.length}</span></div>
        <ul class="list">${inCat
          .map(
            (p) => `<li><button class="item" data-act="edit" data-id="${esc(p.id)}" style="padding:13px 16px">
              <span class="grow t">${esc(p.name)}</span><span class="qty">${esc(qtyText(p))}</span></button></li>`,
          )
          .join('')}</ul>`;
    }).join('');
  };
  drawList();

  screen.querySelector('[data-search]')?.addEventListener('input', (e) => {
    query = e.target.value;
    drawList();
  });

  on(screen, {
    add: () => editItem(null),
    edit: (el) => editItem(el.dataset.id),
    scan: () => scanReceipt(),
    ideas: () => openMealIdeas(),
    recipe: (el) => {
      const r = data.recipes.find((x) => x.id === el.dataset.id);
      if (r) showRecipe(r);
    },
  });
}

// ---------- Adding and editing one item ----------

function editItem(id) {
  const p = id ? data.pantry.find((x) => x.id === id) : null;
  openSheet({
    title: p ? 'Edit item' : 'Add to pantry',
    html: `
      <form class="stack">
        <label class="field"><span>Name</span><input class="input" name="name" value="${esc(p?.name || '')}" required ${p ? '' : 'autofocus'} placeholder="For example: Greek yogurt"></label>
        <div class="grid-2">
          <label class="field"><span>Amount</span><input class="input" name="quantity" type="number" inputmode="decimal" step="any" min="0" value="${p?.quantity ?? 1}"></label>
          <label class="field"><span>Unit</span><input class="input" name="unit" value="${esc(p?.unit || 'count')}" list="units"></label>
        </div>
        <datalist id="units">${['count', 'lb', 'oz', 'g', 'kg', 'bag', 'box', 'can', 'carton', 'bottle', 'jar', 'dozen', 'gallon', 'loaf'].map((u) => `<option value="${u}">`).join('')}</datalist>
        <label class="field"><span>Category</span><select class="input" name="category">
          ${PANTRY_CATEGORIES.map((c) => `<option ${c === (p?.category || 'Other') ? 'selected' : ''}>${c}</option>`).join('')}
        </select></label>
        <div class="sheet-actions">
          ${p ? `<button type="button" class="btn danger" data-used>Used it up</button>` : ''}
          <button class="btn primary" type="submit">${p ? 'Save' : 'Add'}</button>
        </div>
      </form>`,
    onMount(sheet) {
      const form = sheet.el.querySelector('form');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const v = formValues(form);
        if (!v.name) return;
        const dupe = !p && findByName(v.name);
        if (dupe) {
          dupe.quantity = (Number(dupe.quantity) || 0) + (v.quantity || 0);
          await store.save('pantry', dupe);
        } else {
          await store.save('pantry', { ...(p || { added: store.dateKey() }), name: v.name, quantity: v.quantity ?? 1, unit: v.unit || 'count', category: v.category });
        }
        sheet.close();
        refresh();
        toast(p ? 'Saved' : dupe ? `Added more ${v.name}` : `Added ${v.name}`);
      });
      sheet.el.querySelector('[data-used]')?.addEventListener('click', async () => {
        const gone = await store.remove('pantry', p.id);
        sheet.close();
        refresh();
        toast(`Removed ${gone.name}`, {
          action: 'Undo',
          onAction: async () => {
            await store.save('pantry', gone);
            refresh();
          },
        });
      });
    },
  });
}

// ---------- Scanning a receipt ----------

function needKey(what) {
  openSheet({
    title: 'Photo reading is off',
    html: `<div class="stack"><p>${what} uses Claude, an AI from Anthropic. Add your API key in Settings to turn it on. Settings has step-by-step instructions.</p>
      <div class="sheet-actions"><button class="btn primary" data-sheet-close data-go>Open settings</button></div></div>`,
    onMount(sheet) {
      sheet.el.querySelector('[data-go]').addEventListener('click', () => setTimeout(openSettings, 200));
    },
  });
}

export async function scanReceipt() {
  if (!hasKey()) return needKey('Scanning receipts');
  const file = await pickImage();
  if (!file) return;
  let photo;
  try {
    // Receipts have small print, so keep more detail than for meals.
    photo = await shrinkImage(file, 2000, 0.88);
  } catch (error) {
    toast(error.message);
    return;
  }

  const sheet = openSheet({
    title: 'Reading your receipt',
    html: `<div class="reading"><img class="photo" src="${photo.dataUrl}" alt="Your receipt"><div class="scan"></div></div>
      <div class="reading-label"><span class="spinner"></span>Finding the food on it</div>`,
  });

  let answer;
  try {
    answer = await analyzeReceipt(photo.base64);
  } catch (error) {
    sheet.setTitle('Could not read it');
    sheet.setBody(`<div class="stack"><div class="error-box">${esc(error.message)}</div><button class="btn block" data-sheet-close>Close</button></div>`);
    return;
  }
  if (!answer.found_items || !answer.items.length) {
    sheet.setTitle('No food found');
    sheet.setBody(`<div class="stack"><p>Fuel could not read any food from that photo. Try again with the receipt flat, in good light, and filling the frame.</p><button class="btn block" data-sheet-close>Close</button></div>`);
    return;
  }

  const rows = answer.items.map((i) => ({ ...i, keep: true }));
  sheet.setTitle(answer.store ? `From ${answer.store}` : 'Found on your receipt');
  sheet.setBody(`
    <p class="muted small">Untick anything you do not want. Tap a name or amount to fix it.</p>
    <form>
      ${rows
        .map(
          (r, i) => `
        <div class="review-item" data-i="${i}">
          <input type="checkbox" checked data-f="keep" aria-label="Keep ${esc(r.name)}">
          <div class="grow">
            <input class="input" data-f="name" value="${esc(r.name)}" aria-label="Name">
            <div class="tiny" style="margin-top:3px">${esc(r.category)}${findByName(r.name) ? ' · already in pantry, will add to it' : ''}</div>
          </div>
          <input class="input q" data-f="quantity" type="number" inputmode="decimal" step="any" min="0" value="${+Number(r.quantity).toFixed(2)}" aria-label="Amount">
          <span class="tiny" style="width:44px">${esc(r.unit)}</span>
        </div>`,
        )
        .join('')}
      <div class="sheet-actions"><button class="btn go" type="submit" data-save>Add ${rows.length} items</button></div>
    </form>`);

  const root = sheet.el;
  const label = () => {
    const n = rows.filter((r) => r.keep).length;
    root.querySelector('[data-save]').textContent = `Add ${n} item${n === 1 ? '' : 's'}`;
  };
  root.addEventListener('input', (e) => {
    const box = e.target.closest('[data-i]');
    if (!box) return;
    const r = rows[Number(box.dataset.i)];
    const f = e.target.dataset.f;
    if (f === 'keep') r.keep = e.target.checked;
    else if (f === 'quantity') r.quantity = Number(e.target.value) || 0;
    else r.name = e.target.value;
    label();
  });
  root.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    let added = 0;
    let merged = 0;
    for (const r of rows.filter((x) => x.keep && x.name.trim())) {
      const existing = findByName(r.name);
      if (existing) {
        if (norm(existing.unit) === norm(r.unit)) existing.quantity = (Number(existing.quantity) || 0) + r.quantity;
        else Object.assign(existing, { quantity: r.quantity, unit: r.unit });
        await store.save('pantry', existing);
        merged += 1;
      } else {
        await store.save('pantry', { name: r.name.trim(), quantity: r.quantity, unit: r.unit, category: r.category, added: store.dateKey() });
        added += 1;
      }
    }
    sheet.close();
    refresh();
    toast(`Added ${added} new item${added === 1 ? '' : 's'}${merged ? `, topped up ${merged}` : ''}`);
  });
}

// ---------- Meal ideas ----------

export function openMealIdeas() {
  if (!hasKey()) return needKey('Meal ideas');
  const remaining = (() => {
    const t = store.totalsOn(store.dateKey());
    return { calories: store.settings.calories - t.calories, protein: store.settings.protein - t.protein };
  })();
  const types = ['Any', ...MEALS];
  let mealType = mealForNow();

  const sheet = openSheet({
    title: 'What can I make?',
    html: `
      <form class="stack">
        ${data.pantry.length ? '' : `<div class="confidence">Your pantry is empty, so ideas will use common staples. Scan a receipt for ideas that match what you have.</div>`}
        <div class="chips" role="group" aria-label="Meal type">${types.map((t) => `<button type="button" class="chip" data-type="${t}" aria-pressed="${t === mealType}">${t}</button>`).join('')}</div>
        <label class="field"><span>In the mood for (optional)</span>
          <input class="input" name="request" placeholder="For example: something spicy, quick, high protein, under 20 minutes"></label>
        <label class="switch">Only use what I have<input type="checkbox" name="strict" role="switch"></label>
        ${remaining.calories > 0 ? `<p class="hint">Ideas will aim for what you still need today: about ${num(remaining.calories)} calories and ${num(Math.max(0, remaining.protein))} g protein.</p>` : ''}
        <div class="sheet-actions"><button class="btn go" type="submit">${icon('spark', 20)}Get 3 ideas</button></div>
      </form>`,
    wide: true,
    onMount(s) {
      s.el.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-type]');
        if (!chip) return;
        mealType = chip.dataset.type;
        s.el.querySelectorAll('[data-type]').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      });
      s.el.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const form = e.target;
        ask({ request: form.request.value.trim(), strict: form.strict.checked });
      });
    },
  });

  async function ask(opts) {
    sheet.setBody(`<div class="reading-label" style="margin:50px 0"><span class="spinner"></span>Looking through your pantry</div>`);
    try {
      const answer = await suggestMeals({ pantry: data.pantry, mealType, remaining: remaining.calories > 0 ? remaining : null, ...opts });
      sheet.setTitle('Ideas for you');
      sheet.setBody(`
        <div data-ideas>${answer.meals.map((m, i) => ideaCard(m, i)).join('')}</div>
        <button class="btn block" style="margin-top:14px" data-more>${icon('repeat', 20)}Different ideas</button>`);
      wireIdeas(sheet, answer.meals, () => ask(opts));
    } catch (error) {
      sheet.setBody(`<div class="stack"><div class="error-box">${esc(error.message)}</div><button class="btn block" data-retry>Try again</button></div>`);
      sheet.el.querySelector('[data-retry]').addEventListener('click', () => ask(opts));
    }
  }
}

function ideaCard(m, i, open = false) {
  return `
    <article class="meal-idea" data-idx="${i}">
      <button data-toggle aria-expanded="${open}">
        <h3>${esc(m.title)}</h3>
        <p class="muted small" style="margin-top:4px">${esc(m.summary)}</p>
        <div class="facts"><span><b>${num(m.minutes)}</b> min</span><span><b>${num(m.calories)}</b> cal</span><span><b>${num(m.protein)} g</b> protein</span><span>${num(m.servings)} serving${m.servings === 1 ? '' : 's'}</span></div>
        <div>${(m.uses || []).map((u) => `<span class="tag">${esc(u)}</span>`).join('')}${(m.missing || []).map((u) => `<span class="tag miss">Need: ${esc(u)}</span>`).join('')}</div>
      </button>
      <div class="recipe" ${open ? '' : 'hidden'}>
        <h4>Ingredients</h4><ul>${m.ingredients.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        <h4>Steps</h4><ol>${m.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
        <p class="tiny" style="margin-top:10px">Nutrition is per serving and is an estimate.</p>
        <div class="sheet-actions">
          <button class="btn" data-save-recipe>${m.id ? 'Remove' : 'Save recipe'}</button>
          <button class="btn go" data-ate>${icon('check', 20)}I ate this</button>
        </div>
      </div>
    </article>`;
}

function wireIdeas(sheet, meals, again) {
  // Replace the previous handler so "Different ideas" doesn't stack them up.
  if (sheet.ideasHandler) sheet.el.removeEventListener('click', sheet.ideasHandler);
  sheet.ideasHandler = handler;
  sheet.el.addEventListener('click', handler);
  async function handler(e) {
    if (e.target.closest('[data-more]')) return again();
    const card = e.target.closest('[data-idx]');
    if (!card) return;
    const m = meals[Number(card.dataset.idx)];
    if (e.target.closest('[data-toggle]')) {
      const btn = card.querySelector('[data-toggle]');
      const recipe = card.querySelector('.recipe');
      const open = recipe.hidden;
      recipe.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    }
    if (e.target.closest('[data-save-recipe]')) {
      const btn = e.target.closest('[data-save-recipe]');
      if (m.id) {
        await store.remove('recipes', m.id);
        delete m.id;
        btn.textContent = 'Save recipe';
        toast('Recipe removed');
      } else {
        await store.save('recipes', Object.assign(m, { saved: new Date().toISOString() }));
        btn.textContent = 'Remove';
        toast('Recipe saved to your pantry page');
      }
      refresh();
    }
    if (e.target.closest('[data-ate]')) {
      sheet.close();
      ateMeal(m);
    }
  }
}

function showRecipe(r) {
  const sheet = openSheet({ title: r.title, html: ideaCard(r, 0, true), wide: true });
  wireIdeas(sheet, [r], () => {});
}

// Logs the meal, then offers to take the used items out of the pantry.
async function ateMeal(m) {
  await logMeal({ name: m.title, calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat });
  refresh();
  const used = (m.uses || [])
    .map((u) => findByName(u) || data.pantry.find((p) => norm(u).includes(norm(p.name)) || norm(p.name).includes(norm(u))))
    .filter((p, i, arr) => p && arr.indexOf(p) === i);
  if (!used.length) {
    toast(`Logged ${m.title}: ${num(m.calories)} cal, ${num(m.protein)} g protein`);
    return;
  }
  openSheet({
    title: 'Logged. Anything used up?',
    html: `
      <form class="stack">
        <p class="muted small">Tick the items you finished so your pantry stays accurate.</p>
        <div>${used.map((p) => `<label class="review-item"><input type="checkbox" value="${esc(p.id)}"><span class="grow">${esc(p.name)}</span><span class="qty">${esc(qtyText(p))}</span></label>`).join('')}</div>
        <div class="sheet-actions"><button type="button" class="btn" data-sheet-close>Keep all</button><button class="btn primary" type="submit">Remove ticked</button></div>
      </form>`,
    onMount(sheet) {
      sheet.el.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const ids = [...sheet.el.querySelectorAll('input:checked')].map((c) => c.value);
        const gone = [];
        for (const id of ids) gone.push(await store.remove('pantry', id));
        sheet.close();
        refresh();
        if (gone.length) {
          toast(`Removed ${gone.length} item${gone.length === 1 ? '' : 's'}`, {
            action: 'Undo',
            onAction: async () => {
              for (const g of gone) if (g) await store.save('pantry', g);
              refresh();
            },
          });
        }
      });
    },
  });
}
