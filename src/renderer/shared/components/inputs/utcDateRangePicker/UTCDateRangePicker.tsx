import { Box, Button } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DateFormat } from '../../../enums/dateFormat';
import { Datepicker } from '../datepicker/Datepicker';

interface Props {
  valueFrom?: string;
  valueTo?: string;
  format: DateFormat;
  onChange?: (valueFrom?: string, valueTo?: string) => void;
}
export const UTCDateRangePicker: React.FC<Props> = ({ valueFrom, valueTo, format, onChange = () => {} }) => {
  const { t } = useTranslation();
  const [range, setRange] = useState<[string?, string?]>([valueFrom, valueTo]);

  useEffect(() => {
    setRange([valueFrom, valueTo]);
  }, [valueFrom, valueTo]);

  const changeRange = (next: [string?, string?]) => {
    setRange(next);
    if (next[0] && next[1]) onChange(next[0], next[1]);
    else onChange(undefined, undefined);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        gap: 1,
        alignItems: 'center',
        width: '100%'
      }}
    >
      <Datepicker
        label={`${t('common.from')}`}
        value={range[0]}
        format={format}
        onChange={newValue => {
          changeRange([newValue, range[1]]);
        }}
      />
      <Datepicker
        label={`${t('common.to')}`}
        value={range[1]}
        format={format}
        onChange={newValue => {
          changeRange([range[0], newValue]);
        }}
      />

      <Button variant="outlined" onClick={() => changeRange([undefined, undefined])}>
        {t('ariaLabel.clear')}
      </Button>
    </Box>
  );
};
