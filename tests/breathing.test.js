import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BREATHS, cycleSeconds, STEP_LABEL } from '../src/config/breathing.js';
import { countdown, createBreath, currentStep, selectBreath, startBreath, stepBreath } from '../src/core/breathing.js';

const run = (b, seconds, dt = 0.05) => {
  const events = [];
  for (let t = 0; t < seconds - 1e-9; t += dt) {
    const e = stepBreath(b, dt);
    if (e) events.push(e);
  }
  return events;
};

describe('technique definitions', () => {
  it('every phase has a label and a positive duration', () => {
    for (const [key, B] of Object.entries(BREATHS)) {
      for (const [phase, d] of B.steps) {
        assert.ok(STEP_LABEL[phase], `${key}: missing label for ${phase}`);
        assert.ok(d > 0, `${key}: ${phase} has no duration`);
      }
    }
  });
  it('resonance breathing runs at about six breaths per minute', () => {
    assert.equal(60 / cycleSeconds('reso55'), 60 / 11);
    assert.ok(Math.abs(60 / cycleSeconds('reso55') - 5.45) < 0.01);
  });
});

describe('activating techniques', () => {
  it('fire breath: 20 short exhales of 0.7 s, then 20 s calm, in 3 rounds', () => {
    const B = BREATHS.fire;
    assert.equal(B.steps.filter(([p]) => p === 'outP').length, 20);
    assert.ok(Math.abs(cycleSeconds('fire') - 34) < 1e-9);
    assert.equal(B.rounds, 3);
  });
  it('fire breath pulses the guide and counts rounds', () => {
    const b = createBreath();
    b.on = true;
    b.level = 0.55;
    startBreath(b, 'fire');
    run(b, 0.35);
    assert.ok(b.level < 0.2, 'short exhale empties the guide');
    run(b, 0.35);
    assert.ok(b.level > 0.5, 'passive inhale refills it');
    run(b, 34 * 3 - 0.7 + 0.1);
    assert.equal(b.cycles, 3);
  });
  it('stairs: three sniffs fill the guide step by step', () => {
    const b = createBreath();
    b.on = true;
    startBreath(b, 'stairs');
    run(b, 1); const one = b.level;
    run(b, 1); const two = b.level;
    run(b, 1);
    assert.ok(one < two && two < b.level && b.level > 0.95);
  });
});

describe('breathing engine', () => {
  it('fills on the inhale and empties on the exhale', () => {
    const b = createBreath();
    b.on = true;
    startBreath(b, 'equal');
    run(b, 4);
    assert.ok(b.level > 0.95, `level after inhale: ${b.level}`);
    run(b, 4);
    assert.ok(b.level < 0.05, `level after exhale: ${b.level}`);
  });
  it('keeps the level during a hold', () => {
    const b = createBreath();
    b.on = true;
    startBreath(b, 'box');
    run(b, 4);
    const top = b.level;
    run(b, 3.9);
    assert.equal(currentStep(b)[0], 'hold');
    assert.ok(Math.abs(b.level - top) < 1e-6);
  });
  it('queues a switch until the current cycle has finished', () => {
    const b = createBreath();
    b.on = true;
    startBreath(b, 'box'); // 16 s cycle
    run(b, 3);
    assert.equal(selectBreath(b, 'equal'), 'queued');
    run(b, 10);
    assert.equal(b.key, 'box');
    const events = run(b, 4);
    assert.equal(b.key, 'equal');
    assert.deepEqual(events, [{ key: 'equal', first: true }]);
  });
  it('reports the first use of a technique only once', () => {
    const b = createBreath();
    assert.equal(startBreath(b, 'nadi'), true);
    assert.equal(startBreath(b, 'nadi'), false);
  });
  it('counts down whole seconds', () => {
    const b = createBreath();
    b.on = true;
    startBreath(b, 'b478');
    assert.equal(countdown(b), 4);
    run(b, 1.5);
    assert.equal(countdown(b), 3);
  });
  it('relaxes back to empty when switched off', () => {
    const b = createBreath();
    b.on = true;
    startBreath(b, 'equal');
    run(b, 4);
    b.on = false;
    run(b, 8);
    assert.ok(b.level < 0.01 && b.vis < 0.01);
  });
});
