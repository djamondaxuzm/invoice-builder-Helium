import type { DatabaseAdapter } from '../types/DatabaseAdapter';
import type { Response } from '../types/response';
import { mapDatabaseError } from './errorFunctions';

export const sameDefinitionValue = (a: unknown, b: unknown): boolean => {
  if (a instanceof Uint8Array && b instanceof Uint8Array)
    return a.length === b.length && a.every((value, i) => value === b[i]);
  return (a ?? null) === (b ?? null);
};

// Master record and affected snapshots succeed or roll back together.
export const updateWithSnapshots = async <T>(
  db: DatabaseAdapter,
  table: string,
  id: number | undefined,
  update: () => Promise<Response<T>>,
  sync: (before: Record<string, unknown>, after: T) => Promise<void>
): Promise<Response<T>> => {
  let started = false;
  try {
    await db.run('BEGIN');
    started = true;
    const before = await db.get(`SELECT * FROM ${table} WHERE "id" = ?`, [id]);
    if (!before) throw new Error('The catalog record no longer exists.');
    const result = await update();
    if (!result.success || !result.data) {
      await db.run('ROLLBACK');
      return result;
    }
    await sync(before, result.data);
    await db.run('COMMIT');
    return result;
  } catch (error) {
    if (started) await db.run('ROLLBACK');
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};

export const syncContactSnapshot = async (
  db: DatabaseAdapter,
  kind: 'business' | 'client',
  id: number | undefined,
  before: Record<string, unknown>,
  after: object,
  fields: readonly string[]
) => {
  const values = after as Record<string, unknown>;
  const changed = fields.filter(field => !sameDefinitionValue(before[field], values[field]));
  if (!changed.length) return;
  await db.run(
    `UPDATE invoice_${kind}_snapshots SET ${changed
      .map(field => `"${kind}${field[0].toUpperCase()}${field.slice(1)}" = ?`)
      .join(', ')}
    WHERE "parentInvoiceId" IN (SELECT "id" FROM invoices WHERE "${kind}Id" = ?)`,
    [...changed.map(field => values[field] ?? null), id]
  );
};
