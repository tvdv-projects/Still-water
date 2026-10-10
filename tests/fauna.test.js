import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createFauna } from '../src/audio/fauna.js';
import { STYLES } from '../src/audio/styles.js';

// createFauna only needs createBuffer at construction time; the sounds themselves are made on demand.
const stubContext = { sampleRate: 8000, createBuffer: (_c, n) => ({ getChannelData: () => new Float32Array(n) }) };
const kinds = Object.keys(createFauna(stubContext, null, null));

describe('fauna', () => {
  for (const [name, S] of Object.entries(STYLES)) {
    it(`${name}: every animal exists and has a sensible interval`, () => {
      const entries = Object.entries(S.fauna || {});
      assert.ok(entries.length > 0, 'each scene has at least one animal');
      for (const [kind, [lo, hi]] of entries) {
        assert.ok(kinds.includes(kind), `unknown animal ${kind}`);
        assert.ok(lo >= 10 && hi > lo, `${kind}: interval [${lo}, ${hi}] should be occasional`);
      }
    });
  }
});
