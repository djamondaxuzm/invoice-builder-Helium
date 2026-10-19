import { calcTax, calcDiscount, calcSurcharge, getInvoiceTotal } from '../../../backend/shared/utils/invoiceMath';
export { calcTax, calcDiscount, calcSurcharge, getInvoiceTotal } from '../../../backend/shared/utils/invoiceMath';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { CurrencyFormat } from '../enums/currencyFormat';
import { DiscountType } from '../enums/discountType';
import { InvoiceItemTaxType, InvoiceTaxType } from '../enums/taxType';
import type { InvoiceItem, InvoicePayment } from '../types/invoice';
import type { Settings } from '../types/settings';
import { formatAmount, getFormattedCurrency } from './formatFunctions';

export const getDaysLeft = (dueDate?: string) => {
  if (!dueDate) return 0;

  const d = typeof dueDate === 'string' ? parseISO(dueDate) : dueDate;

  const due = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = new Date();
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return differenceInCalendarDays(due, todayDateOnly);
};

export const calcUnitPrice = (data: { supportsSubunit?: boolean; amountCents: number; subunit?: number }) => {
  const { supportsSubunit, amountCents, subunit } = data;

  if (supportsSubunit && subunit! === 0) return 0;

  const unitPrice = supportsSubunit ? amountCents / subunit! : amountCents;

  return unitPrice;
};

export const getInvoiceItemLevelTaxDiscount = (data: {
  taxRate: number;
  unitPrice: number;
  quantity: number;
  taxType?: InvoiceItemTaxType;
  invoiceItems: InvoiceItem[];
  discountType?: DiscountType;
  discountAmount?: number;
  discountPercent?: number;
}) => {
  const {
    unitPrice,
    quantity,
    taxRate,
    taxType,
    invoiceItems,
    discountType,
    discountAmount = 0,
    discountPercent = 0
  } = data;
  const unitTotal = unitPrice * quantity;
  let discount = 0;
  const subTotal =
    invoiceItems.reduce((sum, item) => {
      return sum + Number(item.invoiceItemSnapshot.unitPriceCents) * Number(item.quantity);
    }, 0) ?? 0;

  const totalDiscount = calcDiscount({ subTotal, discountType, discountAmount, discountPercent });

  if (subTotal > 0 && totalDiscount > 0) {
    discount = Math.round((unitTotal / subTotal) * totalDiscount);
  }

  const taxableAmount = unitTotal - discount;
  const tax = calcTax(taxableAmount, taxRate, taxType);

  return { tax, discount };
};

export const getInvoiceItemTotal = (data: {
  subTotal?: number;
  taxRate: number;
  unitPrice: number;
  quantity: number;
  taxType?: InvoiceItemTaxType;
  includeTax?: boolean;
  invoiceItems: InvoiceItem[];
  discountType?: DiscountType;
  discountAmount?: number;
  discountPercent?: number;
}) => {
  const {
    unitPrice,
    quantity,
    includeTax = true,
    taxRate,
    taxType,
    invoiceItems,
    discountType,
    discountAmount = 0,
    discountPercent = 0
  } = data;
  const unitTotal = unitPrice * quantity;
  let discount = 0;
  const subTotal =
    data.subTotal ??
    invoiceItems.reduce((sum, item) => {
      return sum + Number(item.invoiceItemSnapshot.unitPriceCents) * Number(item.quantity);
    }, 0) ??
    0;

  const totalDiscount = calcDiscount({ subTotal, discountType, discountAmount, discountPercent });

  if (subTotal > 0 && totalDiscount > 0) {
    discount = Math.round((unitTotal / subTotal) * totalDiscount);
  }

  const taxableAmount = unitTotal - discount;
  const tax = includeTax ? calcTax(taxableAmount, taxRate, taxType) : 0;

  return taxType === InvoiceItemTaxType.inclusive ? unitTotal - discount : unitTotal - discount + tax;
};

export const getPaidAmount = (invoicePayments: InvoicePayment[]) => {
  return invoicePayments.reduce((sum, p) => sum + Number(p.amountCents), 0) ?? 0;
};

export const getBalanceDue = (data: {
  taxRate: number;
  taxType?: InvoiceTaxType;
  invoiceItems: InvoiceItem[];
  discountType?: DiscountType;
  discountAmount?: number;
  discountPercent?: number;
  shippingFee?: number;
  surchargeType?: DiscountType;
  surchargeAmount?: number;
  surchargePercent?: number;
  invoicePayments: InvoicePayment[];
}) => {
  const {
    taxRate,
    taxType,
    invoiceItems,
    discountType,
    discountAmount = 0,
    discountPercent = 0,
    shippingFee = 0,
    surchargeAmount = 0,
    surchargeType,
    surchargePercent = 0,
    invoicePayments
  } = data;
  const balanceAmount =
    getInvoiceTotal({
      taxRate,
      taxType,
      invoiceItems,
      discountType,
      discountAmount,
      discountPercent,
      shippingFee,
      surchargeAmount,
      surchargeType,
      surchargePercent
    }) - getPaidAmount(invoicePayments);

  return balanceAmount;
};

