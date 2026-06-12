/**
 * A coarse quality budget for the device running the lens. SVG filter
 * pipelines rasterize on the CPU in every engine, so the budget tracks CPU
 * headroom, not GPU: "low" means the full pipeline is likely to miss frame
 * budget during interaction and a leaner preset is the better default.
 */
export type PerformanceTier = "high" | "low";

/**
 * Estimates the device's quality budget from cheap, synchronous signals:
 * reported memory and core count, and the coarse-pointer + high-DPR
 * combination that identifies phones and tablets (which pay the filter
 * cost at device resolution on modest CPUs). Heuristic by nature; callers
 * who know better (e.g. from real frame timings) should pass an explicit
 * preset instead of relying on the tier.
 */
export function performanceTier(
  win: (Window & typeof globalThis) | undefined | null = typeof window !== "undefined"
    ? window
    : undefined,
): PerformanceTier {
  const nav = win?.navigator;
  if (!nav) {
    return "high";
  }

  // navigator.deviceMemory is capped at 8 and absent in Safari/Firefox.
  const memory = (nav as { deviceMemory?: number }).deviceMemory;
  if (memory !== undefined && memory <= 4) {
    return "low";
  }
  if (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 4) {
    return "low";
  }

  const coarsePointer = win.matchMedia?.("(pointer: coarse)")?.matches === true;
  if (coarsePointer && (win.devicePixelRatio ?? 1) >= 2.5) {
    return "low";
  }

  return "high";
}
