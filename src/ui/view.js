// How the screen behaves around the scene:
//  - controls fade out after 5 seconds without mouse, touch or keyboard during a session, so only the
//    scene and the breathing guide remain; any movement brings them back,
//  - "Ogen dicht": a soft bell at every inhale and exhale, a clearer breath sound and a dimmed screen,
//  - keyboard shortcuts on a laptop: space = breathing on/off, O = eyes closed, M = mute, F = full screen.

import { audio } from '../audio/engine.js';
import { BREATHS } from '../config/breathing.js';
import { currentStep } from '../core/breathing.js';
import { store } from '../core/storage.js';
import { app, breath } from '../state.js';
import { $ } from './dom.js';
import { msg } from './messages.js';

const IDLE_AFTER = 5000;
let idleTimer = 0, eyes = store.get('eyes', false), muted = false;

const inSession = () => ['calib', 'session', 'reso'].includes(app.state);
const overControls = () => document.querySelector('.hud:hover, .breath:hover, .sim:hover, .panel:hover, .readout:hover');

function scheduleIdle() {
  clearTimeout(idleTimer);
  document.body.classList.remove('idle');
  idleTimer = setTimeout(function check() {
    if (!inSession() || !$('settings').hidden || overControls() || document.activeElement?.matches('select, input')) {
      idleTimer = setTimeout(check, 1000);
      return;
    }
    document.body.classList.add('idle');
  }, IDLE_AFTER);
}

export const eyesClosed = () => eyes;

export function setEyes(on, announce = false) {
  eyes = !!on;
  store.set('eyes', eyes);
  document.body.classList.toggle('eyes', eyes);
  $('eyes').setAttribute('aria-checked', String(eyes));
  audio.setEyes(eyes);
  if (announce) msg(eyes ? 'Ogen dicht. Volg het klokje: hoog is in, laag is uit.' : 'Ogen open.', 3200);
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}

function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey || e.target.matches?.('input, select, textarea')) return;
  const k = e.key.toLowerCase();
  if (k === ' ' && inSession() && !$('breathBar').hidden) {
    e.preventDefault();
    $('bSwitch').click();
  } else if (k === 'o') setEyes(!eyes, true);
  else if (k === 'm') {
    muted = !muted;
    audio.setMuted(muted);
    msg(muted ? 'Geluid gedempt. Druk op M om het terug te zetten.' : 'Geluid aan.', 2400);
  } else if (k === 'f') toggleFullscreen();
}

// Ogen dicht: a bell when the breath turns, higher for in, lower for out. Holds stay silent, and
// several short "in" steps in a row (Trappetjes) ring once. Vuurademhaling's quick pumps get none.
let lastCat = null, lastKey = null;
export function updateCues() {
  const st = eyes && breath.on && breath.key ? currentStep(breath) : null;
  if (!st || BREATHS[breath.key].pumps) { lastCat = null; lastKey = null; return; }
  const cat = st[0].startsWith('in') ? 'in' : st[0].startsWith('out') ? 'out' : null;
  if (!cat || cat === lastCat) return;
  const fresh = lastKey !== breath.key;
  lastCat = cat; lastKey = breath.key;
  if (!fresh || breath.t < 0.3) audio.cue(cat);
}

export function initView() {
  for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(ev, scheduleIdle, { passive: true });
  addEventListener('keydown', onKey);
  $('eyes').addEventListener('click', () => setEyes(!eyes));
  if (!document.fullscreenEnabled) $('keys').textContent = 'spatie ademhaling · O ogen dicht · M dempen';
  setEyes(eyes);
  scheduleIdle();
}
