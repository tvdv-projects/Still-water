// Generative audio engine (Web Audio API). Everything is synthesised; there are no audio files.
//
// Signal flow:
//   ambient.js: PADsynth chords, air choir, glass grains, dub stabs, hiss  ┐
//   groove.js:  bass, filtered sequence (focus/energy)                     ├→ musicBus → tape saturation
//   space.js:   reverb, ping-pong delay, HRTF orbits (wet signals)        ┘
//   binaural carrier (pure L/R tone pair)                                  → musicBus
//   water or fire, wind, animals (fauna.js)                                → natureBus (+ own reverb)
//   heart pulse, or the beat and clicks of a groove                        → pulseBus
//   breath noise                                                           → breathBus
//   all buses → master → compressor → speakers
//
// Binaural beats live on their own pure tone pair: the left ear hears the carrier, the right ear the
// carrier plus the beat frequency. Keeping it separate means the beat is exact, while the pads can be
// as rich and wide as they like.

import { clamp, TAU } from '../core/math.js';
import { createAmbient } from './ambient.js';
import { saturationCurve } from './dsp.js';
import { createFauna } from './fauna.js';
import { createGroove } from './groove.js';
import { createSpace } from './space.js';
import { STYLES } from './styles.js';

const D2 = 73.42;
const st = (semitones) => D2 * Math.pow(2, semitones / 12);

function noiseBuffer(ac, seconds, brown) {
  const b = ac.createBuffer(1, ac.sampleRate * seconds, ac.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.4;
    } else d[i] = w;
  }
  return b;
}

/** Pink noise (equal energy per octave, Paul Kellet's filter): softer and more natural than white noise. */
function pinkBuffer(ac, seconds) {
  const b = ac.createBuffer(1, ac.sampleRate * seconds, ac.sampleRate), d = b.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return b;
}

/** A tiny silent WAV, played through an <audio> element so iOS treats the page as media playback (ignores the mute switch). */
function silentWav() {
  const sr = 8000, n = sr / 2, b = new ArrayBuffer(44 + n * 2), v = new DataView(b);
  const w = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  let bin = '';
  new Uint8Array(b).forEach((x) => (bin += String.fromCharCode(x)));
  return 'data:audio/wav;base64,' + btoa(bin);
}

