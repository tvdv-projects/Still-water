// Entry point: wires the modules together and runs the animation loop.

import { audio } from './audio/engine.js';
import { precompute } from './audio/patches.js';
import { BREATHS } from './config/breathing.js';
import { currentStep, stepBreath } from './core/breathing.js';
import { initSimulator } from './heart-rate/simulator.js';
import { resize } from './render/context.js';
import { drawFrame } from './render/frame.js';
import { visitors } from './render/scenes/morning.js';
import { updateSession, updateSleep } from './session.js';
import { app, breath } from './state.js';
import { initBreathBar } from './ui/breath-bar.js';
import { initControls } from './ui/controls.js';
import { initHud, updateHud } from './ui/hud.js';
import { msg } from './ui/messages.js';

addEventListener('resize', resize);
resize();
initSimulator();
initBreathBar();
initHud();
initControls();
// Render the instrument sounds in the background while the intro screen is showing.
precompute();

let last = performance.now(), lastLevel = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  app.time += dt;

  const active = app.state === 'calib' || app.state === 'session';
  if (active) updateSession(dt);
  else if (app.state === 'sleeping') updateSleep();
  const before = breath.cycles;
  const switched = stepBreath(breath, dt);
  if (switched?.first) msg(BREATHS[switched.key].hint, Math.max(5200, BREATHS[switched.key].hint.length * 55));
  const rounds = breath.key && BREATHS[breath.key].rounds;
  if (rounds && breath.cycles !== before && breath.cycles % rounds === 0) msg(`${rounds} rondes gedaan. Adem rustig verder, of ga nog een keer door.`, 5000);

  drawFrame(dt);
  updateHud(dt);

  const rel = app.state === 'session' && app.baseline != null && app.hrS != null ? app.hrS - app.baseline : 0;
  audio.tick(app.time, app.calmVis, app.hrS, active, rel);
  const step = breath.on ? currentStep(breath) : null;
  const speed = Math.abs(breath.level - lastLevel) / Math.max(dt, 1e-3);
  lastLevel = breath.level;
  audio.setBreath(breath.level, step ? step[0] : '', breath.on ? breath.vis : 0, speed);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Debug handle for the browser console and automated checks.
window.stilWater = { app, breath, BREATHS, morning: visitors };
