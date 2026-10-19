import ClearIcon from '@mui/icons-material/Clear';
import IconButton from '@mui/material/IconButton';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import dayjs from 'dayjs';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { DateFormat } from '../../../enums/dateFormat';

interface Props {
  label: string;
  value?: string;
  required?: boolean;
  disabled?: boolean;
  error?: boolean;
  format: DateFormat;
  onChange?: (value?: string) => void;
}
export const Datepicker: React.FC<Props> = ({
  value,
  label,
  required = false,
  disabled = false,
  error = false,
  format,
  onChange = () => {}
}) => {
  const { t } = useTranslation();
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <DatePicker
        sx={{ width: '100%' }}
        disabled={disabled}
        views={['year', 'month', 'day']}
        openTo="day"
        label={label}
        value={value ? dayjs(value) : null}
        format={format.toUpperCase()}
        onChange={newValue => {
          if (newValue && !newValue.isValid()) return;
          // Invoice dates follow the local calendar, like the list and PDF formatters.
          onChange(newValue ? newValue.startOf('day').toISOString() : undefined);
        }}
        slotProps={{
          textField: {
            required: required,
            error: error,
            helperText: error ? t('common.fieldRequired') : '',
            onKeyDown: (e: React.KeyboardEvent) => {
              e.preventDefault();
            },
            slotProps: {
              input: {
                readOnly: true,
                startAdornment:
                  !required && value ? (
                    <IconButton
                      disabled={disabled}
                      size="small"
                      aria-label={t('ariaLabel.clear')}
                      onClick={e => {
                        e.stopPropagation();
                        onChange(undefined);
                      }}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  ) : undefined
              }
            }
          }
        }}
      />
    </LocalizationProvider>
  );
};
