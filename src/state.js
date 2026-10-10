// Shared mutable application state. One plain object keeps the data flow easy to follow:
// the session updates it, the scenes, HUD and audio read from it.

import { DEFAULT_PROFILE, PROFILES } from './config/profiles.js';
import { createBreath } from './core/breathing.js';
import { store } from './core/storage.js';

const savedProfile = store.get('prof', DEFAULT_PROFILE);

export const app = {
  /** 'intro' | 'calib' | 'session' | 'done' */
  state: 'intro',
  profKey: PROFILES[savedProfile] ? savedProfile : DEFAULT_PROFILE,
  durMin: store.get('dur', 10),

  // heart rate
  source: null, // 'ble' | 'sim' | null
  samples: [], // {t, hr}
  latestHr: null,
  lastSampleAt: 0,
  hrS: null, // smoothed heart rate
  baseline: null,

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

export const profile = () => PROFILES[app.profKey];

/** Seconds since the session (including calibration) started. */
export const sessionClock = () => (app.state === 'intro' ? 0 : (performance.now() - app.t0) / 1000);

/** Store one heart-rate reading. Implausible values are ignored. */
export function recordSample(hr) {
  if (!(hr > 25 && hr < 230)) return;
  app.latestHr = hr;
  app.lastSampleAt = performance.now();
  app.samples.push({ t: sessionClock(), hr });
}
