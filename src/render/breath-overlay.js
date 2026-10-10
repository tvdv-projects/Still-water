// Visual breathing guide drawn on top of the scene.
// A ring grows on the inhale and shrinks on the exhale. Around it, a technique-specific guide:
//   default: a segmented ring, one arc per phase, proportional to its duration
//   box:     a light dot travelling along a square, one side per phase
//   nadi:    left / right half rings that light up for the active nostril
//   pulse:   a ring of dots, one per short exhale, with the round counter (fire breath)

import { BREATHS, STEP_LABEL, STEP_TO } from '../config/breathing.js';
import { countdown, currentStep } from '../core/breathing.js';
import { clamp, easeIO, lerp, TAU } from '../core/math.js';
import { additive, ctx, glow } from './context.js';

/**
 * @param {object} b breath state (see core/breathing.js)
 * @param {[number, number, number]} anchor centre x, centre y and base radius
 * @param {string} col accent colour "r,g,b"
 * @param {number|null} coh heart–breath coherence 0..1 (chest strap only); a stronger halo when high
 */
export function drawBreath(b, [cx, cy, R], col, coh = null) {
  if (b.vis < 0.01 || !b.key) return;
  const B = BREATHS[b.key], step = currentStep(b), level = b.level;
  const r = R * (0.4 + 0.6 * level), f = clamp(b.t / step[1]), RR = R * 1.15;

  ctx.save();
  ctx.globalAlpha = b.vis;
  additive(() => glow(cx, cy, r * (1.45 + (coh ?? 0) * 0.6), col, 0.08 + 0.14 * level + (coh ?? 0) * 0.12));
  ctx.strokeStyle = `rgba(${col},.8)`; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
  ctx.strokeStyle = `rgba(${col},.18)`; ctx.setLineDash([2, 6]);
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);

  if (B.shape === 'box') drawBox(b, cx, cy, R, f, col);
  else if (B.shape === 'nadi') drawNadi(step, cx, cy, RR, col);
  else if (B.shape === 'pulse') drawPulse(b, B, cx, cy, RR, col);
  else drawSegments(B, b.i, cx, cy, RR, f, col);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(240,234,222,.95)';
  ctx.font = `italic 300 ${Math.round(clamp(R * 0.26, 18, 28))}px Spectral, Georgia, serif`;
  const pumping = B.shape === 'pulse' && step[0] !== 'rest';
  const label = B.shape === 'pulse' ? (pumping ? 'Korte stoten uit' : 'Rustig ademen') : STEP_LABEL[step[0]];
  ctx.fillText(label, cx, cy - RR - (B.shape === 'box' ? R * 0.2 : 0) - 22);
  ctx.fillStyle = 'rgba(240,234,222,.7)';
  ctx.font = `300 ${Math.round(clamp(R * 0.32, 20, 36))}px Spectral, Georgia, serif`;
  ctx.fillText(String(pumping ? Math.floor(b.i / 2) + 1 : countdown(b)), cx, cy + 1);
  if (coh != null && B.shape !== 'pulse') {
    ctx.font = '500 12px Karla, system-ui, sans-serif';
    ctx.fillStyle = `rgba(236,228,214,${0.45 + 0.45 * coh})`;
    ctx.fillText(`coherentie ${Math.round(coh * 100)}%`, cx, cy + RR + (B.shape === 'box' ? R * 0.2 : 0) + 20);
  }
  ctx.restore();
}

function drawBox(b, cx, cy, R, f, col) {
  const h = R * 0.98;
  const corners = [[cx - h, cy + h], [cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h]];
  ctx.strokeStyle = `rgba(${col},.2)`; ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - h, cy - h, h * 2, h * 2);
  const s0 = corners[b.i], s1 = corners[(b.i + 1) % 4];
  const px = lerp(s0[0], s1[0], easeIO(f)), py = lerp(s0[1], s1[1], easeIO(f));
  ctx.strokeStyle = `rgba(${col},.85)`; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(s0[0], s0[1]); ctx.lineTo(px, py); ctx.stroke();
  additive(() => glow(px, py, 16, col, 0.7));
  ctx.fillStyle = 'rgba(255,250,240,.95)';
  ctx.beginPath(); ctx.arc(px, py, 3.5, 0, TAU); ctx.fill();
}

function drawNadi(step, cx, cy, RR, col) {
  const left = /L$/.test(step[0]);
  ctx.lineCap = 'round';
  [[Math.PI * 0.58, Math.PI * 1.42, true], [-Math.PI * 0.42, Math.PI * 0.42, false]].forEach(([s, e, isLeft]) => {
    const on = isLeft === left;
    ctx.strokeStyle = `rgba(${col},${on ? 0.9 : 0.15})`;
    ctx.lineWidth = on ? 3.5 : 2;
    ctx.beginPath(); ctx.arc(cx, cy, RR, s, e); ctx.stroke();
  });
  ctx.font = '500 12px Karla, system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = `rgba(236,228,214,${left ? 0.9 : 0.35})`; ctx.fillText('L', cx - RR - 16, cy);
  ctx.fillStyle = `rgba(236,228,214,${left ? 0.35 : 0.9})`; ctx.fillText('R', cx + RR + 16, cy);
}

function drawSegments(B, current, cx, cy, RR, f, col) {
  const total = B.steps.reduce((s, x) => s + x[1], 0), gap = 0.06;
  let ang = -Math.PI / 2;
  ctx.lineCap = 'round';
  B.steps.forEach((st, k) => {
    const span = (st[1] / total) * TAU - gap, hold = !(st[0] in STEP_TO);
    ctx.strokeStyle = hold ? 'rgba(236,228,214,.16)' : `rgba(${col},.18)`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, RR, ang, ang + span); ctx.stroke();
    if (k <= current) {
      ctx.strokeStyle = hold ? 'rgba(236,228,214,.75)' : `rgba(${col},.9)`;
      ctx.beginPath(); ctx.arc(cx, cy, RR, ang, ang + (k < current ? span : span * f)); ctx.stroke();
    }
    ang += span + gap;
  });
}

function drawPulse(b, B, cx, cy, RR, col) {
  const done = Math.min(B.pumps, Math.floor(b.i / 2) + (b.i % 2 ? 1 : 0));
  const resting = b.i >= B.pumps * 2;
  for (let k = 0; k < B.pumps; k++) {
    const a = -Math.PI / 2 + (k / B.pumps) * TAU, x = cx + Math.cos(a) * RR, y = cy + Math.sin(a) * RR;
    const on = resting || k < done;
    ctx.fillStyle = on ? `rgba(${col},.9)` : `rgba(${col},.18)`;
    ctx.beginPath(); ctx.arc(x, y, on ? 3.2 : 2.4, 0, TAU); ctx.fill();
  }
  if (!resting && b.i % 2 === 0) additive(() => glow(cx, cy, RR * 1.1, col, 0.18 * (1 - b.t / B.steps[b.i][1])));
  ctx.font = '500 12px Karla, system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(236,228,214,.6)';
  ctx.fillText(`ronde ${(b.cycles % B.rounds) + 1} van ${B.rounds}`, cx, cy + RR + 18);
}
