// grid-mouse engine, a faithful port of the "canvas-grid-mouse-effect"
// CodePen (never its code or assets; only its white corner dots are left
// out): the picture covers the viewport as the base layer, and the grid
// cells near the pointer redraw their content with the source rectangle
// shrunk toward the cell center — each cell zooms in while its footprint
// stays put, so the grid tears open along the cursor's path while every
// other cell shows the untouched picture. The pointer position is smoothed
// with exponential easing and the effect strength tracks the pointer's lag
// (≈ speed) exactly like the reference's quickTo pair: while the pointer
// rests, the strength decays to zero and the frame melts back into the
// clean picture. An unattended startup has no pointer yet, so a slow
// figure-eight tour drives the effect until the first real pointermove takes
// over. The effect runs for durationMs, then runtime.complete() hands over
// to the transition; skip() freezes the clean picture. One canvas, pointer
// listener on the stage only (ADR-003).

import type {
  AnimationController,
  AnimationRuntime,
  OpeningAnimation,
} from "../registry";

/** Time constants (seconds) of the two exponential easings: position trails
 * the target tightly (the reference's 1 s expo quickTo), strength trails it
 * slowly (the reference's 2 s power2 quickTo). */
const POS_TAU_S = 0.15;
const STRENGTH_TAU_S = 1.1;
/** The reference's initial m.s, and the multiplier turning the pointer's lag
 * (as a fraction of the viewport width) into the strength target — the
 * reference's sTo(d/cw*2). There is no strength floor: a resting pointer
 * decays to zero and the full picture shows. */
const INITIAL_STRENGTH = 1.5;
const LAG_STRENGTH_GAIN = 2;
const RESIZE_DEBOUNCE_MS = 200;

export class GridMouseEngine implements AnimationController {
  private readonly runtime: AnimationRuntime;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly img = new Image();
  private readonly cellSize: number;
  private readonly durationMs: number;

  private vw = 0;
  private vh = 0;
  private dpr = 1;
  /** Cover fit: the scale and the (non-positive) picture offsets. */
  private fitScale = 1;
  private fitOx = 0;
  private fitOy = 0;

  /** Raw pointer target (real pointer or the auto tour) and the eased
   * position; the effect radius is strength × viewport width. */
  private target = { x: 0, y: 0 };
  private smooth = { x: 0, y: 0 };
  private strength: number;
  private tour = true;
  private rafId = 0;
  private lastFrameAt = 0;
  private completeTimer = 0;
  private resizeTimer = 0;
  private completed = false;
  private destroyed = false;

  private readonly onImgLoad = (): void => {
    if (this.destroyed) return;
    this.runtime.markLoaded?.();
    if (this.ctx === null) {
      this.markCompleted();
      return;
    }
    this.buildLayout();
    this.drawClean();
    // Playback length runs from the first visible frame, like code-rain.
    this.completeTimer = window.setTimeout(() => this.markCompleted(), this.durationMs);
    this.lastFrameAt = 0;
    this.rafId = requestAnimationFrame(this.frame);
  };

