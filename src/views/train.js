// train.js: the workout log. Start a workout, add exercises and sets, and
// watch each lift's strength go up over time.

import * as store from '../store.js';
import { data } from '../store.js';
import { esc, icon, num, oneDecimal, on, toast, openSheet, lineChart, niceDate } from '../ui.js';
import { refresh } from '../router.js';

const ACTIVE_KEY = 'fuel.activeWorkout';
const COMMON = ['Bench press', 'Squat', 'Deadlift', 'Overhead press', 'Barbell row', 'Pull-up', 'Dumbbell curl', 'Incline dumbbell press', 'Leg press', 'Romanian deadlift', 'Lat pulldown', 'Tricep pushdown', 'Lunges', 'Calf raise', 'Plank'];

let progressPick = null;

// The unfinished workout is kept in localStorage so it survives closing the app.
function getActive() {
  try {
    return JSON.parse(localStorage.getItem(ACTIVE_KEY) || 'null');
  } catch {
    return null;
  }
}
function setActive(w) {
  if (w) localStorage.setItem(ACTIVE_KEY, JSON.stringify(w));
  else localStorage.removeItem(ACTIVE_KEY);
}

// Estimated one-rep max (Epley formula): how much you could lift once.
const e1rm = (s) => (Number(s.weight) || 0) * (1 + (Number(s.reps) || 0) / 30);

const sorted = () => [...data.workouts].sort((a, b) => (b.date + (b.finished || '')).localeCompare(a.date + (a.finished || '')));

function exerciseNames() {
  const names = new Map();
  for (const w of sorted()) for (const ex of w.exercises) if (!names.has(ex.name.toLowerCase())) names.set(ex.name.toLowerCase(), ex.name);
  return [...names.values()];
}

// The most recent time you did this exercise, for the "Last time" hint.
function lastTime(name) {
  const n = name.toLowerCase();
  for (const w of sorted()) {
    const ex = w.exercises.find((e) => e.name.toLowerCase() === n);
    if (ex && ex.sets.length) return { date: w.date, sets: ex.sets };
  }
  return null;
}

const setsText = (sets) => sets.map((s) => (s.weight ? `${oneDecimal(s.weight)}×${s.reps}` : `${s.reps} reps`)).join(', ');

function volume(w) {
  return w.exercises.reduce((sum, ex) => sum + ex.sets.reduce((s, x) => s + (Number(x.weight) || 0) * (Number(x.reps) || 0), 0), 0);
}

// ---------- The Train tab ----------

export function render(screen) {
  const active = getActive();
  if (active) return renderActive(screen, active);

  const history = sorted();
  const names = exerciseNames();
  if (!progressPick || !names.includes(progressPick)) progressPick = names[0] || null;
  const last = history[0];

  screen.innerHTML = `
    <header class="top"><div><h1>Train</h1><div class="date">${history.length ? `${history.length} workout${history.length === 1 ? '' : 's'} logged` : 'No workouts yet'}</div></div></header>

    <button class="btn go block" style="min-height:56px;font-size:17px" data-act="start">${icon('train')}Start a workout</button>
    ${last ? `<button class="btn block" style="margin-top:10px" data-act="repeat" data-id="${esc(last.id)}">${icon('repeat', 20)}Repeat ${esc(last.name)}</button>` : ''}

    ${names.length ? progressCard(names) : ''}

    <div class="section-title"><h2>History</h2></div>
    ${
      history.length
        ? `<ul class="list">${history
            .slice(0, 40)
            .map(
              (w) => `<li><button class="item" data-act="open" data-id="${esc(w.id)}">
                <span class="grow"><span class="t">${esc(w.name)}</span>
                <span class="s" style="display:block">${esc(niceDate(store.keyToDate(w.date), { weekday: 'short', month: 'short', day: 'numeric' }))} · ${w.exercises.length} exercise${w.exercises.length === 1 ? '' : 's'} · ${w.exercises.reduce((s, e) => s + e.sets.length, 0)} sets</span></span>
                <span class="qty">${volume(w) ? `${num(volume(w))} lb` : ''}</span></button></li>`,
            )
            .join('')}</ul>`
        : `<div class="card empty">${icon('train')}<p>Log your sets as you lift. Fuel remembers your numbers and shows your strength going up.</p></div>`
    }`;

  screen.querySelector('[data-progress]')?.addEventListener('change', (e) => {
    progressPick = e.target.value;
    refresh();
  });

  on(screen, {
    start: () => startWorkout(),
    repeat: (el) => {
      const w = data.workouts.find((x) => x.id === el.dataset.id);
      if (w) startWorkout(w);
    },
    open: (el) => openWorkout(el.dataset.id),
  });
}

