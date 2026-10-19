import { getFormattingMeta } from '../../shared/utils/formatFunctions';
import type { AmountFormat } from '../../shared/enums/amountFormat';
import type { ReportCurrency } from '../../shared/utils/reportFunctions';

export const reportFormatter = (currency: ReportCurrency, amountFormat?: AmountFormat) => {
  const precision = Math.max(0, Math.min(6, Math.ceil(Math.log10(currency.subunit))));
  const formatter = new Intl.NumberFormat(getFormattingMeta(amountFormat).baseLocale, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision
  });
  return (value: number) => `${formatter.format(value)} ${currency.code}`;
};
