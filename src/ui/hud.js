// Heart-rate readout, sparkline and session timer. Updated four times per second.

import { audio } from '../audio/engine.js';
import { CALIB_SECONDS, STEPS } from '../core/scoring.js';
import { store } from '../core/storage.js';
import { TAU } from '../core/math.js';
import { app, breath, profile, sessionClock } from '../state.js';
import { $, nl } from './dom.js';

const spark = $('spark');
const sctx = spark.getContext('2d');
let showNumbers = !store.get('hideNums', false);
let acc = 0;

function applyNumbers() {
  $('nums').setAttribute('aria-checked', String(showNumbers));
  $('readout').style.visibility = showNumbers ? 'visible' : 'hidden';
  $('timer').style.visibility = showNumbers ? 'visible' : 'hidden';
}

export function initHud() {
  $('nums').addEventListener('click', (e) => {
    showNumbers = !showNumbers;
    store.set('hideNums', !showNumbers);
    applyNumbers();
    e.currentTarget.blur();
  });
  applyNumbers();
}

const hz = () => (audio.binOn && audio.on ? ` · ${nl(app.beatNow)} Hz` : '');

export function updateHud(dt) {
  acc += dt;
  if (acc < 0.25) return;
  acc = 0;
  const t = sessionClock(), P = profile();
  $('hr').textContent = app.latestHr == null ? '--' : Math.round(app.hrS ?? app.latestHr);

  const d = $('delta');
  if (app.state === 'calib') {
    d.textContent = `meten… ${Math.max(0, Math.ceil(CALIB_SECONDS - t))} s`;
    d.className = 'delta';
  } else if (app.state === 'reso') {
    d.textContent = 'resonantietest';
    d.className = 'delta';
  } else if (app.state === 'session' && P.free) {
    if (app.source === 'none') d.textContent = '';
    else if (app.baseline == null || app.hrS == null) d.textContent = app.hrS == null ? '' : 'begin meten…';
    else {
      const df = app.hrS - app.baseline;
      d.textContent = `${df <= 0 ? '−' : '+'}${nl(Math.abs(df))} t.o.v. begin`;
    }
    d.className = 'delta';
  } else if (app.state === 'session' && app.hrS != null) {
    if (P.goal === 'rise') {
      const rise = app.hrS - app.baseline, [lo, hi] = P.band;
      d.textContent = `${rise >= 0 ? '+' : '−'}${nl(Math.abs(rise))} t.o.v. begin` + (rise > hi + 3 ? ' · rustig aan' : '');
      d.className = 'delta' + (rise >= lo && rise <= hi + 3 ? ' down' : '');
    } else if (P.goal === 'steady') {
      d.textContent = `stabiliteit ${Math.round(app.stability * 100)}%`;
      d.className = 'delta' + (app.stability > 0.7 ? ' down' : '');
    } else {
      const df = app.hrS - app.baseline;
      d.textContent = `${df <= 0 ? '−' : '+'}${nl(Math.abs(df))} t.o.v. begin`;
      d.className = 'delta' + (df < -1 ? ' down' : '');
    }
  } else d.textContent = '';
  if (performance.now() - app.lastSampleAt > 8000 && app.source === 'ble' && app.state !== 'done') d.textContent = 'geen signaal…';

  const hrv = $('hrv');
  hrv.hidden = !app.hasRR || app.state === 'intro';
  if (!hrv.hidden) {
    const parts = [app.rmssd == null ? 'HRV meten…' : `HRV ${Math.round(app.rmssd)} ms`];
    if (app.coherence != null) parts.push(`coherentie ${Math.round(app.coherence * 100)}%`);
    hrv.textContent = parts.join(' · ');
  }

  if (app.state === 'reso') {
    $('timer').textContent = app.resoLabel || '';
  } else if (app.state === 'session' && P.free) {
    const mmss = (x) => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`;
    $('timer').textContent = (app.durMin > 0 ? mmss(Math.max(0, app.durMin * 60 - t)) : mmss(t)) + ' · Vrij' + hz();
  } else if (app.state === 'session') {
    const left = Math.max(0, CALIB_SECONDS + app.durMin * 60 - t);
    $('timer').textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')} · ${app.litCount}/${STEPS} · ${P.name}` + hz();
  } else if (app.state === 'calib') $('timer').textContent = `Rustmeting · ${P.name}` + hz();
  else $('timer').textContent = '';

  drawSparkline(t);
}

