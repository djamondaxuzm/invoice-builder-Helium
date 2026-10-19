import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { BillingPeriodDialog } from '../pages/invoices/BillingPeriodDialog';
import { invoice, settings } from './billingPeriodFixtures';
import { selectBillingRows } from '../shared/utils/billingSelection';
import { InvoiceType } from '../shared/enums/invoiceType';

vi.mock('../shared/api/restApi', () => ({
  getApi: () => ({
    getAllInvoices: async (type: InvoiceType) => ({
      success: true,
      data:
        type === InvoiceType.invoice
          ? [
              invoice(3),
              invoice(1),
              invoice(4, { clientId: 9, invoiceClientSnapshot: { clientName: 'Other Client' } }),
              invoice(2)
            ]
          : []
    })
  })
}));
vi.mock('../shared/components/inputs/datepicker/Datepicker', () => ({
  Datepicker: ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => (
    <input aria-label={label} value={value} onChange={event => onChange(event.target.value)} />
  )
}));
afterEach(cleanup);

it('requires a client, sorts rows by date, supports Ctrl/Shift selection and clears on client changes', async () => {
  render(<BillingPeriodDialog settings={settings} onClose={vi.fn()} />);
  await screen.findByText('Example Client');
  expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  fireEvent.change(screen.getByLabelText('Client'), { target: { value: '2' } });
  const list = screen.getByRole('listbox', { name: 'Invoices by date' });
  const rows = within(list).getAllByRole('option');
  expect(rows.map(row => row.textContent)).toEqual([
    expect.stringContaining('2026-09-01'),
    expect.stringContaining('2026-09-02'),
    expect.stringContaining('2026-09-03')
  ]);
  fireEvent.click(rows[0]);
  fireEvent.click(rows[2], { ctrlKey: true });
  expect(screen.getByText(/2 selected/)).toBeTruthy();
  fireEvent.click(rows[0]);
  fireEvent.click(rows[2], { shiftKey: true });
  expect(screen.getByText(/3 selected/)).toBeTruthy();
  fireEvent.click(within(rows[1]).getByRole('checkbox'));
  expect(screen.getByText(/2 selected/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Client'), { target: { value: '9' } });
  expect(screen.getByText(/0 selected/)).toBeTruthy();
  expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Download PDF' })).toBeDisabled();
});

it('supports reverse ranges and additive Ctrl+Shift ranges without duplicates', () => {
  expect(selectBillingRows([1, 2, 3, 4], [4], 1, 3, { shiftKey: true })).toEqual([1, 2, 3]);
  expect(selectBillingRows([1, 2, 3, 4], [4, 2], 1, 3, { shiftKey: true, ctrlKey: true })).toEqual([4, 2, 1, 3]);
  expect(selectBillingRows([1, 2], [], 2, 99, { shiftKey: true })).toEqual([2]);
});
