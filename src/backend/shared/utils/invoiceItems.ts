import type { DatabaseAdapter } from '../types/DatabaseAdapter';
import type { InvoiceItem, InvoiceItemSnapshots } from '../types/invoice';

export const serializeCustomField = (input: InvoiceItem['customField']) => {
  if (input == null || input === '') return null;
  let value: unknown = input;
  // Accept legacy double-encoded values, but never encode JSON text a second time.
  for (let i = 0; i < 2 && typeof value === 'string'; i++) value = JSON.parse(value);
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid invoice line custom field.');
  return JSON.stringify(value);
};

// Existing IDs imply display order in the current schema. Preserve them for
// ordinary edits; rebuild only when insertion/reordering changes that order.
export const syncInvoiceItems = async (db: DatabaseAdapter, invoiceId: number, incoming: InvoiceItem[]) => {
  const existing = await db.all<InvoiceItem>('SELECT * FROM invoice_items WHERE "parentInvoiceId" = ? ORDER BY "id"', [
    invoiceId
  ]);
  const byId = new Map(existing.map(row => [row.id, row]));
  const keptIds = incoming.filter(row => byId.has(row.id)).map(row => row.id);
  if (new Set(keptIds).size !== keptIds.length) throw new Error('An invoice line was included twice.');
  for (const row of incoming) {
    if (!row.invoiceItemSnapshot) throw new Error('An invoice line is missing its item details.');
    serializeCustomField(row.customField);
  }
  const kept = new Set(keptIds);
  const originalOrder = existing.filter(row => kept.has(row.id)).map(row => row.id);
  let newSeen = false;
  const insertedBeforeExisting = incoming.some(row => {
    if (!byId.has(row.id)) {
      newSeen = true;
      return false;
    }
    return newSeen;
  });
  if (insertedBeforeExisting || originalOrder.some((id, index) => id !== keptIds[index])) {
    await db.run('DELETE FROM invoice_items WHERE "parentInvoiceId" = ?', [invoiceId]);
    return incoming;
  }
  const snapshots = await db.all<InvoiceItemSnapshots>(
    `SELECT s.* FROM invoice_item_snapshots s
    JOIN invoice_items i ON i."id" = s."parentInvoiceItemId" WHERE i."parentInvoiceId" = ?`,
    [invoiceId]
  );
  const snapshotById = new Map(snapshots.map(row => [row.parentInvoiceItemId, row]));
  for (const old of existing)
    if (!kept.has(old.id))
      await db.run('DELETE FROM invoice_items WHERE "id" = ? AND "parentInvoiceId" = ?', [old.id, invoiceId]);
  for (const item of incoming) {
    const old = byId.get(item.id);
    if (!old) continue;
    const values = [
      item.itemId,
      item.quantity,
      item.taxRate,
      item.taxType ?? null,
      serializeCustomField(item.customField)
    ];
    const prior = [old.itemId, old.quantity, old.taxRate, old.taxType ?? null, serializeCustomField(old.customField)];
    if (values.some((value, i) => String(value ?? '') !== String(prior[i] ?? '')))
      await db.run(
        'UPDATE invoice_items SET "itemId" = ?, "quantity" = ?, "taxRate" = ?, "taxType" = ?, "customField" = ? WHERE "id" = ? AND "parentInvoiceId" = ?',
        [...values, old.id, invoiceId]
      );
    const snapshot = item.invoiceItemSnapshot!;
    const previous = snapshotById.get(old.id);
    const fields = ['itemName', 'unitPriceCents', 'unitName'] as const;
    const params = fields.map(field => snapshot[field] ?? null);
    if (!previous) {
      await db.run(
        'INSERT INTO invoice_item_snapshots ("itemName", "unitPriceCents", "unitName", "parentInvoiceItemId") VALUES (?, ?, ?, ?)',
        [...params, old.id]
      );
    } else if (fields.some(field => String(previous[field] ?? '') !== String(snapshot[field] ?? ''))) {
      await db.run(
        'UPDATE invoice_item_snapshots SET "itemName" = ?, "unitPriceCents" = ?, "unitName" = ? WHERE "parentInvoiceItemId" = ?',
        [...params, old.id]
      );
    }
  }
  return incoming.filter(item => !byId.has(item.id));
};
