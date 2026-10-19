import { Box, Paper, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { ReportData } from '../../shared/utils/reportFunctions';

export const FinancialCards = ({ data, money }: { data: ReportData; money: (value: number) => string }) => {
  const { t } = useTranslation();
  const cards = [
    {
      key: 'billed',
      title: t('reports.invoicedInPeriod'),
      value: money(data.billed),
      detail: t('reports.invoiceAverage', { count: data.invoiceCount, average: money(data.averageInvoice) })
    },
    {
      key: 'payments',
      title: t('reports.paymentsInPeriod'),
      value: money(data.payments),
      detail: t('reports.paymentCount', { count: data.paymentRows.length })
    },
    {
      key: 'outstanding',
      title: t('reports.outstandingToday'),
      value: money(data.outstanding),
      detail: t('reports.allIssueDates')
    },
    {
      key: 'overdue',
      title: t('reports.overdueToday'),
      value: money(data.overdue),
      detail: t('reports.overdue', { count: data.overdueCount })
    }
  ];
  return (
    <Box
      sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', xl: 'repeat(4, 1fr)' }, gap: 2, my: 2 }}
    >
      {cards.map(card => (
        <Paper
          key={card.key}
          variant="outlined"
          sx={{ p: 2, borderTop: 3, borderTopColor: 'primary.main' }}
          data-testid={`report-${card.key}`}
        >
          <Typography variant="body2" color="text.secondary">
            {card.title}
          </Typography>
          <Typography variant="h5" sx={{ my: 1, fontWeight: 600 }}>
            {card.value}
          </Typography>
          <Typography variant="caption">{card.detail}</Typography>
        </Paper>
      ))}
    </Box>
  );
};
