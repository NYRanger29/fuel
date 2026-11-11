// router.js: decides which screen is showing.
// The web address ends in "#/food", "#/body" and so on. When it changes, the
// matching screen is drawn into <main id="view">.

export const TABS = [
  ['today', 'Today'],
  ['food', 'Food'],
  ['pantry', 'Pantry'],
  ['train', 'Train'],
  ['body', 'Body'],
];

const views = {};
let shownTab = null;

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function register(name, render) {
  views[name] = render;
}

export function currentTab() {
  const name = location.hash.replace(/^#\/?/, '');
  return views[name] ? name : 'today';
}

// Redraw the screen that is showing. Each redraw gets a brand new container,
// so click listeners from the old drawing are thrown away with it.
export function refresh({ keepScroll = true } = {}) {
  const tab = currentTab();
  const changed = tab !== shownTab;
  const order = (t) => TABS.findIndex(([id]) => id === t);
  const direction = shownTab && order(tab) < order(shownTab) ? 'back' : 'forward';
  shownTab = tab;

  const swap = () => {
    const view = document.getElementById('view');
    const scroll = window.scrollY;
    const screen = document.createElement('div');
    screen.className = changed ? 'screen entering' : 'screen';
    views[tab](screen);
    view.replaceChildren(screen);
    window.scrollTo(0, keepScroll && !changed ? scroll : 0);
  };

  // When the tab changes, slide the old screen out and the new one in.
  // Browsers without View Transitions (or with reduced motion on) just swap.
  if (changed && document.startViewTransition && !reducedMotion() && document.getElementById('view').childElementCount) {
    document.documentElement.dataset.nav = direction;
    document.startViewTransition(swap);
  } else {
    swap();
  }
}

export function go(name) {
  if (currentTab() === name) refresh();
  else location.hash = `#/${name}`;
}
