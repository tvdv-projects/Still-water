// Session lifecycle: intro → calibration (60 s) → session → summary.
//
// During calibration the binaural beat follows the live heart rate, and the average
// of seconds 15–60 becomes the baseline. During the session the profile's scoring
// (drop or steady) turns the heart rate into calm, progress points and the speed at
// which the beat is led from its starting frequency to the profile's target.

import { audio } from './audio/engine.js';
import { PROFILES } from './config/profiles.js';
import { clamp, lerp, smoothing } from './core/math.js';
import { beatAt, CALIB_SECONDS, dropScore, needPerStep, stdDev, steadyScore, STEPS, summarize } from './core/scoring.js';
import { store } from './core/storage.js';
import { progressStep, resetScenes } from './render/frame.js';
import { app, breath, profile, sessionClock } from './state.js';
import { resetBreathBar } from './ui/breath-bar.js';
import { $, nl } from './ui/dom.js';
import { msg } from './ui/messages.js';
import { CONNECT_NOTE, setStatus } from './ui/status.js';

let sdTimer = 0;

function resetProgress() {
  Object.assign(app, {
    samples: [], baseline: null, hrS: null, points: 0, litCount: 0, progVis: 0,
    beatP: 0, fading: false, sleepDim: 0, tenseSince: null, lastNudge: -999, stability: 0.5, sd: 0,
  });
  resetScenes();
  resetBreathBar();
}

export function begin() {
  $('intro').classList.add('gone');
  $('readout').hidden = false;
  $('breathBar').hidden = false;
  $('stop').hidden = false;
  resetProgress();
  app.state = 'calib';
  app.t0 = performance.now();
  audio.setStyle(profile().style);
  audio.fade(0.9, 2);
  audio.start();
  try { navigator.wakeLock?.request('screen').catch(() => {}); } catch { /* not supported */ }
  msg('Ga gemakkelijk zitten. Ik meet eerst een minuut hoe je nu bent.', 6000);
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
  audio.fade(0, early ? 4 : 20);
  app.state = 'done';

  const P = profile();
  const s = summarize(app.samples, app.baseline, sessionClock());
  $('sTitle').textContent = P.title;
  $('sBase').textContent = Math.round(app.baseline);
  $('sEnd').textContent = Math.round(s.end);
  $('sMin').textContent = s.min == null ? '--' : Math.round(s.min);
  let verdict;
  if (P.goal === 'steady') {
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
  $('summary').classList.remove('gone');
  if (!P.fadeOut && !early) audio.bloom();
}

/** Called every frame while calibrating or in a session. */
export function updateSession(dt) {
  if (app.latestHr != null) app.hrS = app.hrS == null ? app.latestHr : app.hrS + (app.latestHr - app.hrS) * smoothing(dt, 6);
  const t = sessionClock(), P = profile();

  if (app.state === 'calib') {
    app.calm = lerp(app.calm, 0.3, dt * 0.5);
    if (app.hrS != null) { app.beatNow = P.start(app.hrS); audio.setBeat(app.beatNow); }
    if (t >= CALIB_SECONDS) {
      const cs = app.samples.filter((s) => s.t > 15);
      if (cs.length >= 8) {
        app.baseline = cs.reduce((a, s) => a + s.hr, 0) / cs.length;
        app.beatStart = P.start(app.baseline);
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
    if (P.goal === 'steady') {
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

    // Gentle nudge after 25 s of tension (or instability), at most every 2.5 minutes.
    const tense = P.goal === 'steady' ? score.stability < 0.25 : diff < -6;
    if (tense) {
      app.tenseSince ??= t;
      if (t - app.tenseSince > 25 && t - app.lastNudge > 150) { app.lastNudge = t; msg(P.nudge); }
    } else app.tenseSince = null;

    app.beatP = clamp(app.beatP + (score.lead * dt) / (P.reach * app.durMin * 60));
    app.beatNow = beatAt(app.beatStart, P.target, app.beatP);
    audio.setBeat(app.beatNow);

    const end = CALIB_SECONDS + app.durMin * 60;
    if (P.fadeOut) {
      if (!app.fading && t >= end - 120) { app.fading = true; audio.fade(0, 40); }
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
