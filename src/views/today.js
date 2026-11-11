// today.js: the home screen. A fuel gauge for calories and protein, quick
// buttons, and what you have eaten today.

import * as store from '../store.js';
import { data, settings } from '../store.js';
import { esc, icon, num, oneDecimal, on, meter, niceDate, toast, openSheet, formValues } from '../ui.js';
import { refresh, go } from '../router.js';
import { hasKey } from '../ai.js';
import { snapMeal, foodRow, editFood } from './food.js';
import { openMealIdeas } from './pantry.js';
import { weighIn } from './body.js';
import { openSettings } from './settings.js';

// The half-circle gauge. Outer arc is calories, inner arc is protein.
function gauge(t) {
  const calPct = settings.calories ? t.calories / settings.calories : 0;
  const proPct = settings.protein ? t.protein / settings.protein : 0;
  const outer = Math.PI * 100;
  const inner = Math.PI * 78;
  const left = settings.calories - t.calories;
  const over = left < 0;
  return `
  <div class="gauge${over ? ' over' : ''}">
    <svg viewBox="0 0 240 132" aria-hidden="true">
      <path class="g-track" d="M20 120 A100 100 0 0 1 220 120" fill="none" stroke-width="16" stroke-linecap="round"/>
      <path class="g-fill" d="M20 120 A100 100 0 0 1 220 120" fill="none" stroke-width="16" stroke-linecap="round"
        stroke-dasharray="${outer}" stroke-dashoffset="${outer * (1 - Math.min(1, calPct))}"/>
      <path class="g-protein-track" d="M42 120 A78 78 0 0 1 198 120" fill="none" stroke-width="9" stroke-linecap="round"/>
      <path class="g-protein" d="M42 120 A78 78 0 0 1 198 120" fill="none" stroke-width="9" stroke-linecap="round"
        stroke-dasharray="${inner}" stroke-dashoffset="${inner * (1 - Math.min(1, proPct))}"/>
    </svg>
    <div class="gauge-center">
      <div class="gauge-big">${num(Math.abs(left))}</div>
      <div class="gauge-sub">${over ? 'calories over' : 'calories left'}</div>
    </div>
  </div>
  <p class="sr-only">${num(t.calories)} of ${num(settings.calories)} calories and ${num(t.protein)} of ${num(settings.protein)} grams of protein eaten today.</p>
  <div class="gauge-legend">
    <span><i style="background:var(--mango)"></i>${num(t.calories)} eaten</span>
    <span><i style="background:var(--turf)"></i>${num(t.protein)} / ${num(settings.protein)} g protein</span>
  </div>`;
}

