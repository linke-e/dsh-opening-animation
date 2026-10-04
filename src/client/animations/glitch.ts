// glitch engine, ported from the vendored glitch-effect project (p5.js).
// The picture fills the screen (cover) and corruption bursts at random spots:
// flow line (a drifting bright scan line), shift lines (random horizontal
// bands displaced sideways), RGB channel split (pre-rendered channel layers
// composited with 'lighter' at random offsets), and scattered blocks (random
// rects pasted at random positions). The original's per-frame pixel surgery
// becomes drawImage slices; through-frames (brief clean pictures) keep the
// original's rhythm. After durationMs the corruption stops on a clean frame,
// then runtime.complete() hands over to the transition (UI fades in).
// Deviations from the page: completion calls runtime.complete(), showClean()
// backs skip(), intensity/duration come in as params, reduced-motion renders
// the clean picture immediately.

import type {
  AnimationController,
  AnimationRuntime,
  OpeningAnimation,
} from "../registry";

type Intensity = "subtle" | "strong" | "extreme";

interface ShiftLine {
  y: number;
  h: number;
  dx: number;
}

interface ScatBlock {
  sx: number;
  sy: number;
  w: number;
  h: number;
  px: number;
  py: number;
}

interface IntensityProfile {
  shiftLineCount: number;
  shiftLineRange: number;
  scatCount: number;
  rgbRange: number;
  throughChance: number;
}

const PROFILES: Record<Intensity, IntensityProfile> = {
  subtle: { shiftLineCount: 3, shiftLineRange: 20, scatCount: 2, rgbRange: 8, throughChance: 0.35 },
  strong: { shiftLineCount: 8, shiftLineRange: 60, scatCount: 4, rgbRange: 24, throughChance: 0.18 },
  extreme: { shiftLineCount: 14, shiftLineRange: 140, scatCount: 7, rgbRange: 48, throughChance: 0.12 },
};

const SETTLE_MS = 350;
const rand = (a: number, b: number): number => a + Math.random() * (b - a);
const randInt = (a: number, b: number): number => Math.floor(rand(a, b));

export class GlitchEngine implements AnimationController {
  private readonly runtime: AnimationRuntime;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly img = new Image();
  private readonly durationMs: number;
  private readonly profile: IntensityProfile;
  private readonly bg: string;

  private vw = 0;
  private vh = 0;
  private dpr = 1;
  private fit!: HTMLCanvasElement;
  private channels: HTMLCanvasElement[] = [];
  private shiftLines: Array<ShiftLine | null> = [];
  private scatBlocks: Array<ScatBlock | null> = [];
  private rgbOffsets: [number, number, number] | null = null;
  private flowT1 = randInt(0, 1000);
  private flowSpeed = randInt(4, 24);
  private flowRandX = randInt(24, 80);
  private throughUntil = 0;
  private startTime = 0;
  private completed = false;
  private destroyed = false;
  private rafId = 0;
  private resizeTimer = 0;

  private readonly onImgLoad = (): void => {
    if (this.destroyed) return;
    if (this.runtime.reducedMotion) {
      this.showClean();
      this.markCompleted();
      return;
    }
    this.beginRun();
  };

  private readonly onImgError = (): void => {
    if (!this.destroyed && !this.completed) this.runtime.fail(new Error("opening image failed to load"));
  };

