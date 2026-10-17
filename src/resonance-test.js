// The resonance test as a guided flow: an intro card (Kort or Grondig), a bare screen with only the
// breathing guide that walks through six rates, and a result card with a bar per rate. The chosen
// rate is remembered as a single setting (not as history) and becomes the breathing technique
// "Jouw tempo" in every profile.

import { track } from './analytics.js';
import { audio } from './audio/engine.js';
import { BREATHS } from './config/breathing.js';
import { startBreath } from './core/breathing.js';
import { smoothing } from './core/math.js';
import { analyse, best, PLANS, RATES, stepAt, techniqueFor } from './core/resonance.js';
import { store } from './core/storage.js';
import { connectHeartRate } from './heart-rate/bluetooth.js';
import { startSimulator } from './heart-rate/simulator.js';
import { app, breath, profile, sessionClock } from './state.js';
import { buildChips } from './ui/breath-bar.js';
import { $, $$, nl, pressOnly } from './ui/dom.js';
import { msg } from './ui/messages.js';
import { setStatus } from './ui/status.js';

/** A rate as text: 5,5 but 6 (not 6,0). */
const fr = (r) => (r % 1 ? nl(r) : String(r));
const NO_RR_AFTER = 25; // seconds without beat-to-beat data → this is a watch, not a chest strap
let plan = PLANS[store.get('resoPlan', 'kort')] ? PLANS[store.get('resoPlan', 'kort')] : PLANS.kort;
let planKey = PLANS[store.get('resoPlan', 'kort')] ? store.get('resoPlan', 'kort') : 'kort';
let stepIndex = -1, breathTimer = 0, found = null;

/** Register "Jouw tempo" as a breathing technique if a rate has been saved. */
export function registerMine() {
  const rate = store.get('resoRate', null);
  if (rate) BREATHS.mine = techniqueFor(rate, 'Jouw tempo', `${fr(rate)} keer per minuut: jouw eigen tempo uit de resonantietest. Rustig en ontspannen, niet forceren.`);
  else delete BREATHS.mine;
  return rate;
}

function show(id) {
  ['intro', 'reso', 'resoResult'].forEach((x) => $(x).classList.toggle('gone', x !== id));
}

function open() {
  show('reso');
  $('resoNote').textContent = 'Zit rechtop, adem rustig door je neus en volg alleen de cirkel. Niet forceren: als het tempo te traag voelt, adem dan zachter.';
  const rate = store.get('resoRate', null);
  $('resoPrev').textContent = rate ? `Je vorige uitslag: ${fr(rate)} per minuut.` : '';
}

function begin() {
  ['readout', 'stop'].forEach((x) => ($(x).hidden = false));
  $('breathBar').hidden = true;
  show(null);
  Object.assign(app, { samples: [], hrS: null, hasRR: false, rr: [], beats: [], breathLog: [], beatClock: 0, baseline: null, calm: 0.6, coherence: null });
  app.state = 'reso';
  app.t0 = performance.now();
  stepIndex = -1;
  audio.setCarrierHz(null);
  audio.setStyle(profile().style);
  audio.fade(0.55, 2); // quieter than a session: the guide matters here, not the music
  audio.start();
  breath.on = true;
  track(`resonantie/start/${planKey}/${app.source === 'sim' ? 'test' : 'hartslagmeter'}`);
}

