import { Document, Font, Image, Page, Text, View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import type { Settings } from '../../shared/types/settings';
import type { Invoice } from '../../shared/types/invoice';
import { buildBillingPeriod, splitBillingDescription } from '../../shared/utils/billingPeriod';
import { formatDate, createCurrencyFormatter } from '../../shared/utils/formatFunctions';
import { getItemFinancialData } from '../../shared/utils/invoiceFunctions';
import { FontFamily } from '../../shared/enums/fontFamily';
import RobotoRegular from '../../assets/roboto/Roboto-Regular.ttf';
import RobotoBold from '../../assets/roboto/Roboto-Bold.ttf';
import InterRegular from '../../assets/inter/Inter_18pt-Regular.ttf';
import InterBold from '../../assets/inter/Inter_18pt-Bold.ttf';

Font.register({ family: 'BillingRoboto', fonts: [{ src: RobotoRegular }, { src: RobotoBold, fontWeight: 700 }] });
Font.register({ family: 'BillingInter', fonts: [{ src: InterRegular }, { src: InterBold, fontWeight: 700 }] });
export interface BillingAssets {
  logoUrl?: string;
  attachments: { url: string; name: string }[];
}
const number = (invoice: Invoice) =>
  invoice.invoiceFullNumber || `${invoice.invoicePrefix ?? ''}${invoice.invoiceNumber}${invoice.invoiceSuffix ?? ''}`;
const fonts = {
  [FontFamily.roboto]: 'BillingRoboto',
  [FontFamily.inter]: 'BillingInter',
  [FontFamily.helvetica]: 'Helvetica',
  [FontFamily.timesRoman]: 'Times-Roman',
  [FontFamily.courier]: 'Courier'
};
const theme = (invoice: Invoice) => {
  const raw = invoice.invoiceCustomization?.color ?? '#006400';
  const accent = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw) ? raw : '#006400';
  const hex =
    accent.length === 4
      ? accent
          .slice(1)
          .split('')
          .map(c => c + c)
          .join('')
      : accent.slice(1);
  const tint =
    '#' +
    [0, 2, 4]
      .map(i =>
        Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.1 + 255 * 0.9)
          .toString(16)
          .padStart(2, '0')
      )
      .join('');
  return {
    accent,
    tint,
    fontFamily: fonts[invoice.invoiceCustomization?.fontFamily ?? FontFamily.roboto] ?? 'BillingRoboto'
  };
};
const cell = { padding: 6, fontSize: 10 };
const widths = ['52%', '8%', '8%', '15%', '17%'];

