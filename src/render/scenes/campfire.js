// Campfire in a forest clearing (Energie). The fire is a particle system: its height and
// brightness follow your energy (heart rate above baseline), the progress (logs catching fire)
// and the breathing guide, so every exhale of the fire breath makes it flare.

import { clamp, mix3, rgb, rnd, TAU } from '../../core/math.js';
import { additive, ctx, glow, reducedMotion, view } from '../context.js';
import { STARS } from './lake.js';

// Logs that catch fire one by one, leaning in like a teepee. a = base angle around the fire, l = length.
const LOGS = Array.from({ length: 7 }, (_, i) => ({ a: -Math.PI * 0.92 + (i / 6) * Math.PI * 0.84 + rnd(-0.08, 0.08), l: rnd(0.85, 1.1), lit: false, t: 0 }));
const STONES = Array.from({ length: 11 }, (_, i) => ({ a: (i / 11) * TAU + rnd(-0.12, 0.12), s: rnd(0.75, 1.15), shade: rnd(0.75, 1.1) }));
const TREES = Array.from({ length: 22 }, (_, i) => ({ x: (i + rnd(-0.3, 0.3)) / 21, h: rnd(0.22, 0.42), w: rnd(0.05, 0.09), back: i % 2 === 0 }));
const flames = [];
const sparks = [];
let burst = 0;

export function reset() {
  LOGS.forEach((l) => { l.lit = false; l.t = 0; });
  flames.length = 0;
  sparks.length = 0;
}

export function progress(i) {
  LOGS[i].lit = true;
  LOGS[i].t = 0;
  burst = 1;
}

export function focus() {
  const m = Math.min(view.W, view.H), baseW = clamp(m * 0.16, 60, 150);
  return { x: view.W / 2, y: view.H * 0.68 - baseW * 0.35, flat: 1, water: 0, sky: view.H * 0.3 };
}

export function anchor() {
  const m = Math.min(view.W, view.H);
  return [view.W / 2, view.H * 0.38, clamp(m * 0.13, 54, 115)];
}

function flameColor(a) {
  if (a < 0.25) return mix3([255, 246, 210], [255, 196, 90], a / 0.25);
  if (a < 0.6) return mix3([255, 196, 90], [245, 110, 35], (a - 0.25) / 0.35);
  return mix3([245, 110, 35], [120, 30, 12], (a - 0.6) / 0.4);
}

function pine(x, base, h, w, col) {
  ctx.fillStyle = col;
  for (let k = 0; k < 6; k++) {
    const ty = base - h * (k / 6) - h * 0.15, ww = w * (1 - k / 7);
    ctx.beginPath(); ctx.moveTo(x, ty - h * 0.28); ctx.lineTo(x - ww, ty + h * 0.05); ctx.lineTo(x + ww, ty + h * 0.05); ctx.closePath(); ctx.fill();
  }
  ctx.fillRect(x - w * 0.08, base - h * 0.2, w * 0.16, h * 0.2);
}

