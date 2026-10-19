// Pure monetary math shared by the renderer and payment service. Amounts are minor units.
export type TaxType = 'exclusive' | 'inclusive' | 'deducted';
export interface MoneyInvoiceItem {
  quantity: string;
  taxRate: number;
  taxType?: 'exclusive' | 'inclusive';
  invoiceItemSnapshot?: { unitPriceCents: string };
}
export const roundMinorUnits = (value: number) => {
  const rounded = Math.sign(value) * Math.round(Math.abs(value) + Number.EPSILON * Math.abs(value));
  if (!Number.isSafeInteger(rounded)) throw new Error('Invalid or excessively large monetary amount.');
  return rounded;
};
export const calcTax = (amount: number, taxRate: number, taxType?: TaxType) => {
  if (!taxType) return 0;
  switch (taxType) {
    case 'exclusive':
      return (amount * taxRate) / 100;
    case 'inclusive':
      return (amount * taxRate) / (100 + taxRate);
    case 'deducted':
      return -(amount * taxRate) / 100;
    default:
      return 0;
  }
};

export const calcSurcharge = (data: {
  subTotal: number;
  surchargeType?: 'fixed' | 'percentage';
  surchargeAmount?: number;
  surchargePercent?: number;
}) => {
  const { subTotal, surchargeType, surchargeAmount, surchargePercent } = data;

  if (!surchargeType) return 0;
  return surchargeType === 'fixed' ? (surchargeAmount ?? 0) : (subTotal * (surchargePercent ?? 0)) / 100;
};

export const calcDiscount = (data: {
  subTotal: number;
  discountType?: 'fixed' | 'percentage';
  discountAmount?: number;
  discountPercent?: number;
}) => {
  const { subTotal, discountType, discountAmount, discountPercent } = data;

  if (!discountType) return 0;
  return discountType === 'fixed' ? (discountAmount ?? 0) : (subTotal * (discountPercent ?? 0)) / 100;
};

export const getInvoiceTotal = (data: {
  taxRate: number;
  taxType?: TaxType;
  invoiceItems: MoneyInvoiceItem[];
  discountType?: 'fixed' | 'percentage';
  discountAmount?: number;
  discountPercent?: number;
  shippingFee?: number;
  surchargeType?: 'fixed' | 'percentage';
  surchargeAmount?: number;
  surchargePercent?: number;
  includeTax?: boolean;
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
    surchargePercent,
    includeTax = true
  } = data;

  const subTotal =
    invoiceItems.reduce((sum, item) => {
      return sum + Number(item.invoiceItemSnapshot?.unitPriceCents) * Number(item.quantity);
    }, 0) ?? 0;

  const totalDiscount = calcDiscount({ subTotal, discountType, discountAmount, discountPercent });
  const afterDiscount = subTotal - totalDiscount;
  const totalSurcharge = calcSurcharge({
    subTotal: afterDiscount,
    surchargeType,
    surchargeAmount,
    surchargePercent
  });

  const taxInvoice = calcTax(afterDiscount, taxRate, taxType);
  let taxItems = 0;
  invoiceItems.map(item => {
    const unitTotal = Number(item.invoiceItemSnapshot?.unitPriceCents) * Number(item.quantity);
    let discount = 0;
    if (subTotal > 0 && totalDiscount > 0) {
      discount = Math.round((unitTotal / subTotal) * totalDiscount);
    }
    const taxableAmount = unitTotal - discount;
    if (item.taxType !== 'inclusive') taxItems += calcTax(taxableAmount, item.taxRate, item.taxType);
  });
  return (
    afterDiscount +
    shippingFee +
    totalSurcharge +
    (includeTax ? taxItems + (taxType === 'inclusive' ? 0 : taxInvoice) : 0)
  );
};
