import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fft, impulseResponse, padsynth, saturationCurve } from '../src/audio/dsp.js';
import { targetTempo } from '../src/audio/groove.js';
import { PATCHES, renderTable } from '../src/audio/patches.js';
import { STYLES } from '../src/audio/styles.js';

describe('fft', () => {
  it('inverse undoes forward', () => {
    const n = 64, re = Float64Array.from({ length: n }, (_, i) => Math.sin(i) + (i % 3)), im = new Float64Array(n), orig = re.slice();
    fft(re, im); fft(re, im, true);
    for (let i = 0; i < n; i++) assert.ok(Math.abs(re[i] - orig[i]) < 1e-9 && Math.abs(im[i]) < 1e-9);
  });
  it('finds a pure tone in the right bin', () => {
    const n = 256, re = Float64Array.from({ length: n }, (_, i) => Math.cos((2 * Math.PI * 10 * i) / n)), im = new Float64Array(n);
    fft(re, im);
    const mags = [...re].map((r, i) => Math.hypot(r, im[i]));
    assert.equal(mags.indexOf(Math.max(...mags.slice(0, n / 2))), 10);
  });
});

describe('padsynth', () => {
  const opts = { n: 1 << 14, sampleRate: 48000, f0: 220, harmonics: [1, 0.5, 0.25], bw: 30 };
  it('has the requested loudness', () => {
    const t = padsynth(opts), rms = Math.sqrt(t.reduce((s, x) => s + x * x, 0) / t.length);
    assert.ok(Math.abs(rms - 0.25) < 1e-3);
  });
  it('loops seamlessly: the jump from end to start is no bigger than a normal step', () => {
    const t = padsynth(opts);
    let maxStep = 0;
    for (let i = 1; i < t.length; i++) maxStep = Math.max(maxStep, Math.abs(t[i] - t[i - 1]));
    assert.ok(Math.abs(t[0] - t[t.length - 1]) <= maxStep);
  });
  it('different seeds give different (decorrelated) channels', () => {
    const a = padsynth({ ...opts, seed: 1 }), b = padsynth({ ...opts, seed: 2 });
    let ab = 0, aa = 0, bb = 0;
    for (let i = 0; i < a.length; i++) { ab += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
    assert.ok(Math.abs(ab / Math.sqrt(aa * bb)) < 0.3);
  });
  it('renders every patch without NaN', () => {
    for (const name of Object.keys(PATCHES)) {
      const t = renderTable(name, 0);
      assert.equal(t.length, PATCHES[name].n);
      assert.ok(t.every(Number.isFinite), name);
    }
  });
});

describe('room and tape', () => {
  it('the reverb tail decays and is darker at the end', () => {
    const [L] = impulseResponse({ sampleRate: 8000, seconds: 4, rt60: 3 });
    const energy = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += L[i] * L[i]; return s; };
    assert.ok(energy(1000, 2000) > energy(24000, 25000) * 10);
  });
  it('saturation leaves quiet signals untouched and never exceeds ±1', () => {
    const c = saturationCurve(1.6, 2049), mid = 1024;
    assert.ok(Math.abs(c[mid + 10] - 10 / 1024) < 1e-3);
    assert.ok(c.every((x) => Math.abs(x) <= 1));
  });
});

describe('tempo', () => {
  const g = STYLES.bright.groove;
  it('is fixed unless it follows the heart', () => {
    assert.equal(targetTempo(g, false, 70), g.bpm);
    assert.equal(targetTempo(g, true, null), g.bpm);
  });
  it('follows the heart rate plus offset, within the range', () => {
    assert.equal(targetTempo(g, true, 88), 88 + g.hr[2]);
    assert.equal(targetTempo(g, true, 40), g.hr[0]);
    assert.equal(targetTempo(g, true, 180), g.hr[1]);
  });
  it('every style uses a known pad patch', () => {
    for (const S of Object.values(STYLES)) assert.ok(PATCHES[S.pad], S.pad);
  });
});
