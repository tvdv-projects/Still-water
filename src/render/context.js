// The full-screen canvas, its size, and a few drawing helpers shared by the scenes.

import { TAU } from '../core/math.js';

export const canvas = document.getElementById('c');
export const ctx = canvas.getContext('2d');

/** Current CSS-pixel size of the canvas; updated on resize, read every frame. mini = in the mini window. */
export const view = { W: 0, H: 0, DPR: 1, mini: false };

/** The window the canvas currently lives in: the page, or the mini window (Picture-in-Picture). */
export const canvasWindow = () => canvas.ownerDocument.defaultView || window;

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function resize() {
  const w = canvasWindow();
  view.DPR = Math.min(w.devicePixelRatio || 1, 2);
  view.W = w.innerWidth;
  view.H = w.innerHeight;
  canvas.width = Math.round(view.W * view.DPR);
  canvas.height = Math.round(view.H * view.DPR);
  ctx.setTransform(view.DPR, 0, 0, view.DPR, 0, 0);
}

/** Soft radial light. `col` is an "r,g,b" string; `hold` keeps the centre bright up to that fraction. */
export function glow(x, y, r, col, a, hold = 0) {
  if (r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${col},${a})`);
  if (hold) g.addColorStop(hold, `rgba(${col},${a * 0.8})`);
  g.addColorStop(1, `rgba(${col},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/** Run `fn` with additive blending, used for light sources. */
export function additive(fn) {
  ctx.globalCompositeOperation = 'lighter';
  fn();
  ctx.globalCompositeOperation = 'source-over';
}

/** Normalised (0..1) smooth ridge line built from a few sine octaves. */
export function ridge(n, octaves) {
  const ph = octaves.map(() => Math.random() * TAU), out = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    let v = 0;
    octaves.forEach(([f, a], k) => (v += a * Math.sin(u * f * TAU + ph[k])));
    out.push(v);
  }
  const mn = Math.min(...out), mx = Math.max(...out);
  return out.map((v) => (v - mn) / (mx - mn));
}
