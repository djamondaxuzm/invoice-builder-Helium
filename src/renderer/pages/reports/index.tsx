import { Alert, Box, LinearProgress } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InvoiceType } from '../../shared/enums/invoiceType';
import { ReportRangeType } from '../../shared/enums/reportRangeType';
import { useInvoicesRetrieve } from '../../shared/hooks/invoices/useInvoicesRetrieve';
import {
  buildReport,
  getReportOptions,
  getReportRange,
  reportDay,
  type ReportRange
} from '../../shared/utils/reportFunctions';
import { Header } from './Header';
import { Overview } from './Overview';

export const ReportsPage = () => {
  const { t } = useTranslation();
  const { invoices, loading, error, response, execute } = useInvoicesRetrieve({ type: InvoiceType.invoice });
  const [now, setNow] = useState(() => new Date());
  const [preset, setPreset] = useState(ReportRangeType.last_30_days);
  const [customRange, setCustomRange] = useState<ReportRange>(() => getReportRange(ReportRangeType.last_30_days));
  const [currencyKey, setCurrencyKey] = useState('');
  const [client, setClient] = useState('');
  const [business, setBusiness] = useState('');
  // An open dashboard must not retain yesterday's "last 30 days" window.
  useEffect(() => {
    const tick = () => setNow(previous => (reportDay(previous) === reportDay(new Date()) ? previous : new Date()));
    const timer = window.setInterval(tick, 60000);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', tick);
    };
  }, []);
  const range = useMemo(
    () => (preset === ReportRangeType.custom ? customRange : getReportRange(preset, now)),
    [preset, customRange, now]
  );
  const options = useMemo(() => getReportOptions(invoices), [invoices]);
  const currency = options.currencies.find(option => option.value === currencyKey) ?? options.currencies[0];
  const report = useMemo(() => {
    if (!currency) return {};
    try {
      return {
        data: buildReport(
          invoices,
          range,
          currency,
          {
            clientId: client ? Number(client) : undefined,
            businessId: business ? Number(business) : undefined
          },
          now
        )
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : t('reports.calculationError') };
    }
  }, [invoices, range, currency, client, business, now, t]);
  const failed = error || (response && !response.success);
  return (
    <Box sx={{ pb: 4 }}>
      <Header
        {...options}
        currency={currency?.value ?? ''}
        client={client}
        business={business}
        preset={preset}
        range={range}
        loading={loading}
        onCurrency={setCurrencyKey}
        onClient={setClient}
        onBusiness={setBusiness}
        onPreset={value => {
          setNow(new Date());
          setPreset(value);
        }}
        onCustom={value => {
          setCustomRange(value);
          setPreset(ReportRangeType.custom);
        }}
        onRefresh={() => {
          setNow(new Date());
          execute();
        }}
      />
      {loading && <LinearProgress sx={{ mt: 2 }} aria-label={t('reports.loading')} />}
      {failed && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {t('reports.loadError')}
        </Alert>
      )}
      {report.error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {report.error}
        </Alert>
      )}
      {!failed && !loading && !currency && (
        <Alert severity="info" sx={{ mt: 2 }}>
          {t('reports.noCurrency')}
        </Alert>
      )}
      {!failed && report.data && (
        <Overview data={report.data} range={range} today={reportDay(now)} onClient={setClient} />
      )}
    </Box>
  );
};
