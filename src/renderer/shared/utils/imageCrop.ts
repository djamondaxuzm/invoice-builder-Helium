import type { PercentCrop } from 'react-image-crop';

export const FULL_IMAGE_CROP: PercentCrop = { unit: '%', x: 0, y: 0, width: 100, height: 100 };

// Percent coordinates keep the same source pixels selected when the preview resizes.
export const getNaturalCrop = (width: number, height: number, crop: PercentCrop) => {
  if (![width, height, crop.x, crop.y, crop.width, crop.height].every(Number.isFinite) || width <= 0 || height <= 0)
    throw new Error('The image could not be loaded. Please choose it again.');
  const x = Math.max(0, Math.min(width, Math.round((width * crop.x) / 100)));
  const y = Math.max(0, Math.min(height, Math.round((height * crop.y) / 100)));
  const right = Math.max(x, Math.min(width, Math.round((width * (crop.x + crop.width)) / 100)));
  const bottom = Math.max(y, Math.min(height, Math.round((height * (crop.y + crop.height)) / 100)));
  if (right <= x || bottom <= y) throw new Error('Select an area of the image to save.');
  return { x, y, width: right - x, height: bottom - y };
};