export const BillingPeriodPDF = ({
  period,
  settings,
  logoUrl,
  assets = []
}: {
  period: ReturnType<typeof buildBillingPeriod>;
  settings: Settings;
  logoUrl?: string;
  assets?: BillingAssets[];
}) => {
  const first = period.rows[0].invoice;
  const from = formatDate(period.from, settings.dateFormat);
  const to = formatDate(period.to, settings.dateFormat);
  const range = `${from} - ${to}`;
  const numbers = period.rows.map(row => number(row.invoice));
  const firstTheme = theme(first);
  const subunit = first.invoiceCurrencySnapshot!.currencySubunit;
  const moneyFormat = createCurrencyFormatter(settings, first);
  const money = (minor: number) => moneyFormat(minor / subunit);
  const tax = period.rows.reduce((sum, row) => sum + Math.round(row.financial.totalTax * subunit), 0);
  const beforeTax = period.total - tax;
  if (!Number.isSafeInteger(tax) || !Number.isSafeInteger(beforeTax))
    throw new Error('The combined tax amount is too large.');
  const footer = `${first.invoiceBusinessSnapshot?.businessName ?? ''} | ${range} | ${period.rows.length} invoices`;
  const frame = (invoice: Invoice, key: string, children: ReactNode) => (
    <Page
      key={key}
      size={invoice.invoiceCustomization?.pageFormat === 'A4' ? 'A4' : 'LETTER'}
      style={{
        paddingHorizontal: 32,
        paddingTop: 0,
        paddingBottom: 55,
        fontFamily: theme(invoice).fontFamily,
        fontSize: 10,
        lineHeight: 1.3
      }}
    >
      <View fixed style={{ height: 32 }} />
      {children}
      <View
        fixed
        style={{
          position: 'absolute',
          bottom: 22,
          left: 32,
          right: 32,
          borderTopWidth: 0.5,
          borderTopColor: '#cccccc',
          paddingTop: 6
        }}
      >
        <Text style={{ fontSize: 7, color: '#777777', paddingRight: 45 }}>{footer}</Text>
      </View>
    </Page>
  );
  const header = (invoice: Invoice, title: string, details: ReactNode, image?: string) => {
    const business = invoice.invoiceBusinessSnapshot;
    const size = { small: 48, medium: 60, large: 72 }[invoice.invoiceCustomization?.logoSize ?? 'medium'];
    return (
      <>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
          <View style={{ flexDirection: 'row', width: '65%', gap: 6 }}>
            {image && <Image src={image} style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }} />}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, lineHeight: 1.2, marginBottom: 4 }}>{business?.businessName}</Text>
              {[business?.businessAddress, business?.businessEmail, business?.businessPhone]
                .filter(Boolean)
                .map((value, index) => (
                  <Text key={index} style={{ color: '#777777', fontSize: 10 }}>
                    {value}
                  </Text>
                ))}
            </View>
          </View>
          <View style={{ width: '33%', alignItems: 'flex-end' }}>
            <Text
              style={{ color: theme(invoice).accent, fontSize: 23, fontWeight: 700, lineHeight: 1.2, marginBottom: 4 }}
            >
              {title}
            </Text>
            {details}
          </View>
        </View>
        <View style={{ marginBottom: 18 }}>
          <Text style={{ fontWeight: 700 }}>Bill to:</Text>
          <Text style={{ color: '#777777' }}>{invoice.invoiceClientSnapshot?.clientName}</Text>
          {invoice.invoiceClientSnapshot?.clientAddress && (
            <Text style={{ color: '#777777' }}>{invoice.invoiceClientSnapshot.clientAddress}</Text>
          )}
        </View>
      </>
    );
  };
  const totalLine = (label: string, value: string, bold = false) => (
    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingVertical: 3 }}>
      <Text style={{ width: '65%', textAlign: 'right', color: '#555555', fontWeight: bold ? 700 : 400 }}>{label}</Text>
      <Text style={{ width: '25%', textAlign: 'right', fontWeight: bold ? 700 : 400 }}>{value}</Text>
    </View>
  );
  return (
    <Document title={`Billing period ${from} to ${to}`}>
      {period.rows.flatMap(({ invoice, financial, total }, rowIndex) => {
        const branding = assets[rowIndex];
        const invoiceNumber = number(invoice);
        const invoiceTheme = theme(invoice);
        const currency = invoice.invoiceCurrencySnapshot!;
        const invoicePage = frame(
          invoice,
          `invoice-${rowIndex}`,
          <>
            {header(
              invoice,
              'INVOICE',
              <>
                <Text>{invoiceNumber}</Text>
                <Text>Date: {formatDate(invoice.issuedAt, settings.dateFormat)}</Text>
              </>,
              branding?.logoUrl ?? (rowIndex === 0 ? logoUrl : undefined)
            )}
            <View style={{ flexDirection: 'row', backgroundColor: invoiceTheme.tint }}>
              {['Item', 'Unit', 'Qty', 'Unit cost', 'Total'].map((label, i) => (
                <Text
                  key={label}
                  style={{ ...cell, width: widths[i], fontWeight: 700, textAlign: i === 0 ? 'left' : 'right' }}
                >
                  {label}
                </Text>
              ))}
            </View>
            {invoice.invoiceItems.flatMap((item, index) => {
              const financialItem = getItemFinancialData({
                storeSettings: settings,
                currencySymbol: currency.currencySymbol,
                currencyCode: currency.currencyCode,
                currencySubunit: currency.currencySubunit,
                currencyFormat: invoice.currencyFormat,
                unitPrice: Number(item.invoiceItemSnapshot.unitPriceCents),
                quantity: Number(item.quantity),
                taxType: item.taxType,
                taxRate: item.taxRate,
                invoiceItems: invoice.invoiceItems,
                discountType: invoice.discountType,
                discountAmount: Number(invoice.discountAmountCents ?? 0),
                discountPercent: invoice.discountPercent
              });
              const description = `${item.invoiceItemSnapshot.itemName}${item.customField?.value ? ` - ${item.customField.value}` : ''}`;
              return splitBillingDescription(description).map((part, partIndex) => (
                <View
                  key={`${index}-${partIndex}`}
                  wrap={false}
                  style={{ flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#dddddd' }}
                >
                  <View style={{ ...cell, width: widths[0] }}>
                    <Text>{part}</Text>
                    {partIndex === 0 && financialItem.invoiceTaxAmount !== 0 && (
                      <Text style={{ fontSize: 8, color: '#777777' }}>
                        Tax ({item.taxRate}%{item.taxType === 'inclusive' ? ', included' : ''}):{' '}
                        {financialItem.formattedTax}
                      </Text>
                    )}
                  </View>
                  {[
                    item.invoiceItemSnapshot.unitName ?? '',
                    item.quantity,
                    financialItem.formattedUnitPrice,
                    financialItem.formattedTotal
                  ].map((value, i) => (
                    <Text key={i} style={{ ...cell, width: widths[i + 1], textAlign: 'right' }}>
                      {partIndex === 0 ? value : ''}
                    </Text>
                  ))}
                </View>
              ));
            })}
            <View wrap={false} style={{ marginTop: 8 }}>
              {financial.discountAmount !== 0 && totalLine('Discount', financial.discountAmountFormatted)}
              {financial.shippingAmount !== 0 && totalLine('Shipping', financial.shippingAmountFormatted)}
              {financial.surchargeAmount !== 0 && totalLine('Surcharge', financial.surchargeAmountFormatted)}
              {financial.totalTax !== 0 && (
                <>
                  {totalLine('Subtotal (before tax)', money(total - Math.round(financial.totalTax * subunit)))}
                  {totalLine('Tax', financial.formattedTotalTaxAmount)}
                </>
              )}
              {totalLine(
                `Invoice ${invoiceNumber} subtotal${financial.totalTax !== 0 ? ' (incl. tax)' : ''}`,
                money(total)
              )}
              <Text style={{ textAlign: 'right', color: '#777777', fontSize: 8, marginTop: 3 }}>
                This invoice only; included in the final combined summary.
              </Text>
            </View>
            {[
              ['Customer note', invoice.customerNotes],
              ['Terms and conditions', invoice.termsConditionNotes],
              ['', invoice.thanksNotes]
            ].map(([label, notes], index) =>
              notes ? (
                <View key={index} style={{ marginTop: 28 }}>
                  {label && (
                    <Text minPresenceAhead={25} style={{ fontWeight: 700 }}>
                      {label}
                    </Text>
                  )}
                  {splitBillingDescription(notes).map((chunk, i) => (
                    <Text key={i}>{chunk}</Text>
                  ))}
                </View>
              ) : null
            )}
          </>
        );
        return [
          invoicePage,
          ...(branding?.attachments ?? []).map((attachment, i) =>
            frame(
              invoice,
              `attachment-${rowIndex}-${i}`,
              <>
                <Image
                  src={attachment.url}
                  style={{
                    width: '100%',
                    height: invoice.invoiceCustomization?.pageFormat === 'A4' ? 700 : 650,
                    objectFit: 'contain'
                  }}
                />
                <Text style={{ marginTop: 8, fontSize: 9, color: '#555555' }}>
                  Attachment for Invoice {invoiceNumber} - supporting document, not an additional charge.
                </Text>
              </>
            )
          )
        ];
      })}
      {frame(
        first,
        'summary',
        <>
          {header(
            first,
            'SUMMARY',
            <>
              <Text>{period.rows.length} invoices</Text>
              <Text style={{ textAlign: 'right' }}>{range}</Text>
            </>,
            assets[0]?.logoUrl ?? logoUrl
          )}
          <View style={{ flexDirection: 'row', backgroundColor: firstTheme.tint }}>
            {['Invoice', 'Date', 'Invoice subtotal (incl. tax)'].map((label, i) => (
              <Text
                key={label}
                style={{
                  ...cell,
                  width: ['25%', '25%', '50%'][i],
                  fontWeight: 700,
                  textAlign: i === 2 ? 'right' : 'left'
                }}
              >
                {label}
              </Text>
            ))}
          </View>
          {period.rows.map((row, i) => (
            <View
              key={row.invoice.id}
              wrap={false}
              style={{ flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#cccccc', paddingVertical: 3 }}
            >
              <Text style={{ ...cell, width: '25%', color: '#555555' }}>{numbers[i]}</Text>
              <Text style={{ ...cell, width: '25%', color: '#555555' }}>
                {formatDate(row.invoice.issuedAt, settings.dateFormat)}
              </Text>
              <Text style={{ ...cell, width: '50%', textAlign: 'right', color: '#555555' }}>{money(row.total)}</Text>
            </View>
          ))}
          <Text style={{ marginTop: 12, fontSize: 9, color: '#555555' }}>
            Each invoice subtotal contributes to the final combined total below.
          </Text>
          <View wrap={false} style={{ marginTop: 60 }}>
            {totalLine('Charges before tax', money(beforeTax))}
            {totalLine('Tax', money(tax))}
            {totalLine('Total billed', money(period.total))}
            {totalLine('Payments / amounts settled', money(period.paid))}
            <View
              style={{
                marginTop: 22,
                borderTopWidth: 1,
                borderTopColor: firstTheme.accent,
                backgroundColor: firstTheme.tint,
                padding: 14
              }}
            >
              <Text style={{ color: firstTheme.accent, fontWeight: 700, fontSize: 12 }}>FINAL TOTAL</Text>
              <View
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}
              >
                <Text style={{ color: '#555555', width: '55%' }}>
                  {period.balance < 0 ? 'Credit balance' : 'Balance due'} for all {period.rows.length} invoices
                </Text>
                <Text
                  style={{ color: firstTheme.accent, fontWeight: 700, fontSize: 25, textAlign: 'right', width: '45%' }}
                >
                  {money(period.balance)}
                </Text>
              </View>
            </View>
          </View>
        </>
      )}
    </Document>
  );
};
