// Small numeric and colour helpers shared by every module.

export const TAU = Math.PI * 2;

/** Clamp `v` to the range [a, b]. */
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

/** Linear interpolation from `a` to `b` by `t`. */
export const lerp = (a, b, t) => a + (b - a) * t;

/** Interpolate two RGB triplets. */
export const mix3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/** CSS rgba() string from an RGB triplet. */
export const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

/** Quadratic ease-in-out on [0, 1]. */
export const easeIO = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

/** Uniform random number in [a, b). */
export const rnd = (a, b) => a + Math.random() * (b - a);

/** Frame-rate independent smoothing factor for an exponential approach with time constant `tau` seconds. */
export const smoothing = (dt, tau) => 1 - Math.exp(-dt / tau);
