import { Document, Font, Image, Page, Text, View } from '@react-pdf/renderer';
import type { Settings } from '../../shared/types/settings';
import { buildBillingPeriod, splitBillingDescription } from '../../shared/utils/billingPeriod';
import { formatDate, createCurrencyFormatter } from '../../shared/utils/formatFunctions';
import RobotoRegular from '../../assets/roboto/Roboto-Regular.ttf';
import RobotoBold from '../../assets/roboto/Roboto-Bold.ttf';
import InterRegular from '../../assets/inter/Inter_18pt-Regular.ttf';
import InterBold from '../../assets/inter/Inter_18pt-Bold.ttf';
import { FontFamily } from '../../shared/enums/fontFamily';

Font.register({ family: 'BillingRoboto', fonts: [{ src: RobotoRegular }, { src: RobotoBold, fontWeight: 700 }] });

Font.register({ family: 'BillingInter', fonts: [{ src: InterRegular }, { src: InterBold, fontWeight: 700 }] });

export const BillingPeriodPDF = ({
  period,
  settings,
  logoUrl
}: {
  period: ReturnType<typeof buildBillingPeriod>;
  settings: Settings;
  logoUrl?: string;
}) => {
  const from = formatDate(period.from, settings.dateFormat);
  const to = formatDate(period.to, settings.dateFormat);
  const first = period.rows[0].invoice;
  const customization = first.invoiceCustomization;
  const accent = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(customization?.color ?? '') ? customization!.color! : '#222222';
  const fonts = {
    [FontFamily.roboto]: 'BillingRoboto',
    [FontFamily.inter]: 'BillingInter',
    [FontFamily.helvetica]: 'Helvetica',
    [FontFamily.timesRoman]: 'Times-Roman',
    [FontFamily.courier]: 'Courier'
  };
  const fontFamily = fonts[customization?.fontFamily ?? FontFamily.roboto] ?? 'BillingRoboto';
  const logoSize = { small: 48, medium: 64, large: 80 }[customization?.logoSize ?? 'medium'] ?? 64;
  const business = first.invoiceBusinessSnapshot;
  const subunit = first.invoiceCurrencySnapshot!.currencySubunit;
  const format = createCurrencyFormatter(settings, first);
  const money = (minor: number) => format(minor / subunit);
  return (
    <Document title={`Billing period ${from} to ${to}`}>
      <Page
        size={customization?.pageFormat === 'LETTER' ? 'LETTER' : 'A4'}
        style={{
          padding: 36,
          paddingTop: 0,
          paddingBottom: 54,
          fontFamily,
          fontSize: 10,
          lineHeight: 1.4
        }}
      >
        <View fixed style={{ height: 36, flexShrink: 0 }} />
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: 18,
            borderBottomWidth: 2,
            borderBottomColor: accent,
            paddingBottom: 10,
            marginBottom: 10
          }}
        >
          <View style={{ flexGrow: 1, flexShrink: 1 }}>
            <Text style={{ fontSize: 22, lineHeight: 1.3, marginBottom: 5, fontWeight: 700, color: accent }}>
              Billing period
            </Text>
            <Text>
              {from} - {to}
            </Text>
            <Text style={{ marginTop: 10, fontSize: 12, fontWeight: 700 }}>{business?.businessName}</Text>
            {business?.businessRole && <Text>{business.businessRole}</Text>}
            <Text>{business?.businessAddress}</Text>
            {business?.businessEmail && <Text>{business.businessEmail}</Text>}
            {business?.businessPhone && <Text>{business.businessPhone}</Text>}
          </View>
          {logoUrl && (
            <Image src={logoUrl} style={{ width: logoSize, height: logoSize, objectFit: 'contain', flexShrink: 0 }} />
          )}
        </View>
        <Text style={{ marginTop: 8 }}>Bill to: {first.invoiceClientSnapshot?.clientName}</Text>
        <Text>{first.invoiceClientSnapshot?.clientAddress}</Text>
        <Text style={{ marginTop: 8, marginBottom: 16 }}>Statement of {period.rows.length} existing invoices</Text>
        {period.rows.map(({ invoice, financial, total }) => (
          <View key={invoice.id} style={{ marginBottom: 4 }}>
            <Text
              minPresenceAhead={45}
              style={{
                fontWeight: 700,
                borderBottomWidth: 1,
                borderBottomColor: accent,
                color: accent,
                paddingBottom: 4
              }}
            >
              {formatDate(invoice.issuedAt, settings.dateFormat)} · Invoice{' '}
              {invoice.invoiceFullNumber ||
                `${invoice.invoicePrefix ?? ''}${invoice.invoiceNumber}${invoice.invoiceSuffix ?? ''}`}
            </Text>
            {invoice.invoiceItems.flatMap((item, index) =>
              splitBillingDescription(
                `${item.invoiceItemSnapshot.itemName}${item.customField?.value ? ` · ${item.customField.value}` : ''}`
              ).map((description, part) => (
                <View key={`${item.id ?? index}-${part}`} wrap={false} style={{ flexDirection: 'row', paddingTop: 3 }}>
                  <Text style={{ flexGrow: 1, width: '60%' }}>{description}</Text>
                  <Text style={{ width: '40%', textAlign: 'right' }}>
                    {part === 0
                      ? `${item.quantity} ${item.invoiceItemSnapshot.unitName ?? ''} × ${money(Number(item.invoiceItemSnapshot.unitPriceCents))}`
                      : ''}
                  </Text>
                </View>
              ))
            )}
            <View wrap={false} style={{ marginTop: 3, alignItems: 'flex-end' }}>
              {(financial.discountAmount !== 0 ||
                financial.totalTax !== 0 ||
                financial.shippingAmount !== 0 ||
                financial.surchargeAmount !== 0) && <Text>Subtotal: {financial.formattedSubTotalAmount}</Text>}
              {financial.discountAmount !== 0 && <Text>Discount: {financial.discountAmountFormatted}</Text>}
              {financial.totalTax !== 0 && <Text>Tax: {financial.formattedTotalTaxAmount}</Text>}
              {financial.shippingAmount !== 0 && <Text>Shipping: {financial.shippingAmountFormatted}</Text>}
              {financial.surchargeAmount !== 0 && <Text>Surcharge: {financial.surchargeAmountFormatted}</Text>}
              <Text style={{ fontWeight: 700 }}>Invoice total: {money(total)}</Text>
            </View>
          </View>
        ))}
        <View
          wrap={false}
          style={{ borderTopWidth: 2, borderTopColor: accent, paddingTop: 10, alignItems: 'flex-end' }}
        >
          <Text style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.4, color: accent }}>
            Period total: {money(period.total)}
          </Text>
          <Text>Paid: {money(period.paid)}</Text>
          <Text style={{ fontWeight: 700 }}>Balance due: {money(period.balance)}</Text>
        </View>
      </Page>
    </Document>
  );
};
