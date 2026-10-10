// Mountain lake in the blue hour (Ontspannen focus). Calm and progress bring the dawn:
// the sky warms, mist clears, and peaks catch golden light one by one, highest first.

import { clamp, mix3, rgb, rnd, TAU } from '../../core/math.js';
import { additive, ctx, glow, reducedMotion, ridge, view } from '../context.js';
import { MIST, STARS } from './lake.js';
import { anchor as lakeAnchor } from './lake.js';

const PEAKS = [0.08, 0.22, 0.36, 0.5, 0.64, 0.78, 0.92].map((u) => ({ u: u + rnd(-0.03, 0.03), h: rnd(0.5, 1), w: rnd(0.11, 0.19), t: 0, lit: false }));
const LIGHT_ORDER = PEAKS.map((_, i) => i).sort((a, b) => PEAKS[b].h - PEAKS[a].h);
// Main range silhouette: union of the peaks plus a little jaggedness, normalised heights.
const MTN = Array.from({ length: 241 }, (_, i) => {
  const x = i / 240;
  let v = 0;
  for (const p of PEAKS) v = Math.max(v, p.h * Math.pow(Math.max(0, 1 - Math.abs(x - p.u) / p.w), 1.15));
  return v * 0.92 + 0.06 + 0.012 * Math.sin(x * 90) + 0.008 * Math.sin(x * 210 + 1);
});
const BACK = ridge(200, [[1.4, 1], [3.3, 0.35], [8, 0.1]]);
let wavePhase = 0; // integrated per frame, see lake.js
const PINES = Array.from({ length: 16 }, (_, i) => ({ x: i < 8 ? rnd(-0.03, 0.16) : rnd(0.84, 1.03), h: rnd(0.12, 0.24) }));

export function reset() {
  PEAKS.forEach((p) => { p.lit = false; p.t = 0; });
}

export function progress(i) {
  const p = PEAKS[LIGHT_ORDER[i]];
  p.lit = true;
  p.t = 0;
}

export const anchor = lakeAnchor;

