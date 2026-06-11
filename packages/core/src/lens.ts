import { createGlassFilter } from "./filter";

const LENS_MARKER = "data-glasskit-lens";

const SHINE_GRADIENT =
  "linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0) 35%, rgba(255,255,255,0) 65%, rgba(255,255,255,0.08))";

const SHINE_SHADOW = [
  "inset 0 0 0 1px rgba(255,255,255,0.12)",
  "inset 2px 2px 2px -1px rgba(255,255,255,0.85)",
  "inset -2px -2px 2px -1px rgba(255,255,255,0.45)",
  "inset 0 0 10px 1px rgba(255,255,255,0.12)",
].join(", ");

export interface LiquidLensOptions {
  /** Maximum displacement at the rim, in px (default 24) */
  depth?: number;
  /** 0..1 — width of the curved rim relative to the lens size (default 0.4) */
  curvature?: number;
  /** 0..1 — blends displacement from edge-normal to radial (default 0) */
  splay?: number;
  /** 0..1 — chromatic aberration strength (default 0.12) */
  aberration?: number;
  /** Blur in px applied to the refracted content (default 0.2) */
  blur?: number;
  /** Saturation multiplier for the refracted content (default 1.15) */
  saturation?: number;
  /** Corner radius in px; defaults to the frame's computed border-radius */
  borderRadius?: number;
  /** Render the specular rim highlight layer (default true) */
  shine?: boolean;
}

export interface LiquidLens {
  /** Merges in new options and regenerates the displacement map. */
  update(options?: LiquidLensOptions): void;
  /**
   * Re-aligns the backdrop copy with the real backdrop. Call after moving
   * the frame (e.g. on every drag frame). Cheap, no map regeneration.
   */
  sync(): void;
  /**
   * Scales the refraction strength relative to the configured depth without
   * regenerating the map. Cheap; intended for per-frame interaction
   * feedback such as swelling on press.
   */
  setIntensity(factor: number): void;
  /** Removes everything the lens added to the document. */
  destroy(): void;
}

const DEFAULTS: Required<Omit<LiquidLensOptions, "borderRadius">> = {
  depth: 24,
  curvature: 0.4,
  splay: 0,
  aberration: 0.12,
  blur: 0.2,
  saturation: 1.15,
  shine: true,
};

/**
 * Turns `frame` into a liquid-glass lens floating over `backdrop`.
 *
 * The lens cannot sample the page behind it, so it clones `backdrop` into
 * itself and keeps the clone pixel-aligned with the original; the SVG filter
 * then bends, fringes, and saturates that copy, and a specular shine layer
 * on top provides the glossy rim. The frame must be visually on top of the
 * backdrop and inside it in layout terms (any positioned descendant works).
 *
 * Note: the clone is a snapshot — if the backdrop's content changes, call
 * `destroy()` and create the lens again.
 */
export function createLiquidLens(
  frame: HTMLElement,
  backdrop: HTMLElement,
  options: LiquidLensOptions = {},
): LiquidLens {
  const doc = frame.ownerDocument;
  let settings: LiquidLensOptions & typeof DEFAULTS = { ...DEFAULTS, ...options };

  // Mark the frame so clones of the backdrop can exclude it (the frame is
  // usually a descendant of the backdrop — cloning it back into itself
  // would nest lenses indefinitely).
  frame.setAttribute(LENS_MARKER, "");

  if (getComputedStyle(frame).position === "static") {
    frame.style.position = "relative";
  }
  frame.style.overflow = "hidden";

  const glassFilter = createGlassFilter(doc);

  // Refraction layer: holds the backdrop clone and applies the filter to it.
  // The shine layer must stay outside this element so the highlight is not
  // displaced along with the backdrop pixels.
  const refraction = doc.createElement("div");
  Object.assign(refraction.style, {
    position: "absolute",
    inset: "0",
    filter: glassFilter.cssFilter,
  });

  const clone = backdrop.cloneNode(true) as HTMLElement;
  clone.setAttribute("aria-hidden", "true");
  clone.removeAttribute("id");
  clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
  clone.querySelectorAll(`[${LENS_MARKER}]`).forEach((el) => el.remove());
  Object.assign(clone.style, {
    position: "absolute",
    top: "0",
    left: "0",
    margin: "0",
    width: `${backdrop.clientWidth}px`,
    height: `${backdrop.clientHeight}px`,
    pointerEvents: "none",
  });

  refraction.appendChild(clone);
  frame.appendChild(refraction);

  // Specular rim highlight — the glossy edge light of the waterdrop look.
  const shine = doc.createElement("div");
  Object.assign(shine.style, {
    position: "absolute",
    inset: "0",
    borderRadius: "inherit",
    pointerEvents: "none",
    background: SHINE_GRADIENT,
    boxShadow: SHINE_SHADOW,
  });
  frame.appendChild(shine);

  function sync(): void {
    const frameRect = frame.getBoundingClientRect();
    const backdropRect = backdrop.getBoundingClientRect();
    const dx = frameRect.left - backdropRect.left;
    const dy = frameRect.top - backdropRect.top;
    clone.style.transform = `translate(${-dx}px, ${-dy}px)`;
  }

  function update(next: LiquidLensOptions = {}): void {
    settings = { ...settings, ...next };

    const borderRadius =
      settings.borderRadius ??
      (Number.parseFloat(getComputedStyle(frame).borderTopLeftRadius) || 0);

    glassFilter.update({
      width: frame.clientWidth,
      height: frame.clientHeight,
      borderRadius,
      depth: settings.depth,
      curvature: settings.curvature,
      splay: settings.splay,
      aberration: settings.aberration,
      blur: settings.blur,
      saturation: settings.saturation,
    });

    shine.style.display = settings.shine ? "" : "none";
    clone.style.width = `${backdrop.clientWidth}px`;
    clone.style.height = `${backdrop.clientHeight}px`;
    sync();
  }

  // Map geometry depends on the frame's size; regenerate when it changes.
  let resizeObserver: ResizeObserver | undefined;
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => update());
    resizeObserver.observe(frame);
  }

  update();

  return {
    update,
    sync,
    setIntensity: glassFilter.setIntensity,
    destroy(): void {
      resizeObserver?.disconnect();
      refraction.remove();
      shine.remove();
      glassFilter.destroy();
      frame.removeAttribute(LENS_MARKER);
    },
  };
}
