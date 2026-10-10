// Generative audio engine (Web Audio API). Everything is synthesised; there are no audio files.
//
// Signal flow:
//   drone voices (L/R oscillator pairs) → low-pass → musicBus (+ reverb)
//   grains, swells, arpeggio, ticks, chimes  → musicBus (+ reverb)
//   water, wind, owl, birds                  → natureBus
//   sub pulse                                → pulseBus
//   breath noise                             → breathBus
//   all buses → master → compressor → speakers
//
// Binaural beats: every drone voice is a pair of oscillators, left and right ear.
// The right one is detuned by the beat frequency, so the beat is woven into the music.

import { clamp, lerp, TAU } from '../core/math.js';
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
  let ac, master, musicBus, natureBus, pulseBus, breathBus, rev;
  let lap, lapF, wind, windF, padF, bed, breathGain, breathFilter;
  let on = false, binOn = false, beat = 10, beatTarget = 10, lastCents = 0;
  const mix = { music: 0.8, nature: 0.7, pulse: 0.6, breath: 0.6 };
  const voices = [];
  let chordIdx = 0, arpI = 0;
  const next = { chord: 0, grain: 0, swell: 0, pulse: 0, owl: 0, arp: 0, tick: 0, bird: 0 };
  let styleName = 'glacial', S = STYLES.glacial;
  let unlockEl = null;

  function init() {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain();
    master.gain.value = 0;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    master.connect(comp).connect(ac.destination);
    musicBus = ac.createGain(); natureBus = ac.createGain(); pulseBus = ac.createGain(); breathBus = ac.createGain();
    [musicBus, natureBus, pulseBus, breathBus].forEach((b) => b.connect(master));
    applyMix();

    // Reverb: 7 s of decaying noise, independent per channel so the binaural image survives.
    rev = ac.createConvolver();
    const len = ac.sampleRate * 7, ib = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ib.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * (i < ac.sampleRate * 0.03 ? i / (ac.sampleRate * 0.03) : 1);
    }
    rev.buffer = ib;
    const rg = ac.createGain();
    rg.gain.value = 0.6;
    rev.connect(rg).connect(musicBus);

    const loop = (buf, filterType, freq, q, gainNode, bus) => {
      const s = ac.createBufferSource(); s.buffer = buf; s.loop = true;
      const f = ac.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; if (q) f.Q.value = q;
      s.connect(f).connect(gainNode).connect(bus); s.start();
      return f;
    };
    lap = ac.createGain(); lap.gain.value = 0.03; lapF = loop(noiseBuffer(ac, 6, true), 'lowpass', 500, 0, lap, natureBus);
    wind = ac.createGain(); wind.gain.value = 0; windF = loop(noiseBuffer(ac, 4, false), 'bandpass', 600, 0.6, wind, natureBus);
    bed = ac.createGain(); bed.gain.value = 0; loop(noiseBuffer(ac, 5, true), 'lowpass', 320, 0, bed, musicBus);
    breathGain = ac.createGain(); breathGain.gain.value = 0; breathFilter = loop(noiseBuffer(ac, 3, false), 'bandpass', 500, 0.7, breathGain, breathBus);

    padF = ac.createBiquadFilter(); padF.type = 'lowpass'; padF.frequency.value = 500; padF.Q.value = 0.4;
    const padBus = ac.createGain(); padBus.gain.value = 0.9;
    padF.connect(padBus); padBus.connect(musicBus); padBus.connect(rev);
    S.chords[0].forEach((s, i) => {
      const f = st(s), L = ac.createOscillator(), R = ac.createOscillator(), m = ac.createChannelMerger(2), g = ac.createGain();
      L.type = R.type = i < 1 ? 'sine' : 'triangle';
      L.frequency.value = f; R.frequency.value = f;
      const wob = ac.createOscillator(), wg = ac.createGain();
      wob.frequency.value = 0.05 + i * 0.013; wg.gain.value = 3;
      wob.connect(wg); wg.connect(L.detune); wg.connect(R.detune); wob.start();
      L.connect(m, 0, 0); R.connect(m, 0, 1); m.connect(g).connect(padF);
      g.gain.value = 0;
      L.start(); R.start();
      voices.push({ L, R, g, f, lvl: [0.07, 0.07, 0.06, 0.05, 0.04][i] });
    });
    const t = ac.currentTime;
    Object.assign(next, { chord: t + 28, grain: t + 2, swell: t + 9, pulse: t + 4, owl: t + 60, arp: t + 3, tick: t + 2, bird: t + 20 });
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

  function retune(glide) {
    const n = ac.currentTime;
    voices.forEach((v) => {
      v.L.frequency.setTargetAtTime(v.f, n, glide);
      v.R.frequency.setTargetAtTime(v.f + (binOn ? beat : 0.12), n, glide);
    });
  }

  function setStyle(name, force = false) {
    if (!STYLES[name] || (name === styleName && !force)) return;
    styleName = name;
    S = STYLES[name];
    if (!ac) return;
    chordIdx = 0;
    S.chords[0].forEach((s, i) => (voices[i].f = st(s)));
    retune(force ? 0.5 : 4);
    bed.gain.setTargetAtTime(S.bed, ac.currentTime, 2);
    applyMix();
  }

  function note(f, vol, att, dec, at, pan = 0) {
    const t = at || ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    const p = ac.createStereoPanner ? ac.createStereoPanner() : null;
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + att + dec);
    if (p) { p.pan.value = pan; o.connect(g).connect(p); p.connect(rev); p.connect(musicBus); } else { o.connect(g); g.connect(rev); g.connect(musicBus); }
    o.start(t); o.stop(t + att + dec + 0.05);
  }

  const grain = (c) => note(st(S.scale[(Math.random() * S.scale.length) | 0] + 36 + (Math.random() < 0.4 ? 12 : 0)), 0.014 + 0.016 * c, 0.004, 0.5 + Math.random() * 0.8, 0, Math.random() * 1.8 - 0.9);

  function swell() {
    const t = ac.currentTime, f = st(S.scale[(Math.random() * S.scale.length) | 0] + 24);
    const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
    o.type = 'triangle'; o2.type = 'sine'; o.frequency.value = f; o2.frequency.value = f * 2.003; lp.type = 'lowpass'; lp.frequency.value = 1200;
    const vib = ac.createOscillator(), vg = ac.createGain(); vib.frequency.value = 4.2; vg.gain.value = 4; vib.connect(vg); vg.connect(o.detune); vg.connect(o2.detune);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.035, t + 3.5); g.gain.setValueAtTime(0.035, t + 7); g.gain.linearRampToValueAtTime(0, t + 14);
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(rev); g.connect(musicBus);
    [o, o2, vib].forEach((x) => { x.start(t); x.stop(t + 14.2); });
  }

  function tickSound(t) {
    const o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1800; o.type = 'triangle';
    o.frequency.setValueAtTime(980, t); o.frequency.exponentialRampToValueAtTime(620, t + 0.05);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.03, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(lp).connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.12);
  }

  function bird() {
    const t = ac.currentTime, p = ac.createStereoPanner ? ac.createStereoPanner() : null;
    const notes = 2 + ((Math.random() * 4) | 0), base = 2600 + Math.random() * 1200;
    for (let k = 0; k < notes; k++) {
      const s = t + k * (0.11 + Math.random() * 0.06), o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(base * (1 + Math.random() * 0.15), s); o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.2), s + 0.07);
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.008, s + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.09);
      if (p) o.connect(g).connect(p); else o.connect(g).connect(natureBus);
      o.start(s); o.stop(s + 0.1);
    }
    if (p) { p.pan.value = Math.random() * 1.6 - 0.8; p.connect(natureBus); p.connect(rev); }
  }

  function owl() {
    const t = ac.currentTime;
    [[0, 392, 0.32], [0.55, 352, 0.9]].forEach(([d, f, len]) => {
      const o = ac.createOscillator(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
      o.frequency.value = f; lfo.frequency.value = 6; lg.gain.value = 6; lfo.connect(lg).connect(o.frequency);
      g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(0.015, t + d + 0.06); g.gain.setValueAtTime(0.015, t + d + len - 0.1); g.gain.linearRampToValueAtTime(0, t + d + len);
      o.connect(g); g.connect(natureBus); o.start(t + d); lfo.start(t + d); o.stop(t + d + len + 0.05); lfo.stop(t + d + len + 0.05);
    });
  }

  function pulse() {
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(58, t); o.frequency.exponentialRampToValueAtTime(41, t + 0.5);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.045, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g).connect(pulseBus); o.start(t); o.stop(t + 1);
  }

  function bell(f, vol, at) {
    const t = at || ac.currentTime;
    [[1, 1, 3.5], [2.76, 0.25, 1.4], [5.4, 0.08, 0.7]].forEach(([m, a, d]) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = f * m;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * a, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(musicBus); g.connect(rev); o.start(t); o.stop(t + d + 0.05);
    });
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
      voices.forEach((v) => v.g.gain.setTargetAtTime(v.lvl, ac.currentTime, 4));
      retune(0.5);
    },
    stop() { if (!ac) return; on = false; master.gain.setTargetAtTime(0, ac.currentTime, 0.3); },
    fade(v, secs) { if (!ac) return; master.gain.cancelScheduledValues(ac.currentTime); master.gain.setTargetAtTime(v, ac.currentTime, secs / 3); },
    setMix(k, v) { mix[k] = v; applyMix(); },
    setStyle,
    setBeat(hz) { beatTarget = hz; },
    setBin(v) { binOn = v; if (ac) retune(1.5); },

    /** Breath noise follows the guide: brighter while inhaling, softer while exhaling, near-silent on holds. */
    setBreath(level, phase, vis) {
      if (!ac) return;
      const n = ac.currentTime, inn = /^in/.test(phase || ''), out = /^out/.test(phase || '');
      const g = vis * (inn ? 0.02 + 0.045 * level : out ? 0.015 + 0.05 * level : 0.006);
      breathGain.gain.setTargetAtTime(g, n, 0.12);
      breathFilter.frequency.setTargetAtTime(inn ? 420 + 900 * level : 300 + 520 * level, n, 0.15);
    },

    /**
     * Called every frame.
     * @param {number} t animation time (s)  @param {number} c calm 0..1
     * @param {number|null} hr smoothed heart rate  @param {boolean} active session running
     * @param {number} rel heart rate minus baseline: the music follows it (higher HR → brighter and slightly higher pitch)
     */
    tick(t, c, hr, active, rel = 0) {
      if (!ac || !on) return;
      const n = ac.currentTime, r = 1 - c;
      if (S.ocean) {
        const sw = Math.pow(0.5 + 0.5 * Math.sin((t * TAU) / 11), 2);
        lap.gain.setTargetAtTime(0.012 + 0.055 * sw, n, 0.6); lapF.frequency.setTargetAtTime(260 + 380 * sw, n, 0.6);
      } else {
        lap.gain.setTargetAtTime(0.022 + 0.018 * r + 0.008 * Math.sin(t * 0.5), n, 0.8); lapF.frequency.setTargetAtTime(360 + 240 * r + 60 * Math.sin(t * 0.2), n, 1);
      }
      wind.gain.setTargetAtTime(0.003 + 0.03 * r * (0.7 + 0.3 * Math.sin(t * 0.23)), n, 1.2);
      windF.frequency.setTargetAtTime(500 + 300 * Math.sin(t * 0.11), n, 1);

      const arousal = clamp((rel + 6) / 14);
      padF.frequency.setTargetAtTime((550 + 1100 * arousal + 200 * Math.sin(t * 0.021)) * S.bright, n, 3);
      const cents = clamp(rel * 9, -140, 110);
      if (Math.abs(cents - lastCents) > 2) {
        lastCents = cents;
        voices.forEach((v) => { v.L.detune.setTargetAtTime(cents, n, 4); v.R.detune.setTargetAtTime(cents, n, 4); });
      }
      if (Math.abs(beatTarget - beat) > 0.04) { beat = beatTarget; retune(2.5); }

      if (n > next.chord) {
        if (S.chords.length > 1) {
          chordIdx = (chordIdx + 1) % S.chords.length;
          S.chords[chordIdx].forEach((s, i) => (voices[i].f = st(s)));
          retune(6);
        }
        next.chord = n + (26 + Math.random() * 14) * Math.min(S.slow, 3);
      }
      if (n > next.grain) { if (S.grain > 0) grain(c); next.grain = n + (lerp(2.2, 0.35, c) * (0.5 + Math.random())) / Math.max(0.1, S.grain); }
      if (n > next.swell) { if (Math.random() < S.swell) swell(); next.swell = n + 14 + Math.random() * 16; }
      if (S.arp && n > next.arp) {
        const ch = S.chords[chordIdx], k = [2, 3, 4, 3][arpI++ % 4];
        note(st(ch[k] + 24), 0.016, 0.02, 1.6, next.arp, arpI % 2 ? -0.35 : 0.35);
        next.arp = Math.max(n, next.arp) + 1.6;
      }
      if (S.tick && active) {
        while (next.tick < n + 0.1) { if (next.tick > n - 0.05) tickSound(next.tick); next.tick += 1; }
      } else next.tick = n + 0.5;
      if (active && hr) { if (n > next.pulse) { pulse(); next.pulse = n + 60 / Math.max(40, hr - S.pulseOff); } } else next.pulse = n + 1;
      if (S.owl && n > next.owl && c > 0.55) { owl(); next.owl = n + 70 + Math.random() * 60; }
      if (S.bird && n > next.bird) { if (c > 0.35) bird(); next.bird = n + 12 + Math.random() * 22; }
    },

    /** Progress chime: one step up the style's scale per lantern / peak / segment. */
    chime(i) {
      if (!on) return;
      bell(st(S.chimeOct + S.scale[(i - 1) % S.scale.length] + (i > S.scale.length ? 12 : 0)), styleName === 'deep' ? 0.035 : 0.05);
    },
    bloom() {
      if (!on) return;
      const t = ac.currentTime;
      [0, 7, 10, 14, 19].forEach((k, j) => bell(st(36 + k + (styleName === 'warm' && k === 10 ? 1 : 0)), 0.04, t + j * 0.22));
    },
    get on() { return on; },
    get binOn() { return binOn; },
    get context() { return ac; },
  };
}

export const audio = createEngine();
