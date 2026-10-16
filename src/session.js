// Session lifecycle: intro → calibration (60 s) → session → summary
// (Slaap: → sleeping, a black screen with fading sound, until you tap → summary).
//
// During calibration the binaural beat follows the live heart rate, and the average
// of seconds 15–60 becomes the baseline. During the session the profile's scoring
// (drop, steady or rise) turns the heart rate into calm, progress points and the speed at
// which the beat is led from its starting frequency to the profile's target.

import { track } from './analytics.js';
import { audio } from './audio/engine.js';
import { beatFor, LOOKS } from './config/free.js';
import { PROFILES } from './config/profiles.js';
import { cleanRR, coherence, rmssd } from './core/hrv.js';
import { clamp, lerp, smoothing } from './core/math.js';
import { beatAt, CALIB_SECONDS, dropScore, needPerStep, riseScore, stdDev, steadyScore, STEPS, summarize } from './core/scoring.js';
import { store } from './core/storage.js';
import { progressStep, resetScenes } from './render/frame.js';
import { app, breath, profile, sessionClock } from './state.js';
import { resetBreathBar } from './ui/breath-bar.js';
import { $, nl } from './ui/dom.js';
import { msg } from './ui/messages.js';
import { CONNECT_NOTE, setStatus } from './ui/status.js';

let sdTimer = 0, hrvTimer = 0, breathTimer = 0, sleepT0 = 0, rrAnnounced = false;

function resetProgress() {
  Object.assign(app, {
    samples: [], baseline: null, hrS: null, points: 0, litCount: 0, progVis: 0,
    beatP: 0, fading: false, sleepDim: 0, tenseSince: null, lastNudge: -999, stability: 0.5, sd: 0,
    hasRR: false, rr: [], beats: [], breathLog: [], beatClock: 0, rmssd: null, rmssdBase: null, coherence: null, coherenceLog: [],
  });
  rrAnnounced = false;
  document.body.classList.remove('sleeping');
  resetScenes();
  resetBreathBar();
}

export function begin() {
  $('intro').classList.add('gone');
  $('readout').hidden = false;
  $('breathBar').hidden = false;
  $('stop').hidden = false;
  resetProgress();
  const P = profile();
  // Vrij has no calibration minute: it starts straight away (with a heart-rate monitor the starting
  // rate is measured in the background during the first half minute).
  app.state = P.free ? 'session' : 'calib';
  app.t0 = performance.now();
  if (P.free) {
    audio.setCarrierHz(app.free.carrier);
    app.beatNow = beatFor(app.free, 0, app.durMin);
    audio.setBeat(app.beatNow);
    $('readout').hidden = app.source === 'none';
  } else audio.setCarrierHz(null);
  audio.setStyle(P.style);
  audio.fade(0.9, 2);
  audio.start();
  try { navigator.wakeLock?.request('screen').catch(() => {}); } catch { /* not supported */ }
  msg(P.free ? 'Vrij. Neem de tijd.' : 'Ga gemakkelijk zitten. Ik meet eerst een minuut hoe je nu bent.', P.free ? 4000 : 6000);
  const src = app.source === 'sim' ? 'test' : app.source === 'none' ? 'zonder-meter' : 'hartslagmeter';
  track(`start/${app.profKey}/${src}`);
}

export function toIntro() {
  $('summary').classList.add('gone');
  $('intro').classList.remove('gone');
  ['readout', 'sim', 'stop', 'breathBar'].forEach((id) => ($(id).hidden = true));
  app.state = 'intro';
  app.source = null;
  setStatus('', 'Niet verbonden');
  resetProgress();
  $('connNote').innerHTML = CONNECT_NOTE;
}

export function finish(early = false) {
  $('stop').hidden = true;
  $('breathBar').hidden = true;
  breath.on = false;
  const P = profile();
  buildSummary(P);
  const src = app.source === 'sim' ? 'test' : app.source === 'none' ? 'zonder-meter' : app.hasRR ? 'borstband' : 'horloge';
  track(`einde/${app.profKey}/${early ? 'gestopt' : 'afgemaakt'}/${src}`);
  if (P.fadeOut && !early) {
    // Slaap: no summary popping up. The screen fades to black and the sound dies away over 15 minutes.
    app.state = 'sleeping';
    sleepT0 = performance.now();
    document.body.classList.add('sleeping');
    audio.fade(0, 900);
    return;
  }
  app.state = 'done';
  audio.fade(0, early ? 4 : 20);
  $('summary').classList.remove('gone');
  if (!P.fadeOut && !early) audio.bloom();
}

