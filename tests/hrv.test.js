import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cleanRR, coherence, correlation, rmssd, sampleAt } from '../src/core/hrv.js';
import { parseMeasurement } from '../src/heart-rate/bluetooth.js';

describe('cleanRR', () => {
  it('drops implausible values and sudden jumps', () => {
    assert.deepEqual(cleanRR([1000, 250, 1010, 1500, 990, 2500, 1005]), [1000, 1010, 990, 1005]);
  });
});

describe('rmssd', () => {
  it('needs at least 10 intervals', () => {
    assert.equal(rmssd([1000, 1010]), null);
  });
  it('is zero for a metronome and grows with beat-to-beat variation', () => {
    assert.equal(rmssd(Array(20).fill(1000)), 0);
    const alt = Array.from({ length: 20 }, (_, i) => (i % 2 ? 1040 : 960));
    assert.equal(rmssd(alt), 80);
  });
});

describe('helpers', () => {
  it('sampleAt interpolates and clamps', () => {
    const s = [{ t: 0, v: 0 }, { t: 2, v: 10 }];
    assert.equal(sampleAt(s, 1), 5);
    assert.equal(sampleAt(s, -1), 0);
    assert.equal(sampleAt(s, 5), 10);
  });
  it('correlation', () => {
    assert.ok(Math.abs(correlation([1, 2, 3, 4], [2, 4, 6, 8]) - 1) < 1e-12);
    assert.ok(Math.abs(correlation([1, 2, 3, 4], [4, 3, 2, 1]) + 1) < 1e-12);
    assert.equal(correlation([1, 1, 1], [1, 2, 3]), 0);
  });
});

describe('coherence', () => {
  const breathing = (secs) => Array.from({ length: secs * 10 }, (_, i) => ({ t: i / 10, v: 0.5 + 0.5 * Math.sin((2 * Math.PI * i) / 10 / 10) }));
  it('needs 40 s of data', () => {
    const br = breathing(30), hr = br.map(({ t, v }) => ({ t, v: 60 + 6 * v }));
    assert.equal(coherence(hr, br, 30), null);
  });
  it('is high when the heart follows the breath with a short lag', () => {
    const br = breathing(70);
    const hr = br.map(({ t }) => ({ t, v: 62 + 5 * Math.sin((2 * Math.PI * (t - 2)) / 10) }));
    assert.ok(coherence(hr, br, 70) > 0.9);
  });
  it('is low when heart rate and breathing are unrelated', () => {
    const br = breathing(70);
    let x = 0.3;
    const hr = br.map(({ t }) => { x = (x * 9301 + 49297) % 233280 / 233280; return { t, v: 62 + 4 * x }; });
    assert.ok(coherence(hr, br, 70) < 0.4);
  });
});

describe('heart rate measurement parsing', () => {
  it('reads heart rate without RR intervals', () => {
    const r = parseMeasurement(new DataView(new Uint8Array([0x00, 64]).buffer));
    assert.deepEqual(r, { hr: 64, rr: [] });
  });
  it('reads RR intervals (1/1024 s) when flag bit 4 is set, skipping energy expended', () => {
    // flags: RR present (0x10) + energy expended present (0x08); hr 60; energy 0x0102; rr 1024 and 512
    const bytes = new Uint8Array([0x18, 60, 0x02, 0x01, 0x00, 0x04, 0x00, 0x02]);
    const r = parseMeasurement(new DataView(bytes.buffer));
    assert.equal(r.hr, 60);
    assert.deepEqual(r.rr, [1000, 500]);
  });
});
