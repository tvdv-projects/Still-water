// Heart-rate readout, sparkline and session timer. Updated four times per second.

import { audio } from '../audio/engine.js';
import { CALIB_SECONDS, STEPS } from '../core/scoring.js';
import { store } from '../core/storage.js';
import { TAU } from '../core/math.js';
import { app, profile, sessionClock } from '../state.js';
import { $, nl } from './dom.js';

const spark = $('spark');
const sctx = spark.getContext('2d');
let showNumbers = !store.get('hideNums', false);
let acc = 0;

function applyNumbers() {
  $('nums').textContent = showNumbers ? 'Cijfers uit' : 'Cijfers aan';
  $('nums').setAttribute('aria-pressed', String(!showNumbers));
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
  } else if (app.state === 'session' && app.hrS != null) {
    if (P.goal === 'steady') {
      d.textContent = `stabiliteit ${Math.round(app.stability * 100)}%`;
      d.className = 'delta' + (app.stability > 0.7 ? ' down' : '');
    } else {
      const df = app.hrS - app.baseline;
      d.textContent = `${df <= 0 ? '−' : '+'}${nl(Math.abs(df))} t.o.v. begin`;
      d.className = 'delta' + (df < -1 ? ' down' : '');
    }
  } else d.textContent = '';
  if (performance.now() - app.lastSampleAt > 8000 && app.source === 'ble' && app.state !== 'done') d.textContent = 'geen signaal…';

  if (app.state === 'session') {
    const left = Math.max(0, CALIB_SECONDS + app.durMin * 60 - t);
    $('timer').textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')} · ${app.litCount}/${STEPS} · ${P.name}` + hz();
  } else if (app.state === 'calib') $('timer').textContent = `Rustmeting · ${P.name}` + hz();
  else $('timer').textContent = '';

  drawSparkline(t);
}

/** Last three minutes of heart rate, with the starting rate as a dashed line. */
function drawSparkline(t) {
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
