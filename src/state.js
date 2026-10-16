// Shared mutable application state. One plain object keeps the data flow easy to follow:
// the session updates it, the scenes, HUD and audio read from it.

import { freeProfile, normalizeFree } from './config/free.js';
import { DEFAULT_PROFILE, PROFILES } from './config/profiles.js';
import { createBreath } from './core/breathing.js';
import { store } from './core/storage.js';

const savedProfile = store.get('prof', DEFAULT_PROFILE);
const validProfile = (k) => k === 'vrij' || !!PROFILES[k];

export const app = {
  /** 'intro' | 'calib' | 'session' | 'done' */
  state: 'intro',
  profKey: validProfile(savedProfile) ? savedProfile : DEFAULT_PROFILE,
  durMin: store.get('dur', 10), // 0 = unlimited (Vrij only)
  /** Vrij: the chosen background, music and binaural settings (see config/free.js). */
  free: normalizeFree(store.get('free', {})),

  // heart rate
  source: null, // 'ble' | 'sim' | null
  samples: [], // {t, hr}
  latestHr: null,
  lastSampleAt: 0,
  hrS: null, // smoothed heart rate
  baseline: null,

  // beat-to-beat data (chest strap only)
  hasRR: false,
  rr: [], // {t, ms}: accepted RR intervals with their (reconstructed) beat time
  beats: [], // {t, v}: instantaneous heart rate per beat, for coherence
  breathLog: [], // {t, v}: breathing guide level, sampled ~10 Hz while the guide is on
  beatClock: 0,
  rmssd: null,
  rmssdBase: null,
  coherence: null,
  coherenceLog: [], // coherence values while breathing, for the summary

  // session progress
  t0: 0,
  points: 0,
  litCount: 0,
  calm: 0.3,
  calmVis: 0.3,
  progVis: 0,
  stability: 0.5,
  sd: 0,
  sleepDim: 0,
  fading: false,
  tenseSince: null,
  lastNudge: -999,

  // binaural beat
  beatStart: 10,
  beatP: 0,
  beatNow: 10,

  /** animation clock in seconds */
  time: 0,
};

export const breath = createBreath();

let freeCache = null, freeKey = '';
/** The active profile; for Vrij an object built from the free settings (rebuilt only when they change). */
export function profile() {
  if (app.profKey !== 'vrij') return PROFILES[app.profKey];
  const key = JSON.stringify(app.free);
  if (key !== freeKey) { freeKey = key; freeCache = freeProfile(app.free); }
  return freeCache;
}

/** Change a free setting and remember it. */
export function setFree(patch) {
  app.free = normalizeFree({ ...app.free, ...patch });
  store.set('free', app.free);
}

/** Seconds since the session (including calibration) started. */
export const sessionClock = () => (app.state === 'intro' ? 0 : (performance.now() - app.t0) / 1000);

/**
 * Store RR intervals (ms) from one measurement. Beat times are reconstructed by adding the intervals
 * to a running clock, re-anchored to the arrival time when it drifts. Artefacts are filtered here.
 */
export function recordRR(list) {
  const now = sessionClock();
  if (Math.abs(app.beatClock - now) > 2) app.beatClock = now - list.reduce((a, b) => a + b, 0) / 1000;
  for (const ms of list) {
    app.beatClock += ms / 1000;
    const prev = app.rr[app.rr.length - 1];
    if (ms < 300 || ms > 2000 || (prev && Math.abs(ms - prev.ms) / prev.ms > 0.2 && app.beatClock - prev.t < 3)) continue;
    app.rr.push({ t: app.beatClock, ms });
    app.beats.push({ t: app.beatClock, v: 60000 / ms });
  }
  if (app.rr.length > 1200) { app.rr.splice(0, 300); app.beats.splice(0, 300); }
  app.hasRR = true;
}

/** Store one heart-rate reading. Implausible values are ignored. */
export function recordSample(hr) {
  if (!(hr > 25 && hr < 230)) return;
  app.latestHr = hr;
  app.lastSampleAt = performance.now();
  app.samples.push({ t: sessionClock(), hr });
}