  private readonly onResize = (): void => {
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => {
      if (this.destroyed || this.completed) return;
      if (this.imageReady()) this.buildLayout();
    }, 200);
  };

  constructor(runtime: AnimationRuntime) {
    this.runtime = runtime;
    const p = runtime.params;
    this.durationMs = GlitchEngine.number(p.durationMs, 6000);
    const intensity = p.intensity === "subtle" || p.intensity === "extreme" ? p.intensity : "strong";
    this.profile = PROFILES[intensity];
    this.bg = typeof p.bg === "string" && p.bg.length > 0 ? p.bg : "#04050e";

    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;
    runtime.container.append(this.canvas);

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
    if (this.imageReady()) this.showClean();
    this.markCompleted();
  }

  destroy(): void {
    this.destroyed = true;
    this.cancelRaf();
    window.clearTimeout(this.resizeTimer);
    this.img.removeEventListener("load", this.onImgLoad);
    this.img.removeEventListener("error", this.onImgError);
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

  /* Picture cover-fitted to the viewport in physical pixels; channel layers pre-split once. */
  private buildLayout(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.vw = this.runtime.container.clientWidth || window.innerWidth;
    this.vh = this.runtime.container.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(this.vw * this.dpr);
    this.canvas.height = Math.round(this.vh * this.dpr);

    this.fit = document.createElement("canvas");
    this.fit.width = this.canvas.width;
    this.fit.height = this.canvas.height;
    const fitCtx = this.fit.getContext("2d") as CanvasRenderingContext2D;
    const scale = Math.max(this.canvas.width / this.img.naturalWidth, this.canvas.height / this.img.naturalHeight);
    const dw = this.img.naturalWidth * scale;
    const dh = this.img.naturalHeight * scale;
    fitCtx.drawImage(
      this.img,
      0, 0, this.img.naturalWidth, this.img.naturalHeight,
      (this.canvas.width - dw) / 2, (this.canvas.height - dh) / 2, dw, dh,
    );

    this.channels = [0xff0000, 0x00ff00, 0x0000ff].map((mask) => {
      const layer = document.createElement("canvas");
      layer.width = this.canvas.width;
      layer.height = this.canvas.height;
      const lctx = layer.getContext("2d") as CanvasRenderingContext2D;
      lctx.drawImage(this.fit, 0, 0);
      lctx.globalCompositeOperation = "multiply";
      lctx.fillStyle = `#${mask.toString(16).padStart(6, "0")}`;
      lctx.fillRect(0, 0, layer.width, layer.height);
      return layer;
    });

    this.shiftLines = Array.from({ length: this.profile.shiftLineCount }, () => null);
    this.scatBlocks = Array.from({ length: this.profile.scatCount }, () => null);
    this.rgbOffsets = null;
  }

  private rollShiftLine(): ShiftLine {
    const range = this.profile.shiftLineRange * this.dpr;
    const y = randInt(0, this.canvas.height);
    const h = Math.max(2, randInt(1, Math.floor(this.canvas.height * 0.12)));
    return { y, h, dx: Math.round(rand(-range, range)) };
  }

  private rollScatBlock(): ScatBlock {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const sx = randInt(0, Math.max(1, w - Math.round(w * 0.1)));
    const sy = randInt(0, Math.max(1, h - 60));
    const bw = randInt(Math.round(w * 0.06), Math.max(Math.round(w * 0.06) + 1, w - sx));
    const bh = randInt(4, 60);
    return {
      sx, sy, w: bw, h: bh,
      px: randInt(-Math.round(w * 0.3), Math.round(w * 0.7)),
      py: randInt(-Math.round(h * 0.1), Math.max(0, h - bh)),
    };
  }

  private readonly frame = (now: number): void => {
    if (this.destroyed || this.completed) return;
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const elapsed = now - this.startTime;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = this.bg;
    ctx.fillRect(0, 0, W, H);

    if (elapsed >= this.durationMs) {
      this.showClean();
      this.markCompleted();
      return;
    }

    if (now < this.throughUntil) {
      ctx.drawImage(this.fit, 0, 0);
    } else {
      if (Math.random() < this.profile.throughChance) {
        this.throughUntil = now + rand(40, 400);
      }
      // RGB channel split: three pre-split layers at random offsets, added back together.
      if (Math.random() < 0.35) {
        const range = this.profile.rgbRange * this.dpr;
        const [dr, dg, db] = this.rgbOffsets = [
          Math.round(rand(-range, range)),
          Math.round(rand(-range, range)),
          Math.round(rand(-range, range)),
        ];
        ctx.globalCompositeOperation = "lighter";
        ctx.drawImage(this.channels[0] as HTMLCanvasElement, dr, 0);
        ctx.drawImage(this.channels[1] as HTMLCanvasElement, 0, dg);
        ctx.drawImage(this.channels[2] as HTMLCanvasElement, 0, db);
        ctx.globalCompositeOperation = "source-over";
      } else {
        ctx.drawImage(this.fit, 0, 0);
      }

      // Shift lines: each band re-rolls with 50% chance, then always redraws displaced.
      for (let i = 0; i < this.shiftLines.length; i++) {
        if (Math.random() > 0.5 || this.shiftLines[i] === null) {
          this.shiftLines[i] = this.rollShiftLine();
        }
        const line = this.shiftLines[i] as ShiftLine;
        ctx.drawImage(this.fit, 0, line.y, W, line.h, line.dx, line.y, W, line.h);
      }

      // Flow line: a bright scan line drifting downward (the p5 version adds
      // flowRandX to every channel on the line — 'lighter' white reads the same).
      this.flowT1 = (this.flowT1 + this.flowSpeed) % H;
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = `rgba(255,255,255,${(this.flowRandX / 255).toFixed(3)})`;
      ctx.fillRect(0, this.flowT1, W, Math.max(2, Math.round(2 * this.dpr)));
      ctx.globalCompositeOperation = "source-over";

      // Scattered blocks: random rects pasted at random positions, re-rolling with 20% chance.
      for (let i = 0; i < this.scatBlocks.length; i++) {
        if (Math.random() > 0.8 || this.scatBlocks[i] === null) {
          this.scatBlocks[i] = this.rollScatBlock();
        }
        const block = this.scatBlocks[i] as ScatBlock;
        ctx.drawImage(this.fit, block.sx, block.sy, block.w, block.h, block.px, block.py, block.w, block.h);
      }
    }

    this.rafId = requestAnimationFrame(this.frame);
  };

  private beginRun(): void {
    this.cancelRaf();
    this.buildLayout();
    this.flowT1 = randInt(0, 1000);
    this.flowSpeed = randInt(4, 24);
    this.flowRandX = randInt(24, 80);
    this.throughUntil = 0;
    this.startTime = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  /* Freeze on the clean picture (skip / reduced motion / end of the run). */
  private showClean(): void {
    if (!this.imageReady()) return;
    this.cancelRaf();
    if (this.fit === undefined) this.buildLayout();
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = this.bg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.fit as HTMLCanvasElement, 0, 0);
  }

  private static number(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }
}

export const glitchAnimation: OpeningAnimation = {
  id: "glitch",
  kind: "image",
  labelKey: "anim.glitch.label",
  descriptionKey: "anim.glitch.desc",
  paramsSchema: {
    durationMs: { type: "number", default: 6000, min: 1000, max: 30000, step: 500 },
    intensity: { type: "enum", default: "strong", options: ["subtle", "strong", "extreme"] },
    bg: { type: "enum", default: "#04050e", options: ["#04050e", "#000000", "#101020"] },
  },
  create: (runtime) => new GlitchEngine(runtime),
};
