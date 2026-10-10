// The "Beeld" menu: one switch per visual effect, remembered in local storage.
// Effects tied to certain scenes say so, and are dimmed when the current profile uses another scene.

import { EFFECTS, appliesTo, fx, setEffect } from '../render/effects.js';
import { profile } from '../state.js';
import { $ } from './dom.js';

const SCENE_NAMES = { lake: 'meer', dawn: 'dageraad', candle: 'kaars', campfire: 'kampvuur' };

export function initFxMenu() {
  const list = $('fxList');
  for (const e of EFFECTS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'switch';
    b.setAttribute('role', 'switch');
    b.dataset.fx = e.key;
    const where = e.scenes ? ` · alleen bij ${e.scenes.map((s) => SCENE_NAMES[s]).join(' en ')}` : '';
    b.innerHTML = `<span class="track"></span><span class="txt"><span></span><small></small></span>`;
    b.querySelector('.txt > span').textContent = e.name;
    b.querySelector('small').textContent = e.desc + where;
    b.setAttribute('aria-checked', String(fx[e.key]));
    b.addEventListener('click', () => {
      setEffect(e.key, !fx[e.key]);
      b.setAttribute('aria-checked', String(fx[e.key]));
    });
    list.append(b);
  }
}

/** Dim effects that do not apply to the current scene; called when the panel opens. */
export function refreshFxMenu() {
  const scene = profile().scene;
  for (const b of $('fxList').children) {
    const e = EFFECTS.find((x) => x.key === b.dataset.fx);
    if (appliesTo(e, scene)) delete b.dataset.offScene;
    else b.dataset.offScene = '';
  }
}
