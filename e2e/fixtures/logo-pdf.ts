import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { createBillingPeriodPdf } from '../../src/renderer/pages/invoices/createBillingPeriodPdf';
import { createPdfBlob } from '../../src/renderer/shared/hooks/fileExport/useExportPdf';
import { getOptimizedLogoUrl } from '../../src/renderer/shared/utils/logoImage';
import { buildBillingPeriod } from '../../src/renderer/shared/utils/billingPeriod';
import { toDataUrl } from '../../src/renderer/shared/utils/dataUrlFunctions';
import { invoice, settings } from '../../src/renderer/__tests__/billingPeriodFixtures';
import type { Invoice, PdfTexts } from '../../src/renderer/shared/types/invoice';
import type { Settings } from '../../src/renderer/shared/types/settings';
import '../../src/renderer/i18n';

const describePdf = async (blob: Blob) => {
  const data = await blob.arrayBuffer();
  const doc = await PDFDocument.load(data);
  const images = doc.context
    .enumerateIndirectObjects()
    .filter(([, obj]) => obj instanceof PDFRawStream && obj.dict.get(PDFName.of('Subtype')) === PDFName.of('Image'));
  return { bytes: blob.size, pages: doc.getPageCount(), images: images.length, url: await toDataUrl(blob) };
};
const makeLogo = async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext('2d')!;
  const pixels = context.createImageData(1024, 1024);
  let seed = 45;
  for (let i = 0; i < pixels.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    pixels.data[i] = 90 + (seed >>> 27);
    pixels.data[i + 1] = 130 + (seed >>> 27);
    pixels.data[i + 2] = 160 + (seed >>> 27);
    pixels.data[i + 3] = 255;
  }
  pixels.data[3] = 0;
  context.putImageData(pixels, 0, 0);
  context.fillStyle = 'white';
  context.font = 'bold 90px sans-serif';
  context.fillText('HELIUM', 320, 510);
  const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
  canvas.width = 0;
  canvas.height = 0;
  return blob;
};
const harness = {
  export: async (invoices: Invoice[], exportSettings: Settings) =>
    describePdf(await createBillingPeriodPdf(buildBillingPeriod(invoices, exportSettings), exportSettings)),
  sample: async () => {
    const source = await makeLogo();
    const bytes = new Uint8Array(await source.arrayBuffer());
    const invoices = [1, 2, 3].map(id =>
      invoice(id, {
        layoutId: 1,
        invoiceLayoutSnapshot: {
          layoutSchema: {
            schemaVersion: 1,
            meta: { name: 'Logo regression' },
            sections: [{ type: 'header', visible: true, blocks: [{ type: 'logo' }] }]
          }
        },
        invoiceBusinessSnapshot: {
          ...invoice(id).invoiceBusinessSnapshot!,
          businessLogo: new Uint8Array(bytes),
          businessFileType: 'image/png'
        }
      })
    );
    const url = (await getOptimizedLogoUrl(bytes, 'image/png'))!;
    const bitmap = await createImageBitmap(await (await fetch(url)).blob());
    const dimensions = [bitmap.width, bitmap.height];
    bitmap.close();
    return {
      sourceBytes: source.size,
      dimensions,
      period: await harness.export(invoices, settings),
      single: await describePdf(await createPdfBlob(invoices[0], settings, {} as PdfTexts))
    };
  }
};
declare global {
  interface Window {
    logoPdfHarness: typeof harness;
  }
}
window.logoPdfHarness = harness;
