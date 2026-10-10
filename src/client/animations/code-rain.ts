// code-rain engine: the uploaded picture covers the screen from the first
// frame while green code rain falls over it — each column is one rigid stream
// of glyphs, pre-rendered once to an offscreen sprite (head glow baked in),
// so a frame only translates sprites: glyphs never redraw, never flicker, and
// the per-frame cost stays flat no matter how dense the rain is. Every stream
// enters at the top edge and rolls out through the bottom edge exactly once;
// the hand-over to the transition happens only after the last stream has been
// fully off-screen for a settling margin, so the picture is clean by then.
// Pure black ground behind the picture + #00FF41 + monospace stack; no fonts
// loaded, no dependencies. The uploaded picture failing to load fails the
// run; reduced motion renders the clean final frame at once; skip() freezes
// that frame.

import type {
  AnimationController,
  AnimationRuntime,
  OpeningAnimation,
} from "../registry";

const GREEN = "#00FF41";
const GREEN_DIM = "#006400";
const GREEN_HI = "#CCFFCC";
const MONO = 'ui-monospace, "Cascadia Mono", Consolas, monospace';
const RAIN_CHARS = "0123456789ABCDEF{}<>*;/#@";
/** Stream length as a share of the viewport height. */
const TAIL_RATIO = 0.8;
/** Idle time between the last stream leaving the screen and the hand-over. */
const ROLLOUT_MARGIN_MS = 400;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface RainColumn {
  /** Left edge in CSS px. */
  x: number;
  /** Column width in CSS px. */
  w: number;
  /** Time the stream starts entering at the top edge (ms). */
  start: number;
  /** Time the stream has fully rolled out through the bottom edge (ms). */
  end: number;
  seed: number;
}

/** Column schedule over the run: births spread over the first 18%, roll-outs
 * finishing between 62% and (100% - margin) of the duration — so by `total`
 * every stream has already been off-screen for the settling margin. */
export function buildRainColumns(seed: number, count: number, vw: number, totalMs: number): RainColumn[] {
  const rnd = mulberry32((seed ^ 0x51ED270B) >>> 0);
  const columns: RainColumn[] = [];
  const w = vw / count;
  const minSpan = totalMs * 0.35;
  const lastEnd = Math.max(totalMs - ROLLOUT_MARGIN_MS, totalMs * 0.62);
  for (let i = 0; i < count; i++) {
    const start = totalMs * rnd() * 0.18;
    let end = totalMs * (0.62 + rnd() * 0.38);
    if (end - start < minSpan) end = start + minSpan;
    end = Math.min(end, lastEnd);
    columns.push({
      x: i * w,
      w,
      start,
      end,
      seed: Math.floor(rnd() * 0xFFFFFF),
    });
  }
  // one designated "last" stream finishes exactly at the last slot, so its
  // tail visibly sweeps the bottom edge just before the run hands over
  const lastStream = columns[Math.floor(rnd() * count) % count];
  if (lastStream) lastStream.end = lastEnd;
  return columns;
}

export class CodeRainEngine implements AnimationController {
  private readonly runtime: AnimationRuntime;
  private readonly canvas: HTMLCanvasElement;
  /** Null in environments without a 2d context (jsdom); every draw short-circuits. */
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly img = new Image();
  private readonly durationMs: number;
  private readonly columnsCount: number;
  private readonly seed = 20260601;
  private readonly total: number;

  private vw = 0;
  private vh = 0;
  private dpr = 1;
  private fontSize = 20;
  private charW = 12;
  private imgLayer: HTMLCanvasElement | null = null;
  private rainColumns: RainColumn[] = [];
  /** One pre-rendered stream sprite per column, aligned by index. */
  private rainSprites: (HTMLCanvasElement | undefined)[] = [];
  /** Stream sprite height in CSS px. */
  private spriteH = 0;
  private scale = 1;
  private ox = 0;
  private oy = 0;
  private startTime = 0;
  private completed = false;
  private destroyed = false;
  private rafId = 0;
  private resizeTimer = 0;

