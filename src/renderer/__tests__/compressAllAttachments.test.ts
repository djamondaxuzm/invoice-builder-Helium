// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { AttachmentManifest, AttachmentStorageApi } from '../../backend/shared/types/attachmentStorage';
import { compressAllAttachments, type CompressionProgress } from '../shared/utils/compressAllAttachments';

const manifest: AttachmentManifest = {
  databaseToken: 'database',
  canCompact: true,
  attachments: [1, 2, 3].map(id => ({ id, bytes: 1000 }))
};
const setup = () => {
  const api: AttachmentStorageApi = {
    getAttachmentManifest: vi.fn(async () => ({ success: true, data: manifest })),
    readStoredAttachment: vi.fn(async ({ id }) => ({
      success: true,
      data: { id, fileName: 'receipt.png', fileType: 'image/png', data: new Uint8Array(1000), fingerprint: 'original' }
    })),
    replaceStoredAttachment: vi.fn(async () => ({
      success: true,
      data: { updated: true, beforeBytes: 1000, afterBytes: 100 }
    })),
    compactAttachmentStorage: vi.fn(async () => ({ success: true, data: { beforeBytes: 10000, afterBytes: 1000 } }))
  };
  const abort = new AbortController();
  const updates: CompressionProgress[] = [];
  const options = {
    signal: abort.signal,
    compact: true,
    onProgress: (p: CompressionProgress) => updates.push(p),
    optimize: vi.fn<(source: Blob) => Promise<Blob>>(
      async () => new Blob([new Uint8Array(100)], { type: 'image/jpeg' })
    )
  };
  return { api, abort, updates, options };
};
describe('bulk attachment orchestration', () => {
  it('saves sequentially, reports confirmed byte savings and compacts only at the end', async () => {
    const { api, options, updates } = setup();
    const result = await compressAllAttachments(api, manifest, options);
    expect(result).toMatchObject({ processed: 3, compressed: 3, savedBytes: 2700, beforeBytes: 3000, phase: 'done' });
    expect(api.replaceStoredAttachment).toHaveBeenCalledTimes(3);
    expect(updates.map(p => p.phase)).toContain('compacting');
    expect(result.compaction).toEqual({ beforeBytes: 10000, afterBytes: 1000 });
  });
  it('cancels during encoding without saving the current image or starting the next', async () => {
    const { api, options, abort } = setup();
    options.optimize.mockImplementationOnce(async () => {
      abort.abort();
      return new Blob(['new'], { type: 'image/jpeg' });
    });
    expect(await compressAllAttachments(api, manifest, options)).toMatchObject({
      cancelled: true,
      processed: 0,
      savedBytes: 0
    });
    expect(api.replaceStoredAttachment).not.toHaveBeenCalled();
    expect(api.readStoredAttachment).toHaveBeenCalledTimes(1);
    expect(api.compactAttachmentStorage).not.toHaveBeenCalled();
  });
  it('keeps completed savings if cancelled during a save and does not start another image', async () => {
    const { api, options, abort } = setup();
    vi.mocked(api.replaceStoredAttachment).mockImplementationOnce(async () => {
      abort.abort();
      return { success: true, data: { updated: true, beforeBytes: 1000, afterBytes: 100 } };
    });
    expect(await compressAllAttachments(api, manifest, options)).toMatchObject({
      cancelled: true,
      processed: 1,
      compressed: 1,
      savedBytes: 900
    });
    expect(api.readStoredAttachment).toHaveBeenCalledTimes(1);
  });
  it('skips unsupported/unchanged and conflicting/deleted files without counting unconfirmed savings', async () => {
    const { api, options } = setup();
    options.optimize.mockImplementationOnce(async source => source);
    vi.mocked(api.readStoredAttachment).mockResolvedValueOnce({ success: true, data: null });
    vi.mocked(api.replaceStoredAttachment).mockResolvedValueOnce({
      success: true,
      data: { updated: false, beforeBytes: 0, afterBytes: 0 }
    });
    expect(await compressAllAttachments(api, manifest, options)).toMatchObject({
      processed: 3,
      unchanged: 1,
      conflicts: 2,
      compressed: 0,
      savedBytes: 0
    });
  });
  it('stops after an uncertain write failure, retaining accurate prior progress and no compaction', async () => {
    const { api, options } = setup();
    vi.mocked(api.replaceStoredAttachment)
      .mockResolvedValueOnce({ success: true, data: { updated: true, beforeBytes: 1000, afterBytes: 100 } })
      .mockResolvedValueOnce({ success: false, message: 'disk full' });
    expect(await compressAllAttachments(api, manifest, options)).toMatchObject({
      processed: 1,
      compressed: 1,
      savedBytes: 900,
      error: 'disk full'
    });
    expect(api.readStoredAttachment).toHaveBeenCalledTimes(2);
    expect(api.compactAttachmentStorage).not.toHaveBeenCalled();
  });
  it('reports compaction failure separately after successful saves and honors opt-out', async () => {
    const { api, options } = setup();
    vi.mocked(api.compactAttachmentStorage).mockResolvedValue({ success: false, message: 'database busy' });
    expect(await compressAllAttachments(api, manifest, options)).toMatchObject({
      compressed: 3,
      compactionError: 'database busy'
    });
    vi.mocked(api.compactAttachmentStorage).mockClear();
    await compressAllAttachments(api, manifest, { ...options, compact: false });
    expect(api.compactAttachmentStorage).not.toHaveBeenCalled();
  });
  it('stops on a database change before writing any images', async () => {
    const { api, options } = setup();
    vi.mocked(api.readStoredAttachment).mockResolvedValueOnce({ success: false, message: 'database changed' });
    expect(await compressAllAttachments(api, manifest, options)).toMatchObject({
      processed: 0,
      error: 'database changed'
    });
    expect(api.replaceStoredAttachment).not.toHaveBeenCalled();
  });
});
