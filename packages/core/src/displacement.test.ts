import { describe, expect, it } from "vitest";
import { computeDisplacementField } from "./displacement";

const baseParams = {
  width: 100,
  height: 60,
  borderRadius: 16,
  depth: 12,
  curvature: 0.4,
  splay: 0,
};

describe("computeDisplacementField", () => {
  it("produces zero displacement at the lens center", () => {
    const field = computeDisplacementField(baseParams);
    const i = 30 * field.width + 50; // center pixel
    expect(field.dx[i]).toBeCloseTo(0, 1);
    expect(field.dy[i]).toBeCloseTo(0, 1);
  });

  it("produces nonzero displacement near the edge", () => {
    const field = computeDisplacementField(baseParams);
    const i = 30 * field.width + 1; // near left edge, vertically centered
    expect(Math.hypot(field.dx[i], field.dy[i])).toBeGreaterThan(0);
  });

  it("clamps magnitude to depth", () => {
    const field = computeDisplacementField(baseParams);
    for (let i = 0; i < field.dx.length; i++) {
      const mag = Math.hypot(field.dx[i], field.dy[i]);
      expect(mag).toBeLessThanOrEqual(baseParams.depth + 1e-6);
    }
  });

  it("is mirror-symmetric across the vertical center line", () => {
    const field = computeDisplacementField(baseParams);
    const { width, height } = field;
    const py = 10;
    const left = 5;
    const right = width - 1 - left;
    const iLeft = py * width + left;
    const iRight = py * width + right;
    expect(field.dx[iRight]).toBeCloseTo(-field.dx[iLeft], 4);
    expect(field.dy[iRight]).toBeCloseTo(field.dy[iLeft], 4);
  });
});
