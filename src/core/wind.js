// A slow, irregular wind for the sound of the Ochtend scene (wind over the field).

/** Gust strength at animation time t (seconds), roughly 0.1..1, changing over tens of seconds. */
export function gust(t) {
  const a = 0.5 + 0.5 * Math.sin(t * 0.23) * Math.sin(t * 0.071 + 1.3);
  const b = 0.5 + 0.5 * Math.sin(t * 0.041 + 2.1);
  return 0.1 + 0.9 * Math.pow(a, 1.4) * (0.55 + 0.45 * b);
}
