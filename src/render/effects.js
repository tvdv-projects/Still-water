// Optional hypnotic visual effects, toggled in the "Beeld" menu and remembered per browser.
//
// Design rules for every effect: slow, repetitive, centred on one focal point, paced by the breath
// or the heart, and never flashing or flickering (fast flicker can cause dizziness or seizures).
//
// Each scene exposes focus(): {x, y, flat, water, sky}
//   x, y   the focal point effects revolve around
//   flat   vertical squash for shapes that lie on a water surface (1 = round)
//   water  y where the water starts (0 = no water), sky = lower edge of open sky (0 = no sky)

import { clamp, lerp, TAU } from '../core/math.js';
import { store } from '../core/storage.js';
import { app, breath, profile } from '../state.js';
import { additive, ctx, glow, view } from './context.js';

export const EFFECTS = [
  { key: 'ripples', name: 'Hartslag-rimpels', desc: 'Bij elke hartslag een kring die uitdijt', def: true },
  { key: 'breathe', name: 'Scène ademt mee', desc: 'Het hele beeld zwelt zacht mee met je adem', def: true },
  { key: 'aurora', name: 'Noorderlicht', desc: 'Golvende lichtlinten in de lucht', scenes: ['lake', 'campfire'], def: true },
  { key: 'mandala', name: 'Coherentie-mandala', desc: 'Symmetrischer naarmate je hart je adem volgt', def: false },
  { key: 'pools', name: 'Lichtkringen op het water', desc: 'Trage lichtvlekken die meedeinen', scenes: ['lake', 'dawn'], def: false },
  { key: 'tunnel', name: 'Tunnel naar het midden', desc: 'De randen vervagen naarmate je rustiger wordt', def: false },
  { key: 'spiral', name: 'Vonkenspiraal', desc: 'Lichtdeeltjes die opdraaien op je uitademing', def: false },
  { key: 'kaleido', name: 'Caleidoscoop', desc: 'Langzaam draaiend patroon dat meeademt', def: false },
  { key: 'flow', name: 'Lichtstroom', desc: 'Een rivier van licht die rond het midden cirkelt', def: false },
  { key: 'zoom', name: 'Oneindige spiraal', desc: 'Intens: een spiraal die eindeloos naar binnen draait', def: false },
];

const saved = store.get('fx', {});
/** Current on/off state per effect key. */
export const fx = Object.fromEntries(EFFECTS.map((e) => [e.key, saved[e.key] ?? e.def]));
export function setEffect(key, on) {
  fx[key] = on;
  store.set('fx', fx);
}
export const appliesTo = (e, sceneKey) => !e.scenes || e.scenes.includes(sceneKey);

// ---------- shared rhythm ----------
let lastLevel = 0, breathSpeed = 0;
/** Breath level 0..1: the guide when it is on, otherwise a gentle six-per-minute rhythm. */
function breathLevel() {
  return breath.on && breath.key ? breath.level : 0.5 + 0.5 * Math.sin((app.time * TAU) / 10);
}
const accent = () => profile().accent;

// ---------- 2: the scene breathes ----------
/** Wraps the scene drawing: a scale of 1–3 % around the focal point. Always ≥ 1, so no edges show. */
export function beginBreathe(f) {
  if (!fx.breathe) return false;
  const s = 1.01 + 0.02 * breathLevel();
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(s, s);
  ctx.translate(-f.x, -f.y);
  return true;
}
export function endBreathe(active) {
  if (!active) return;
  ctx.restore();
  ctx.fillStyle = `rgba(0,0,6,${0.08 * (1 - breathLevel())})`;
  ctx.fillRect(0, 0, view.W, view.H);
}

// ---------- 1: heartbeat ripples ----------
const rings = [];
let seenBeats = 0, synthBeat = 0;
function updateRipples(dt) {
  const active = app.state === 'calib' || app.state === 'session';
  if (!active || app.hrS == null) { seenBeats = app.beats.length; return; }
  if (app.hasRR) {
    // Real beats from the chest strap.
    const n = app.beats.length;
    if (n < seenBeats) seenBeats = 0;
    for (let k = Math.max(seenBeats, n - 2); k < n; k++) rings.push({ t: 0 });
    seenBeats = n;
  } else {
    synthBeat += dt;
    if (synthBeat >= 60 / app.hrS) { synthBeat = 0; rings.push({ t: 0 }); }
  }
}
function drawRipples(dt, f) {
  const speed = Math.min(view.W, view.H) * 0.09, life = 6;
  ctx.lineWidth = 1.5;
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.t += dt;
    if (r.t > life) { rings.splice(i, 1); continue; }
    const rad = 8 + r.t * speed, a = 0.35 * Math.pow(1 - r.t / life, 1.5);
    ctx.strokeStyle = `rgba(${accent()},${a})`;
    ctx.beginPath(); ctx.ellipse(f.x, f.y, rad, rad * f.flat, 0, 0, TAU); ctx.stroke();
  }
}

