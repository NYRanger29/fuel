// body.js: weight, sleep, and water over time, plus streaks.

import * as store from '../store.js';
import { data, settings } from '../store.js';
import { esc, icon, num, oneDecimal, on, toast, openSheet, lineChart, barChart, niceDate, formValues } from '../ui.js';
import { refresh } from '../router.js';
import { logSleep } from './today.js';

let range = 30; // days shown on the weight chart (0 means all)

const shortDate = (key) => store.keyToDate(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// The trend line: an average of the last 7 weigh-ins at each point. Daily
// weight jumps around with water and food; the trend shows the real direction.
function trend(points) {
  return points.map((p, i) => {
    const win = points.slice(Math.max(0, i - 6), i + 1);
    return { label: p.label, value: win.reduce((s, x) => s + x.value, 0) / win.length };
  });
}

export function render(screen) {
  const today = store.dateKey();
  const all = store.weightsSorted();
  const from = range ? store.shiftKey(today, -range) : '';
  const shown = all.filter((w) => w.date >= from);
  const points = shown.map((w) => ({ label: shortDate(w.date), value: w.weight }));
  const tr = trend(all.map((w) => ({ label: shortDate(w.date), value: w.weight }))).slice(all.length - shown.length);
  const latest = all[all.length - 1];

  // Change over the last 30 days, using the trend so one heavy morning doesn't skew it.
  let change = null;
  if (all.length > 1) {
    const fullTrend = trend(all.map((w) => ({ value: w.weight })));
    const monthAgo = store.shiftKey(today, -30);
    const idx = Math.max(0, all.findIndex((w) => w.date >= monthAgo));
    change = fullTrend[fullTrend.length - 1].value - fullTrend[idx].value;
  }

  const sleepBars = [];
  const waterBars = [];
  const proteinBars = [];
  for (let i = 13; i >= 0; i -= 1) {
    const key = store.shiftKey(today, -i);
    const d = store.dayOn(key);
    const label = store.keyToDate(key).toLocaleDateString('en-US', { weekday: 'narrow' });
    sleepBars.push({ label, value: d.sleep || 0, hit: (d.sleep || 0) >= settings.sleepHours });
    if (i < 7) {
      waterBars.push({ label, value: d.water || 0, hit: (d.water || 0) >= settings.waterCups });
      const p = store.totalsOn(key).protein;
      proteinBars.push({ label, value: p, hit: p >= settings.protein * 0.95 });
    }
  }
  const sleepLogged = sleepBars.filter((b) => b.value);
  const avgSleep = sleepLogged.length ? sleepLogged.reduce((s, b) => s + b.value, 0) / sleepLogged.length : 0;
  const proteinDays = proteinBars.filter((b) => b.hit).length;

  screen.innerHTML = `
    <header class="top"><h1>Body</h1><button class="btn go sm" data-act="weigh">${icon('scale', 18)}Weigh in</button></header>

    <section class="card">
      <div class="row between" style="align-items:flex-end">
        <div>
          <div class="chart-big">${latest ? oneDecimal(latest.weight) : '–'}<small>lb</small></div>
          <div class="tiny">${latest ? `Latest, ${esc(shortDate(latest.date))}` : 'No weigh-ins yet'}</div>
        </div>
        ${change != null ? `<span class="delta ${settings.goal === 'lose' ? (change <= 0 ? 'up' : 'down') : change >= 0 ? 'up' : 'down'}">${change >= 0 ? '+' : ''}${oneDecimal(change)} lb in 30 days</span>` : ''}
      </div>
      <div class="chips" style="margin:14px 0 6px" role="group" aria-label="Chart range">
        ${[[30, '30 days'], [90, '90 days'], [0, 'All']].map(([v, l]) => `<button class="chip" data-act="range" data-v="${v}" aria-pressed="${range === v}">${l}</button>`).join('')}
      </div>
      ${
        points.length > 1
          ? `${lineChart(points, { unit: ' lb', trend: tr })}
             <p class="tiny"><span style="color:var(--turf);font-weight:700">Green line</span>: 7-weigh-in average. It smooths out daily water swings.</p>`
          : `<p class="hint" style="margin-top:8px">${points.length ? 'Weigh in on another day to start the chart.' : 'Weigh in first thing in the morning, after the bathroom and before eating, for the most consistent numbers.'}</p>`
      }
    </section>

    <div class="section-title"><h2>Streaks</h2></div>
    <div class="stat-row">
      <div class="stat"><div class="v">${store.logStreak()}</div><div class="l">days logging food</div></div>
      <div class="stat"><div class="v">${store.proteinStreak()}</div><div class="l">days hitting protein</div></div>
      <div class="stat"><div class="v">${proteinDays}/7</div><div class="l">protein days this week</div></div>
    </div>

    <div class="section-title"><h2>Protein</h2><span class="tiny">Goal ${num(settings.protein)} g</span></div>
    <section class="card">${barChart(proteinBars, { target: settings.protein, unit: ' g' })}</section>

    <div class="section-title"><h2>Sleep</h2><button class="btn ghost sm" data-act="sleep">Log sleep</button></div>
    <section class="card">
      <p class="small muted">${avgSleep ? `Average ${oneDecimal(avgSleep)} hours over the last 2 weeks. Target ${settings.sleepHours}.` : 'No sleep logged yet.'}</p>
      ${barChart(sleepBars, { target: settings.sleepHours, unit: ' h', tone: 'violet' })}
    </section>

    <div class="section-title"><h2>Water</h2><span class="tiny">Goal ${settings.waterCups} cups</span></div>
    <section class="card">
      ${barChart(waterBars, { target: settings.waterCups, unit: ' cups', tone: 'sky' })}
    </section>

    ${
      all.length
        ? `<div class="section-title"><h2>Weigh-ins</h2></div>
           <ul class="list">${[...all]
             .reverse()
             .slice(0, 30)
             .map(
               (w) => `<li><button class="item" data-act="edit" data-id="${esc(w.id)}" style="padding:12px 16px">
                 <span class="grow">${esc(niceDate(store.keyToDate(w.date), { weekday: 'short', month: 'short', day: 'numeric' }))}</span>
                 <span class="kcal">${oneDecimal(w.weight)} lb</span></button></li>`,
             )
             .join('')}</ul>`
        : ''
    }`;

  on(screen, {
    weigh: () => weighIn(),
    sleep: () => logSleep(today),
    range: (el) => {
      range = Number(el.dataset.v);
      refresh();
    },
    edit: (el) => weighIn(data.weights.find((w) => w.id === el.dataset.id)),
  });
}

// Opens the weigh-in panel. Pass an existing entry to edit it.
export function weighIn(existing = null) {
  const latest = store.latestWeight();
  openSheet({
    title: existing ? 'Edit weigh-in' : 'Weigh in',
    html: `
      <form class="stack">
        <label class="field"><span>Weight (lb)</span>
          <input class="input" name="weight" type="number" inputmode="decimal" step="0.1" min="50" max="600" required autofocus
            value="${existing ? existing.weight : ''}" placeholder="${latest ? oneDecimal(latest.weight) : 'For example 165.4'}" style="font-size:24px;font-weight:700"></label>
        <label class="field"><span>Date</span><input class="input" name="date" type="date" max="${store.dateKey()}" value="${existing?.date || store.dateKey()}" required></label>
        <div class="sheet-actions">
          ${existing ? `<button type="button" class="btn danger" data-del>${icon('trash', 20)}Delete</button>` : ''}
          <button class="btn primary" type="submit">Save</button>
        </div>
      </form>`,
    onMount(sheet) {
      const form = sheet.el.querySelector('form');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const v = formValues(form);
        if (!v.weight || !v.date) return;
        // One weigh-in per day: a second one on the same day replaces the first.
        const sameDay = data.weights.find((w) => w.date === v.date && w.id !== existing?.id);
        if (sameDay) await store.remove('weights', sameDay.id);
        await store.save('weights', { id: existing?.id, date: v.date, weight: Math.round(v.weight * 10) / 10 });
        sheet.close();
        refresh();
        const prev = latest && latest.date < v.date ? latest.weight : null;
        toast(prev != null ? `Saved ${oneDecimal(v.weight)} lb (${v.weight - prev >= 0 ? '+' : ''}${oneDecimal(v.weight - prev)})` : `Saved ${oneDecimal(v.weight)} lb`);
      });
      sheet.el.querySelector('[data-del]')?.addEventListener('click', async () => {
        const gone = await store.remove('weights', existing.id);
        sheet.close();
        refresh();
        toast('Weigh-in deleted', {
          action: 'Undo',
          onAction: async () => {
            await store.save('weights', gone);
            refresh();
          },
        });
      });
    },
  });
}