/** Last three minutes of heart rate, with the starting rate as a dashed line. */
/**
 * With a chest strap and the breathing guide on: the heart rate beat by beat over the last 30 s,
 * with the breathing as a soft band behind it, so you can see your heart rise and fall with your
 * breath (the actual biofeedback). Otherwise: the trend of the last three minutes.
 */
const WAVE_SECONDS = 30;
export function waveMode() {
  if (!app.hasRR || !breath.on || !breath.key || app.state === 'intro') return false;
  const t = sessionClock();
  return app.beats.filter((b) => b.t > t - WAVE_SECONDS).length >= 8;
}

/** Called every frame: the live wave scrolls smoothly; the trend only updates with the HUD. */
export function updateWave() {
  const on = waveMode();
  $('readout').classList.toggle('wave', on);
  if (on) drawWave(sessionClock());
}

function drawWave(t) {
  const w = spark.width, h = spark.height, t0 = t - WAVE_SECONDS;
  sctx.clearRect(0, 0, w, h);
  const X = (tt) => ((tt - t0) / WAVE_SECONDS) * w;
  // Breathing: a soft band, full = top.
  const br = app.breathLog.filter((b) => b.t > t0);
  if (br.length > 1) {
    sctx.fillStyle = 'rgba(236,228,214,.12)';
    sctx.beginPath(); sctx.moveTo(X(br[0].t), h);
    br.forEach((b) => sctx.lineTo(X(b.t), h - 4 - b.v * (h - 14)));
    sctx.lineTo(X(br[br.length - 1].t), h); sctx.closePath(); sctx.fill();
  }
  // Heart rate per beat, smoothed into a curve.
  const beats = app.beats.filter((b) => b.t > t0 - 2);
  const vals = beats.map((b) => b.v);
  const lo = Math.min(...vals) - 1.5, hi = Math.max(...vals) + 1.5;
  const Y = (v) => h - 6 - ((v - lo) / (hi - lo)) * (h - 16);
  sctx.strokeStyle = '#9fd6c2'; sctx.lineWidth = 3; sctx.lineJoin = 'round'; sctx.lineCap = 'round';
  sctx.beginPath();
  beats.forEach((b, i) => {
    const x = X(b.t), y = Y(b.v);
    if (!i) return sctx.moveTo(x, y);
    const p = beats[i - 1], mx = (X(p.t) + x) / 2;
    sctx.bezierCurveTo(mx, Y(p.v), mx, y, x, y);
  });
  sctx.stroke();
  sctx.font = '500 15px system-ui, sans-serif';
  sctx.fillStyle = '#9fd6c2'; sctx.fillText('hart', 4, 15);
  sctx.fillStyle = 'rgba(236,228,214,.55)'; sctx.fillText('adem', 46, 15);
}

function drawSparkline(t) {
  if (waveMode()) return; // drawn every frame by updateWave
  const w = spark.width, h = spark.height;
  sctx.clearRect(0, 0, w, h);
  const recent = app.samples.filter((s) => s.t > t - 180);
  if (recent.length < 2) return;
  const vals = recent.map((s) => s.hr).concat(app.baseline ? [app.baseline] : []);
  const lo = Math.min(...vals) - 2, hi = Math.max(...vals) + 2;
  const X = (s) => ((s.t - (t - 180)) / 180) * w, Y = (v) => h - 6 - ((v - lo) / (hi - lo)) * (h - 12);
  if (app.baseline) {
    sctx.strokeStyle = 'rgba(236,228,214,.25)'; sctx.setLineDash([4, 6]); sctx.lineWidth = 2;
    sctx.beginPath(); sctx.moveTo(0, Y(app.baseline)); sctx.lineTo(w, Y(app.baseline)); sctx.stroke();
    sctx.setLineDash([]);
  }
  sctx.strokeStyle = '#9fd6c2'; sctx.lineWidth = 3; sctx.lineJoin = 'round';
  sctx.beginPath();
  recent.forEach((s, i) => (i ? sctx.lineTo(X(s), Y(s.hr)) : sctx.moveTo(X(s), Y(s.hr))));
  sctx.stroke();
  const last = recent[recent.length - 1];
  sctx.fillStyle = '#9fd6c2';
  sctx.beginPath(); sctx.arc(X(last), Y(last.hr), 5, 0, TAU); sctx.fill();
}