export const createCurrencyFormatter = (data: {
  storeSettings?: Settings;
  currencySymbol?: string;
  currencyCode?: string;
  currencySubunit?: number;
  currencyFormat?: string;
}) => {
  const { storeSettings, currencySymbol, currencyCode, currencyFormat } = data;

  const supports = supportsCurrencySubunit(data);

  return (amount: number) =>
    supports
      ? getFormattedCurrency({
          amount,
          amountFormat: storeSettings!.amountFormat,
          format: currencyFormat as CurrencyFormat,
          symbol: currencySymbol!,
          code: currencyCode!
        })
      : formatAmount(amount, storeSettings?.amountFormat);
};

export const supportsCurrencySubunit = (data: {
  storeSettings?: Settings;
  currencySymbol?: string;
  currencyCode?: string;
  currencySubunit?: number;
  currencyFormat?: string;
}) => {
  const { storeSettings, currencySymbol, currencyCode, currencySubunit, currencyFormat } = data;
  return Boolean(
    storeSettings &&
    currencySymbol !== undefined &&
    currencyCode !== undefined &&
    currencySubunit !== undefined &&
    currencyFormat !== undefined
  );
};

export const getPaidData = (data: {
  storeSettings?: Settings;
  currencySymbol?: string;
  currencyCode?: string;
  currencySubunit?: number;
  currencyFormat?: string;
  invoicePayment?: InvoicePayment;
}) => {
  const { storeSettings, currencySymbol, currencyCode, currencySubunit, currencyFormat, invoicePayment } = data;

  const supportsSubunit = supportsCurrencySubunit({
    storeSettings,
    currencySymbol,
    currencyCode,
    currencySubunit,
    currencyFormat
  });
  const localFormat = createCurrencyFormatter({
    storeSettings,
    currencySymbol,
    currencyCode,
    currencySubunit,
    currencyFormat
  });

  const amountPaid = calcUnitPrice({
    supportsSubunit,
    amountCents: Number(invoicePayment?.amountCents ?? 0),
    subunit: currencySubunit
  });

  return {
    amountPaid,
    amountPaidFormatted: localFormat(amountPaid)
  };
};

export const getFinancialData = (data: {
  storeSettings?: Settings;
  currencySymbol?: string;
  currencyCode?: string;
  currencySubunit?: number;
  currencyFormat?: string;
  invoiceItems: InvoiceItem[];
  discountType?: DiscountType;
  discountAmount?: number;
  discountPercent?: number;
  taxRate: number;
  shippingAmount?: number;
  surchargeAmount?: number;
  surchargeType?: DiscountType;
  surchargePercent?: number;
  taxType?: InvoiceTaxType;
  invoicePayments: InvoicePayment[];
}) => {
  const {
    storeSettings,
    currencySymbol,
    currencyCode,
    currencySubunit,
    currencyFormat,
    invoiceItems,
    discountType,
    discountAmount = 0,
    discountPercent = 0,
    shippingAmount = 0,
    surchargeAmount = 0,
    surchargeType,
    surchargePercent,
    taxRate,
    taxType,
    invoicePayments
  } = data;

  const supportsSubunit = supportsCurrencySubunit({
    storeSettings,
    currencySymbol,
    currencyCode,
    currencySubunit,
    currencyFormat
  });
  const format = createCurrencyFormatter({
    storeSettings,
    currencySymbol,
    currencyCode,
    currencySubunit,
    currencyFormat
  });

  let subTotalAmount = 0;
  let totalItemTaxAmount = 0;
  invoiceItems?.forEach(item => {
    const subTotal = getInvoiceItemTotal({
      taxRate: item.taxRate,
      unitPrice: Number(item.invoiceItemSnapshot.unitPriceCents),
      quantity: Number(item.quantity),
      taxType: item.taxType,
      includeTax: false,
      invoiceItems
    });
    const { tax: itemLevelTax } = getInvoiceItemLevelTaxDiscount({
      taxRate: item.taxRate,
      unitPrice: Number(item.invoiceItemSnapshot.unitPriceCents),
      quantity: Number(item.quantity),
      taxType: item.taxType,
      invoiceItems,
      discountType,
      discountAmount,
      discountPercent
    });

    totalItemTaxAmount += itemLevelTax;
    subTotalAmount += subTotal;
  });

  const calculatedDiscountAmount = calcDiscount({
    subTotal: subTotalAmount,
    discountAmount,
    discountPercent,
    discountType
  });
  const totalAmountAfterDiscount = subTotalAmount - calculatedDiscountAmount;

  const calculatedSurchargeAmount = calcSurcharge({
    subTotal: totalAmountAfterDiscount,
    surchargeAmount,
    surchargePercent,
    surchargeType
  });

  const invoiceLevelTax = calcTax(totalAmountAfterDiscount, taxRate, taxType);
  const taxTotalAmount = totalItemTaxAmount + invoiceLevelTax;
  // Use the same total as invoice lists and reports. Inclusive tax on one line
  // must not suppress exclusive tax on a different line.
  const totalAmount = getInvoiceTotal({
    invoiceItems,
    taxRate,
    taxType,
    discountType,
    discountAmount,
    discountPercent,
    shippingFee: shippingAmount,
    surchargeType,
    surchargeAmount,
    surchargePercent
  });
  const paidAmount = getPaidAmount(invoicePayments);
  const balanceDue = totalAmount - paidAmount;

  const finalShippingAmount = calcUnitPrice({
    supportsSubunit,
    amountCents: shippingAmount,
    subunit: currencySubunit
  });
  const finalSubTotalAmount = calcUnitPrice({
    supportsSubunit,
    amountCents: subTotalAmount,
    subunit: currencySubunit
  });
  const finalTaxTotalAmount = calcUnitPrice({
    supportsSubunit,
    amountCents: taxTotalAmount,
    subunit: currencySubunit
  });
  const finalDiscountAmount = calcUnitPrice({
    supportsSubunit,
    amountCents: calculatedDiscountAmount,
    subunit: currencySubunit
  });
  const finalSurchargeAmount = calcUnitPrice({
    supportsSubunit,
    amountCents: calculatedSurchargeAmount,
    subunit: currencySubunit
  });
  const finalTotalAmount = calcUnitPrice({
    supportsSubunit,
    amountCents: totalAmount,
    subunit: currencySubunit
  });
  const finalPaidAmount = calcUnitPrice({
    supportsSubunit,
    amountCents: paidAmount,
    subunit: currencySubunit
  });
  const finalBalanceDue = calcUnitPrice({
    supportsSubunit,
    amountCents: balanceDue,
    subunit: currencySubunit
  });

  return {
    formattedSubTotalAmount: format(finalSubTotalAmount),
    formattedTotalTaxAmount: format(finalTaxTotalAmount),
    discountAmountFormatted: format(finalDiscountAmount),
    shippingAmountFormatted: format(finalShippingAmount),
    surchargeAmountFormatted: format(finalSurchargeAmount),
    totalAmountFormatted: format(finalTotalAmount),
    totalAmountPaidFormatted: format(finalPaidAmount),
    balanceDueFormatted: format(finalBalanceDue),
    subTotalAmount: finalSubTotalAmount,
    totalTax: finalTaxTotalAmount,
    discountAmount: finalDiscountAmount,
    shippingAmount: finalShippingAmount,
    surchargeAmount: finalSurchargeAmount,
    totalAmount: finalTotalAmount,
    totalAmountPaid: finalPaidAmount,
    balanceDue: finalBalanceDue
  };
};

