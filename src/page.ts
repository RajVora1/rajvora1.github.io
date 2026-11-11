import '@fontsource/young-serif/400.css';
import '@fontsource-variable/source-serif-4/opsz.css';
import '@fontsource-variable/source-serif-4/opsz-italic.css';
import './style.css';
import * as THREE from 'three';
import { shapeFor, type ShapeName } from './shapes';
import { ACCENT } from './theme';

const root = document.documentElement;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.querySelector<HTMLCanvasElement>('.hero-model');

let model: import('./model').HeroModel | null = null;

async function start() {
  if (!canvas) return;
  try {
    const { HeroModel } = await import('./model');
    model = new HeroModel(canvas, reduced, new THREE.Color(ACCENT));
    model.show(shapeFor(canvas.dataset.model as ShapeName, 5));
  } catch (err) {
    console.warn('WebGL unavailable; showing the text-only page.', err);
    root.classList.add('no-webgl');
  }
}

// Interest tabs: arrow keys move between them; selection swaps the model.
const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
function select(tab: HTMLButtonElement, focus = false) {
  for (const t of tabs) {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')!)!.hidden = !on;
  }
  if (focus) tab.focus();
  model?.show(shapeFor(tab.dataset.shape as ShapeName));
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
