import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Dialog,
  DialogContent,
  IconButton,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useTheme
} from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactCrop, { type PercentCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { toDataUrl } from '../../../utils/dataUrlFunctions';
import { FULL_IMAGE_CROP, getNaturalCrop } from '../../../utils/imageCrop';
import { encodeReceiptCanvas, optimizeReceipt, receiptImageSize } from '../../../utils/receiptImage';

interface Props {
  isOpen: boolean;
  onClose?: () => void;
  onSave?: (url: string, file: Blob) => void | Promise<void>;
  imageSrc?: string;
  originalFile?: Blob;
  receipt?: boolean;
}
export const CropModal: React.FC<Props> = ({
  onClose = () => {},
  imageSrc,
  originalFile,
  receipt = false,
  isOpen,
  onSave = () => {}
}) => {
  const { t } = useTranslation();
  const [crop, setCrop] = useState<PercentCrop>({ ...FULL_IMAGE_CROP });
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const theme = useTheme();

  useEffect(() => {
    setCrop({ ...FULL_IMAGE_CROP });
    setError('');
    setReady(Boolean(imgRef.current?.complete && imgRef.current.naturalWidth));
  }, [imageSrc, isOpen]);

  const handleCropSave = async () => {
    if (!imgRef.current || !ready || saving) return;
    setSaving(true);
    setError('');
    let canvas: HTMLCanvasElement | undefined;
    try {
      const image = imgRef.current;
      const source = getNaturalCrop(image.naturalWidth, image.naturalHeight, crop);
      if (
        receipt &&
        originalFile &&
        ['image/png', 'image/jpeg', 'image/jpg'].includes(originalFile.type) &&
        source.x === 0 &&
        source.y === 0 &&
        source.width === image.naturalWidth &&
        source.height === image.naturalHeight
      ) {
        const blob = await optimizeReceipt(originalFile);
        await onSave(await toDataUrl(blob), blob);
        return;
      }
      canvas = document.createElement('canvas');
      const size = receipt ? receiptImageSize(source.width, source.height) : source;
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) throw new Error('Could not prepare the image. Please retry.');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, source.x, source.y, source.width, source.height, 0, 0, canvas.width, canvas.height);
      const blob = receipt
        ? await encodeReceiptCanvas(canvas)
        : await new Promise<Blob>((resolve, reject) => {
            canvas!.toBlob(
              result => (result ? resolve(result) : reject(new Error('Could not save the image. Please retry.'))),
              'image/png'
            );
          });
      await onSave(await toDataUrl(blob), blob);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the image. Please retry.');
    } finally {
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={saving ? undefined : onClose} fullScreen aria-label="Crop image">
      <AppBar sx={{ position: 'relative', borderRadius: 0 }}>
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Tooltip title={t('ariaLabel.back')}>
            <span>
              <IconButton
                disabled={saving}
                onClick={onClose}
                aria-label={t('ariaLabel.back')}
                sx={{ color: theme.palette.secondary.main }}
              >
                <ArrowBackIcon fontSize="medium" />
              </IconButton>
            </span>
          </Tooltip>
          <Stack direction="row" spacing={1}>
            <Button color="inherit" disabled={!ready || saving} onClick={() => setCrop({ ...FULL_IMAGE_CROP })}>
              Use full image
            </Button>
            <Button
              autoFocus
              color="inherit"
              disabled={!ready || saving || !crop.width || !crop.height}
              onClick={handleCropSave}
            >
              {saving ? 'Saving…' : t('common.save')}
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>
      <DialogContent
        sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minHeight: 0, p: 2 }}
      >
        <Typography variant="body2">
          {receipt
            ? 'Drag the edges to crop, or save the full image. Large receipts are optimized for smaller files; small images are never enlarged.'
            : 'Drag the edges to crop, or save the full image. The preview fits your screen; cropping keeps the original resolution.'}
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'auto'
          }}
        >
          <ReactCrop
            crop={crop}
            onChange={(_pixels, percent) => setCrop(percent)}
            disabled={saving || !ready}
            circularCrop={false}
            keepSelection
            style={{ maxWidth: '100%' }}
          >
            <img
              src={imageSrc}
              alt={t('ariaLabel.crop')}
              ref={imgRef}
              onLoad={() => {
                setReady(true);
                setError('');
              }}
              onError={() => {
                setReady(false);
                setError('This image could not be opened. Please choose a PNG or JPEG image.');
              }}
              style={{
                display: 'block',
                width: 'auto',
                height: 'auto',
                maxWidth: '100%',
                maxHeight: 'max(100px, calc(100dvh - 220px))'
              }}
            />
          </ReactCrop>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