// ---------- 3: aurora ----------
let auroraPh = [0, 1.7, 3.1];
function drawAurora(dt, f) {
  if (!f.sky) return;
  const { W, H } = view, b = breathLevel(), sleep = profile().fadeOut;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, f.sky); ctx.clip();
  additive(() => {
    for (let r = 0; r < 3; r++) {
      auroraPh[r] += dt * (0.05 + 0.03 * r);
      const base = H * (0.1 + r * 0.06), amp = H * 0.03, h = H * (0.11 + 0.02 * r);
      const col = r === 1 ? '190,130,255' : '120,255,190';
      const a = (0.08 + 0.09 * b) * (sleep ? 0.7 : 1);
      const g = ctx.createLinearGradient(0, base - amp * 1.5, 0, base + h + amp);
      g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(0.35, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      const top = (x) => base + Math.sin(x * 0.006 * (1 + r * 0.3) + auroraPh[r]) * amp + Math.sin(x * 0.013 + auroraPh[r] * 1.7) * amp * 0.5;
      for (let x = 0; x <= W; x += 12) (x ? ctx.lineTo(x, top(x)) : ctx.moveTo(x, top(x)));
      for (let x = W; x >= 0; x -= 12) ctx.lineTo(x, top(x) + h * (0.8 + 0.25 * Math.sin(x * 0.01 + auroraPh[r])));
      ctx.closePath(); ctx.fill();
    }
  });
  ctx.restore();
}

// ---------- 4: light pools on the water ----------
let poolPh = 0;
function drawPools(dt, f) {
  if (!f.water) return;
  const { W, H } = view, b = breathLevel();
  poolPh += dt * 0.06;
  additive(() => {
    for (let k = 0; k < 6; k++) {
      const x = W * (0.5 + 0.38 * Math.sin(poolPh * (1 + k * 0.17) + k * 1.9));
      const y = f.water + (H - f.water) * (0.25 + 0.55 * (0.5 + 0.5 * Math.sin(poolPh * 0.7 + k * 2.3)));
      const r = W * (0.1 + 0.04 * Math.sin(poolPh * 2 + k)) * (0.85 + 0.3 * b);
      ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.25);
      glow(0, 0, r, accent(), 0.05 + 0.07 * b);
      ctx.restore();
    }
  });
}

