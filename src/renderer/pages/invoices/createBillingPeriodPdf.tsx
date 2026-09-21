import { pdf } from '@react-pdf/renderer';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { Settings } from '../../shared/types/settings';
import type { buildBillingPeriod } from '../../shared/utils/billingPeriod';
import { getOptimizedLogoUrl } from '../../shared/utils/logoImage';
import { BillingPeriodPDF } from './BillingPeriodPDF';

export const createBillingPeriodPdf = async (period: ReturnType<typeof buildBillingPeriod>, settings: Settings) => {
  const assets = [];
  // Prepare sequentially to bound peak memory for image-heavy invoice selections.
  for (const { invoice } of period.rows) {
    const business = invoice.invoiceBusinessSnapshot;
    const logoUrl = await getOptimizedLogoUrl(business?.businessLogo, business?.businessFileType);
    const attachments = (invoice.invoiceAttachments ?? []).map(attachment => {
      if (!attachment.data?.length || !['image/png', 'image/jpeg', 'image/jpg'].includes(attachment.fileType)) {
        throw new Error(
          'Invoice ' +
            invoice.invoiceNumber +
            ' has an unreadable or unsupported attachment. Use PNG or JPEG receipt images.'
        );
      }
      let binary = '';
      const bytes = new Uint8Array(attachment.data);
      for (let offset = 0; offset < bytes.length; offset += 8192)
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      return {
        name: attachment.fileName,
        url:
          'data:' +
          (attachment.fileType === 'image/jpg' ? 'image/jpeg' : attachment.fileType) +
          ';base64,' +
          btoa(binary)
      };
    });
    assets.push({ logoUrl, attachments });
  }
  const rendered = await pdf(<BillingPeriodPDF period={period} settings={settings} assets={assets} />).toBlob();
  const document = await PDFDocument.load(await rendered.arrayBuffer());
  const font = await document.embedFont(StandardFonts.Helvetica);
  const pages = document.getPages();
  // Stamp after pagination so the footer is reliable across renderer versions.
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
