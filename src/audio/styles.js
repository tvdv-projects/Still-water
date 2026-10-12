// Music styles, one per profile. Chords are semitone offsets above D2 (73.42 Hz).
//
// Ambient layers (ambient.js)
//  pad          PADsynth patch for the chords ('pad' wide and soft, 'warm' rounder)
//  padLevel     chord volume; padBright multiplies the low-pass cutoff; padWet = reverb send
//  slow         multiplier on the time between chord changes
//  air          breathy choir swells circling around you (0 = off)
//  shimmer      density of slow glass grains; shimmerLevel their volume; grainEcho = send to the delay
//  dub          muffled chord stabs into the ping-pong delay: { every: [min, max] s, time, feedback }
//  hiss, crackle  tape hiss and vinyl crackle; bed = low brown-noise bed
//
// Rhythm (groove.js), only for the focus and energy profiles
//  groove.bpm   fixed tempo; groove.hr = [min, max, offset] when the tempo follows your heart rate
//  groove.bass  'long' (one note per bar), 'pulse' (eighths), 'line' (a downtempo bass line)
//  groove.arp   chord-tone pattern for the filtered synth; arpEvery = sixteenths per note; arpQ = resonance
//  groove.clicks  glitch clicks (0..1); drums = soft downtempo beat; pump = sidechain depth; swing; echo = delay feedback
//
// Other
//  carrier      pitch (semitones above D2) of the pure tone that carries the binaural beat
//  ocean / fire nature layer; fauna = animals and how often they call (fauna.js); nature = nature volume
//  pulseOff     heart pulse plays at (heart rate − pulseOff) per minute; only without a groove
//  chimeOct     octave of the progress chime; scale = notes for grains and chimes

export const STYLES = {
  // Slaap: Biosphere at night. Dark, slow, no rhythm at all.
  deep: {
    chords: [[0, 7, 12, 15, 19], [-2, 5, 10, 14, 17], [0, 7, 14, 15, 22]],
    scale: [0, 2, 3, 5, 7, 9, 10],
    pad: 'pad', padLevel: 1.1, padBright: 0.65, padWet: 0.9, slow: 1.8,
    air: 0.5, shimmer: 0.25, shimmerLevel: 0.7, grainEcho: 0, dub: null,
    hiss: 0.6, crackle: 0.25, bed: 0,
    carrier: 12, ocean: true, nature: 1, pulseOff: 8, chimeOct: 24,
    fauna: { cricket: [20, 45], frog: [40, 90], owl: [70, 140] },
  },
  // Ontspanning: Loscil / Biosphere. Submerged pads, dub stabs dissolving in echoes, crackle.
  glacial: {
    chords: [[0, 7, 12, 15, 22], [-4, 3, 10, 14, 19], [-2, 5, 12, 17, 21], [0, 7, 14, 17, 24], [-5, 2, 9, 12, 19]],
    scale: [0, 2, 3, 5, 7, 9, 10],
    pad: 'pad', padLevel: 1, padBright: 0.85, padWet: 0.8, slow: 1,
    air: 1, shimmer: 0.8, shimmerLevel: 1, grainEcho: 0.4,
    dub: { every: [5, 12], time: 0.62, feedback: 0.62 },
    hiss: 1, crackle: 1, bed: 0,
    carrier: 12, ocean: false, nature: 1, pulseOff: 6, chimeOct: 36,
    fauna: { cricket: [25, 50], frog: [45, 90], loon: [60, 120], owl: [80, 150] },
  },
  // Ontspannen focus: Carbon Based Lifeforms without a beat. Warm pads, long bass notes, filtered sequence.
  warm: {
    chords: [[0, 7, 12, 16, 21], [-3, 4, 9, 12, 19], [2, 9, 14, 18, 21], [-5, 2, 7, 11, 16]],
    scale: [0, 2, 4, 6, 7, 9, 11],
    pad: 'warm', padLevel: 0.9, padBright: 1.15, padWet: 0.7, slow: 0.9,
    air: 0.5, shimmer: 0.35, shimmerLevel: 0.8, grainEcho: 0.3, dub: null,
    hiss: 0.5, crackle: 0.2, bed: 0,
    groove: { bpm: 80, hr: [62, 96, 0], bass: 'long', arp: [0, 2, 3, 1, 3, 2, 4, 2], arpEvery: 2, arpQ: 6, clicks: 0, drums: false, pump: 0, swing: 0.04, echo: 0.5 },
    carrier: 12, ocean: false, nature: 0.8, pulseOff: 4, chimeOct: 36,
    fauna: { bird: [12, 34], cuckoo: [50, 110], woodpecker: [70, 140] },
  },
  // Volle focus: AES Dana minimal. One drone, a pulsing bass, tiny glitch clicks in the echo. No melody.
  minimal: {
    chords: [[0, 7, 12, 19, 24]],
    scale: [0, 7, 12],
    pad: 'warm', padLevel: 0.75, padBright: 0.9, padWet: 0.6, slow: 99,
    air: 0, shimmer: 0.12, shimmerLevel: 0.6, grainEcho: 0.3, dub: null,
    hiss: 0.4, crackle: 0, bed: 0.04,
    groove: { bpm: 88, hr: [66, 100, 0], bass: 'pulse', arp: null, clicks: 0.45, drums: false, pump: 0, swing: 0, echo: 0.55 },
    carrier: 19, ocean: false, nature: 0.25, pulseOff: 0, chimeOct: 36,
    fauna: { cricket: [40, 80], owl: [120, 200] },
  },
  // Energie: Carbon Based Lifeforms downtempo. Beat, bass line, a sixteenth-note sequence that opens up.
  bright: {
    chords: [[0, 7, 12, 16, 19], [5, 12, 17, 21, 24], [-3, 4, 9, 12, 19], [7, 14, 19, 23, 26]],
    scale: [0, 2, 4, 7, 9, 12, 14],
    pad: 'warm', padLevel: 0.85, padBright: 1.3, padWet: 0.55, slow: 0.7,
    air: 0.3, shimmer: 0.4, shimmerLevel: 0.8, grainEcho: 0.3, dub: null,
    hiss: 0.4, crackle: 0, bed: 0,
    groove: { bpm: 94, hr: [78, 112, 6], bass: 'line', arp: [0, 1, 2, 3, 2, 1, 3, 2, 0, 2, 1, 3], arpEvery: 1, arpQ: 8, clicks: 0.15, drums: true, pump: 0.35, swing: 0.08, echo: 0.45 },
    carrier: 19, fire: true, ocean: false, nature: 0.9, pulseOff: -6, chimeOct: 36,
    fauna: { cricket: [15, 30], nightjar: [50, 100], owl: [80, 150], wolf: [90, 180] },
  },
};
