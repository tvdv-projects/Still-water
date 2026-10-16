import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { STYLES } from '../src/audio/styles.js';
import { BREATHS } from '../src/config/breathing.js';
import { ALL_BREATHS, bandName, beatFor, breathLabel, DEFAULT_FREE, freeProfile, LOOKS, MUSIC, normalizeFree } from '../src/config/free.js';
import { PROFILES } from '../src/config/profiles.js';

describe('Vrij', () => {
  it('offers every breathing technique exactly once', () => {
    assert.deepEqual([...ALL_BREATHS].sort(), Object.keys(BREATHS).sort());
  });
  it('tells techniques with the same name apart', () => {
    const labels = ALL_BREATHS.map(breathLabel);
    assert.equal(new Set(labels).size, labels.length);
    assert.equal(breathLabel('long48'), 'Lange uitademing 4-8');
    assert.equal(breathLabel('box'), 'Box');
  });
  it('every background comes from a profile and every music choice exists', () => {
    LOOKS.forEach((l) => assert.ok(PROFILES[l.key], l.key));
    MUSIC.forEach((m) => assert.ok(m.key === 'auto' || STYLES[m.key], m.key));
  });
  it('builds a profile from the settings, music following the background unless chosen', () => {
    const p = freeProfile({ look: 'energie' });
    assert.equal(p.scene, 'campfire');
    assert.equal(p.style, PROFILES.energie.style);
    assert.equal(p.sceneGoal, 'rise');
    assert.equal(freeProfile({ look: 'energie', music: 'deep' }).style, 'deep');
    assert.equal(p.free, true);
  });
  it('repairs bad stored settings', () => {
    const s = normalizeFree({ look: 'nope', music: 'x', mode: 'weird', beat: 99, from: -3, carrier: 5000 });
    assert.equal(s.look, DEFAULT_FREE.look);
    assert.equal(s.music, 'auto');
    assert.equal(s.mode, 'fixed');
    assert.equal(s.beat, 30);
    assert.equal(s.from, 1);
    assert.equal(s.carrier, 400);
    assert.equal(normalizeFree({}).carrier, null);
  });
  it('keeps a fixed beat, and ramps from → to over the session', () => {
    const fixed = normalizeFree({ mode: 'fixed', beat: 7 });
    assert.equal(beatFor(fixed, 0, 10), 7);
    assert.equal(beatFor(fixed, 9999, 10), 7);
    const ramp = normalizeFree({ mode: 'ramp', from: 12, to: 6 });
    assert.equal(beatFor(ramp, 0, 10), 12);
    assert.ok(Math.abs(beatFor(ramp, 300, 10) - 9) < 1e-9);
    assert.equal(beatFor(ramp, 600, 10), 6);
    assert.equal(beatFor(ramp, 3600, 0), 6); // unlimited: reaches the end after 20 minutes and stays
  });
  it('names the brain-wave bands', () => {
    assert.match(bandName(2), /delta/);
    assert.match(bandName(6), /theta/);
    assert.match(bandName(10), /alfa/);
    assert.match(bandName(15), /bèta/);
  });
});
