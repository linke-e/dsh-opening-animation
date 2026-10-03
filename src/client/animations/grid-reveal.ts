// grid-reveal engine, ported from web/opening.html.
// Grid cells light up in exponentially growing waves (n, 2n, 4n, ...) over a
// dark backdrop until the full picture is visible. Deviations from the page:
// completion calls runtime.complete(), showFull() backs skip(), the replay
// interaction and the inline error overlay are gone (error → runtime.fail),
// and reduced-motion comes in through the runtime.

import type {
  AnimationController,
  AnimationRuntime,
  OpeningAnimation,
} from "../registry";

interface Cell {
  dx: number;
  dy: number;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  wave: number;
  delay: number;
  dur: number;
}

const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const rand = (a: number, b: number): number => a + Math.random() * (b - a);

export class GridRevealEngine implements AnimationController {
  private readonly runtime: AnimationRuntime;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly img = new Image();
  private readonly cellSize: number;
  private readonly firstWave: number;
  private readonly waveDur: number;
  private readonly overlap: number;
  private readonly stagger: number;
  private readonly bg: string;

  private vw = 0;
  private vh = 0;
  private dpr = 1;
  private scaleCache = 1;
  private cells: Cell[] = [];
  private active: Cell[] = [];
  private lit: HTMLCanvasElement | null = null;
  private startTime = 0;
  private finished = false;
  private completed = false;
  private destroyed = false;
  private rafId = 0;
  private resizeTimer = 0;

  private readonly onImgLoad = (): void => {
    if (this.destroyed) return;
    if (this.runtime.reducedMotion) {
      this.showFull();
      this.markCompleted();
    } else {
      this.beginRun();
    }
  };

  private readonly onImgError = (): void => {
    if (!this.destroyed && !this.completed) this.runtime.fail(new Error("opening image failed to load"));
  };

