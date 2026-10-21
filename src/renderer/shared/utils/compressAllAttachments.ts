import type {
  AttachmentManifest,
  AttachmentStorageApi,
  StorageCompaction
} from '../../../backend/shared/types/attachmentStorage';
import { optimizeReceipt } from './receiptImage';

export type CompressionProgress = {
  total: number;
  processed: number;
  compressed: number;
  unchanged: number;
  conflicts: number;
  beforeBytes: number;
  savedBytes: number;
  currentFile?: string;
  phase: 'compressing' | 'compacting' | 'done';
  cancelled: boolean;
  error?: string;
  compaction?: StorageCompaction;
  compactionError?: string;
};

export const compressAllAttachments = async (
  api: AttachmentStorageApi,
  manifest: AttachmentManifest,
  options: {
    signal: AbortSignal;
    compact: boolean;
    onProgress: (progress: CompressionProgress) => void;
    optimize?: (source: Blob) => Promise<Blob>;
  }
): Promise<CompressionProgress> => {
  const progress: CompressionProgress = {
    total: manifest.attachments.length,
    processed: 0,
    compressed: 0,
    unchanged: 0,
    conflicts: 0,
    beforeBytes: manifest.attachments.reduce((sum, row) => sum + row.bytes, 0),
    savedBytes: 0,
    phase: 'compressing',
    cancelled: false
  };
  const emit = () => options.onProgress({ ...progress });
  emit();
  try {
    // Fetch/decode/save one image at a time. Never load the full database of blobs into memory.
    for (const item of manifest.attachments) {
      if (options.signal.aborted) break;
      const request = { databaseToken: manifest.databaseToken, id: item.id };
      const loaded = await api.readStoredAttachment(request);
      if (!loaded.success) throw new Error(loaded.message || 'Could not load the next attachment.');
      if (options.signal.aborted) break;
      if (!loaded.data) {
        progress.conflicts++;
      } else {
        const row = loaded.data;
        progress.currentFile = row.fileName;
        emit();
        const source = new Blob([new Uint8Array(row.data).buffer], { type: row.fileType });
        const result = await (options.optimize ?? optimizeReceipt)(source);
        if (options.signal.aborted) break;
        if (result === source || result.size > source.size * 0.9) {
          progress.unchanged++;
        } else {
          const bytes = new Uint8Array(await result.arrayBuffer());
          if (options.signal.aborted) break;
          const saved = await api.replaceStoredAttachment({
            ...request,
            fingerprint: row.fingerprint,
            data: bytes,
            fileType: result.type
          });
          // Stop on write/connection errors; don't silently report success or retry an uncertain save.
          if (!saved.success || !saved.data)
            throw new Error(saved.message || 'Could not save the compressed attachment.');
          if (saved.data.updated) {
            progress.compressed++;
            progress.savedBytes += saved.data.beforeBytes - saved.data.afterBytes;
          } else progress.conflicts++;
        }
      }
      progress.processed++;
      emit();
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    progress.cancelled = options.signal.aborted;
    if (!progress.cancelled && options.compact && manifest.canCompact) {
      progress.phase = 'compacting';
      progress.currentFile = undefined;
      emit();
      try {
        const compacted = await api.compactAttachmentStorage(manifest.databaseToken);
        if (compacted.success) progress.compaction = compacted.data;
        else progress.compactionError = compacted.message || 'Could not reclaim unused database space.';
      } catch (error) {
        progress.compactionError = error instanceof Error ? error.message : 'Could not reclaim unused database space.';
      }
    }
  } catch (error) {
    progress.error = error instanceof Error ? error.message : 'Compression stopped unexpectedly.';
  }
  progress.phase = 'done';
  progress.currentFile = undefined;
  emit();
  return progress;
};