/** Tap during sleep mode: back to a normal screen with the summary. */
export function wake() {
  if (app.state !== 'sleeping') return;
  app.state = 'done';
  document.body.classList.remove('sleeping');
  audio.fade(0, 3);
  $('summary').classList.remove('gone');
}

/** Called every frame in sleep mode: dim to fully black over one minute. */
export function updateSleep() {
  app.sleepDim = Math.min(1, 0.45 + ((performance.now() - sleepT0) / 60000) * 0.55);
}

function buildFreeSummary(P) {
  const t = sessionClock(), mins = Math.max(1, Math.round(t / 60));
  const look = LOOKS.find((l) => l.key === P.look)?.name ?? '';
  const beat = app.free.mode === 'ramp' ? `${nl(app.free.from)} → ${nl(app.free.to)} Hz` : `${nl(app.free.beat)} Hz`;
  $('sTitle').textContent = 'Vrij';
  const hasHr = app.baseline != null && app.samples.length > 3;
  const s = hasHr ? summarize(app.samples, app.baseline, t) : null;
  $('sBase').textContent = hasHr ? Math.round(app.baseline) : '--';
  $('sEnd').textContent = hasHr ? Math.round(s.end) : '--';
  $('sDropL').textContent = 'Verschil';
  $('sDrop').textContent = hasHr ? (s.drop >= 0 ? '−' : '+') + nl(Math.abs(s.drop)) : '--';
  $('sMinL').textContent = 'Laagste';
  $('sMin').textContent = hasHr && s.min != null ? Math.round(s.min) : '--';
  $('sLamps').textContent = `${mins} ${mins === 1 ? 'minuut' : 'minuten'} · ${look} · binaural ${beat}` + (hasHr ? '' : ' · zonder hartslagmeter');
  $('sHist').innerHTML = '';
  const coh = app.coherenceLog.length ? app.coherenceLog.reduce((a, b) => a + b, 0) / app.coherenceLog.length : null;
  const hrvEnd = rmssd(cleanRR(app.rr.filter((r) => r.t > t - 120).map((r) => r.ms)));
  const parts = [];
  if (app.rmssdBase != null && hrvEnd != null) parts.push(`HRV ${Math.round(app.rmssdBase)} → ${Math.round(hrvEnd)} ms`);
  if (coh != null) parts.push(`gemiddelde coherentie tijdens de ademhaling ${Math.round(coh * 100)}%`);
  $('sHrv').textContent = parts.join(' · ');
  $('sHrv').hidden = !parts.length;
}

