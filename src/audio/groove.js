// The rhythmic layer for the focus and energy profiles (Carbon Based Lifeforms / AES Dana):
// a warm bass, a synth sequence through a resonant filter that slowly opens and closes, a dub
// ping-pong echo, tiny glitch clicks, and for Energie a soft downtempo beat.
//
// Tempo is either fixed per style, or follows your heart rate (switch in the sound panel). In
// heart-rate mode it moves at most 1 BPM per bar, so it never lurches.

import { clamp } from '../core/math.js';

const D2 = 73.42;
const st = (s) => D2 * Math.pow(2, s / 12);
const rand = (a, b) => a + Math.random() * (b - a);

// 16-step patterns (one bar of sixteenth notes).
const KICK = [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0];
const SNARE = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
const HAT = [0.5, 0.15, 1, 0.25, 0.5, 0.15, 1, 0.3, 0.5, 0.2, 1, 0.25, 0.5, 0.3, 0.9, 0.4];
const CLICK = [0.2, 0.6, 0.3, 0.8, 0.2, 0.5, 0.3, 0.9, 0.2, 0.6, 0.3, 0.8, 0.2, 0.5, 0.4, 1];
// Bass line for Energie: step → [semitones above the chord root, length in steps].
const LINE = { 0: [0, 3], 3: [0, 1], 6: [7, 2], 10: [0, 3], 13: [12, 1] };

/** Tempo for this bar: fixed, or the heart rate (plus an offset) within the style's range. */
export function targetTempo(groove, followHeart, hr) {
  if (!followHeart || !hr) return groove.bpm;
  const [lo, hi, offset = 0] = groove.hr;
  return clamp(Math.round(hr + offset), lo, hi);
}

/**
 * @param {{ac: AudioContext, music: AudioNode, pulse: AudioNode, space: any, duck: GainNode,
 *          noise: {white: AudioBuffer}}} env
 */
