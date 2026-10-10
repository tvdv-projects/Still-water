import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { beatAt, dropScore, needPerStep, stabilityOf, stdDev, steadyScore, summarize } from '../src/core/scoring.js';

describe('dropScore', () => {
  it('gives no progress when the heart rate has not dropped', () => {
    assert.equal(dropScore(0).rate, 0);
    assert.equal(dropScore(-5).rate, 0);
  });
  it('gives more progress the further the heart rate drops, capped at 1.5', () => {
    assert.ok(dropScore(4).rate > dropScore(2).rate);
    assert.equal(dropScore(30).rate, 1.5);
  });
  it('slows the binaural lead (or reverses it) when the heart rate rises', () => {
    assert.ok(dropScore(-3).lead < dropScore(0).lead);
    assert.equal(dropScore(-20).lead, -0.3);
  });
  it('keeps calm within 0..1', () => {
    for (const d of [-50, -4, 0, 8, 50]) {
      const { calm } = dropScore(d);
      assert.ok(calm >= 0 && calm <= 1);
    }
  });
});

describe('steady scoring (Volle focus)', () => {
  it('is fully stable close to baseline with low variation', () => {
    assert.equal(stabilityOf(1, 1), 1);
  });
  it('drops when far from baseline in either direction', () => {
    assert.ok(stabilityOf(5, 1) < 1);
    assert.equal(stabilityOf(5, 1), stabilityOf(-5, 1));
  });
  it('drops with high variability', () => {
    assert.ok(stabilityOf(0, 3) < stabilityOf(0, 1));
  });
  it('returns progress proportional to stability', () => {
    const s = steadyScore(0, 0);
    assert.equal(s.stability, 1);
    assert.equal(s.rate, 1.1);
  });
});

describe('helpers', () => {
  it('stdDev', () => {
    assert.equal(stdDev([5]), 0);
    assert.equal(stdDev([2, 4, 4, 4, 5, 5, 7, 9]), 2);
  });
  it('needPerStep: full progress needs an average rate of 0.5', () => {
    assert.equal(needPerStep(10) * 7, 300);
  });
  it('beatAt moves from start to target and clamps progress', () => {
    assert.equal(beatAt(12, 6, 0), 12);
    assert.equal(beatAt(12, 6, 1), 6);
    assert.equal(beatAt(12, 6, 2), 6);
    assert.equal(beatAt(12, 6, 0.5), 9);
  });
});

describe('summarize', () => {
  const samples = [
    ...Array.from({ length: 60 }, (_, i) => ({ t: i, hr: 72 })),
    ...Array.from({ length: 120 }, (_, i) => ({ t: 61 + i, hr: 72 - i / 20 })),
  ];
  it('computes end rate, drop and minimum', () => {
    const s = summarize(samples, 72, 181);
    assert.ok(s.end < 70 && s.end > 66);
    assert.ok(Math.abs(s.drop - (72 - s.end)) < 1e-9);
    assert.ok(s.min <= s.end);
  });
  it('ignores calibration samples', () => {
    const s = summarize([{ t: 10, hr: 200 }, { t: 70, hr: 60 }], 60, 70);
    assert.equal(s.end, 60);
    assert.equal(s.meanAbsDev, 0);
  });
});
