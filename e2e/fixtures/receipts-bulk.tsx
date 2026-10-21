import { createRoot } from 'react-dom/client';
import { AttachmentStorage } from '../../src/renderer/pages/settings/content/AttachmentStorage';
import { toDataUrl } from '../../src/renderer/shared/utils/dataUrlFunctions';
import '../../src/renderer/i18n';

const sample = async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 2200;
  const context = canvas.getContext('2d')!;
  const pixels = context.createImageData(canvas.width, canvas.height);
  let seed = 17;
  for (let i = 0; i < pixels.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const value = 235 + (seed >>> 27);
    pixels.data.set([value, value, value - 4, 255], i);
  }
  context.putImageData(pixels, 0, 0);
  context.fillStyle = '#111';
  context.font = '48px monospace';
  context.fillText('DEMO RECEIPT — TOTAL $76.14', 80, 180);
  const blob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!), 'image/png'));
  canvas.width = 0;
  canvas.height = 0;
  return (await toDataUrl(blob)).split(',')[1];
};
declare global {
  interface Window {
    bulkReceiptSample: typeof sample;
  }
}
window.bulkReceiptSample = sample;
createRoot(document.getElementById('root')!).render(<AttachmentStorage />);