function progressCard(names) {
  const n = progressPick.toLowerCase();
  // Best estimated one-rep max for each workout that included this exercise.
  const points = [...data.workouts]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((w) => {
      const ex = w.exercises.find((e) => e.name.toLowerCase() === n);
      if (!ex || !ex.sets.length) return null;
      const best = Math.max(...ex.sets.map(e1rm));
      return best ? { label: store.keyToDate(w.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), value: best, sets: ex.sets } : null;
    })
    .filter(Boolean);
  const bestSet = points.flatMap((p) => p.sets).reduce((a, s) => (!a || e1rm(s) > e1rm(a) ? s : a), null);
  const first = points[0]?.value;
  const latest = points[points.length - 1]?.value;
  const change = points.length > 1 ? latest - first : 0;

  return `
    <div class="section-title"><h2>Progress</h2></div>
    <section class="card">
      <select class="input" data-progress aria-label="Exercise">${names.map((x) => `<option ${x === progressPick ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
      ${
        points.length
          ? `<div class="row between" style="margin-top:14px;align-items:flex-end">
              <div><div class="chart-big">${num(latest)}<small>lb</small></div><div class="tiny">estimated one-rep max</div></div>
              ${points.length > 1 ? `<span class="delta ${change >= 0 ? 'up' : 'down'}">${change >= 0 ? '+' : ''}${num(change)} lb since ${esc(points[0].label)}</span>` : ''}
            </div>
            ${points.length > 1 ? lineChart(points.map((p) => ({ label: p.label, value: p.value })), { unit: ' lb', height: 150 }) : `<p class="hint" style="margin-top:10px">Log this exercise again to see a chart.</p>`}
            ${bestSet ? `<p class="small muted" style="margin-top:6px">Best set: ${oneDecimal(bestSet.weight)} lb × ${bestSet.reps}</p>` : ''}`
          : `<p class="hint" style="margin-top:10px">This exercise has no sets with weight yet, so there is nothing to chart.</p>`
      }
    </section>`;
}

// ---------- Starting and running a workout ----------

function startWorkout(template) {
  const hour = new Date().getHours();
  const w = {
    name: template?.name || (hour < 12 ? 'Morning lift' : hour < 17 ? 'Afternoon lift' : 'Evening lift'),
    startedAt: Date.now(),
    date: store.dateKey(),
    exercises: template ? template.exercises.map((ex) => ({ name: ex.name, sets: ex.sets.map((s) => ({ weight: s.weight, reps: s.reps, done: false })) })) : [],
  };
  setActive(w);
  refresh({ keepScroll: false });
  if (!template) setTimeout(() => addExercise(), 150);
}

function renderActive(screen, w) {
  const setRow = (ex, ei, s, si) => `
    <div class="set-row">
      <span class="n">${si + 1}</span>
      <input class="input" type="number" inputmode="decimal" step="any" min="0" value="${s.weight ?? ''}" placeholder="lb" data-e="${ei}" data-s="${si}" data-f="weight" aria-label="${esc(ex.name)} set ${si + 1} weight">
      <input class="input" type="number" inputmode="numeric" step="1" min="0" value="${s.reps ?? ''}" placeholder="reps" data-e="${ei}" data-s="${si}" data-f="reps" aria-label="${esc(ex.name)} set ${si + 1} reps">
      <button class="icon-btn plain" data-act="del-set" data-e="${ei}" data-s="${si}" aria-label="Remove set ${si + 1}">${icon('close', 18)}</button>
    </div>`;

  screen.innerHTML = `
    <div class="live-bar">
      <input class="input grow" value="${esc(w.name)}" data-name aria-label="Workout name" style="font-weight:700">
      <span class="timer" data-timer>0:00</span>
    </div>

    ${
      w.exercises.length
        ? w.exercises
            .map((ex, ei) => {
              const prev = lastTime(ex.name);
              return `
          <section class="ex-card">
            <div class="row between"><h3>${esc(ex.name)}</h3>
              <button class="icon-btn plain" data-act="del-ex" data-e="${ei}" aria-label="Remove ${esc(ex.name)}">${icon('trash', 20)}</button></div>
            ${prev ? `<div class="last">Last time: ${esc(setsText(prev.sets))}</div>` : ''}
            <div class="set-head"><span>Set</span><span>Weight (lb)</span><span>Reps</span><span></span></div>
            ${ex.sets.map((s, si) => setRow(ex, ei, s, si)).join('')}
            <button class="btn sm" style="margin-top:10px" data-act="add-set" data-e="${ei}">${icon('plus', 18)}Add set</button>
          </section>`;
            })
            .join('')
        : `<div class="card empty">${icon('train')}<p>Add your first exercise.</p></div>`
    }

    <button class="btn block" style="margin-top:14px" data-act="add-ex">${icon('plus', 20)}Add exercise</button>
    <div class="sheet-actions" style="margin-top:22px">
      <button class="btn danger" data-act="discard">Discard</button>
      <button class="btn go" data-act="finish">${icon('check', 20)}Finish workout</button>
    </div>`;

  // Clock that counts up while the screen is showing.
  const timer = screen.querySelector('[data-timer]');
  const tick = () => {
    if (!screen.isConnected && timer.dataset.started) return clearInterval(id);
    timer.dataset.started = '1';
    const secs = Math.floor((Date.now() - w.startedAt) / 1000);
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = String(secs % 60).padStart(2, '0');
    timer.textContent = h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
  };
  const id = setInterval(tick, 1000);
  tick();

  screen.addEventListener('input', (e) => {
    if (e.target.dataset.name !== undefined) {
      w.name = e.target.value;
    } else if (e.target.dataset.f) {
      const s = w.exercises[Number(e.target.dataset.e)].sets[Number(e.target.dataset.s)];
      s[e.target.dataset.f] = e.target.value === '' ? null : Number(e.target.value);
    }
    setActive(w);
  });

  on(screen, {
    'add-ex': () => addExercise(),
    'add-set': (el) => {
      const ex = w.exercises[Number(el.dataset.e)];
      const prev = ex.sets[ex.sets.length - 1];
      ex.sets.push({ weight: prev?.weight ?? null, reps: prev?.reps ?? null });
      setActive(w);
      refresh();
    },
    'del-set': (el) => {
      w.exercises[Number(el.dataset.e)].sets.splice(Number(el.dataset.s), 1);
      setActive(w);
      refresh();
    },
    'del-ex': (el) => {
      w.exercises.splice(Number(el.dataset.e), 1);
      setActive(w);
      refresh();
    },
    discard: () => {
      const hasSets = w.exercises.some((e) => e.sets.length);
      if (hasSets && !confirm('Discard this workout? The sets you entered will not be saved.')) return;
      setActive(null);
      clearInterval(id);
      refresh({ keepScroll: false });
      toast('Workout discarded', {
        action: 'Undo',
        onAction: () => {
          setActive(w);
          refresh();
        },
      });
    },
    finish: async () => {
      const exercises = w.exercises
        .map((ex) => ({ name: ex.name, sets: ex.sets.filter((s) => s.reps).map((s) => ({ weight: s.weight || 0, reps: s.reps })) }))
        .filter((ex) => ex.sets.length);
      if (!exercises.length) {
        toast('Enter reps for at least one set first.');
        return;
      }
      await store.save('workouts', {
        date: w.date,
        name: w.name.trim() || 'Workout',
        minutes: Math.round((Date.now() - w.startedAt) / 60000),
        finished: new Date().toTimeString().slice(0, 5),
        exercises,
      });
      setActive(null);
      clearInterval(id);
      refresh({ keepScroll: false });
      const sets = exercises.reduce((s, e) => s + e.sets.length, 0);
      toast(`Workout saved: ${exercises.length} exercise${exercises.length === 1 ? '' : 's'}, ${sets} sets`);
    },
  });
}

function addExercise() {
  const w = getActive();
  if (!w) return;
  const known = exerciseNames();
  const suggestions = [...known, ...COMMON.filter((c) => !known.some((k) => k.toLowerCase() === c.toLowerCase()))].slice(0, 18);
  openSheet({
    title: 'Add exercise',
    html: `
      <form class="stack">
        <input class="input" name="name" list="ex-names" placeholder="Exercise name" autofocus required aria-label="Exercise name">
        <datalist id="ex-names">${suggestions.map((s) => `<option value="${esc(s)}">`).join('')}</datalist>
        <div class="chips">${suggestions.map((s) => `<button type="button" class="chip" data-pick="${esc(s)}">${esc(s)}</button>`).join('')}</div>
        <div class="sheet-actions"><button class="btn primary" type="submit">Add</button></div>
      </form>`,
    onMount(sheet) {
      const form = sheet.el.querySelector('form');
      const add = (name) => {
        name = name.trim();
        if (!name) return;
        const prev = lastTime(name);
        // Start with last time's sets so you only need to change what's different.
        const sets = prev ? prev.sets.map((s) => ({ weight: s.weight, reps: s.reps })) : [{ weight: null, reps: null }];
        w.exercises.push({ name, sets });
        setActive(w);
        sheet.close();
        refresh();
      };
      sheet.el.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-pick]');
        if (chip) add(chip.dataset.pick);
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        add(form.name.value);
      });
    },
  });
}

// ---------- Looking at a past workout ----------

function openWorkout(id) {
  const w = data.workouts.find((x) => x.id === id);
  if (!w) return;
  openSheet({
    title: w.name,
    html: `
      <p class="muted small">${esc(niceDate(store.keyToDate(w.date)))}${w.minutes ? ` · ${w.minutes} min` : ''}${volume(w) ? ` · ${num(volume(w))} lb lifted` : ''}</p>
      <div class="stack" style="margin-top:12px">
        ${w.exercises.map((ex) => `<div class="ex-card"><h3>${esc(ex.name)}</h3><p class="small muted" style="margin-top:4px">${esc(setsText(ex.sets))}</p></div>`).join('')}
      </div>
      <div class="sheet-actions">
        <button class="btn danger" data-del>${icon('trash', 20)}Delete</button>
        <button class="btn go" data-repeat>${icon('repeat', 20)}Do it again</button>
      </div>`,
    onMount(sheet) {
      sheet.el.querySelector('[data-repeat]').addEventListener('click', () => {
        sheet.close();
        if (getActive()) {
          toast('Finish or discard the workout in progress first.');
          return;
        }
        startWorkout(w);
      });
      sheet.el.querySelector('[data-del]').addEventListener('click', async () => {
        const gone = await store.remove('workouts', w.id);
        sheet.close();
        refresh();
        toast('Workout deleted', {
          action: 'Undo',
          onAction: async () => {
            await store.save('workouts', gone);
            refresh();
          },
        });
      });
    },
  });
}
