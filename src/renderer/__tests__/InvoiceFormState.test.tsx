import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Form } from '../pages/invoices/Form';
import { InvoiceFormMode } from '../shared/enums/invoiceFormMode';
import { InvoiceType } from '../shared/enums/invoiceType';
import type { Invoice, InvoiceFromData } from '../shared/types/invoice';
import type { Preset } from '../shared/types/preset';

const mocks = vi.hoisted(() => ({ dispatch: vi.fn() }));
vi.mock('../state/configureStore', () => ({ useAppDispatch: () => mocks.dispatch }));
vi.mock('../shared/hooks/styleProfiles/useStyleProfileAdd', () => ({
  useStyleProfileAdd: () => ({ execute: vi.fn() })
}));
vi.mock('../pages/invoices/Preview', () => ({ InvoicesPreview: () => null }));
vi.mock('../pages/invoices/Form/index', () => ({
  InvoiceForm: ({
    invoiceForm,
    setInvoiceForm
  }: {
    invoiceForm?: InvoiceFromData;
    setInvoiceForm: React.Dispatch<React.SetStateAction<InvoiceFromData | undefined>>;
  }) => (
    <>
      <output data-testid="invoice">{JSON.stringify(invoiceForm)}</output>
      <button onClick={() => setInvoiceForm(prev => ({ ...prev, customerNotes: 'edited' }))}>Edit</button>
    </>
  )
}));
afterEach(() => {
  cleanup();
  mocks.dispatch.mockClear();
});
const current = () => JSON.parse(screen.getByTestId('invoice').textContent || '{}') as InvoiceFromData;
const allowed = () =>
  mocks.dispatch.mock.calls.filter(([action]) => action.type === 'pageSlice/setAllowed').at(-1)?.[0].payload;

describe('invoice saved baseline', () => {
  it('does not reapply a creation preset to a saved invoice', async () => {
    const invoice = {
      id: 1,
      invoiceType: InvoiceType.invoice,
      customerNotes: 'saved notes',
      issuedAt: '2026-09-14T12:00:00Z'
    } as Invoice;
    const preset = { customerNotes: 'preset notes' } as Preset;
    render(<Form invoice={invoice} preset={preset} type={InvoiceType.invoice} mode={InvoiceFormMode.edit} />);
    await waitFor(() => expect(current().customerNotes).toBe('saved notes'));
    expect(allowed()).toBe(true);
    fireEvent.click(screen.getByText('Edit'));
    await waitFor(() => expect(allowed()).toBe(false));
  });

  it('resets dirty state to the persisted response after saving, then detects further edits', async () => {
    const invoice = { id: 1, customerNotes: 'original' } as Invoice;
    const { rerender } = render(<Form invoice={invoice} type={InvoiceType.invoice} mode={InvoiceFormMode.edit} />);
    await waitFor(() => expect(current().customerNotes).toBe('original'));
    fireEvent.click(screen.getByText('Edit'));
    await waitFor(() => expect(allowed()).toBe(false));
    rerender(
      <Form invoice={{ ...invoice, customerNotes: 'edited' }} type={InvoiceType.invoice} mode={InvoiceFormMode.edit} />
    );
    await waitFor(() => expect(allowed()).toBe(true));
  });

  it('initializes a fresh invoice with the current date', async () => {
    const before = Date.now();
    render(<Form type={InvoiceType.invoice} mode={InvoiceFormMode.edit} />);
    await waitFor(() => expect(current().issuedAt).toBeDefined());
    expect(new Date(current().issuedAt!).getTime()).toBeGreaterThanOrEqual(before);
    expect(new Date(current().issuedAt!).getTime()).toBeLessThanOrEqual(Date.now());
  });
});
