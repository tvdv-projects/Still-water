// Tiny DOM helpers.

export const $ = (id) => document.getElementById(id);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Mark exactly one button in a group as pressed. */
export function pressOnly(buttons, active) {
  buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === active)));
}

/** Format a number with a Dutch decimal comma. */
export const nl = (n, digits = 1) => n.toFixed(digits).replace('.', ',');
