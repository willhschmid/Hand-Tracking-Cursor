/* Test page wiring. The library needs none of this. */

const cursor = HandCursor.init({ position: 'bottom-left' });

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ---------------------------------------------------------------- content --

const LANDMARKS = [
  'Wrist', 'Thumb CMC', 'Thumb MCP', 'Thumb IP', 'Thumb tip',
  'Index MCP', 'Index PIP', 'Index DIP', 'Index tip',
  'Middle MCP', 'Middle PIP', 'Middle DIP', 'Middle tip',
  'Ring MCP', 'Ring PIP', 'Ring DIP', 'Ring tip',
  'Pinky MCP', 'Pinky PIP', 'Pinky DIP', 'Pinky tip',
];

const items = (labels) =>
  labels
    .map((label, i) => `<div class="item"><span>${label}</span><span>${i}</span></div>`)
    .join('');

$('#list-a').innerHTML = items(LANDMARKS);
$('#list-b').innerHTML = items(
  Array.from({ length: 30 }, (_, i) => `Row ${String(i + 1).padStart(2, '0')}`),
);
$('#nested-inner').innerHTML = items(
  Array.from({ length: 20 }, (_, i) => `Inner row ${i + 1}`),
);

$('#railway').innerHTML = Array.from(
  { length: 18 },
  (_, i) => `<div class="chip">${i + 1}</div>`,
).join('');

$('#bands').innerHTML = Array.from(
  { length: 30 },
  (_, i) => `<div class="band"><span>Band ${i + 1}</span><span>${(i + 1) * 100}px</span></div>`,
).join('');

$('#targets-grid').innerHTML = Array.from(
  { length: 12 },
  (_, i) => `<button class="target" type="button" aria-label="Target ${i + 1}"></button>`,
).join('');

// ---------------------------------------------------------------- buttons --

const tallies = { lg: 0, md: 0, sm: 0 };

$$('[data-counter]').forEach((button) => {
  const size = button.classList.contains('btn--lg')
    ? 'lg'
    : button.classList.contains('btn--sm')
      ? 'sm'
      : 'md';
  button.addEventListener('click', () => {
    tallies[size] += 1;
    const label = $(`[data-tally-for="${size}"]`);
    label.textContent = `${tallies[size]} tap${tallies[size] === 1 ? '' : 's'}`;
    button.classList.remove('is-hit');
    void button.offsetWidth; // restart the animation
    button.classList.add('is-hit');
  });
});

// ---------------------------------------------------------------- targets --

const scoreEl = $('#targets-score');
const updateScore = () => {
  scoreEl.textContent = String($$('.target.is-hit').length);
};

$$('.target').forEach((target) => {
  target.addEventListener('click', () => {
    target.classList.add('is-hit');
    updateScore();
  });
});

$('#targets-reset').addEventListener('click', () => {
  $$('.target').forEach((t) => t.classList.remove('is-hit'));
  updateScore();
});

// ------------------------------------------------------------ calibration --

const settings = { region: 0.15, cutoff: 1.4, pinch: 0.42, size: 18 };

function renderSnippet() {
  $('#snippet').textContent = `HandCursor.init({
  region: { x: ${settings.region}, y: ${settings.region} },
  smoothing: { minCutoff: ${settings.cutoff}, beta: 0.015 },
  pinch: { on: ${settings.pinch}, off: ${(settings.pinch + 0.13).toFixed(2)} },
});`;
}

function bindSlider(id, valueId, key, apply, format = (v) => v) {
  const input = $(id);
  const output = $(valueId);
  input.addEventListener('input', () => {
    const value = Number(input.value);
    settings[key] = value;
    output.textContent = format(value);
    apply(value);
    renderSnippet();
  });
}

bindSlider('#s-region', '#v-region', 'region', (value) => {
  cursor.options.region.x = value;
  cursor.options.region.y = value;
});

bindSlider('#s-cutoff', '#v-cutoff', 'cutoff', (value) => {
  cursor.driver.setSmoothing({ minCutoff: value });
});