function createEngine() {
  let ac, master, musicBus, natureBus, pulseBus, breathBus, space, ambient, groove, fauna;
  let lap, lapF, wind, windF, breathGain, breathFilter, crackleBuf;
  let carL, carR, carG, carF = st(12), carPending = null;
  let on = false, binOn = false, beat = 10, beatTarget = 10, follow = false;
  const mix = { music: 0.8, nature: 0.7, pulse: 0.6, breath: 0.6 };
  const next = { pulse: 0, crackle: 0 };
  let styleName = 'glacial', S = STYLES.glacial;
  let unlockEl = null, faunaNext = {};

  function init() {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain();
    master.gain.value = 0;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    master.connect(comp).connect(ac.destination);
    musicBus = ac.createGain(); natureBus = ac.createGain(); pulseBus = ac.createGain(); breathBus = ac.createGain();
    // Soft tape saturation on the music: rounds off peaks and adds a little warmth.
    const tape = ac.createWaveShaper(); tape.curve = saturationCurve(1.6); tape.oversample = '2x';
    musicBus.connect(tape).connect(master);
    [natureBus, pulseBus, breathBus].forEach((b) => b.connect(master));
    applyMix();

    space = createSpace(ac, musicBus);
    const noise = { white: noiseBuffer(ac, 0.5, false), pink: pinkBuffer(ac, 6), brown: noiseBuffer(ac, 5, true) };
    ambient = createAmbient({ ac, music: musicBus, space, noise });
    groove = createGroove({ ac, music: musicBus, pulse: pulseBus, space, duck: ambient.duck, noise });
    groove.setFollow(follow);

    // The animals get their own reverb into the nature bus, so the Natuur slider controls their echo too.
    const natRev = ac.createConvolver(), ng = ac.createGain();
    natRev.buffer = space.reverb.buffer; ng.gain.value = 0.6;
    natRev.connect(ng).connect(natureBus);
    fauna = createFauna(ac, natureBus, natRev);

    const loop = (buf, filterType, freq, q, gainNode, bus) => {
      const s = ac.createBufferSource(); s.buffer = buf; s.loop = true;
      const f = ac.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; if (q) f.Q.value = q;
      s.connect(f).connect(gainNode).connect(bus); s.start();
      return f;
    };
    lap = ac.createGain(); lap.gain.value = 0.03; lapF = loop(noiseBuffer(ac, 6, true), 'lowpass', 500, 0, lap, natureBus);
    wind = ac.createGain(); wind.gain.value = 0; windF = loop(noiseBuffer(ac, 4, false), 'bandpass', 600, 0.6, wind, natureBus);
    crackleBuf = noiseBuffer(ac, 0.05, false);

    // Breath: pink noise, high-passed against rumble and gently low-passed so it sounds like air, not hiss.
    breathGain = ac.createGain(); breathGain.gain.value = 0;
    {
      const s = ac.createBufferSource(); s.buffer = noise.pink; s.loop = true;
      const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 140;
      breathFilter = ac.createBiquadFilter(); breathFilter.type = 'lowpass'; breathFilter.frequency.value = 600; breathFilter.Q.value = 0.3;
      s.connect(hp).connect(breathFilter).connect(breathGain).connect(breathBus); s.start();
    }

    // Binaural carrier: left = carrier, right = carrier + beat.
    carL = ac.createOscillator(); carR = ac.createOscillator(); carG = ac.createGain(); carG.gain.value = 0;
    const m = ac.createChannelMerger(2);
    carL.connect(m, 0, 0); carR.connect(m, 0, 1); m.connect(carG).connect(musicBus);
    carL.start(); carR.start();

    next.pulse = ac.currentTime + 4;
    setStyle(styleName, true);
  }

  function applyMix() {
    if (!ac) return;
    const n = ac.currentTime;
    musicBus.gain.setTargetAtTime(mix.music * 1.25, n, 0.2);
    natureBus.gain.setTargetAtTime(mix.nature * 3 * S.nature, n, 0.2);
    pulseBus.gain.setTargetAtTime(mix.pulse * 1.6, n, 0.2);
    breathBus.gain.setTargetAtTime(mix.breath * 1.5, n, 0.2);
  }

  const carrierLevel = () => (binOn && on && !carPending ? 0.04 : 0);
  function updateBeat(tc) {
    const n = ac.currentTime;
    if (!carPending) carR.frequency.setTargetAtTime(carF + beat, n, tc);
    carG.gain.setTargetAtTime(carrierLevel(), n, 0.6);
  }

  /** A new carrier pitch: fade out, jump while silent, fade back in (never glide). */
  function setCarrier(f, immediate) {
    if (Math.abs(f - carF) < 0.01 && !carPending) return;
    const n = ac.currentTime;
    if (immediate) { carF = f; carL.frequency.setValueAtTime(f, n); carR.frequency.setValueAtTime(f + beat, n); return; }
    carG.gain.setTargetAtTime(0, n, 0.4);
    carPending = { f, at: n + 2 };
  }

  function setStyle(name, force = false) {
    if (!STYLES[name] || (name === styleName && !force)) return;
    styleName = name;
    S = STYLES[name];
    faunaNext = {};
    if (!ac) return;
    setCarrier(st(S.carrier ?? 12), force || !on);
    ambient.setStyle(S);
    groove.setStyle(S);
    applyMix();
  }

  /** One fire crackle: a very short burst of filtered noise, randomly panned. */
  function crackle(intensity) {
    const t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    const p = ac.createStereoPanner ? ac.createStereoPanner() : null;
    s.buffer = crackleBuf; s.playbackRate.value = 0.6 + Math.random() * 1.4;
    f.type = 'highpass'; f.frequency.value = 1200 + Math.random() * 3000;
    const len = 0.008 + Math.random() * 0.025;
    g.gain.setValueAtTime((0.02 + Math.random() * 0.05) * (0.5 + intensity), t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(f).connect(g);
    if (p) { p.pan.value = Math.random() * 1.2 - 0.6; g.connect(p).connect(natureBus); } else g.connect(natureBus);
    s.start(t); s.stop(t + len + 0.02);
  }

  /** The heart pulse: a soft low thump (only in profiles without a groove). */
  function pulse() {
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(58, t); o.frequency.exponentialRampToValueAtTime(41, t + 0.5);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.045, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g).connect(pulseBus); o.start(t); o.stop(t + 1);
  }

  return {
    /** Must be called from a user gesture (tap/click) before any sound can play, especially on iOS. */
    unlock() {
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* not supported */ }
      try {
        if (!unlockEl) { unlockEl = new Audio(silentWav()); unlockEl.loop = true; unlockEl.setAttribute('playsinline', ''); }
        unlockEl.play().catch(() => {});
      } catch { /* not supported */ }
      try { if (!ac) init(); ac.resume(); } catch { /* audio unavailable */ }
    },
    start() {
      this.unlock();
      if (!ac) return;
      on = true;
      master.gain.cancelScheduledValues(ac.currentTime);
      master.gain.setTargetAtTime(0.9, ac.currentTime, 2);
      updateBeat(0.3);
    },
    stop() { if (!ac) return; on = false; master.gain.setTargetAtTime(0, ac.currentTime, 0.3); },
    fade(v, secs) { if (!ac) return; master.gain.cancelScheduledValues(ac.currentTime); master.gain.setTargetAtTime(v, ac.currentTime, secs / 3); },
    setMix(k, v) { mix[k] = v; applyMix(); },
    setStyle,
    setBeat(hz) { beatTarget = hz; },
    setBin(v) { binOn = v; if (ac) updateBeat(1.5); },
    /** Tempo of the focus and energy music: fixed (false) or following the heart rate (true). */
    setTempoFollow(v) { follow = !!v; if (groove) groove.setFollow(follow); },

    /**
     * Breath sound follows the guide's movement: audible while the lungs fill or empty, silent on holds.
     * @param {number} level 0..1  @param {string} phase current step  @param {number} vis guide visibility
     * @param {number} speed |Δlevel| per second
     */
    setBreath(level, phase, vis, speed = 0) {
      if (!ac) return;
      const n = ac.currentTime, inn = /^in/.test(phase || '');
      const g = vis * 0.08 * clamp(speed / 0.3, 0, 1.3);
      breathGain.gain.setTargetAtTime(g, n, 0.15);
      breathFilter.frequency.setTargetAtTime(inn ? 480 + 480 * level : 360 + 320 * level, n, 0.2);
    },

    /**
     * Called every frame.
     * @param {number} t animation time (s)  @param {number} c calm 0..1
     * @param {number|null} hr smoothed heart rate  @param {boolean} active session running
     * @param {number} rel heart rate minus baseline: the music's brightness follows it (higher HR → brighter, lower → darker)
     */
    tick(t, c, hr, active, rel = 0) {
      if (!ac || !on) return;
      const n = ac.currentTime, r = 1 - c;
      if (S.fire) {
        // Low roar of the fire, louder and brighter with energy.
        lap.gain.setTargetAtTime(0.018 + 0.04 * c + 0.008 * Math.sin(t * 3.1) * Math.sin(t * 1.7), n, 0.3);
        lapF.frequency.setTargetAtTime(220 + 300 * c, n, 0.5);
      } else if (S.ocean) {
        const sw = Math.pow(0.5 + 0.5 * Math.sin((t * TAU) / 11), 2);
        lap.gain.setTargetAtTime(0.012 + 0.055 * sw, n, 0.6); lapF.frequency.setTargetAtTime(260 + 380 * sw, n, 0.6);
      } else {
        lap.gain.setTargetAtTime(0.022 + 0.018 * r + 0.008 * Math.sin(t * 0.5), n, 0.8); lapF.frequency.setTargetAtTime(360 + 240 * r + 60 * Math.sin(t * 0.2), n, 1);
      }
      wind.gain.setTargetAtTime(0.003 + 0.03 * r * (0.7 + 0.3 * Math.sin(t * 0.23)), n, 1.2);
      windF.frequency.setTargetAtTime(500 + 300 * Math.sin(t * 0.11), n, 1);

      if (carPending && n >= carPending.at) {
        carF = carPending.f; carPending = null;
        carL.frequency.setValueAtTime(carF, n); carR.frequency.setValueAtTime(carF + beat, n);
        carG.gain.setTargetAtTime(carrierLevel(), n, 1);
      }
      if (Math.abs(beatTarget - beat) > 0.04) { beat = beatTarget; updateBeat(2.5); }

      const arousal = clamp((rel + 6) / 14);
      space.tick(t);
      ambient.tick(n, c, arousal, on);
      groove.tick(n, { hr, c, arousal, chord: ambient.currentChord(), on });

      if (S.fire && n > next.crackle) { crackle(c); next.crackle = n + (0.04 + Math.random() * 0.35) / (0.5 + c); }
      if (!S.groove && active && hr) {
        if (n > next.pulse) { pulse(); next.pulse = n + 60 / Math.max(40, hr - S.pulseOff); }
      } else next.pulse = n + 1;
      // Animals call now and then, each on its own random interval [min, max] seconds.
      for (const [kind, [lo, hi]] of Object.entries(S.fauna || {})) {
        if (faunaNext[kind] == null) faunaNext[kind] = n + lo * 0.3 + Math.random() * (hi - lo) * 0.5;
        else if (n > faunaNext[kind]) { fauna[kind](); faunaNext[kind] = n + lo + Math.random() * (hi - lo); }
      }
    },

    /** Progress chime: one step up the style's scale per lantern / peak / segment. */
    chime(i) {
      if (!on) return;
      ambient.bell(st(S.chimeOct + S.scale[(i - 1) % S.scale.length] + (i > S.scale.length ? 12 : 0)), styleName === 'deep' ? 0.035 : 0.05);
    },
    bloom() {
      if (!on) return;
      const t = ac.currentTime;
      [0, 7, 10, 14, 19].forEach((k, j) => ambient.bell(st(36 + k + (styleName === 'warm' && k === 10 ? 1 : 0)), 0.04, t + j * 0.22));
    },
    get on() { return on; },
    get binOn() { return binOn; },
    get bpm() { return groove && S.groove ? groove.bpm : null; },
    get context() { return ac; },
  };
}

export const audio = createEngine();
