// Night lake, used by Ontspanning ('calm' variant: lanterns light up)
// and Slaap ('sleep' variant: lanterns go out, the moon sets, the world darkens).

import { clamp, lerp, rgb, rnd, TAU } from '../../core/math.js';
import { STEPS } from '../../core/scoring.js';
import { additive, ctx, glow, reducedMotion, ridge, view } from '../context.js';

const HILLS = [
  { pts: ridge(200, [[1.1, 1], [2.9, 0.4], [7, 0.12]]), base: 0.58, amp: 0.16, col: [16, 22, 44] },
  { pts: ridge(200, [[1.8, 1], [4.2, 0.35], [11, 0.1]]), base: 0.585, amp: 0.09, col: [10, 14, 30] },
];
export const STARS = Array.from({ length: 260 }, () => ({ x: Math.random(), y: Math.pow(Math.random(), 1.3) * 0.55, r: rnd(0.3, 1.4), ph: rnd(0, TAU), sp: rnd(0.5, 2) }));
export const MIST = Array.from({ length: 9 }, () => ({ u: Math.random() * 1.4 - 0.2, y: rnd(0.5, 0.7), w: rnd(0.35, 0.7), sp: rnd(0.004, 0.012) * (Math.random() < 0.5 ? -1 : 1) }));
const lamps = Array.from({ length: STEPS }, (_, i) => ({ u: 0.12 + (i / (STEPS - 1)) * 0.76 + rnd(-0.03, 0.03), d: rnd(0.15, 1), ph: rnd(0, TAU), lit: false, t: 0 }));
const REEDS = Array.from({ length: 34 }, (_, i) => ({ x: i < 17 ? rnd(-0.02, 0.2) : rnd(0.8, 1.02), h: rnd(0.12, 0.3), ph: rnd(0, TAU), b: rnd(-0.08, 0.08) }));
// Animation phases. Speeds depend on calm, so each phase is integrated per frame (phase += speed · dt).
// Multiplying a changing speed by the absolute clock would make the motion jump and race.
const phase = { moon: 0, wave: 0, bob: 0, reed: 0 };
const FLIES = Array.from({ length: 30 }, () => ({ x: Math.random(), y: rnd(0.5, 0.8), ph: rnd(0, TAU), vx: rnd(-0.01, 0.01) }));

export function reset() {
  lamps.forEach((l) => { l.lit = false; l.t = 0; });
}

/** Progress step `i` reached: light (calm) or extinguish (sleep) lantern `i`. */
export function progress(i) {
  lamps[i].lit = true;
  lamps[i].t = 0;
}

/** Focal point for visual effects: centre of the water, flattened (ripples lie on the surface). */
export function focus() {
  return { x: view.W / 2, y: view.H * 0.7, flat: 0.3, water: view.H * 0.6, sky: view.H * 0.42 };
}

export function anchor() {
  const m = Math.min(view.W, view.H);
  return [view.W / 2, view.H * 0.44, clamp(m * 0.15, 60, 130)];
}

