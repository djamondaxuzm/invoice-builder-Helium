import { expect, test } from '@playwright/test';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { createSqliteAdapter } from '../src/backend/shared/db/client';
import type { DatabaseAdapter } from '../src/backend/shared/types/DatabaseAdapter';
import * as storage from '../src/backend/shared/services/attachmentStorage';

let db: DatabaseAdapter;
let folder: string;
let file: string;
test.beforeEach(async ({ page }) => {
  folder = await mkdtemp(path.join(tmpdir(), 'helium-bulk-browser-'));
  file = path.join(folder, 'test.db');
  db = createSqliteAdapter(new sqlite3.Database(file));
  await db.run(
    'CREATE TABLE attachments (id INTEGER PRIMARY KEY, "parentInvoiceId" INTEGER, "fileName" TEXT, "fileType" TEXT, "fileSize" INTEGER, data BLOB, "updatedAt" TEXT)'
  );
  await page.route('**/api/attachment-storage**', async route => {
    const action = new URL(route.request().url()).pathname.split('/').pop();
    const body = route.request().method() === 'POST' ? route.request().postDataJSON() : undefined;
    let result;
    if (action === 'read') {
      const read = await storage.readStoredAttachment(db, body);
      result = {
        ...read,
        data: read.data ? { ...read.data, data: Buffer.from(read.data.data).toString('base64') } : read.data
      };
    } else if (action === 'replace')
      result = await storage.replaceStoredAttachment(db, { ...body, data: Buffer.from(body.data, 'base64') });
    else if (action === 'compact') result = await storage.compactAttachmentStorage(db, body.databaseToken);
    else result = await storage.getAttachmentManifest(db);
    await route.fulfill({ json: result });
  });
  await page.goto('/e2e/fixtures/receipts-bulk.html');
  await page.waitForFunction(() => Boolean(window.bulkReceiptSample));
  const bytes = Buffer.from(await page.evaluate(() => window.bulkReceiptSample()), 'base64');
  for (let id = 1; id <= 3; id++)
    await db.run('INSERT INTO attachments VALUES (?, ?, ?, ?, ?, ?, ?)', [
      id,
      id,
      'demo.png',
      'image/png',
      bytes.length,
      bytes,
      'original'
    ]);
  await page.getByRole('button', { name: 'Refresh sizes' }).click();
  await expect(page.getByRole('button', { name: 'Compress all attachments' })).toBeEnabled();
});
test.afterEach(async () => {
  await db.close();
  await rm(folder, { recursive: true, force: true });
});

test('compresses all images through the real storage service, reclaims disk space, and reruns without another lossy pass', async ({
  page
}) => {
  const before = (await stat(file)).size;
  await page.getByRole('button', { name: 'Compress all attachments' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 60000 });
  await expect(page.getByRole('alert')).toContainText('3 compressed');
  await expect(page.getByRole('alert')).toContainText('Allocated database size');
  expect((await stat(file)).size).toBeLessThan(before * 0.4);
  const saved = await db.all<{ id: number; fileType: string; fileName: string; data: Buffer }>(
    'SELECT * FROM attachments ORDER BY id'
  );
  expect(saved.map(row => [row.id, row.fileType, row.fileName])).toEqual(
    [1, 2, 3].map(id => [id, 'image/jpeg', 'demo.jpg'])
  );
  await page.getByRole('button', { name: 'Compress all attachments' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 60000 });
  await expect(page.getByRole('alert')).toContainText('0 compressed · 3 unchanged');
  const again = await db.all<{ data: Buffer }>('SELECT data FROM attachments ORDER BY id');
  expect(again.every((row, index) => row.data.equals(saved[index].data))).toBe(true);
});
test('Stop prevents the next image from saving while preserving completed work', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  let secondRead = false;
  await page.route('**/api/attachment-storage/read', async route => {
    if (route.request().postDataJSON().id === 2) {
      secondRead = true;
      await gate;
    }
    await route.fallback();
  });
  await page.getByRole('button', { name: 'Compress all attachments' }).click();
  await expect.poll(() => secondRead).toBe(true);
  await page.getByRole('button', { name: 'Stop compression' }).click();
  release();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('Compression cancelled');
  await expect(page.getByRole('alert')).toContainText('1 compressed');
  const rows = await db.all<{ fileType: string }>('SELECT "fileType" FROM attachments ORDER BY id');
  expect(rows.map(row => row.fileType)).toEqual(['image/jpeg', 'image/png', 'image/png']);
});
test('a database write error stops the run and retains all original images', async ({ page }) => {
  await db.run(
    "CREATE TRIGGER fail_write BEFORE UPDATE ON attachments BEGIN SELECT RAISE(ABORT, 'test write failure'); END"
  );
  await page.getByRole('button', { name: 'Compress all attachments' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('Compression stopped');
  await expect(page.getByRole('alert')).toContainText('test write failure');
  const rows = await db.all<{ fileType: string }>('SELECT "fileType" FROM attachments');
  expect(rows.every(row => row.fileType === 'image/png')).toBe(true);
});
