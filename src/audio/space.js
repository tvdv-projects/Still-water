// The sense of space: a deep dark reverb, a dub-style ping-pong delay, and 3D "orbits" that slowly
// circle sounds around your head (HRTF, best with earphones).

import { impulseResponse } from './dsp.js';

/**
 * @param {AudioContext} ac
 * @param {AudioNode} out where the wet signals end up (the music bus)
 */
export function createSpace(ac, out) {
  // Reverb.
  const reverb = ac.createConvolver();
  const [L, R] = impulseResponse({ sampleRate: ac.sampleRate, seconds: 9, rt60: 7.5, darkness: 0.8 });
  const ir = ac.createBuffer(2, L.length, ac.sampleRate);
  ir.getChannelData(0).set(L); ir.getChannelData(1).set(R);
  reverb.buffer = ir;
  const revOut = ac.createGain(); revOut.gain.value = 0.55;
  reverb.connect(revOut).connect(out);

  // Ping-pong delay with a dub feedback loop: every repeat is a little darker and thinner.
  const delayIn = ac.createGain();
  const dl = ac.createDelay(4), dr = ac.createDelay(4);
  const fb = ac.createGain(); fb.gain.value = 0.5;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = 0.5;
  const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 220;
  const merge = ac.createChannelMerger(2), delayOut = ac.createGain(); delayOut.gain.value = 0.8;
  const mono = ac.createGain(); mono.channelCount = 1; mono.channelCountMode = 'explicit';
  delayIn.connect(mono).connect(dl);
  dl.connect(dr);
  dr.connect(lp).connect(hp).connect(fb).connect(dl);
  dl.connect(merge, 0, 0); dr.connect(merge, 0, 1);
  merge.connect(delayOut); delayOut.connect(out); delayOut.connect(reverb);
  dl.delayTime.value = dr.delayTime.value = 0.56;

  // Orbits: HRTF panners whose position slowly circles the listener.
  const hrtf = typeof ac.createPanner === 'function';
  const orbits = [0, 1, 2].map((i) => {
    const input = ac.createGain();
    let node = input;
    if (hrtf) {
      const p = ac.createPanner();
      p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 1.5; p.rolloffFactor = 0.6;
      input.connect(p); node = p;
      // Glide to each new position instead of jumping: jumps in an HRTF panner are heard as crackles,
      // especially when the main thread is busy and updates arrive unevenly.
      p._set = (x, y, z) => {
        if (p.positionX) {
          const n = ac.currentTime;
          p.positionX.setTargetAtTime(x, n, 0.12); p.positionY.setTargetAtTime(y, n, 0.12); p.positionZ.setTargetAtTime(z, n, 0.12);
        } else p.setPosition(x, y, z);
      };
    }
    node.connect(out); node.connect(reverb);
    return { input, node, period: [47, 61, 83][i], phase: i * 2.1, radius: [2.2, 3, 4][i], tilt: [0.4, -0.2, 0.9][i] };
  });

  let lastMove = -1;
  return {
    reverb,
    delay: delayIn,
    orbits: orbits.map((o) => o.input),
    /** Set the delay to a musical time and its feedback (0..0.85). */
    setDelay(seconds, feedback = 0.5, tc = 0.5) {
      const n = ac.currentTime;
      dl.delayTime.setTargetAtTime(seconds, n, tc); dr.delayTime.setTargetAtTime(seconds, n, tc);
      fb.gain.setTargetAtTime(Math.min(0.85, feedback), n, 0.5);
    },
    /** Move the orbits; call every frame with animation time t. */
    tick(t) {
      if (!hrtf || t - lastMove < 0.1) return; // ten updates a second is plenty for orbits of a minute
      lastMove = t;
      for (const o of orbits) {
        const a = o.phase + (t * 2 * Math.PI) / o.period;
        o.node._set(Math.sin(a) * o.radius, o.tilt + 0.4 * Math.sin(a * 0.5), -Math.cos(a) * o.radius);
      }
    },
  };
}
