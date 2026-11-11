// settings.js: targets, the target calculator, the AI key, and backups.

import * as store from '../store.js';
import { settings } from '../store.js';
import { esc, icon, num, toast, openSheet, formValues } from '../ui.js';
import { refresh } from '../router.js';
import { testKey } from '../ai.js';

const MODELS = [
  ['claude-opus-5-5', 'Claude Opus 5.5', 'Most accurate. About 2 to 4 cents per photo.'],
  ['claude-sonnet-5-5', 'Claude Sonnet 5.5', 'Fast and accurate. About 1 to 2 cents per photo.'],
  ['claude-haiku-5-5', 'Claude Haiku 5.5', 'Fastest and cheapest. Well under 1 cent per photo, a bit less accurate.'],
];

const ACTIVITY = [
  [1.375, 'Light: practice or gym 1 to 3 days a week'],
  [1.55, 'Moderate: training 3 to 5 days a week'],
  [1.725, 'Very active: hard training 6 to 7 days a week'],
  [1.9, 'Athlete: two-a-days or a physical job too'],
];

// Mifflin-St Jeor: a standard formula for the calories your body burns.
function calculate({ age, sex, feet, inches, weight, activity, goal }) {
  const kg = weight * 0.4536;
  const cm = (feet * 12 + inches) * 2.54;
  const base = 10 * kg + 6.25 * cm - 5 * age + (sex === 'female' ? -161 : 5);
  const adjust = goal === 'build' ? 300 : goal === 'lose' ? -450 : 0;
  const calories = Math.round((base * activity + adjust) / 50) * 50;
  const protein = Math.round((weight * (goal === 'maintain' ? 0.7 : 0.8)) / 5) * 5;
  const fat = Math.round((calories * 0.28) / 9 / 5) * 5;
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4 / 5) * 5);
  return { calories, protein, fat, carbs };
}