export const getItemFinancialData = (data: {
  storeSettings?: Settings;
  currencySymbol?: string;
  currencyCode?: string;
  currencySubunit?: number;
  currencyFormat?: string;
  unitPrice: number;
  quantity: number;
  taxType?: InvoiceItemTaxType;
  taxRate: number;
  invoiceItems: InvoiceItem[];
  discountType?: DiscountType;
  discountAmount?: number;
  discountPercent?: number;
}) => {
  const {
    storeSettings,
    currencySymbol,
    currencyCode,
    currencySubunit,
    currencyFormat,
    unitPrice,
    discountType,
    discountAmount = 0,
    discountPercent = 0,
    quantity,
    taxType,
    taxRate,
    invoiceItems
  } = data;

  const supportsSubunit = supportsCurrencySubunit({
    storeSettings,
    currencySymbol,
    currencyCode,
    currencySubunit,
    currencyFormat
  });
  const format = createCurrencyFormatter({
    storeSettings,
    currencySymbol,
    currencyCode,
    currencySubunit,
    currencyFormat
  });
  const totalUnitPrice = unitPrice * quantity;
  const { tax: itemLevelTax, discount: itemLevelDiscount } = getInvoiceItemLevelTaxDiscount({
    taxRate: taxRate,
    unitPrice: unitPrice,
    quantity: quantity,
    taxType: taxType,
    invoiceItems,
    discountType,
    discountAmount,
    discountPercent
  });
  const finalUnitPriceTotal = calcUnitPrice({
    supportsSubunit: supportsSubunit,
    amountCents: totalUnitPrice,
    subunit: currencySubunit
  });
  const finalUnitPrice = calcUnitPrice({
    supportsSubunit: supportsSubunit,
    amountCents: unitPrice,
    subunit: currencySubunit
  });
  const finalItemTax = calcUnitPrice({
    supportsSubunit: supportsSubunit,
    amountCents: itemLevelTax,
    subunit: currencySubunit
  });
  const finalItemDiscount = calcUnitPrice({
    supportsSubunit: supportsSubunit,
    amountCents: itemLevelDiscount,
    subunit: currencySubunit
  });

  return {
    formattedUnitPrice: format(finalUnitPrice),
    formattedTotal: format(finalUnitPriceTotal),
    formattedTax: format(finalItemTax),
    formattedItemDiscountAmount: format(finalItemDiscount),
    unitPrice: finalUnitPrice,
    totalUnitPrice: finalUnitPriceTotal,
    invoiceTaxAmount: finalItemTax,
    itemDiscountAmount: finalItemDiscount
  };
};
