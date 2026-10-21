import type { InvoiceUpdate } from '../types/invoice';

export const invoiceSavePayload = (invoice: InvoiceUpdate): InvoiceUpdate => ({
  ...invoice,
  // Explicitly optimized receipts must send replacement bytes. Unchanged saved
  // receipts still send references, avoiding unnecessary large IPC/database writes.
  invoiceAttachments: invoice.invoiceAttachments?.map(attachment =>
    attachment.id != null && attachment.parentInvoiceId === invoice.id && attachment.retainExistingData !== false
      ? { ...attachment, data: new Uint8Array(0), retainExistingData: true }
      : attachment
  )
});
