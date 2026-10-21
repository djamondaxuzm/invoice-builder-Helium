import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { Provider } from 'react-redux';
import { pdf } from '@react-pdf/renderer';
import { PDFDocument as ParsedPDF, StandardFonts, rgb } from 'pdf-lib';
import { store } from '../../src/renderer/state/configureStore';
import { AttachmentsList } from '../../src/renderer/pages/invoices/Form/AttachmentsList';
import { BillingPeriodPDF } from '../../src/renderer/pages/invoices/BillingPeriodPDF';
import { createBillingPeriodPdf } from '../../src/renderer/pages/invoices/createBillingPeriodPdf';
import { createPdfBlob } from '../../src/renderer/shared/hooks/fileExport/useExportPdf';
import {
  getOptimizedReceiptUrl,
  optimizeReceipt,
  prepareReceiptImage
} from '../../src/renderer/shared/utils/receiptImage';
import { toDataUrl, base64ToBytes } from '../../src/renderer/shared/utils/dataUrlFunctions';
import { buildBillingPeriod } from '../../src/renderer/shared/utils/billingPeriod';
import { invoiceSavePayload } from '../../src/renderer/shared/utils/invoiceSavePayload';
import { invoice, settings } from '../../src/renderer/__tests__/billingPeriodFixtures';
import type { InvoiceFromData, PdfTexts } from '../../src/renderer/shared/types/invoice';
import '../../src/renderer/i18n';

// Deterministic photo-like paper texture with readable fictitious receipt text.
const makeReceipt = async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 3000;
  canvas.height = 4200;
  const context = canvas.getContext('2d')!;
  const pixels = context.createImageData(canvas.width, canvas.height);
  let seed = 37;
  for (let i = 0; i < pixels.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const shade = 238 + (seed >>> 27);
    pixels.data[i] = shade;
    pixels.data[i + 1] = shade;
    pixels.data[i + 2] = shade - 4;
    pixels.data[i + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  context.fillStyle = '#111';
  context.font = 'bold 100px sans-serif';
  context.fillText('HELIUM DEMO RECEIPT', 180, 220);
  context.font = '56px monospace';
  [
    'Fictional test data',
    'Date: 2026-10-21',
    'Receipt: DEMO-001',
    '',
    'Design materials                  62.50',
    'Delivery                           8.00',
    'Tax                                5.64',
    'TOTAL                             76.14'
  ].forEach((line, index) => context.fillText(line, 180, 440 + index * 110));
  context.font = '32px monospace';
  context.fillText('Small print: retain this receipt. Reference 0123456789.', 180, 1600);
  const blob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!), 'image/png'));
  canvas.width = 0;
  canvas.height = 0;
  return blob;
};
const sample = await makeReceipt();
const sourceData = new Uint8Array(await sample.arrayBuffer());
const attachment = {
  id: 10,
  parentInvoiceId: 1,
  fileName: 'demo.png',
  fileType: sample.type,
  fileSize: sample.size,
  data: sourceData
};

