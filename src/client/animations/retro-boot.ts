// retro-boot engine: a ten-second retro pixel boot sequence designed on a
// 1920x1080 stage and letterboxed into the viewport. The uploaded picture
// dims in as the opening backdrop while the whale logo (embedded asset, keyed
// at generation time) glows awake; #5B6EE8 pixel blocks then devour the screen
// from the edges toward the center (seeded block growth, staircase edges),
// a green nested-rectangle tunnel expands outward, the screen settles on pure
// blue-violet with the whale+wordmark logo breathing under a white glow, a
// cross/box halftone grid sweeps in from the top-right and dissolves into
// red/magenta/purple, and the run freezes on black with two dark-red grid
// sheets. Timeline (ms): 0-1500 logo awake, 1500-4000 devour, 2500-5000
// tunnel, 4900-7000 solid + logo swap, 7000-9000 halftone sweep and shrink,
// 9000-10000 final freeze (the overlay's transition then fades the UI in).
// Asset roles follow actual image content, not the task labels: logo1 is the
// bare whale (opening), logo2 is whale+wordmark (mid-run freeze).
// Deviations from the page: completion calls runtime.complete() at the 10s
// freeze, skip()/reduced-motion render the final frame, the backdrop picture
// failing to load degrades to black instead of failing the run.

import type {
  AnimationController,
  AnimationRuntime,
  OpeningAnimation,
} from "../registry";
import { RETRO_BOOT_LOGO1, RETRO_BOOT_LOGO2 } from "./retro-boot-assets";

export const DESIGN_W = 1920;
export const DESIGN_H = 1080;

/** Storyboard boundaries in ms at the 10s design length (shared shape with
 * docs/retro-boot.html); `buildRetroTimeline` scales every boundary for a
 * custom duration. */
export interface RetroTimeline {
  logoIn: number;
  devourStart: number;
  devourEnd: number;
  tunnelStart: number;
  solidStart: number;
  swapStart: number;
  swapEnd: number;
  logo1End: number;
  ditherStart: number;
  shrinkStart: number;
  finalStart: number;
  total: number;
}

export const TIMELINE: RetroTimeline = {
  logoIn: 1500,
  devourStart: 1500,
  devourEnd: 4000,
  tunnelStart: 2500,
  solidStart: 4900,
  swapStart: 4950,
  swapEnd: 5500,
  logo1End: 7800,
  ditherStart: 7000,
  shrinkStart: 8400,
  finalStart: 9000,
  total: 10000,
};

export function buildRetroTimeline(totalMs: number): RetroTimeline {
  const k = Math.max(0.1, totalMs / TIMELINE.total);
  const scale = (value: number): number => Math.round(value * k);
  return {
    logoIn: scale(TIMELINE.logoIn),
    devourStart: scale(TIMELINE.devourStart),
    devourEnd: scale(TIMELINE.devourEnd),
    tunnelStart: scale(TIMELINE.tunnelStart),
    solidStart: scale(TIMELINE.solidStart),
    swapStart: scale(TIMELINE.swapStart),
    swapEnd: scale(TIMELINE.swapEnd),
    logo1End: scale(TIMELINE.logo1End),
    ditherStart: scale(TIMELINE.ditherStart),
    shrinkStart: scale(TIMELINE.shrinkStart),
    finalStart: scale(TIMELINE.finalStart),
    total: Math.round(totalMs),
  };
}

export type Rgb = readonly [number, number, number];

const VIOLET: Rgb = [91, 110, 232];
const PALETTE: readonly Rgb[] = [[226, 58, 46], [214, 51, 156], [139, 47, 201]];
const DARK_CROSS: Rgb = [122, 21, 24];
const DARK_BOX: Rgb = [94, 15, 18];
const TUNNEL_GREEN = "#45FF85";

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function lerp3(a: Rgb, b: Rgb, k: number): Rgb {
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k),
  ];
}

/** Deterministic PRNG so a seed reproduces the exact same growth patterns. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DevourCell {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Birth time in ms; edge cells first, center last (elliptical wavefront). */
  birth: number;
  v: number;
}

const CELL = 40;
const COLS = DESIGN_W / CELL;
const ROWS = DESIGN_H / CELL;

