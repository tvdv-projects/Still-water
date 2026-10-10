// Breathing techniques. Each technique is a cycle of [phase, seconds] steps.
// Phases starting with 'in' fill the guide, phases starting with 'out' empty it,
// every other phase (hold, hold2, rest) keeps the current level.
// `shape` selects the visual guide: default ring segments, 'box' or 'nadi'.

export const BREATHS = {
  b478: { name: '4-7-8', steps: [['in', 4], ['hold', 7], ['out', 8]], hint: 'Adem in door je neus, houd ontspannen vast, en blaas lang uit door je mond.' },
  long48: { name: 'Lange uitademing', steps: [['in', 4], ['out', 8]], hint: 'Rustig in, en twee keer zo lang uit.' },
  belly57: { name: 'Buikademhaling', steps: [['in', 5], ['out', 7]], hint: 'Laat je buik bewegen, niet je borst.' },
  reso55: { name: 'Resonantie', steps: [['in', 5.5], ['out', 5.5]], hint: 'Zes ademhalingen per minuut. Soepel, zonder pauzes.' },
  sigh: { name: 'Fysiologische zucht', steps: [['in', 2.5], ['in2', 1], ['out', 6], ['rest', 1.5]], hint: 'Twee keer in door je neus, dan lang uit door je mond.', levels: { in: 0.75 } },
  long46: { name: 'Lange uitademing', steps: [['in', 4], ['out', 6]], hint: 'Rustig in, langer uit.' },
  reso5: { name: 'Resonantie', steps: [['in', 5], ['out', 5]], hint: 'Soepel in en uit, zonder pauzes.' },
  box: { name: 'Box', shape: 'box', steps: [['in', 4], ['hold', 4], ['out', 4], ['hold2', 4]], hint: 'Volg het lichtpunt langs het vierkant.' },
  nadi: { name: 'Wisselende neusgaten', shape: 'nadi', steps: [['inL', 4], ['outR', 4], ['inR', 4], ['outL', 4]], hint: 'Sluit met je duim of vinger het andere neusgat. Volg de oplichtende kant.' },
  equal: { name: 'Gelijke ademhaling', steps: [['in', 4], ['out', 4]], hint: 'Even lang in als uit. Rustig en alert.' },
};

export const STEP_LABEL = {
  in: 'In', in2: 'Nog een beetje in', hold: 'Vasthouden', hold2: 'Vasthouden', out: 'Uit', rest: 'Rust',
  inL: 'In · links', inR: 'In · rechts', outL: 'Uit · links', outR: 'Uit · rechts',
};

/** Level the guide moves to during a phase; phases not listed hold their level. */
export const STEP_TO = { in: 1, in2: 1, inL: 1, inR: 1, out: 0, outL: 0, outR: 0 };

/** Duration of one full cycle in seconds. */
export const cycleSeconds = (key) => BREATHS[key].steps.reduce((s, [, d]) => s + d, 0);
