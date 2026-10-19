/** Keep logos sharp at invoice size without embedding camera-sized images. */
export const optimizeLogo = async (source: Blob): Promise<Blob> => {
  if (
    !['image/png', 'image/jpeg'].includes(source.type) ||
    source.size < 128 * 1024 ||
    typeof createImageBitmap !== 'function' ||
    typeof document === 'undefined'
  )
    return source;
  let bitmap: ImageBitmap | undefined;
  let canvas: HTMLCanvasElement | undefined;
  try {
    bitmap = await createImageBitmap(source);
    const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
    canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) return source;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    // PNG stays PNG so transparent backgrounds and sharp logo edges are retained.
    const result = await new Promise<Blob | null>(resolve => canvas!.toBlob(resolve, source.type, 0.85));
    return result && result.size > 0 && result.size < source.size && result.type === source.type ? result : source;
  } catch {
    // Compression is optional: an unsupported decoder must not lose a saved logo.
    return source;
  } finally {
    bitmap?.close();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
};

/** Also optimize old saved logos for export, without rewriting historical invoices. */
export const getOptimizedLogoUrl = async (bytes?: Uint8Array, mimeType = 'image/png') => {
  if (!bytes?.length) return undefined;
  const blob = await optimizeLogo(new Blob([new Uint8Array(bytes).buffer], { type: mimeType || 'image/png' }));
  const data = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < data.length; offset += 8192) {
    binary += String.fromCharCode(...data.subarray(offset, offset + 8192));
  }
  return `data:${blob.type};base64,${btoa(binary)}`;
};
