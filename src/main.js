// Entry point: wires the modules together and runs the animation loop.

import { audio } from './audio/engine.js';
import { precompute } from './audio/patches.js';
import { BREATHS } from './config/breathing.js';
import { currentStep, stepBreath } from './core/breathing.js';
import { initSimulator } from './heart-rate/simulator.js';
import { canvasWindow, resize } from './render/context.js';
import { drawFrame } from './render/frame.js';
import { visitors } from './render/scenes/morning.js';
import { initResonance, updateReso } from './resonance-test.js';
import { updateSession, updateSleep } from './session.js';
import { app, breath } from './state.js';
import { initBreathBar } from './ui/breath-bar.js';
import { initControls } from './ui/controls.js';
import { initHud, updateHud, updateWave } from './ui/hud.js';
import { msg } from './ui/messages.js';
import { initMini } from './ui/mini.js';
import { initView, updateCues } from './ui/view.js';

addEventListener('resize', resize);
resize();
initSimulator();
initBreathBar();
initHud();
initControls();
initView();
initResonance();
initMini();
// Render the instrument sounds in the background while the intro screen is showing.
precompute();

// The loop is driven by the window the canvas is in: in the mini window it keeps running while the
// page itself is hidden behind other programs. Time comes from this page's clock, because every
// window has its own requestAnimationFrame time origin.
let last = performance.now(), lastLevel = 0, scheduled = false;
function schedule() {
  if (scheduled) return;
  scheduled = true;
  canvasWindow().requestAnimationFrame(() => { scheduled = false; frame(performance.now()); });
}
// After the mini window closes, its pending frame never fires: start again from the page.
document.addEventListener('stilwater:loop', () => { scheduled = false; schedule(); });

function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  app.time += dt;

  const active = app.state === 'calib' || app.state === 'session';
  if (active) updateSession(dt);
  else if (app.state === 'sleeping') updateSleep();
  else if (app.state === 'reso') updateReso(dt);
  const before = breath.cycles;
  const switched = stepBreath(breath, dt);
  if (switched?.first) msg(BREATHS[switched.key].hint, Math.max(5200, BREATHS[switched.key].hint.length * 55));
  const rounds = breath.key && BREATHS[breath.key].rounds;
  if (rounds && breath.cycles !== before && breath.cycles % rounds === 0) msg(`${rounds} rondes gedaan. Adem rustig verder, of ga nog een keer door.`, 5000);

  updateCues();
  drawFrame(dt);
  updateHud(dt);
  updateWave();

  const rel = app.state === 'session' && app.baseline != null && app.hrS != null ? app.hrS - app.baseline : 0;
  audio.tick(app.time, app.calmVis, app.hrS, active, rel);
  const step = breath.on ? currentStep(breath) : null;
  const speed = Math.abs(breath.level - lastLevel) / Math.max(dt, 1e-3);
  lastLevel = breath.level;
  audio.setBreath(breath.level, step ? step[0] : '', breath.on ? breath.vis : 0, speed);

  schedule();
}
schedule();

// Debug handle for the browser console and automated checks.
window.stilWater = { app, breath, BREATHS, morning: visitors };
