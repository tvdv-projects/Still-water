// Heart rate over Bluetooth Low Energy using the standard Heart Rate Service (0x180D).
// Works with any device that broadcasts it, e.g. a Garmin watch with "Broadcast heart rate" on,
// or a chest strap. Requires Web Bluetooth: Chrome on desktop/Android, or Bluefy on iOS.

import { recordSample } from '../state.js';
import { $ } from '../ui/dom.js';
import { setStatus } from '../ui/status.js';

/**
 * Parse a Heart Rate Measurement characteristic value (0x2A37).
 * Bit 0 of the flags byte says whether the value is uint8 or uint16.
 * @param {DataView} v
 */
export function parseHeartRate(v) {
  const flags = v.getUint8(0);
  return flags & 1 ? v.getUint16(1, true) : v.getUint8(1);
}

async function attach(device) {
  const server = await device.gatt.connect();
  const service = await server.getPrimaryService('heart_rate');
  const ch = await service.getCharacteristic('heart_rate_measurement');
  ch.addEventListener('characteristicvaluechanged', (e) => recordSample(parseHeartRate(e.target.value)));
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
    if (name === 'NotFoundError') note.textContent = 'Geen apparaat gekozen. Staat "Hartslag uitzenden" aan op je horloge?';
    else if (name === 'SecurityError' || name === 'NotAllowedError') note.innerHTML = '<span class="err">Bluetooth is hier geblokkeerd.</span> Deze weergave staat geen bluetooth toe. Open je eigen online versie in Bluefy of Chrome, of probeer de testmodus.';
    else note.innerHTML = '<span class="err">Verbinden lukte niet.</span> Zet "Hartslag uitzenden" uit en weer aan, en probeer het opnieuw.';
  }
}
