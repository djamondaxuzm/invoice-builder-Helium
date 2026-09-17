import { pdf } from '@react-pdf/renderer';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { Settings } from '../../shared/types/settings';
import type { buildBillingPeriod } from '../../shared/utils/billingPeriod';
import { getOptimizedLogoUrl } from '../../shared/utils/logoImage';
import { BillingPeriodPDF } from './BillingPeriodPDF';

export const createBillingPeriodPdf = async (period: ReturnType<typeof buildBillingPeriod>, settings: Settings) => {
  const business = period.rows[0].invoice.invoiceBusinessSnapshot;
  const logoUrl = await getOptimizedLogoUrl(business?.businessLogo, business?.businessFileType);
  const rendered = await pdf(<BillingPeriodPDF period={period} settings={settings} logoUrl={logoUrl} />).toBlob();
  const document = await PDFDocument.load(await rendered.arrayBuffer());
  const font = await document.embedFont(StandardFonts.Helvetica);
  const pages = document.getPages();
  // Stamp after pagination so the footer is reliable across renderer versions.
  pages.forEach((page, index) => {
    const label = `${index + 1} / ${pages.length}`;
    page.drawText(label, {
      x: page.getWidth() - 36 - font.widthOfTextAtSize(label, 9),
      y: 24,
      size: 9,
      font,
      color: rgb(0.4, 0.4, 0.4)
    });
  });
  return new Blob([new Uint8Array(await document.save())], { type: 'application/pdf' });
};
