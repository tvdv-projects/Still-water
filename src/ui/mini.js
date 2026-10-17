// Mini window: the scene and breathing guide in a small floating window that stays on top of other
// programs while you work (Document Picture-in-Picture, Chrome and Edge on desktop). The canvas itself
// moves into that window and moves back when it closes; sound simply keeps playing in the page.

import { track } from '../analytics.js';
import { canvas, resize, view } from '../render/context.js';
import { app } from '../state.js';
import { $ } from './dom.js';

// Desktop only: phones and tablets have no floating windows to put it in.
const supported = typeof window.documentPictureInPicture?.requestWindow === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;
let pip = null, hrEl = null, hrTimer = 0;

const inSession = () => ['calib', 'session', 'reso'].includes(app.state);

function hrText() {
  if (app.latestHr == null) return '';
  const hr = Math.round(app.hrS ?? app.latestHr);
  const extra = app.coherence != null ? ` · coherentie ${Math.round(app.coherence * 100)}%` : app.rmssd != null ? ` · HRV ${Math.round(app.rmssd)}` : '';
  return `${hr}${extra}`;
}

async function openMini() {
  if (pip) return pip.focus?.();
  try {
    pip = await window.documentPictureInPicture.requestWindow({ width: 420, height: 280 });
  } catch {
    pip = null;
    return;
  }
  const d = pip.document;
  d.title = 'Stil Water';
  const style = d.createElement('style');
  style.textContent = `
    html,body{margin:0;height:100%;background:#05070d;overflow:hidden}
    canvas{position:fixed;inset:0;width:100vw;height:100vh;display:block}
    .hr{position:fixed;left:10px;bottom:8px;font:500 13px system-ui,sans-serif;color:rgba(236,228,214,.75);
      letter-spacing:.02em;text-shadow:0 1px 6px rgba(0,0,0,.7);pointer-events:none}`;
  d.head.append(style);
  d.body.append(canvas);
  hrEl = d.createElement('div');
  hrEl.className = 'hr';
  d.body.append(hrEl);
  view.mini = true;
  resize();
  pip.addEventListener('resize', resize);
  // Shortcuts (space, O, M) also work while the mini window has focus.
  pip.addEventListener('keydown', (e) => {
    if (e.key === ' ') e.preventDefault();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: e.key }));
  });
  pip.addEventListener('pagehide', closed);
  hrTimer = setInterval(() => { if (hrEl) hrEl.textContent = hrText(); }, 500);
  $('miniNote').hidden = false;
  document.body.classList.add('in-mini');
  track('mini/open');
}

function closed() {
  clearInterval(hrTimer);
  hrEl = null;
  document.body.prepend(canvas);
  view.mini = false;
  pip = null;
  resize();
  $('miniNote').hidden = true;
  document.body.classList.remove('in-mini');
  document.dispatchEvent(new Event('stilwater:loop'));
}

export function initMini() {
  if (!supported) return;
  $('mini').addEventListener('click', (e) => { e.currentTarget.blur(); openMini(); });
  $('miniBack').addEventListener('click', () => pip?.close());
  // The button only makes sense while something is running.
  setInterval(() => { $('mini').hidden = !inSession() || !!pip; }, 500);
}
