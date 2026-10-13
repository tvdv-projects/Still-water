// Heart rate over Bluetooth Low Energy using the standard Heart Rate Service (0x180D).
// Works with any device that broadcasts it, e.g. a Garmin watch with "Broadcast heart rate" on,
// or a chest strap. Requires Web Bluetooth: Chrome on desktop/Android, or Bluefy on iOS.

import { recordRR, recordSample } from '../state.js';
import { $ } from '../ui/dom.js';
import { setStatus } from '../ui/status.js';

/**
 * Parse a Heart Rate Measurement characteristic value (0x2A37).
 * Flags byte: bit 0 = heart rate is uint16 (else uint8), bit 3 = energy expended (uint16) present,
 * bit 4 = one or more RR intervals (uint16, in 1/1024 s) follow. Chest straps send RR intervals;
 * watches broadcasting heart rate usually do not.
 * @param {DataView} v
 * @returns {{hr: number, rr: number[]}} heart rate in bpm and RR intervals in ms
 */
export function parseMeasurement(v) {
  const flags = v.getUint8(0);
  let i = 1;
  const hr = flags & 1 ? v.getUint16(i, true) : v.getUint8(i);
  i += flags & 1 ? 2 : 1;
  if (flags & 0x08) i += 2;
  const rr = [];
  if (flags & 0x10) for (; i + 1 < v.byteLength; i += 2) rr.push(Math.round((v.getUint16(i, true) * 1000) / 1024));
  return { hr, rr };
}

/** Heart rate only (kept for callers that do not need RR intervals). */
export const parseHeartRate = (v) => parseMeasurement(v).hr;

async function attach(device) {
  const server = await device.gatt.connect();
  const service = await server.getPrimaryService('heart_rate');
  const ch = await service.getCharacteristic('heart_rate_measurement');
  ch.addEventListener('characteristicvaluechanged', (e) => {
    const { hr, rr } = parseMeasurement(e.target.value);
    recordSample(hr);
    if (rr.length) recordRR(rr);
  });
  await ch.startNotifications();
  if (!device._wired) {
    device._wired = true;
    device.addEventListener('gattserverdisconnected', async () => {
      setStatus('', 'Verbinding kwijt, opnieuw verbinden…');
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
        try {
          await attach(device);
          setStatus('live', device.name || 'Hartslagmeter');
          return;
        } catch {
          /* try again */
        }
      }
      setStatus('', 'Niet verbonden');
    });
  }
}

/** Ask the user to pick a heart-rate device and start listening. Calls `onConnected(name)` on success. */
export async function connectHeartRate(onConnected) {
  const note = $('connNote');
  if (!navigator.bluetooth) {
    note.innerHTML = '<span class="err">Deze browser kan geen bluetooth gebruiken.</span> Open deze pagina in Chrome op een laptop of Android, of in Bluefy op de iPhone. Je kunt ook de testmodus proberen.';
    return;
  }
  try {
    note.textContent = 'Kies je horloge in de lijst…';
    const device = await navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] });
    await attach(device);
    setStatus('live', device.name || 'Hartslagmeter');
    onConnected(device.name);
  } catch (e) {
    const name = e && e.name;
    const help = document.getElementById('pairHelp');
    if (help && name !== 'SecurityError' && name !== 'NotAllowedError') help.open = true;
    if (name === 'NotFoundError') note.textContent = 'Geen apparaat gekozen. Staat "Hartslag uitzenden" aan op je horloge? Zie hieronder hoe je koppelt.';
    else if (name === 'SecurityError' || name === 'NotAllowedError') note.innerHTML = '<span class="err">Bluetooth is hier geblokkeerd.</span> Deze weergave staat geen bluetooth toe. Open je eigen online versie in Bluefy of Chrome, of probeer de testmodus.';
    else note.innerHTML = '<span class="err">Verbinden lukte niet.</span> Zet "Hartslag uitzenden" uit en weer aan, en probeer het opnieuw.';
  }
}