export function render(screen) {
  const key = store.dateKey();
  const t = store.totalsOn(key);
  const foods = store.foodsOn(key).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const day = store.dayOn(key);
  const weight = store.latestWeight();
  const streak = store.logStreak();
  const pantryCount = data.pantry.length;

  const nudges = [];
  if (!settings.targetsSet) {
    nudges.push(`
      <div class="nudge">${icon('flame')}<div>
        <p><strong>Set your daily targets.</strong> They start at 2,800 calories and 150 g protein for building muscle. The calculator in Settings can tailor them to you.</p>
        <button class="btn sm primary" data-act="settings">Open settings</button>
      </div></div>`);
  }
  if (!hasKey()) {
    nudges.push(`
      <div class="nudge">${icon('camera')}<div>
        <p><strong>Turn on photo reading.</strong> Add a Claude API key so Fuel can read meal photos and receipts and suggest meals. You can log food by hand until then.</p>
        <button class="btn sm primary" data-act="settings">Add a key</button>
      </div></div>`);
  }

  screen.innerHTML = `
    <header class="top">
      <div>
        <div class="date">${esc(niceDate(new Date()))}</div>
        <h1>Today</h1>
      </div>
      <div class="row">
        ${streak ? `<span class="streak" title="Days in a row with food logged">${icon('flame', 18)}${streak} day${streak === 1 ? '' : 's'}</span>` : ''}
        <button class="icon-btn" data-act="settings" aria-label="Settings">${icon('gear')}</button>
      </div>
    </header>

    ${nudges.length ? `<div class="stack" style="margin-bottom:14px">${nudges.join('')}</div>` : ''}

    <section class="card">
      ${gauge(t)}
      ${meter('Protein', t.protein, settings.protein, ' g', 'protein')}
      ${meter('Carbs', t.carbs, settings.carbs, ' g', 'carbs')}
      ${meter('Fat', t.fat, settings.fat, ' g', 'fat')}
    </section>

    <div class="quick">
      <button class="q-snap" data-act="snap">${icon('camera')}Snap meal</button>
      <button class="q-weigh" data-act="weigh">${icon('scale')}Weigh in</button>
      <button class="q-water" data-act="water" aria-label="Add a cup of water. ${day.water || 0} of ${settings.waterCups} so far.">${icon('drop')}${day.water || 0}/${settings.waterCups} cups</button>
      <button class="q-sleep" data-act="sleep">${icon('moon')}${day.sleep != null ? `${oneDecimal(day.sleep)} h` : 'Sleep'}</button>
    </div>

    <div style="margin-top:14px">
      <button class="idea-card" data-act="ideas">
        ${icon('spark')}
        <div class="grow">
          <h3>What can I make?</h3>
          <p>${pantryCount ? `Meal ideas from the ${pantryCount} item${pantryCount === 1 ? '' : 's'} in your pantry` : 'Scan a receipt to fill your pantry, then get meal ideas'}</p>
        </div>
        ${icon('right')}
      </button>
    </div>

    <div class="section-title"><h2>Eaten today</h2><button class="btn ghost sm" data-act="food">See all</button></div>
    ${
      foods.length
        ? `<ul class="list">${foods.map((f) => `<li>${foodRow(f)}</li>`).join('')}</ul>`
        : `<div class="card empty">${icon('food')}<p>Nothing logged yet today. Take a photo of your next meal and Fuel will estimate it.</p><button class="btn go" data-act="snap">${icon('camera', 20)}Snap a meal</button></div>`
    }

    <div class="section-title"><h2>Body</h2><button class="btn ghost sm" data-act="body">Charts</button></div>
    <div class="stat-row">
      <div class="stat"><div class="v">${weight ? oneDecimal(weight.weight) : '–'}</div><div class="l">${weight ? 'lb, latest' : 'No weigh-ins'}</div></div>
      <div class="stat"><div class="v">${store.proteinStreak()}</div><div class="l">protein streak</div></div>
      <div class="stat"><div class="v">${data.workouts.filter((w) => w.date >= store.shiftKey(key, -6)).length}</div><div class="l">workouts this week</div></div>
    </div>`;

  on(screen, {
    settings: () => openSettings(),
    snap: () => snapMeal(),
    weigh: () => weighIn(),
    ideas: () => openMealIdeas(),
    food: () => go('food'),
    body: () => go('body'),
    'edit-food': (el) => editFood(el.dataset.id),
    water: async () => {
      const before = store.dayOn(key).water || 0;
      await store.saveDay(key, { water: before + 1 });
      refresh();
      const now = before + 1;
      toast(now >= settings.waterCups ? `${now} cups. Water goal reached.` : `${now} of ${settings.waterCups} cups`, {
        action: 'Undo',
        onAction: async () => {
          await store.saveDay(key, { water: before });
          refresh();
        },
      });
    },
    sleep: () => logSleep(key),
  });
}

export function logSleep(key) {
  const day = store.dayOn(key);
  openSheet({
    title: 'Sleep last night',
    html: `
      <form class="stack">
        <label class="field"><span>Hours slept</span>
          <input class="input" name="sleep" type="number" inputmode="decimal" step="0.25" min="0" max="24" value="${day.sleep ?? ''}" placeholder="${settings.sleepHours}" autofocus required></label>
        <div class="chips">${[6, 7, 7.5, 8, 8.5, 9, 9.5].map((h) => `<button type="button" class="chip" data-hours="${h}">${h} h</button>`).join('')}</div>
        <p class="hint">Your target is ${settings.sleepHours} hours. Teen athletes recover best with 8 to 10.</p>
        <div class="sheet-actions"><button class="btn primary" type="submit">Save sleep</button></div>
      </form>`,
    onMount(sheet) {
      const form = sheet.el.querySelector('form');
      sheet.el.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-hours]');
        if (chip) form.sleep.value = chip.dataset.hours;
      });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { sleep } = formValues(form);
        await store.saveDay(key, { sleep });
        sheet.close();
        refresh();
        toast(`Saved ${oneDecimal(sleep)} hours of sleep`);
      });
    },
  });
}
