// Test mode: a simulated heart rate, either drifting down automatically or set with a slider.

import { app, recordSample } from '../state.js';
import { $ } from '../ui/dom.js';
import { setStatus } from '../ui/status.js';

let target = 72, auto = true, hr = 74, t0 = 0;

function tick() {
  if (app.source !== 'sim') return;
  if (auto) {
    const m = (performance.now() - t0) / 60000;
    target = 74 - Math.min(13, m * 2.2) + Math.sin(m * 2.1) * 1.5;
    $('simHr').value = Math.round(target);
    $('simVal').textContent = Math.round(target);
  }
  hr += (target - hr) * 0.18 + (Math.random() - 0.5) * 1.6;
  recordSample(Math.round(hr));
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
