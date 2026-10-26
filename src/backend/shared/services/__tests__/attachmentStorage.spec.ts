// @vitest-environment node
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createSqliteAdapter } from '../../db/client';
import { initSchema } from '../../db/setup';
import type { DatabaseAdapter } from '../../types/DatabaseAdapter';
import {
  compactAttachmentStorage,
  getAttachmentManifest,
  readStoredAttachment,
  replaceStoredAttachment
} from '../attachmentStorage';

let db: DatabaseAdapter;
let folder: string;
let file: string;
const original = Buffer.alloc(1024 * 1024, 3);
original.set([137, 80, 78, 71, 13, 10, 26, 10]);
const compressed = Buffer.alloc(40000, 5);
compressed.set([255, 216, 255]);
compressed.set([255, 217], compressed.length - 2);

beforeAll(async () => {
  folder = await mkdtemp(path.join(tmpdir(), 'helium-attachment-storage-'));
  file = path.join(folder, 'existing.db');
  db = createSqliteAdapter(new sqlite3.Database(file));
  // Original schema, including old invoice snapshot columns: no migration is needed for this feature.
  await initSchema(db);
  await db.run('INSERT INTO businesses ("id","name","shortName") VALUES (1, ?, ?)', ['Business', 'BB']);
  await db.run('INSERT INTO clients ("id","name","shortName") VALUES (2, ?, ?)', ['Client', 'CC']);
  await db.run('INSERT INTO currencies ("id","code","symbol","text","format") VALUES (3, ?, ?, ?, ?)', [
    'USD',
    '$',
    'Dollar',
    '{symbol}{amount}'
  ]);
  for (let id = 1; id <= 3; id++) {
    await db.run(
      'INSERT INTO invoices ("id","invoiceType","businessId","clientId","currencyId","issuedAt","invoiceNumber","businessNameSnapshot","businessShortNameSnapshot","clientNameSnapshot","currencyCodeSnapshot","currencySymbolSnapshot","currencySubunitSnapshot","isArchived","shippingFeeCents") VALUES (?, ?, 1, 2, 3, ?, ?, ?, ?, ?, ?, ?, 100, ?, 12345)',
      [
        id,
        id === 3 ? 'quotation' : 'invoice',
        '2026-01-01',
        String(id),
        'Business',
        'BB',
        'Client',
        'USD',
        '$',
        id === 2 ? 1 : 0
      ]
    );
  }
  await db.run('INSERT INTO invoice_payments ("parentInvoiceId", "amountCents", "paymentMethod") VALUES (1, 1234, ?)', [
    'Cash'
  ]);
});
beforeEach(async () => {
  await db.run('DROP TRIGGER IF EXISTS reject_attachment_write');
  await db.run('DELETE FROM attachments');
  for (let id = 1; id <= 3; id++)
    await db.run(
      'INSERT INTO attachments ("id","parentInvoiceId","fileName","fileType","fileSize","data") VALUES (?, ?, ?, ?, ?, ?)',
      [id, id, 'receipt.png', 'image/png', original.length, original]
    );
});
afterAll(async () => {
  await db.close();
  await rm(folder, { recursive: true, force: true });
});
const requestFor = async (connection = db, id = 1) => {
  const manifest = await getAttachmentManifest(connection);
  const request = { databaseToken: manifest.data!.databaseToken, id };
  const row = await readStoredAttachment(connection, request);
  expect(row.success).toBe(true);
  return { ...request, fingerprint: row.data!.fingerprint, data: compressed, fileType: 'image/jpeg' };
};

