// Music styles, one per profile. Chords are semitone offsets above D2 (73.42 Hz).
//  grain   density of high "ice" grains (0 = off)
//  swell   chance of a slow distant swell every 14–30 s
//  arp     repeating chord-tone pattern; arpEvery = seconds between notes, arpPattern = chord voices to cycle
//  tick    soft clock tick at 60/min (minimal style)
//  bed     level of a low brown-noise bed
//  ocean   water layer swells like slow waves
//  owl / bird  occasional nature sounds
//  fire    crackling fire and a low roar instead of water (Energie)
//  perc    soft shaker on the off-beat of the heart-rate pulse
//  bright  multiplier on the drone's low-pass cutoff
//  slow    multiplier on the time between chord changes
//  pulseOff  the sub pulse plays at (heart rate − pulseOff) per minute; negative = faster than your heart
//  nature  multiplier on the nature bus
//  chimeOct  octave (in semitones above D2) of the progress chime

export const STYLES = {
  deep: {
    chords: [[-12, -5, 0, 3, 7], [-14, -7, -2, 3, 5], [-12, -5, 2, 5, 10]],
    scale: [0, 2, 3, 5, 7, 9, 10],
    grain: 0, swell: 0.3, arp: false, tick: false, bed: 0, ocean: true, owl: true, bird: false,
    bright: 0.55, slow: 1.8, pulseOff: 8, nature: 1, chimeOct: 24,
  },
  glacial: {
    chords: [[0, 7, 12, 15, 22], [-4, 3, 10, 14, 19], [-2, 5, 12, 17, 21], [0, 7, 14, 17, 24], [-5, 2, 9, 12, 19]],
    scale: [0, 2, 3, 5, 7, 9, 10],
    grain: 1, swell: 1, arp: false, tick: false, bed: 0, ocean: false, owl: true, bird: false,
    bright: 1, slow: 1, pulseOff: 6, nature: 1, chimeOct: 36,
  },
  warm: {
    chords: [[0, 7, 12, 16, 21], [-3, 4, 9, 12, 19], [2, 9, 14, 18, 21], [-5, 2, 7, 11, 16]],
    scale: [0, 2, 4, 6, 7, 9, 11],
    grain: 0.45, swell: 0.7, arp: true, arpEvery: 1.6, arpPattern: [2, 3, 4, 3], tick: false, bed: 0, ocean: false, owl: false, bird: true,
    bright: 1.35, slow: 0.9, pulseOff: 4, nature: 0.8, chimeOct: 36,
  },
  minimal: {
    chords: [[0, 7, 12, 19, 24]],
    scale: [0, 7, 12],
    grain: 0, swell: 0, arp: false, tick: true, bed: 0.05, ocean: false, owl: false, bird: false,
    bright: 0.85, slow: 99, pulseOff: 0, nature: 0.25, chimeOct: 36,
  },
  bright: {
    chords: [[0, 7, 12, 16, 19], [5, 12, 17, 21, 24], [-3, 4, 9, 12, 19], [7, 14, 19, 23, 26]],
    scale: [0, 2, 4, 7, 9, 12, 14],
    grain: 0.7, swell: 0.3, arp: true, arpEvery: 0.42, arpPattern: [1, 2, 3, 4, 3, 2], tick: false, bed: 0, ocean: false, owl: false, bird: false,
    fire: true, perc: true, bright: 1.5, slow: 0.7, pulseOff: -6, nature: 0.9, chimeOct: 36,
  },
};
