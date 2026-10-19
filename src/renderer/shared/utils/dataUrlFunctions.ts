import type { TFunction } from 'i18next';

// Image data is immutable in forms. Weak keys let closed invoices be collected.
const imageUrls = new WeakMap<Blob | Uint8Array, Map<string, Promise<string>>>();
const cacheOrder: { input: WeakRef<Blob | Uint8Array>; mime: string; bytes: number }[] = [];
const maxCachedBytes = 16 * 1024 * 1024;
let cachedBytes = 0;

export const toDataUrl = (input: Blob | Uint8Array, mimeType: string = 'image/png'): Promise<string> => {
  mimeType = mimeType ?? 'image/png';
  let cached = imageUrls.get(input);
  if (!cached) {
    cached = new Map();
    imageUrls.set(input, cached);
  }
  const existing = cached.get(mimeType);
  if (existing) return existing;

  const blob = input instanceof Blob ? input : new Blob([new Uint8Array(input).buffer], { type: mimeType });

  const result = new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Failed to convert to DataURL'));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  const bytes = input instanceof Blob ? input.size : input.byteLength;
  if (bytes <= maxCachedBytes) {
    cached.set(mimeType, result);
    cacheOrder.push({ input: new WeakRef(input), mime: mimeType, bytes });
    cachedBytes += bytes;
    while (cachedBytes > maxCachedBytes || cacheOrder.length > 64) {
      const oldest = cacheOrder.shift()!;
      cachedBytes -= oldest.bytes;
      const key = oldest.input.deref();
      if (key) imageUrls.get(key)?.delete(oldest.mime);
    }
  }
  void result.catch(() => cached.delete(mimeType));
  return result;
};

export const isDataUrl = (value: unknown): value is string => {
  return typeof value === 'string' && /^data:[\w/+.-]+;base64,[A-Za-z0-9+/=]+$/.test(value);
};

export const base64ToBytes = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

export const toUint8Array = async (
  t: TFunction<'translation', undefined>,
  input: Blob | File | ArrayBuffer | Uint8Array | null
) => {
  if (!input) return null;

  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (input instanceof Blob) {
    const arrayBuffer = await input.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  throw new Error(t('error.unsupportedImage'));
};
