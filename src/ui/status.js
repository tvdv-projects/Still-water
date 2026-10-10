// Connection status chip under the title.

import { $ } from './dom.js';

/** @param {''|'live'|'test'} kind */
export function setStatus(kind, text) {
  $('chip').className = 'chip ' + kind;
  $('chipText').textContent = text;
}

export const CONNECT_NOTE = 'Zet op je Garmin <b>Hartslag uitzenden</b> aan en kies daarna je horloge in de lijst. Op de iPhone werkt dit in de Bluefy-browser.';
