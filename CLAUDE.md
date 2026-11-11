# Fitness Tracker

Grant's personal app for tracking nutrition, workouts, and body stats.

## Build in progress
The app is built but not yet online. Read HANDOFF.md for the remaining
publishing steps.

## Decisions so far
- Name: Fuel. Phone web app (installable to the home screen, also works on a laptop). No App Store.
- Built with Vite and plain JavaScript (no framework). `npm run dev` runs it, `npm run build` builds it.
- Code layout: `src/views/` has one file per screen; `src/store.js` holds data; `src/ai.js` talks to Claude.
- Data: saved on the device (IndexedDB). Settings and the API key are in localStorage; the key is never in backups.
- AI: Claude API called straight from the browser with the key Grant enters in Settings. Default model `claude-opus-5-5`.
- Hosting: GitHub Pages, public repo, deployed by `.github/workflows/deploy.yml`.
- Goal setting: build muscle.
- Tools available: Node.js, npm, Git, GitHub CLI (gh).
- Default branch: main.

## First-version features
1. Food log: meals, calories, protein, carbs, fat per day
2. Workout log: exercises, sets, reps, weight, progress over time
3. Body stats: weight, sleep, water, with charts
4. Goals and streaks: daily targets, streaks for motivation

## Working rules
- Grant is a beginner. Explain each step in plain words.
- Commit to Git after each finished piece so there is always a safe point to go back to.
- Never commit secrets (API keys, passwords) or real personal health data.
