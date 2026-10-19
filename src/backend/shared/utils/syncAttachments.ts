import type { DatabaseAdapter } from '../types/DatabaseAdapter';
import type { InvoiceAttachment } from '../types/invoice';

// Called within updateInvoice's transaction. Never trust an attachment ID alone:
// retained files must belong to this invoice and still match their metadata.
export const syncAttachments = async (
  db: DatabaseAdapter,
  invoiceId: number,
  attachments: InvoiceAttachment[] = []
) => {
  const existing = await db.all<InvoiceAttachment>(
    'SELECT "id", "fileName", "fileType", "fileSize" FROM attachments WHERE "parentInvoiceId" = ?',
    [invoiceId]
  );
  const byId = new Map(existing.map(row => [row.id, row]));
  const kept = new Set<number>();
  for (const attachment of attachments) {
    const previous = byId.get(attachment.id);
    if (attachment.retainExistingData) {
      if (
        !previous ||
        kept.has(previous.id) ||
        attachment.data?.length ||
        previous.fileName !== attachment.fileName ||
        previous.fileType !== attachment.fileType ||
        previous.fileSize !== attachment.fileSize
      )
        throw new Error('The saved receipt changed or no longer exists. Reload the invoice before saving.');
      kept.add(previous.id);
    } else {
      if (!attachment.data?.length) throw new Error('A new receipt has no image data.');
      if (previous) {
        if (kept.has(previous.id)) throw new Error('A receipt was included twice.');
        await db.run(
          'UPDATE attachments SET "fileName" = ?, "fileType" = ?, "fileSize" = ?, "data" = ? WHERE "id" = ? AND "parentInvoiceId" = ?',
          [attachment.fileName, attachment.fileType, attachment.fileSize, attachment.data, previous.id, invoiceId]
        );
        kept.add(previous.id);
      } else {
        await db.run(
          'INSERT INTO attachments ("parentInvoiceId", "fileName", "fileType", "fileSize", "data") VALUES (?, ?, ?, ?, ?)',
          [invoiceId, attachment.fileName, attachment.fileType, attachment.fileSize, attachment.data]
        );
      }
    }
  }
  for (const row of existing) {
    if (!kept.has(row.id))
      await db.run('DELETE FROM attachments WHERE "id" = ? AND "parentInvoiceId" = ?', [row.id, invoiceId]);
  }
};
