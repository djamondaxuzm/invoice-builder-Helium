import { Alert, Autocomplete, Box, Grid, SwipeableDrawer, TextField, useMediaQuery, useTheme } from '@mui/material';
import { memo, useEffect, useState, type FC } from 'react';
import { parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { AmountInput } from '../../../../shared/components/inputs/amountInput/AmountInput';
import { Datepicker } from '../../../../shared/components/inputs/datepicker/Datepicker';
import { PageHeader } from '../../../../shared/components/layout/pageHeader/PageHeader';
import { PaymentType } from '../../../../shared/enums/paymentType';
import { useForm } from '../../../../shared/hooks/form/useForm';
import type { PaymentForm } from '../../../../shared/types/invoice';
import { validators } from '../../../../shared/utils/validatorFunctions';
import { useAppSelector } from '../../../../state/configureStore';
import { selectSettings } from '../../../../state/pageSlice';

interface Props {
  isOpen: boolean;
  onClose?: () => void;
  onOpen?: () => void;
  onClick?: (data: PaymentForm) => void;
  data?: PaymentForm;
  title?: string;
  helperText?: string;
  maxAmount?: number;
  decimalScale?: number;
  requireMethodSelection?: boolean;
}
const AddPaymentDropdownComponent: FC<Props> = ({
  isOpen,
  data,
  onClose,
  onOpen,
  onClick,
  title,
  helperText,
  maxAmount,
  decimalScale,
  requireMethodSelection
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const storeSettings = useAppSelector(selectSettings);

  const paymentOption = [
    { label: t('common.cash'), value: PaymentType.cash },
    { label: t('common.cheque'), value: PaymentType.cheque },
    { label: t('common.bank'), value: PaymentType.bank },
    { label: t('common.creditCard'), value: PaymentType.creditCard },
    { label: t('common.paypal'), value: PaymentType.paypal },
    { label: t('common.other'), value: PaymentType.other }
  ];

  const { form, setForm, update } = useForm<PaymentForm>({
    paymentMethod: data?.paymentMethod ?? (requireMethodSelection ? undefined : PaymentType.cash),
    paidAmount: data?.paidAmount ?? 0,
    paidAt: data?.paidAt ?? '',
    notes: data?.notes ?? '',
    id: data?.id
  });

  const [errors, setErrors] = useState({
    paidAmount: false,
    paidAt: false,
    paymentMethod: false
  });
  const [isFormValid, setIsFormValid] = useState(false);

  const validateField = (field: keyof typeof errors, value: string) => {
    if (!validators.required(value) && (field === 'paidAmount' || field === 'paidAt' || field === 'paymentMethod')) {
      setErrors(e => ({ ...e, [field]: true }));
    } else {
      setErrors(e => ({ ...e, [field]: false }));
    }
  };

  useEffect(() => {
    if (isOpen) {
      setForm({
        paymentMethod: data?.paymentMethod ?? (requireMethodSelection ? undefined : PaymentType.cash),
        paidAmount: data?.paidAmount ?? 0,
        paidAt: data?.paidAt ?? '',
        notes: data?.notes ?? '',
        id: data?.id
      });
      setErrors({
        paidAmount: false,
        paidAt: false,
        paymentMethod: false
      });
    }
  }, [isOpen, data, setForm, requireMethodSelection]);

  useEffect(() => {
    const valid =
      typeof form.paidAmount !== 'undefined' &&
      Number.isFinite(form.paidAmount) &&
      form.paidAmount > 0 &&
      (maxAmount === undefined || form.paidAmount <= maxAmount) &&
      typeof form.paymentMethod !== 'undefined' &&
      typeof form.paidAt !== 'undefined' &&
      Number.isFinite(parseISO(form.paidAt).getTime());

    setIsFormValid(valid);
  }, [form, errors, maxAmount]);
  return (
    <>
      <SwipeableDrawer
        anchor="bottom"
        open={isOpen}
        onClose={() => onClose?.()}
        onOpen={() => onOpen?.()}
        slotProps={{
          paper: {
            sx: {
              maxWidth: isDesktop ? '40%' : '100%',
              maxHeight: '85dvh',
              height: 'auto',
              mx: 'auto',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              p: 3
            }
          }
        }}
      >
        <Box sx={{ mb: 2 }}>
          <PageHeader
            title={title ?? t('invoices.addPayment')}
            showBack={false}
            showSave={true}
            showClose={true}
            formData={form}
            isFormValid={isFormValid}
            onClose={onClose}
            onSave={data => {
              onClick?.(data as PaymentForm);
            }}
          />
        </Box>
        {helperText && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {helperText}
          </Alert>
        )}
        <Grid container spacing={2}>
          {storeSettings && (
            <Grid size={{ xs: 12, md: 6 }}>
              <Autocomplete
                fullWidth
                options={paymentOption}
                getOptionLabel={option => option.label}
                disableClearable={!requireMethodSelection}
                value={paymentOption.find(opt => opt.value === form.paymentMethod) ?? null}
                onChange={(_e, newValue) => {
                  update('paymentMethod', newValue?.value);
                  validateField('paymentMethod', newValue?.value.toString() ?? '');
                }}
                renderInput={params => <TextField {...params} label={t('invoices.type')} required />}
                freeSolo={false}
              />
            </Grid>
          )}
          {storeSettings && (
            <Grid size={{ xs: 12, md: 6 }}>
              <AmountInput
                max={maxAmount}
                decimalScale={decimalScale}
                required={true}
                amountFormat={storeSettings?.amountFormat}
                label={t('common.amount')}
                value={form.paidAmount}
                error={errors.paidAmount}
                helperText={errors.paidAmount ? t('common.fieldRequired') : ''}
                onChange={e => {
                  update('paidAmount', e);
                  validateField('paidAmount', (e ?? '').toString());
                }}
              />
            </Grid>
          )}
          {storeSettings && (
            <Grid size={{ xs: 12, md: 12 }}>
              <Datepicker
                label={`${t('invoices.paidAt')}`}
                error={errors.paidAt}
                required={true}
                value={form.paidAt}
                format={storeSettings.dateFormat}
                onChange={value => {
                  update('paidAt', value);
                  validateField('paidAt', value ?? '');
                }}
              />
            </Grid>
          )}
          <Grid size={{ xs: 12, md: 12 }}>
            <TextField
              label={t('invoices.notes')}
              fullWidth
              value={form.notes}
              onChange={e => {
                update('notes', e.target.value);
              }}
            />
          </Grid>
        </Grid>
      </SwipeableDrawer>
    </>
  );
};
export const AddPaymentDropdown = memo(AddPaymentDropdownComponent);
