// The instrument sounds, built with PADsynth (see dsp.js). Each patch is rendered twice with different
// random phases, one per ear, so it sounds wide without any chorus or detune wobble.
//
// Rendering takes a moment, so it starts in the background as soon as the page loads, one table at a
// time, keeping the interface responsive. Music that needs a patch simply waits until it is ready.

import { padsynth } from './dsp.js';

export const TABLE_RATE = 48000;
const WIDTH = 0.82; // share of the independent right table (1 = fully decorrelated)
const D2 = 73.42;

const formant = (f) => Math.exp(-(((f - 600) / 220) ** 2)) + 0.8 * Math.exp(-(((f - 1100) / 260) ** 2)) + 0.35 * Math.exp(-(((f - 2500) / 600) ** 2));

export const PATCHES = {
  // Soft, wide ensemble pad (Biosphere / Loscil): many harmonics, generous spread.
  pad: { n: 1 << 18, f0: D2, bw: 32, bwScale: 1, seed: 11,
    harmonics: Array.from({ length: 48 }, (_, i) => (1 / Math.pow(i + 1, 1.1)) * (i % 2 ? 0.7 : 1)) },
  // Rounder, more defined pad for the focus profiles (Carbon Based Lifeforms).
  warm: { n: 1 << 18, f0: D2, bw: 14, bwScale: 0.9, seed: 23,
    harmonics: Array.from({ length: 24 }, (_, i) => 1 / Math.pow(i + 1, 1.8)) },
  // Breathy "choir of air": vowel-like formants, very smeared.
  air: { n: 1 << 18, f0: D2 * 2, bw: 70, bwScale: 1.3, seed: 37,
    harmonics: Array.from({ length: 64 }, (_, i) => formant(D2 * 2 * (i + 1)) / Math.sqrt(i + 1)) },
  // Glassy shimmer for slow grains and progress chimes.
  glass: { n: 1 << 16, f0: D2 * 8, bw: 9, bwScale: 1.2, seed: 53,
    harmonics: [1, 0.3, 0.12, 0.18, 0, 0.06, 0, 0.04] },
};

/** Render one channel of a patch (0 = left, 1 = right). */
export function renderTable(name, channel) {
  const p = PATCHES[name];
  return padsynth({ n: p.n, sampleRate: TABLE_RATE, f0: p.f0, harmonics: p.harmonics, bw: p.bw, bwScale: p.bwScale, seed: p.seed + channel });
}

const tables = {}; // name → [L, R]
const buffers = new WeakMap(); // AudioContext → { name: AudioBuffer }
let started = false;

/** Start rendering all patches in the background (call once, early). */
export function precompute(order = ['pad', 'warm', 'glass', 'air']) {
  if (started) return;
  started = true;
  const jobs = order.flatMap((name) => [[name, 0], [name, 1]]);
  const step = () => {
    const job = jobs.shift();
    if (!job) return;
    const [name, ch] = job;
    (tables[name] ||= [])[ch] = renderTable(name, ch);
    setTimeout(step, 0);
  };
  setTimeout(step, 0);
}

export const isReady = (name) => !!(tables[name] && tables[name][0] && tables[name][1]);

/** The patch as a stereo AudioBuffer for this context, or null while it is still rendering. */
export function patchBuffer(ac, name) {
  if (!isReady(name)) return null;
  let cache = buffers.get(ac);
  if (!cache) buffers.set(ac, (cache = {}));
  if (!cache[name]) {
    // Blend a little of the left table into the right: still wide, but the two ears stay related,
    // so the sound never turns hollow and keeps its low end on a single speaker.
    const [L, R] = tables[name], b = ac.createBuffer(2, L.length, TABLE_RATE), mixR = new Float32Array(L.length);
    const w = WIDTH, a = Math.sqrt(1 - w * w);
    for (let i = 0; i < L.length; i++) mixR[i] = a * L[i] + w * R[i];
    b.getChannelData(0).set(L); b.getChannelData(1).set(mixR);
    cache[name] = b;
  }
  return cache[name];
}

/** Playback rate that makes a patch sound at frequency `f`. */
export const rateFor = (name, f) => f / PATCHES[name].f0;
