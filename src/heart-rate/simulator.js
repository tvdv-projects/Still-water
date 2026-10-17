// Test mode: a simulated heart rate, either drifting down automatically or set with a slider.

import { cycleSeconds } from '../config/breathing.js';
import { app, breath, profile, recordRR, recordSample } from '../state.js';
import { $ } from '../ui/dom.js';
import { setStatus } from '../ui/status.js';

let target = 72, auto = true, hr = 74, t0 = 0;

function tick() {
  if (app.source !== 'sim') return;
  if (auto) {
    const m = (performance.now() - t0) / 60000;
    // Drift down, or up for profiles that aim to raise the heart rate.
    target = profile().goal === 'rise' ? 72 + Math.min(10, m * 3) + Math.sin(m * 2.1) * 1.5 : 74 - Math.min(13, m * 2.2) + Math.sin(m * 2.1) * 1.5;
    $('simHr').value = Math.round(target);
    $('simVal').textContent = Math.round(target);
  }
  hr += (target - hr) * 0.18 + (Math.random() - 0.5) * 1.6;
  recordSample(Math.round(hr));
  // Simulated beat-to-beat intervals, as a chest strap would send them. The heart speeds up on the
  // inhale and slows on the exhale: strongly with the breathing guide on, faintly otherwise.
  const rr = [], beats = Math.max(1, Math.round(hr / 60));
  for (let k = 0; k < beats; k++) {
    const sec = performance.now() / 1000 + k / beats;
    // The swing is strongest near 5.5 breaths a minute (a typical resonance rate), as in real people.
    const rate = breath.on && breath.key ? 60 / cycleSeconds(breath.key) : 0;
    const amp = 2.5 + 6 * Math.exp(-(((rate - 5.5) / 1) ** 2));
    const rsa = breath.on && breath.key ? amp * (breath.level - 0.5) * 2 : 1.5 * Math.sin(sec * 1.25);
    rr.push(Math.round(60000 / (hr + rsa + (Math.random() - 0.5) * 1.2)));
  }
  recordRR(rr);
}

export function initSimulator() {
  setInterval(tick, 1000);
  $('simHr').addEventListener('input', (e) => {
    auto = false;
    $('simAuto').setAttribute('aria-pressed', 'false');
    target = +e.target.value;
    $('simVal').textContent = e.target.value;
  });
  $('simAuto').addEventListener('click', (e) => {
    auto = !auto;
    e.currentTarget.setAttribute('aria-pressed', String(auto));
    if (auto) t0 = performance.now() - 60000 * Math.max(0, (74 - target) / 2.2);
  });
}

export function startSimulator() {
  app.source = 'sim';
  t0 = performance.now();
  hr = 74;
  setStatus('test', 'Testmodus');
  $('sim').hidden = false;
}
