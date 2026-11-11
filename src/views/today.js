// today.js: the home screen. A fuel gauge for calories and protein, quick
// buttons, and what you have eaten today.

import * as store from '../store.js';
import { data, settings } from '../store.js';
import { esc, icon, num, oneDecimal, on, meter, niceDate, toast, openSheet, formValues } from '../ui.js';
import { refresh, go, reducedMotion } from '../router.js';
import { hasKey } from '../ai.js';
import { snapMeal, foodRow, editFood } from './food.js';
import { openMealIdeas } from './pantry.js';
import { weighIn } from './body.js';
import { openSettings } from './settings.js';

// ---------- The fuel gauge ----------
// Outer arc is calories (with tick marks and E / F like a car's fuel gauge),
// inner arc is protein. A marker rides the end of the calorie arc.

const CX = 130;
const CY = 130;
const R_OUT = 100;
const R_IN = 74;
const OUT_LEN = Math.PI * R_OUT;
const IN_LEN = Math.PI * R_IN;
const arc = (r) => `M${CX - r} ${CY} A${r} ${r} 0 0 1 ${CX + r} ${CY}`;
const clamp01 = (n) => Math.max(0, Math.min(1, n || 0));

// What the gauge showed last time, so it can move from there instead of from zero.
let shown = null;
let bumpNext = null; // which quick button just got tapped, so it can react
let lastStreak = null;

function ticks() {
  let out = '';
  for (let i = 0; i <= 20; i += 1) {
    const a = Math.PI + (i / 20) * Math.PI;
    const major = i % 5 === 0;
    const r1 = R_OUT + 14;
    const r2 = R_OUT + (major ? 24 : 19);
    out += `<line class="g-tick${major ? ' major' : ''}" x1="${(CX + r1 * Math.cos(a)).toFixed(1)}" y1="${(CY + r1 * Math.sin(a)).toFixed(1)}" x2="${(CX + r2 * Math.cos(a)).toFixed(1)}" y2="${(CY + r2 * Math.sin(a)).toFixed(1)}"/>`;
  }
  return out;
}

function gauge(t, from) {
  const left = settings.calories - t.calories;
  const over = left < 0;
  const calFrom = clamp01(from.cal / settings.calories);
  const proFrom = clamp01(from.pro / settings.protein);
  return `
  <div class="gauge${over ? ' over' : ''}">
    <svg viewBox="0 0 260 156" aria-hidden="true">
      <defs>
        <filter id="g-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4"/></filter>
      </defs>
      ${ticks()}
      <text class="g-end" x="${CX - R_OUT}" y="152" text-anchor="middle">E</text>
      <text class="g-end" x="${CX + R_OUT}" y="152" text-anchor="middle">F</text>
      <path class="g-track" d="${arc(R_OUT)}" fill="none" stroke-width="18" stroke-linecap="round"/>
      <path class="g-fill" data-g="cal" d="${arc(R_OUT)}" fill="none" stroke-width="18" stroke-linecap="round"
        stroke-dasharray="${OUT_LEN}" stroke-dashoffset="${OUT_LEN * (1 - calFrom)}"/>
      <path class="g-protein-track" d="${arc(R_IN)}" fill="none" stroke-width="10" stroke-linecap="round"/>
      <path class="g-protein-glow" data-g="pro-glow" d="${arc(R_IN)}" fill="none" stroke-width="12" stroke-linecap="round" filter="url(#g-glow)"
        stroke-dasharray="${IN_LEN}" stroke-dashoffset="${IN_LEN * (1 - proFrom)}"/>
      <path class="g-protein" data-g="pro" d="${arc(R_IN)}" fill="none" stroke-width="10" stroke-linecap="round"
        stroke-dasharray="${IN_LEN}" stroke-dashoffset="${IN_LEN * (1 - proFrom)}"/>
      <g class="g-marker" data-g="marker" style="transform: rotate(${calFrom * 180}deg)">
        <circle cx="${CX - R_OUT}" cy="${CY}" r="11" class="g-marker-ring"/>
        <circle cx="${CX - R_OUT}" cy="${CY}" r="5.5" class="g-marker-dot"/>
      </g>
    </svg>
    <div class="gauge-center">
      <div class="gauge-big" data-count>${num(Math.abs(settings.calories - from.cal))}</div>
      <div class="gauge-sub">${over ? 'calories over' : 'calories left'}</div>
    </div>
  </div>
  <p class="sr-only">${num(t.calories)} of ${num(settings.calories)} calories and ${num(t.protein)} of ${num(settings.protein)} grams of protein eaten today.</p>
  <div class="gauge-legend">
    <span><i style="background:var(--mango)"></i><b>${num(t.calories)}</b> eaten</span>
    <span><i style="background:var(--turf)"></i><b>${num(t.protein)}</b> / ${num(settings.protein)} g protein</span>
  </div>
  ${t.protein >= settings.protein ? `<div class="goal-banner">${icon('check', 18)}<span>Protein goal hit: <b>${num(t.protein)} g</b></span></div>` : ''}`;
}

