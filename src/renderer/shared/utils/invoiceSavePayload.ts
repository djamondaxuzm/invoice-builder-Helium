import type { InvoiceUpdate } from '../types/invoice';

export const invoiceSavePayload = (invoice: InvoiceUpdate): InvoiceUpdate => ({
  ...invoice,
  // The attachment editor adds/removes files; it never mutates a saved image.
  // Only server-returned attachments carry this invoice's parent ID.
  invoiceAttachments: invoice.invoiceAttachments?.map(attachment =>
    attachment.id != null && attachment.parentInvoiceId === invoice.id
      ? { ...attachment, data: new Uint8Array(0), retainExistingData: true }
      : attachment
  )
});