  private readonly onImgError = (): void => {
    if (!this.destroyed && !this.completed) this.runtime.fail(new Error("opening image failed to load"));
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.destroyed) return;
    const rect = this.canvas.getBoundingClientRect();
    this.target.x = event.clientX - rect.left;
    this.target.y = event.clientY - rect.top;
    this.tour = false;
  };

  private readonly onResize = (): void => {
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => {
      if (this.destroyed || this.completed) return;
      if (!(this.img.complete && this.img.naturalWidth > 0)) return;
      this.buildLayout();
      this.drawClean();
    }, RESIZE_DEBOUNCE_MS);
  };

  constructor(runtime: AnimationRuntime) {
    this.runtime = runtime;
    const p = runtime.params;
    this.cellSize = GridMouseEngine.number(p.cellSize, 85);
    this.durationMs = GridMouseEngine.number(p.durationMs, 8000);
    this.strength = INITIAL_STRENGTH;

    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
    runtime.container.append(this.canvas);
    this.img.addEventListener("load", this.onImgLoad);
    this.img.addEventListener("error", this.onImgError);
    runtime.container.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("resize", this.onResize);
  }

  start(): void {
    this.img.src = this.runtime.media.url;
  }

  skip(): void {
    if (this.destroyed || this.completed) return;
    window.clearTimeout(this.completeTimer);
    this.cancelRaf();
    if (this.imageReady()) this.drawClean();
    this.markCompleted();
  }

  destroy(): void {
    this.destroyed = true;
    window.clearTimeout(this.completeTimer);
    window.clearTimeout(this.resizeTimer);
    this.cancelRaf();
    this.img.removeEventListener("load", this.onImgLoad);
    this.img.removeEventListener("error", this.onImgError);
    this.runtime.container.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.remove();
  }

  private markCompleted(): void {
    if (this.completed) return;
    this.completed = true;
    this.runtime.complete();
  }

  private imageReady(): boolean {
    return this.img.complete && this.img.naturalWidth > 0;
  }

  private cancelRaf(): void {
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  /* Picture cover-fitted to the viewport; the tour resets to the center so a
     resize mid-run does not leave the eased pointer stranded off-screen. */
  private buildLayout(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.vw = this.runtime.container.clientWidth || window.innerWidth;
    this.vh = this.runtime.container.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(this.vw * this.dpr);
    this.canvas.height = Math.round(this.vh * this.dpr);
    this.ctx?.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.fitScale = Math.max(this.vw / this.img.naturalWidth, this.vh / this.img.naturalHeight);
    this.fitOx = (this.vw - this.img.naturalWidth * this.fitScale) / 2;
    this.fitOy = (this.vh - this.img.naturalHeight * this.fitScale) / 2;
    if (this.tour) {
      this.smooth.x = this.vw / 2;
      this.smooth.y = this.vh / 2;
      this.target.x = this.smooth.x;
      this.target.y = this.smooth.y;
    }
  }

  /** The untouched cover picture: the base layer and the skip() final frame. */
  private drawClean(): void {
    const ctx = this.ctx;
    if (ctx === null) return;
    ctx.clearRect(0, 0, this.vw, this.vh);
    ctx.drawImage(
      this.img,
      this.fitOx, this.fitOy,
      this.img.naturalWidth * this.fitScale, this.img.naturalHeight * this.fitScale,
    );
  }

  private readonly frame = (now: number): void => {
    if (this.destroyed || this.completed) return;
    const dt = this.lastFrameAt === 0 ? 1 / 60 : Math.min(0.05, (now - this.lastFrameAt) / 1000);
    this.lastFrameAt = now;

    if (this.tour) {
      // Slow figure-eight with incommensurate frequencies, so the loop never
      // looks like a traced ellipse. The first real pointermove ends it.
      const t = now / 1000;
      this.target.x = this.vw * (0.5 + 0.32 * Math.sin(t * 0.9));
      this.target.y = this.vh * (0.5 + 0.3 * Math.sin(t * 1.4 + Math.PI / 3));
    }

    // Exponential ease toward the target (the reference's expo quickTo)…
    const kp = 1 - Math.exp(-dt / POS_TAU_S);
    this.smooth.x += (this.target.x - this.smooth.x) * kp;
    this.smooth.y += (this.target.y - this.smooth.y) * kp;
    // …and the remaining lag (≈ speed) IS the strength target, eased slowly
    // like the reference's 2 s power2 quickTo: a pointer at rest decays the
    // strength to zero, leaving the untouched picture everywhere.
    const lag = Math.hypot(this.target.x - this.smooth.x, this.target.y - this.smooth.y);
    const strengthTarget = (lag / Math.max(this.vw, 1)) * LAG_STRENGTH_GAIN;
    this.strength += (strengthTarget - this.strength) * (1 - Math.exp(-dt / STRENGTH_TAU_S));

    this.drawFrame();
    this.rafId = requestAnimationFrame(this.frame);
  };

  /** The reference's update() every tick: the clean cover picture first, then
   * every cell inside the effect radius redraws its content zoomed in (the
   * source rectangle shrinks toward the cell center while the destination
   * stays put). Cells the pointer has left fall back to the base picture at
   * once, and a fully decayed strength leaves nothing but that picture. */
  private drawFrame(): void {
    const ctx = this.ctx;
    if (ctx === null) return;
    ctx.clearRect(0, 0, this.vw, this.vh);
    this.drawClean();
    const reach = this.strength * Math.max(this.vw, 1);
    if (reach < 0.5) return;
    const half = this.cellSize / 2;
    const col0 = Math.max(0, Math.floor((this.smooth.x - reach) / this.cellSize));
    const col1 = Math.min(Math.ceil(this.vw / this.cellSize) - 1, Math.ceil((this.smooth.x + reach) / this.cellSize));
    const row0 = Math.max(0, Math.floor((this.smooth.y - reach) / this.cellSize));
    const row1 = Math.min(Math.ceil(this.vh / this.cellSize) - 1, Math.ceil((this.smooth.y + reach) / this.cellSize));

    const maxSx = Math.max(0, this.img.naturalWidth - 1);
    const maxSy = Math.max(0, this.img.naturalHeight - 1);
    for (let row = row0; row <= row1; row++) {
      for (let col = col0; col <= col1; col++) {
        const dx = col * this.cellSize;
        const dy = row * this.cellSize;
        const d = Math.hypot(dx + half - this.smooth.x, dy + half - this.smooth.y);
        const s = 1 - Math.min(Math.max(d / reach, 0), 1);
        if (s < 0.001) continue;
        const inset = (this.cellSize * s) / 2;
        const sw = Math.max((this.cellSize - 2 * inset) / this.fitScale, 1e-3);
        const sh = Math.max((this.cellSize - 2 * inset) / this.fitScale, 1e-3);
        const sx = Math.min(Math.max((dx + inset - this.fitOx) / this.fitScale, 0), maxSx - sw + 1e-3);
        const sy = Math.min(Math.max((dy + inset - this.fitOy) / this.fitScale, 0), maxSy - sh + 1e-3);
        ctx.drawImage(this.img, Math.max(sx, 0), Math.max(sy, 0), sw, sh, dx, dy, this.cellSize, this.cellSize);
      }
    }
  }

  private static number(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }
}

export const gridMouseAnimation: OpeningAnimation = {
  id: "grid-mouse",
  kind: "image",
  labelKey: "anim.grid-mouse.label",
  descriptionKey: "anim.grid-mouse.desc",
  paramsSchema: {
    cellSize: { type: "number", default: 85, min: 24, max: 200, step: 1 },
    durationMs: { type: "number", default: 8000, min: 3000, max: 60000, step: 500 },
  },
  create: (runtime) => new GridMouseEngine(runtime),
};
