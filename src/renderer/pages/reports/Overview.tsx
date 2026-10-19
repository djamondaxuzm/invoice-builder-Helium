import { Alert, Box, Button, Paper, Tab, Tabs, TextField, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { saveAs } from 'file-saver';
import { DateFormat } from '../../shared/enums/dateFormat';
import { formatDate } from '../../shared/utils/formatFunctions';
import { reportCsv, reportDay, type ReportData, type ReportRange } from '../../shared/utils/reportFunctions';
import { useAppSelector } from '../../state/configureStore';
import { selectSettings } from '../../state/pageSlice';
import { FinancialCards } from './FinancialCards';
import { TrendChart } from './TrendChart';
import { BreakdownChart } from './BreakdownChart';
import { ReportTable } from './ReportTable';
import { reportFormatter } from './formatReport';

export const Overview = ({
  data,
  range,
  today,
  onClient
}: {
  data: ReportData;
  range: ReportRange;
  today: string;
  onClient: (value: string) => void;
}) => {
  const { t } = useTranslation();
  const settings = useAppSelector(selectSettings);
  const dateFormat = settings?.dateFormat ?? DateFormat.yyyyMMddDash;
  const money = useMemo(
    () => reportFormatter(data.currency, settings?.amountFormat),
    [data.currency, settings?.amountFormat]
  );
  const [tab, setTab] = useState('overview');
  const [clientMetric, setClientMetric] = useState<'billed' | 'payments' | 'outstanding'>('billed');
  const clients = useMemo(
    () => [...data.clients].sort((a, b) => b[clientMetric] - a[clientMetric] || a.id - b.id),
    [data.clients, clientMetric]
  );
  const clientColumns = [
    'client',
    'invoiceCountLabel',
    'invoicedInPeriod',
    'paymentsInPeriod',
    'outstandingToday',
    'overdueToday',
    'credit'
  ].map(key => t(`reports.${key}`));
  const paymentColumns = ['paymentDate', 'invoice', 'client', 'paymentMethod', 'amount'].map(key =>
    t(`reports.${key}`)
  );
  const itemColumns = ['item', 'quantity', 'itemSales'].map(key => t(`reports.${key}`));
  const download = () => {
    const rows: (string | number)[][] =
      tab === 'clients'
        ? [
            clientColumns,
            ...clients.map(c => [
              `${c.name} (#${c.id})`,
              c.invoiceCount,
              c.billed,
              c.payments,
              c.outstanding,
              c.overdue,
              c.credit
            ])
          ]
        : tab === 'payments'
          ? [
              paymentColumns,
              ...data.paymentRows.map(p => [reportDay(p.date), p.invoiceNumber, p.client, p.method, p.amount])
            ]
          : [itemColumns, ...data.items.map(i => [i.name, i.quantity, i.amount])];
    rows.unshift([
      'Currency',
      data.currency.code,
      'From',
      reportDay(range.from),
      'To',
      reportDay(range.to),
      'Balances as of',
      today
    ]);
    saveAs(
      new Blob([reportCsv(rows)], { type: 'text/csv;charset=utf-8' }),
      `Helium-${tab}-${data.currency.code}-${reportDay(range.from)}-${reportDay(range.to)}.csv`
    );
  };
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {formatDate(range.from, dateFormat)} – {formatDate(range.to, dateFormat)} · {data.currency.label}
      </Typography>
      {data.warnings.length > 0 && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          <Typography>{t('reports.dataWarnings')}</Typography>
          {data.warnings.map(message => (
            <Typography key={message} variant="body2">
              {message}
            </Typography>
          ))}
        </Alert>
      )}
      <FinancialCards data={data} money={money} />
      <Typography variant="body2" color="text.secondary">
        {t('reports.dateBasisNote', { date: formatDate(today, dateFormat) })}
      </Typography>
      {data.markedPaid > 0 && (
        <Alert severity="info" sx={{ my: 2 }}>
          {t('reports.manualPaidNote', { amount: money(data.markedPaid) })}
        </Alert>
      )}
      <TrendChart data={data.trend} money={money} dateFormat={dateFormat} monthly={data.monthly} />
      <Paper variant="outlined" sx={{ p: { xs: 1, sm: 2 } }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
          <Tabs
            value={tab}
            onChange={(_, value) => setTab(value)}
            variant="scrollable"
            scrollButtons="auto"
            aria-label={t('reports.views')}
          >
            {['overview', 'clients', 'payments', 'items'].map(value => (
              <Tab key={value} value={value} label={t(`reports.${value}`)} />
            ))}
          </Tabs>
          {tab !== 'overview' && <Button onClick={download}>{t('reports.exportCsv')}</Button>}
        </Box>
        {tab === 'overview' && (
          <>
            <Typography sx={{ mt: 2 }}>
              {t('reports.settlementSummary', {
                rate: data.collectionRate.toFixed(2),
                amount: money(data.periodOutstanding)
              })}
            </Typography>
            {data.credit > 0 && <Typography>{t('reports.creditNote', { amount: money(data.credit) })}</Typography>}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
              <BreakdownChart
                title={t('reports.agingTitle')}
                rows={data.aging.map(a => ({ name: t(`reports.${a.key}`), value: a.amount }))}
                formatValue={money}
              />
              <BreakdownChart
                title={t('reports.statusTitle')}
                rows={data.statuses.map(s => ({ name: t(`reports.${s.key}`), value: s.count }))}
                formatValue={value => String(value)}
              />
            </Box>
            <ReportTable
              label={t('reports.agingTitle')}
              columns={[t('reports.age'), t('reports.invoiceCountLabel'), t('reports.outstanding')]}
              rows={data.aging.map(a => ({
                key: a.key,
                cells: [t(`reports.${a.key}`), String(a.count), money(a.amount)]
              }))}
            />
          </>
        )}
        {tab === 'clients' && (
          <>
            <TextField
              select
              label={t('reports.rankClientsBy')}
              value={clientMetric}
              size="small"
              sx={{ mt: 2, minWidth: 240 }}
              slotProps={{ select: { native: true } }}
              onChange={e => setClientMetric(e.target.value as typeof clientMetric)}
            >
              <option value="billed">{t('reports.invoicedInPeriod')}</option>
              <option value="payments">{t('reports.paymentsInPeriod')}</option>
              <option value="outstanding">{t('reports.outstandingToday')}</option>
            </TextField>
            <BreakdownChart
              title={t('reports.topTenClients')}
              rows={clients.slice(0, 10).map(c => ({ name: `${c.name} (#${c.id})`, value: c[clientMetric] }))}
              formatValue={money}
            />
            <Typography variant="body2" sx={{ mb: 1 }}>
              {t('reports.clientDrilldown')}
            </Typography>
            <ReportTable
              key={`${data.currency.value}:${range.from}:${range.to}:${clientMetric}`}
              label={t('reports.clients')}
              columns={clientColumns}
              onFirstCell={onClient}
              rows={clients.map(c => ({
                key: String(c.id),
                cells: [
                  `${c.name} (#${c.id})`,
                  String(c.invoiceCount),
                  money(c.billed),
                  money(c.payments),
                  money(c.outstanding),
                  money(c.overdue),
                  money(c.credit)
                ]
              }))}
            />
          </>
        )}
        {tab === 'payments' && (
          <>
            <BreakdownChart
              title={t('reports.paymentMethods')}
              rows={data.methods.map(m => ({ name: m.key, value: m.amount }))}
              formatValue={money}
            />
            {!data.paymentRows.length && (
              <Alert severity="info" sx={{ mb: 2 }}>
                {t('reports.noPayments')}
              </Alert>
            )}
            <ReportTable
              key={`${data.currency.value}:${range.from}:${range.to}`}
              label={t('reports.paymentLedger')}
              columns={paymentColumns}
              rows={data.paymentRows.map(p => ({
                key: p.key,
                cells: [formatDate(p.date, dateFormat), p.invoiceNumber, p.client, p.method, money(p.amount)]
              }))}
            />
          </>
        )}
        {tab === 'items' && (
          <>
            <BreakdownChart
              title={t('reports.topTenItems')}
              rows={data.items.slice(0, 10).map(i => ({ name: i.name, value: i.amount }))}
              formatValue={money}
            />
            <Typography variant="body2" sx={{ mb: 2 }}>
              {t('reports.itemSalesNote')}
            </Typography>
            <ReportTable
              label={t('reports.items')}
              columns={itemColumns}
              rows={data.items.map(i => ({ key: i.key, cells: [i.name, String(i.quantity), money(i.amount)] }))}
            />
          </>
        )}
      </Paper>
    </Box>
  );
};
