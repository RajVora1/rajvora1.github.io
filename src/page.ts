import '@fontsource/young-serif/400.css';
import '@fontsource-variable/source-serif-4/opsz.css';
import '@fontsource-variable/source-serif-4/opsz-italic.css';
import './style.css';

const root = document.documentElement;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.querySelector<HTMLCanvasElement>('.brick-title');
const heading = document.querySelector<HTMLHeadingElement>('.page-hero h1');

/** The page title, split at its forced line breaks. */
function titleSegments(h: HTMLElement) {
  const segs = [''];
  for (const node of h.childNodes) {
    if (node.nodeName === 'BR') segs.push('');
    else segs[segs.length - 1] += node.textContent ?? '';
  }
  return segs.map((s) => s.trim()).filter(Boolean);
}

async function start() {
  if (!canvas || !heading) return;
  try {
    const { BrickTitle } = await import('./brickTitle');
    new BrickTitle(canvas, titleSegments(heading), reduced);
    root.classList.add('brick-title-on');
  } catch (err) {
    console.warn('WebGL unavailable; showing the text title.', err);
    root.classList.add('no-webgl');
  }
}

// Interest tabs: arrow keys move between them.
const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
function select(tab: HTMLButtonElement, focus = false) {
  for (const t of tabs) {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')!)!.hidden = !on;
  }
  if (focus) tab.focus();
}
tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => select(tab));
  tab.addEventListener('keydown', (e) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (e.key === 'Home') select(tabs[0], true);
    else if (e.key === 'End') select(tabs[tabs.length - 1], true);
    else if (step) select(tabs[(i + step + tabs.length) % tabs.length], true);
    else return;
    e.preventDefault();
  });
});

// Photos are optional: each slot appears only once its file exists in public/photos.
for (const fig of document.querySelectorAll<HTMLElement>('figure[data-photo]')) {
  const img = new Image();
  img.alt = fig.dataset.alt ?? '';
  img.decoding = 'async';
  img.addEventListener(
    'load',
    () => {
      fig.append(img);
      fig.hidden = false;
    },
    { once: true },
  );
  img.src = fig.dataset.photo!;
}

start();
