// Pure signal-processing helpers (no Web Audio), so they can be tested in Node.
//
// The core idea for a less "computer-like" sound is PADsynth (Nasca Octavian Paul): instead of a few
// perfect oscillators, a sound is described as a spectrum in which every harmonic is a soft band of
// frequencies with random phases. One inverse FFT turns that into a long, perfectly looping sample
// that sounds like an ensemble: warm, wide and alive, without any pitch wobble.

/** Small seeded random generator (mulberry32), so tables are reproducible. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** In-place iterative radix-2 complex FFT. `re` and `im` have a power-of-two length. */
export function fft(re, im, inverse = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang), half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k, b = a + half;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

/**
 * PADsynth: a looping sample of `n` frames (power of two).
 * @param {object} o
 * @param {number} o.n            table length (power of two)
 * @param {number} o.sampleRate
 * @param {number} o.f0           fundamental in Hz
 * @param {number[]} o.harmonics  amplitude per harmonic, index 0 = fundamental
 * @param {number} o.bw           bandwidth of the fundamental in cents (ensemble width)
 * @param {number} [o.bwScale=1]  how fast the bandwidth grows for higher harmonics
 * @param {number} [o.seed=1]     random phases; use different seeds for left and right
 * @param {number} [o.rms=0.25]   output loudness
 */
export function padsynth({ n, sampleRate, f0, harmonics, bw, bwScale = 1, seed = 1, rms = 0.25 }) {
  const half = n >> 1, amp = new Float64Array(half);
  harmonics.forEach((a, i) => {
    if (!a) return;
    const k = i + 1, fHz = f0 * k;
    if (fHz >= sampleRate / 2) return;
    const bwHz = (Math.pow(2, bw / 1200) - 1) * f0 * Math.pow(k, bwScale);
    const bwi = bwHz / (2 * sampleRate), fi = fHz / sampleRate;
    const lo = Math.max(1, Math.floor((fi - 3 * bwi) * n)), hi = Math.min(half - 1, Math.ceil((fi + 3 * bwi) * n));
    for (let b = lo; b <= hi; b++) {
      const x = (b / n - fi) / bwi;
      amp[b] += (a * Math.exp(-x * x)) / bwi;
    }
  });
  const re = new Float64Array(n), im = new Float64Array(n), rand = rng(seed);
  for (let b = 1; b < half; b++) {
    const p = rand() * 2 * Math.PI;
    re[b] = amp[b] * Math.cos(p); im[b] = amp[b] * Math.sin(p);
    re[n - b] = re[b]; im[n - b] = -im[b];
  }
  fft(re, im, true);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += re[i] * re[i];
  const g = sum > 0 ? rms / Math.sqrt(sum / n) : 0, out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = re[i] * g;
  return out;
}

/**
 * A dark, deep stereo room: a pre-delay, a few early reflections, then a decorrelated noise tail
 * whose high frequencies die out much faster than the lows (like a large hall or a misty valley).
 * @returns {[Float32Array, Float32Array]}
 */
export function impulseResponse({ sampleRate, seconds = 9, preDelay = 0.025, rt60 = 7, darkness = 0.75, seed = 7 }) {
  const len = Math.floor(sampleRate * seconds), pre = Math.floor(sampleRate * preDelay), out = [];
  for (let c = 0; c < 2; c++) {
    const d = new Float32Array(len), rand = rng(seed + c * 101);
    // Early reflections: sparse taps in the first 90 ms, different per ear.
    for (let k = 0; k < 10; k++) {
      const at = pre + Math.floor(sampleRate * (0.004 + rand() * 0.085));
      if (at < len) d[at] += (rand() < 0.5 ? -1 : 1) * (0.5 - k * 0.035);
    }
    // Tail: noise through a one-pole low-pass whose cutoff sinks over time.
    let lp = 0;
    const startFc = 9000, endFc = lerpExp(9000, 350, darkness);
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sampleRate, x = t / seconds;
      const fc = startFc * Math.pow(endFc / startFc, Math.min(1, x * 2.2));
      const a = 1 - Math.exp((-2 * Math.PI * fc) / sampleRate);
      lp += a * (rand() * 2 - 1 - lp);
      const env = Math.exp((-6.9 * t) / rt60) * Math.min(1, t / 0.06);
      d[i] += lp * env * 0.9;
    }
    // Fade the very end to avoid a click.
    const fade = Math.floor(sampleRate * 0.2);
    for (let i = 0; i < fade; i++) d[len - 1 - i] *= i / fade;
    out.push(d);
  }
  // Normalise both channels together so the stereo balance stays intact.
  let peak = 0;
  for (const d of out) for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  for (const d of out) for (let i = 0; i < d.length; i++) d[i] /= peak || 1;
  return out;
}

const lerpExp = (a, b, t) => a * Math.pow(b / a, t);

/**
 * Gentle tape-like saturation curve for a WaveShaperNode: unity gain for quiet signals,
 * rounding off peaks softly instead of clipping them.
 */
export function saturationCurve(drive = 1.6, n = 2048) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(x * drive) / drive;
  }
  return c;
}
