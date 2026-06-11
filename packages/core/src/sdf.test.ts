import { describe, expect, it } from "vitest";
import { roundedRectSDF } from "./sdf";

describe("roundedRectSDF", () => {
  it("is negative at the center", () => {
    expect(roundedRectSDF(0, 0, 50, 30, 8)).toBeLessThan(0);
  });

  it("is approximately zero on a flat edge", () => {
    expect(roundedRectSDF(50, 0, 50, 30, 8)).toBeCloseTo(0, 5);
  });

  it("is positive outside the shape", () => {
    expect(roundedRectSDF(60, 0, 50, 30, 8)).toBeGreaterThan(0);
  });

  it("is symmetric across both axes", () => {
    const a = roundedRectSDF(20, 10, 50, 30, 8);
    expect(roundedRectSDF(-20, 10, 50, 30, 8)).toBeCloseTo(a, 10);
    expect(roundedRectSDF(20, -10, 50, 30, 8)).toBeCloseTo(a, 10);
    expect(roundedRectSDF(-20, -10, 50, 30, 8)).toBeCloseTo(a, 10);
  });
});
