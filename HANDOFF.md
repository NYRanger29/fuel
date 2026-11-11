# Handoff: what is left for Fuel

The app is fully built and tested on this computer. What remains is putting it
online so Grant can use it on his phone, and turning on photo reading.

**To continue:** open this project and say "Read HANDOFF.md and finish
publishing the app."

## Already done

- All screens: Today, Food (photo, describe, by hand), Pantry (receipt scan,
  meal ideas, saved recipes), Train, Body, Settings (targets calculator, API
  key, model choice, backups).
- Installable and offline: manifest, service worker, icons
  (`node scripts/make-icons.mjs` redraws the icons).
- Tested in the built-in browser at phone size, light and dark mode. The AI
  path was tested only with a fake key (it reached Claude and showed the
  "key not accepted" message). Real photo reading has not been tried yet.
- `.github/workflows/deploy.yml` builds the app and publishes `dist/` to
  GitHub Pages on every push to `main`.

## What is left

1. Grant signs in to GitHub on this computer by running `gh auth login` in a
   terminal (GitHub.com, HTTPS, log in with a web browser).
2. Confirm with Grant, then create a **public** repo named `fuel` and push:
   `gh repo create fuel --public --source . --push`.
3. Turn on Pages with GitHub Actions as the source:
   `gh api -X POST repos/{owner}/fuel/pages -f build_type=workflow`
   (if it already exists, use `-X PUT`). Then watch the "Deploy to GitHub
   Pages" run finish. The link will be `https://<username>.github.io/fuel/`.
4. Tell Grant how to add it to his home screen. iPhone: open the link in
   Safari, tap Share, then "Add to Home Screen". Android: open in Chrome, tap
   the menu, then "Install app" or "Add to Home screen".
5. Walk Grant through making a Claude API key (the steps are also in the
   app's Settings). He types it into the app on his phone himself. Suggest a
   monthly spend limit in the Claude Console. Then have him try a real meal
   photo and a real receipt, and fix anything that goes wrong.
6. Remove the "Build in progress" section from `CLAUDE.md` and delete this
   file.

## Rules to keep

- Grant is a beginner: explain each step in plain words.
- Never commit secrets or real health data. Never delete things for good.
- The Git name for this repo is "Grant" with a GitHub noreply email, so his
  real email stays out of the public repo.
