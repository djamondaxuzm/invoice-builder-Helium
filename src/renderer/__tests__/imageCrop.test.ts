import { expect, it } from 'vitest';
import { FULL_IMAGE_CROP, getNaturalCrop } from '../shared/utils/imageCrop';

it('keeps source resolution for full wide, portrait and small images', () => {
  for (const [width, height] of [
    [4000, 1000],
    [1000, 4000],
    [32, 24]
  ])
    expect(getNaturalCrop(width, height, FULL_IMAGE_CROP)).toEqual({ x: 0, y: 0, width, height });
});
it('maps percent crops directly to source pixels independently of preview size', () => {
  expect(getNaturalCrop(4000, 1000, { unit: '%', x: 25, y: 10, width: 50, height: 80 })).toEqual({
    x: 1000,
    y: 100,
    width: 2000,
    height: 800
  });
  expect(getNaturalCrop(100, 400, { unit: '%', x: 80, y: 90, width: 30, height: 20 })).toEqual({
    x: 80,
    y: 360,
    width: 20,
    height: 40
  });
});
it('rejects unloaded images and empty or invalid selections', () => {
  expect(() => getNaturalCrop(0, 0, FULL_IMAGE_CROP)).toThrow();
  expect(() => getNaturalCrop(400, 100, { ...FULL_IMAGE_CROP, width: 0 })).toThrow();
  expect(() => getNaturalCrop(400, 100, { ...FULL_IMAGE_CROP, x: NaN })).toThrow();
});
