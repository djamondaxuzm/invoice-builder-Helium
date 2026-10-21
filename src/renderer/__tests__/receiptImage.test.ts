// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getOptimizedReceiptUrl,
  optimizeReceipt,
  optimizeStoredAttachment,
  prepareReceiptImage,
  receiptFileName,
  receiptImageSize
} from '../shared/utils/receiptImage';
import { invoiceSavePayload } from '../shared/utils/invoiceSavePayload';

afterEach(() => vi.unstubAllGlobals());
const source = (mime = 'image/png') => new Blob([new Uint8Array(500000)], { type: mime });
const setup = ({ width = 4000, height = 6000, alpha = 255, pngBytes = 300000, jpegBytes = 30000 } = {}) => {
  const bitmap = { width, height, close: vi.fn() };
  const context = {
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([255, 255, 255, alpha]) })),
    imageSmoothingEnabled: false,
    imageSmoothingQuality: ''
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => context),
    toBlob: vi.fn((callback: (blob: Blob | null) => void, mime: string) =>
      callback(new Blob([new Uint8Array(mime === 'image/png' ? pngBytes : jpegBytes)], { type: mime }))
    )
  };
  const decode = vi.fn(async () => bitmap);
  vi.stubGlobal('createImageBitmap', decode);
  vi.stubGlobal('document', { createElement: () => canvas });
  return { bitmap, context, canvas, decode };
};

describe('receipt size policy', () => {
  it.each([
    [4000, 6000, 2000, 3000],
    [6000, 4000, 3000, 2000],
    [600, 9000, 600, 9000],
    [40, 20, 40, 20]
  ])('fits %sx%s without stretching or enlarging', (width, height, outWidth, outHeight) => {
    expect(receiptImageSize(width, height)).toEqual({ width: outWidth, height: outHeight });
  });
  it('bounds very long receipts and rejects invalid dimensions', () => {
    expect(receiptImageSize(400, 30000).height).toBeLessThanOrEqual(16384);
    expect(() => receiptImageSize(0, 1)).toThrow('Invalid');
  });
});

describe('receipt encoding and compatibility', () => {
  it('converts opaque PNG photos to smaller JPEGs and releases native resources', async () => {
    const { context, bitmap, canvas } = setup();
    const result = await optimizeReceipt(source());
    expect(result.type).toBe('image/jpeg');
    expect(result.size).toBe(30000);
    expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 2000, 3000);
    expect(bitmap.close).toHaveBeenCalledOnce();
    expect(canvas.width).toBe(0);
  });
  it('keeps a lossless PNG when it is smaller than the JPEG candidate', async () => {
    setup({ pngBytes: 10000, jpegBytes: 30000 });
    expect((await optimizeReceipt(source())).type).toBe('image/png');
  });
  it('preserves even sparse transparency instead of turning it into a black/white background', async () => {
    const { canvas } = setup({ alpha: 254 });
    expect((await optimizeReceipt(source())).type).toBe('image/png');
    expect(canvas.toBlob).toHaveBeenCalledTimes(1);
  });
  it('keeps efficient JPEGs unchanged, preventing repeated lossy generations', async () => {
    const { canvas } = setup({ width: 2000, height: 3000 });
    const original = source('image/jpeg');
    expect(await optimizeReceipt(original)).toBe(original);
    expect(canvas.toBlob).not.toHaveBeenCalled();
  });
  it('keeps the original if savings are less than 10 percent', async () => {
    setup({ jpegBytes: 480000, pngBytes: 490000 });
    const original = source();
    expect(await optimizeReceipt(original)).toBe(original);
  });
  it('keeps small files, unsupported formats and non-browser execution compatible', async () => {
    const { decode } = setup();
    for (const original of [new Blob(['small'], { type: 'image/png' }), source('image/webp')])
      expect(await optimizeReceipt(original)).toBe(original);
    expect(decode).not.toHaveBeenCalled();
    vi.stubGlobal('createImageBitmap', undefined);
    const original = source();
    expect(await optimizeReceipt(original)).toBe(original);
  });
  it('retains originals after decode and encoder failures, and can process the next image', async () => {
    const { decode, canvas, bitmap } = setup();
    decode.mockRejectedValueOnce(new Error('Decode failed'));
    const original = source();
    expect(await optimizeReceipt(original)).toBe(original);
    canvas.toBlob.mockImplementation(callback => callback(null));
    expect(await optimizeReceipt(original)).toBe(original);
    expect(bitmap.close).toHaveBeenCalledOnce();
  });
  it('deduplicates preparation and returns matching MIME metadata without modifying source bytes', async () => {
    const { decode } = setup();
    const bytes = new Uint8Array(500000).fill(17);
    const first = prepareReceiptImage(bytes, 'image/png');
    expect(prepareReceiptImage(bytes, 'image/png')).toBe(first);
    const result = await first;
    expect(result.fileType).toBe('image/jpeg');
    expect(result.data.byteLength).toBe(30000);
    expect(bytes[0]).toBe(17);
    expect(bytes.byteLength).toBe(500000);
    expect(await prepareReceiptImage(result.data, result.fileType)).toBe(result);
    expect(decode).toHaveBeenCalledOnce();
  });
  it('replaces only explicitly optimized saved bytes and preserves the receipt ID', async () => {
    setup();
    const original = {
      id: 4,
      parentInvoiceId: 7,
      fileName: 'Receipt.PNG',
      fileSize: 500000,
      fileType: 'image/png',
      data: new Uint8Array(500000)
    };
    const smaller = await optimizeStoredAttachment(original);
    expect(smaller.id).toBe(4);
    expect(smaller.fileName).toBe('Receipt.jpg');
    expect(smaller.fileSize).toBe(smaller.data.byteLength);
    const payload = invoiceSavePayload({ id: 7, invoiceAttachments: [smaller] });
    expect(payload.invoiceAttachments![0].data.byteLength).toBe(30000);
    expect(payload.invoiceAttachments![0].retainExistingData).toBe(false);
    expect(invoiceSavePayload({ id: 7, invoiceAttachments: [original] }).invoiceAttachments![0].data.byteLength).toBe(
      0
    );
    expect(original.fileSize).toBe(500000);
  });
  it('normalizes JPEG aliases and refuses missing/unsupported export images instead of dropping receipts', async () => {
    expect(await getOptimizedReceiptUrl(new Uint8Array([1, 2]), 'image/jpg')).toBe('data:image/jpeg;base64,AQI=');
    await expect(getOptimizedReceiptUrl(new Uint8Array(), 'image/png')).rejects.toThrow('no image data');
    await expect(getOptimizedReceiptUrl(new Uint8Array([1]), 'application/pdf')).rejects.toThrow('Unsupported');
    expect(receiptFileName('a.JPEG', 'image/jpeg')).toBe('a.JPEG');
    expect(receiptFileName('scan', 'image/png')).toBe('scan.png');
  });
});
