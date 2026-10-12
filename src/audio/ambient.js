// The ambient layers (Biosphere / Loscil): wide PADsynth chords that crossfade, a breathy "air choir"
// that drifts around your head, slow glass grains, muffled dub chord stabs dissolving in echoes, and a
// bed of tape hiss and vinyl crackle. Nothing starts with a hard attack and no pitch ever glides.

import { clamp, lerp } from '../core/math.js';
import { patchBuffer, rateFor } from './patches.js';

const D2 = 73.42;
const st = (s) => D2 * Math.pow(2, s / 12);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const LEVELS = [0.17, 0.14, 0.12, 0.1, 0.085];

/**
 * @param {{ac: AudioContext, music: AudioNode, space: ReturnType<import('./space.js').createSpace>,
 *          noise: {white: AudioBuffer, pink: AudioBuffer, brown: AudioBuffer}}} env
 */
export function createAmbient({ ac, music, space, noise }) {
  const gain = (v) => { const g = ac.createGain(); g.gain.value = v; return g; };
  const filter = (type, f, q = 0.7) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const loop = (buf) => { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, Math.random() * buf.duration); return s; };

  // Pad chain: low-pass (brightness follows the heart rate) → duck (sidechain from the kick) → out.
  const padF = filter('lowpass', 900, 0.5), duck = gain(1), padOut = gain(1), padWet = gain(0.6);
  padF.connect(duck).connect(padOut);
  padOut.connect(music); padOut.connect(padWet).connect(space.reverb);

  // Tape hiss and a low noise bed.
  const hiss = gain(0), bed = gain(0);
  loop(noise.pink).connect(filter('highpass', 2600)).connect(filter('lowpass', 9000)).connect(hiss).connect(music);
  loop(noise.brown).connect(filter('lowpass', 320)).connect(bed).connect(music);

  // Dub stabs: muffled chords through the ping-pong delay.
  const stabF = filter('lowpass', 650, 1.4), stabOut = gain(1);
  stabF.connect(stabOut);
  stabOut.connect(gain(0.35)).connect(music);
  stabOut.connect(space.delay);
  stabOut.connect(gain(0.3)).connect(space.reverb);

  let S = null, chordIdx = 0, chord = [], notes = [], started = false;
  const next = { chord: 0, air: 0, grain: 0, dub: 0, crackle: 0 };

  /** Crossfade to a new chord: new voices fade in one by one while the old ones fade out. */
  function playChord(semis, fade) {
    const buf = patchBuffer(ac, S.pad);
    if (!buf) return false;
    const n = ac.currentTime;
    for (const v of notes) {
      v.g.gain.cancelScheduledValues(n);
      v.g.gain.setTargetAtTime(0, n, fade / 3);
      v.src.stop(n + fade * 1.6 + 0.5);
    }
    notes = semis.map((s, i) => {
      const src = ac.createBufferSource(), g = gain(0), at = n + i * 0.7;
      src.buffer = buf; src.loop = true;
      src.playbackRate.value = rateFor(S.pad, st(s)) * Math.pow(2, rand(-3, 3) / 1200); // tiny fixed detune, never moving
      g.gain.setValueAtTime(0, at);
      g.gain.setTargetAtTime((LEVELS[i] ?? 0.08) * S.padLevel, at, fade / 3);
      src.connect(g).connect(padF);
      src.start(at, Math.random() * buf.duration);
      return { src, g };
    });
    chord = semis;
    return true;
  }

  /** A breathy choir tone that swells for ~20 s while circling around you. */
  function air() {
    const buf = patchBuffer(ac, 'air');
    if (!buf || !chord.length) return;
    const t = ac.currentTime, src = ac.createBufferSource(), g = gain(0), lp = filter('lowpass', 2600, 0.4);
    src.buffer = buf; src.loop = true;
    src.playbackRate.value = rateFor('air', st(pick(chord.slice(1)) + 12));
    const peak = 0.09 * S.air;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 6); g.gain.setValueAtTime(peak, t + 10); g.gain.linearRampToValueAtTime(0, t + 20);
    src.connect(lp).connect(g).connect(pick(space.orbits));
    src.start(t, Math.random() * buf.duration); src.stop(t + 20.5);
  }

  /** A slow glass grain: soft attack, long tail, placed on one of the orbits. */
  function grain(c) {
    const buf = patchBuffer(ac, 'glass');
    if (!buf) return;
    const t = ac.currentTime, src = ac.createBufferSource(), g = gain(0);
    const s = pick(S.scale) + (Math.random() < 0.35 ? 12 : 0);
    src.buffer = buf; src.loop = true;
    src.playbackRate.value = rateFor('glass', st(s + 36));
    const att = rand(0.25, 0.9), rel = rand(1.8, 3.6), v = (0.018 + 0.018 * c) * S.shimmerLevel;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + att); g.gain.setTargetAtTime(0, t + att, rel / 3);
    src.connect(g).connect(pick(space.orbits));
    if (S.grainEcho) g.connect(gain(S.grainEcho)).connect(space.delay);
    src.start(t, Math.random() * buf.duration); src.stop(t + att + rel * 1.6 + 0.2);
  }

  /** A muffled dub chord stab (Loscil): short and soft, then carried away by the echoes. */
  function stab() {
    const buf = patchBuffer(ac, 'warm');
    if (!buf || !chord.length) return;
    const t = ac.currentTime;
    chord.slice(1, 4).forEach((s) => {
      const src = ac.createBufferSource(), g = gain(0);
      src.buffer = buf; src.loop = true;
      src.playbackRate.value = rateFor('warm', st(s + 12));
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.11, t + 0.012); g.gain.setTargetAtTime(0, t + 0.03, 0.18);
      src.connect(g).connect(stabF);
      src.start(t, Math.random() * buf.duration); src.stop(t + 1.2);
    });
  }

  /** A single vinyl crackle. */
  function crackle() {
    const t = ac.currentTime, src = ac.createBufferSource(), g = gain(0), bp = filter('bandpass', rand(1500, 5500), 1.2);
    const p = ac.createStereoPanner ? ac.createStereoPanner() : null;
    src.buffer = noise.white; src.playbackRate.value = rand(0.6, 1.6);
    g.gain.setValueAtTime(rand(0.004, 0.014), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.005);
    src.connect(bp).connect(g);
    if (p) { p.pan.value = rand(-0.7, 0.7); g.connect(p).connect(music); } else g.connect(music);
    src.start(t, Math.random() * 0.4); src.stop(t + 0.02);
  }

  return {
    duck,
    currentChord: () => chord,

    setStyle(style) {
      const wasStarted = started && S;
      S = style;
      chordIdx = 0;
      const n = ac.currentTime;
      hiss.gain.setTargetAtTime(0.0035 * S.hiss, n, 2);
      bed.gain.setTargetAtTime(S.bed || 0, n, 2);
      padWet.gain.setTargetAtTime(S.padWet, n, 1);
      if (S.dub) space.setDelay(S.dub.time, S.dub.feedback, 0.3);
      if (wasStarted) playChord(S.chords[0], 6);
      else chord = S.chords[0];
      next.chord = n + 30;
    },

    /** Begin as soon as the pad sound is rendered; until then this is retried every frame. */
    tick(n, c, arousal, on) {
      if (!S || !on) return;
      if (!started) {
        if (!playChord(S.chords[chordIdx], 6)) return;
        started = true;
        Object.assign(next, { chord: n + 30, air: n + rand(6, 14), grain: n + 3, dub: n + rand(4, 10), crackle: n + 1 });
      }
      padF.frequency.setTargetAtTime((520 + 1100 * arousal + 140 * Math.sin(n * 0.021)) * S.padBright, n, 3);

      if (n > next.chord) {
        if (S.chords.length > 1) { chordIdx = (chordIdx + 1) % S.chords.length; playChord(S.chords[chordIdx], 8); }
        next.chord = n + rand(26, 40) * Math.min(S.slow, 3);
      }
      if (n > next.air) { if (S.air > 0 && Math.random() < 0.75) air(); next.air = n + rand(14, 30); }
      if (n > next.grain) {
        if (S.shimmer > 0) grain(c);
        next.grain = n + (rand(1.5, 4.5) * lerp(1.4, 0.8, clamp(c))) / Math.max(0.05, S.shimmer);
      }
      if (S.dub && n > next.dub) { stab(); next.dub = n + rand(S.dub.every[0], S.dub.every[1]); }
      if (S.crackle > 0 && n > next.crackle) { crackle(); next.crackle = n + rand(0.15, 1.8) / S.crackle; }
    },

    /** A glass bell for progress chimes. */
    bell(f, vol, at) {
      const buf = patchBuffer(ac, 'glass');
      if (!buf) return;
      const t = at || ac.currentTime, src = ac.createBufferSource(), g = gain(0);
      src.buffer = buf; src.loop = true; src.playbackRate.value = rateFor('glass', f);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * 1.6, t + 0.015); g.gain.setTargetAtTime(0, t + 0.02, 1.4);
      src.connect(g); g.connect(music); g.connect(space.reverb);
      src.start(t, Math.random() * buf.duration); src.stop(t + 7);
    },
  };
}
