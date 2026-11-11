// main.js: the starting point. It loads the saved data, draws the tab bar,
// and shows the right screen.

import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/figtree';
import './style.css';
import * as store from './store.js';
import { icon } from './ui.js';
import { TABS, register, refresh, currentTab } from './router.js';
import * as today from './views/today.js';
import * as food from './views/food.js';
import * as pantry from './views/pantry.js';
import * as train from './views/train.js';
import * as body from './views/body.js';

register('today', today.render);
register('food', food.render);
register('pantry', pantry.render);
register('train', train.render);
register('body', body.render);

function drawTabs() {
  const current = currentTab();
  document.getElementById('tabs').innerHTML = TABS.map(
    ([id, label]) =>
      `<a class="tab${id === current ? ' on' : ''}" href="#/${id}"${id === current ? ' aria-current="page"' : ''}>${icon(id, 24)}<span>${label}</span></a>`,
  ).join('');
}

window.addEventListener('hashchange', () => {
  drawTabs();
  refresh({ keepScroll: false });
});

try {
  await store.load();
  drawTabs();
  refresh();
} catch (error) {
  console.error(error);
  document.getElementById('view').innerHTML = `
    <div class="screen"><div class="card">
      <h2>Fuel could not open its saved data</h2>
      <p class="muted">This can happen in a private browsing window. Open Fuel in a normal window and try again.</p>
    </div></div>`;
}

// The service worker makes the app open without internet. It is only turned
// on in the built app, because it gets in the way while developing.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
