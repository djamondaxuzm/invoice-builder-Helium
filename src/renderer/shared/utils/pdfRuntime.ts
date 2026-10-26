import { Buffer } from 'buffer/';

// React PDF's browser layout checks Buffer before assigning image cache keys.
// Without this shim it catches a ReferenceError and embeds shared logos repeatedly.
if (typeof globalThis.Buffer === 'undefined') {
  Object.assign(globalThis, { Buffer });
}