/** @param {{dt:number, time:number, calm:number, progress:number, variant:'calm'|'sleep'}} f */
export function draw({ dt, time, calm: c, progress: pg, variant }) {
  const { W, H } = view;
  const sleep = variant === 'sleep', hor = H * 0.6;
  // Sleep stays serene: at most half the restlessness of the calm variant.
  const rough = (1 - c) * (sleep ? 0.5 : 1);
  phase.moon += dt * (1.2 + rough * 2);
  phase.wave += dt * (0.6 + rough * 1.4);
  phase.bob += dt * (1 + rough);
  phase.reed += dt * (0.8 + rough * 1.6);
  const dk = sleep ? 1 - 0.45 * pg : 1;

  const sky = ctx.createLinearGradient(0, 0, 0, hor);
  sky.addColorStop(0, rgb([lerp(6, 4, c) * dk, lerp(10, 9, c) * dk, lerp(24, 22, c) * dk]));
  sky.addColorStop(1, rgb([lerp(36, 26, c) * dk, lerp(42, 44, c) * dk, lerp(66, 80, c) * dk]));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, hor + 1);
  for (const s of STARS) {
    const a = (0.08 + 0.85 * c) * (0.55 + 0.45 * Math.sin(time * s.sp + s.ph)) * (1 - s.y) * (sleep ? 1 - 0.4 * pg : 1);
    if (a < 0.02) continue;
    ctx.fillStyle = `rgba(228,234,255,${a})`;
    ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, TAU); ctx.fill();
  }

  // Moon: sets towards the horizon in the sleep variant.
  const mx = W * 0.76, my = sleep ? H * (0.15 + 0.5 * pg) : H * 0.15, mr = Math.min(W, H) * 0.045 + 8, mA = sleep ? 1 - 0.5 * pg : 1;
  glow(mx, my, mr * 8, '200,212,255', (0.1 + 0.14 * c) * mA);
  ctx.fillStyle = `rgba(238,240,250,${(0.75 + 0.25 * c) * mA})`;
  ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
  ctx.fillStyle = `rgba(150,160,200,${0.16 * mA})`;
  [[-0.3, -0.2, 0.26], [0.28, 0.18, 0.18], [-0.02, 0.4, 0.12]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(mx + dx * mr, my + dy * mr, r * mr, 0, TAU); ctx.fill(); });

  for (const L of HILLS) {
    ctx.fillStyle = rgb(L.col);
    ctx.beginPath(); ctx.moveTo(0, hor + 2);
    L.pts.forEach((v, i) => ctx.lineTo((i / (L.pts.length - 1)) * W, H * L.base - v * H * L.amp));
    ctx.lineTo(W, hor + 2); ctx.closePath(); ctx.fill();
  }

  // Water and reflections. Calm → smoother water.
  const wg = ctx.createLinearGradient(0, hor, 0, H);
  wg.addColorStop(0, rgb([lerp(26, 22, c) * dk, lerp(32, 36, c) * dk, lerp(52, 64, c) * dk]));
  wg.addColorStop(1, 'rgb(5,8,16)');
  ctx.fillStyle = wg;
  ctx.fillRect(0, hor, W, H - hor);
  ctx.save();
  ctx.globalAlpha = 0.35 + 0.35 * c;
  for (const L of HILLS) {
    ctx.fillStyle = rgb(L.col);
    ctx.beginPath(); ctx.moveTo(0, hor);
    L.pts.forEach((v, i) => { const x = (i / (L.pts.length - 1)) * W; ctx.lineTo(x + Math.sin(time + i) * rough * 3, hor + (hor - (H * L.base - v * H * L.amp)) * 0.8); });
    ctx.lineTo(W, hor); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  if (my < hor) {
    for (let i = 0; i < 46; i++) {
      const y = hor + 6 + (i * (H - hor)) / 46, k = i / 46, spread = (8 + k * 40) * (0.35 + rough * 1.6);
      const ox = Math.sin(phase.moon + i * 0.9) * spread * 0.6, len = (10 + k * 30) * (1.2 - rough * 0.5) * (0.6 + 0.4 * Math.sin(time * 1.7 + i * 2.3));
      ctx.fillStyle = `rgba(230,232,250,${(0.42 - k * 0.3) * (0.5 + 0.5 * c) * mA})`;
      ctx.fillRect(mx + ox - len / 2, y, len, 1.4 + k * 1.4);
    }
  }
  ctx.lineWidth = 1;
  for (let i = 0; i < 28; i++) {
    const k = i / 28, y = hor + 4 + Math.pow(k, 1.6) * (H - hor), amp = (1 + k * 6) * (0.15 + rough * 1.2);
    ctx.strokeStyle = `rgba(150,180,215,${(0.05 + 0.08 * k) * (0.4 + rough) * dk})`;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 14) { const yy = y + Math.sin(x * (0.02 - k * 0.012) + phase.wave + i) * amp; x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
    ctx.stroke();
  }

  // Floating lanterns.
  for (const l of lamps) {
    l.t += dt;
    const persp = lerp(0.45, 1.2, l.d), drift = sleep && l.lit ? Math.min(l.t, 60) * 4 : 0;
    const x = l.u * W + Math.sin(time * 0.07 + l.ph) * 14 + drift;
    const y = hor + 10 + l.d * (H - hor) * 0.55 + Math.sin(phase.bob + l.ph) * (1 + rough * 4) * persp;
    const s = 9 * persp * Math.max(0.7, Math.min(W, H) / 700), fl = 1 + Math.sin(time * 8 + l.ph) * 0.04;
    const on = sleep ? (l.lit ? 1 - clamp(l.t / 5) : 1) : l.lit ? clamp(l.t / 2.5) : 0;
    if (on > 0) {
      for (let k = 0; k < 9; k++) {
        const ry = y + s * 1.2 + k * s * 0.7, w = s * (1.6 - k * 0.12) * (1 + rough * 0.6);
        ctx.fillStyle = `rgba(255,170,90,${0.32 * on * (1 - k / 9)})`;
        ctx.fillRect(x - w / 2 + Math.sin(time * 2 + k + l.ph) * rough * 4, ry, w, s * 0.22);
      }
      additive(() => { glow(x, y, s * 9 * fl, '255,150,70', 0.2 * on); glow(x, y, s * 2.4, '255,200,130', 0.45 * on); });
    }
    ctx.fillStyle = on > 0 ? rgb([lerp(40, 255, on), lerp(34, 196, on), lerp(30, 128, on)]) : 'rgb(30,30,36)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - s * 0.65, y - s, s * 1.3, s * 1.7, s * 0.35); else ctx.rect(x - s * 0.65, y - s, s * 1.3, s * 1.7);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,16,14,.9)';
    ctx.fillRect(x - s * 0.8, y + s * 0.65, s * 1.6, s * 0.25);
    ctx.fillRect(x - s * 0.5, y - s * 1.1, s, s * 0.18);
  }

  // Mist: thins out with calm (thickens over time while falling asleep).
  const mistA = (0.08 + 0.5 * rough) * (sleep ? 1 + 0.6 * pg : 1);
  for (const m of MIST) {
    if (!reducedMotion) m.u += m.sp * dt * (1 + rough);
    if (m.u > 1.3) m.u = -0.3;
    if (m.u < -0.3) m.u = 1.3;
    const x = m.u * W, y = m.y * H, rw = m.w * W * 0.6, rh = H * 0.05;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, rh / rw);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rw);
    g.addColorStop(0, `rgba(150,160,190,${Math.min(0.6, mistA * 0.55)})`);
    g.addColorStop(1, 'rgba(150,160,190,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rw, 0, TAU); ctx.fill(); ctx.restore();
  }

  // Foreground reeds sway more when tense.
  ctx.lineCap = 'round';
  for (const r of REEDS) {
    const bx = r.x * W, by = H + 4, h = r.h * H, sway = Math.sin(phase.reed + r.ph) * (4 + rough * 14) + r.b * h;
    ctx.strokeStyle = 'rgb(6,10,10)'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + sway * 0.3, by - h * 0.55, bx + sway, by - h); ctx.stroke();
    if (r.ph > 4) { ctx.fillStyle = 'rgb(10,12,12)'; ctx.beginPath(); ctx.ellipse(bx + sway, by - h, 2.6, 9, sway * 0.01, 0, TAU); ctx.fill(); }
  }

  // Fireflies appear with calm.
  const flyFrac = sleep ? c * 0.4 * (1 - pg) : c * 1.1;
  additive(() => {
    FLIES.forEach((f, i) => {
      if (i / FLIES.length > flyFrac) return;
      if (!reducedMotion) f.x = (f.x + f.vx * dt + 1) % 1;
      const x = f.x * W, y = f.y * H + Math.sin(time * 0.8 + f.ph) * 12, tw = clamp(Math.sin(time * 1.4 + f.ph * 3) * 1.5);
      if (tw < 0.05) return;
      glow(x, y, 14, '200,255,140', 0.3 * tw);
      glow(x, y, 2.4, '240,255,200', 0.9 * tw);
    });
  });
}
