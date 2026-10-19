import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Form } from '../pages/invoices/Form';
import { InvoiceFormMode } from '../shared/enums/invoiceFormMode';
import { InvoiceType } from '../shared/enums/invoiceType';
import type { Invoice, InvoiceFromData } from '../shared/types/invoice';
import type { Preset } from '../shared/types/preset';

const mocks = vi.hoisted(() => ({ dispatch: vi.fn(), load: vi.fn() }));
vi.mock('../shared/utils/loadInvoiceDetails', () => ({
  loadInvoiceDetails: (...args: unknown[]) => mocks.load(...args)
}));
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
  it('ignores an older invoice load that completes after switching invoices', async () => {
    let finishFirst!: (invoice: Invoice) => void;
    mocks.load
      .mockImplementationOnce(
        () =>
          new Promise<Invoice>(resolve => {
            finishFirst = resolve;
          })
      )
      .mockResolvedValueOnce({ id: 2, customerNotes: 'second', attachmentsLoaded: true });
    const onChange = vi.fn();
    const { rerender } = render(
      <Form
        invoice={{ id: 1, attachmentsLoaded: false } as Invoice}
        handleChange={onChange}
        type={InvoiceType.invoice}
        mode={InvoiceFormMode.edit}
      />
    );
    expect(screen.queryByText('Edit')).toBeNull();
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ isFormValid: false }));
    rerender(
      <Form
        invoice={{ id: 2, attachmentsLoaded: false } as Invoice}
        handleChange={onChange}
        type={InvoiceType.invoice}
        mode={InvoiceFormMode.edit}
      />
    );
    await waitFor(() => expect(current().customerNotes).toBe('second'));
    finishFirst({ id: 1, customerNotes: 'first' } as Invoice);
    await waitFor(() => expect(current().id).toBe(2));
    fireEvent.click(screen.getByText('Edit'));
    expect(onChange.mock.calls.at(-1)?.[0].invoice.customerNotes).toBe('edited');
  });

  it('keeps failed detail loads out of the editor and supports retry', async () => {
    mocks.load
      .mockRejectedValueOnce(new Error('Load failed'))
      .mockResolvedValueOnce({ id: 3, customerNotes: 'retried' });
    render(
      <Form
        invoice={{ id: 3, attachmentsLoaded: false } as Invoice}
        type={InvoiceType.invoice}
        mode={InvoiceFormMode.edit}
      />
    );
    await screen.findByText('Load failed');
    expect(screen.queryByText('Edit')).toBeNull();
    fireEvent.click(screen.getByText('Retry'));
    await waitFor(() => expect(current().customerNotes).toBe('retried'));
  });

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
