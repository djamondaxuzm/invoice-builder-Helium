import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
  Stack,
  Typography
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import type { AttachmentManifest } from '../../../../backend/shared/types/attachmentStorage';
import { getApi } from '../../../shared/api/restApi';
import { PageHeader } from '../../../shared/components/layout/pageHeader/PageHeader';
import { compressAllAttachments, type CompressionProgress } from '../../../shared/utils/compressAllAttachments';

const size = (bytes: number) => `${(bytes / 1_000_000).toFixed(2)} MB`;

export const AttachmentStorage = ({ showBack = false, onBack }: { showBack?: boolean; onBack?: () => void }) => {
  const [manifest, setManifest] = useState<AttachmentManifest>();
  const [scanning, setScanning] = useState(true);
  const [busy, setBusy] = useState(false);
  const [compact, setCompact] = useState(true);
  const [progress, setProgress] = useState<CompressionProgress>();
  const [error, setError] = useState('');
  const mounted = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const [stopping, setStopping] = useState(false);

  const scan = async () => {
    setScanning(true);
    setError('');
    try {
      const result = await getApi().getAttachmentManifest();
      if (!mounted.current) return;
      if (!result.success || !result.data) throw new Error(result.message || 'Could not scan attachment storage.');
      setManifest(result.data);
    } catch (error) {
      if (mounted.current) {
        setManifest(undefined);
        setError(error instanceof Error ? error.message : 'Could not scan attachment storage.');
      }
    } finally {
      if (mounted.current) setScanning(false);
    }
  };
  useEffect(() => {
    mounted.current = true;
    void scan();
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!busy) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [busy]);

  const run = async () => {
    if (!manifest || controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setStopping(false);
    setError('');
    setProgress(undefined);
    try {
      await compressAllAttachments(getApi(), manifest, {
        signal: abort.signal,
        compact,
        onProgress: value => {
          if (mounted.current) setProgress(value);
        }
      });
      if (mounted.current) await scan();
    } finally {
      controller.current = null;
      if (mounted.current) setBusy(false);
    }
  };
  const cancel = () => {
    controller.current?.abort();
    setStopping(true);
  };
  const complete = progress?.phase === 'done' ? progress : undefined;
  const totalBytes = manifest?.attachments.reduce((sum, row) => sum + row.bytes, 0) ?? 0;

  return (
    <Stack spacing={2}>
      <PageHeader title="Attachment storage" showBack={showBack} onBack={onBack} />
      <Typography>
        Compress saved receipt images across all invoices and quotes, including archived records, in the current
        database.
      </Typography>
      <Typography color="text.secondary">
        Smaller images replace the saved originals immediately. Photos may use JPEG compression; transparency and
        proportions are preserved. Already optimized, unsupported, or unreadable files are kept unchanged. Invoice
        amounts, payments and other fields stay unchanged.
      </Typography>
      {scanning ? (
        <LinearProgress aria-label="Scanning attachments" />
      ) : (
        manifest && (
          <Typography>
            <strong>{manifest.attachments.length}</strong> saved attachments · <strong>{size(totalBytes)}</strong> of
            image/file data
          </Typography>
        )
      )}
      {manifest?.canCompact && (
        <FormControlLabel
          control={<Checkbox checked={compact} onChange={(_, checked) => setCompact(checked)} disabled={busy} />}
          label="Reclaim unused database space when finished"
        />
      )}
      <Typography variant="body2" color="text.secondary">
        You can stop between images; completed savings remain saved. Keep Helium open until it finishes.
        {manifest?.canCompact
          ? ' Reclaiming space is the final step and cannot be cancelled once started.'
          : ' Your database server manages reclaimed disk space.'}
      </Typography>
      <Stack direction="row" spacing={1}>
        <Button variant="contained" onClick={run} disabled={scanning || busy || !manifest?.attachments.length}>
          Compress all attachments
        </Button>
        <Button onClick={scan} disabled={scanning || busy}>
          Refresh sizes
        </Button>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      {complete && (
        <Alert
          severity={
            complete.error || complete.compactionError || complete.conflicts || complete.cancelled
              ? 'warning'
              : 'success'
          }
        >
          <Typography sx={{ fontWeight: 'bold' }}>
            {complete.error
              ? 'Compression stopped'
              : complete.cancelled
                ? 'Compression cancelled'
                : 'Compression complete'}
          </Typography>
          <Typography>
            {complete.processed} of {complete.total} checked · {complete.compressed} compressed · {complete.unchanged}{' '}
            unchanged · {complete.conflicts} changed or removed elsewhere.
          </Typography>
          <Typography>
            Saved {size(complete.savedBytes)} in attachment data. Completed replacements are already saved.
          </Typography>
          {complete.compaction && (
            <Typography>
              Allocated database size: {size(complete.compaction.beforeBytes)} → {size(complete.compaction.afterBytes)}.
            </Typography>
          )}
          {complete.error && (
            <Typography>
              {complete.error} Refresh sizes before trying again; completed replacements are retained.
            </Typography>
          )}
          {complete.compactionError && (
            <Typography>
              Images were saved, but unused space could not be reclaimed: {complete.compactionError} Close other apps
              using this database and try again.
            </Typography>
          )}
          {!!complete.conflicts && (
            <Typography>
              Changed or removed attachments were skipped to protect newer edits. Run again to check the latest files.
            </Typography>
          )}
        </Alert>
      )}
      <Dialog open={busy} fullWidth maxWidth="sm" aria-labelledby="compression-title">
        <DialogTitle id="compression-title">
          {progress?.phase === 'compacting' ? 'Reclaiming database space' : 'Compressing attachments'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <LinearProgress
              aria-label="Compression progress"
              variant={progress?.phase === 'compressing' ? 'determinate' : 'indeterminate'}
              value={progress?.total ? (progress.processed / progress.total) * 100 : 0}
            />
            <Typography>
              {progress?.processed ?? 0} of {progress?.total ?? manifest?.attachments.length ?? 0} checked
            </Typography>
            <Box sx={{ overflowWrap: 'anywhere' }}>{progress?.currentFile}</Box>
            <Typography>{size(progress?.savedBytes ?? 0)} saved so far</Typography>
            <Typography variant="body2">
              Completed images are saved individually. Stopping keeps those savings and leaves the remaining images
              unchanged.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancel} disabled={stopping || progress?.phase !== 'compressing'}>
            {stopping ? 'Stopping…' : 'Stop compression'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};
