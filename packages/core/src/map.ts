import { clamp } from "./math";
import type { DisplacementField, DisplacementMapOptions } from "./types";

/**
 * Encodes a displacement field as RGBA pixels for use with feDisplacementMap:
 * red = horizontal displacement, green = vertical displacement, neutral (128)
 * meaning zero. Values are normalized by `scale` and clamped to [-1, 1].
 */
export function displacementFieldToPixels(
  field: DisplacementField,
  options: DisplacementMapOptions,
): Uint8ClampedArray {
  const { width, height, dx, dy } = field;
  const { scale } = options;
  const data = new Uint8ClampedArray(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    const nx = clamp(dx[i] / scale, -1, 1);
    const ny = clamp(dy[i] / scale, -1, 1);
    data[i * 4 + 0] = Math.round((nx * 0.5 + 0.5) * 255);
    data[i * 4 + 1] = Math.round((ny * 0.5 + 0.5) * 255);
    data[i * 4 + 2] = 0;
    data[i * 4 + 3] = 255;
  }

  return data;
}

/**
 * Renders a displacement field onto a canvas as a displacement map image,
 * sized to match the field exactly.
 */
export function renderDisplacementMapToCanvas(
  canvas: HTMLCanvasElement,
  field: DisplacementField,
  options: DisplacementMapOptions,
): void {
  canvas.width = field.width;
  canvas.height = field.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas context is not available");
  }

  const pixels = displacementFieldToPixels(field, options);
  const imageData = ctx.createImageData(field.width, field.height);
  imageData.data.set(pixels);
  ctx.putImageData(imageData, 0, 0);
}
