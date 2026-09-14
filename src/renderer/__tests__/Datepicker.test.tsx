import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import dayjs, { type Dayjs } from 'dayjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Datepicker } from '../shared/components/inputs/datepicker/Datepicker';
import { DateFormat } from '../shared/enums/dateFormat';
import { formatDate } from '../shared/utils/formatFunctions';

const picker = vi.hoisted(() => ({ props: undefined as unknown }));
interface PickerProps {
  value: Dayjs | null;
  onChange: (value: Dayjs | null) => void;
  slotProps: { textField: { slotProps: { input: { startAdornment?: React.ReactNode } } } };
}
vi.mock('@mui/x-date-pickers/DatePicker', () => ({
  DatePicker: (props: PickerProps) => {
    picker.props = props;
    return <div>{props.slotProps.textField.slotProps.input.startAdornment}</div>;
  }
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
afterEach(cleanup);
const getPicker = () => picker.props as PickerProps;

describe('invoice date picker', () => {
  it('does not change a saved date on mount or when the parent changes invoices', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <Datepicker label="Date" value="2026-09-14T02:00:00Z" format={DateFormat.yyyyMMddDash} onChange={onChange} />
    );
    expect(getPicker().value?.format('YYYY-MM-DD')).toBe(formatDate('2026-09-14T02:00:00Z', DateFormat.yyyyMMddDash));
    rerender(
      <Datepicker label="Date" value="2026-09-18T23:00:00Z" format={DateFormat.yyyyMMddDash} onChange={onChange} />
    );
    expect(getPicker().value?.format('YYYY-MM-DD')).toBe(formatDate('2026-09-18T23:00:00Z', DateFormat.yyyyMMddDash));
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each(['2026-03-08', '2026-11-01', '2026-12-31'])('keeps selected day %s through saving and formatting', date => {
    const onChange = vi.fn();
    render(<Datepicker label="Date" format={DateFormat.yyyyMMddDash} onChange={onChange} />);
    act(() => getPicker().onChange(dayjs(date)));
    const saved = onChange.mock.calls[0][0] as string;
    expect(formatDate(saved, DateFormat.yyyyMMddDash)).toBe(date);
    expect(dayjs(saved).format('YYYY-MM-DD')).toBe(date);
  });

  it('propagates clearing an optional due date and ignores invalid selections', () => {
    const onChange = vi.fn();
    render(
      <Datepicker label="Due" value="2026-09-14T12:00:00Z" format={DateFormat.yyyyMMddDash} onChange={onChange} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'ariaLabel.clear' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(undefined);
    act(() => getPicker().onChange(dayjs('invalid')));
    expect(onChange).toHaveBeenCalledTimes(1);
    act(() => getPicker().onChange(null));
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
