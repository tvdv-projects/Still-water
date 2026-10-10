// A single candle flame (Volle focus). Instability makes the flame flicker; stability calms it.
// Progress draws an ensō (Zen brush circle) around the flame. The breathing guide is centred on the flame.

import { clamp, rgb, rnd, TAU } from '../../core/math.js';
import { additive, ctx, glow, view } from '../context.js';

const EMBERS = Array.from({ length: 12 }, () => ({ x: rnd(-1, 1), y: Math.random(), sp: rnd(0.04, 0.09), ph: rnd(0, TAU) }));
const flame = { x: 0, y: 0, cy: 0 };

export function reset() {}
export function progress() {}

export function anchor() {
  return [flame.x, flame.cy, clamp(Math.min(view.W, view.H) * 0.14, 54, 115)];
}

/** @param {{time:number, calm:number, progress:number, breathLevel:number}} f */
export function draw({ dt, time, calm: c, progress: pg, breathLevel }) {
  const { W, H } = view;
  const un = (1 - c) * 0.9 + 0.1, m = Math.min(W, H);
  const fx = W / 2, tableY = H * 0.76, top = H * 0.6, cw = clamp(m * 0.075, 26, 60);
  const fh = clamp(m * 0.1, 40, 90) * (1 + 0.12 * breathLevel);
  const n1 = Math.sin(time * 2.3) * 0.5 + Math.sin(time * 5.7 + 1) * 0.3 + Math.sin(time * 11.3 + 2) * 0.2;
  const n2 = Math.sin(time * 9.1) * 0.5 + Math.sin(time * 15.7 + 0.5) * 0.5;
  const sway = (n1 * un + 0.02 * Math.sin(time * 0.7)) * fh * 0.22, hj = 1 + n2 * un * 0.12, bright = 0.85 + 0.15 * Math.sin(time * 6.1) * un;
  const by = top - 6, tipX = fx + sway, tipY = by - fh * hj, wf = fh * 0.27;
  Object.assign(flame, { x: fx, y: by, cy: by - fh * 0.45 });

  const bg = ctx.createRadialGradient(fx, by - fh * 0.5, 0, fx, by - fh * 0.5, Math.max(W, H) * 0.85);
  bg.addColorStop(0, rgb([58 * bright, 36 * bright, 22 * bright]));
  bg.addColorStop(0.45, 'rgb(16,11,12)');
  bg.addColorStop(1, 'rgb(5,4,7)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Ensō: brush circle drawn as overlapping dabs with varying width and dry-brush texture.
  const R = clamp(m * 0.33, 110, 300), ecx = fx, ecy = by - fh * 0.4;
  ctx.strokeStyle = 'rgba(230,218,198,.05)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(ecx, ecy, R, 0, TAU); ctx.stroke();
  const len = pg * TAU * 0.94, a0 = Math.PI * 0.62, base = R * 0.055;
  if (len > 0.01) {
    for (let s = 0; s < len; s += 2.2 / R) {
      const k = s / len;
      const w = base * (0.7 + 0.35 * Math.sin(s * 2.3 + 1.1)) * Math.min(1, s / 0.25 + 0.25) * (1 - Math.pow(k, 8) * 0.55);
      const a = 0.62 * (0.75 + 0.25 * Math.sin(s * 37)), ang = a0 + s;
      ctx.fillStyle = `rgba(232,220,198,${a})`;
      ctx.beginPath(); ctx.arc(ecx + Math.cos(ang) * R, ecy + Math.sin(ang) * R, w, 0, TAU); ctx.fill();
    }
  }

  // Table and candle.
  const tg = ctx.createLinearGradient(0, tableY, 0, H);
  tg.addColorStop(0, 'rgb(30,21,17)'); tg.addColorStop(1, 'rgb(8,6,7)');
  ctx.fillStyle = tg; ctx.fillRect(0, tableY, W, H - tableY);
  additive(() => glow(fx, tableY + 4, cw * 3.2, '255,150,70', 0.14 * bright));
  const cg = ctx.createLinearGradient(fx - cw / 2, 0, fx + cw / 2, 0);
  cg.addColorStop(0, 'rgb(120,98,80)'); cg.addColorStop(0.45, 'rgb(232,214,188)'); cg.addColorStop(1, 'rgb(136,112,90)');
  ctx.fillStyle = cg; ctx.fillRect(fx - cw / 2, top, cw, tableY - top + 6);
  ctx.fillStyle = 'rgb(244,230,206)'; ctx.beginPath(); ctx.ellipse(fx, top, cw / 2, cw * 0.14, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,200,140,.35)'; ctx.beginPath(); ctx.ellipse(fx, top, cw * 0.32, cw * 0.08, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgb(30,20,16)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(fx, top); ctx.quadraticCurveTo(fx + 1, top - 5, fx + sway * 0.05, by + 2); ctx.stroke();

  // Flame.
  additive(() => { glow(fx, by - fh * 0.45, fh * 5.5, '255,140,60', 0.2 * bright); glow(fx + sway * 0.3, by - fh * 0.45, fh * 1.6, '255,190,110', 0.42 * bright); });
  const flamePath = (sc) => {
    const w = wf * sc;
    ctx.beginPath(); ctx.moveTo(fx, by);
    ctx.bezierCurveTo(fx - w * 1.15, by - fh * 0.22 * sc, fx - w * 0.55 + sway * 0.35, by - fh * 0.72 * sc, fx + (tipX - fx) * sc, by - (by - tipY) * sc);
    ctx.bezierCurveTo(fx + w * 0.55 + sway * 0.35, by - fh * 0.72 * sc, fx + w * 1.15, by - fh * 0.22 * sc, fx, by);
    ctx.closePath();
  };
  let fg = ctx.createLinearGradient(0, by, 0, tipY);
  fg.addColorStop(0, 'rgba(255,150,60,.9)'); fg.addColorStop(0.4, 'rgba(255,205,120,.95)'); fg.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = fg; flamePath(1); ctx.fill();
  fg = ctx.createLinearGradient(0, by, 0, by - fh * 0.6);
  fg.addColorStop(0, 'rgba(255,250,235,.95)'); fg.addColorStop(1, 'rgba(255,250,235,0)');
  ctx.fillStyle = fg; flamePath(0.55); ctx.fill();
  ctx.fillStyle = 'rgba(110,140,255,.45)';
  ctx.beginPath(); ctx.ellipse(fx, by - 3, wf * 0.45, fh * 0.07, 0, 0, TAU); ctx.fill();

  // A few rising embers once the heart rate is steady.
  additive(() => {
    EMBERS.forEach((e, i) => {
      if (i / EMBERS.length > c - 0.3) return;
      e.y = (e.y + e.sp * dt) % 1;
      const x = fx + e.x * fh * 0.6 + Math.sin(time + e.ph) * 8, y = by - fh - e.y * H * 0.35;
      glow(x, y, 5, '255,180,100', (1 - e.y) * 0.6);
    });
  });
}
