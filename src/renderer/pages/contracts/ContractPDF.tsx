import { Document, Font, Image, Page, Text, View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import type { ContractDraft } from '../../../backend/shared/types/contracts';
import {
  contractFeeCents,
  contractRetainerCents,
  CONTRACT_ESTIMATE_TERMS
} from '../../../backend/shared/utils/contracts';
import RobotoRegular from '../../assets/roboto/Roboto-Regular.ttf';
import RobotoBold from '../../assets/roboto/Roboto-Bold.ttf';
import InterRegular from '../../assets/inter/Inter_18pt-Regular.ttf';
import InterBold from '../../assets/inter/Inter_18pt-Bold.ttf';

Font.register({ family: 'ContractRoboto', fonts: [{ src: RobotoRegular }, { src: RobotoBold, fontWeight: 700 }] });
Font.register({ family: 'ContractInter', fonts: [{ src: InterRegular }, { src: InterBold, fontWeight: 700 }] });
const fonts: Record<string, string> = {
  Helvetica: 'Helvetica',
  'Times-Roman': 'Times-Roman',
  Courier: 'Courier',
  Roboto: 'ContractRoboto',
  Inter: 'ContractInter'
};
const money = (rate: string, multiplier = '1') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    contractFeeCents(rate, multiplier) / 100
  );
const dateLabel = (date: string) => date.slice(5, 7) + '/' + date.slice(8, 10) + '/' + date.slice(0, 4);

