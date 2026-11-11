# Handoff: how to continue building Fuel

Grant paused the first build session partway through. This file tells the next
session (any model) exactly where things stand and what to build next.

**To continue:** open this project, then say:
"Read HANDOFF.md and continue the build from where it stopped."

Work through "What is left" in order. Commit after each step. Delete a step
from this file when it is finished, and delete this whole file when the list
is empty.

## What Grant asked for

An app to track weight, photograph meals to get calories, photograph receipts
to fill a pantry list, and get meal ideas from the pantry on request. He asked
for an ambitious result. His answers to the setup questions:

- AI: Claude API. Grant does not have a key yet. He creates it himself at
  platform.claude.com (needs a payment card, so maybe a parent's OK) and types
  it into the app's Settings. Never ask him to paste the key into chat and
  never write it to a file.
- Hosting: GitHub Pages, public repo. `gh` is NOT logged in yet. Grant has to
  run `gh auth login` himself before publishing. Confirm with him before
  creating the public repo.
- Goal: build muscle (default targets 2,800 kcal, 150 g protein).
- Scope: everything. Weight, food photos, receipts and pantry, meal ideas,
  workouts, sleep, water, goals, streaks.

## Decisions already made

- App name: "Fuel". Phone-first web app, installable, works offline except AI.
- Vite + plain JavaScript modules (no framework). `npm run dev` to run,
  `npm run build` to build into `dist/`.
- Data lives on the device in IndexedDB. Settings and the API key live in
  localStorage. The key is never included in backups.
- AI calls go straight from the browser to Anthropic with the official SDK
  (`@anthropic-ai/sdk`, `dangerouslyAllowBrowser: true`), structured answers
  via `client.messages.parse` + `zodOutputFormat`. Default model
  `claude-opus-5-5`, changeable in Settings (offer `claude-haiku-5-5` as the
  cheaper, faster choice).
- Fonts are bundled, not loaded from the web: `@fontsource-variable/bricolage-grotesque`
  (headings and big numbers) and `@fontsource-variable/figtree` (body).
- Look: a sports "fuel gauge" feel. Colors: ink `#13233A`, paper `#F2F5F0`,
  turf green `#1F8A5B` (protein, on target), mango `#FFB627` (calories,
  energy), berry `#D7386B` (fat, over target, delete), sky `#3D8BFD` (water).
  Dark mode uses ink `#0E1A2B` as the background. Sentence case everywhere,
  no all-caps labels. Bottom tab bar with five tabs.

## What is done

| File | State |
|---|---|
| `package.json`, `vite.config.js`, `index.html` | Done |
| `src/db.js` | Done. IndexedDB wrapper |
| `src/store.js` | Done. In-memory data, settings, dates, totals, streaks, backup |
| `src/ui.js` | Done. `esc`, `icon`, `on` (click routing by `data-act`), `formValues`, `openSheet`, `toast`, `pickImage`, `shrinkImage`, `lineChart`, `barChart`, `meter` |
| `src/ai.js` | Done but never run. `analyzeFoodPhoto`, `analyzeFoodText`, `analyzeReceipt`, `suggestMeals`, `testKey`, `AiError`, `hasKey` |

Nothing has been run or tested yet. The app does not start until
`src/main.js` and `src/style.css` exist.

## What is left

1. **`src/style.css`** using the look above. Classes the helpers already
   emit: `.icon`, `.icon-btn`, `.sheet-wrap`, `.sheet-backdrop`, `.sheet`,
   `.sheet-wide`, `.sheet-head`, `.sheet-body`, `.closing`, `.toast`,
   `.chart` (`.grid`, `.tick`, `.line`, `.trend`, `.dot`, `.dot-last`),
   `.bars` (`.bars-target`, `.bar-col`, `.bar-track`, `.bar-fill`, `.hit`,
   `.bar-label`), `.meter` (`.meter-top`, `.meter-track`, `.meter-fill`,
   tones `.meter-calories`, `.meter-protein`, `.meter-carbs`, `.meter-fat`).
   Respect safe-area insets, reduced motion, and visible keyboard focus.
2. **`src/main.js`**: import the fonts and CSS, call `store.load()`, draw the
   tab bar into `#tabs` (Today, Food, Pantry, Train, Body), switch views by
   URL hash, expose a `refresh()` that redraws the current view, register the
   service worker.
3. **`src/views/today.js`**: date, streak badge, settings button; calories and
   macro meters for today; quick buttons (Snap a meal, Weigh in, water +1,
   sleep); today's meals; a "What can I make?" card; setup nudges when there
   is no API key or targets are not set.
4. **`src/views/food.js`**: day switcher; meals grouped by Breakfast, Lunch,
   Dinner, Snack; add by photo, by description (AI), by hand, or from recent
   foods. Photo flow: pick, shrink, show the photo with a "reading" state,
   then an editable list of items with totals, a meal picker, and Save. Store
   one food record per meal: `{ id, date, meal, name, calories, protein,
   carbs, fat, items, thumb }` where `thumb` is a small (about 320 px) JPEG
   data URL. Tap an entry to edit or delete, with an Undo toast.
5. **`src/views/pantry.js`**: list grouped by category with search; add by
   hand; "Scan receipt" gives a review list (tick, rename, change quantity)
   and merges into existing items by name. Pantry record: `{ id, name,
   quantity, unit, category, added }`. Meal ideas sheet: mood text, meal type
   chips, "only what I have" switch, sends remaining calories and protein for
   today; result cards open to ingredients and steps; "Save recipe" (to
   `recipes`) and "I ate this" (logs the food and offers to remove the used
   pantry items).
6. **`src/views/train.js`**: start a workout, add exercises and sets (weight
   and reps, "add set" copies the last one), suggest past exercise names and
   show the last performance, keep the unfinished workout in localStorage.
   Workout record: `{ id, date, name, exercises: [{ name, sets: [{ weight,
   reps }] }] }`. History list, repeat a past workout, and a per-exercise
   progress chart (best estimated one-rep max: `weight * (1 + reps / 30)`).
7. **`src/views/body.js`**: log weight (lb) with a line chart and 7-day
   average trend line, range 30 days / 90 days / all; sleep bars for 14 days;
   water bars for 7 days; streaks and how many days this week hit protein.
8. **`src/views/settings.js`** (opens as a sheet): targets, a calculator
   (Mifflin-St Jeor, activity factor, +300 kcal for building, protein about
   0.8 g per lb, labeled as an estimate), dietary notes and allergies, API key
   field (password type) with plain step-by-step instructions and a "Test key"
   button, model choice, export and import backup.
9. **Installable and offline**: `public/manifest.webmanifest`,
   `public/sw.js` (network-first for the page, cache-first for built files),
   `public/icon.svg`, and PNG icons 180, 192, 512 (make them with a small
   Node script; no image tools are installed).
10. **Test** in the built-in browser at phone size: every screen, add and
    edit and delete, charts with sample data, the no-key error path, dark
    mode. AI calls cannot be tested until Grant adds a key; say so plainly.
11. **Publish**: add `.github/workflows/deploy.yml` (build with Vite, deploy
    `dist/` to GitHub Pages). Grant runs `gh auth login`, then create the
    public repo, push, turn on Pages, and give him the link plus how to add
    it to his home screen. Then walk him through making the API key.
12. Update `CLAUDE.md` "Decisions so far" and remove this file.

## Rules to keep

- Grant is a beginner: explain each step in plain words.
- Never commit secrets or real health data. Never delete things for good.
- All user-entered text goes through `esc()` before it is put into HTML.
