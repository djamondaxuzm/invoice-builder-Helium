import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import { Alert, Box, Button, IconButton, ListItemText, Tooltip, Typography } from '@mui/material';
import { memo, useEffect, useLayoutEffect, useRef, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { UploadImage } from '../../../shared/components/inputs/uploadImage/UploadImage';
import type { AttachmentForm, InvoiceAttachment, InvoiceFromData } from '../../../shared/types/invoice';
import { toUint8Array } from '../../../shared/utils/dataUrlFunctions';
import { optimizeStoredAttachment } from '../../../shared/utils/receiptImage';

interface Props {
  invoiceForm?: InvoiceFromData;
  onAttach: (attachment: AttachmentForm) => void;
  onClear: (id: number) => void;
  onOptimize?: (before: InvoiceAttachment[], after: InvoiceAttachment[]) => void;
}
const displaySize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
const AttachmentsListComponent: FC<Props> = ({ invoiceForm, onAttach, onClear, onOptimize }) => {
  const { t } = useTranslation();
  const [optimizing, setOptimizing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const currentForm = useRef(invoiceForm);
  useLayoutEffect(() => {
    currentForm.current = invoiceForm;
  }, [invoiceForm]);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    setMessage('');
    setError('');
  }, [invoiceForm?.id]);

  const reduceStoredAttachments = async () => {
    if (!onOptimize || optimizing || invoiceForm?.attachmentsLoaded === false) return;
    const before = invoiceForm?.invoiceAttachments ?? [];
    const invoiceId = invoiceForm?.id;
    setOptimizing(true);
    setMessage('');
    setError('');
    try {
      const after: InvoiceAttachment[] = [];
      for (const attachment of before) {
        if (
          !mounted.current ||
          currentForm.current?.id !== invoiceId ||
          currentForm.current?.invoiceAttachments !== before
        )
          break;
        after.push(await optimizeStoredAttachment(attachment));
      }
      if (!mounted.current || currentForm.current?.id !== invoiceId) return;
      if (currentForm.current?.invoiceAttachments !== before) {
        setMessage('Attachments changed while preparing smaller images. Try again.');
        return;
      }
      const oldBytes = before.reduce((sum, item) => sum + item.data.byteLength, 0);
      const newBytes = after.reduce((sum, item) => sum + item.data.byteLength, 0);
      if (newBytes < oldBytes) {
        onOptimize(before, after);
        setMessage(
          `${displaySize(oldBytes)} → ${displaySize(newBytes)} (${Math.round((1 - newBytes / oldBytes) * 100)}% smaller). Save the invoice to keep these smaller attachments, or cancel your edits to keep the originals.`
        );
      } else setMessage('No useful size reduction was found. Your attachments were kept unchanged.');
    } catch (cause) {
      if (mounted.current && currentForm.current?.id === invoiceId)
        setError(cause instanceof Error ? cause.message : 'Could not reduce attachments.');
    } finally {
      if (mounted.current) setOptimizing(false);
    }
  };

  const onUpload = async (file?: Blob, filename?: string, id?: number) => {
    if (file && filename) {
      const fileUnitArray = await toUint8Array(t, file);
      if (fileUnitArray)
        onAttach({
          data: fileUnitArray,
          fileSize: file.size,
          fileType: file.type,
          fileName: filename
        });
    } else if (!file && !filename && id) {
      onClear(id);
    }
  };

  const [attachmentUrls, setAttachmentUrls] = useState<Array<{ id: number; url?: string }>>([]);

  useEffect(() => {
    const attachments = invoiceForm?.invoiceAttachments ?? [];

    if (attachments.length === 0) {
      setAttachmentUrls([]);
      return;
    }

    // Blob URLs avoid base64 copies of every full-size receipt just to show thumbnails.
    const list = attachments.map(attachment => ({
      id: attachment.id as number,
      url: attachment.data?.length
        ? URL.createObjectURL(new Blob([new Uint8Array(attachment.data).buffer], { type: attachment.fileType }))
        : undefined
    }));
    setAttachmentUrls(list);
    return () => {
      for (const item of list) if (item.url) URL.revokeObjectURL(item.url);
    };
  }, [invoiceForm?.invoiceAttachments]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'start',
        alignItems: 'start',
        width: '100%',
        gap: 2,
        p: 2
      }}
    >
      <ListItemText
        primary={
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center'
            }}
          >
            <Tooltip title={t('invoices.attachments')}>
              <IconButton size="small" data-drag-handle onMouseDown={e => e.stopPropagation()}>
                <PhotoLibraryIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Typography
              component="div"
              variant="body1"
              sx={{ fontWeight: 600, color: 'primary.main', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {t('invoices.attachments').toUpperCase()}
            </Typography>
          </Box>
        }
        disableTypography
        sx={{ m: 0 }}
        slotProps={{ primary: { sx: { fontWeight: 500, m: 0 } } }}
      />
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'start',
          alignItems: 'start',
          flexWrap: 'wrap',
          width: '100%',
          gap: 1
        }}
      >
        {attachmentUrls.map(attachment => (
          <UploadImage
            key={attachment.id}
            onUpload={(file?: Blob, filename?: string) => onUpload(file, filename, attachment.id)}
            imgUrl={attachment.url}
            size={100}
            disableEdit={true}
          />
        ))}
        <UploadImage
          onUpload={onUpload}
          size={100}
          maxSizeMB={20}
          receipt
          imgUrl={undefined}
          alwaysShowAddIcon={true}
        />
      </Box>
      <Typography variant="body2" color="text.secondary">
        New receipts are optimized before saving. PDF exports also optimize older receipts. Stored attachments:{' '}
        {displaySize(
          (invoiceForm?.invoiceAttachments ?? []).reduce(
            (sum, attachment) => sum + (attachment.data?.byteLength ?? attachment.fileSize),
            0
          )
        )}
        .
      </Typography>
      {onOptimize && Boolean(invoiceForm?.invoiceAttachments?.length) && (
        <Button
          size="small"
          disabled={optimizing || invoiceForm?.attachmentsLoaded === false}
          onClick={reduceStoredAttachments}
        >
          {optimizing ? 'Reducing attachment size…' : 'Reduce stored attachments'}
        </Button>
      )}
      {message && <Alert severity="info">{message}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
    </Box>
  );
};
export const AttachmentsList = memo(AttachmentsListComponent);