// ---------- 5: tunnel ----------
function drawTunnel(f) {
  const { W, H } = view;
  const c = profile().goal === 'steady' ? app.stability : app.calmVis;
  const k = clamp(c);
  const g = ctx.createRadialGradient(f.x, f.y, Math.min(W, H) * (0.55 - 0.3 * k), f.x, f.y, Math.max(W, H) * 0.85);
  g.addColorStop(0, 'rgba(0,0,4,0)');
  g.addColorStop(1, `rgba(0,0,4,${0.25 + 0.55 * k})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// ---------- 6: coherence mandala ----------
let mandalaRot = 0;
function drawMandala(dt, centre) {
  const { W, H } = view, b = breathLevel();
  const q = app.coherence ?? (app.state === 'session' ? app.calmVis * 0.7 : 0.3);
  mandalaRot += dt * 0.05;
  const Rm = Math.min(W, H) * 0.34 * (0.9 + 0.1 * b);
  additive(() => {
    ctx.lineWidth = 1.2;
    for (const [n, scale, dir] of [[8, 1, 1], [16, 0.62, -1]]) {
      ctx.strokeStyle = `rgba(${accent()},${0.1 + 0.26 * q})`;
      for (let k = 0; k < n; k++) {
        const jitter = 1 - q;
        const len = Rm * scale * (1 + jitter * 0.35 * Math.sin(app.time * 1.3 + k * 2.1));
        const a = (k / n) * TAU + mandalaRot * dir + jitter * 0.25 * Math.sin(app.time * 0.9 + k);
        const w = len * 0.22;
        const ex = centre[0] + Math.cos(a) * len, ey = centre[1] + Math.sin(a) * len;
        const nx = -Math.sin(a) * w, ny = Math.cos(a) * w;
        const mx = centre[0] + Math.cos(a) * len * 0.5, my = centre[1] + Math.sin(a) * len * 0.5;
        ctx.beginPath();
        ctx.moveTo(centre[0], centre[1]);
        ctx.quadraticCurveTo(mx + nx, my + ny, ex, ey);
        ctx.quadraticCurveTo(mx - nx, my - ny, centre[0], centre[1]);
        ctx.stroke();
      }
    }
  });
}

// ---------- 7: spark spiral ----------
const sparks = [];
function drawSpiral(dt, f) {
  const { W, H } = view, R = Math.min(W, H) * 0.42;
  const outward = breath.on && breath.key && breath.level < lastLevel;
  const rate = 5 + (outward ? 25 + breathSpeed * 60 : 0);
  if (Math.random() < rate * dt) sparks.push({ a: Math.random() * TAU, r: 6, life: 0, max: 3 + Math.random() * 2 });
  const col = profile().scene === 'campfire' ? '255,170,90' : accent();
  additive(() => {
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life += dt;
      if (s.life > s.max || s.r > R) { sparks.splice(i, 1); continue; }
      s.a += dt * (1.4 - s.r / R);
      s.r += dt * R * 0.22;
      const x = f.x + Math.cos(s.a) * s.r, y = f.y + Math.sin(s.a) * s.r * Math.min(1, f.flat + 0.4) - s.life * 14;
      glow(x, y, 5, col, 0.6 * (1 - s.life / s.max));
    }
  });
}

// ---------- 8: kaleidoscope ----------
let kalRot = 0;
function drawKaleido(dt, centre) {
  const { W, H } = view, b = breathLevel();
  kalRot += dt * 0.08;
  const Rk = Math.min(W, H) * 0.3 * (0.85 + 0.15 * b);
  additive(() => {
    ctx.lineWidth = 1;
    for (const [n, dir, scale, alpha] of [[12, 1, 1, 0.16], [6, -1, 0.55, 0.13]]) {
      ctx.strokeStyle = `rgba(${accent()},${alpha})`;
      for (let k = 0; k < n; k++) {
        ctx.save();
        ctx.translate(centre[0], centre[1]);
        ctx.rotate((k / n) * TAU + kalRot * dir);
        ctx.beginPath(); ctx.ellipse(Rk * scale * 0.5, 0, Rk * scale * 0.5, Rk * scale * 0.12, 0, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.arc(Rk * scale * 0.88, 0, Rk * scale * 0.05, 0, TAU); ctx.stroke();
        ctx.restore();
      }
    }
  });
}

// ---------- 9: light flow ----------
const flow = Array.from({ length: 140 }, () => ({ a: Math.random() * TAU, r: 0.2 + Math.random() * 0.8, ph: Math.random() * TAU }));
function drawFlow(dt, f) {
  const { W, H } = view, Rmax = Math.min(W, H) * 0.48;
  const pace = ((app.hrS || 60) / 60) * 0.22;
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  additive(() => {
    ctx.strokeStyle = `rgba(${accent()},0.28)`;
    ctx.beginPath();
    for (const p of flow) {
      const w = pace / (0.3 + p.r);
      const a0 = p.a;
      p.a += w * dt;
      p.r = clamp(p.r + Math.sin(app.time * 0.3 + p.ph) * 0.02 * dt, 0.15, 1);
      const r = p.r * Rmax, sq = Math.min(1, f.flat + 0.35);
      ctx.moveTo(f.x + Math.cos(a0 - w * 0.25) * r, f.y + Math.sin(a0 - w * 0.25) * r * sq);
      ctx.lineTo(f.x + Math.cos(p.a) * r, f.y + Math.sin(p.a) * r * sq);
    }
    ctx.stroke();
  });
}

// ---------- 10: infinite spiral ----------
let zoomPh = 0;
function drawZoom(dt, centre) {
  const { W, H } = view, max = Math.hypot(W, H) * 0.6;
  zoomPh += dt * 0.22;
  additive(() => {
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = `rgba(${accent()},0.11)`;
    const k = 0.18;
    for (let arm = 0; arm < 2; arm++) {
      ctx.beginPath();
      for (let th = 0; th < 40; th += 0.08) {
        const r = 4 * Math.exp(k * th);
        if (r > max) break;
        const a = th + zoomPh + arm * Math.PI;
        const x = centre[0] + Math.cos(a) * r, y = centre[1] + Math.sin(a) * r;
        th ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    // Rings that keep growing by factors of two: an endless zoom inward.
    const frac = (zoomPh * 0.35) % 1;
    for (let i = 0; i < 8; i++) {
      const r = 6 * Math.pow(2, i + frac);
      if (r > max) break;
      ctx.strokeStyle = `rgba(${accent()},${0.06 * (1 - (i + frac) / 8)})`;
      ctx.beginPath(); ctx.arc(centre[0], centre[1], r, 0, TAU); ctx.stroke();
    }
  });
}

/** Effects that belong behind the overlays (sky and water). */
export function drawBackEffects(dt, f, sceneKey) {
  if (fx.aurora && appliesTo(EFFECTS[2], sceneKey)) drawAurora(dt, f);
  if (fx.pools && appliesTo(EFFECTS[4], sceneKey)) drawPools(dt, f);
}

/** Effects drawn over the scene, under the breathing guide. `centre` is the breathing guide's centre. */
export function drawFrontEffects(dt, f, centre) {
  updateRipples(dt);
  breathSpeed = lerp(breathSpeed, Math.abs(breath.level - lastLevel) / Math.max(dt, 1e-3), 0.2);
  if (fx.tunnel) drawTunnel(f);
  if (fx.flow) drawFlow(dt, f);
  if (fx.zoom) drawZoom(dt, centre);
  if (fx.kaleido) drawKaleido(dt, centre);
  if (fx.mandala) drawMandala(dt, centre);
  if (fx.ripples) drawRipples(dt, f);
  if (fx.spiral) drawSpiral(dt, f);
  lastLevel = breath.level;
}