// Moves the gauge from where it was to where it should be now.
function animateGauge(screen, t, from) {
  const cal = clamp01(t.calories / settings.calories);
  const pro = clamp01(t.protein / settings.protein);
  const q = (k) => screen.querySelector(`[data-g="${k}"]`);
  const counter = screen.querySelector('[data-count]');
  const target = Math.abs(settings.calories - t.calories);
  const start = Math.abs(settings.calories - from.cal);
  const crossesZero = settings.calories - from.cal >= 0 !== settings.calories - t.calories >= 0;

  const finish = () => {
    q('cal').setAttribute('stroke-dashoffset', OUT_LEN * (1 - cal));
    q('pro').setAttribute('stroke-dashoffset', IN_LEN * (1 - pro));
    q('pro-glow').setAttribute('stroke-dashoffset', IN_LEN * (1 - pro));
    q('marker').style.transform = `rotate(${cal * 180}deg)`;
  };

  if (reducedMotion()) {
    finish();
    counter.textContent = num(target);
    return 0;
  }

  const DURATION = from.cal === 0 && from.pro === 0 ? 1100 : 750;
  screen.querySelector('.gauge').style.setProperty('--g-dur', `${DURATION}ms`);
  // Two animation frames: the browser draws the old position first, then moves.
  requestAnimationFrame(() => requestAnimationFrame(finish));

  // The number counts like a scoreboard, slowing down as it lands.
  if (start !== target && !crossesZero) {
    const t0 = performance.now();
    const ease = (x) => 1 - Math.pow(1 - x, 4);
    const step = (now) => {
      if (!counter.isConnected) return;
      const p = Math.min(1, (now - t0) / DURATION);
      counter.textContent = num(start + (target - start) * ease(p));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  } else {
    counter.textContent = num(target);
  }
  return DURATION;
}

// A one-time moment per day when the protein goal is reached.
function celebrate(screen, protein, delay) {
  const key = store.dateKey();
  let done = '';
  try {
    done = localStorage.getItem('fuel.proteinCelebrated') || '';
  } catch {
    // ignore
  }
  if (done === key || protein < settings.protein) return;
  try {
    localStorage.setItem('fuel.proteinCelebrated', key);
  } catch {
    // ignore
  }
  // The banner waits, hidden, until the gauge finishes filling.
  const card = screen.querySelector('.scoreboard');
  card.classList.add('goal-pending');
  setTimeout(() => {
    card.classList.replace('goal-pending', 'goal-hit');
    // Phones only allow a buzz after you've tapped something.
    if (navigator.vibrate && navigator.userActivation?.hasBeenActive) navigator.vibrate([30, 40, 30]);
  }, reducedMotion() ? 0 : delay);
}

export function render(screen) {
  const key = store.dateKey();
  const t = store.totalsOn(key);
  const foods = store.foodsOn(key).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const day = store.dayOn(key);
  const weight = store.latestWeight();
  const streak = store.logStreak();
  const pantryCount = data.pantry.length;
  const from = shown && shown.date === key ? shown : { cal: 0, pro: 0 };
  shown = { date: key, cal: t.calories, pro: t.protein };
  const bump = bumpNext;
  bumpNext = null;
  const streakUp = lastStreak != null && streak > lastStreak;
  lastStreak = streak;
  const b = (name) => (bump === name ? ' bump' : '');

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
        ${streak ? `<span class="streak${streakUp ? ' pop' : ''}" title="Days in a row with food logged">${icon('flame', 18)}<b>${streak}</b> day${streak === 1 ? '' : 's'}</span>` : ''}
        <button class="icon-btn" data-act="settings" aria-label="Settings">${icon('gear')}</button>
      </div>
    </header>

    ${nudges.length ? `<div class="stack" style="margin-bottom:14px">${nudges.join('')}</div>` : ''}

    <section class="card scoreboard">
      ${gauge(t, from)}
      <div class="macros">
        ${meter('Protein', t.protein, settings.protein, ' g', 'protein')}
        ${meter('Carbs', t.carbs, settings.carbs, ' g', 'carbs')}
        ${meter('Fat', t.fat, settings.fat, ' g', 'fat')}
      </div>
    </section>

    <div class="quick">
      <button class="q-snap" data-act="snap">${icon('camera')}Snap meal</button>
      <button class="q-weigh" data-act="weigh">${icon('scale')}Weigh in</button>
      <button class="q-water${b('water')}" data-act="water" aria-label="Add a cup of water. ${day.water || 0} of ${settings.waterCups} so far."
        style="--fill:${clamp01((day.water || 0) / settings.waterCups)}"><span class="q-water-fill" aria-hidden="true"></span>${icon('drop')}<span><b>${day.water || 0}</b>/${settings.waterCups} cups</span></button>
      <button class="q-sleep${b('sleep')}" data-act="sleep">${icon('moon')}${day.sleep != null ? `${oneDecimal(day.sleep)} h` : 'Sleep'}</button>
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

  const duration = animateGauge(screen, t, from);
  celebrate(screen, t.protein, duration + 150);

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
      bumpNext = 'water';
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
        bumpNext = 'sleep';
        refresh();
        toast(`Saved ${oneDecimal(sleep)} hours of sleep`);
      });
    },
  });
}
