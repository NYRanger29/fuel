// store.js: the app's memory.
// On startup it loads everything from the database into `data`, and every
// change is written back to the database straight away.

import * as db from './db.js';

export const data = { foods: [], weights: [], pantry: [], workouts: [], days: [], recipes: [] };

const SETTINGS_KEY = 'fuel.settings';
const API_KEY_KEY = 'fuel.apiKey';

export const DEFAULT_SETTINGS = {
  calories: 2800,
  protein: 150,
  carbs: 350,
  fat: 90,
  waterCups: 10,
  sleepHours: 8.5,
  goal: 'build',
  diet: '',
  model: 'claude-opus-5-5',
  targetsSet: false,
};

export let settings = { ...DEFAULT_SETTINGS };

export async function load() {
  try {
    settings = { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    settings = { ...DEFAULT_SETTINGS };
  }
  for (const name of db.COLLECTIONS) data[name] = await db.getAll(name);
  db.requestPersistence();
}

export function saveSettings(patch) {
  settings = { ...settings, ...patch };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// The API key is kept apart from everything else so it is never included
// in a backup file.
export const getApiKey = () => localStorage.getItem(API_KEY_KEY) || '';
export function setApiKey(key) {
  if (key) localStorage.setItem(API_KEY_KEY, key.trim());
  else localStorage.removeItem(API_KEY_KEY);
}

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export async function save(collection, record) {
  if (!record.id) record.id = newId();
  const list = data[collection];
  const i = list.findIndex((r) => r.id === record.id);
  if (i >= 0) list[i] = record;
  else list.push(record);
  await db.put(collection, record);
  return record;
}

export async function remove(collection, id) {
  const list = data[collection];
  const i = list.findIndex((r) => r.id === id);
  if (i < 0) return null;
  const [gone] = list.splice(i, 1);
  await db.remove(collection, id);
  return gone;
}

// ---------- Dates ----------
// Days are stored as "2026-11-10" in the phone's own time zone.

export function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function shiftKey(key, days) {
  const d = keyToDate(key);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

// ---------- Questions the screens ask ----------

export const foodsOn = (key) => data.foods.filter((f) => f.date === key);

export function totalsOn(key) {
  const t = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const f of foodsOn(key)) {
    t.calories += f.calories || 0;
    t.protein += f.protein || 0;
    t.carbs += f.carbs || 0;
    t.fat += f.fat || 0;
  }
  return t;
}

// One record per day holds water and sleep.
export function dayOn(key) {
  return data.days.find((d) => d.id === key) || { id: key, water: 0, sleep: null };
}

export function saveDay(key, patch) {
  return save('days', { ...dayOn(key), ...patch });
}

export const weightsSorted = () => [...data.weights].sort((a, b) => a.date.localeCompare(b.date));

export function latestWeight() {
  const w = weightsSorted();
  return w.length ? w[w.length - 1] : null;
}

// How many days in a row (ending today, or yesterday if today is not done
// yet) pass the test.
export function streak(test) {
  let key = dateKey();
  if (!test(key)) key = shiftKey(key, -1);
  let n = 0;
  while (test(key) && n < 3650) {
    n += 1;
    key = shiftKey(key, -1);
  }
  return n;
}

export const logStreak = () => streak((k) => data.foods.some((f) => f.date === k));
export const proteinStreak = () => streak((k) => totalsOn(k).protein >= settings.protein * 0.95);

// ---------- Backup ----------

export function exportBackup() {
  return JSON.stringify({ app: 'fuel', version: 1, exportedAt: new Date().toISOString(), settings, data }, null, 1);
}

export async function importBackup(text) {
  const parsed = JSON.parse(text);
  if (parsed.app !== 'fuel' || !parsed.data) throw new Error('That file is not a Fuel backup.');
  for (const name of db.COLLECTIONS) {
    const incoming = Array.isArray(parsed.data[name]) ? parsed.data[name] : [];
    for (const record of incoming) {
      if (record && record.id) await save(name, record);
    }
  }
  if (parsed.settings) saveSettings(parsed.settings);
}
