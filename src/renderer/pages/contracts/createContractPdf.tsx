import '../../shared/utils/pdfRuntime';
import { pdf } from '@react-pdf/renderer';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { ContractDraft } from '../../../backend/shared/types/contracts';
import { validateContractDraft } from '../../../backend/shared/utils/contracts';
import { ContractPDF } from './ContractPDF';

export const createContractPdf = async (value: ContractDraft): Promise<Blob> => {
  const draft = validateContractDraft(value);
  if (!draft.business || !draft.client || !draft.rates.length || !draft.assessmentRate) {
    throw new Error('Select a business, client, labor rates, and assessment rate before exporting.');
  }
  const rendered = await pdf(<ContractPDF draft={draft} />).toBlob();
  const document = await PDFDocument.load(await rendered.arrayBuffer());
  const font = await document.embedFont(StandardFonts.Helvetica);
  const pages = document.getPages();
  pages.forEach((page, index) => {
    const footer = `${index + 1} / ${pages.length}`;
    page.drawLine({
      start: { x: 44, y: 42 },
      end: { x: page.getWidth() - 44, y: 42 },
      thickness: 0.5,
      color: rgb(0.8, 0.84, 0.8)
    });
    page.drawText('DRAFT - FOR REVIEW', { x: 44, y: 27, size: 8, font, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(footer, {
      x: page.getWidth() - 44 - font.widthOfTextAtSize(footer, 8),
      y: 27,
      size: 8,
      font,
      color: rgb(0.4, 0.4, 0.4)
    });
  });
  return new Blob([new Uint8Array(await document.save())], { type: 'application/pdf' });
};
