// Vrij (free mode): pick your own background, music, binaural beat and any breathing technique.
// There is no goal and no progress to earn: the scene still breathes with your heart rate (calmer
// heart → calmer, warmer picture), but nothing lights up step by step.
//
// freeProfile(settings) turns the stored settings into an object with the same shape as the entries
// of PROFILES, so the rest of the app (scenes, HUD, breath bar) can treat it like any other profile.

import { clamp, easeIO } from '../core/math.js';
import { BREATHS } from './breathing.js';
import { PROFILES } from './profiles.js';

/** Backgrounds: borrowed from a profile (scene, variant and colour accent). */
export const LOOKS = [
  { key: 'rust', name: 'Nachtmeer' },
  { key: 'slaap', name: 'Nachtmeer, diep in de nacht' },
  { key: 'ochtend', name: 'Ochtendveld' },
  { key: 'focus', name: 'Bergmeer bij dageraad' },
  { key: 'volle', name: 'Kaarsvlam' },
  { key: 'energie', name: 'Kampvuur' },
];

/** Music: 'auto' follows the background; otherwise one of the styles in audio/styles.js. */
export const MUSIC = [
  { key: 'auto', name: 'Bij de achtergrond' },
  { key: 'deep', name: 'Diep en donker (Slaap)' },
  { key: 'glacial', name: 'IJl en zwevend (Ontspanning)' },
  { key: 'morning', name: 'Warm en zwevend (Ochtend)' },
  { key: 'warm', name: 'Warm met sequence (Ontspannen focus)' },
  { key: 'minimal', name: 'Minimaal (Volle focus)' },
  { key: 'bright', name: 'Downtempo met beat (Energie)' },
];

/** All breathing techniques, grouped for the chooser. */
export const BREATH_GROUPS = [
  { name: 'Rustig', keys: ['b478', 'long48', 'long46', 'belly57', 'reso55', 'reso5', 'sigh'] },
  { name: 'In balans', keys: ['equal', 'box', 'nadi'] },
  { name: 'Activerend', keys: ['longIn', 'stairs', 'fire'] },
];
export const ALL_BREATHS = BREATH_GROUPS.flatMap((g) => g.keys);

/** A technique's name, with its rhythm added when two techniques share a name. */
export function breathLabel(key) {
  const b = BREATHS[key];
  const twins = Object.values(BREATHS).filter((x) => x.name === b.name).length > 1;
  if (!twins) return b.name;
  const secs = b.steps.map(([, s]) => String(s).replace('.', ',')).join('-');
  return `${b.name} ${secs}`;
}

export const BEAT_RANGE = [1, 30];
export const CARRIER_RANGE = [60, 400];

export const DEFAULT_FREE = {
  look: 'rust',
  music: 'auto',
  mode: 'fixed', // 'fixed' or 'ramp'
  beat: 8,
  from: 12,
  to: 6,
  carrier: null, // Hz, or null = the carrier of the music style
};

/** Clean up stored settings: unknown keys and out-of-range numbers fall back to the defaults. */
export function normalizeFree(s = {}) {
  const out = { ...DEFAULT_FREE, ...s };
  if (!LOOKS.some((l) => l.key === out.look)) out.look = DEFAULT_FREE.look;
  if (!MUSIC.some((m) => m.key === out.music)) out.music = DEFAULT_FREE.music;
  if (out.mode !== 'ramp') out.mode = 'fixed';
  for (const k of ['beat', 'from', 'to']) out[k] = clamp(Number(out[k]) || DEFAULT_FREE[k], ...BEAT_RANGE);
  out.carrier = out.carrier == null ? null : clamp(Number(out.carrier) || 0, ...CARRIER_RANGE);
  return out;
}

/** The brain-wave band a beat frequency belongs to, for the label next to the slider. */
export function bandName(hz) {
  if (hz < 4) return 'delta · diepe slaap';
  if (hz < 8) return 'theta · diepe ontspanning';
  if (hz < 13) return 'alfa · ontspannen wakker';
  if (hz < 20) return 'laag bèta · gefocust';
  return 'bèta · alert';
}

/**
 * The beat at a point in the session. Fixed: always the chosen frequency. Ramp: eases from `from` to
 * `to` over the session (an unlimited session takes 20 minutes, then stays at `to`).
 * @param {object} s settings  @param {number} elapsed seconds  @param {number} durMin 0 = unlimited
 */
export function beatFor(s, elapsed, durMin) {
  if (s.mode !== 'ramp') return s.beat;
  const span = (durMin > 0 ? durMin : 20) * 60;
  return s.from + (s.to - s.from) * easeIO(clamp(elapsed / span));
}

/** A profile-shaped object for the current free settings. */
export function freeProfile(settings) {
  const s = normalizeFree(settings), base = PROFILES[s.look];
  return {
    name: 'Vrij',
    free: true,
    look: s.look,
    scene: base.scene,
    variant: base.variant,
    style: s.music === 'auto' ? base.style : s.music,
    // How the scene reads your heart: like its own profile (a campfire flares as you warm up,
    // a candle calms when steady, the rest when your heart rate drops), but without a goal.
    goal: 'free',
    sceneGoal: base.goal,
    band: base.band,
    breaths: ALL_BREATHS,
    accent: base.accent,
    title: 'Vrij',
    desc: 'Kies zelf je achtergrond, muziek, binaural beat en ademhaling. Geen doel en geen voortgang: het beeld beweegt wel mee met je hartslag. Een hartslagmeter mag, maar hoeft niet.',
  };
}
