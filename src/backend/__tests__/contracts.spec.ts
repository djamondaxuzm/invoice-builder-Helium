// @vitest-environment node
import sqlite3 from 'sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSqliteAdapter } from '../shared/db/client';
import { createContractsSchema } from '../shared/db/contractsSchema';
import { initSchema } from '../shared/db/setup';
import {
  deleteContract,
  getContract,
  listContracts,
  saveContract,
  getContractTermsTemplate,
  saveContractTermsTemplate
} from '../shared/services/contracts';
import { exportAllData, importAllData } from '../shared/services/importExport';
import type { DatabaseAdapter } from '../shared/types/DatabaseAdapter';
import type { DeleteContractRequest } from '../shared/types/contracts';
import { contractFeeCents, contractRetainerCents, newContractDraft } from '../shared/utils/contracts';

describe('contract drafts', () => {
  let db: DatabaseAdapter;
  beforeEach(async () => {
    db = createSqliteAdapter(new sqlite3.Database(':memory:'));
    await createContractsSchema(db);
  });
  afterEach(async () => {
    await db.close();
  });
  const draft = () => ({
    ...newContractDraft('2026-11-08'),
    title: 'Client project',
    client: { sourceId: 1, name: 'Example client', address: '', email: '', phone: '' },
    rates: [{ sourceId: 1, name: 'Standard labor', hourlyRate: '85' }],
    assessmentRate: { sourceId: 1, name: 'Standard labor', hourlyRate: '85' }
  });

  it('calculates fees and work travel with exact decimal rounding and rejects invalid input', () => {
    expect(contractFeeCents('85', '2')).toBe(17000);
    expect(contractFeeCents('85', '0.5')).toBe(4250);
    expect(contractFeeCents('50', '1.5')).toBe(7500);
    expect(contractFeeCents('0.1', '0.15')).toBe(2);
    expect(contractFeeCents('85', '0')).toBe(0);
    for (const multiplier of ['-1', '', 'NaN', 'Infinity', '1e3', '10001', '0.12345']) {
      expect(() => contractFeeCents('85', multiplier)).toThrow();
    }
  });

  it('calculates the automatic retainer without confusing an absent estimate with zero, and caps at $1,000', () => {
    for (const [estimate, cents] of [
      [null, 50000],
      ['0', 0],
      ['2500', 25000],
      ['7500', 75000],
      ['10000', 100000],
      ['25000', 100000],
      ['1234.56', 12346],
      ['0.05', 1]
    ] as const) {
      expect(contractRetainerCents({ quotedAmount: estimate })).toBe(cents);
    }
    for (const estimate of ['', '-100', 'NaN', '1e3'])
      expect(() => contractRetainerCents({ quotedAmount: estimate })).toThrow();
  });

  it('retains new billing wording and retainer terms while preserving legacy drafts and templates', async () => {
    const legacy = draft();
    delete legacy.billableTimeTerms;
    delete legacy.retainer;
    delete legacy.arbitration;
    const oldSaved = (await saveContract(db, { draft: legacy })).data!;
    expect((await getContract(db, oldSaved.id)).data?.draft).toEqual(legacy);
    const current = { ...draft(), quotedAmount: '7500' };
    const saved = (await saveContract(db, { draft: current })).data!;
    expect((await getContract(db, saved.id)).data?.draft).toEqual(current);
    const terms = (await getContractTermsTemplate(db)).data!;
    delete terms.terms.billableTimeTerms;
    delete terms.terms.arbitration;
    const template = await saveContractTermsTemplate(db, terms);
    expect(template.success).toBe(true);
    expect(template.data?.terms).not.toHaveProperty('billableTimeTerms');
    expect(template.data?.terms).not.toHaveProperty('arbitration');
    expect((await getContract(db, saved.id)).data?.draft.billableTimeTerms).toBe(current.billableTimeTerms);
    expect(
      (
        await saveContract(db, {
          id: saved.id,
          revision: saved.revision,
          draft: { ...current, retainer: { policy: 'estimate-ten-percent-capped-v1', terms: '' } }
        })
      ).success
    ).toBe(false);
    expect((await getContract(db, saved.id)).data?.draft).toEqual(current);
    const missingNotice = await saveContract(db, {
      id: saved.id,
      revision: saved.revision,
      draft: { ...current, arbitration: { terms: 'Custom arbitration terms', notice: '' } }
    });
    expect(missingNotice.success).toBe(false);
    expect((await getContract(db, saved.id)).data?.draft.arbitration).toEqual(current.arbitration);
  });

  it('upgrades independently, preserves existing data, and retains snapshots after catalog changes', async () => {
    await db.run('DROP TABLE contracts');
    await db.run('CREATE TABLE invoices (id INTEGER PRIMARY KEY, amount INTEGER, receipt BLOB)');
    await db.run('INSERT INTO invoices VALUES (1, 12345, ?)', [Buffer.from('original receipt')]);
    await db.run('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT, amount TEXT, isArchived INTEGER)');
    await db.run("INSERT INTO items VALUES (1, 'Standard labor', '85', 0)");
    const before = await db.all('SELECT * FROM invoices');
    await createContractsSchema(db);
    await createContractsSchema(db);
    const saved = await saveContract(db, { draft: draft() });
    expect(saved.success).toBe(true);
    await db.run("UPDATE items SET amount = '150', name = 'Renamed', isArchived = 1");
    await db.run('DELETE FROM items');
    expect((await getContract(db, saved.data!.id)).data?.draft.rates[0]).toEqual(draft().rates[0]);
    expect(await db.all('SELECT * FROM invoices')).toEqual(before);
    const rows = await listContracts(db, 1);
    expect(rows.data).toHaveLength(1);
    expect(rows.data?.[0]).not.toHaveProperty('payload');
    expect(rows.data?.[0]).not.toHaveProperty('draft');
  });

  it('deletes only the selected contract and preserves invoices, receipts, payments, catalog and standard terms', async () => {
    const first = (await saveContract(db, { draft: draft() })).data!;
    const retained = (await saveContract(db, { draft: { ...draft(), title: 'Keep this contract' } })).data!;
    const template = (await saveContractTermsTemplate(db, (await getContractTermsTemplate(db)).data!)).data!;
    await db.run('CREATE TABLE invoices (id INTEGER PRIMARY KEY, amount INTEGER, receipt BLOB)');
    await db.run('INSERT INTO invoices VALUES (?, ?, ?)', [1, 12345, Buffer.from('original receipt')]);
    await db.run('CREATE TABLE payments (id INTEGER PRIMARY KEY, invoiceId INTEGER, amount INTEGER)');
    await db.run('INSERT INTO payments VALUES (1, 1, 5000)');
    await db.run('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)');
    await db.run('INSERT INTO items VALUES (?, ?)', [1, 'Standard labor']);
    const before = await Promise.all(['invoices', 'payments', 'items'].map(table => db.all(`SELECT * FROM ${table}`)));

    expect(await deleteContract(db, { id: first.id, revision: first.revision })).toEqual({
      success: true,
      data: { id: first.id }
    });
    expect((await getContract(db, first.id)).success).toBe(false);
    expect((await listContracts(db)).data?.map(row => row.id)).toEqual([retained.id]);
    expect((await getContract(db, retained.id)).data).toEqual(retained);
    expect((await getContractTermsTemplate(db)).data).toEqual(template);
    const after = await Promise.all(['invoices', 'payments', 'items'].map(table => db.all(`SELECT * FROM ${table}`)));
    expect(after).toEqual(before);
  });

  it('rejects invalid and stale deletions, allows confirmed signed records, and does not recreate deleted contracts', async () => {
    const first = (await saveContract(db, { draft: draft() })).data!;
    const changed = (
      await saveContract(db, { id: first.id, revision: first.revision, draft: { ...first.draft, signed: true } })
    ).data!;
    for (const request of [
      undefined,
      { id: 0, revision: 1 },
      { id: first.id, revision: 0 },
      { id: String(first.id), revision: 2 }
    ]) {
      expect((await deleteContract(db, request as DeleteContractRequest)).success).toBe(false);
    }
    expect((await deleteContract(db, { id: first.id, revision: first.revision })).success).toBe(false);
    expect((await getContract(db, first.id)).data).toEqual(changed);
    expect((await deleteContract(db, { id: changed.id, revision: changed.revision })).success).toBe(true);
    expect((await deleteContract(db, { id: changed.id, revision: changed.revision })).success).toBe(false);
    expect((await saveContract(db, { id: changed.id, revision: changed.revision, draft: changed.draft })).success).toBe(
      false
    );
    expect((await listContracts(db)).data).toEqual([]);
  });

  it('saves signed status, rejects stale edits and invalid dates without changing the saved document', async () => {
    const first = (await saveContract(db, { draft: draft() })).data!;
    const next = await saveContract(db, {
      id: first.id,
      revision: first.revision,
      draft: { ...draft(), signed: true }
    });
    expect(next.data?.revision).toBe(2);
    expect(next.data?.signed).toBe(true);
    expect(next.data?.draft.signed).toBe(true);
    const stale = await saveContract(db, {
      id: first.id,
      revision: first.revision,
      draft: { ...draft(), title: 'Stale' }
    });
    expect(stale.success).toBe(false);
    expect((await getContract(db, first.id)).data?.title).toBe('Client project');
    expect((await saveContract(db, { draft: { ...draft(), date: '2026-02-30' } })).success).toBe(false);
    expect((await listContracts(db)).data).toHaveLength(1);
  });

  it('round-trips contracts through backups and restores older backups that have no contracts', async () => {
    await initSchema(db);
    const migrations = import.meta.glob('../shared/migrations/*.ts');
    for (const name of Object.keys(migrations).sort()) {
      const migration = (await migrations[name]()) as { up: (db: DatabaseAdapter) => Promise<unknown> };
      const result = (await migration.up(db)) as { success?: boolean } | undefined;
      if (result?.success === false) throw new Error('Migration failed: ' + name);
    }
    const saved = (await saveContract(db, { draft: draft() })).data!;
    const template = (await getContractTermsTemplate(db)).data!;
    await saveContractTermsTemplate(db, {
      ...template,
      terms: { ...template.terms, billingSchedule: 'Template example' }
    });
    const backup = await exportAllData(db);
    expect(backup.success).toBe(true);
    expect(backup.data?.contracts).toHaveLength(1);
    expect(backup.data?.contractTermsTemplates).toHaveLength(1);
    await db.run('DELETE FROM contracts');
    expect((await importAllData(db, backup.data!)).success).toBe(true);
    expect((await getContract(db, saved.id)).data?.draft).toEqual(saved.draft);
    expect((await getContractTermsTemplate(db)).data?.terms.billingSchedule).toBe('Template example');
    const olderBackup: Record<string, unknown> = { ...backup.data! };
    delete olderBackup.contracts;
    delete olderBackup.contractTermsTemplates;
    expect((await importAllData(db, olderBackup)).success).toBe(true);
    expect((await listContracts(db)).data).toEqual([]);
    expect((await getContractTermsTemplate(db)).data?.terms.billingSchedule).toBe('');
  });

  it('applies standard terms to new drafts only and prevents stale template overwrites', async () => {
    const original = (await saveContract(db, { draft: draft() })).data!;
    const initial = (await getContractTermsTemplate(db)).data!;
    const updated = await saveContractTermsTemplate(db, {
      ...initial,
      terms: { ...initial.terms, paymentTerms: 'Custom payment wording for new contracts.' }
    });
    expect(updated.success).toBe(true);
    expect(updated.data?.revision).toBe(1);
    expect((await saveContractTermsTemplate(db, initial)).success).toBe(false);
    expect((await getContract(db, original.id)).data?.draft.paymentTerms).toBe(draft().paymentTerms);
    const current = (await getContractTermsTemplate(db)).data!;
    const nextDraft = newContractDraft('2026-11-08', current.terms);
    expect(nextDraft.paymentTerms).toBe('Custom payment wording for new contracts.');
    expect(nextDraft.style.pageFormat).toBe('LETTER');
  });

  it('preserves optional project details and older drafts, rejecting invalid or reversed dates', async () => {
    const older = draft();
    delete older.projectDetails;
    const oldSaved = await saveContract(db, { draft: older });
    expect(oldSaved.success).toBe(true);
    expect((await getContract(db, oldSaved.data!.id)).data?.draft.projectDetails).toBeUndefined();
    const details = {
      workAndMaterials: 'Agreed work',
      approximateStart: '2026-11-10',
      approximateCompletion: '2026-11-20',
      permitArrangements: 'As agreed',
      otherArrangements: 'Access by appointment'
    };
    const saved = await saveContract(db, { draft: { ...draft(), projectDetails: details } });
    expect(saved.success).toBe(true);
    expect((await getContract(db, saved.data!.id)).data?.draft.projectDetails).toEqual(details);
    for (const end of ['2026-11-09', '2026-02-30']) {
      const result = await saveContract(db, {
        id: saved.data!.id,
        revision: saved.data!.revision,
        draft: { ...draft(), projectDetails: { ...details, approximateCompletion: end } }
      });
      expect(result.success).toBe(false);
    }
    expect((await getContract(db, saved.data!.id)).data?.draft.projectDetails).toEqual(details);
  });
});
