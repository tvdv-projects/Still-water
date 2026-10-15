// Occasional animal sounds, all synthesised. Each style lists which animals live in its scene and how
// often they call (see `fauna` in styles.js). Every call gets a random place around your head (3D audio)
// and some reverb, so the animals sound distant and spread around you rather than in your ear.
//
// Levels are deliberately low: the animals should be something you notice now and then, not something
// that pulls you out of the session.

const rand = (a, b) => a + Math.random() * (b - a);

/**
 * @param {AudioContext} ac
 * @param {AudioNode} out  nature bus (dry)
 * @param {AudioNode} rev  shared reverb (wet)
 */
export function createFauna(ac, out, rev) {
  const noise = (() => {
    const b = ac.createBuffer(1, ac.sampleRate * 0.05, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  })();

  /**
   * Route a sound to a place around you, with `wet` reverb. `pan` (-1..1) sets the direction:
   * with 3D audio (HRTF) the animal is placed on a circle around your head, a few metres away,
   * sometimes behind you; otherwise it falls back to plain stereo panning.
   */
  function place(wet = 0.4, pan = rand(-0.85, 0.85), dry = 1) {
    const input = ac.createGain();
    const dg = ac.createGain(); dg.gain.value = dry;
    const wg = ac.createGain(); wg.gain.value = wet;
    let node = input;
    if (typeof ac.createPanner === 'function') {
      const p = ac.createPanner(), a = pan * Math.PI * (Math.random() < 0.3 ? 0.95 : 0.6), d = rand(2.5, 6);
      p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 2; p.rolloffFactor = 0.5;
      const [x, y, z] = [Math.sin(a) * d, rand(-0.3, 1.5), -Math.cos(a) * d];
      if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z);
      input.connect(p); node = p;
    } else if (ac.createStereoPanner) {
      const p = ac.createStereoPanner(); p.pan.value = pan; input.connect(p); node = p;
    }
    node.connect(dg); node.connect(wg);
    dg.connect(out); wg.connect(rev);
    return input;
  }

  const osc = (type, f) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; return o; };
  const vibrato = (o, rate, cents, t0, t1) => {
    const l = osc('sine', rate), g = ac.createGain(); g.gain.value = cents;
    l.connect(g).connect(o.detune); l.start(t0); l.stop(t1);
  };

  return {
    /** A tawny owl: a short hoot, then a long wavering one. */
    owl() {
      const t = ac.currentTime + 0.05, dest = place(0.5, rand(-0.7, 0.7), 0.8);
      [[0, 392, 0.32], [0.55, 352, 0.9]].forEach(([d, f, len]) => {
        const o = osc('sine', f), g = ac.createGain();
        vibrato(o, 6, 28, t + d, t + d + len + 0.05);
        g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(0.015, t + d + 0.06);
        g.gain.setValueAtTime(0.015, t + d + len - 0.1); g.gain.linearRampToValueAtTime(0, t + d + len);
        o.connect(g).connect(dest); o.start(t + d); o.stop(t + d + len + 0.05);
      });
    },

    /** A small songbird: a few quick rising whistles. */
    bird() {
      const t = ac.currentTime + 0.05, dest = place(0.45);
      const notes = 2 + ((Math.random() * 4) | 0), base = rand(2600, 3800);
      for (let k = 0, s = t; k < notes; k++, s += rand(0.11, 0.17)) {
        const o = osc('sine', base), g = ac.createGain();
        o.frequency.setValueAtTime(base * rand(1, 1.15), s); o.frequency.exponentialRampToValueAtTime(base * rand(1.25, 1.45), s + 0.07);
        g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.008, s + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.09);
        o.connect(g).connect(dest); o.start(s); o.stop(s + 0.1);
      }
    },

    /** A cricket chirps for a few seconds: triplets of tiny pulses, fading in and out. */
    cricket() {
      const t = ac.currentTime + 0.05, dur = rand(4, 11), per = rand(0.55, 0.9);
      const o = osc('sine', rand(4200, 5100)), g = ac.createGain(), dest = place(0.25);
      g.gain.value = 0;
      for (let s = t; s < t + dur; s += per * rand(0.95, 1.05)) {
        const v = 0.0045 * Math.sin((Math.PI * (s - t)) / dur);
        for (let k = 0; k < 3; k++) {
          const a = s + k * 0.028;
          g.gain.setValueAtTime(0, a); g.gain.linearRampToValueAtTime(v, a + 0.006); g.gain.linearRampToValueAtTime(0, a + 0.018);
        }
      }
      o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.2);
    },

    /** A frog: two to four low, rattling croaks. */
    frog() {
      const t = ac.currentTime + 0.05, n = 2 + ((Math.random() * 3) | 0), f = rand(85, 135), dest = place(0.35);
      for (let k = 0; k < n; k++) {
        const s = t + k * rand(0.45, 0.65), len = rand(0.18, 0.3);
        const o = osc('sawtooth', f), bp = ac.createBiquadFilter(), env = ac.createGain(), am = ac.createGain();
        const lfo = osc('square', rand(18, 26)), lg = ac.createGain();
        bp.type = 'bandpass'; bp.frequency.value = rand(450, 700); bp.Q.value = 3;
        am.gain.value = 0.5; lg.gain.value = 0.5; lfo.connect(lg).connect(am.gain);
        o.frequency.setValueAtTime(f * 1.08, s); o.frequency.linearRampToValueAtTime(f * 0.92, s + len);
        env.gain.setValueAtTime(0, s); env.gain.linearRampToValueAtTime(0.03, s + 0.03); env.gain.linearRampToValueAtTime(0, s + len);
        o.connect(bp).connect(am).connect(env).connect(dest);
        [o, lfo].forEach((x) => { x.start(s); x.stop(s + len + 0.05); });
      }
    },

    /** A loon across the lake: a slow wail that climbs, holds and falls back. Very wet, far away. */
    loon() {
      const t = ac.currentTime + 0.05, f = rand(480, 560), dest = place(1, rand(-0.6, 0.6), 0.35);
      const o = osc('sine', f), o2 = osc('sine', f * 2), g2 = ac.createGain(), g = ac.createGain();
      g2.gain.value = 0.18;
      const fr = (x) => [o.frequency, o2.frequency].forEach((p, i) => x(p, i ? 2 : 1));
      fr((p, m) => { p.setValueAtTime(f * m, t); p.exponentialRampToValueAtTime(f * 1.5 * m, t + 0.8); p.setValueAtTime(f * 1.5 * m, t + 2.1);
        p.exponentialRampToValueAtTime(f * 2 * m, t + 2.6); p.setValueAtTime(f * 2 * m, t + 3.4); p.exponentialRampToValueAtTime(f * 1.5 * m, t + 4); });
      vibrato(o, 5, 10, t, t + 4.8); vibrato(o2, 5, 10, t, t + 4.8);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.012, t + 0.5); g.gain.setValueAtTime(0.012, t + 3.8); g.gain.linearRampToValueAtTime(0, t + 4.7);
      o.connect(g); o2.connect(g2).connect(g); g.connect(dest);
      [o, o2].forEach((x) => { x.start(t); x.stop(t + 4.8); });
    },

    /** A cuckoo in the distance: a falling two-note call, a few times. */
    cuckoo() {
      const t = ac.currentTime + 0.05, n = 2 + ((Math.random() * 4) | 0), f = rand(700, 780), dest = place(0.6);
      for (let k = 0; k < n; k++) {
        [[0, f, 0.17], [0.3, f * 0.8, 0.3]].forEach(([d, fr, len]) => {
          const s = t + k * 0.95 + d, o = osc('sine', fr), g = ac.createGain();
          o.frequency.setValueAtTime(fr * 1.02, s); o.frequency.linearRampToValueAtTime(fr * 0.97, s + len);
          g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.012, s + 0.03); g.gain.linearRampToValueAtTime(0, s + len);
          o.connect(g).connect(dest); o.start(s); o.stop(s + len + 0.05);
        });
      }
    },

    /** A woodpecker drumming on a far tree: a quick roll of knocks that fades. */
    woodpecker() {
      const t = ac.currentTime + 0.05, n = 12 + ((Math.random() * 8) | 0), gap = rand(0.045, 0.06), dest = place(0.5);
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = rand(900, 1400); bp.Q.value = 4;
      bp.connect(dest);
      for (let k = 0; k < n; k++) {
        const s = t + k * gap * (1 + k * 0.012), src = ac.createBufferSource(), g = ac.createGain();
        src.buffer = noise;
        g.gain.setValueAtTime(0.09 * (1 - (k / n) * 0.6), s); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.012);
        src.connect(g).connect(bp); src.start(s); src.stop(s + 0.02);
      }
    },

    /** A nightjar churring: a long, soft mechanical trill. */
    nightjar() {
      const t = ac.currentTime + 0.05, dur = rand(4, 8), dest = place(0.4);
      const o = osc('triangle', rand(1050, 1200)), bp = ac.createBiquadFilter(), am = ac.createGain(), env = ac.createGain();
      const lfo = osc('square', rand(28, 36)), lg = ac.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 2;
      am.gain.value = 0.5; lg.gain.value = 0.5; lfo.connect(lg).connect(am.gain);
      for (let s = t + rand(1, 2); s < t + dur - 0.5; s += rand(1, 2.2)) o.frequency.setTargetAtTime(rand(1000, 1250), s, 0.08);
      env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(0.006, t + 0.4); env.gain.setValueAtTime(0.006, t + dur - 0.5); env.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(bp).connect(am).connect(env).connect(dest);
      [o, lfo].forEach((x) => { x.start(t); x.stop(t + dur + 0.05); });
    },

    /** A wolf far away, sometimes answered by a second one. */
    wolf() {
      const t0 = ac.currentTime + 0.05, voices = Math.random() < 0.5 ? 2 : 1;
      for (let v = 0; v < voices; v++) {
        const t = t0 + v * rand(1.2, 2), f = rand(330, 380) * (v ? 1.12 : 1), dest = place(1, rand(-0.8, 0.8), 0.3);
        const o = osc('triangle', f), lp = ac.createBiquadFilter(), g = ac.createGain();
        lp.type = 'lowpass'; lp.frequency.value = 1100;
        o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.6, t + 1.2);
        o.frequency.setValueAtTime(f * 1.6, t + 2.6); o.frequency.exponentialRampToValueAtTime(f * 1.05, t + 4);
        vibrato(o, 4.5, 12, t, t + 4.2);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.01, t + 0.6); g.gain.setValueAtTime(0.01, t + 3); g.gain.linearRampToValueAtTime(0, t + 4.1);
        o.connect(lp).connect(g).connect(dest); o.start(t); o.stop(t + 4.2);
      }
    },

    /**
     * One goose honk, from direction `pan` (−1 left … 1 right): a short nasal "hönk", rising then
     * falling, sometimes a double. Called by the Ochtend scene while a skein flies over.
     */
    goose(pan = rand(-0.8, 0.8)) {
      const t = ac.currentTime + 0.02, dest = place(0.45, pan, 0.9);
      const n = Math.random() < 0.3 ? 2 : 1, f0 = rand(330, 420);
      for (let k = 0; k < n; k++) {
        const s = t + k * rand(0.16, 0.22), len = rand(0.14, 0.22);
        const o = osc('sawtooth', f0), bp = ac.createBiquadFilter(), bp2 = ac.createBiquadFilter(), g = ac.createGain(), g2 = ac.createGain();
        bp.type = 'bandpass'; bp.frequency.value = rand(800, 1000); bp.Q.value = 2.5;
        bp2.type = 'bandpass'; bp2.frequency.value = rand(1900, 2300); bp2.Q.value = 3; g2.gain.value = 0.45;
        o.frequency.setValueAtTime(f0 * 0.9, s); o.frequency.linearRampToValueAtTime(f0 * 1.08, s + len * 0.35); o.frequency.linearRampToValueAtTime(f0 * 0.85, s + len);
        g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.022, s + 0.02); g.gain.setValueAtTime(0.022, s + len * 0.6); g.gain.linearRampToValueAtTime(0, s + len);
        o.connect(bp).connect(g); o.connect(bp2).connect(g2).connect(g); g.connect(dest);
        o.start(s); o.stop(s + len + 0.05);
      }
    },

    /** A carrion crow, from direction `pan`: two or three hoarse caws. */
    crow(pan = rand(-0.8, 0.8)) {
      const t = ac.currentTime + 0.02, dest = place(0.55, pan, 0.8), n = 2 + ((Math.random() * 2) | 0), f0 = rand(520, 640);
      for (let k = 0; k < n; k++) {
        const s = t + k * rand(0.42, 0.55), len = rand(0.26, 0.34);
        const o = osc('sawtooth', f0), bp = ac.createBiquadFilter(), g = ac.createGain();
        const rough = ac.createBufferSource(), rg = ac.createGain(), rbp = ac.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 1.6;
        rough.buffer = noise; rough.loop = true; rbp.type = 'bandpass'; rbp.frequency.value = 1500; rbp.Q.value = 0.8; rg.gain.value = 0.6;
        o.frequency.setValueAtTime(f0 * 1.05, s); o.frequency.linearRampToValueAtTime(f0 * 0.82, s + len);
        g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.02, s + 0.025); g.gain.setValueAtTime(0.02, s + len * 0.55); g.gain.linearRampToValueAtTime(0, s + len);
        o.connect(bp).connect(g); rough.connect(rbp).connect(rg).connect(g); g.connect(dest);
        o.start(s); o.stop(s + len + 0.05); rough.start(s); rough.stop(s + len + 0.05);
      }
    },

    /** A robin's autumn song: a thin, wistful trickle of high notes, rising and falling. */
    robin() {
      const t = ac.currentTime + 0.05, dest = place(0.4);
      let s = t;
      const phrases = 2 + ((Math.random() * 3) | 0);
      for (let p = 0; p < phrases; p++) {
        const notes = 4 + ((Math.random() * 5) | 0), base = rand(3200, 5600);
        for (let k = 0; k < notes; k++) {
          const len = rand(0.05, 0.14), f = base * rand(0.75, 1.3), o = osc('sine', f), g = ac.createGain();
          o.frequency.setValueAtTime(f, s); o.frequency.exponentialRampToValueAtTime(f * rand(0.8, 1.25), s + len);
          g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.006, s + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, s + len);
          o.connect(g).connect(dest); o.start(s); o.stop(s + len + 0.02);
          s += len + rand(0.02, 0.07);
        }
        s += rand(0.5, 1.4);
      }
    },
  };
}