/** Called every frame while the test runs. */
export function updateReso(dt) {
  if (app.latestHr != null) app.hrS = app.hrS == null ? app.latestHr : app.hrS + (app.latestHr - app.hrS) * smoothing(dt, 6);
  const t = sessionClock(), s = stepAt(plan, t);
  // The live heart wave needs the breathing level.
  if ((breathTimer -= dt) <= 0) { breathTimer = 0.1; app.breathLog.push({ t, v: breath.level }); if (app.breathLog.length > 1500) app.breathLog.splice(0, 300); }
  if (t > NO_RR_AFTER && !app.hasRR) return fail('Ik ontvang geen tijd tussen hartslagen. Deze test werkt alleen met een borstband zoals de HRM 200: een horloge stuurt die niet door.');
  if (s.done) return finish();
  if (s.index !== stepIndex) {
    stepIndex = s.index;
    BREATHS.resoTest = techniqueFor(s.rate);
    startBreath(breath, 'resoTest');
    msg(stepIndex === 0 ? `We beginnen met ${fr(s.rate)} keer per minuut. Volg de cirkel.` : `Nu ${fr(s.rate)} keer per minuut.`, 4000);
  }
  const mm = Math.floor(s.left / 60), ss = String(Math.floor(s.left % 60)).padStart(2, '0');
  app.resoLabel = `Tempo ${s.index + 1} van ${RATES.length} · ${fr(s.rate)} per minuut · ${mm}:${ss}`;
}

function stopRun() {
  breath.on = false;
  breath.key = null;
  app.state = 'done';
  app.resoLabel = '';
  audio.fade(0, 3);
  ['readout', 'stop', 'sim'].forEach((x) => ($(x).hidden = true));
}

function fail(text) {
  stopRun();
  open();
  $('resoNote').textContent = text;
}

/** Stop pressed during the test. */
export function abortReso() {
  stopRun();
  track('resonantie/gestopt');
  show('intro');
  app.state = 'intro';
}

function finish() {
  const results = analyse(app.beats, plan);
  found = best(results);
  stopRun();
  if (!found) return fail('Er waren te weinig bruikbare hartslagen om iets te zeggen. Zit de borstband goed en zijn de elektroden nat? Probeer het nog eens.');
  track(`resonantie/klaar/${planKey}`);
  const max = Math.max(...results.map((r) => r.amp || 0));
  $('rBars').innerHTML = results.map((r) => {
    const h = r.amp ? Math.max(6, (r.amp / max) * 100) : 4;
    return `<div class="bar${r === found ? ' best' : ''}"><i style="height:${h}%"></i><b>${r.amp ? nl(r.amp) : '–'}</b><span>${fr(r.rate)}</span></div>`;
  }).join('');
  $('rBest').textContent = fr(found.rate);
  const second = results.filter((r) => r.amp != null && r !== found).sort((a, b) => b.amp - a.amp)[0];
  const close = second && second.amp > found.amp * 0.9;
  $('rText').textContent = `Bij ${fr(found.rate)} keer per minuut ging je hartslag per ademhaling gemiddeld ${nl(found.amp)} slagen op en neer, meer dan bij de andere tempo's.` +
    (close ? ` ${fr(second.rate)} per minuut zat er dichtbij; beide zijn goed.` : '') +
    (planKey === 'kort' ? ' De grondige test geeft een betrouwbaarder beeld.' : '');
  $('rUse').textContent = store.get('resoRate', null) === found.rate ? 'Dit is al jouw tempo' : 'Gebruik dit tempo';
  show('resoResult');
}

export function initResonance() {
  registerMine();
  $('resoOpen').addEventListener('click', open);
  const planBtns = $$('#resoPlan button');
  planBtns.forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.plan === planKey));
    b.addEventListener('click', () => {
      planKey = b.dataset.plan; plan = PLANS[planKey];
      store.set('resoPlan', planKey);
      pressOnly(planBtns, b);
    });
  });
  $('resoGo').addEventListener('click', () => {
    audio.unlock();
    connectHeartRate(() => { app.source = 'ble'; begin(); }, 'resoNote');
  });
  $('resoSim').addEventListener('click', () => {
    audio.unlock();
    startSimulator();
    begin();
  });
  const back = () => { show('intro'); app.state = 'intro'; app.source = null; setStatus('', 'Niet verbonden'); };
  $('resoBack').addEventListener('click', back);
  $('rBack').addEventListener('click', back);
  $('rAgain').addEventListener('click', open);
  $('rUse').addEventListener('click', () => {
    store.set('resoRate', found.rate);
    registerMine();
    buildChips();
    $('rUse').textContent = 'Opgeslagen: "Jouw tempo" staat nu bij de ademhaling';
  });
}
