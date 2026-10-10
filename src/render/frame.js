// Draws one frame: the active profile's scene, a vignette, the sleep dimming and the breathing guide.

import { app, breath, profile } from '../state.js';
import { drawBreath } from './breath-overlay.js';
import { ctx, view } from './context.js';
import * as campfire from './scenes/campfire.js';
import * as candle from './scenes/candle.js';
import * as dawn from './scenes/dawn.js';
import * as lake from './scenes/lake.js';

const SCENES = { lake, dawn, candle, campfire };
const scene = () => SCENES[profile().scene];

/** Reset all scenes so a new session starts from darkness / unlit lanterns. */
export function resetScenes() {
  Object.values(SCENES).forEach((s) => s.reset());
}

/** Progress step `i` (0-based) was reached in the current scene. */
export function progressStep(i) {
  scene().progress(i);
}

// Messages appear in a fixed band near the top (#msg). Keep the breathing guide's label below that band
// so the two never overlap, whatever the screen height or safe-area insets are.
let msgBandBottom = 0, msgCheck = 0;
function clearOfMessages([cx, cy, R]) {
  if (--msgCheck <= 0) {
    msgCheck = 60;
    const el = document.getElementById('msg');
    if (el) msgBandBottom = el.getBoundingClientRect().top + 84; // room for up to three lines
  }
  const labelTop = cy - R * 1.15 - 22 - 16 - R * 0.2; // label sits above the outer ring (box guide a bit higher)
  return labelTop < msgBandBottom ? [cx, cy + (msgBandBottom - labelTop), R] : [cx, cy, R];
}

export function drawFrame(dt) {
  const { W, H } = view;
  const P = profile();
  // Fully black in sleep mode: stop drawing the scene to save power.
  if (app.state === 'sleeping' && app.sleepDim >= 0.999) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    return;
  }
  scene().draw({
    dt,
    time: app.time,
    calm: app.calmVis,
    progress: app.progVis,
    variant: P.variant,
    breathLevel: breath.level * breath.vis,
  });

  const vg = ctx.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.3, W / 2, H * 0.55, Math.max(W, H) * 0.8);
  vg.addColorStop(0, 'rgba(2,4,10,0)');
  vg.addColorStop(1, `rgba(2,4,10,${0.6 - 0.25 * app.calmVis})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  if (P.fadeOut) {
    const d = app.progVis * 0.35 + app.sleepDim;
    if (d > 0.01) {
      ctx.fillStyle = `rgba(0,0,4,${Math.min(app.state === 'sleeping' ? 1 : 0.8, d)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  drawBreath(breath, clearOfMessages(scene().anchor()), P.accent, app.coherence);
}
