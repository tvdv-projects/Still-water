// The single whispered message line in the middle of the screen.

import { $ } from './dom.js';

let timer;

/** Show `text` for `ms` milliseconds, replacing any message that is still visible. */
export function msg(text, ms = 3800) {
  const el = $('msg');
  el.classList.remove('on');
  clearTimeout(timer);
  timer = setTimeout(() => {
    el.textContent = text;
    el.classList.add('on');
    timer = setTimeout(() => el.classList.remove('on'), ms);
  }, 300);
}
