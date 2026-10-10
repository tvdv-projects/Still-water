// Pure scoring logic: turns heart-rate readings into calm, progress and the
// binaural "lead" speed. No DOM, audio or canvas here, so it is unit-tested.

import { clamp, easeIO } from './math.js';

/** Number of progress steps (lanterns, peaks, circle segments) per session. */
export const STEPS = 7;

/** Calibration length in seconds before the session starts scoring. */
export const CALIB_SECONDS = 60;

/** Points needed per progress step. Full progress needs an average rate of 0.5 for the whole session. */
export const needPerStep = (durMin, steps = STEPS) => (durMin * 60 * 0.5) / steps;

/**
 * Score for 'drop' profiles. `diff` = baseline − current heart rate (positive = lower than at the start).
 * calm: 0..1 visual calm, rate: progress points per second, lead: how fast the binaural beat moves to its target.
 */
export function dropScore(diff) {
  return {
    calm: clamp((diff + 4) / 12),
    rate: clamp((diff - 1) / 6, 0, 1.5),
    lead: clamp(0.6 + diff * 0.15, -0.3, 1.5),
  };
}

/** Stability 0..1: close to the starting rate (within ±1.5 bpm) and little variation (sd ≤ 1.2 bpm) scores 1. */
export function stabilityOf(diff, sd) {
  return clamp(1 - Math.max(0, Math.abs(diff) - 1.5) / 5) * clamp(1 - Math.max(0, sd - 1.2) / 3);
}

/** Score for 'steady' profiles (Volle focus). */
export function steadyScore(diff, sd) {
  const s = stabilityOf(diff, sd);
  return { calm: s, rate: s * 1.1, lead: clamp(0.2 + s, 0, 1.2), stability: s };
}

/** Population standard deviation. */
export function stdDev(values) {
  if (values.length < 2) return 0;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - m) * (b - m), 0) / values.length);
}

/** Binaural beat for progress `p` (0..1) between the start and target frequency. */
export const beatAt = (start, target, p) => start + (target - start) * easeIO(clamp(p));

/**
 * Summary numbers for the end screen.
 * @param {{t:number, hr:number}[]} samples all samples of the session (t in seconds since start)
 * @param {number} baseline average heart rate during calibration
 * @param {number} now session clock at the end
 */
export function summarize(samples, baseline, now, calib = CALIB_SECONDS) {
  const sess = samples.filter((s) => s.t > calib);
  const last = sess.filter((s) => s.t > now - 60);
  const avg = (arr) => arr.reduce((a, s) => a + s.hr, 0) / arr.length;
  const end = last.length ? avg(last) : sess.length ? sess[sess.length - 1].hr : baseline;
  let min = Infinity;
  for (let i = 0; i < sess.length; i++) min = Math.min(min, avg(sess.slice(Math.max(0, i - 9), i + 1)));
  const meanAbsDev = sess.length ? sess.reduce((a, s) => a + Math.abs(s.hr - baseline), 0) / sess.length : 0;
  return { end, min: Number.isFinite(min) ? min : null, drop: baseline - end, meanAbsDev };
}
