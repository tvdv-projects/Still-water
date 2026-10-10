// Heart-rate variability from beat-to-beat (RR) intervals. Pure functions, unit-tested.
//
// RR intervals come from a chest strap (e.g. Garmin HRM 200) in the Bluetooth Heart Rate
// Measurement, in milliseconds. A watch broadcasting heart rate usually does not send them.
//
//  - cleanRR:   drops implausible values and beats that jump more than 20 % from the previous one
//               (missed or extra beats, strap contact noise).
//  - rmssd:     the standard short-term HRV measure (ms). Higher = more parasympathetic activity.
//  - coherence: how closely the heart rate follows the breathing guide (0..1). During slow breathing
//               the heart speeds up on the inhale and slows on the exhale (respiratory sinus arrhythmia);
//               a strong, regular coupling is what resonance breathing aims for.

import { clamp } from './math.js';

export const RR_MIN = 300; // 200 bpm
export const RR_MAX = 2000; // 30 bpm

/** Remove implausible intervals and sudden jumps (> 20 % from the last accepted beat). */
export function cleanRR(rr) {
  const out = [];
  for (const ms of rr) {
    if (ms < RR_MIN || ms > RR_MAX) continue;
    const prev = out[out.length - 1];
    if (prev && Math.abs(ms - prev) / prev > 0.2) continue;
    out.push(ms);
  }
  return out;
}

/** Root mean square of successive differences, in ms. Needs at least 10 intervals. */
export function rmssd(rr) {
  if (rr.length < 10) return null;
  let sum = 0;
  for (let i = 1; i < rr.length; i++) sum += (rr[i] - rr[i - 1]) ** 2;
  return Math.sqrt(sum / (rr.length - 1));
}

/** Linear interpolation of a time series [{t, v}] (sorted by t) at time `t`. */
export function sampleAt(series, t) {
  if (!series.length) return null;
  if (t <= series[0].t) return series[0].v;
  if (t >= series[series.length - 1].t) return series[series.length - 1].v;
  let lo = 0, hi = series.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (series[mid].t <= t) lo = mid; else hi = mid;
  }
  const a = series[lo], b = series[hi];
  return a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t);
}

/** Pearson correlation of two equal-length arrays; 0 when either is flat. */
export function correlation(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma, y = b[i] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

/**
 * Coherence between heart rate and the breathing guide over the last `window` seconds.
 * Both are resampled at 4 Hz; the heart may lag the breath by 0–5 s, so the best lag is used.
 * @param {{t:number, v:number}[]} beats instantaneous heart rate (bpm) per beat
 * @param {{t:number, v:number}[]} breaths breathing guide level (0..1) over time
 * @returns {number|null} 0..1, or null when there is not enough data yet (< 40 s)
 */
export function coherence(beats, breaths, now, window = 60) {
  const t0 = Math.max(now - window, beats[0]?.t ?? now, breaths[0]?.t ?? now);
  if (now - t0 < 40) return null;
  const fs = 4, n = Math.floor((now - t0) * fs);
  const br = Array.from({ length: n }, (_, i) => sampleAt(breaths, t0 + i / fs));
  let best = 0;
  for (let lag = 0; lag <= 5 * fs; lag += 2) {
    const hr = Array.from({ length: n - lag }, (_, i) => sampleAt(beats, t0 + (i + lag) / fs));
    best = Math.max(best, correlation(br.slice(0, n - lag), hr));
  }
  return clamp(best);
}
