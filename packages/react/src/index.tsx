import {
  createLiquidLens,
  type LiquidLens as LiquidLensHandle,
  type LiquidLensOptions,
} from "@glasskit/core";
import {
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";

export type { LiquidLensHandle, LiquidLensOptions };

/**
 * Attaches a liquid glass lens to `frameRef`, refracting the content of
 * `backdropRef`. The lens is created on mount and destroyed on unmount;
 * option changes are applied through the lens's cheap update path.
 *
 * Returns a ref to the lens handle for imperative per-frame calls
 * (`sync()` after moving the frame, `setIntensity()` for press feedback).
 */
export function useLiquidLens(
  frameRef: RefObject<HTMLElement | null>,
  backdropRef: RefObject<HTMLElement | null>,
  options: LiquidLensOptions = {},
): RefObject<LiquidLensHandle | null> {
  const lensRef = useRef<LiquidLensHandle | null>(null);

  // Keep the latest options available to the mount effect without
  // recreating the lens when they change.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const frame = frameRef.current;
    const backdrop = backdropRef.current;
    if (!frame || !backdrop) {
      return;
    }

    const lens = createLiquidLens(frame, backdrop, optionsRef.current);
    lensRef.current = lens;

    return () => {
      lens.destroy();
      lensRef.current = null;
    };
  }, [frameRef, backdropRef]);

  useEffect(() => {
    lensRef.current?.update(optionsRef.current);
  }, [
    options.depth,
    options.curvature,
    options.splay,
    options.aberration,
    options.blur,
    options.saturation,
    options.borderRadius,
    options.shine,
  ]);

  return lensRef;
}

export interface LiquidLensProps extends LiquidLensOptions {
  /** Ref to the element behind the lens whose content gets refracted. */
  backdropRef: RefObject<HTMLElement | null>;
  className?: string;
  style?: CSSProperties;
  /** Rendered above the glass layers (e.g. a button label). */
  children?: ReactNode;
}

/**
 * A div that becomes a liquid glass lens over the element in `backdropRef`.
 * Position and size it like any other element (it must visually overlap the
 * backdrop); pass lens options as props.
 */
export function LiquidLens({
  backdropRef,
  className,
  style,
  children,
  ...options
}: LiquidLensProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  useLiquidLens(frameRef, backdropRef, options);

  return (
    <div ref={frameRef} className={className} style={style}>
      {children != null && (
        <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
      )}
    </div>
  );
}
