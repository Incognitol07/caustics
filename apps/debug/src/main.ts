import {
  computeDisplacementField,
  createLiquidLens,
  renderDisplacementMapToCanvas,
  renderSpecularToCanvas,
  type LiquidLens,
  type LiquidLensOptions,
} from "@glasskit/core";
import { Spring } from "./spring";

// ---------------------------------------------------------------------------
// Controls

const ids = [
  "width",
  "height",
  "borderRadius",
  "depth",
  "curvature",
  "splay",
  "aberration",
  "blur",
  "saturation",
  "lightAngle",
  "specular",
] as const;
type ControlId = (typeof ids)[number];

const inputs = Object.fromEntries(
  ids.map((id) => [id, document.getElementById(id) as HTMLInputElement]),
) as Record<ControlId, HTMLInputElement>;

const valueLabels = Object.fromEntries(
  ids.map((id) => [id, document.getElementById(`${id}-value`) as HTMLElement]),
) as Record<ControlId, HTMLElement>;

function num(id: ControlId): number {
  return Number(inputs[id].value);
}

function readOptions(): Required<LiquidLensOptions> {
  return {
    borderRadius: num("borderRadius"),
    depth: num("depth"),
    curvature: num("curvature"),
    splay: num("splay"),
    aberration: num("aberration"),
    blur: num("blur"),
    saturation: num("saturation"),
    lightAngle: num("lightAngle"),
    specular: num("specular"),
  };
}

// ---------------------------------------------------------------------------
// Elements

const mapCanvas = document.getElementById("map-preview") as HTMLCanvasElement;
const specularCanvas = document.getElementById("specular-preview") as HTMLCanvasElement;
const background = document.getElementById("background") as HTMLElement;
const lensEl = document.getElementById("lens") as HTMLElement;

let lens: LiquidLens | undefined;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ---------------------------------------------------------------------------
// Liquid motion
//
// The lens never follows the pointer directly. Its position runs through
// underdamped springs, so it lags behind the finger, overshoots, and wobbles
// to a stop. Velocity stretches it along the direction of travel, and
// pressing swells the refraction while squishing the frame. All of this is
// per-frame transform and attribute work; the displacement map itself is
// never regenerated during motion.

const target = { x: 0, y: 0 }; // drag offset from center, set by the pointer
const springX = new Spring(0, 320, 17);
const springY = new Spring(0, 320, 17);
const press = new Spring(0, 550, 20);

let dragging = false;
let rafId: number | undefined;
let lastTime = 0;

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

function applyTransform(): void {
  const left = (background.clientWidth - num("width")) / 2 + springX.value;
  const top = (background.clientHeight - num("height")) / 2 + springY.value;

  // Squash-and-stretch along the direction of travel.
  const speed = Math.hypot(springX.velocity, springY.velocity);
  const stretch = Math.min(speed * 0.00035, 0.12);
  const angle = speed > 1 ? Math.atan2(springY.velocity, springX.velocity) : 0;

  // Pressing squishes the frame slightly while the refraction swells.
  const squish = 1 - 0.05 * press.value;
  const scaleX = (1 + stretch) * squish;
  const scaleY = (1 - stretch) * squish;

  lensEl.style.transform =
    `translate(${left}px, ${top}px) ` +
    `rotate(${angle}rad) scale(${scaleX}, ${scaleY}) rotate(${-angle}rad)`;
  lens?.sync();
}

function tick(now: number): void {
  const dt = Math.min((now - lastTime) / 1000, 1 / 30);
  lastTime = now;

  springX.target = target.x;
  springY.target = target.y;

  if (reducedMotion.matches) {
    // No wobble, stretch, or swell for users who asked for less motion;
    // the lens just follows the pointer directly.
    springX.snap();
    springY.snap();
    press.snap();
  } else {
    springX.step(dt);
    springY.step(dt);
    press.step(dt);
  }

  applyTransform();
  lens?.setIntensity(1 + 0.9 * press.value);

  if (dragging || !springX.settled || !springY.settled || !press.settled) {
    rafId = requestAnimationFrame(tick);
  } else {
    rafId = undefined;
  }
}

/** Starts the animation loop if it is not already running. */
function wake(): void {
  if (rafId === undefined) {
    lastTime = performance.now();
    rafId = requestAnimationFrame(tick);
  }
}

