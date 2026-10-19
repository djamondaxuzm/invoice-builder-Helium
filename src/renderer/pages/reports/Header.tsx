import { Box, Button, TextField, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReportRangeType } from '../../shared/enums/reportRangeType';
import type { ReportOption, ReportRange } from '../../shared/utils/reportFunctions';
import { RangeSetter } from './Modals/RangeSetter';

interface Props {
  currencies: ReportOption[];
  clients: ReportOption[];
  businesses: ReportOption[];
  currency: string;
  client: string;
  business: string;
  preset: ReportRangeType;
  range: ReportRange;
  loading: boolean;
  onCurrency: (value: string) => void;
  onClient: (value: string) => void;
  onBusiness: (value: string) => void;
  onPreset: (value: ReportRangeType) => void;
  onCustom: (range: ReportRange) => void;
  onRefresh: () => void;
}

export const Header = (props: Props) => {
  const { t } = useTranslation();
  const [customOpen, setCustomOpen] = useState(false);
  const select = (
    label: string,
    value: string,
    options: ReportOption[],
    change: (value: string) => void,
    all?: string
  ) => (
    <TextField
      select
      size="small"
      label={label}
      value={value}
      onChange={e => change(e.target.value)}
      slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
      sx={{ minWidth: 170, flex: '1 1 170px' }}
    >
      {all !== undefined && <option value="">{all}</option>}
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </TextField>
  );
  const presets = [
    'last30Days',
    'thisMonth',
    'lastMonth',
    'thisQuarter',
    'lastQuarter',
    'thisYear',
    'lastYear',
    'customRange'
  ];
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2 }}>
        <Typography variant="h5">{t('reports.title')}</Typography>
        <Button startIcon={<RefreshIcon />} disabled={props.loading} onClick={props.onRefresh}>
          {t('reports.refresh')}
        </Button>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {select(
          t('reports.dateRange'),
          String(props.preset),
          presets.map((key, index) => ({ value: String(index), label: t(`reports.${key}`) })),
          value => {
            if (Number(value) === ReportRangeType.custom) setCustomOpen(true);
            else props.onPreset(Number(value));
          }
        )}
        {props.preset === ReportRangeType.custom && (
          <Button onClick={() => setCustomOpen(true)}>{t('reports.editRange')}</Button>
        )}
        {select(
          t('common.currency'),
          props.currency,
          props.currencies,
          props.onCurrency,
          props.currencies.length ? undefined : t('reports.noCurrency')
        )}
        {select(t('reports.business'), props.business, props.businesses, props.onBusiness, t('reports.allBusinesses'))}
        {select(t('reports.client'), props.client, props.clients, props.onClient, t('reports.allClients'))}
      </Box>
      <RangeSetter
        key={`${customOpen}:${props.range.from}:${props.range.to}`}
        isOpen={customOpen}
        fromDate={props.range.from}
        to={props.range.to}
        onCancel={() => setCustomOpen(false)}
        onSave={range => {
          props.onCustom(range);
          setCustomOpen(false);
        }}
      />
    </>
  );
};
