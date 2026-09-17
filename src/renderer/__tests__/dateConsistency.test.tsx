import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { DateFormat } from '../shared/enums/dateFormat';
import { formatDate } from '../shared/utils/formatFunctions';
import { buildBillingPeriod } from '../shared/utils/billingPeriod';
import { invoice, settings } from './billingPeriodFixtures';
import { BillingPeriodDialog } from '../pages/invoices/BillingPeriodDialog';
import { BillingPeriodPDF } from '../pages/invoices/BillingPeriodPDF';
import { UTCDateRangePicker } from '../shared/components/inputs/utcDateRangePicker/UTCDateRangePicker';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../shared/api/restApi', () => ({
  getApi: () => ({ getAllInvoices: async () => ({ success: true, data: [invoice(1), invoice(2)] }) })
}));
vi.mock('../shared/components/inputs/datepicker/Datepicker', () => ({
  Datepicker: ({
    label,
    value,
    format,
    onChange
  }: {
    label: string;
    value?: string;
    format: DateFormat;
    onChange: (value?: string) => void;
  }) => (
    <input
      aria-label={label}
      data-format={format}
      data-display={value ? formatDate(value, format) : ''}
      value={value ?? ''}
      onChange={event => onChange(event.target.value || undefined)}
    />
  )
}));
vi.mock('@react-pdf/renderer', () => ({
  Font: { register: vi.fn() },
  Document: ({ children, title }: { children: ReactNode; title: string }) => (
    <div data-testid="document" title={title}>
      {children}
    </div>
  ),
  Page: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>
}));
afterEach(cleanup);

describe('consistent date displays', () => {
  it.each([
    [DateFormat.MMddyyyy, '09/01/2026', '09/02/2026'],
    [DateFormat.yyyyMMdd, '2026/09/01', '2026/09/02'],
    [DateFormat.ddMMyyyy, '01/09/2026', '02/09/2026']
  ])('uses %s in billing filters, invoice rows and PDF headings', async (dateFormat, first, last) => {
    const configured = { ...settings, dateFormat };
    const dialog = render(<BillingPeriodDialog settings={configured} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText(new RegExp(first))).toBeTruthy());
    expect(screen.getByLabelText('From date').getAttribute('data-format')).toBe(dateFormat);
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2026-09-02' } });
    expect(screen.getByLabelText('From date').getAttribute('data-display')).toBe(last);
    expect(screen.queryByLabelText(new RegExp(first))).toBeNull();
    fireEvent.click(screen.getByText('Select shown'));
    expect(screen.getByText(/1 selected/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '' } });
    expect(screen.getByText(/0 selected/)).toBeTruthy();
    dialog.unmount();
    render(
      <BillingPeriodPDF period={buildBillingPeriod([invoice(1), invoice(2)], configured)} settings={configured} />
    );
    expect(screen.getByTestId('document').title).toBe(`Billing period ${first} to ${last}`);
    expect(screen.getByText(`${first} - ${last}`)).toBeTruthy();
  });
});

describe('date range changes', () => {
  it('does not emit on mount, follows external resets, and clears exactly once', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <UTCDateRangePicker
        valueFrom="2026-09-01"
        valueTo="2026-09-02"
        format={DateFormat.MMddyyyy}
        onChange={onChange}
      />
    );
    expect(onChange).not.toHaveBeenCalled();
    rerender(
      <UTCDateRangePicker
        valueFrom="2026-10-01"
        valueTo="2026-10-02"
        format={DateFormat.MMddyyyy}
        onChange={onChange}
      />
    );
    expect((screen.getByLabelText('common.from') as HTMLInputElement).value).toBe('2026-10-01');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('ariaLabel.clear'));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(undefined, undefined);
    fireEvent.change(screen.getByLabelText('common.from'), { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByLabelText('common.to'), { target: { value: '2026-11-02' } });
    expect(onChange).toHaveBeenLastCalledWith('2026-11-01', '2026-11-02');
  });
});
