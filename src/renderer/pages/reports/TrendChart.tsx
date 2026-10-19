import { Box, FormControlLabel, Switch, Typography, useTheme } from '@mui/material';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DateFormat } from '../../shared/enums/dateFormat';
import { formatDate } from '../../shared/utils/formatFunctions';
import { getReportTrend, type ReportTrend } from '../../shared/utils/reportFunctions';

export const TrendChart = ({
  data,
  money,
  dateFormat,
  monthly,
  subunit
}: {
  data: ReportTrend[];
  money: (value: number) => string;
  dateFormat: DateFormat;
  monthly: boolean;
  subunit: number;
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [cumulative, setCumulative] = useState(false);
  const points = useMemo(() => getReportTrend(data, cumulative, subunit), [data, cumulative, subunit]);
  return (
    <Box sx={{ my: 3 }} data-testid="report-trend">
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">{t('reports.invoiceAndPaymentTrend')}</Typography>
        <FormControlLabel
          control={<Switch checked={cumulative} onChange={e => setCumulative(e.target.checked)} />}
          label={t('reports.cumulative')}
        />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t(monthly ? 'reports.monthlyTrendNote' : 'reports.dailyTrendNote')}
      </Typography>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={points} margin={{ left: 10, right: 20 }} accessibilityLayer>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            minTickGap={35}
            tickFormatter={value => (monthly ? String(value).slice(0, 7) : formatDate(value, dateFormat))}
          />
          <YAxis
            width={75}
            tickFormatter={value => new Intl.NumberFormat(undefined, { notation: 'compact' }).format(value)}
          />
          <Tooltip
            formatter={value => money(Number(value))}
            labelFormatter={value => (monthly ? String(value).slice(0, 7) : formatDate(String(value), dateFormat))}
          />
          <Legend />
          <Line
            type="linear"
            name={t('reports.invoiced')}
            dataKey="billed"
            stroke={theme.palette.primary.main}
            strokeWidth={2}
            dot={{ r: 2 }}
            isAnimationActive={false}
          />
          <Line
            type="linear"
            name={t('reports.recordedPayments')}
            dataKey="payments"
            stroke={theme.palette.success.main}
            strokeWidth={2}
            dot={{ r: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
};
