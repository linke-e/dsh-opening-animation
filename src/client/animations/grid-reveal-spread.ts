// grid-reveal-spread engine, ported from web/opening-2.html.
// Idle: the cell under the pointer glows (hover preview kept). After
// autoStartDelayMs the picture spreads out from the viewport center at a
// constant wavefront speed — the auto-start replaces the page's
// click-to-spread, so in the overlay a click always means "skip" (owned by
// the OverlayRunner). finishAll() backs skip(); spread completion calls
// runtime.complete(). Replay interaction and hints are gone; reduced-motion
// renders the full picture immediately.

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
}

interface SpreadItem {
  cell: Cell;
  minD: number;
  maxD: number;
  proj: number;
  sx: number;
  sy: number;
  ex: number;
  ey: number;
}

const clamp01 = (v: number): number => Math.min(Math.max(v, 0), 1);

export class GridRevealSpreadEngine implements AnimationController {
  private readonly runtime: AnimationRuntime;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly img = new Image();
  private readonly cellSize: number;
  private readonly spreadSpeed: number;
  private readonly feather: number;
  private readonly hoverIn: number;
  private readonly hoverOut: number;
  private readonly autoStartDelayMs: number;
  private readonly bg: string;

  private vw = 0;
  private vh = 0;
  private dpr = 1;
  private scaleCache = 1;
  private ox = 0;
  private oy = 0;
  private cols = 0;
  private rows = 0;
  private cells: Cell[] = [];
  private imgLayer!: HTMLCanvasElement;
  private mask!: HTMLCanvasElement;
  private maskCtx!: CanvasRenderingContext2D;
  private tmp!: HTMLCanvasElement;
  private tmpCtx!: CanvasRenderingContext2D;
  private lit!: HTMLCanvasElement;
  private litCtx!: CanvasRenderingContext2D;
  private state: "idle" | "spreading" | "done" = "idle";
  private hover: { col: number; row: number; a: number; want: boolean } | null = null;
  private spread: { t0: number; items: SpreadItem[]; ptr: number; active: SpreadItem[] } | null = null;
  private rafId = 0;
  private lastNow = 0;
  private resizeTimer = 0;
  private autoStartTimer = 0;
  private completed = false;
  private destroyed = false;

  private readonly onImgLoad = (): void => {
    if (this.destroyed) return;
    this.buildLayout();
    if (this.runtime.reducedMotion) {
      this.finishAll();
      this.markCompleted();
      return;
    }
    this.state = "idle";
    this.lastNow = 0;
    this.rafId = requestAnimationFrame(this.loop);
    this.autoStartTimer = window.setTimeout(() => {
      if (!this.destroyed && this.state === "idle") this.startSpread(this.vw / 2, this.vh / 2);
    }, this.autoStartDelayMs);
  };