export function createGroove({ ac, music, pulse, space, duck, noise }) {
  const gain = (v) => { const g = ac.createGain(); g.gain.value = v; return g; };
  const filter = (type, f, q = 0.7) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };

  const bassF = filter('lowpass', 260, 0.7), bassOut = gain(1);
  bassF.connect(bassOut).connect(music);
  // The sequence sits back in the room: little dry signal, more echo and reverb. All notes share one
  // resonant low-pass that two slow LFOs keep moving (about 17 s and 70 s), so the sound keeps
  // opening and closing on its own, independent of the notes.
  const arpOut = gain(1), arpFilter = filter('lowpass', 950, 4.5);
  arpFilter.connect(arpOut);
  [[0.06, 380], [0.0143, 260]].forEach(([hz, depth]) => {
    const lfo = ac.createOscillator(), d = gain(depth);
    lfo.frequency.value = hz; lfo.connect(d).connect(arpFilter.frequency); lfo.start();
  });
  arpOut.connect(gain(0.55)).connect(music); arpOut.connect(gain(0.8)).connect(space.delay); arpOut.connect(gain(0.4)).connect(space.reverb);
  const drums = gain(1), drumRev = gain(0.22);
  drums.connect(pulse); drumRev.connect(space.reverb);

  let G = null, bpm = 84, follow = false, step = 0, bar = 0, nextT = 0, arpI = 0, sweep = 0;

  function noiseHit(t, type, freq, q, vol, decay, dest, pan = 0) {
    const src = ac.createBufferSource(), f = filter(type, freq, q), g = gain(0);
    src.buffer = noise.white;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(f).connect(g);
    if (pan && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p).connect(dest); } else g.connect(dest);
    src.start(t, Math.random() * 0.3); src.stop(t + decay + 0.02);
    return g;
  }

  function kick(t) {
    const o = ac.createOscillator(), g = gain(0);
    o.frequency.setValueAtTime(115, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.11);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.28, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g).connect(drums); o.start(t); o.stop(t + 0.55);
    noiseHit(t, 'lowpass', 2800, 0.7, 0.025, 0.006, drums);
    // Gentle sidechain: the pads breathe with the kick.
    if (G.pump) {
      duck.gain.setValueAtTime(1, t);
      duck.gain.linearRampToValueAtTime(1 - G.pump, t + 0.02);
      duck.gain.setTargetAtTime(1, t + 0.04, 0.12);
    }
  }

  function snare(t, v) {
    const g = noiseHit(t, 'bandpass', 1700, 0.7, 0.06 * v, 0.22, drums);
    g.connect(drumRev);
    const o = ac.createOscillator(), og = gain(0);
    o.frequency.value = 185;
    og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.045 * v, t + 0.002); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(og).connect(drums); og.connect(drumRev); o.start(t); o.stop(t + 0.15);
  }

  const hat = (t, v, open) => noiseHit(t, 'highpass', 6800, 0.7, 0.028 * v, open ? 0.24 : 0.045, drums, 0.25);

  function click(t) {
    const g = noiseHit(t, 'bandpass', rand(2000, 9000), 6, rand(0.03, 0.07), 0.004, pulse, rand(-0.8, 0.8));
    g.connect(gain(0.6)).connect(space.delay);
  }

  function bass(t, s, len, v) {
    const f = st(s), o = ac.createOscillator(), o2 = ac.createOscillator(), mix2 = gain(0.3), g = gain(0);
    o.frequency.value = f; o2.type = 'triangle'; o2.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.1 * v, t + 0.012);
    g.gain.setValueAtTime(0.1 * v, t + Math.max(0.02, len - 0.08)); g.gain.linearRampToValueAtTime(0, t + len);
    o.connect(g); o2.connect(mix2).connect(g); g.connect(bassF);
    o.start(t); o2.start(t); o.stop(t + len + 0.05); o2.stop(t + len + 0.05);
  }

  /**
   * One sequence note: a triangle with a little detuned saw on top (round, not buzzy), a gentle
   * per-note filter pluck, a soft attack, and a slight left/right alternation.
   */
  function arp(t, s, dur, arousal) {
    const f = st(s), g = gain(0), lp = filter('lowpass', 400, G.arpQ || 3);
    const base = (260 + 700 * (0.5 + 0.5 * Math.sin(sweep))) * (0.7 + 0.5 * arousal);
    lp.frequency.setValueAtTime(base * 1.8, t); lp.frequency.setTargetAtTime(base, t + 0.01, 0.09);
    [['triangle', 0, 1], ['sawtooth', -7, 0.22], ['sawtooth', 7, 0.22]].forEach(([type, cents, level]) => {
      const o = ac.createOscillator(), og = gain(level);
      o.type = type; o.frequency.value = f; o.detune.value = cents;
      o.connect(og).connect(lp); o.start(t); o.stop(t + dur + 0.4);
    });
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.016, t + 0.018); g.gain.setTargetAtTime(0, t + 0.03, dur * 0.4);
    if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = arpI % 2 ? 0.3 : -0.3; lp.connect(g).connect(p).connect(arpFilter); }
    else lp.connect(g).connect(arpFilter);
  }

  function playStep(s, t, chord, c, arousal) {
    const dur = 60 / bpm / 4;
    const root = chord[0] ?? 0;
    if (G.drums) {
      if (KICK[s]) kick(t);
      if (SNARE[s]) snare(t, 0.8 + 0.2 * Math.random());
      const hv = HAT[s] * (0.6 + 0.4 * c) * rand(0.85, 1.1);
      if (hv > 0.12) hat(t, hv, s === 14 && bar % 2 === 1);
    }
    if (G.bass === 'long' && s === 0) bass(t, root, dur * 15, 0.8);
    if (G.bass === 'pulse' && s % 2 === 0) bass(t, root, dur * 1.3, s % 8 === 0 ? 1 : 0.55);
    if (G.bass === 'line' && LINE[s]) bass(t, root + LINE[s][0], dur * LINE[s][1] * 0.95, 1);
    if (G.arp && s % G.arpEvery === 0) {
      const k = G.arp[arpI++ % G.arp.length], up = chord.slice(1);
      if (up.length) arp(t, up[k % up.length] + 12 * Math.floor(k / up.length) + 12, dur * G.arpEvery, arousal);
    }
    if (G.clicks && Math.random() < G.clicks * CLICK[s]) click(t + rand(0, dur * 0.1));
  }

  return {
    get bpm() { return Math.round(bpm); },
    setFollow(v) { follow = !!v; },
    setStyle(S) {
      const had = !!G;
      G = S.groove || null;
      if (!G) return;
      if (!had) bpm = G.bpm;
      step = 0; bar = 0; arpI = 0;
      nextT = ac.currentTime + 0.1;
      space.setDelay((0.75 * 60) / bpm, G.echo ?? 0.45, 0.3);
    },
    /** Schedule notes up to 0.2 s ahead. Call every frame. */
    tick(n, { hr, c, arousal, chord, on }) {
      if (!G || !on) { nextT = n + 0.1; return; }
      if (nextT < n - 0.2) nextT = n + 0.05; // after a pause, pick up from now instead of catching up
      while (nextT < n + 0.2) {
        if (step === 0) {
          const target = targetTempo(G, follow, hr);
          bpm += clamp(target - bpm, -1, 1);
          space.setDelay((0.75 * 60) / bpm, G.echo ?? 0.45, 2);
        }
        playStep(step, nextT, chord, c, arousal);
        const dur = 60 / bpm / 4, sw = G.swing || 0;
        nextT += dur * (step % 2 === 0 ? 1 + sw : 1 - sw);
        sweep += (2 * Math.PI) / (16 * 32); // the filter opens and closes over 32 bars
        step = (step + 1) % 16;
        if (step === 0) bar++;
      }
    },
  };
}
