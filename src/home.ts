import '@fontsource/young-serif/400.css';
import '@fontsource-variable/source-serif-4/opsz.css';
import './style.css';
import { GROUND } from './theme';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
const canvas = document.getElementById('chameleon') as HTMLCanvasElement;
const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.menu a'));

type ChameleonT = import('./chameleon').Chameleon;
let chameleon: ChameleonT | null = null;
let active: HTMLAnchorElement | null = null;
let leaving = false;

/** Where the tongue lands: just past the end of the word. */
function anchorPoint(a: HTMLAnchorElement) {
  const el = a.querySelector<HTMLElement>('.menu-word')!;
  const word = el.getBoundingClientRect();
  return { x: word.right + 16, y: word.top + word.height * 0.55 };
}

function point(a: HTMLAnchorElement | null) {
  if (leaving) return;
  active = a;
  const target = a ? anchorPoint(a) : null;
  for (const l of links) l.classList.toggle('is-active', l === a);
  root.classList.toggle('has-active', !!a);
  chameleon?.aim(target);
}

async function fetchSection(a: HTMLAnchorElement) {
  if (active !== a) point(a);
  leaving = true;

  if (chameleon && !reduced) {
    // Let the tongue reach the word first (taps and Enter can arrive before it does).
    await chameleon.attached();

    // The word rides the tongue tip back to the mouth, frame by frame.
    const word = a.querySelector<HTMLElement>('.menu-word')!;
    word.style.transition = 'none';
    word.style.transform = 'none';
    const box = word.getBoundingClientRect();
    const anchor = { x: box.right + 14, y: box.top + box.height * 0.52 };
    const mouth = chameleon.mouthScreen();
    const total = Math.hypot(anchor.x - mouth.x, anchor.y - mouth.y) || 1;
    word.style.transformOrigin = 'right center';
    let riding = true;
    const ride = () => {
      if (!riding || !chameleon) return;
      const tip = chameleon.tipScreen();
      const left = Math.hypot(tip.x - mouth.x, tip.y - mouth.y) / total;
      const s = 0.12 + 0.88 * Math.min(1, left);
      word.style.transform = `translate(${tip.x - anchor.x}px, ${tip.y - anchor.y}px) scale(${s})`;
      word.style.opacity = String(Math.min(1, left * 2.5));
      requestAnimationFrame(ride);
    };
    requestAnimationFrame(ride);
    await chameleon.grab();
    riding = false;
    word.style.opacity = '0';
    root.classList.add('is-leaving');
    await new Promise((r) => setTimeout(r, 140));
  }
  window.location.href = a.href;
}

for (const a of links) {
  a.addEventListener('pointerenter', () => point(a));
  a.addEventListener('focus', () => point(a));
  a.addEventListener('pointerleave', () => active === a && point(null));
  a.addEventListener('blur', () => active === a && point(null));
  a.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    if (!leaving) fetchSection(a);
  });
}

window.addEventListener('resize', () => active && chameleon?.aim(anchorPoint(active)));
window.addEventListener('pageshow', (e) => {
  // Coming back with the back button: reset the reeled-in word.
  if (!e.persisted) return;
  leaving = false;
  root.classList.remove('is-leaving');
  for (const w of document.querySelectorAll<HTMLElement>('.menu-word')) w.removeAttribute('style');
  active = null;
  point(null);
});

(async () => {
  try {
    const { Chameleon } = await import('./chameleon');
    chameleon = new Chameleon(canvas, reduced);
    chameleon.setColor(GROUND, true);
    if (import.meta.env.DEV) (window as unknown as { __cham: unknown }).__cham = chameleon;
  } catch (err) {
    console.warn('WebGL unavailable; the menu works without the chameleon.', err);
    root.classList.add('no-webgl');
  }
})();