function buildSummary(P) {
  if (P.free) return buildFreeSummary(P);
  const s = summarize(app.samples, app.baseline, sessionClock());
  $('sTitle').textContent = P.title;
  $('sBase').textContent = Math.round(app.baseline);
  $('sEnd').textContent = Math.round(s.end);
  let verdict;
  $('sMinL').textContent = P.goal === 'rise' ? 'Hoogste' : 'Laagste';
  $('sMin').textContent = P.goal === 'rise' ? (s.max == null ? '--' : Math.round(s.max)) : s.min == null ? '--' : Math.round(s.min);
  if (P.goal === 'rise') {
    const rise = -s.drop, [lo, hi] = P.band;
    $('sDropL').textContent = 'Gestegen';
    $('sDrop').textContent = (rise >= 0 ? '+' : '−') + nl(Math.abs(rise));
    verdict = rise >= lo && rise <= hi + 1 ? 'Je kwam mooi in de zone.' : rise > hi + 1 ? 'Flink opgewarmd, misschien zelfs iets te veel.' : rise >= 2 ? 'Je warmde een beetje op.' : 'Je hartslag bleef vrij laag. De vuurademhaling helpt om op te warmen.';
  } else if (P.goal === 'steady') {
    $('sDropL').textContent = 'Gem. afwijking';
    $('sDrop').textContent = '±' + nl(s.meanAbsDev);
    verdict = s.meanAbsDev <= 2.5 ? 'Je hartslag bleef mooi stabiel.' : s.meanAbsDev <= 5 ? 'Redelijk stabiel, met wat golven.' : 'Je hartslag schommelde flink. Ook goed om te weten.';
  } else {
    $('sDropL').textContent = 'Gedaald';
    $('sDrop').textContent = (s.drop >= 0 ? '−' : '+') + nl(Math.abs(s.drop));
    verdict = s.drop >= 4 ? 'Je hartslag zakte flink.' : s.drop >= 1 ? 'Je kwam een stukje tot rust.' : 'Vandaag bleef je hartslag ongeveer gelijk. Ook goed om te weten.';
  }
  $('sLamps').textContent = `${P.name} · ${P.unit(app.litCount)} ${verdict}`;

  const hist = store.get('hist', []);
  hist.unshift({ d: new Date().toISOString(), b: Math.round(app.baseline), e: Math.round(s.end), m: app.durMin, src: app.source, p: app.profKey });
  store.set('hist', hist.slice(0, 20));
  const prev = hist.filter((h) => h.src !== 'sim').slice(app.source === 'sim' ? 0 : 1, app.source === 'sim' ? 3 : 4);
  $('sHist').innerHTML = prev.length
    ? '<span class="label">Vorige sessies</span>' +
      prev.map((h) => {
        const d = new Date(h.d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
        return `<span>${d} · ${PROFILES[h.p] ? PROFILES[h.p].name + ' · ' : ''}${h.b} → ${h.e} (${h.e <= h.b ? '−' : '+'}${Math.abs(h.b - h.e)})</span>`;
      }).join('')
    : '';
  const coh = app.coherenceLog.length ? app.coherenceLog.reduce((a, b) => a + b, 0) / app.coherenceLog.length : null;
  const hrvEnd = rmssd(cleanRR(app.rr.filter((r) => r.t > sessionClock() - 120).map((r) => r.ms)));
  const parts = [];
  if (app.rmssdBase != null && hrvEnd != null) parts.push(`HRV ${Math.round(app.rmssdBase)} → ${Math.round(hrvEnd)} ms`);
  if (coh != null) parts.push(`gemiddelde coherentie tijdens de ademhaling ${Math.round(coh * 100)}%`);
  $('sHrv').textContent = parts.join(' · ');
  $('sHrv').hidden = !parts.length;
}

/** HRV (RMSSD over the last minute) and, while the breathing guide is on, heart–breath coherence. */
function updateHrv(dt, t) {
  breathTimer -= dt;
  if (breath.on && breath.key) {
    if (breathTimer <= 0) { breathTimer = 0.1; app.breathLog.push({ t, v: breath.level }); }
    if (app.breathLog.length > 1500) app.breathLog.splice(0, 300);
  } else if (app.breathLog.length) { app.breathLog = []; app.coherence = null; }

  if (!app.hasRR) return;
  if (!rrAnnounced) {
    rrAnnounced = true;
    if (app.source !== 'sim') msg('Je borstband stuurt de tijd tussen hartslagen. HRV en coherentie staan aan.', 5000);
  }
  hrvTimer -= dt;
  if (hrvTimer > 0) return;
  hrvTimer = 1;
  app.rmssd = rmssd(cleanRR(app.rr.filter((r) => r.t > t - 60).map((r) => r.ms)));
  if (app.breathLog.length) {
    app.coherence = coherence(app.beats, app.breathLog, t);
    if (app.coherence != null && app.state === 'session') app.coherenceLog.push(app.coherence);
  }
}

/**
 * Vrij: no goal, no progress. The beat follows the chosen setting; the scene follows your heart the
 * way it does in its own profile (if there is a heart-rate monitor), otherwise it simply stays calm.
 */
function updateFree(dt, t, P) {
  if (app.baseline == null && t > 30) {
    const cs = app.samples.filter((s) => s.t > 5);
    if (cs.length >= 5) {
      app.baseline = cs.reduce((a, s) => a + s.hr, 0) / cs.length;
      app.rmssdBase = rmssd(cleanRR(app.rr.filter((r) => r.t > 5).map((r) => r.ms)));
    }
  }
  let calm = 0.55;
  if (app.baseline != null && app.hrS != null) {
    const diff = app.baseline - app.hrS;
    if (P.sceneGoal === 'rise') calm = riseScore(-diff, P.band).calm;
    else if (P.sceneGoal === 'steady') {
      sdTimer -= dt;
      if (sdTimer <= 0) {
        sdTimer = 1;
        const recent = app.samples.filter((s) => s.t > t - 30).map((s) => s.hr);
        if (recent.length > 4) app.sd = stdDev(recent);
      }
      const sc = steadyScore(diff, app.sd);
      app.stability = sc.stability;
      calm = sc.calm;
    } else calm = dropScore(diff).calm;
  }
  app.calm = calm;
  app.beatNow = beatFor(app.free, t, app.durMin);
  audio.setBeat(app.beatNow);
  if (app.durMin > 0 && t >= app.durMin * 60) finish();
}

/** Called every frame while calibrating or in a session. */
export function updateSession(dt) {
  if (app.latestHr != null) app.hrS = app.hrS == null ? app.latestHr : app.hrS + (app.latestHr - app.hrS) * smoothing(dt, 6);
  const t = sessionClock(), P = profile();
  updateHrv(dt, t);
  if (P.free) {
    if (app.state === 'session') updateFree(dt, t, P);
    app.calmVis = lerp(app.calmVis, app.calm, smoothing(dt, 4));
    app.progVis = lerp(app.progVis, 0, smoothing(dt, 2));
    return;
  }

  if (app.state === 'calib') {
    app.calm = lerp(app.calm, 0.3, dt * 0.5);
    if (app.hrS != null) { app.beatNow = P.start(app.hrS); audio.setBeat(app.beatNow); }
    if (t >= CALIB_SECONDS) {
      const cs = app.samples.filter((s) => s.t > 15);
      if (cs.length >= 8) {
        app.baseline = cs.reduce((a, s) => a + s.hr, 0) / cs.length;
        app.beatStart = P.start(app.baseline);
        app.rmssdBase = rmssd(cleanRR(app.rr.filter((r) => r.t > 15).map((r) => r.ms)));
        app.state = 'session';
        msg(P.goal === 'steady' ? 'Klaar. Kijk naar de vlam.' : 'Klaar. Laat het nu zijn werk doen.');
      } else if (t > CALIB_SECONDS + 30 && !app.samples.length) {
        msg('Ik ontvang geen hartslag. Staat het uitzenden nog aan?');
        app.t0 += 20000;
      }
    }
  } else if (app.state === 'session' && app.hrS != null) {
    const diff = app.baseline - app.hrS;
    let score;
    if (P.goal === 'rise') {
      score = riseScore(-diff, P.band);
    } else if (P.goal === 'steady') {
      sdTimer -= dt;
      if (sdTimer <= 0) {
        sdTimer = 1;
        const recent = app.samples.filter((s) => s.t > t - 30).map((s) => s.hr);
        if (recent.length > 4) app.sd = stdDev(recent);
      }
      score = steadyScore(diff, app.sd);
      app.stability = score.stability;
    } else score = dropScore(diff);
    app.calm = score.calm;

    // Gentle nudge after a while off target, at most every 2.5 minutes.
    // drop: heart rate well above the start; steady: unstable; rise: above the ceiling (or stuck low for 90 s).
    const off = P.goal === 'rise' ? (score.over ? 'over' : score.low && t > CALIB_SECONDS + 90 ? 'low' : null)
      : (P.goal === 'steady' ? score.stability < 0.25 : diff < -6) ? 'over' : null;
    if (off) {
      app.tenseSince ??= t;
      const wait = off === 'over' && P.goal === 'rise' ? 10 : 25;
      if (t - app.tenseSince > wait && t - app.lastNudge > 150) { app.lastNudge = t; msg(off === 'low' ? P.lowNudge : P.nudge); }
    } else app.tenseSince = null;

    app.beatP = clamp(app.beatP + (score.lead * dt) / (P.reach * app.durMin * 60));
    app.beatNow = beatAt(app.beatStart, P.target, app.beatP);
    audio.setBeat(app.beatNow);

    const end = CALIB_SECONDS + app.durMin * 60;
    if (P.fadeOut) {
      if (!app.fading && t >= end - 120) {
        app.fading = true;
        audio.fade(0.35, 90);
        msg('Het scherm wordt zo zwart. Tik erop als je wakker bent.', 6000);
      }
      app.sleepDim = clamp((t - (end - 120)) / 120) * 0.45;
    }

    app.points += score.rate * dt;
    const need = needPerStep(app.durMin);
    while (app.litCount < STEPS && app.points >= need * (app.litCount + 1)) {
      progressStep(app.litCount);
      app.litCount++;
      audio.chime(app.litCount);
      msg(P.lines[app.litCount - 1]);
    }
    if (t >= end) finish();
  }

  app.calmVis = lerp(app.calmVis, app.calm, smoothing(dt, 4));
  const target = app.state === 'session' ? clamp(app.points / (needPerStep(app.durMin) * STEPS)) : 0;
  app.progVis = lerp(app.progVis, target, smoothing(dt, 2));
}
