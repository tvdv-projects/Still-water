import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { amplitude, analyse, best, PLANS, RATES, stepAt, techniqueFor, totalSeconds } from '../src/core/resonance.js';

// Simulated beats: heart rate 60 ± amp, swinging with the breath, one beat per second.
function beatsFor(plan, ampAt) {
  const beats = [];
  for (let t = 0; t < totalSeconds(plan); t += 1) {
    const s = stepAt(plan, t);
    if (s.done) break;
    const phase = (s.inStep * s.rate) / 60;
    beats.push({ t, v: 60 + ampAt(s.rate) * Math.sin(2 * Math.PI * phase) });
  }
  return beats;
}

describe('resonance test', () => {
  it('walks through the six rates', () => {
    const p = PLANS.kort;
    assert.equal(stepAt(p, 0).rate, 7);
    assert.equal(stepAt(p, 61).rate, 6.5);
    assert.equal(stepAt(p, 359).rate, 4.5);
    assert.equal(stepAt(p, 360).done, true);
    assert.equal(totalSeconds(PLANS.grondig), 720);
  });
  it('makes a calm technique for a rate (in 40 %, out 60 %)', () => {
    const t = techniqueFor(6);
    assert.deepEqual(t.steps, [['in', 4], ['out', 6]]);
    assert.equal(t.name, '6 per minuut');
  });
  it('measures the swing per breath', () => {
    const beats = Array.from({ length: 120 }, (_, t) => ({ t, v: 60 + 5 * Math.sin((2 * Math.PI * t) / 10) }));
    const a = amplitude(beats, 0, 120, 6);
    assert.ok(a > 9 && a <= 10, `got ${a}`);
    assert.equal(amplitude(beats.slice(0, 5), 0, 120, 6), null);
  });
  for (const key of Object.keys(PLANS)) {
    it(`finds the rate with the largest swing (${key})`, () => {
      const plan = PLANS[key];
      const beats = beatsFor(plan, (rate) => 2 + 6 * Math.exp(-(((rate - 5.5) / 0.8) ** 2)));
      const res = analyse(beats, plan);
      assert.equal(res.length, RATES.length);
      assert.equal(best(res).rate, 5.5);
    });
  }
  it('has no answer without data', () => {
    assert.equal(best(analyse([], PLANS.kort)), null);
  });
});
