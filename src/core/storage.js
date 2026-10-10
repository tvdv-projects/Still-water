// Namespaced localStorage wrapper. Storage can be unavailable (private mode,
// blocked site data), so every access is guarded and falls back to defaults.

const PREFIX = 'stilwater.';

export const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(PREFIX + key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* storage unavailable: preferences simply are not remembered */
    }
  },
};
