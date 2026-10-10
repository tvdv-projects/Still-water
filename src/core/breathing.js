// Breathing guide state machine. Pure logic, driven by `stepBreath(b, dt)` each frame.
// `level` (0..1) is how full the lungs should be; `vis` (0..1) fades the guide in and out.
// Switching technique mid-session is queued in `pending` and applied when the current cycle ends,
// so the rhythm never breaks halfway through a breath.

import { BREATHS, STEP_TO } from '../config/breathing.js';
import { clamp, easeIO, lerp, smoothing } from './math.js';

export function createBreath() {
  return { on: false, key: null, i: 0, t: 0, from: 0, level: 0, vis: 0, pending: null, hinted: {}, cycles: 0 };
}

/** Start `key` at the beginning of its cycle. Returns true the first time this technique is used. */
export function startBreath(b, key) {
  b.key = key;
  b.i = 0;
  b.t = 0;
  b.from = b.level;
  b.pending = null;
  b.cycles = 0;
  const first = !b.hinted[key];
  b.hinted[key] = true;
  return first;
}

/** The current [phase, seconds] step, or null when no technique is selected. */
export const currentStep = (b) => (b.key ? BREATHS[b.key].steps[b.i] : null);

/** Seconds left in the current step (rounded up, minimum 1) for the on-screen countdown. */
export const countdown = (b) => {
  const st = currentStep(b);
  return st ? Math.max(1, Math.ceil(st[1] - b.t)) : 0;
};

/**
 * Advance the guide by `dt` seconds.
 * @returns {{key: string, first: boolean}|null} the technique just started from the queue (and whether
 *   it is used for the first time, so its instruction can be shown), otherwise null
 */
export function stepBreath(b, dt) {
  b.vis = lerp(b.vis, b.on ? 1 : 0, smoothing(dt, 0.6));
  if (!b.on || !b.key) {
    b.level = lerp(b.level, 0, smoothing(dt, 1.2));
    return null;
  }
  const B = BREATHS[b.key];
  const [phase, d] = B.steps[b.i];
  b.t += dt;
  let to = (B.levels && B.levels[phase]) ?? STEP_TO[phase];
  if (to === undefined) to = b.from;
  b.level = b.from + (to - b.from) * easeIO(clamp(b.t / d));
  if (b.t < d) return null;

  b.from = to;
  b.t -= d;
  b.i++;
  if (b.i < B.steps.length) return null;
  b.i = 0;
  b.cycles++;
  if (!b.pending) return null;
  const key = b.pending;
  return { key, first: startBreath(b, key) };
}

/** Choose a technique. If one is running, the switch waits for the end of the current cycle. */
export function selectBreath(b, key) {
  if (b.on && b.key && key !== b.key) {
    b.pending = key;
    return 'queued';
  }
  if (b.on) {
    b.pending = null;
    return 'current';
  }
  b.key = key;
  return 'selected';
}
