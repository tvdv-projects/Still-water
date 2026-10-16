// Wires up every button: profile and duration on the intro card, connect / test,
// stop (two taps), the sound panel and the binaural toggle.

import { track } from '../analytics.js';
import { audio } from '../audio/engine.js';
import { store } from '../core/storage.js';
import { connectHeartRate } from '../heart-rate/bluetooth.js';
import { startSimulator } from '../heart-rate/simulator.js';
import { resetScenes } from '../render/frame.js';
import { begin, finish, toIntro, wake } from '../session.js';
import { bandName, LOOKS, MUSIC } from '../config/free.js';
import { app, profile, setFree } from '../state.js';
import { CALIB_SECONDS } from '../core/scoring.js';
import { buildChips } from './breath-bar.js';
import { $, $$, pressOnly } from './dom.js';
import { initFxMenu, refreshFxMenu } from './fx-menu.js';
import { setStatus } from './status.js';

function showProfile() {
  const free = app.profKey === 'vrij';
  $('profDesc').textContent = profile().desc;
  $$('#profs button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.p === app.profKey)));
  $('freeOpts').hidden = !free;
  $('durFree').hidden = !free;
  $('freeGo').hidden = !free;
  // "Onbeperkt" only exists in Vrij: the profiles pace their progress over the chosen duration.
  if (!free && app.durMin === 0) { app.durMin = 10; store.set('dur', 10); }
  $$('#durs button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.min === app.durMin)));
  if (free) showFree();
  audio.setCarrierHz(free ? app.free.carrier : null);
  audio.setStyle(profile().style);
  resetScenes();
  buildChips();
}

const hzText = (v) => `${String(v).replace('.', ',')} Hz`;

/** Reflect the free settings in the Vrij panel. */
function showFree() {
  const f = app.free;
  $('fLook').value = f.look;
  $('fMusic').value = f.music;
  $$('#fMode button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === f.mode)));
  $('fFixed').hidden = f.mode !== 'fixed';
  $('fRamp').hidden = f.mode !== 'ramp';
  $('fBeat').value = f.beat; $('fBeatOut').textContent = `${hzText(f.beat)} · ${bandName(f.beat)}`;
  $('fFrom').value = f.from; $('fFromOut').textContent = `van ${hzText(f.from)} · ${bandName(f.from).split(' ·')[0]}`;
  $('fTo').value = f.to; $('fToOut').textContent = `naar ${hzText(f.to)} · ${bandName(f.to).split(' ·')[0]}`;
  const auto = f.carrier == null;
  $('fCarrierAuto').setAttribute('aria-pressed', String(auto));
  if (!auto) $('fCarrier').value = f.carrier;
  $('fCarrier').style.opacity = auto ? 0.45 : 1;
  $('fCarrierOut').textContent = auto ? 'bij de muziek' : `${f.carrier} Hz${f.carrier < 140 ? ' · warm' : f.carrier > 260 ? ' · helder' : ''}`;
}

function initFree() {
  const fill = (sel, list) => list.forEach(({ key, name }) => sel.append(new Option(name, key)));
  fill($('fLook'), LOOKS);
  fill($('fMusic'), MUSIC);
  const apply = (patch, rescene) => {
    setFree(patch);
    showFree();
    if (rescene) { resetScenes(); audio.setStyle(profile().style); }
    audio.setCarrierHz(app.free.carrier);
  };
  $('fLook').addEventListener('change', (e) => apply({ look: e.target.value }, true));
  $('fMusic').addEventListener('change', (e) => apply({ music: e.target.value }, true));
  $$('#fMode button').forEach((b) => b.addEventListener('click', () => apply({ mode: b.dataset.mode })));
  for (const [id, key] of [['fBeat', 'beat'], ['fFrom', 'from'], ['fTo', 'to']]) {
    $(id).addEventListener('input', (e) => apply({ [key]: +e.target.value }));
  }
  $('fCarrier').addEventListener('input', (e) => apply({ carrier: +e.target.value }));
  $('fCarrierAuto').addEventListener('click', () => apply({ carrier: app.free.carrier == null ? +$('fCarrier').value || 150 : null }));
}

/** Vrij is about the binaural beat you chose, so starting it switches binaural on. */
function binauralForFree() {
  if (app.profKey !== 'vrij' || audio.binOn) return;
  audio.setBin(true);
  store.set('bin', true);
  document.dispatchEvent(new Event('stilwater:bin'));
}

function initIntro() {
  initFree();
  $$('#profs button').forEach((b) =>
    b.addEventListener('click', () => {
      app.profKey = b.dataset.p;
      store.set('prof', app.profKey);
      showProfile();
    }),
  );
  const durs = $$('#durs button');
  durs.forEach((b) => {
    b.setAttribute('aria-pressed', String(+b.dataset.min === app.durMin));
    b.addEventListener('click', () => {
      app.durMin = +b.dataset.min;
      store.set('dur', app.durMin);
      pressOnly(durs, b);
    });
  });
  // Audio must be unlocked synchronously inside the tap, before any await.
  $('connect').addEventListener('click', () => {
    audio.unlock();
    binauralForFree();
    connectHeartRate(() => { app.source = 'ble'; begin(); });
  });
  $('test').addEventListener('click', () => {
    audio.unlock();
    binauralForFree();
    startSimulator();
    begin();
  });
  $('freeGo').addEventListener('click', () => {
    audio.unlock();
    binauralForFree();
    app.source = 'none';
    setStatus('', 'Zonder hartslagmeter');
    begin();
  });
  $('again').addEventListener('click', toIntro);
  showProfile();
}

function initStop() {
  let armed = 0;
  $('stop').addEventListener('click', (e) => {
    e.currentTarget.blur();
    if (performance.now() - armed > 3000) {
      armed = performance.now();
      $('stop').textContent = 'Tik nog eens om te stoppen';
      setTimeout(() => { if (performance.now() - armed >= 3000) $('stop').textContent = 'Stop'; }, 3100);
      return;
    }
    armed = 0;
    $('stop').textContent = 'Stop';
    if (app.state === 'session' && (profile().free || app.samples.some((s) => s.t > CALIB_SECONDS))) finish(true);
    else { track(`einde/${app.profKey}/gestopt-tijdens-rustmeting`); audio.fade(0, 3); toIntro(); }
  });
}

function initSoundPanel() {
  const setBinButton = () => {
    $('bin').textContent = audio.binOn ? 'Binaural uit' : 'Binaural aan';
    $('bin').setAttribute('aria-pressed', String(audio.binOn));
  };
  audio.setBin(store.get('bin', false));
  setBinButton();
  document.addEventListener('stilwater:bin', setBinButton);
  $('bin').addEventListener('click', (e) => {
    e.currentTarget.blur();
    audio.setBin(!audio.binOn);
    store.set('bin', audio.binOn);
    setBinButton();
    if (audio.binOn && !audio.on && app.state !== 'intro') audio.start();
  });
  // Tempo of the focus and energy music: fixed, or following the heart rate.
  const setTempoButton = (v) => {
    $('tempo').textContent = v ? 'Tempo: volgt hartslag' : 'Tempo: vast';
    $('tempo').setAttribute('aria-pressed', String(v));
  };
  let tempoHr = store.get('tempoHr', false);
  audio.setTempoFollow(tempoHr);
  setTempoButton(tempoHr);
  $('tempo').addEventListener('click', (e) => {
    e.currentTarget.blur();
    tempoHr = !tempoHr;
    store.set('tempoHr', tempoHr);
    audio.setTempoFollow(tempoHr);
    setTempoButton(tempoHr);
  });
  $('snd').addEventListener('click', (e) => {
    const panel = $('mix');
    panel.hidden = !panel.hidden;
    e.currentTarget.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) closePanel('fxPanel', 'vis');
    if (!audio.on && app.state !== 'intro') audio.start();
  });
  initFxMenu();
  $('vis').addEventListener('click', (e) => {
    const panel = $('fxPanel');
    panel.hidden = !panel.hidden;
    e.currentTarget.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) { refreshFxMenu(); closePanel('mix', 'snd'); }
  });
  const sliders = { vMusic: 'music', vNature: 'nature', vPulse: 'pulse', vBreath: 'breath' };
  const saved = store.get('mix', {});
  for (const [id, key] of Object.entries(sliders)) {
    const el = $(id);
    if (saved[key] != null) el.value = Math.round(saved[key] * 100);
    audio.setMix(key, el.value / 100);
    el.addEventListener('input', () => {
      audio.setMix(key, el.value / 100);
      saved[key] = el.value / 100;
      store.set('mix', saved);
    });
  }
  $('c').addEventListener('pointerdown', () => {
    if (app.state === 'sleeping') wake();
    closePanel('mix', 'snd');
    closePanel('fxPanel', 'vis');
  });
}

function closePanel(id, buttonId) {
  $(id).hidden = true;
  $(buttonId).setAttribute('aria-expanded', 'false');
}

function initAudioLifecycle() {
  // iOS can suspend audio; any tap brings it back. Pause sound while the tab is hidden.
  addEventListener('pointerdown', () => { const ac = audio.context; if (audio.on && ac && ac.state !== 'running') audio.unlock(); }, true);
  document.addEventListener('visibilitychange', () => {
    const ac = audio.context;
    if (!ac) return;
    if (document.hidden) ac.suspend();
    else if (audio.on) ac.resume();
  });
}

export function initControls() {
  initIntro();
  initStop();
  initSoundPanel();
  initAudioLifecycle();
}