const originalBillingPdf = async (period: ReturnType<typeof buildBillingPeriod>) => {
  const assets = [];
  for (const row of period.rows) {
    const attachments = [];
    for (const item of row.invoice.invoiceAttachments)
      attachments.push({ name: item.fileName, url: await toDataUrl(item.data, item.fileType) });
    assets.push({ attachments });
  }
  const rendered = await pdf(<BillingPeriodPDF period={period} settings={settings} assets={assets} />).toBlob();
  const document = await ParsedPDF.load(await rendered.arrayBuffer());
  const font = await document.embedFont(StandardFonts.Helvetica);
  const pages = document.getPages();
  pages.forEach((page, index) => {
    const label = `${index + 1} / ${pages.length}`;
    page.drawText(label, {
      x: page.getWidth() - 32 - font.widthOfTextAtSize(label, 7),
      y: 18,
      size: 7,
      font,
      color: rgb(0.4, 0.4, 0.4)
    });
  });
  return new Blob([new Uint8Array(await document.save())], { type: 'application/pdf' });
};
const harness = {
  sample: async () => ({ base64: (await toDataUrl(sample)).split(',')[1], bytes: sample.size }),
  benchmark: async (base64?: string, mime = 'image/png', includePdfs = false) => {
    const data = base64 ? base64ToBytes(base64) : new Uint8Array(sourceData);
    const beforeImage = await createImageBitmap(new Blob([new Uint8Array(data).buffer], { type: mime }));
    const dimensionsBefore = [beforeImage.width, beforeImage.height];
    beforeImage.close();
    const start = performance.now();
    const result = await prepareReceiptImage(data, mime);
    const optimizeMs = performance.now() - start;
    const repeated = performance.now();
    await prepareReceiptImage(data, mime);
    const cachedMs = performance.now() - repeated;
    const url = await getOptimizedReceiptUrl(data, mime);
    const afterImage = await createImageBitmap(
      new Blob([new Uint8Array(result.data).buffer], { type: result.fileType })
    );
    const dimensionsAfter = [afterImage.width, afterImage.height];
    afterImage.close();
    let pdfs;
    if (includePdfs) {
      const first = invoice(1, {
        invoiceAttachments: [{ ...attachment, data, fileType: mime, fileSize: data.length }]
      });
      const period = buildBillingPeriod([first, invoice(2)], settings);
      const beforeStart = performance.now();
      const beforePdf = await originalBillingPdf(period);
      const beforeMs = performance.now() - beforeStart;
      const afterStart = performance.now();
      const afterPdf = await createBillingPeriodPdf(period, settings);
      const afterMs = performance.now() - afterStart;
      const singlePdf = await createPdfBlob(first, settings, {} as PdfTexts);
      pdfs = {
        beforeBytes: beforePdf.size,
        afterBytes: afterPdf.size,
        beforeMs,
        afterMs,
        beforePages: (await ParsedPDF.load(await beforePdf.arrayBuffer())).getPageCount(),
        afterPages: (await ParsedPDF.load(await afterPdf.arrayBuffer())).getPageCount(),
        singlePages: (await ParsedPDF.load(await singlePdf.arrayBuffer())).getPageCount(),
        before: await toDataUrl(beforePdf),
        after: await toDataUrl(afterPdf),
        single: await toDataUrl(singlePdf)
      };
    }
    return {
      beforeBytes: data.length,
      afterBytes: result.data.length,
      fileType: result.fileType,
      dimensionsBefore,
      dimensionsAfter,
      optimizeMs,
      cachedMs,
      url,
      pdfs
    };
  },
  optimizeAgain: async (url: string) => {
    const blob = new Blob([base64ToBytes(url.split(',')[1]).buffer as ArrayBuffer], {
      type: url.slice(5, url.indexOf(';'))
    });
    const result = await optimizeReceipt(blob);
    return { unchanged: result === blob, bytes: result.size, mime: result.type };
  }
};
declare global {
  interface Window {
    receiptHarness: typeof harness;
  }
}
window.receiptHarness = harness;

const Fixture = () => {
  const [form, setForm] = useState<InvoiceFromData>(invoice(1, { invoiceAttachments: [attachment] }));
  const [saved, setSaved] = useState('Not saved');
  return (
    <Provider store={store}>
      <AttachmentsList
        invoiceForm={form}
        onAttach={item =>
          setForm(previous => ({
            ...previous,
            invoiceAttachments: [...previous.invoiceAttachments!, { ...item, id: Date.now() }]
          }))
        }
        onClear={id =>
          setForm(previous => ({
            ...previous,
            invoiceAttachments: previous.invoiceAttachments!.filter(item => item.id !== id)
          }))
        }
        onOptimize={(before, after) =>
          setForm(previous =>
            previous.invoiceAttachments === before ? { ...previous, invoiceAttachments: after } : previous
          )
        }
      />
      <button
        onClick={() => {
          const payload = invoiceSavePayload(form);
          setSaved(
            JSON.stringify(
              payload.invoiceAttachments?.map(item => ({
                id: item.id,
                fileSize: item.fileSize,
                fileType: item.fileType,
                fileName: item.fileName,
                bytes: item.data.length,
                retain: item.retainExistingData
              }))
            )
          );
        }}
      >
        Save test invoice
      </button>
      <button
        onClick={() => {
          setForm(invoice(1, { invoiceAttachments: [attachment] }));
          setSaved('Not saved');
        }}
      >
        Cancel edits
      </button>
      <output>{saved}</output>
    </Provider>
  );
};
createRoot(document.getElementById('root')!).render(<Fixture />);