export function openSettings() {
  const latest = store.latestWeight();
  const p = settings.profile || {};
  const keySaved = Boolean(store.getApiKey());

  openSheet({
    title: 'Settings',
    wide: true,
    html: `
      <form class="stack" data-targets>
        <h3>Daily targets</h3>
        <div class="grid-2">
          <label class="field"><span>Calories</span><input class="input" name="calories" type="number" inputmode="numeric" min="800" max="8000" value="${settings.calories}"></label>
          <label class="field"><span>Protein (g)</span><input class="input" name="protein" type="number" inputmode="numeric" min="0" max="500" value="${settings.protein}"></label>
          <label class="field"><span>Carbs (g)</span><input class="input" name="carbs" type="number" inputmode="numeric" min="0" max="1200" value="${settings.carbs}"></label>
          <label class="field"><span>Fat (g)</span><input class="input" name="fat" type="number" inputmode="numeric" min="0" max="400" value="${settings.fat}"></label>
          <label class="field"><span>Water (cups)</span><input class="input" name="waterCups" type="number" inputmode="numeric" min="1" max="30" value="${settings.waterCups}"></label>
          <label class="field"><span>Sleep (hours)</span><input class="input" name="sleepHours" type="number" inputmode="decimal" step="0.5" min="4" max="12" value="${settings.sleepHours}"></label>
        </div>
        <label class="field"><span>Goal</span><select class="input" name="goal">
          ${[['build', 'Build muscle'], ['lose', 'Lose fat'], ['maintain', 'Maintain']].map(([v, l]) => `<option value="${v}" ${settings.goal === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></label>

        <details data-calc>
          <summary class="btn block" style="list-style:none">${icon('flame', 20)}Calculate targets for me</summary>
          <div class="stack" style="margin-top:12px">
            <div class="grid-2">
              <label class="field"><span>Age</span><input class="input" name="age" type="number" inputmode="numeric" min="10" max="99" value="${p.age ?? ''}"></label>
              <label class="field"><span>Sex</span><select class="input" name="sex"><option value="male" ${p.sex !== 'female' ? 'selected' : ''}>Male</option><option value="female" ${p.sex === 'female' ? 'selected' : ''}>Female</option></select></label>
              <label class="field"><span>Height (ft)</span><input class="input" name="feet" type="number" inputmode="numeric" min="3" max="8" value="${p.feet ?? ''}"></label>
              <label class="field"><span>Height (in)</span><input class="input" name="inches" type="number" inputmode="numeric" min="0" max="11" value="${p.inches ?? ''}"></label>
            </div>
            <label class="field"><span>Weight (lb)</span><input class="input" name="calcWeight" type="number" inputmode="decimal" step="0.1" value="${latest ? latest.weight : p.weight ?? ''}"></label>
            <label class="field"><span>How active are you?</span><select class="input" name="activity">
              ${ACTIVITY.map(([v, l]) => `<option value="${v}" ${Number(p.activity || 1.725) === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select></label>
            <button type="button" class="btn go" data-calc-go>Fill in my targets</button>
            <p class="hint">This is an estimate from a standard formula. Watch your weight trend for 2 to 3 weeks and adjust: if you are building muscle and the trend is flat, add 150 to 200 calories.</p>
          </div>
        </details>

        <label class="field"><span>Food notes and allergies</span>
          <textarea class="input" name="diet" placeholder="For example: allergic to peanuts, no pork, I hate mushrooms">${esc(settings.diet)}</textarea>
          <span class="hint" style="display:block">Meal ideas always follow these.</span></label>

        <button class="btn primary" type="submit">Save targets</button>
      </form>

      <hr style="border:0;border-top:1px solid var(--line);margin:26px 0">

      <form class="stack" data-key>
        <h3>Photo reading (Claude API key)</h3>
        <p class="small muted">Fuel uses Claude, an AI made by Anthropic, to read meal photos and receipts and to invent meals. It needs an API key, which is like a password that lets this app use your Claude account. Each photo costs a few cents or less.</p>
        <details>
          <summary class="small" style="cursor:pointer;font-weight:650">How to get a key</summary>
          <ol class="small" style="padding-left:20px;margin:8px 0 0">
            <li>On a computer, go to <strong>platform.claude.com</strong> and sign up. Ask a parent if you need a payment card.</li>
            <li>Open <strong>Billing</strong> and add a small amount of credit, like $5. That covers hundreds of photos.</li>
            <li>Open <strong>API keys</strong>, click <strong>Create key</strong>, and name it "Fuel".</li>
            <li>Copy the key (it starts with <code>sk-ant-</code>) and paste it below. Keep it secret: anyone with it can spend your credit.</li>
            <li>To be safe, set a monthly spend limit in the Console under <strong>Limits</strong>.</li>
          </ol>
        </details>
        <label class="field"><span>${keySaved ? 'Key saved on this device' : 'API key'}</span>
          <input class="input" name="key" type="password" autocomplete="off" spellcheck="false" placeholder="${keySaved ? '••••••••  (paste a new key to replace it)' : 'sk-ant-...'}"></label>
        <p class="hint">The key stays on this device only. It is never put in backups.</p>
        <div class="row wrap">
          <button class="btn primary" type="submit">Save key</button>
          ${keySaved ? `<button type="button" class="btn" data-test>Test key</button><button type="button" class="btn danger" data-remove-key>Remove</button>` : ''}
        </div>
        <div data-key-status></div>
        <label class="field"><span>AI model</span><select class="input" name="model">
          ${MODELS.map(([v, l]) => `<option value="${v}" ${settings.model === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></label>
        <p class="hint" data-model-hint>${esc(MODELS.find(([v]) => v === settings.model)?.[2] || '')}</p>
      </form>

      <hr style="border:0;border-top:1px solid var(--line);margin:26px 0">

      <div class="stack">
        <h3>Backup</h3>
        <p class="small muted">Everything you log is saved on this device only. Download a backup now and then, and use it to move your data to a new phone.</p>
        <div class="row wrap">
          <button class="btn" data-export>Download backup</button>
          <button class="btn" data-import>Restore from backup</button>
        </div>
      </div>`,
    onMount(sheet) {
      const root = sheet.el;
      const targets = root.querySelector('[data-targets]');
      const keyForm = root.querySelector('[data-key]');

      root.querySelector('[data-calc-go]').addEventListener('click', () => {
        const v = formValues(targets);
        const input = { age: v.age, sex: v.sex, feet: v.feet, inches: v.inches ?? 0, weight: v.calcWeight, activity: Number(targets.activity.value), goal: v.goal };
        if (!input.age || !input.feet || !input.weight) {
          toast('Fill in age, height, and weight first.');
          return;
        }
        const r = calculate(input);
        for (const [k, val] of Object.entries(r)) targets[k].value = val;
        store.saveSettings({ profile: { age: input.age, sex: input.sex, feet: input.feet, inches: input.inches, weight: input.weight, activity: input.activity } });
        toast(`Filled in ${num(r.calories)} calories and ${r.protein} g protein. Tap Save targets to keep them.`);
      });

      targets.addEventListener('submit', (e) => {
        e.preventDefault();
        const v = formValues(targets);
        const patch = { goal: v.goal, diet: v.diet, targetsSet: true };
        for (const k of ['calories', 'protein', 'carbs', 'fat', 'waterCups', 'sleepHours']) if (v[k] != null && v[k] > 0) patch[k] = v[k];
        store.saveSettings(patch);
        refresh();
        toast('Targets saved');
      });

      const status = root.querySelector('[data-key-status]');
      keyForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const key = keyForm.key.value.trim();
        if (!key) return;
        if (!key.startsWith('sk-ant-')) {
          status.innerHTML = `<div class="error-box">That does not look like a Claude API key. It should start with sk-ant-.</div>`;
          return;
        }
        store.setApiKey(key);
        sheet.close();
        refresh();
        toast('Key saved. Open Settings again to test it.');
      });
      keyForm.model.addEventListener('change', () => {
        store.saveSettings({ model: keyForm.model.value });
        root.querySelector('[data-model-hint]').textContent = MODELS.find(([v]) => v === keyForm.model.value)?.[2] || '';
        toast('Model saved');
      });
      root.querySelector('[data-test]')?.addEventListener('click', async () => {
        status.innerHTML = `<div class="reading-label"><span class="spinner"></span>Testing</div>`;
        try {
          await testKey();
          status.innerHTML = `<div class="confidence" style="background:var(--turf-soft);color:var(--turf)">The key works. Photo reading is on.</div>`;
        } catch (error) {
          status.innerHTML = `<div class="error-box">${esc(error.message)}</div>`;
        }
      });
      root.querySelector('[data-remove-key]')?.addEventListener('click', () => {
        if (!confirm('Remove the API key from this device? Photo reading will turn off.')) return;
        store.setApiKey('');
        sheet.close();
        refresh();
        toast('Key removed from this device');
      });

      root.querySelector('[data-export]').addEventListener('click', () => {
        const blob = new Blob([store.exportBackup()], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `fuel-backup-${store.dateKey()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      });
      root.querySelector('[data-import]').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json,.json';
        input.addEventListener('change', async () => {
          const file = input.files?.[0];
          if (!file) return;
          try {
            await store.importBackup(await file.text());
            sheet.close();
            refresh();
            toast('Backup restored');
          } catch (error) {
            toast(error.message || 'That file could not be read.');
          }
        });
        input.click();
      });
    },
  });
}