describe('database-wide attachment storage', () => {
  it('includes archived invoices and quotations without fetching blob data in the manifest', async () => {
    const result = await getAttachmentManifest(db);
    expect(result.data!.attachments).toEqual([1, 2, 3].map(id => ({ id, bytes: original.length })));
    expect(result.data!.canCompact).toBe(true);
  });
  it('updates only attachment bytes/metadata; invoice finances, payments, IDs and links remain unchanged', async () => {
    const invoices = await db.all('SELECT * FROM invoices');
    const payments = await db.all('SELECT * FROM invoice_payments');
    const result = await replaceStoredAttachment(db, await requestFor());
    expect(result.data).toEqual({ updated: true, beforeBytes: original.length, afterBytes: compressed.length });
    const row = await db.get('SELECT * FROM attachments WHERE id=1');
    expect(row).toMatchObject({
      id: 1,
      parentInvoiceId: 1,
      fileName: 'receipt.jpg',
      fileType: 'image/jpeg',
      fileSize: compressed.length
    });
    expect(row!.data).toEqual(compressed);
    expect(await db.all('SELECT * FROM invoices')).toEqual(invoices);
    expect(await db.all('SELECT * FROM invoice_payments')).toEqual(payments);
    const reopened = createSqliteAdapter(new sqlite3.Database(file));
    try {
      expect((await reopened.get('SELECT data FROM attachments WHERE id=1'))!.data).toEqual(compressed);
    } finally {
      await reopened.close();
    }
  });
  it('rejects stale content even when size and metadata still match', async () => {
    const request = await requestFor();
    const edited = Buffer.from(original);
    edited[200] = 99;
    await db.run('UPDATE attachments SET data=? WHERE id=1', [edited]);
    expect((await replaceStoredAttachment(db, request)).data!.updated).toBe(false);
    expect((await db.get<{ data: Buffer }>('SELECT data FROM attachments WHERE id=1'))!.data.equals(edited)).toBe(true);
  });
  it('skips deleted attachments and refuses requests from another database connection', async () => {
    const request = await requestFor();
    await db.run('DELETE FROM attachments WHERE id=1');
    expect((await replaceStoredAttachment(db, request)).data!.updated).toBe(false);
    expect((await readStoredAttachment(db, request)).data).toBeNull();
    expect((await replaceStoredAttachment(db, { ...request, databaseToken: 'wrong-database' })).success).toBe(false);
    expect((await compactAttachmentStorage(db, 'wrong-database')).success).toBe(false);
  });
  it('detects an edit between the comparison read and atomic update', async () => {
    const connection: DatabaseAdapter = {
      ...db,
      withIsolatedConnection: undefined,
      get: async <T>(sql: string, params?: unknown[]) => {
        if (sql.startsWith('UPDATE attachments'))
          await db.run('UPDATE attachments SET "fileName"=? WHERE id=1', ['renamed.png']);
        return db.get<T>(sql, params);
      }
    };
    const result = await replaceStoredAttachment(connection, await requestFor(connection));
    expect(result.data!.updated).toBe(false);
    const row = await db.get<{ fileName: string; data: Buffer }>('SELECT * FROM attachments WHERE id=1');
    expect(row!.fileName).toBe('renamed.png');
    expect(row!.data.equals(original)).toBe(true);
  });
  it('retains the entire original image after write failure or malformed/larger replacement', async () => {
    const request = await requestFor();
    expect((await replaceStoredAttachment(db, { ...request, data: Buffer.from('not an image') })).success).toBe(false);
    expect((await replaceStoredAttachment(db, { ...request, data: original, fileType: 'image/png' })).success).toBe(
      false
    );
    await db.run(
      "CREATE TRIGGER reject_attachment_write BEFORE UPDATE ON attachments BEGIN SELECT RAISE(ABORT, 'simulated disk failure'); END"
    );
    expect((await replaceStoredAttachment(db, request)).success).toBe(false);
    expect((await db.get<{ data: Buffer }>('SELECT data FROM attachments WHERE id=1'))!.data.equals(original)).toBe(
      true
    );
  });
  it('uses an isolated connection so an unrelated invoice rollback cannot undo a reported save', async () => {
    const request = await requestFor();
    await db.run('BEGIN IMMEDIATE');
    const save = replaceStoredAttachment(db, request);
    await new Promise(resolve => setTimeout(resolve, 100));
    await db.run('ROLLBACK');
    expect((await save).data!.updated).toBe(true);
    expect((await db.get('SELECT data FROM attachments WHERE id=1'))!.data).toEqual(compressed);
  });
  it('reclaims physical SQLite file space without changing stored content or integrity', async () => {
    for (let id = 1; id <= 3; id++)
      expect((await replaceStoredAttachment(db, await requestFor(db, id))).data!.updated).toBe(true);
    const before = (await stat(file)).size;
    const token = (await getAttachmentManifest(db)).data!.databaseToken;
    const result = await compactAttachmentStorage(db, token);
    expect(result.success).toBe(true);
    expect((await stat(file)).size).toBeLessThan(before);
    expect(result.data!.afterBytes).toBeLessThan(result.data!.beforeBytes);
    expect((await db.get('PRAGMA integrity_check'))!.integrity_check).toBe('ok');
    expect((await db.get('SELECT COUNT(*) AS count FROM attachments'))!.count).toBe(3);
  });
});