export function draw({ dt, time, calm: c, progress: pg }) {
  const { W, H } = view;
  const rough = 1 - c, hor = H * 0.62, amp = H * 0.3;
  wavePhase += dt * (0.5 + rough);
  const L = clamp(0.12 + 0.55 * pg + 0.33 * c); // overall dawn light

  const sky = ctx.createLinearGradient(0, 0, 0, hor);
  sky.addColorStop(0, rgb(mix3([10, 16, 40], [44, 66, 120], L)));
  sky.addColorStop(0.6, rgb(mix3([38, 48, 92], [150, 146, 182], L)));
  sky.addColorStop(1, rgb(mix3([66, 66, 116], [252, 196, 156], L)));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, hor + 1);
  for (const s of STARS) {
    const a = (1 - L) * 0.7 * (0.55 + 0.45 * Math.sin(time * s.sp + s.ph)) * (1 - s.y * 1.6);
    if (a < 0.02) continue;
    ctx.fillStyle = `rgba(232,236,255,${a})`;
    ctx.beginPath(); ctx.arc(s.x * W, s.y * H * 0.8, s.r, 0, TAU); ctx.fill();
  }
  additive(() => { glow(W * 0.6, hor, H * 0.55, '255,170,120', 0.32 * L); glow(W * 0.6, hor, H * 0.2, '255,214,170', 0.3 * L * L); });

  // Back range.
  ctx.fillStyle = rgb(mix3([30, 34, 64], [120, 110, 150], L * 0.8));
  ctx.beginPath(); ctx.moveTo(0, hor + 2);
  BACK.forEach((v, i) => ctx.lineTo((i / (BACK.length - 1)) * W, hor - H * 0.06 - v * H * 0.14));
  ctx.lineTo(W, hor + 2); ctx.closePath(); ctx.fill();

  // Main range with lit peaks.
  const mPath = () => {
    ctx.beginPath(); ctx.moveTo(0, hor + 2);
    MTN.forEach((v, i) => ctx.lineTo((i / (MTN.length - 1)) * W, hor - v * amp));
    ctx.lineTo(W, hor + 2); ctx.closePath();
  };
  const mCol = mix3([20, 24, 46], [58, 52, 78], L);
  const mg = ctx.createLinearGradient(0, hor - amp, 0, hor);
  mg.addColorStop(0, rgb(mix3(mCol, [255, 255, 255], 0.05)));
  mg.addColorStop(1, rgb(mCol));
  ctx.fillStyle = mg; mPath(); ctx.fill();
  ctx.save(); mPath(); ctx.clip();
  for (const p of PEAKS) {
    p.t += dt;
    if (!p.lit) continue;
    const g = clamp(p.t / 3.5), px = p.u * W, py = hor - p.h * amp * 0.98;
    const gr = ctx.createRadialGradient(px, py, 0, px, py, p.w * W * 1.1);
    gr.addColorStop(0, `rgba(255,196,140,${0.7 * g})`);
    gr.addColorStop(0.5, `rgba(240,150,120,${0.25 * g})`);
    gr.addColorStop(1, 'rgba(240,150,120,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(px - p.w * W * 1.2, py - 10, p.w * W * 2.4, amp);
  }
  ctx.restore();
  for (const p of PEAKS) {
    if (!p.lit) continue;
    ctx.strokeStyle = `rgba(255,222,170,${0.85 * clamp(p.t / 3.5)})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < MTN.length; i++) {
      const x = i / (MTN.length - 1);
      if (Math.abs(x - p.u) > p.w * 0.55) continue;
      const y = hor - MTN[i] * amp;
      if (started) ctx.lineTo(x * W, y); else { ctx.moveTo(x * W, y); started = true; }
    }
    ctx.stroke();
  }

  // Water, mirrored range, golden reflections.
  const wg = ctx.createLinearGradient(0, hor, 0, H);
  wg.addColorStop(0, rgb(mix3([30, 34, 66], [150, 130, 150], L * 0.7)));
  wg.addColorStop(1, rgb(mix3([6, 8, 18], [24, 22, 36], L)));
  ctx.fillStyle = wg; ctx.fillRect(0, hor, W, H - hor);
  ctx.save();
  ctx.globalAlpha = 0.3 + 0.45 * c;
  ctx.fillStyle = rgb(mCol);
  ctx.beginPath(); ctx.moveTo(0, hor);
  MTN.forEach((v, i) => { const x = (i / (MTN.length - 1)) * W; ctx.lineTo(x + Math.sin(time * 1.3 + i * 0.7) * rough * 4, hor + v * amp * 0.75); });
  ctx.lineTo(W, hor); ctx.closePath(); ctx.fill();
  ctx.restore();
  additive(() => {
    for (const p of PEAKS) {
      if (!p.lit) continue;
      const g = clamp(p.t / 3.5);
      for (let k = 0; k < 7; k++) {
        const y = hor + p.h * amp * 0.55 + k * 6 - 18, w = p.w * W * (0.5 - k * 0.05);
        ctx.fillStyle = `rgba(255,190,140,${0.12 * g * (1 - k / 7)})`;
        ctx.fillRect(p.u * W - w / 2 + Math.sin(time * 1.5 + k) * rough * 6, y, w, 2);
      }
    }
  });
  ctx.lineWidth = 1;
  for (let i = 0; i < 20; i++) {
    const k = i / 20, y = hor + 6 + Math.pow(k, 1.5) * (H - hor), a = (1 + k * 5) * (0.1 + rough);
    ctx.strokeStyle = `rgba(230,220,240,${(0.04 + 0.06 * k) * (0.3 + rough)})`;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 16) { const yy = y + Math.sin(x * 0.018 + wavePhase + i) * a; x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
    ctx.stroke();
  }

  // Valley mist clears with calm and progress.
  const mA = 0.1 + 0.5 * rough * (1 - 0.6 * pg);
  const mc = mix3([150, 160, 200], [250, 214, 214], L);
  for (const m of MIST) {
    if (!reducedMotion) m.u += m.sp * dt * 0.7;
    if (m.u > 1.3) m.u = -0.3;
    if (m.u < -0.3) m.u = 1.3;
    const x = m.u * W, y = hor - H * 0.02 + (m.y - 0.6) * H * 0.3, rw = m.w * W * 0.7, rh = H * 0.045;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, rh / rw);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rw);
    g.addColorStop(0, rgb(mc, mA * 0.6)); g.addColorStop(1, rgb(mc, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rw, 0, TAU); ctx.fill(); ctx.restore();
  }

  // Foreground pines.
  ctx.fillStyle = 'rgb(7,9,16)';
  for (const p of PINES) {
    const bx = p.x * W, h = p.h * H, by = H + 6;
    for (let k = 0; k < 5; k++) {
      const ty = by - h * (k / 5) - h * 0.25, w = h * 0.28 * (1 - k / 6);
      ctx.beginPath(); ctx.moveTo(bx, ty - h * 0.3); ctx.lineTo(bx - w, ty + h * 0.06); ctx.lineTo(bx + w, ty + h * 0.06); ctx.closePath(); ctx.fill();
    }
    ctx.fillRect(bx - 2, by - h * 0.3, 4, h * 0.3);
  }
}
