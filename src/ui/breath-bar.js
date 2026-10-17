// The breathing switch and technique chips at the bottom of the screen.
// Off by default every session; the last technique per profile is remembered.

import { BREATHS } from '../config/breathing.js';
import { BREATH_GROUPS, breathLabel } from '../config/free.js';
import { selectBreath, startBreath } from '../core/breathing.js';
import { store } from '../core/storage.js';
import { app, breath, profile } from '../state.js';
import { $, pressOnly } from './dom.js';
import { msg } from './messages.js';

const prefKey = () => 'breath.' + app.profKey;

/** The techniques on offer: "Jouw tempo" (after the resonance test) first, then the profile's own. */
const offered = () => (BREATHS.mine ? ['mine', ...profile().breaths] : profile().breaths);

function preferred() {
  const k = store.get(prefKey(), null);
  return offered().includes(k) ? k : offered()[0];
}

/** Start a technique and show its instruction the first time it is used. */
export function beginTechnique(key) {
  if (startBreath(breath, key)) msg(BREATHS[key].hint, Math.max(5200, BREATHS[key].hint.length * 55));
}

export function buildChips() {
  const box = $('bChips');
  box.innerHTML = '';
  const selected = breath.pending || breath.key || preferred();
  // Vrij offers every technique, grouped; the profiles offer their own three.
  const mine = BREATHS.mine ? ['mine'] : [];
  const groups = profile().free
    ? BREATH_GROUPS.map((g, i) => (i === 0 ? { ...g, keys: [...mine, ...g.keys] } : g))
    : [{ name: null, keys: offered() }];
  box.classList.toggle('grouped', !!profile().free);
  if (profile().free && innerWidth < 600) {
    // Small screens: thirteen buttons would bury the guide, so one grouped dropdown instead.
    const sel = document.createElement('select');
    sel.className = 'bsel';
    sel.setAttribute('aria-label', 'Ademhalingsoefening');
    for (const g of BREATH_GROUPS) {
      const og = document.createElement('optgroup');
      og.label = g.name;
      (g.name === BREATH_GROUPS[0].name ? [...mine, ...g.keys] : g.keys).forEach((k) => og.append(new Option(k === 'mine' ? BREATHS.mine.name : breathLabel(k), k, false, k === selected)));
      sel.append(og);
    }
    sel.addEventListener('change', () => {
      store.set(prefKey(), sel.value);
      if (selectBreath(breath, sel.value) === 'queued') msg('Wisselt na deze ademhaling.', 2200);
    });
    box.appendChild(sel);
    return;
  }
  for (const g of groups) {
    // Vrij: one row per group, with its name in front.
    let row = box;
    if (g.name) {
      row = document.createElement('div');
      row.className = 'grp-row';
      const l = document.createElement('span');
      l.className = 'grp';
      l.textContent = g.name;
      row.appendChild(l);
      box.appendChild(row);
    }
    for (const key of g.keys) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = key === 'mine' || !profile().free ? BREATHS[key].name : breathLabel(key);
      b.dataset.k = key;
      b.setAttribute('aria-pressed', String(key === selected));
      b.addEventListener('click', () => {
        store.set(prefKey(), key);
        pressOnly([...box.querySelectorAll('button')], b);
        if (selectBreath(breath, key) === 'queued') msg('Wisselt na deze ademhaling.', 2200);
      });
      row.appendChild(b);
    }
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
      const dd = $('bChips').querySelector('select');
      beginTechnique(dd ? dd.value : sel ? sel.dataset.k : preferred());
    }
  });
}