export const ContractPDF = ({ draft }: { draft: ContractDraft }) => {
  const color = draft.style.color;
  const fontFamily = fonts[draft.style.fontFamily] || 'Helvetica';
  const fontSize = { small: 10, medium: 11, large: 12 }[draft.style.fontSize || 'medium'];
  const logoSize = { small: 48, medium: 60, large: 72 }[draft.style.logoSize || 'medium'];
  const pageStyle = {
    paddingTop: 40,
    paddingHorizontal: 44,
    paddingBottom: 62,
    fontFamily,
    fontSize,
    lineHeight: 1.35,
    color: '#252a25'
  };
  const paragraph = (value: string) => (
    <Text orphans={2} widows={2} style={{ marginBottom: 8 }}>
      {value}
    </Text>
  );
  const heading = (title: string) => (
    <Text
      minPresenceAhead={60}
      style={{ color, fontWeight: 700, fontSize: fontSize + 1, marginTop: 13, marginBottom: 8 }}
    >
      {title}
    </Text>
  );
  const section = (title: string, contents: ReactNode) => (
    <View>
      {heading(title)}
      {contents}
    </View>
  );
  const signature = (label: string) => (
    <View style={{ width: '47%' }}>
      <Text style={{ fontWeight: 700, marginBottom: 30 }}>{label}</Text>
      <View style={{ borderTopWidth: 0.7, borderTopColor: '#777', paddingTop: 4, marginBottom: 22 }}>
        <Text style={{ fontSize: 9 }}>Signature</Text>
      </View>
      <View style={{ borderTopWidth: 0.7, borderTopColor: '#777', paddingTop: 4, marginBottom: 22 }}>
        <Text style={{ fontSize: 9 }}>Printed name / title</Text>
      </View>
      <View style={{ borderTopWidth: 0.7, borderTopColor: '#777', paddingTop: 4 }}>
        <Text style={{ fontSize: 9 }}>Date (MM/DD/YYYY)</Text>
      </View>
    </View>
  );
  return (
    <Document title={draft.title + ' - Work and billing agreement'} author={draft.business?.name}>
      <Page size={draft.style.pageFormat} style={pageStyle}>
        <Text
          fixed
          style={{
            position: 'absolute',
            top: 20,
            left: 44,
            right: 44,
            fontSize: 9,
            color: '#606860',
            maxLines: 1,
            textOverflow: 'ellipsis'
          }}
          render={({ pageNumber }) =>
            pageNumber > 1 ? `${draft.client?.name} | ${draft.title} | ${dateLabel(draft.date)}` : ''
          }
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 20, marginBottom: 20 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color, fontWeight: 700, fontSize: 16, marginBottom: 5 }}>{draft.business?.name}</Text>
            {draft.business?.address && paragraph(draft.business.address)}
            {[draft.business?.email, draft.business?.phone].filter(Boolean).length > 0 && (
              <Text style={{ fontSize: 10 }}>
                {[draft.business?.email, draft.business?.phone].filter(Boolean).join(' | ')}
              </Text>
            )}
          </View>
          {draft.business?.logo && (
            <Image
              src={draft.business.logo}
              style={{ width: logoSize, height: logoSize, objectFit: 'contain', flexShrink: 0 }}
            />
          )}
        </View>
        <Text style={{ color, fontSize: 24, lineHeight: 1.15, marginBottom: 10 }}>Work &amp; billing agreement</Text>
        {paragraph(draft.title)}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 20, marginBottom: 6 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: 700 }}>{draft.client?.name}</Text>
            {draft.client?.address && paragraph(draft.client.address)}
            {draft.client?.email && <Text style={{ fontSize: 10 }}>{draft.client.email}</Text>}
          </View>
          <Text>{dateLabel(draft.date)}</Text>
        </View>
        {section(
          'Project',
          <>
            {paragraph(draft.scope)}
            {draft.projectAddress && paragraph(draft.projectAddress)}
            {draft.projectDetails?.workAndMaterials && paragraph(draft.projectDetails.workAndMaterials)}
            {draft.projectDetails?.approximateStart &&
              paragraph('Approximate start: ' + dateLabel(draft.projectDetails.approximateStart))}
            {draft.projectDetails?.approximateCompletion &&
              paragraph('Approximate completion: ' + dateLabel(draft.projectDetails.approximateCompletion))}
            {draft.projectDetails?.permitArrangements &&
              paragraph('Permits: ' + draft.projectDetails.permitArrangements)}
            {draft.projectDetails?.otherArrangements && paragraph(draft.projectDetails.otherArrangements)}
          </>
        )}
        {section(
          'Rates & billable time',
          <View>
            <View
              wrap={false}
              style={{ flexDirection: 'row', backgroundColor: '#edf2ed', padding: 7, fontWeight: 700, fontSize: 10 }}
            >
              <Text style={{ width: '50%' }}>Service</Text>
              <Text style={{ width: '25%', textAlign: 'right' }}>Hourly rate</Text>
              <Text style={{ width: '25%', textAlign: 'right' }}>Work travel only</Text>
            </View>
            {draft.rates.map(rate => (
              <View
                key={rate.sourceId}
                wrap={false}
                style={{ flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#d4dcd4', padding: 7 }}
              >
                <Text style={{ width: '50%', paddingRight: 8 }}>{rate.name}</Text>
                <Text style={{ width: '25%', textAlign: 'right' }}>{money(rate.hourlyRate)} / hr</Text>
                <Text style={{ width: '25%', textAlign: 'right' }}>{money(rate.hourlyRate, '0.5')} / hr</Text>
              </View>
            ))}
            {draft.billableTimeTerms ? (
              <View style={{ marginTop: 10 }}>{paragraph(draft.billableTimeTerms)}</View>
            ) : (
              <Text style={{ marginTop: 7, fontSize: 10 }}>
                Work travel rates exclude ordinary commuting to and from the worksite.
              </Text>
            )}
          </View>
        )}
        <View>
          <View wrap={false}>
            {heading('Charges & payment')}
            <Text style={{ marginBottom: 8 }}>
              <Text style={{ fontWeight: 700 }}>Assessment &amp; quoting: </Text>
              {draft.assessmentRate?.name} ({money(draft.assessmentRate!.hourlyRate)}) x {draft.assessmentMultiplier} ={' '}
              {money(draft.assessmentRate!.hourlyRate, draft.assessmentMultiplier)}. Included on the first invoice.
            </Text>
          </View>
          {draft.quotedAmount !== null &&
            paragraph(`Estimated project cost: ${money(draft.quotedAmount)}. ${CONTRACT_ESTIMATE_TERMS}`)}
          {draft.retainer && (
            <View>
              <Text minPresenceAhead={28} style={{ fontWeight: 700, marginBottom: 4 }}>
                Upfront retainer: {money(String(contractRetainerCents(draft) / 100))}
                {draft.quotedAmount === null ? ' (no estimate given).' : ' (10% of the estimate, capped at $1,000).'}
              </Text>
              {paragraph(draft.retainer.terms)}
            </View>
          )}
          {paragraph(draft.materialsTerms)}
          {draft.billingSchedule && paragraph(draft.billingSchedule)}
          {paragraph(draft.paymentTerms)}
          {draft.standardTerms && paragraph(draft.standardTerms)}
          {draft.additionalTerms && paragraph(draft.additionalTerms)}
        </View>
        {draft.arbitration && (
          <View break>
            <Text style={{ fontSize: Math.max(12, fontSize), fontWeight: 700, marginBottom: 10 }}>
              ARBITRATION OF DISPUTES
            </Text>
            <Text style={{ fontSize: Math.max(10, fontSize - 1), fontWeight: 700, marginBottom: 10 }}>
              {draft.arbitration.terms.toUpperCase()}
            </Text>
            <View wrap={false}>
              <Text style={{ fontSize: Math.max(10, fontSize - 1), fontWeight: 700, marginBottom: 18 }}>
                {draft.arbitration.notice.toUpperCase()}
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', fontSize: 10 }}>
                <Text>Business initials: ______________</Text>
                <Text>Client initials: ______________</Text>
              </View>
            </View>
          </View>
        )}
        <View wrap={false} style={{ marginTop: 20 }}>
          {heading('Acceptance')}
          {paragraph('The parties acknowledge the scope, rates, and billing terms stated in this agreement.')}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 }}>
            {signature('For ' + draft.business!.name)}
            {signature(draft.client!.name)}
          </View>
        </View>
      </Page>
    </Document>
  );
};