  private readonly onImgLoad = (): void => {
    if (this.destroyed) return;
    this.prepare();
    this.runtime.markLoaded?.();
    if (this.runtime.reducedMotion) {
      this.renderFinal();
      this.markCompleted();
      return;
    }
    this.startTime = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  };

  private readonly onImgError = (): void => {
    if (!this.destroyed && !this.completed) this.runtime.fail(new Error("opening image failed to load"));
  };

  private readonly onResize = (): void => {
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => {
      if (this.destroyed || this.completed) return;
      this.prepare();
      if (this.imageReady() && this.ctx !== null) {
        this.renderFrame(Math.max(0, Math.min(performance.now() - this.startTime, this.durationMs)));
      }
    }, 200);
  };

  constructor(runtime: AnimationRuntime) {
    this.runtime = runtime;
    const p = runtime.params;
    this.durationMs = CodeRainEngine.number(p.durationMs, 6000);
    this.total = Math.round(this.durationMs);
    this.columnsCount = Math.round(CodeRainEngine.number(p.columns, 40));

    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
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
    this.renderFinal();
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

  private static number(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
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

  /* Viewport fit, picture layer, column geometry, stream sprites. */
  private prepare(): void {
    if (this.ctx === null || !this.imageReady()) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.vw = this.runtime.container.clientWidth || window.innerWidth;
    this.vh = this.runtime.container.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(this.vw * this.dpr);
    this.canvas.height = Math.round(this.vh * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.scale = Math.max(this.vw / this.img.naturalWidth, this.vh / this.img.naturalHeight);
    const dw = this.img.naturalWidth * this.scale;
    const dh = this.img.naturalHeight * this.scale;
    this.ox = (this.vw - dw) / 2;
    this.oy = (this.vh - dh) / 2;

    this.fontSize = Math.round(Math.min(26, Math.max(14, this.vh / 40)));
    this.ctx.font = `${this.fontSize}px ${MONO}`;
    this.charW = this.ctx.measureText("0").width;

    this.imgLayer = document.createElement("canvas");
    this.imgLayer.width = this.canvas.width;
    this.imgLayer.height = this.canvas.height;
    this.imgLayer.getContext("2d")?.drawImage(
      this.img,
      0, 0, this.img.naturalWidth, this.img.naturalHeight,
      this.ox * this.dpr, this.oy * this.dpr, dw * this.dpr, dh * this.dpr,
    );

    const count = Math.min(96, Math.max(8, this.columnsCount));
    this.rainColumns = buildRainColumns(this.seed, count, this.vw, this.total);
    this.buildRainSprites();
  }

  /* Pre-render every stream once: glyph chain from dim tail to bright head
   * with the head glow baked in. Glyphs are fixed per chain slot, so a
   * falling stream is a rigid body — nothing can flicker — and drawing one
   * is a single drawImage instead of hundreds of fillText calls. */
  private buildRainSprites(): void {
    this.rainSprites = [];
    this.spriteH = 0;
    if (this.ctx === null) return;
    const spacing = this.fontSize;
    const rows = Math.max(10, Math.ceil((this.vh * TAIL_RATIO) / spacing));
    this.spriteH = (rows - 1) * spacing + this.fontSize;
    for (const col of this.rainColumns) {
      const sprite = document.createElement("canvas");
      sprite.width = Math.max(1, Math.ceil(col.w * this.dpr));
      sprite.height = Math.max(1, Math.ceil(this.spriteH * this.dpr));
      const g = sprite.getContext("2d");
      if (g === null) {
        this.rainSprites.push(undefined);
        continue;
      }
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      g.font = `${this.fontSize}px ${MONO}`;
      g.textBaseline = "top";
      const cx = col.w / 2;
      const headCy = this.spriteH - this.fontSize / 2;
      const glowR = this.fontSize * 1.4;
      const glow = g.createRadialGradient(cx, headCy, 0, cx, headCy, glowR);
      glow.addColorStop(0, "rgba(0,255,65,0.35)");
      glow.addColorStop(1, "rgba(0,255,65,0)");
      g.fillStyle = glow;
      g.fillRect(cx - glowR, headCy - glowR, glowR * 2, glowR * 2);
      for (let k = 0; k < rows; k++) {
        const roll = this.rand01(col.seed, k);
        if (roll < 0.08) continue; // sparse gaps, fixed per chain slot
        if (k === 0) {
          g.globalAlpha = 1;
          g.fillStyle = GREEN_HI;
        } else if (k < 3) {
          g.globalAlpha = 1;
          g.fillStyle = GREEN;
        } else {
          g.globalAlpha = Math.max(0.12, 1 - k / rows) * 0.8;
          g.fillStyle = GREEN_DIM;
        }
        g.fillText(this.rainChar(col.seed, k), cx - this.charW / 2, this.spriteH - this.fontSize - k * spacing);
      }
      this.rainSprites.push(sprite);
    }
  }

  private readonly frame = (now: number): void => {
    if (this.destroyed || this.completed) return;
    const elapsed = now - this.startTime;
    if (elapsed >= this.total) {
      this.renderFinal();
      this.markCompleted();
      return;
    }
    this.renderFrame(elapsed);
    this.rafId = requestAnimationFrame(this.frame);
  };

  private renderFrame(t: number): void {
    const ctx = this.ctx;
    if (ctx === null || this.imgLayer === null) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(this.imgLayer, 0, 0, this.canvas.width, this.canvas.height, 0, 0, this.vw, this.vh);
    this.drawRain(t);
  }

  /* The rain: one sprite per column, translated as a whole. The travel adds
   * one extra glyph row past the tail so the stream is fully off-screen at
   * p = 1; columns that have not entered or already left draw nothing. */
  private drawRain(t: number): void {
    const ctx = this.ctx;
    if (ctx === null) return;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    const tailPx = this.vh * TAIL_RATIO;
    const travel = this.vh + 2 * tailPx + this.fontSize;
    for (let i = 0; i < this.rainColumns.length; i++) {
      const sprite = this.rainSprites[i];
      const col = this.rainColumns[i];
      if (sprite === undefined || col === undefined) continue;
      const p = (t - col.start) / (col.end - col.start);
      if (p <= 0 || p >= 1) continue; // not entered yet / fully rolled out
      const head = -tailPx + p * travel;
      ctx.drawImage(sprite, col.x, head - (this.spriteH - this.fontSize), col.w, this.spriteH);
    }
    ctx.restore();
  }

  /* Final frame: the clean picture. */
  private renderFinal(): void {
    const ctx = this.ctx;
    if (ctx === null || !this.imageReady()) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, this.vw, this.vh);
    const dw = this.img.naturalWidth * this.scale;
    const dh = this.img.naturalHeight * this.scale;
    ctx.drawImage(this.img, 0, 0, this.img.naturalWidth, this.img.naturalHeight, this.ox, this.oy, dw, dh);
  }

  /* Deterministic per-(seed, slot) glyph; slots never change while falling. */
  private rainChar(seed: number, slot: number): string {
    const r = this.rand01(seed ^ 0x9E37, slot * 31);
    return RAIN_CHARS[Math.floor(r * RAIN_CHARS.length)] ?? "0";
  }

  private rand01(seed: number, n: number): number {
    let a = (seed ^ Math.imul(n + 1, 0x9E3779B9)) >>> 0;
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

export const codeRainAnimation: OpeningAnimation = {
  id: "code-rain",
  kind: "image",
  labelKey: "anim.code-rain.label",
  descriptionKey: "anim.code-rain.desc",
  paramsSchema: {
    durationMs: { type: "number", default: 6000, min: 1000, max: 30000, step: 500 },
    columns: { type: "number", default: 40, min: 8, max: 96, step: 4 },
  },
  create: (runtime) => new CodeRainEngine(runtime),
};