  private readonly onImgError = (): void => {
    if (!this.destroyed && !this.completed) this.runtime.fail(new Error("opening image failed to load"));
  };

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (this.state !== "idle" || this.destroyed) return;
    const pos = this.cellAt(event.clientX, event.clientY);
    if (pos === null) {
      if (this.hover !== null) this.hover.want = false;
      return;
    }
    if (this.hover !== null && this.hover.col === pos.col && this.hover.row === pos.row) {
      this.hover.want = true;
      return;
    }
    this.hover = { col: pos.col, row: pos.row, a: this.hover !== null ? this.hover.a : 0, want: true };
  };

  private readonly onMouseLeave = (): void => {
    if (this.hover !== null) this.hover.want = false;
  };

  private readonly onResize = (): void => {
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => {
      if (this.destroyed) return;
      const wasIdle = this.state === "idle";
      this.buildLayout();
      if (wasIdle) {
        this.hover = null;
      } else {
        this.finishAll();
      }
    }, 200);
  };

  constructor(runtime: AnimationRuntime) {
    this.runtime = runtime;
    const p = runtime.params;
    this.cellSize = GridRevealSpreadEngine.number(p.cellSize, 36);
    this.spreadSpeed = GridRevealSpreadEngine.number(p.spreadSpeed, 450);
    this.feather = GridRevealSpreadEngine.number(p.feather, 0.6);
    this.hoverIn = GridRevealSpreadEngine.number(p.hoverIn, 140);
    this.hoverOut = GridRevealSpreadEngine.number(p.hoverOut, 320);
    this.autoStartDelayMs = GridRevealSpreadEngine.number(p.autoStartDelayMs, 900);
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
    runtime.container.addEventListener("mousemove", this.onMouseMove);
    runtime.container.addEventListener("mouseleave", this.onMouseLeave);
    window.addEventListener("resize", this.onResize);
  }

  start(): void {
    this.img.src = this.runtime.media.url;
  }

  skip(): void {
    if (this.destroyed || this.completed) return;
    window.clearTimeout(this.autoStartTimer);
    this.cancelRaf();
    if (this.imageReady()) this.finishAll();
    this.markCompleted();
  }

  destroy(): void {
    this.destroyed = true;
    window.clearTimeout(this.autoStartTimer);
    window.clearTimeout(this.resizeTimer);
    this.cancelRaf();
    this.img.removeEventListener("load", this.onImgLoad);
    this.img.removeEventListener("error", this.onImgError);
    this.runtime.container.removeEventListener("mousemove", this.onMouseMove);
    this.runtime.container.removeEventListener("mouseleave", this.onMouseLeave);
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

  private mkLayer(): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    return c;
  }

  private buildLayout(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.vw = this.runtime.container.clientWidth || window.innerWidth;
    this.vh = this.runtime.container.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(this.vw * this.dpr);
    this.canvas.height = Math.round(this.vh * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.scaleCache = Math.max(this.vw / this.img.naturalWidth, this.vh / this.img.naturalHeight);
    const dw = this.img.naturalWidth * this.scaleCache;
    const dh = this.img.naturalHeight * this.scaleCache;
    this.ox = (this.vw - dw) / 2;
    this.oy = (this.vh - dh) / 2;
    this.cols = Math.ceil(dw / this.cellSize);
    this.rows = Math.ceil(dh / this.cellSize);

    const cells: Cell[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const dx = this.ox + c * this.cellSize;
        const dy = this.oy + r * this.cellSize;
        if (dx >= this.vw || dy >= this.vh) continue;
        const sx = (dx - this.ox) / this.scaleCache;
        const sy = (dy - this.oy) / this.scaleCache;
        const sw = Math.min(this.cellSize / this.scaleCache, this.img.naturalWidth - sx);
        const sh = Math.min(this.cellSize / this.scaleCache, this.img.naturalHeight - sy);
        if (sw <= 0 || sh <= 0) continue;
        cells.push({ dx, dy, sx, sy, sw, sh });
      }
    }
    this.cells = cells;

    this.imgLayer = this.mkLayer();
    this.imgLayer.getContext("2d")?.drawImage(
      this.img, 0, 0, this.img.naturalWidth, this.img.naturalHeight,
      this.ox * this.dpr, this.oy * this.dpr, dw * this.dpr, dh * this.dpr,
    );
    this.mask = this.mkLayer();
    this.maskCtx = this.mask.getContext("2d") as CanvasRenderingContext2D;
    this.tmp = this.mkLayer();
    this.tmpCtx = this.tmp.getContext("2d") as CanvasRenderingContext2D;
    this.lit = this.mkLayer();
    this.litCtx = this.lit.getContext("2d") as CanvasRenderingContext2D;
  }

  private cellAt(x: number, y: number): { col: number; row: number } | null {
    const col = Math.min(Math.max(Math.floor((x - this.ox) / this.cellSize), 0), this.cols - 1);
    const row = Math.min(Math.max(Math.floor((y - this.oy) / this.cellSize), 0), this.rows - 1);
    return this.cols > 0 && this.rows > 0 ? { col, row } : null;
  }

  private drawLit(cell: Cell): void {
    this.litCtx.drawImage(
      this.img,
      cell.sx, cell.sy, cell.sw, cell.sh,
      cell.dx * this.dpr, cell.dy * this.dpr, cell.sw * this.scaleCache * this.dpr, cell.sh * this.scaleCache * this.dpr,
    );
  }

  /* tmp = picture layer × brightness mask */
  private composite(): void {
    this.tmpCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.tmpCtx.globalCompositeOperation = "source-over";
    this.tmpCtx.clearRect(0, 0, this.tmp.width, this.tmp.height);
    this.tmpCtx.drawImage(this.imgLayer, 0, 0);
    this.tmpCtx.globalCompositeOperation = "destination-in";
    this.tmpCtx.drawImage(this.mask, 0, 0);
    this.tmpCtx.globalCompositeOperation = "source-over";
  }

  /* main canvas = backdrop + fully lit cache + in-progress region */
  private render(): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = this.bg;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.lit, 0, 0);
    this.ctx.drawImage(this.tmp, 0, 0);
  }

  private frameIdle(dt: number): void {
    if (this.hover !== null) {
      if (this.hover.want) {
        this.hover.a = Math.min(1, this.hover.a + (dt * 1000) / this.hoverIn);
      } else {
        this.hover.a -= (dt * 1000) / this.hoverOut;
        if (this.hover.a <= 0) this.hover = null;
      }
    }
    this.maskCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.maskCtx.clearRect(0, 0, this.mask.width, this.mask.height);
    if (this.hover !== null && this.hover.a > 0.004) {
      this.maskCtx.fillStyle = `rgba(255,255,255,${this.hover.a.toFixed(3)})`;
      this.maskCtx.fillRect(
        (this.ox + this.hover.col * this.cellSize) * this.dpr,
        (this.oy + this.hover.row * this.cellSize) * this.dpr,
        this.cellSize * this.dpr,
        this.cellSize * this.dpr,
      );
    }
    this.composite();
    this.render();
  }

  /* Spread from the given point at constant wavefront speed. */
  private startSpread(x: number, y: number): void {
    const pos = this.cellAt(x, y);
    if (pos === null) return;
    const hw = this.cellSize / 2;
    const cx = this.ox + (pos.col + 0.5) * this.cellSize;
    const cy = this.oy + (pos.row + 0.5) * this.cellSize;
    const items = this.cells.map((c) => {
      const ccx = c.dx + hw;
      const ccy = c.dy + hw;
      const vx = ccx - cx;
      const vy = ccy - cy;
      const dist = Math.hypot(vx, vy);
      const iux = dist < 1e-6 ? 1 : vx / dist;
      const iuy = dist < 1e-6 ? 0 : vy / dist;
      const proj = Math.abs(iux) * hw + Math.abs(iuy) * hw;
      return {
        cell: c,
        minD: dist - proj,
        maxD: dist + proj,
        proj,
        sx: ccx - iux * proj,
        sy: ccy - iuy * proj,
        ex: ccx + iux * proj,
        ey: ccy + iuy * proj,
      };
    });
    items.sort((a, b) => a.minD - b.minD);
    this.spread = { t0: performance.now(), items, ptr: 0, active: [] };
    this.hover = null;
    this.state = "spreading";
  }

  /* In-cell linear gradient: wavefront at xn∈[0,1+], alpha from center side (1) to far side (0). */
  private cellGradient(it: SpreadItem, xn: number): CanvasGradient {
    const tail = this.feather;
    const a0 = clamp01(xn / tail);
    const xA = Math.max(0, xn - tail);
    const xB = Math.min(1, xn);
    const g = this.maskCtx.createLinearGradient(it.sx * this.dpr, it.sy * this.dpr, it.ex * this.dpr, it.ey * this.dpr);
    if (xB > xA + 1e-6) {
      g.addColorStop(0, `rgba(255,255,255,${a0.toFixed(3)})`);
      if (xA > 1e-6) g.addColorStop(xA, "rgba(255,255,255,1)");
      g.addColorStop(xB, "rgba(255,255,255,0)");
      if (xB < 1 - 1e-6) g.addColorStop(1, "rgba(255,255,255,0)");
    } else {
      g.addColorStop(0, `rgba(255,255,255,${a0.toFixed(3)})`);
      g.addColorStop(1, `rgba(255,255,255,${a0.toFixed(3)})`);
    }
    return g;
  }

  private frameSpread(now: number): void {
    const spread = this.spread;
    if (spread === null) return;
    const r = (this.spreadSpeed * (now - spread.t0)) / 1000;
    const items = spread.items;
    while (spread.ptr < items.length && (items[spread.ptr] as SpreadItem).minD <= r) {
      spread.active.push(items[spread.ptr++] as SpreadItem);
    }

    this.maskCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.maskCtx.clearRect(0, 0, this.mask.width, this.mask.height);
    const still: SpreadItem[] = [];
    for (const it of spread.active) {
      if (r >= it.maxD) {
        this.drawLit(it.cell);
        continue;
      }
      const span = it.proj * 2;
      const xn = span > 0 ? (r - it.minD) / span : 1;
      this.maskCtx.fillStyle = this.cellGradient(it, xn);
      this.maskCtx.fillRect(it.cell.dx * this.dpr, it.cell.dy * this.dpr, this.cellSize * this.dpr, this.cellSize * this.dpr);
      still.push(it);
    }
    spread.active = still;

    this.composite();
    this.render();

    if (spread.active.length === 0 && spread.ptr >= items.length) {
      this.state = "done";
      this.spread = null;
      this.cancelRaf();
      this.markCompleted();
    }
  }

  /* Light every cell immediately (skip). */
  private finishAll(): void {
    this.cancelRaf();
    this.state = "done";
    this.spread = null;
    this.hover = null;
    if (this.litCtx !== undefined) {
      for (const c of this.cells) this.drawLit(c);
      this.maskCtx.setTransform(1, 0, 0, 1, 0, 0);
      this.maskCtx.clearRect(0, 0, this.mask.width, this.mask.height);
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.fillStyle = this.bg;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(this.lit, 0, 0);
    }
  }

  private readonly loop = (now: number): void => {
    if (this.destroyed || this.completed) return;
    const dt = this.lastNow !== 0 ? Math.min(50, now - this.lastNow) : 16;
    this.lastNow = now;
    if (this.state === "idle") this.frameIdle(dt);
    else if (this.state === "spreading") this.frameSpread(now);
    if (this.state !== "done") this.rafId = requestAnimationFrame(this.loop);
  };

  private static number(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }
}

export const gridRevealSpreadAnimation: OpeningAnimation = {
  id: "grid-reveal-spread",
  kind: "image",
  labelKey: "anim.grid-reveal-spread.label",
  descriptionKey: "anim.grid-reveal-spread.desc",
  paramsSchema: {
    cellSize: { type: "number", default: 36, min: 12, max: 120, step: 2 },
    spreadSpeed: { type: "number", default: 450, min: 60, max: 3000, step: 10 },
    feather: { type: "number", default: 0.6, min: 0.1, max: 1, step: 0.05 },
    hoverIn: { type: "number", default: 140, min: 20, max: 1000, step: 10 },
    hoverOut: { type: "number", default: 320, min: 20, max: 2000, step: 10 },
    autoStartDelayMs: { type: "number", default: 900, min: 0, max: 10000, step: 100 },
    bg: { type: "enum", default: "#04050e", options: ["#04050e", "#000000", "#101020"] },
  },
  create: (runtime) => new GridRevealSpreadEngine(runtime),
};