// ---------------------------------------------------------------------------
// Slider updates

function update(): void {
  for (const id of ids) {
    valueLabels[id].textContent = inputs[id].value;
  }

  lensEl.style.width = `${num("width")}px`;
  lensEl.style.height = `${num("height")}px`;
  lensEl.style.borderRadius = `${num("borderRadius")}px`;
  applyTransform();

  const options = readOptions();
  lens?.update(options);

  // Standalone preview of the generated displacement map.
  const field = computeDisplacementField({
    width: num("width"),
    height: num("height"),
    borderRadius: options.borderRadius,
    depth: options.depth,
    curvature: options.curvature,
    splay: options.splay,
  });
  renderDisplacementMapToCanvas(mapCanvas, field, { scale: Math.max(options.depth, 1) });
  mapCanvas.style.width = `${field.width}px`;
  mapCanvas.style.height = `${field.height}px`;

  renderSpecularToCanvas(
    specularCanvas,
    {
      width: num("width"),
      height: num("height"),
      borderRadius: options.borderRadius,
      depth: options.depth,
      curvature: options.curvature,
      splay: options.splay,
    },
    { lightAngle: options.lightAngle, strength: options.specular },
  );
  specularCanvas.style.width = `${num("width")}px`;
  specularCanvas.style.height = `${num("height")}px`;
}

// ---------------------------------------------------------------------------
// Drag interaction

lensEl.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  lensEl.setPointerCapture(event.pointerId);
  lensEl.style.cursor = "grabbing";
  dragging = true;
  press.target = 1;
  wake();

  const grabX = event.clientX - target.x;
  const grabY = event.clientY - target.y;

  const onMove = (moveEvent: PointerEvent) => {
    const maxX = (background.clientWidth - num("width")) / 2;
    const maxY = (background.clientHeight - num("height")) / 2;
    target.x = clamp(moveEvent.clientX - grabX, -maxX, maxX);
    target.y = clamp(moveEvent.clientY - grabY, -maxY, maxY);
  };

  const onUp = (upEvent: PointerEvent) => {
    lensEl.releasePointerCapture(upEvent.pointerId);
    lensEl.style.cursor = "grab";
    dragging = false;
    press.target = 0;
    wake();
    lensEl.removeEventListener("pointermove", onMove);
    lensEl.removeEventListener("pointerup", onUp);
    lensEl.removeEventListener("pointercancel", onUp);
  };

  lensEl.addEventListener("pointermove", onMove);
  lensEl.addEventListener("pointerup", onUp);
  lensEl.addEventListener("pointercancel", onUp);
});

// ---------------------------------------------------------------------------
// Backdrop controls
//
// The page backdrop and the clone inside the lens both read these custom
// properties through the .backdrop class, so changing them restyles the
// refracted copy too, even though the clone is a DOM snapshot.

const BACKDROP_IMAGES: Record<string, string> = {
  stripes:
    "repeating-linear-gradient(45deg, #ff5f6d 0 20px, #ffc371 20px 40px), " +
    "repeating-linear-gradient(-45deg, transparent 0 10px, rgba(0, 0, 0, 0.15) 10px 20px)",
  river: 'url("https://picsum.photos/id/1015/960/640")',
  canyon: 'url("https://picsum.photos/id/1016/960/640")',
  mountains: 'url("https://picsum.photos/id/1018/960/640")',
  pug: 'url("https://picsum.photos/id/1025/960/640")',
};

const backdropImageSelect = document.getElementById("backdrop-image") as HTMLSelectElement;
const backdropTextInput = document.getElementById("backdrop-text") as HTMLInputElement;

backdropImageSelect.addEventListener("input", () => {
  document.documentElement.style.setProperty(
    "--backdrop-image",
    BACKDROP_IMAGES[backdropImageSelect.value],
  );
});

backdropTextInput.addEventListener("input", () => {
  // JSON.stringify produces a valid quoted CSS string for `content`.
  document.documentElement.style.setProperty(
    "--backdrop-text",
    JSON.stringify(backdropTextInput.value),
  );
});

// ---------------------------------------------------------------------------

for (const id of ids) {
  inputs[id].addEventListener("input", update);
}

// Size the frame before creating the lens so the first generated map is
// correct, then hand the visual layers over to @glasskit/core.
update();
lens = createLiquidLens(lensEl, background, readOptions());
