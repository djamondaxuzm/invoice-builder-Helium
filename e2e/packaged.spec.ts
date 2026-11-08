import { _electron as electron, expect, test } from '@playwright/test';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { DatabaseType } from '../src/renderer/shared/enums/databaseType';
import { DBInitType } from '../src/renderer/shared/enums/dbInitType';
import { InvoiceType } from '../src/renderer/shared/enums/invoiceType';
import { newContractDraft } from '../src/backend/shared/utils/contracts';
import { PDFDocument } from 'pdf-lib';

// Playwright requires an object fixture argument before testInfo.
// eslint-disable-next-line no-empty-pattern
test('packaged app creates, saves and reopens SQLite data with an isolated profile', async ({}, testInfo) => {
  const executablePath = process.env.HELIUM_PACKAGED_EXE;
  if (!executablePath) throw new Error('Set HELIUM_PACKAGED_EXE to the packaged app executable.');
  const profile = testInfo.outputPath('profile');
  const database = testInfo.outputPath('packaged-test.db');
  mkdirSync(profile, { recursive: true });
  if (process.env.HELIUM_TEST_DATABASE) copyFileSync(process.env.HELIUM_TEST_DATABASE, database);

  const app = await electron.launch({ executablePath, args: ['--user-data-dir=' + profile] });
  try {
    const runtime = await app.evaluate(({ app, BrowserWindow }) => {
      BrowserWindow.getAllWindows().forEach(window => {
        // Keep animation frames running for Playwright's click stability checks while hidden.
        window.webContents.setBackgroundThrottling(false);
        window.hide();
      });
      const fs = globalThis.process.getBuiltinModule('fs');
      const path = globalThis.process.getBuiltinModule('path');
      const root = app.getAppPath();
      return {
        packaged: app.isPackaged,
        profile: app.getPath('userData'),
        renderer: fs.existsSync(path.join(root, 'dist-fe/index.html')),
        licenses: fs.existsSync(path.join(root, 'dist-fe/.vite/license.md')),
        duplicatedIcons: fs.existsSync(path.join(root, 'node_modules/@mui/icons-material')),
        sqlite: fs.existsSync(path.join(root, 'node_modules/sqlite3/lib/sqlite3.js'))
      };
    });
    expect(runtime).toMatchObject({
      packaged: true,
      renderer: true,
      licenses: true,
      duplicatedIcons: false,
      sqlite: true
    });
    expect(resolve(runtime.profile)).toBe(resolve(profile));
    const page = await app.firstWindow();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.waitForFunction(() => Boolean(window.electronAPI?.initializeDatabase));
    const init = await page.evaluate(
      ({ fullPath, mode, dbType }) => window.electronAPI.initializeDatabase({ fullPath, mode, dbType }),
      {
        fullPath: database,
        mode: process.env.HELIUM_TEST_DATABASE ? DBInitType.open : DBInitType.create,
        dbType: DatabaseType.sqlite
      }
    );
    expect(init).toMatchObject({ success: true });
    const result = await page.evaluate(async type => {
      const api = window.electronAPI;
      const invoices = await api.getAllInvoices(type, undefined, { attachmentMetadataOnly: true });
      const clients = await api.getAllClients();
      const settings = await api.getAllSettings();
      const layouts = await api.getAllLayouts();
      const saved = await api.addClient({ name: 'Packaging smoke test', shortName: 'PT', isArchived: false });
      return {
        invoices: invoices.success,
        invoiceCount: invoices.data?.length,
        clients: clients.success,
        settings: settings.success,
        layouts: layouts.success,
        saved
      };
    }, InvoiceType.invoice);
    expect(result).toMatchObject({
      invoices: true,
      clients: true,
      settings: true,
      layouts: true,
      saved: { success: true }
    });
    await testInfo.attach('database-check', { body: JSON.stringify(result), contentType: 'application/json' });

    // Exercise the actual database chooser and renderer using a deterministic file dialog.
    await app.evaluate(({ dialog }, fullPath) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [fullPath] });
    }, database);
    await page.getByRole('button', { name: 'Open existing database', exact: true }).click();
    await expect(page.getByText('Invoices', { exact: true }).first()).toBeVisible();
    await page.getByText('Invoices', { exact: true }).first().click();
    await expect(page.getByRole('button', { name: 'Billing period / payments' })).toBeVisible();
    const clients = await page.evaluate(() => window.electronAPI.getAllClients());
    expect(clients.data?.some(client => client.shortName === 'PT')).toBe(true);

    const contract = {
      ...newContractDraft('2026-11-08'),
      title: 'Packaged contract check',
      client: { sourceId: 1, name: 'Example client', address: '', email: '', phone: '' },
      business: { sourceId: 1, name: 'Example business', address: '', email: '', phone: '' },
      rates: [{ sourceId: 1, name: 'Standard labor', hourlyRate: '85' }],
      assessmentRate: { sourceId: 1, name: 'Standard labor', hourlyRate: '85' }
    };
    const savedContract = await page.evaluate(draft => window.electronAPI.saveContract({ draft }), contract);
    expect(savedContract.success).toBe(true);
    const template = await page.evaluate(() => window.electronAPI.getContractTermsTemplate());
    expect(template.success).toBe(true);
    await page.getByText('Contracts', { exact: true }).first().click();
    await page.getByRole('button', { name: 'Open contract', exact: true }).first().click();
    await expect(page.getByLabel('Project title', { exact: true })).toHaveValue(contract.title);
    await page.getByRole('button', { name: 'Project-specific details', exact: true }).click();
    await page
      .getByLabel('Agreed work and materials', { exact: true })
      .fill('Agreed work and materials for the project.');
    await page.getByLabel('Approximate start', { exact: true }).fill('2026-11-10');
    await page.getByLabel('Approximate completion', { exact: true }).fill('2026-11-20');
    await page.getByRole('button', { name: 'Save draft', exact: true }).click();
    await expect(page.getByText('Contract saved.', { exact: true })).toBeVisible();
    const reopened = await page.evaluate(id => window.electronAPI.getContract(id), savedContract.data!.id);
    expect(reopened.data?.draft.projectDetails?.approximateCompletion).toBe('2026-11-20');
    expect(reopened.data?.draft.standardTerms).toContain('signed by both parties');
    expect(reopened.data?.draft.retainer).toEqual(contract.retainer);
    expect(reopened.data?.draft.billableTimeTerms).toContain('no separate warning is required');
    expect(reopened.data?.draft.paymentTerms).toContain('non-compounding late charge of 1.5%');
    expect(reopened.data?.draft.arbitration).toEqual(contract.arbitration);
    expect(template.data?.terms.arbitration).toEqual(contract.arbitration);

    const pdfPath = testInfo.outputPath('contract-draft.pdf');
    await app.evaluate(({ BrowserWindow }, output) => {
      Object.assign(globalThis, { heliumContractDownload: 'waiting' });
      BrowserWindow.getAllWindows()[0].webContents.session.once('will-download', (_event, item) => {
        item.setSavePath(output);
        item.once('done', (_event, state) => Object.assign(globalThis, { heliumContractDownload: state }));
      });
    }, pdfPath);
    await page.getByRole('tab', { name: 'Review', exact: true }).click();
    await expect(page.getByText('ARBITRATION OF DISPUTES', { exact: true })).toBeVisible();
    await expect(page.getByText(/Upfront retainer: \$500\.00/)).toBeVisible();
    await page.getByRole('button', { name: 'Export draft PDF', exact: true }).click();
    await expect
      .poll(
        () =>
          app.evaluate(
            () => (globalThis as typeof globalThis & { heliumContractDownload: string }).heliumContractDownload
          ),
        { timeout: 30000 }
      )
      .toBe('completed');
    const pdf = await PDFDocument.load(readFileSync(pdfPath));
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2);
    expect(pdf.getPage(0).getWidth()).toBe(612);
    await testInfo.attach('contract-draft', { path: pdfPath, contentType: 'application/pdf' });
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('packaged-contract.png') });
  } finally {
    await app.close();
  }
});