/** @param {{dt:number, time:number, calm:number, progress:number, breathLevel:number}} f  calm = energy here */
export function draw({ dt, time, calm: energy, progress: pg, breathLevel }) {
  const { W, H } = view, m = Math.min(W, H);
  const cx = W / 2, groundY = H * 0.6, baseY = H * 0.68, baseW = clamp(m * 0.16, 60, 150);
  const I = clamp(0.26 + 0.38 * energy + 0.4 * pg + 0.22 * breathLevel + 0.3 * burst);
  burst = Math.max(0, burst - dt * 0.6);

  // Sky and stars (fewer stars as the fire brightens).
  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, 'rgb(4,6,14)');
  sky.addColorStop(1, rgb(mix3([12, 14, 26], [40, 22, 18], I * 0.6)));
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, groundY + 1);
  for (const s of STARS) {
    const a = (0.75 - 0.45 * I) * (0.55 + 0.45 * Math.sin(time * s.sp + s.ph)) * (1 - s.y);
    if (a < 0.03) continue;
    ctx.fillStyle = `rgba(230,234,255,${a})`;
    ctx.beginPath(); ctx.arc(s.x * W, s.y * H * 0.9, s.r, 0, TAU); ctx.fill();
  }

  // Treeline: back row dark, front row catches the firelight.
  for (const back of [true, false]) {
    for (const t of TREES) {
      if (t.back !== back) continue;
      const near = 1 - Math.min(1, Math.abs(t.x * W - cx) / (W * 0.6));
      const lit = back ? I * 0.15 * near : I * 0.5 * near;
      pine(t.x * W, groundY + (back ? -H * 0.02 : H * 0.01), t.h * H * (back ? 0.85 : 1), t.w * W * (back ? 0.8 : 1), rgb(mix3(back ? [8, 10, 18] : [5, 6, 10], [90, 44, 20], lit)));
    }
  }

  // Ground with a warm pool of light.
  const gg = ctx.createLinearGradient(0, groundY, 0, H);
  gg.addColorStop(0, 'rgb(14,11,12)'); gg.addColorStop(1, 'rgb(6,5,7)');
  ctx.fillStyle = gg; ctx.fillRect(0, groundY, W, H - groundY);
  additive(() => {
    ctx.save(); ctx.translate(cx, baseY); ctx.scale(1, 0.32);
    glow(0, 0, baseW * (2.2 + 2.5 * I), '255,120,40', 0.22 + 0.25 * I);
    ctx.restore();
    glow(cx, baseY - baseW * 0.6, H * (0.25 + 0.4 * I), '255,130,50', 0.1 + 0.16 * I);
  });

  // Stone ring (back half first).
  const drawStones = (front) => {
    for (const s of STONES) {
      const sy = Math.sin(s.a);
      if ((sy > 0) !== front) continue;
      const x = cx + Math.cos(s.a) * baseW * 0.95, y = baseY + sy * baseW * 0.28, r = baseW * 0.12 * s.s;
      const lit = (front ? 0.55 : 0.3) * I;
      ctx.fillStyle = rgb(mix3([40, 38, 42], [150, 90, 55], lit).map((v) => v * s.shade));
      ctx.beginPath(); ctx.ellipse(x, y, r * 1.2, r * 0.75, 0, 0, TAU); ctx.fill();
    }
  };
  drawStones(false);

  // Logs: dark when unlit, glowing embers when lit.
  for (const l of LOGS) {
    l.t += dt;
    const bx = cx + Math.cos(l.a) * baseW * 0.62, by = baseY + Math.sin(l.a) * baseW * 0.12;
    const tx = cx + Math.cos(l.a) * baseW * 0.08, ty = baseY - baseW * 0.55 * l.l;
    const glowAmt = l.lit ? clamp(l.t / 2) : 0;
    ctx.strokeStyle = rgb(mix3([46, 32, 24], [120, 52, 22], glowAmt * 0.8));
    ctx.lineWidth = baseW * 0.11; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
    if (glowAmt > 0) {
      ctx.strokeStyle = `rgba(255,${130 + 50 * Math.sin(time * 3 + l.a * 5)},50,${0.55 * glowAmt})`;
      ctx.lineWidth = baseW * 0.035;
      ctx.beginPath(); ctx.moveTo(bx + (tx - bx) * 0.2, by + (ty - by) * 0.2); ctx.lineTo(tx, ty); ctx.stroke();
    }
  }

  // Flames: particles rising from the base.
  const spawn = (reducedMotion ? 60 : 150) * (0.35 + I) * dt;
  for (let k = 0; k < spawn; k++) {
    const g = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    flames.push({ x: cx + g * baseW * 0.42, y: baseY - baseW * 0.05, vx: rnd(-10, 10), vy: -rnd(70, 140) * (0.6 + I * 0.9), age: 0, life: rnd(0.45, 1) * (0.6 + I * 0.7), r: baseW * rnd(0.1, 0.2) * (0.75 + I * 0.6) });
  }
  if (Math.random() < (10 + 40 * I + 120 * burst) * dt) {
    sparks.push({ x: cx + rnd(-0.3, 0.3) * baseW, y: baseY - baseW * 0.4, vx: rnd(-30, 30), vy: -rnd(90, 220) * (0.7 + I), age: 0, life: rnd(1.2, 2.8) });
  }
  additive(() => {
    for (let i = flames.length - 1; i >= 0; i--) {
      const p = flames[i];
      p.age += dt;
      const a = p.age / p.life;
      if (a >= 1) { flames.splice(i, 1); continue; }
      p.x += (p.vx + (cx - p.x) * 0.9 + Math.sin(time * 3 + p.y * 0.05) * 14) * dt;
      p.y += p.vy * dt;
      const r = p.r * (1 - a * 0.7), col = flameColor(a);
      ctx.fillStyle = rgb(col, 0.16 * (1 - a));
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.8, 0, TAU); ctx.fill();
      ctx.fillStyle = rgb(col, 0.42 * (1 - a));
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.8, 0, TAU); ctx.fill();
    }
    glow(cx, baseY - baseW * 0.15, baseW * 0.7, '255,220,160', 0.22 + 0.16 * I);
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.age += dt;
      if (s.age > s.life) { sparks.splice(i, 1); continue; }
      s.vx += Math.sin(time * 2 + i) * 20 * dt;
      s.x += s.vx * dt; s.y += s.vy * dt; s.vy *= 1 - 0.25 * dt;
      const a = 1 - s.age / s.life;
      ctx.fillStyle = `rgba(255,${170 + 60 * a},90,${0.9 * a})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, 1.4 + a, 0, TAU); ctx.fill();
    }
  });
  drawStones(true);
}
