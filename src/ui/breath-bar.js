// The breathing switch and technique chips at the bottom of the screen.
// Off by default every session; the last technique per profile is remembered.

import { BREATHS } from '../config/breathing.js';
import { selectBreath, startBreath } from '../core/breathing.js';
import { store } from '../core/storage.js';
import { app, breath, profile } from '../state.js';
import { $, pressOnly } from './dom.js';
import { msg } from './messages.js';

const prefKey = () => 'breath.' + app.profKey;

function preferred() {
  const k = store.get(prefKey(), null);
  return profile().breaths.includes(k) ? k : profile().breaths[0];
}

/** Start a technique and show its instruction the first time it is used. */
export function beginTechnique(key) {
  if (startBreath(breath, key)) msg(BREATHS[key].hint, 5200);
}

export function buildChips() {
  const box = $('bChips');
  box.innerHTML = '';
  const selected = breath.pending || breath.key || preferred();
  for (const key of profile().breaths) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = BREATHS[key].name;
    b.dataset.k = key;
    b.setAttribute('aria-pressed', String(key === selected));
    b.addEventListener('click', () => {
      store.set(prefKey(), key);
      pressOnly([...box.children], b);
      if (selectBreath(breath, key) === 'queued') msg('Wisselt na deze ademhaling.', 2200);
    });
    box.appendChild(b);
  }
}

export function resetBreathBar() {
  breath.on = false;
  breath.key = null;
  breath.pending = null;
  $('bSwitch').setAttribute('aria-checked', 'false');
  $('bChips').hidden = true;
  buildChips();
}

export function initBreathBar() {
  $('bSwitch').addEventListener('click', (e) => {
    breath.on = !breath.on;
    e.currentTarget.setAttribute('aria-checked', String(breath.on));
    $('bChips').hidden = !breath.on;
    if (breath.on) {
      const sel = $('bChips').querySelector('[aria-pressed="true"]');
      beginTechnique(sel ? sel.dataset.k : preferred());
    }
  });
}
