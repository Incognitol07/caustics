import { roundedRectSDF } from "./sdf";
import { clamp, smoothstep } from "./math";
import type { LensParams } from "./types";

/** Step used for the numeric gradient of the rounded-rect SDF, in pixels */
const GRADIENT_EPSILON = 0.5;
/** Tightness of the directional highlight; higher means a narrower hot spot */
const SPECULAR_EXPONENT = 10;
/** Relative strength of the counter-highlight on the edge facing away */
const COUNTER_LIGHT = 0.5;
/** Relative strength of the faint all-around fresnel ring */
const AMBIENT_RING = 0.22;

export interface SpecularOptions {
  /** Light direction in degrees: 0 lights the top edge, 90 the right edge */
  lightAngle: number;
  /** 0..1 overall highlight strength */
  strength: number;
}

/**
 * Highlight alpha for one rim sample: `facing` is the dot product of the
 * outward surface normal with the light direction, `mask` the rim band
 * weight. Shared by the single-lens and scene renderers so the two looks
 * never drift apart.
 */
export function specularIntensity(facing: number, mask: number, strength: number): number {
  const main = Math.max(facing, 0) ** SPECULAR_EXPONENT;
  const counter = Math.max(-facing, 0) ** SPECULAR_EXPONENT * COUNTER_LIGHT;
  return clamp(mask * strength * (AMBIENT_RING + main + counter), 0, 1);
}

/**
 * Renders the specular rim light for a lens onto a canvas: white pixels
 * whose alpha encodes highlight intensity, meant to be screen-blended over
 * the refracted output.
 *
 * The highlight hugs the inside of the lens edge, derived from the same SDF
 * as the refraction: brightest where the outward surface normal faces the
 * light, with a weaker counter-highlight on the opposite edge and a faint
 * ring everywhere. Because it is computed rather than CSS box-shadow, it
 * follows any shape the SDF describes.
 *
 * `resolution` is samples per CSS pixel, as in `computeDisplacementField`.
 */
export function renderSpecularToCanvas(
  canvas: HTMLCanvasElement,
  params: LensParams,
  options: SpecularOptions,
  resolution = 1,
): void {
  const { width, height, borderRadius, curvature } = params;
  const { lightAngle, strength } = options;
  const halfW = width / 2;
  const halfH = height / 2;

  // The highlight band is narrower than the refraction rim, so it reads as
  // the bright bevel right at the edge of the glass.
  const rimWidth = Math.max(1, curvature * Math.min(halfW, halfH));
  const band = Math.max(1.5, rimWidth * 0.3);

  const radians = (lightAngle * Math.PI) / 180;
  const lightX = Math.sin(radians);
  const lightY = -Math.cos(radians);

  const outWidth = Math.max(1, Math.round(width * resolution));
  const outHeight = Math.max(1, Math.round(height * resolution));
  canvas.width = outWidth;
  canvas.height = outHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas context is not available");
  }

  const image = ctx.createImageData(outWidth, outHeight);
  const data = image.data;

  for (let py = 0; py < outHeight; py++) {
    const y = (py + 0.5) / resolution - halfH;
    for (let px = 0; px < outWidth; px++) {
      const x = (px + 0.5) / resolution - halfW;

      const d = roundedRectSDF(x, y, halfW, halfH, borderRadius);
      if (d > 0) {
        continue; // outside the lens; the frame clips this away regardless
      }

      const t = clamp(-d / band, 0, 1);
      const mask = 1 - smoothstep(0, 1, t);
      if (mask <= 0) {
        continue;
      }

      // Numeric gradient of the SDF gives the outward surface normal.
      const gx =
        (roundedRectSDF(x + GRADIENT_EPSILON, y, halfW, halfH, borderRadius) -
          roundedRectSDF(x - GRADIENT_EPSILON, y, halfW, halfH, borderRadius)) /
        (2 * GRADIENT_EPSILON);
      const gy =
        (roundedRectSDF(x, y + GRADIENT_EPSILON, halfW, halfH, borderRadius) -
          roundedRectSDF(x, y - GRADIENT_EPSILON, halfW, halfH, borderRadius)) /
        (2 * GRADIENT_EPSILON);
      const gLen = Math.hypot(gx, gy) || 1;
      const normalX = gx / gLen;
      const normalY = gy / gLen;

      const facing = normalX * lightX + normalY * lightY;
      const alpha = specularIntensity(facing, mask, strength);
      const i = (py * outWidth + px) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(alpha * 255);
    }
  }

  ctx.putImageData(image, 0, 0);
}
