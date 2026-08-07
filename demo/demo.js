/* Demo wiring. The library itself needs none of this. */

const cursor = HandCursor.init({ position: 'bottom-left' });

// --- filler list, so there is an element with its own scrollbar -------------
const list = document.getElementById('list');
const words = [
  'Wrist', 'Thumb CMC', 'Thumb MCP', 'Thumb IP', 'Thumb tip',
  'Index MCP', 'Index PIP', 'Index DIP', 'Index tip',
  'Middle MCP', 'Middle PIP', 'Middle DIP', 'Middle tip',
  'Ring MCP', 'Ring PIP', 'Ring DIP', 'Ring tip',
  'Pinky MCP', 'Pinky PIP', 'Pinky DIP', 'Pinky tip',
];
list.innerHTML = words
  .map((word, i) => `<div class="item"><span>${word}</span><span>${i}</span></div>`)
  .join('');

// --- tap counter -----------------------------------------------------------
const counter = document.querySelector('[data-count]');
let taps = 0;
counter.addEventListener('click', () => {
  taps += 1;
  counter.textContent = `Tapped ${taps} time${taps === 1 ? '' : 's'}`;
});

// --- options ---------------------------------------------------------------
document.querySelectorAll('[data-option]').forEach((input) => {
  input.addEventListener('change', () => {
    const active = HandCursor.instance();
    if (!active) return;
    switch (input.dataset.option) {
      case 'grayscale':
        active.options.grayscale = input.checked;
        active.applyStyleVariables();
        break;
      case 'rotation':
        active.options.rotation.enabled = input.checked;
        break;
      case 'minimized':
        active.setMinimized(input.checked);
        break;
    }
  });
});

document.querySelectorAll('[data-reposition]').forEach((button) => {
  button.addEventListener('click', () => {
    const active = HandCursor.instance();
    if (active) active.panel.root.dataset.position = button.dataset.reposition;
  });
});

// --- event log -------------------------------------------------------------
const log = document.getElementById('log');
const write = (name, text) => {
  const li = document.createElement('li');
  li.innerHTML = `<b>${name}</b><span>${text}</span>`;
  log.prepend(li);
  while (log.children.length > 40) log.lastElementChild.remove();
};

for (const type of ['start', 'stop', 'press', 'release', 'tap', 'error', 'minimize', 'expand']) {
  document.addEventListener(`handcursor:${type}`, (event) => {
    const { x, y, target, message } = event.detail;
    const where =
      x === undefined
        ? message || ''
        : `${Math.round(x)}, ${Math.round(y)}${target ? ` → <${target.tagName.toLowerCase()}>` : ''}`;
    write(type, where);
  });
}

console.log('hand cursor demo ready', cursor);