export function buildDevourCells(seed: number, tl: RetroTimeline = TIMELINE): DevourCell[] {
  const rnd = mulberry32(seed);
  const phase = rnd() * Math.PI * 2;
  const cells: DevourCell[] = [];
  const cx = (COLS - 1) / 2;
  const cy = (ROWS - 1) / 2;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const base = clamp01(1 - Math.hypot((col - cx) / cx, (row - cy) / cy) / 1.05);
      const wave = Math.sin(col * 0.55 + row * 1.15 + phase) * 0.18;
      const noise = (rnd() * 2 - 1) * 0.35;
      const birth = tl.devourStart +
        clamp01(base + wave * 0.5 + noise * 0.55) * (tl.devourEnd - tl.devourStart);
      cells.push({
        x: col * CELL,
        y: row * CELL,
        w: CELL + Math.floor(rnd() * 21),
        h: CELL + Math.floor(rnd() * 21),
        birth,
        v: 0.82 + rnd() * 0.36,
      });
    }
  }
  return cells;
}

export interface TunnelLayer {
  start: number;
  dur: number;
  ox: number;
  oy: number;
}

export function buildTunnelLayers(seed: number, count: number, tl: RetroTimeline = TIMELINE): TunnelLayer[] {
  const rnd = mulberry32((seed ^ 0x9E3779B9) >>> 0);
  const layers: TunnelLayer[] = [];
  for (let k = 0; k < count; k++) {
    layers.push({
      start: tl.tunnelStart + k * 300,
      dur: 1800,
      ox: (rnd() - 0.5) * 90,
      oy: (rnd() - 0.5) * 60,
    });
  }
  return layers;
}

export interface DitherCell {
  x: number;
  y: number;
  /** 0 = cross, 1 = box (nested rectangles). */
  pattern: 0 | 1;
  color: Rgb;
  birth: number;
  /** Distance to the nearest kept sheet; drives the shrink order. */
  dKeep: number;
  /** Index into KEEP_SHEETS, or -1 when the cell dissolves during the shrink. */
  keep: number;
  death: number;
}

const DCELL = 32;
const DCOLS = 60;
const DROWS = 34;
const KEEP_SHEETS = [
  { x0: 130, y0: 320, x1: 640, y1: 760 }, // left sheet: crosses only
  { x0: 920, y0: 300, x1: 1540, y1: 800 }, // center-right sheet: boxes only
] as const;

export function buildDitherGrid(seed: number, tl: RetroTimeline = TIMELINE): DitherCell[] {
  const rnd = mulberry32((seed ^ 0x5F356495) >>> 0);
  const cells: DitherCell[] = [];
  let maxD = 1;
  for (let row = 0; row < DROWS; row++) {
    for (let col = 0; col < DCOLS; col++) {
      const cx = col * DCELL + DCELL / 2;
      const cy = row * DCELL + DCELL / 2;
      const dTR = Math.hypot((col - (DCOLS - 1)) / (DCOLS - 1), row / (DROWS - 1));
      const keep = KEEP_SHEETS.findIndex((k) => cx >= k.x0 && cx <= k.x1 && cy >= k.y0 && cy <= k.y1);
      let dKeep = Number.POSITIVE_INFINITY;
      for (const k of KEEP_SHEETS) {
        const dx = Math.max(k.x0 - cx, 0, cx - k.x1);
        const dy = Math.max(k.y0 - cy, 0, cy - k.y1);
        dKeep = Math.min(dKeep, Math.hypot(dx, dy));
      }
      if (dKeep < Number.POSITIVE_INFINITY) maxD = Math.max(maxD, dKeep);
      cells.push({
        x: col * DCELL,
        y: row * DCELL,
        pattern: keep >= 0 ? (keep as 0 | 1) : rnd() < 0.5 ? 0 : 1,
        color: PALETTE[Math.floor(rnd() * PALETTE.length)] ?? PALETTE[0]!,
        birth: tl.ditherStart + clamp01(dTR + (rnd() - 0.5) * 0.25) * (tl.shrinkStart - 200 - tl.ditherStart),
        dKeep,
        keep,
        death: 0,
      });
    }
  }
  for (const cell of cells) {
    cell.death = tl.shrinkStart + (cell.dKeep / maxD) * (tl.finalStart - 80 - tl.shrinkStart) + rnd() * 80;
  }
  return cells;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", () => reject(new Error("retro-boot image failed to load")));
    img.src = src;
  });
}

