import type { InvoiceAttachment } from '../types/invoice';
import { toDataUrl } from './dataUrlFunctions';

const MIN_BYTES = 128 * 1024;
const MAX_PIXELS = 6_000_000;
const MAX_SHORT_EDGE = 2000;
const MAX_EDGE = 16384;
const JPEG_QUALITY = 0.86;

export const receiptImageSize = (width: number, height: number) => {
  if (![width, height].every(value => Number.isFinite(value) && value > 0))
    throw new Error('Invalid receipt dimensions.');
  const scale = Math.min(
    1,
    MAX_SHORT_EDGE / Math.min(width, height),
    Math.sqrt(MAX_PIXELS / (width * height)),
    MAX_EDGE / Math.max(width, height)
  );
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) };
};

const encode = (canvas: HTMLCanvasElement, mime: string) =>
  new Promise<Blob | null>(resolve => canvas.toBlob(resolve, mime, JPEG_QUALITY));

/** Inspect every alpha value in bounded strips; sparse transparency must not be flattened. */
const isOpaque = (canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) => {
  for (let y = 0; y < canvas.height; y += 64) {
    const { data } = context.getImageData(0, y, canvas.width, Math.min(64, canvas.height - y));
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 255) return false;
  }
  return true;
};

/** Lossless PNG wins for simple screenshots; opaque photos usually benefit from JPEG. */
export const encodeReceiptCanvas = async (canvas: HTMLCanvasElement, original?: Blob): Promise<Blob> => {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not prepare the receipt image.');
  const png = original?.type === 'image/png' ? original : await encode(canvas, 'image/png');
  let best = png?.type === 'image/png' && png.size > 0 ? png : undefined;
  if (isOpaque(canvas, context)) {
    const jpeg = await encode(canvas, 'image/jpeg');
    if (jpeg?.type === 'image/jpeg' && jpeg.size > 0 && (!best || jpeg.size < best.size)) best = jpeg;
  }
  if (!best) throw new Error('Could not encode the receipt image.');
  // A tiny saving does not justify another lossy generation or a format change.
  return original && best.size > original.size * 0.9 ? original : best;
};

let imageWork: Promise<unknown> = Promise.resolve();
const sequential = <T>(work: () => Promise<T>): Promise<T> => {
  const result = imageWork.then(work, work);
  imageWork = result.then(
    () => undefined,
    () => undefined
  );
  return result;
};

/** Optional optimization: decoding/encoding failures always preserve the source. */
export const optimizeReceipt = (source: Blob): Promise<Blob> => {
  if (
    !['image/png', 'image/jpeg', 'image/jpg'].includes(source.type) ||
    source.size < MIN_BYTES ||
    typeof createImageBitmap !== 'function' ||
    typeof document === 'undefined'
  )
    return Promise.resolve(source);
  return sequential(async () => {
    let bitmap: ImageBitmap | undefined;
    let canvas: HTMLCanvasElement | undefined;
    try {
      bitmap = await createImageBitmap(source);
      if (!bitmap.width || !bitmap.height) return source;
      const size = receiptImageSize(bitmap.width, bitmap.height);
      const resized = size.width !== bitmap.width || size.height !== bitmap.height;
      // Do not repeatedly recompress saved JPEGs that already fit the resolution budget.
      if (!resized && source.type !== 'image/png') return source;
      canvas = document.createElement('canvas');
      Object.assign(canvas, size);
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return source;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(bitmap, 0, 0, size.width, size.height);
      const result = await encodeReceiptCanvas(canvas, resized ? undefined : source);
      return result.size <= source.size * 0.9 ? result : source;
    } catch {
      return source;
    } finally {
      bitmap?.close();
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
    }
  });
};

type PreparedReceipt = { data: Uint8Array; fileType: string };
const prepared = new WeakMap<Uint8Array, Map<string, Promise<PreparedReceipt>>>();
const order: { key: WeakRef<Uint8Array>; mime: string; bytes: number }[] = [];
let cachedBytes = 0;
const cache = (data: Uint8Array, mime: string, promise: Promise<PreparedReceipt>) => {
  const entries = prepared.get(data) ?? new Map<string, Promise<PreparedReceipt>>();
  entries.set(mime, promise);
  prepared.set(data, entries);
  const entry = { key: new WeakRef(data), mime, bytes: 0 };
  order.push(entry);
  void promise.then(
    result => {
      if (!order.includes(entry)) return;
      entry.bytes = result.data.byteLength;
      cachedBytes += entry.bytes;
      trim();
    },
    () => entries.delete(mime)
  );
  trim();
};
const trim = () => {
  while (order.length > 32 || cachedBytes > 32 * 1024 * 1024) {
    const entry = order.shift()!;
    cachedBytes -= entry.bytes;
    const key = entry.key.deref();
    if (key) prepared.get(key)?.delete(entry.mime);
  }
};

export const prepareReceiptImage = (data: Uint8Array, fileType: string): Promise<PreparedReceipt> => {
  const mime = fileType === 'image/jpg' ? 'image/jpeg' : fileType;
  const existing = prepared.get(data)?.get(mime);
  if (existing) return existing;
  const promise = (async () => {
    const original = new Blob([new Uint8Array(data).buffer], { type: mime });
    const blob = await optimizeReceipt(original);
    const result = { data: blob === original ? data : new Uint8Array(await blob.arrayBuffer()), fileType: blob.type };
    if (result.data !== data) cache(result.data, result.fileType, Promise.resolve(result));
    return result;
  })();
  cache(data, mime, promise);
  return promise;
};

export const getOptimizedReceiptUrl = async (data: Uint8Array, fileType: string) => {
  if (!data?.length) throw new Error('A receipt has no image data. Reload the invoice before exporting.');
  if (!['image/png', 'image/jpeg', 'image/jpg'].includes(fileType))
    throw new Error('Unsupported receipt image. Use PNG or JPEG images.');
  const result = await prepareReceiptImage(data, fileType);
  if (typeof FileReader === 'undefined') {
    let binary = '';
    for (let offset = 0; offset < result.data.length; offset += 8192)
      binary += String.fromCharCode(...result.data.subarray(offset, offset + 8192));
    return `data:${result.fileType};base64,${btoa(binary)}`;
  }
  return toDataUrl(result.data, result.fileType);
};

export const receiptFileName = (name: string, mime: string) => {
  const extension = mime === 'image/jpeg' || mime === 'image/jpg' ? 'jpg' : 'png';
  if ((extension === 'jpg' && /\.jpe?g$/i.test(name)) || (extension === 'png' && /\.png$/i.test(name))) return name;
  return name.replace(/\.[^.]+$/, '') + '.' + extension;
};

export const optimizeStoredAttachment = async (attachment: InvoiceAttachment): Promise<InvoiceAttachment> => {
  if (!attachment.data?.length) throw new Error('Load the complete invoice before reducing attachments.');
  const result = await prepareReceiptImage(attachment.data, attachment.fileType);
  return result.data === attachment.data
    ? attachment
    : {
        ...attachment,
        ...result,
        fileName: receiptFileName(attachment.fileName, result.fileType),
        fileSize: result.data.byteLength,
        retainExistingData: false
      };
};
