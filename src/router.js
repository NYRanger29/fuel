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
  const view = document.getElementById('view');
  const scroll = window.scrollY;
  const screen = document.createElement('div');
  screen.className = 'screen';
  views[currentTab()](screen);
  view.replaceChildren(screen);
  window.scrollTo(0, keepScroll ? scroll : 0);
}

export function go(name) {
  if (currentTab() === name) refresh();
  else location.hash = `#/${name}`;
}
