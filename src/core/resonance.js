// Resonance-frequency test (pure logic, tested).
//
// At one particular breathing rate, usually between 4.5 and 7 breaths a minute, the heart rate swings
// up and down most strongly with each breath: the resonance frequency (Lehrer & Gevirtz). The test
// breathes each rate for a while and measures, per breath, how far the heart rate rises and falls
// (peak minus trough). The rate with the largest average swing is your rate.

/** Rates tested, from fast to slow (breaths per minute). */
export const RATES = [7, 6.5, 6, 5.5, 5, 4.5];

/** Two lengths: one minute per rate, or two (as in the research protocols; more reliable). */
export const PLANS = {
  kort: { perRate: 60, settle: 15, label: 'Kort', minutes: 6 },
  grondig: { perRate: 120, settle: 20, label: 'Grondig', minutes: 12 },
};

export const totalSeconds = (plan) => RATES.length * plan.perRate;

/** Where the test is at time t (seconds since the start). */
export function stepAt(plan, t) {
  const index = Math.floor(t / plan.perRate);
  if (index >= RATES.length) return { index: RATES.length, rate: null, inStep: 0, left: 0, done: true };
  const inStep = t - index * plan.perRate;
  return { index, rate: RATES[index], inStep, left: plan.perRate - inStep, done: false };
}

/** A breathing technique for a rate: in for 40 % of the breath, out for 60 % (calm, never forced). */
export function techniqueFor(rate, name = `${String(rate).replace('.', ',')} per minuut`, hint = '') {
  const T = 60 / rate;
  const r = (x) => Math.round(x * 100) / 100;
  return { name, steps: [['in', r(T * 0.4)], ['out', r(T * 0.6)]], hint };
}

/**
 * Average heart-rate swing per breath in [t0, t1): the window is cut into breath-length pieces and
 * for each piece with enough beats the peak minus the trough is taken; the median of those is
 * returned (robust against a single odd beat). null when there is too little data.
 * @param {{t:number, v:number}[]} beats instantaneous heart rate per beat
 */
export function amplitude(beats, t0, t1, rate) {
  const period = 60 / rate, swings = [];
  for (let a = t0; a + period <= t1 + 1e-9; a += period) {
    const vs = beats.filter((b) => b.t >= a && b.t < a + period).map((b) => b.v);
    if (vs.length >= 3) swings.push(Math.max(...vs) - Math.min(...vs));
  }
  if (swings.length < 2) return null;
  swings.sort((x, y) => x - y);
  const m = swings.length >> 1;
  return swings.length % 2 ? swings[m] : (swings[m - 1] + swings[m]) / 2;
}

/** Results per rate: the swing measured after the settling time at the start of each step. */
export function analyse(beats, plan) {
  return RATES.map((rate, i) => {
    const t0 = i * plan.perRate + plan.settle, t1 = (i + 1) * plan.perRate;
    return { rate, amp: amplitude(beats, t0, t1, rate) };
  });
}

/** The rate with the largest swing, or null when nothing could be measured. */
export function best(results) {
  const ok = results.filter((r) => r.amp != null);
  if (!ok.length) return null;
  return ok.reduce((a, b) => (b.amp > a.amp ? b : a));
}
