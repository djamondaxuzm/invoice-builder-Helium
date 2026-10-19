import { PDFViewer } from '@react-pdf/renderer';
import { memo, useEffect, useMemo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getAttachmentsUrl,
  getLogoUrl,
  getQRCodeUrls,
  getSignatureUrls,
  getWatermarkPaidUrl,
  getWatermarkUrl
} from '../../../shared/hooks/fileExport/useExportPdf';
import { usePdfTexts } from '../../../shared/hooks/pdf/usePdfTexts';
import type { AttachmentURL, InvoiceFromData } from '../../../shared/types/invoice';
import { useAppSelector } from '../../../state/configureStore';
import { selectSettings } from '../../../state/pageSlice';
import { PDFDocument } from './PDFDocument';
import { Alert, Button } from '@mui/material';
import { usePreviewInvoice } from '../../../shared/hooks/pdf/usePreviewInvoice';

interface Props {
  invoiceForm?: InvoiceFromData;
}
const PreviewCoreComponent: FC<Props> = ({ invoiceForm: currentInvoice }) => {
  const invoiceForm = usePreviewInvoice(currentInvoice);
  const { t } = useTranslation();
  const storeSettings = useAppSelector(selectSettings);
  const [logoUrl, setLogoUrl] = useState<string | undefined>();
  const [watermarkUrl, setWatermarkUrl] = useState<string | undefined>();
  const [watermarkPaidUrl, setWatermarkPaidUrl] = useState<string | undefined>();
  const [attachmentUrls, setAttachmentUrls] = useState<AttachmentURL[]>([]);
  const [signatureUrl, setSignatureUrl] = useState<string | undefined>();
  const [qrCodeUrl, setQrCodeUrl] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const pdfTextsDefaults = usePdfTexts({
    labelUpperCase: invoiceForm?.invoiceCustomization?.labelUpperCase,
    language: invoiceForm?.language
  });
  const pdfTexts = useMemo(() => {
    const customLabels = invoiceForm?.invoiceCustomization?.pdfTexts || {};

    return {
      ...pdfTextsDefaults,
      ...customLabels
    };
  }, [invoiceForm, pdfTextsDefaults]);

  const imageForm = useMemo(
    () => ({
      invoiceBusinessSnapshot: invoiceForm?.invoiceBusinessSnapshot,
      invoiceCustomization: invoiceForm?.invoiceCustomization,
      invoiceAttachments: invoiceForm?.invoiceAttachments,
      invoiceBankSnapshot: invoiceForm?.invoiceBankSnapshot,
      signatureData: invoiceForm?.signatureData,
      signatureType: invoiceForm?.signatureType
    }),
    [
      invoiceForm?.invoiceBusinessSnapshot,
      invoiceForm?.invoiceCustomization,
      invoiceForm?.invoiceAttachments,
      invoiceForm?.invoiceBankSnapshot,
      invoiceForm?.signatureData,
      invoiceForm?.signatureType
    ]
  );

  useEffect(() => {
    let cancelled = false;
    setAttachmentUrls([]);
    setLogoUrl(undefined);
    setWatermarkUrl(undefined);
    setWatermarkPaidUrl(undefined);
    setQrCodeUrl(undefined);
    setLoading(true);
    setError('');

    const loadData = async () => {
      const [logo, watermark, watermarkPaid, attachments, signature, qrCode] = await Promise.all([
        getLogoUrl(imageForm),
        getWatermarkUrl(imageForm),
        getWatermarkPaidUrl(imageForm),
        getAttachmentsUrl(imageForm),
        getSignatureUrls(imageForm),
        getQRCodeUrls(imageForm)
      ]);

      if (!cancelled) {
        setLogoUrl(logo);
        setWatermarkUrl(watermark);
        setWatermarkPaidUrl(watermarkPaid);
        setAttachmentUrls(attachments);
        setSignatureUrl(signature);
        setQrCodeUrl(qrCode);
        setLoading(false);
      }
    };

    void loadData().catch(cause => {
      if (!cancelled) {
        setError(cause instanceof Error ? cause.message : 'Could not load preview images.');
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [imageForm, retry]);

  if (loading) return null;
  if (error)
    return (
      <Alert severity="error" action={<Button onClick={() => setRetry(value => value + 1)}>Retry</Button>}>
        {error}
      </Alert>
    );

  return (
    <PDFViewer
      key={invoiceForm?.id ?? 'new'}
      style={{ width: '100%', height: '100%', border: 'none' }}
      showToolbar={false}
    >
      <PDFDocument
        invoiceForm={invoiceForm}
        storeSettings={storeSettings}
        logoUrl={logoUrl}
        qrCodeUrl={qrCodeUrl}
        attachmentUrls={attachmentUrls}
        pdfTexts={pdfTexts}
        layoutRequired={t('common.layoutRequired')}
        watermarkUrl={watermarkUrl}
        watermarkPaidUrl={watermarkPaidUrl}
        signatureUrl={signatureUrl}
      />
    </PDFViewer>
  );
};
export const PreviewCore = memo(PreviewCoreComponent);
