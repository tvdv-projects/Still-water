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

export function drawFrame(dt) {
  const { W, H } = view;
  const P = profile();
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
      ctx.fillStyle = `rgba(0,0,4,${Math.min(0.8, d)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  drawBreath(breath, scene().anchor(), P.accent);
}
