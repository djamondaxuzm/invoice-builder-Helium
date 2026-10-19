// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getOptimizedLogoUrl, optimizeLogo } from '../shared/utils/logoImage';

afterEach(() => vi.unstubAllGlobals());
const source = () => new Blob([new Uint8Array(500000)], { type: 'image/png' });
const setup = (output: Blob | null, width = 4000, height = 2000) => {
  const bitmap = { width, height, close: vi.fn() };
  const dimensions: number[] = [];
  const context = { drawImage: vi.fn(), imageSmoothingEnabled: false, imageSmoothingQuality: '' };
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => context),
    toBlob: vi.fn((callback: (blob: Blob | null) => void, mime?: string) => {
      void mime;
      dimensions.push(canvas.width, canvas.height);
      callback(output);
    })
  };
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => bitmap)
  );
  vi.stubGlobal('document', { createElement: vi.fn(() => canvas) });
  return { bitmap, canvas, context, dimensions };
};

describe('logo optimization', () => {
  it('preserves aspect ratio, transparency, and releases decoded images', async () => {
    const small = new Blob(['small'], { type: 'image/png' });
    const { dimensions, bitmap, canvas } = setup(small);
    expect(await optimizeLogo(source())).toBe(small);
    expect(dimensions).toEqual([1024, 512]);
    expect(canvas.toBlob.mock.calls[0][1]).toBe('image/png');
    expect(bitmap.close).toHaveBeenCalledOnce();
    expect(canvas.width).toBe(0);
  });
  it('does not enlarge small pixel dimensions', async () => {
    const { dimensions } = setup(new Blob(['small'], { type: 'image/png' }), 400, 200);
    await optimizeLogo(source());
    expect(dimensions).toEqual([400, 200]);
  });
  it.each([
    null,
    new Blob([new Uint8Array(600000)], { type: 'image/png' }),
    new Blob(['wrong format'], { type: 'image/jpeg' })
  ])('keeps original data when encoding provides no usable size reduction', async result => {
    setup(result);
    const original = source();
    expect(await optimizeLogo(original)).toBe(original);
  });
  it('keeps small/unsupported images and works without browser APIs', async () => {
    const { bitmap } = setup(null);
    const tiny = new Blob(['tiny'], { type: 'image/png' });
    expect(await optimizeLogo(tiny)).toBe(tiny);
    const svg = new Blob([new Uint8Array(500000)], { type: 'image/svg+xml' });
    expect(await optimizeLogo(svg)).toBe(svg);
    expect(bitmap.close).not.toHaveBeenCalled();
    vi.stubGlobal('createImageBitmap', undefined);
    const original = source();
    expect(await optimizeLogo(original)).toBe(original);
  });
  it('falls back on decoder or canvas failure and releases resources', async () => {
    const { canvas, bitmap } = setup(null);
    canvas.getContext.mockImplementation(() => {
      throw new Error('Canvas failed');
    });
    const original = source();
    expect(await optimizeLogo(original)).toBe(original);
    expect(bitmap.close).toHaveBeenCalledOnce();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new Error('Decode failed');
      })
    );
    expect(await optimizeLogo(original)).toBe(original);
  });
  it('exports optimized saved bytes with matching MIME type without mutating the snapshot', async () => {
    setup(new Blob(['small'], { type: 'image/png' }));
    const original = new Uint8Array(500000);
    expect(await getOptimizedLogoUrl(original, 'image/png')).toBe('data:image/png;base64,c21hbGw=');
    expect(original.byteLength).toBe(500000);
    expect(await getOptimizedLogoUrl()).toBeUndefined();
  });
});
