import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { STYLES } from '../src/audio/styles.js';
import { BREATHS } from '../src/config/breathing.js';
import { PROFILES } from '../src/config/profiles.js';
import { STEPS } from '../src/core/scoring.js';
import { parseHeartRate } from '../src/heart-rate/bluetooth.js';

describe('profiles', () => {
  for (const [key, P] of Object.entries(PROFILES)) {
    describe(key, () => {
      it('offers exactly three known breathing techniques', () => {
        assert.equal(P.breaths.length, 3);
        P.breaths.forEach((b) => assert.ok(BREATHS[b], `unknown technique ${b}`));
      });
      it('has a known music style and scene', () => {
        assert.ok(STYLES[P.style]);
        assert.ok(['lake', 'dawn', 'candle', 'campfire'].includes(P.scene));
      });
      it('has a message for every progress step', () => {
        assert.equal(P.lines.length, STEPS);
      });
      it('leads the beat in the direction of the goal for any plausible heart rate', () => {
        for (const hr of [45, 60, 75, 100]) {
          if (P.goal === 'rise') assert.ok(P.start(hr) < P.target, `${key} at ${hr} bpm`);
          else assert.ok(P.start(hr) > P.target, `${key} at ${hr} bpm`);
        }
      });
      it('starts higher when the heart rate is higher', () => {
        assert.ok(P.start(90) >= P.start(60));
      });
    });
  }
  it('Volle focus aims for a steady heart rate, Energie for a rise, the others for a drop', () => {
    assert.equal(PROFILES.volle.goal, 'steady');
    assert.equal(PROFILES.energie.goal, 'rise');
    assert.deepEqual(PROFILES.energie.band, [5, 12]);
    ['slaap', 'rust', 'focus'].forEach((k) => assert.equal(PROFILES[k].goal, 'drop'));
  });
  it('binaural targets go from deep (sleep) to alert (full focus)', () => {
    const t = ['slaap', 'rust', 'focus', 'volle'].map((k) => PROFILES[k].target);
    assert.deepEqual([...t].sort((a, b) => a - b), t);
  });
});

describe('Bluetooth heart-rate parsing', () => {
  it('reads an 8-bit value', () => {
    assert.equal(parseHeartRate(new DataView(new Uint8Array([0x00, 64]).buffer)), 64);
  });
  it('reads a 16-bit value when flag bit 0 is set', () => {
    assert.equal(parseHeartRate(new DataView(new Uint8Array([0x01, 0x2c, 0x01]).buffer)), 300);
  });
});
