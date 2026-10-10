// Draws one frame: the active profile's scene, the optional effects (Beeld menu), a vignette,
// the sleep dimming and the breathing guide.

import { app, breath, profile } from '../state.js';
import { drawBreath } from './breath-overlay.js';
import { ctx, view } from './context.js';
import { beginBreathe, drawBackEffects, drawFrontEffects, endBreathe } from './effects.js';
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

// The breathing guide must fit between the message band at the top (#msg) and the breathing
// controls at the bottom (#breathBar), whatever the screen size or safe-area insets. Its label sits
// above the ring and the coherence line below it; when space is tight the ring shrinks.
let bandTop = 0, bandBottom = Infinity, layoutCheck = 0;
function fitGuide([cx, cy, R]) {
  if (--layoutCheck <= 0) {
    layoutCheck = 30;
    const msgEl = document.getElementById('msg'), bar = document.getElementById('breathBar');
    bandTop = msgEl ? msgEl.getBoundingClientRect().top + 84 : 0; // room for up to three lines of message
    bandBottom = bar && !bar.hidden ? bar.getBoundingClientRect().top - 10 : view.H - 110;
  }
  const above = (r) => r * 1.35 + 40; // outer ring + label (box guide reaches a little higher)
  const below = (r) => r * 1.35 + 32; // outer ring + coherence line
  const space = bandBottom - bandTop;
  if (above(R) + below(R) > space) R = Math.max(34, (space - 72) / 2.7);
  const minY = bandTop + above(R), maxY = bandBottom - below(R);
  cy = minY > maxY ? (minY + maxY) / 2 : Math.min(Math.max(cy, minY), maxY);
  return [cx, cy, R];
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
  const f = scene().focus();
  const zoomed = beginBreathe(f);
  scene().draw({
    dt,
    time: app.time,
    calm: app.calmVis,
    progress: app.progVis,
    variant: P.variant,
    breathLevel: breath.level * breath.vis,
  });
  drawBackEffects(dt, f, P.scene);
  endBreathe(zoomed);
  const guide = fitGuide(scene().anchor());
  drawFrontEffects(dt, f, guide);

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

  drawBreath(breath, guide, P.accent, app.coherence);
}
