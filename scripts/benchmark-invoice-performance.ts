// Run with tsx. BASELINE_INVOICE_SERVICE must point to the previous invoices.ts
// placed alongside the current service so its relative imports resolve.
// Creates only synthetic data in BENCHMARK_OUTPUT; never opens an app database.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';
import sqlite3 from 'sqlite3';
import { createSqliteAdapter } from '../src/backend/shared/db/client';
import { initSchema, initInitialData } from '../src/backend/shared/db/setup';
import { runMigrations } from '../src/backend/shared/db/migrationRunner';
import { addInvoice, updateInvoice, getAllInvoices } from '../src/backend/shared/services/invoices';
import { invoice as fixture } from '../src/renderer/__tests__/billingPeriodFixtures';
import { formEqual } from '../src/renderer/shared/utils/formEqual';
import { invoiceSavePayload } from '../src/renderer/shared/utils/invoiceSavePayload';
import type { Invoice } from '../src/backend/shared/types/invoice';
import type { InvoiceUpdate } from '../src/renderer/shared/types/invoice';

const baselinePath = process.env.BASELINE_INVOICE_SERVICE;
const output = process.env.BENCHMARK_OUTPUT;
if (!baselinePath || !output) throw new Error('Set BASELINE_INVOICE_SERVICE and BENCHMARK_OUTPUT.');
const baseline = (await import(pathToFileURL(resolve(baselinePath)).href)) as {
  updateInvoice: typeof updateInvoice;
  getAllInvoices: typeof getAllInvoices;
};
await mkdir(output, { recursive: true });
const db = createSqliteAdapter(new sqlite3.Database(resolve(output, `synthetic-${Date.now()}.sqlite`)));
const run = db.run;
db.run = async (...args) => {
  try {
    return await run(...args);
  } catch (error) {
    console.error(args[0], error);
    throw error;
  }
};
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const measure = async (fn: () => unknown | Promise<unknown>) => {
  const start = performance.now();
  await fn();
  return performance.now() - start;
};
const results: Record<string, unknown> = {
  node: process.version,
  platform: process.platform,
  baseline: '1d5adaeb6b35c6bb2b77a9a6bf5c0f5872021219',
  samples: 7
};
try {
  await initSchema(db);
  Object.assign(globalThis, { require: createRequire(import.meta.url) });
  const migrated = await runMigrations(db, resolve('dist-be/backend/migrations'));
  if (!migrated?.success) throw new Error(JSON.stringify(migrated));
  await initInitialData(db);
  const businessId = await db.run(
    'INSERT INTO businesses (name, "shortName") VALUES (?, ?)',
    ['Benchmark', 'BN'],
    true
  );
  const clientId = await db.run(
    'INSERT INTO clients (name, "shortName") VALUES (?, ?)',
    ['Synthetic client', 'SY'],
    true
  );
  const currencyId = (await db.get<{ id: number }>("SELECT id FROM currencies WHERE code = 'USD'"))!.id;
  const itemId = await db.run('INSERT INTO items (name, amount) VALUES (?, ?)', ['Work', '100'], true);
  const payload = (id: number): Invoice =>
    ({
      ...fixture(1),
      id: undefined,
      businessId,
      clientId,
      currencyId,
      invoiceNumber: String(id),
      invoiceFullNumber: undefined,
      invoiceBusinessSnapshot: { businessName: 'Benchmark', businessShortName: 'BN' },
      invoiceItems: fixture(1).invoiceItems.map(item => ({ ...item, itemId }))
    }) as unknown as Invoice;
  const bytes = new Uint8Array(2 * 1024 * 1024).fill(73);
  const first = await addInvoice(db, {
    ...payload(1),
    invoiceAttachments: [1, 2, 3].map(
      id =>
        ({
          fileName: `receipt-${id}.png`,
          fileType: 'image/png',
          fileSize: bytes.length,
          data: bytes
        }) as Invoice['invoiceAttachments'][number]
    )
  });
  if (!first.success) throw new Error(JSON.stringify(first));
  let saved = first.data as Invoice;
  const before: number[] = [],
    after: number[] = [];
  const saveOld = async () => {
    const result = await baseline.updateInvoice(db, { ...saved, customerNotes: 'Benchmark notes' });
    if (!result.success) throw new Error(JSON.stringify(result));
    saved = result.data as Invoice;
  };
  const saveNew = async () => {
    const result = await updateInvoice(db, invoiceSavePayload(saved as unknown as InvoiceUpdate) as unknown as Invoice);
    if (!result.success) throw new Error(JSON.stringify(result));
    saved = result.data as Invoice;
  };
  await saveOld();
  await saveNew();
  for (let i = 0; i < 7; i++) {
    if (i % 2) {
      after.push(await measure(saveNew));
      before.push(await measure(saveOld));
    } else {
      before.push(await measure(saveOld));
      after.push(await measure(saveNew));
    }
  }
  results.save = {
    receiptBytes: bytes.length * 3,
    beforeMs: median(before),
    afterMs: median(after),
    beforeSamples: before,
    afterSamples: after,
    scope:
      'Full backend update, transaction and response hydration; 3 unchanged 2 MiB receipts; excludes IPC and renderer'
  };
  const wire = invoiceSavePayload(saved as unknown as InvoiceUpdate);
  results.receiptPayload = {
    beforeBytes: saved.invoiceAttachments.reduce((n, a) => n + a.data.byteLength, 0),
    afterBytes: wire.invoiceAttachments!.reduce((n, a) => n + a.data.byteLength, 0)
  };

  for (let id = 2; id <= 200; id++) {
    const row = payload(id);
    row.invoiceItems = Array.from({ length: 10 }, () => ({ ...row.invoiceItems[0] }));
    const result = await addInvoice(db, row);
    if (!result.success) throw new Error(JSON.stringify(result));
  }
  const listBefore: number[] = [],
    listAfter: number[] = [];
  const listOld = async () => {
    const result = await baseline.getAllInvoices(db);
    if (result.data?.length !== 200) throw new Error('Baseline count');
  };
  const listNew = async () => {
    const result = await getAllInvoices(db);
    if (result.data?.length !== 200) throw new Error('Updated count');
  };
  await listOld();
  await listNew();
  for (let i = 0; i < 7; i++) {
    if (i % 2) {
      listAfter.push(await measure(listNew));
      listBefore.push(await measure(listOld));
    } else {
      listBefore.push(await measure(listOld));
      listAfter.push(await measure(listNew));
    }
  }
  results.load = {
    invoices: 200,
    items: 1991,
    beforeMs: median(listBefore),
    afterMs: median(listAfter),
    beforeSamples: listBefore,
    afterSamples: listAfter,
    scope: 'Complete backend invoice-list load and hydration, same SQLite database; excludes UI/PDF rendering'
  };

  const stableStringify = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    if (value && typeof value === 'object')
      return `{${Object.keys(value)
        .sort()
        .map(key => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
        .join(',')}}`;
    return JSON.stringify(value);
  };
  const original = { note: 'notes', image: new Uint8Array(1024 * 1024).fill(73) };
  const current = { ...original };
  const dirtyBefore: number[] = [],
    dirtyAfter: number[] = [];
  for (let i = 0; i < 7; i++) {
    dirtyBefore.push(
      await measure(() => {
        if (stableStringify(original) !== stableStringify(current)) throw new Error('Baseline comparison');
      })
    );
    const start = performance.now();
    for (let j = 0; j < 10000; j++) if (!formEqual(original, current)) throw new Error('Comparison');
    dirtyAfter.push((performance.now() - start) / 10000);
  }
  results.dirtyCheck = {
    receiptBytes: original.image.byteLength,
    beforeMs: median(dirtyBefore),
    afterMs: median(dirtyAfter),
    beforeSamples: dirtyBefore,
    afterSamples: dirtyAfter,
    scope:
      'Unchanged 1 MiB image with immutable form copy; original comparator vs new; new timing averaged across 10,000 operations per sample'
  };
  await writeFile(resolve(output, 'performance-results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  await db.close();
}