bindSlider('#s-pinch', '#v-pinch', 'pinch', (value) => {
  cursor.options.pinch.on = value;
  cursor.options.pinch.off = value + 0.13;
});

bindSlider(
  '#s-size',
  '#v-size',
  'size',
  (value) => cursor.panel.root.style.setProperty('--hc-cursor-w', `${value}px`),
  (value) => `${value}px`,
);

renderSnippet();

$$('[data-option]').forEach((input) => {
  input.addEventListener('change', () => {
    switch (input.dataset.option) {
      case 'rotation':
        cursor.options.rotation.enabled = input.checked;
        break;
      case 'grayscale':
        cursor.options.grayscale = input.checked;
        cursor.applyStyleVariables();
        break;
      case 'minimized':
        cursor.setMinimized(input.checked);
        break;
      case 'hideNativeCursor':
        cursor.options.hideNativeCursor = input.checked;
        document.documentElement.style.setProperty(
          'cursor',
          input.checked && cursor.running ? 'none' : '',
          'important',
        );
        break;
    }
  });
});

$$('[data-reposition]').forEach((button) => {
  button.addEventListener('click', () => {
    cursor.panel.root.dataset.position = button.dataset.reposition;
  });
});

// ------------------------------------------------------------------- hud --

const hud = {
  state: $('#hud-state'),
  pos: $('#hud-pos'),
  pinch: $('#hud-pinch'),
  fps: $('#hud-fps'),
  target: $('#hud-target'),
  scroll: $('#hud-scroll'),
};

let frames = 0;
let lastSample = performance.now();

document.addEventListener('handcursor:move', (event) => {
  const { x, y, pinching } = event.detail;
  hud.pos.textContent = `${Math.round(x)}, ${Math.round(y)}`;
  hud.pinch.textContent = pinching ? 'closed' : 'open';
  hud.pinch.classList.toggle('is-pinched', pinching);

  frames += 1;
  const now = performance.now();
  if (now - lastSample >= 500) {
    hud.fps.textContent = `${Math.round((frames * 1000) / (now - lastSample))} fps`;
    frames = 0;
    lastSample = now;
  }
});

const setState = (text, kind) => {
  hud.state.textContent = text;
  hud.state.className = kind ? `is-${kind}` : '';
};

document.addEventListener('handcursor:start', () => setState('tracking', 'live'));
document.addEventListener('handcursor:stop', () => {
  setState('idle');
  hud.pos.textContent = '—';
  hud.fps.textContent = '— fps';
});
document.addEventListener('handcursor:error', (event) => {
  setState(event.detail.message, 'error');
});

// The library dispatches real pointer events, so plain listeners see the cursor.
document.addEventListener('mouseover', (event) => {
  const el = event.target;
  const name = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : el.className ? `.${String(el.className).split(' ')[0]}` : '';
  hud.target.textContent = `${name}${id}`;
});

const updateScroll = () => {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  hud.scroll.textContent = `${max > 0 ? Math.round((window.scrollY / max) * 100) : 0}%`;
};
window.addEventListener('scroll', updateScroll, { passive: true });
updateScroll();

// ------------------------------------------------------------------- log --

const log = $('#log');
const write = (name, text) => {
  const li = document.createElement('li');
  li.innerHTML = `<b>${name}</b><span>${text}</span>`;
  log.prepend(li);
  while (log.children.length > 60) log.lastElementChild.remove();
};

for (const type of ['start', 'stop', 'press', 'release', 'tap', 'error', 'minimize', 'expand']) {
  document.addEventListener(`handcursor:${type}`, (event) => {
    const { x, y, target, message } = event.detail;
    if (x === undefined) {
      write(type, message || '');
      return;
    }
    const label = target ? ` → <${target.tagName.toLowerCase()}>` : '';
    write(type, `${Math.round(x)}, ${Math.round(y)}${label}`);
  });
}

console.log('hand cursor test page ready', cursor);