  private readonly onResize = (): void => {
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => {
      if (this.destroyed) return;
      if (this.finished) this.showFull();
      else this.beginRun();
    }, 200);
  };

  constructor(runtime: AnimationRuntime) {
    this.runtime = runtime;
    const p = runtime.params;
    this.cellSize = GridRevealEngine.number(p.cellSize, 36);
    this.firstWave = GridRevealEngine.number(p.firstWave, 14);
    this.waveDur = GridRevealEngine.number(p.waveDur, 700);
    this.overlap = GridRevealEngine.number(p.overlap, 0.18);
    this.stagger = GridRevealEngine.number(p.stagger, 0.38);
    this.bg = typeof p.bg === "string" && p.bg.length > 0 ? p.bg : "#04050e";

    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;
    runtime.container.append(this.canvas);
    const crt = document.createElement("div");
    crt.className = "dsh-opening-crt";
    const vignette = document.createElement("div");
    vignette.className = "dsh-opening-vignette";
    runtime.container.append(crt, vignette);

    this.img.addEventListener("load", this.onImgLoad);
    this.img.addEventListener("error", this.onImgError);
    window.addEventListener("resize", this.onResize);
  }

  start(): void {
    this.img.src = this.runtime.media.url;
  }

  skip(): void {
    if (this.destroyed || this.completed) return;
    this.cancelRaf();
    if (this.imageReady()) this.showFull();
    this.markCompleted();
  }

  destroy(): void {
    this.destroyed = true;
    this.cancelRaf();
    window.clearTimeout(this.resizeTimer);
    this.img.removeEventListener("load", this.onImgLoad);
    this.img.removeEventListener("error", this.onImgError);
    this.canvas.remove();
    this.runtime.container.querySelectorAll(".dsh-opening-crt, .dsh-opening-vignette").forEach((el) => el.remove());
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

  /* Picture cover-fitted to the viewport; grid cells in picture coordinates. */
  private buildLayout(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.vw = this.runtime.container.clientWidth || window.innerWidth;
    this.vh = this.runtime.container.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(this.vw * this.dpr);
    this.canvas.height = Math.round(this.vh * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.scaleCache = Math.max(this.vw / this.img.naturalWidth, this.vh / this.img.naturalHeight);
    const scale = this.scaleCache;
    const dw = this.img.naturalWidth * scale;
    const dh = this.img.naturalHeight * scale;
    const ox = (this.vw - dw) / 2;
    const oy = (this.vh - dh) / 2;

    const cells: Cell[] = [];
    const cols = Math.ceil(dw / this.cellSize);
    const rows = Math.ceil(dh / this.cellSize);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const dx = ox + c * this.cellSize;
        const dy = oy + r * this.cellSize;
        if (dx >= this.vw || dy >= this.vh) continue;
        const sx = (dx - ox) / scale;
        const sy = (dy - oy) / scale;
        const sw = Math.min(this.cellSize / scale, this.img.naturalWidth - sx);
        const sh = Math.min(this.cellSize / scale, this.img.naturalHeight - sy);
        if (sw <= 0 || sh <= 0) continue;
        cells.push({ dx, dy, sx, sy, sw, sh, wave: 0, delay: 0, dur: 0 });
      }
    }
    this.cells = cells;
  }

  /* Shuffle, then hand out exponential waves: n, 2n, 4n...; the last wave lights all remaining cells. */
  private assignWaves(): void {
    const order = this.cells.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [order[i], order[j]] = [order[j] as Cell, order[i] as Cell];
    }
    let size = Math.min(this.firstWave, order.length);
    let wave = 0;
    let idx = 0;
    while (idx < order.length) {
      const end = Math.min(order.length, idx + size);
      for (; idx < end; idx++) {
        const cell = order[idx] as Cell;
        cell.wave = wave;
        cell.delay = rand(0, this.stagger) * this.waveDur;
        cell.dur = this.waveDur * rand(0.62, 1.0);
      }
      size *= 2;
      wave++;
    }
  }

  private cellBrightness(cell: Cell, t: number): number {
    const start = cell.wave * this.waveDur * (1 - this.overlap) + cell.delay;
    return Math.min(Math.max((t - start) / cell.dur, 0), 1);
  }

  private drawCell(targetCtx: CanvasRenderingContext2D, cell: Cell, alpha: number): void {
    targetCtx.globalAlpha = alpha;
    targetCtx.drawImage(
      this.img,
      cell.sx, cell.sy, cell.sw, cell.sh,
      cell.dx * this.dpr, cell.dy * this.dpr, cell.sw * this.scaleCache * this.dpr, cell.sh * this.scaleCache * this.dpr,
    );
    targetCtx.globalAlpha = 1;
  }

  private readonly frame = (now: number): void => {
    if (this.destroyed || this.completed) return;
    if (this.cells.length === 0) return;
    const ctx = this.ctx;
    const t = now - this.startTime;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = this.bg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.lit !== null) ctx.drawImage(this.lit, 0, 0);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const litCtx = (this.lit as HTMLCanvasElement).getContext("2d") as CanvasRenderingContext2D;
    litCtx.setTransform(1, 0, 0, 1, 0, 0);
    const still: Cell[] = [];
    for (const cell of this.active) {
      const b = this.cellBrightness(cell, t);
      if (b >= 1) {
        this.drawCell(litCtx, cell, 1); // fully lit → cached, never redrawn per-frame again
      } else {
        this.drawCell(ctx, cell, easeInOutCubic(b));
        still.push(cell);
      }
    }
    this.active = still;

    if (this.active.length === 0) {
      // The last batch landed in the lit cache only; repaint from the full cache before freezing.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = this.bg;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.drawImage(this.lit as HTMLCanvasElement, 0, 0);
      this.finished = true;
      this.markCompleted();
      return;
    }
    this.rafId = requestAnimationFrame(this.frame);
  };

  private beginRun(): void {
    this.cancelRaf();
    this.buildLayout();
    this.assignWaves();
    this.lit = document.createElement("canvas");
    this.lit.width = this.canvas.width;
    this.lit.height = this.canvas.height;
    this.active = this.cells.slice();
    this.finished = false;
    this.startTime = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  /* Freeze on the complete picture (skip / reduced motion). */
  private showFull(): void {
    if (!this.imageReady()) return;
    this.cancelRaf();
    this.buildLayout();
    this.lit = document.createElement("canvas");
    this.lit.width = this.canvas.width;
    this.lit.height = this.canvas.height;
    const litCtx = this.lit.getContext("2d") as CanvasRenderingContext2D;
    litCtx.setTransform(1, 0, 0, 1, 0, 0);
    litCtx.drawImage(
      this.img,
      0, 0, this.img.naturalWidth, this.img.naturalHeight,
      ((this.vw - this.img.naturalWidth * this.scaleCache) / 2) * this.dpr,
      ((this.vh - this.img.naturalHeight * this.scaleCache) / 2) * this.dpr,
      this.img.naturalWidth * this.scaleCache * this.dpr,
      this.img.naturalHeight * this.scaleCache * this.dpr,
    );
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = this.bg;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.lit, 0, 0);
    this.active = [];
    this.finished = true;
  }

  private static number(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }
}

export const gridRevealAnimation: OpeningAnimation = {
  id: "grid-reveal",
  kind: "image",
  labelKey: "anim.grid-reveal.label",
  descriptionKey: "anim.grid-reveal.desc",
  paramsSchema: {
    cellSize: { type: "number", default: 36, min: 12, max: 120, step: 2 },
    firstWave: { type: "number", default: 14, min: 1, max: 200, step: 1 },
    waveDur: { type: "number", default: 700, min: 100, max: 3000, step: 50 },
    overlap: { type: "number", default: 0.18, min: 0, max: 0.9, step: 0.02 },
    stagger: { type: "number", default: 0.38, min: 0, max: 1, step: 0.02 },
    bg: { type: "enum", default: "#04050e", options: ["#04050e", "#000000", "#101020"] },
  },
  create: (runtime) => new GridRevealEngine(runtime),
};