export class RetroBootEngine implements AnimationController {
  private readonly runtime: AnimationRuntime;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly seed: number;
  private readonly tunnelCount: number;
  private readonly finalMask: number;
  private readonly tl: RetroTimeline;
  private readonly k: number;
  private readonly devourCells: DevourCell[];
  private readonly ditherCells: DitherCell[];
  private tunnelLayers: TunnelLayer[] = [];

  private whale?: HTMLImageElement;
  private word?: HTMLImageElement;
  private backdrop?: HTMLImageElement;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private startTime = 0;
  private completed = false;
  private destroyed = false;
  private rafId = 0;
  private resizeTimer = 0;

  private readonly onResize = (): void => {
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => {
      if (this.destroyed || this.completed) return;
      this.measure();
    }, 200);
  };

  constructor(runtime: AnimationRuntime) {
    this.runtime = runtime;
    const p = runtime.params;
    const layers = RetroBootEngine.number(p.tunnelLayers, 5);
    this.tunnelCount = Math.round(Math.min(6, Math.max(0, layers)));
    this.finalMask = Math.min(1, Math.max(0, RetroBootEngine.number(p.finalMask, 0.65)));
    const seed = RetroBootEngine.number(p.seed, 20261009);
    this.seed = Math.round(Math.min(999999, Math.max(1, seed)));
    const duration = RetroBootEngine.number(p.durationMs, TIMELINE.total);
    this.tl = buildRetroTimeline(Math.min(120000, Math.max(5000, duration)));
    this.k = this.tl.total / TIMELINE.total;
    this.devourCells = buildDevourCells(this.seed, this.tl);
    this.ditherCells = buildDitherGrid(this.seed, this.tl);

    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;
    runtime.container.append(this.canvas);
    window.addEventListener("resize", this.onResize);
  }

  start(): void {
    void this.loadAssets();
  }

  skip(): void {
    if (this.destroyed || this.completed) return;
    this.cancelRaf();
    this.renderFrame(this.tl.total);
    this.markCompleted();
  }

  destroy(): void {
    this.destroyed = true;
    this.cancelRaf();
    window.clearTimeout(this.resizeTimer);
    window.removeEventListener("resize", this.onResize);
    this.canvas.remove();
  }

  private markCompleted(): void {
    if (this.completed) return;
    this.completed = true;
    this.runtime.complete();
  }

  private cancelRaf(): void {
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  private async loadAssets(): Promise<void> {
    try {
      const [whale, word] = await Promise.all([loadImage(RETRO_BOOT_LOGO1), loadImage(RETRO_BOOT_LOGO2)]);
      if (this.destroyed) return;
      this.whale = whale;
      this.word = word;
      this.runtime.markLoaded?.();
      // The uploaded picture is a dimmed backdrop only: losing it degrades to
      // black and the run continues.
      this.backdrop = await loadImage(this.runtime.media.url).catch(() => undefined);
      if (this.destroyed) return;
      if (this.runtime.reducedMotion) {
        this.renderFrame(this.tl.total);
        this.markCompleted();
        return;
      }
      this.tunnelLayers = buildTunnelLayers(this.seed, this.tunnelCount);
      this.measure();
      this.startTime = performance.now();
      this.rafId = requestAnimationFrame(this.frame);
    } catch (err) {
      if (!this.destroyed && !this.completed) this.runtime.fail(err);
    }
  }

  private measure(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vw = this.runtime.container.clientWidth || window.innerWidth;
    const vh = this.runtime.container.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(vw * dpr);
    this.canvas.height = Math.round(vh * dpr);
    this.scale = Math.min(this.canvas.width / DESIGN_W, this.canvas.height / DESIGN_H);
    this.offsetX = (this.canvas.width - DESIGN_W * this.scale) / 2;
    this.offsetY = (this.canvas.height - DESIGN_H * this.scale) / 2;
  }

  private readonly frame = (now: number): void => {
    if (this.destroyed || this.completed) return;
    const elapsed = now - this.startTime;
    if (elapsed >= this.tl.total) {
      this.renderFrame(this.tl.total);
      this.markCompleted();
      return;
    }
    this.renderFrame(elapsed);
    this.rafId = requestAnimationFrame(this.frame);
  };

  /* One composed frame at design coordinates; pure in `t` for a fixed seed. */
  private renderFrame(t: number): void {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);
    ctx.beginPath();
    ctx.rect(0, 0, DESIGN_W, DESIGN_H);
    ctx.clip();

    this.drawBackdrop(t);
    this.drawDevour(t);
    this.drawTunnel(t);
    if (t >= this.tl.solidStart) {
      ctx.globalAlpha = Math.min(1, (t - this.tl.solidStart) / (300 * this.k));
      ctx.fillStyle = `rgb(${VIOLET.join(",")})`;
      ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
      ctx.globalAlpha = 1;
    }
    this.drawWhale(t);
    this.drawWordmark(t);
    const curtain = clamp01((t - this.tl.shrinkStart) / (400 * this.k));
    if (curtain > 0) {
      ctx.globalAlpha = curtain;
      this.drawBackdropSheet();
      ctx.globalAlpha = 1;
    }
    this.drawDither(t);
    ctx.restore();
  }

  private drawBackdrop(t: number): void {
    if (this.backdrop === undefined || t >= this.tl.solidStart + 300 * this.k) return;
    const img = this.backdrop;
    const cover = Math.max(DESIGN_W / img.naturalWidth, DESIGN_H / img.naturalHeight);
    const w = img.naturalWidth * cover;
    const h = img.naturalHeight * cover;
    this.ctx.save();
    this.ctx.globalAlpha = Math.min(t / 1200, 1) * 0.55;
    this.ctx.drawImage(img, DESIGN_W / 2 - w / 2, DESIGN_H / 2 - h / 2, w, h);
    this.ctx.restore();
  }

  private drawDevour(t: number): void {
    if (t < this.tl.devourStart) return;
    const ctx = this.ctx;
    for (const cell of this.devourCells) {
      if (t < cell.birth) continue;
      ctx.fillStyle = `rgb(${Math.round(91 * cell.v)},${Math.round(110 * cell.v)},${Math.round(232 * cell.v)})`;
      ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
      const age = t - cell.birth;
      if (age < 90) {
        ctx.fillStyle = `rgba(215,224,255,${(1 - age / 90) * 0.8})`;
        ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
      }
    }
  }

  private drawTunnel(t: number): void {
    if (t < this.tl.tunnelStart) return;
    const fade = 1 - clamp01((t - this.tl.solidStart) / (400 * this.k));
    if (fade <= 0) return;
    const ctx = this.ctx;
    ctx.strokeStyle = TUNNEL_GREEN;
    for (const layer of this.tunnelLayers) {
      const p = (t - layer.start) / layer.dur;
      if (p <= 0 || p >= 1) continue;
      const scale = 0.06 + p * p * 3.3;
      const w = DESIGN_W * scale;
      const h = DESIGN_H * scale;
      ctx.globalAlpha = Math.min(1, p * 9) * (1 - p * 0.45) * fade;
      ctx.lineWidth = 2;
      ctx.strokeRect(DESIGN_W / 2 - w / 2 + layer.ox * p, DESIGN_H / 2 - h / 2 + layer.oy * p, w, h);
    }
    ctx.globalAlpha = 1;
  }

  /** Opening whale (embedded bare-whale asset): awake, breathing, white-glow. */
  private drawWhale(t: number): void {
    if (this.whale === undefined || t >= this.tl.swapEnd) return;
    const p = clamp01(t / this.tl.logoIn);
    const ease = 1 - Math.pow(1 - p, 3);
    let alpha = ease;
    let scale = 0.95 + 0.05 * ease;
    let glow = 18 * ease;
    if (t > this.tl.logoIn) {
      const ph = ((t - this.tl.logoIn) / (2400 * this.k)) * Math.PI * 2;
      alpha = 0.9 + 0.1 * Math.sin(ph);
      scale = 1;
      glow = 16 + 10 * (0.5 + 0.5 * Math.sin(ph));
    }
    if (t > this.tl.swapStart) alpha *= 1 - (t - this.tl.swapStart) / (this.tl.swapEnd - this.tl.swapStart);
    const w = 640 * scale;
    const h = (w * 675) / 1200;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false; // chunky retro upscale
    ctx.shadowColor = t < this.tl.devourStart ? "rgba(90,140,255,0.9)" : "rgba(255,255,255,0.85)";
    ctx.shadowBlur = glow * this.scale;
    ctx.drawImage(this.whale, DESIGN_W / 2 - w / 2, DESIGN_H / 2 - h / 2, w, h);
    ctx.drawImage(this.whale, DESIGN_W / 2 - w / 2, DESIGN_H / 2 - h / 2, w, h);
    ctx.restore();
  }

  /** Mid-run wordmark (embedded whale+word asset) under a breathing white glow. */
  private drawWordmark(t: number): void {
    if (this.word === undefined || t < this.tl.swapStart || t > this.tl.logo1End) return;
    let alpha = clamp01((t - this.tl.swapStart) / (this.tl.swapEnd - this.tl.swapStart));
    if (t > this.tl.ditherStart) alpha *= 1 - clamp01((t - this.tl.ditherStart) / (600 * this.k));
    const ph = (t / (2400 * this.k)) * Math.PI * 2;
    alpha *= 0.9 + 0.1 * Math.sin(ph);
    const size = 880;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;
    ctx.shadowColor = "rgba(255,255,255,0.85)";
    ctx.shadowBlur = (22 + 10 * (0.5 + 0.5 * Math.sin(ph))) * this.scale;
    ctx.drawImage(this.word, DESIGN_W / 2 - size / 2, DESIGN_H / 2 - size / 2, size, size);
    ctx.drawImage(this.word, DESIGN_W / 2 - size / 2, DESIGN_H / 2 - size / 2, size, size);
    ctx.restore();
  }

  /* End-of-run backdrop: the user picture under an adjustable dark veil
   * (falls back to plain black when the picture is unavailable). */
  private drawBackdropSheet(): void {
    const ctx = this.ctx;
    if (this.backdrop !== undefined) {
      const img = this.backdrop;
      const cover = Math.max(DESIGN_W / img.naturalWidth, DESIGN_H / img.naturalHeight);
      const w = img.naturalWidth * cover;
      const h = img.naturalHeight * cover;
      ctx.drawImage(img, (DESIGN_W - w) / 2, (DESIGN_H - h) / 2, w, h);
    }
    if (this.finalMask > 0) {
      ctx.fillStyle = `rgba(0,0,0,${this.finalMask})`;
      ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
    }
    if (this.backdrop === undefined && this.finalMask < 1) {
      // no picture: keep the black ground regardless of the mask value
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
    }
  }

  private drawDither(t: number): void {
    if (t < this.tl.ditherStart) return;
    const ctx = this.ctx;
    const finalK = clamp01((t - (this.tl.finalStart - 200 * this.k)) / (600 * this.k));
    for (const cell of this.ditherCells) {
      if (t < cell.birth) continue;
      if (cell.keep < 0 && t >= cell.death) continue;
      let rgb = lerp3(VIOLET, cell.color, clamp01((t - cell.birth) / (450 * this.k)));
      if (cell.keep >= 0 && finalK > 0) rgb = lerp3(rgb, cell.pattern === 0 ? DARK_CROSS : DARK_BOX, finalK);
      const color = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      if (cell.pattern === 0) {
        ctx.fillRect(cell.x + 1, cell.y + 11, 30, 10);
        ctx.fillRect(cell.x + 11, cell.y + 1, 10, 30);
      } else {
        ctx.lineWidth = 3;
        ctx.strokeRect(cell.x + 3.5, cell.y + 3.5, 25, 25);
        ctx.lineWidth = 2;
        ctx.strokeRect(cell.x + 11.5, cell.y + 11.5, 9, 9);
      }
    }
  }

  private static number(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }
}

export const retroBootAnimation: OpeningAnimation = {
  id: "retro-boot",
  kind: "image",
  labelKey: "anim.retro-boot.label",
  descriptionKey: "anim.retro-boot.desc",
  paramsSchema: {
    durationMs: { type: "number", default: 10000, min: 5000, max: 120000, step: 500 },
    finalMask: { type: "number", default: 0.65, min: 0, max: 1, step: 0.05 },
    tunnelLayers: { type: "number", default: 5, min: 0, max: 6, step: 1 },
    seed: { type: "number", default: 20261009, min: 1, max: 999999, step: 1 },
    bg: { type: "enum", default: "#000000", options: ["#000000", "#04050e", "#0a0a14"] },
  },
  create: (runtime) => new RetroBootEngine(runtime),
};
