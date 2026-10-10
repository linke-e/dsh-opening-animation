// pool engine. The picture rests still, like the surface of a pool: a graded
// frame — cooled blues, a warm window glow in the upper right, darkened
// corners — drawn once per frame with a single drawImage and never moved.
// Sweeping the pointer across it injects Gaussian pressure splashes into a
// shallow-water simulation (two Float32Array buffers stepped with the classic
// two-buffer wave equation at damping 0.985); each frame the wave heights
// refract the graded picture — every pixel inside the active ripples samples
// the base image offset along the local wave gradient — and a soft white
// glint is added where the surface tilts. Painted on top of the refraction:
// ~50 dust motes drifting down (denser and brighter inside the window
// light), RGB fringe pulses on the screen edges every couple of seconds, and
// full-screen film grain refreshed every frame. A DOM caption sits low and
// left, playing karaoke: words wrapped in [brackets] light up white one
// after another while earlier ones fade back to grey.
// After durationMs the engine freezes on the final graded frame and hands
// over to the transition; reduced motion renders that frame at once; skip()
// does the same and drops the caption.

import type {
  AnimationController,
  AnimationRuntime,
  OpeningAnimation,
} from "../registry";

const DUST_COUNT = 50;
const GRAIN_FRAMES = 5;
const GRAIN_ALPHA = 0.05;

const CAPTION_IN_MS = 600;
const KARAOKE_AT_MS = 1200;
const KARAOKE_STEP_MAX = 900;
const KARAOKE_STEP_MIN = 300;
const KARAOKE_TAIL_MS = 800;

const PULSE_LEN = 260;

/** Shallow-water simulation: CSS px per grid cell, per-step damping, splash
 * shape (radius in cells, base strength, interpolation step), the field
 * clamp, the refraction look (gradient gain, glint gain) and the active-cell
 * epsilon. */
const SIM_CELL = 4;
const WAVE_DAMPING = 0.985;
const SPLASH_RADIUS = 4;
const SPLASH_STRENGTH = 1.2;
const SPLASH_STEP = SPLASH_RADIUS / 2;
const WATER_CLAMP = 1.5;
const REFRACT_K = 30;
const GLINT_GAIN = 12;
const ACTIVE_EPS = 0.001;

const DEFAULT_FONT = "'Bahnschrift', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif";

export const DEFAULT_CAPTION = [
  "My [finger] rests [upon] the wet [and] waiting [ink],",
  "a [silent] [testament] to [how] [I think].",
  "Your [shadow] lies pressed [flat against] the glass,",
  "a [perfect] [print of] [everything] that passes.",
].join("\n");

export interface CaptionToken {
  text: string;
  emph: boolean;
}

/** Split caption text into lines of tokens; [bracketed] words are highlights.
 * Empty brackets vanish and an unclosed bracket degrades to plain text.
 *
 * @param text - Caption source, one visual line per `\n`.
 * @returns Non-empty lines of tokens with `emph` marking highlighted words.
 */
export function parseCaption(text: string): CaptionToken[][] {
  return text
    .split("\n")
    .map((line) => {
      const tokens: CaptionToken[] = [];
      const re = /\[([^\]]*)\]|([^\[\]]+)/g;
      for (let m = re.exec(line); m !== null; m = re.exec(line)) {
        if (m[1] !== undefined) {
          if (m[1].length > 0) tokens.push({ text: m[1], emph: true });
        } else if (m[2] !== undefined && m[2].length > 0) {
          tokens.push({ text: m[2], emph: false });
        }
      }
      return tokens;
    })
    .filter((line) => line.some((tok) => tok.text.trim().length > 0));
}

/** Karaoke step for `count` highlights: aim for a leisurely pace, but never
 * so slow that the words can't all light up before the run ends — when the
 * budget is tight the step speeds up (down to 300 ms) instead of running out.
 *
 * @param durationMs - Total run length in ms.
 * @param count - Number of highlighted words to light up.
 * @returns Per-word step in ms, clamped to 300–900.
 */
export function karaokeStepMs(durationMs: number, count: number): number {
  const ideal = (durationMs - KARAOKE_AT_MS - KARAOKE_TAIL_MS) / Math.max(1, count);
  return Math.min(KARAOKE_STEP_MAX, Math.max(KARAOKE_STEP_MIN, ideal));
}

/** One step of the classic two-buffer shallow-water equation (Elias): the new
 * height is the average of the four neighbors scaled by 0.5, minus the cell's
 * previous height, times the damping factor. The result is written INTO
 * `prev` (overwriting it in place); the caller then swaps the two array
 * references so the written buffer becomes the current field. The one-cell
 * border is zeroed every step (absorbing boundary — waves die at the edge).
 *
 * @param prev - Previous field; overwritten with the new heights.
 * @param cur - Current field (read-only).
 * @param w - Field width in cells.
 * @param h - Field height in cells.
 * @param damping - Per-step energy retention in (0, 1).
 */
export function stepWaterField(prev: Float32Array, cur: Float32Array, w: number, h: number, damping: number): void {
  for (let y = 1; y < h - 1; y++) {
    const row = y * w;
    for (let x = 1; x < w - 1; x++) {
      const i = row + x;
      prev[i] = ((cur[i - 1]! + cur[i + 1]! + cur[i - w]! + cur[i + w]!) * 0.5 - prev[i]!) * damping;
    }
  }
  for (let x = 0; x < w; x++) {
    prev[x] = 0;
    prev[(h - 1) * w + x] = 0;
  }
  for (let y = 0; y < h; y++) {
    prev[y * w] = 0;
    prev[y * w + w - 1] = 0;
  }
}

/** Inject a Gaussian pressure splash centered at cell (`x`, `y`) (fractional
 * cell coordinates allowed). Every grid cell inside the square neighborhood
 * of radius `ceil(radius)` and within the splash circle gets
 * `strength * exp(-(d²)/(radius²·0.5))` added; cells outside the circle and
 * cells outside the field are skipped.
 *
 * @param field - Field to inject into (mutated additively).
 * @param w - Field width in cells.
 * @param h - Field height in cells.
 * @param x - Splash center x in cell coordinates.
 * @param y - Splash center y in cell coordinates.
 * @param radius - Splash radius in cells.
 * @param strength - Peak pressure added at the center.
 */
export function splashWaterField(
  field: Float32Array,
  w: number,
  h: number,
  x: number,
  y: number,
  radius: number,
  strength: number,
): void {
  const r = Math.ceil(radius);
  const x0 = Math.max(0, Math.ceil(x - r));
  const x1 = Math.min(w - 1, Math.floor(x + r));
  const y0 = Math.max(0, Math.ceil(y - r));
  const y1 = Math.min(h - 1, Math.floor(y + r));
  const denom = radius * radius * 0.5;
  const r2 = radius * radius;
  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      const dx = gx - x;
      const dy = gy - y;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const i = gy * w + gx;
      field[i] = field[i]! + strength * Math.exp(-d2 / denom);
    }
  }
}

interface Dust {
  x: number;
  y: number;
  size: number;
  vy: number;
  drift: number;
  freq: number;
  phase: number;
  a: number;
}

interface FringeBar {
  x: number;
  y: number;
  w: number;
  h: number;
  rgb: string;
}

const CAPTION_BOX_STYLE = [
  "position:absolute",
  "left:7%",
  "top:70%",
  "max-width:60%",
  "z-index:2",
  "pointer-events:none",
  "text-align:left",
  "color:rgba(190,195,200,0.55)",
  "font-size:clamp(15px,3.6vh,34px)",
  "line-height:1.55",
  "font-family:%FONT%",
  "text-shadow:0 1px 3px rgba(0,0,0,0.55)",
  "opacity:0",
  "transition:opacity 0.8s ease",
].join(";");
const K_SPAN_STYLE = [
  "font-weight:700",
  "color:rgba(190,195,200,0.55)",
  "transition:color 0.55s ease,text-shadow 0.55s ease",
].join(";");
const K_ON_STYLE = [
  "font-weight:700",
  "color:#eef1f3",
  "text-shadow:0 0 10px rgba(238,241,243,0.35),0 1px 3px rgba(0,0,0,0.55)",
  "transition:color 0.55s ease,text-shadow 0.55s ease",
].join(";");

export class PoolEngine implements AnimationController {
  private readonly runtime: AnimationRuntime;
  private readonly canvas: HTMLCanvasElement;
  /** Null in environments without a 2d context (jsdom); drawing short-circuits. */
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly img = new Image();
  private readonly durationMs: number;
  private readonly captionText: string;
  private readonly captionFont: string;
  /** 0 disables the water entirely: no pointer listening, no sim, no refraction. */
  private readonly rippleStrength: number;

  private vw = 0;
  private vh = 0;
  private dpr = 1;
  /** Graded picture (cool grade + window glow + vignette), exactly viewport-sized. */
  private base: HTMLCanvasElement | null = null;
  private grains: HTMLCanvasElement[] = [];
  private dust: Dust[] = [];
  private pulseAt = Number.POSITIVE_INFINITY;
  private fringe: FringeBar[] = [];
  private captionEl: HTMLElement | null = null;
  private karaokeSpans: HTMLElement[] = [];
  private karaokeIdx = -1;
  private karaokeStep = KARAOKE_STEP_MAX;
  /** Water field in cells and its two buffers (swapped every sim step). */
  private fieldW = 0;
  private fieldH = 0;
  private waterPrev = new Float32Array(0);
  private waterCur = new Float32Array(0);
  /** Graded base downscaled to CSS resolution, sampled by the refraction. */
  private baseLo: ImageData | null = null;
  private frameBuf: ImageData | null = null;
  private refractCanvas: HTMLCanvasElement | null = null;
  private refractCtx: CanvasRenderingContext2D | null = null;
  /** Last splash position in cell coordinates; -1 = none yet. */
  private lastSplashX = -1;
  private lastSplashY = -1;
  private startTime = 0;
  private lastNow = 0;
  private completed = false;
  private destroyed = false;
  private rafId = 0;
  private resizeTimer = 0;

  private readonly onImgLoad = (): void => {
    if (this.destroyed) return;
    this.runtime.markLoaded?.();
    if (this.runtime.reducedMotion || this.ctx === null) {
      this.showClean(false);
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

  /** Pointer sweep → pressure splashes: CSS coords → cell coords, then splash
   * along the segment from the last position at ~radius/2 spacing so fast
   * moves leave a continuous ripple trail instead of dotted islands. */
  private readonly onPointerMove = (e: PointerEvent): void => {
    if (this.destroyed || this.completed) return;
    if (this.rippleStrength <= 0 || this.fieldW === 0) return;
    const rect = this.runtime.container.getBoundingClientRect();
    const gx = (e.clientX - rect.left) / SIM_CELL;
    const gy = (e.clientY - rect.top) / SIM_CELL;
    const strength = SPLASH_STRENGTH * this.rippleStrength;
    const lx = this.lastSplashX;
    const ly = this.lastSplashY;
    if (lx >= 0 && ly >= 0) {
      const dx = gx - lx;
      const dy = gy - ly;
      const n = Math.max(1, Math.floor(Math.hypot(dx, dy) / SPLASH_STEP));
      for (let k = 1; k <= n; k++) {
        splashWaterField(this.waterCur, this.fieldW, this.fieldH, lx + (dx * k) / n, ly + (dy * k) / n, SPLASH_RADIUS, strength);
      }
    } else {
      splashWaterField(this.waterCur, this.fieldW, this.fieldH, gx, gy, SPLASH_RADIUS, strength);
    }
    this.lastSplashX = gx;
    this.lastSplashY = gy;
    this.clampWater();
  };

  constructor(runtime: AnimationRuntime) {
    this.runtime = runtime;
    const p = runtime.params;
    this.durationMs = PoolEngine.number(p.durationMs, 20000);
    this.captionText = typeof p.caption === "string" ? p.caption : DEFAULT_CAPTION;
    this.captionFont =
      typeof p.captionFont === "string" && p.captionFont.trim() !== "" ? p.captionFont : DEFAULT_FONT;
    this.rippleStrength = Math.min(3, Math.max(0, PoolEngine.number(p.rippleStrength, 1)));

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
    this.showClean(false);
    this.markCompleted();
  }

  destroy(): void {
    this.destroyed = true;
    this.cancelRaf();
    window.clearTimeout(this.resizeTimer);
    this.runtime.container.removeEventListener("pointermove", this.onPointerMove);
    this.img.removeEventListener("load", this.onImgLoad);
    this.img.removeEventListener("error", this.onImgError);
    this.removeCaption();
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

  /* Viewport fit, graded base, grain frames, dust field, fringe schedule,
   * water field and refraction buffers — all rebuilt on resize. */
  private buildLayout(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.vw = this.runtime.container.clientWidth || window.innerWidth;
    this.vh = this.runtime.container.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(this.vw * this.dpr);
    this.canvas.height = Math.round(this.vh * this.dpr);
    this.buildBase();
    this.buildGrain();
    this.buildRefract();
    this.fieldW = Math.ceil(this.vw / SIM_CELL) + 1;
    this.fieldH = Math.ceil(this.vh / SIM_CELL) + 1;
    this.waterPrev = new Float32Array(this.fieldW * this.fieldH);
    this.waterCur = new Float32Array(this.fieldW * this.fieldH);
    this.dust = Array.from({ length: DUST_COUNT }, () => this.rollDust(true));
    this.pulseAt = 800 + Math.random() * 400;
    this.rollFringe();
  }

  /* Bake the look once: cover-fit the picture to the viewport, cool the grade
   * down, lay a warm glow where the window light sits, darken the corners. */
  private buildBase(): void {
    const W = this.vw;
    const H = this.vh;
    const base = document.createElement("canvas");
    base.width = Math.round(W * this.dpr);
    base.height = Math.round(H * this.dpr);
    const g = base.getContext("2d");
    if (g === null) {
      this.base = null;
      return;
    }
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const scale = Math.max(W / this.img.naturalWidth, H / this.img.naturalHeight);
    const dw = this.img.naturalWidth * scale;
    const dh = this.img.naturalHeight * scale;
    g.drawImage(
      this.img,
      0, 0, this.img.naturalWidth, this.img.naturalHeight,
      (W - dw) / 2, (H - dh) / 2, dw, dh,
    );
    g.globalCompositeOperation = "saturation";
    g.fillStyle = "rgba(128,128,128,0.4)";
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "multiply";
    g.fillStyle = "#b9c6dc";
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "source-over";
    g.fillStyle = "rgba(8,16,38,0.18)";
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "screen";
    const warm = g.createRadialGradient(W * 0.78, H * 0.22, 0, W * 0.78, H * 0.22, Math.max(W, H) * 0.45);
    warm.addColorStop(0, "rgba(255,238,214,0.34)");
    warm.addColorStop(0.55, "rgba(255,238,214,0.12)");
    warm.addColorStop(1, "rgba(255,238,214,0)");
    g.fillStyle = warm;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "source-over";
    const vig = g.createRadialGradient(W * 0.5, H * 0.45, Math.min(W, H) * 0.42, W * 0.5, H * 0.45, Math.hypot(W, H) * 0.62);
    vig.addColorStop(0, "rgba(3,8,20,0)");
    vig.addColorStop(1, "rgba(3,8,20,0.58)");
    g.fillStyle = vig;
    g.fillRect(0, 0, W, H);
    this.base = base;
  }

  /* Refraction buffers: the graded base downscaled to CSS resolution and read
   * once as ImageData, an offscreen canvas for the refracted pixels, and a
   * reused ImageData of the same size. Skipped entirely when water is off. */
  private buildRefract(): void {
    this.baseLo = null;
    this.frameBuf = null;
    this.refractCanvas = null;
    this.refractCtx = null;
    if (this.rippleStrength <= 0 || this.base === null || this.vw <= 0 || this.vh <= 0) return;
    const c = document.createElement("canvas");
    c.width = this.vw;
    c.height = this.vh;
    const g = c.getContext("2d");
    if (g === null) return;
    g.drawImage(this.base, 0, 0, this.vw, this.vh);
    this.baseLo = g.getImageData(0, 0, this.vw, this.vh);
    this.frameBuf = g.createImageData(this.vw, this.vh);
    this.refractCanvas = c;
    this.refractCtx = g;
  }

  /* A few pre-rendered noise frames; each frame picks one at random. */
  private buildGrain(): void {
    this.grains = [];
    const w = Math.max(2, Math.round(this.vw / 2));
    const h = Math.max(2, Math.round(this.vh / 2));
    for (let f = 0; f < GRAIN_FRAMES; f++) {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d");
      if (g === null) return;
      const data = g.createImageData(w, h);
      const px = data.data;
      for (let i = 0; i < px.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        px[i] = v;
        px[i + 1] = v;
        px[i + 2] = v;
        px[i + 3] = 255;
      }
      g.putImageData(data, 0, 0);
      this.grains.push(c);
    }
  }

  /* Two thirds of the motes are born in the window-light half of the screen
   * and those burn brighter; the rest scatter across the whole frame. */
  private rollDust(first: boolean): Dust {
    const inWindow = Math.random() < 0.65;
    return {
      x: inWindow ? this.vw * (0.5 + Math.random() * 0.5) : Math.random() * this.vw,
      y: first ? Math.random() * this.vh : -4,
      size: Math.random() < 0.5 ? 1 : 2,
      vy: 8 + Math.random() * 16,
      drift: 6 + Math.random() * 12,
      freq: 0.1 + Math.random() * 0.3,
      phase: Math.random() * Math.PI * 2,
      a: inWindow && Math.random() < 0.8 ? 0.45 + Math.random() * 0.45 : 0.12 + Math.random() * 0.25,
    };
  }

  /* One pulse = a few thin red/blue bars hugging the screen edges (left
   * biased) plus soft color bleed gradients, flashed with a sine envelope. */
  private rollFringe(): void {
    const bars: FringeBar[] = [];
    const left: Array<[string, number, number]> = [
      ["255,45,85", 0.8, 5],
      ["80,200,255", 0.6, 4],
      ["255,45,85", 0.45, 3],
    ];
    for (const [rgb, p, wMax] of left) {
      if (Math.random() > p) continue;
      bars.push({
        x: Math.random() < 0.8 ? 0 : Math.round(Math.random() * 10),
        y: Math.random() * this.vh * 0.8,
        w: 2 + Math.random() * wMax,
        h: this.vh * (0.15 + Math.random() * 0.45),
        rgb,
      });
    }
    const right: Array<[string, number, number]> = [
      ["70,120,255", 0.8, 4],
      ["255,80,110", 0.4, 3],
    ];
    for (const [rgb, p, wMax] of right) {
      if (Math.random() > p) continue;
      bars.push({
        x: this.vw - (2 + Math.random() * wMax),
        y: Math.random() * this.vh * 0.8,
        w: 2 + Math.random() * wMax,
        h: this.vh * (0.15 + Math.random() * 0.45),
        rgb,
      });
    }
    this.fringe = bars;
  }

  private drawPulse(t: number): void {
    const ctx = this.ctx;
    if (ctx === null) return;
    if (t < this.pulseAt) return;
    if (t >= this.pulseAt + PULSE_LEN) {
      this.pulseAt = t + 2200 + Math.random() * 600;
      this.rollFringe();
      return;
    }
    const env = Math.sin((Math.PI * (t - this.pulseAt)) / PULSE_LEN) as number;
    const bleed = ctx.createLinearGradient(0, 0, 46, 0);
    bleed.addColorStop(0, `rgba(90,140,255,${(0.13 * env).toFixed(3)})`);
    bleed.addColorStop(1, "rgba(90,140,255,0)");
    ctx.fillStyle = bleed;
    ctx.fillRect(0, 0, 46, this.vh);
    const bleedR = ctx.createLinearGradient(this.vw, 0, this.vw - 34, 0);
    bleedR.addColorStop(0, `rgba(255,80,110,${(0.1 * env).toFixed(3)})`);
    bleedR.addColorStop(1, "rgba(255,80,110,0)");
    ctx.fillStyle = bleedR;
    ctx.fillRect(this.vw - 34, 0, 34, this.vh);
    for (const b of this.fringe) {
      ctx.fillStyle = `rgba(${b.rgb},${(0.28 * env).toFixed(3)})`;
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
  }

  private stepDust(tSec: number, dt: number): void {
    const ctx = this.ctx;
    if (ctx === null) return;
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < this.dust.length; i++) {
      let d = this.dust[i]!;
      d.y += d.vy * dt;
      if (d.y > this.vh + 4) {
        this.dust[i] = this.rollDust(false);
        d = this.dust[i]!;
      }
      const x = d.x + Math.sin(tSec * Math.PI * 2 * d.freq + d.phase) * d.drift;
      ctx.globalAlpha = d.a;
      ctx.fillRect(x, d.y, d.size, d.size);
    }
    ctx.globalAlpha = 1;
  }

  /* Keep a pointer frenzy from blowing the field up. */
  private clampWater(): void {
    const f = this.waterCur;
    for (let i = 0; i < f.length; i++) {
      const v = f[i]!;
      if (v > WATER_CLAMP) f[i] = WATER_CLAMP;
      else if (v < -WATER_CLAMP) f[i] = -WATER_CLAMP;
    }
  }

  /* Advance the water one step (swapping the buffers), find the active
   * bounding box, and refract the base through the wave gradient there: each
   * pixel samples the base offset along (gx, gy) and gains a white glint
   * where the surface tilts toward the light. Flat water skips the per-pixel
   * pass entirely; the ripples keep spreading and dying on their own. */
  private stepWater(): void {
    if (this.rippleStrength <= 0) return;
    const ctx = this.ctx;
    const lo = this.baseLo;
    const buf = this.frameBuf;
    const off = this.refractCanvas;
    const offCtx = this.refractCtx;
    if (ctx === null || lo === null || buf === null || off === null || offCtx === null) return;
    if (this.fieldW < 3 || this.fieldH < 3) return;
    stepWaterField(this.waterPrev, this.waterCur, this.fieldW, this.fieldH, WAVE_DAMPING);
    const tmp = this.waterPrev;
    this.waterPrev = this.waterCur;
    this.waterCur = tmp;
    const field = this.waterCur;
    const w = this.fieldW;
    const h = this.fieldH;
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let y = 1; y < h - 1; y++) {
      const row = y * w;
      for (let x = 1; x < w - 1; x++) {
        if (Math.abs(field[row + x]!) > ACTIVE_EPS) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return;
    minX = Math.max(1, minX - 2);
    minY = Math.max(1, minY - 2);
    maxX = Math.min(w - 2, maxX + 2);
    maxY = Math.min(h - 2, maxY + 2);
    const px0 = Math.min(this.vw, minX * SIM_CELL);
    const py0 = Math.min(this.vh, minY * SIM_CELL);
    const px1 = Math.min(this.vw, (maxX + 1) * SIM_CELL);
    const py1 = Math.min(this.vh, (maxY + 1) * SIM_CELL);
    if (px1 <= px0 || py1 <= py0) return;
    const k = REFRACT_K * this.rippleStrength;
    const src = lo.data;
    const dst = buf.data;
    const imgW = this.vw;
    for (let y = py0; y < py1; y++) {
      const fy = Math.min(h - 2, Math.max(1, Math.floor(y / SIM_CELL)));
      const rowUp = (fy - 1) * w;
      const rowMid = fy * w;
      const rowDown = (fy + 1) * w;
      const dstRow = y * imgW;
      for (let x = px0; x < px1; x++) {
        const fx = Math.min(w - 2, Math.max(1, Math.floor(x / SIM_CELL)));
        const gx = (field[rowMid + fx - 1]! - field[rowMid + fx + 1]!) * 0.5;
        const gy = (field[rowUp + fx]! - field[rowDown + fx]!) * 0.5;
        let sx = x + gx * k;
        let sy = y + gy * k;
        if (sx < 0) sx = 0;
        else if (sx >= imgW) sx = imgW - 1;
        if (sy < 0) sy = 0;
        else if (sy >= this.vh) sy = this.vh - 1;
        const si = (Math.floor(sy) * imgW + Math.floor(sx)) * 4;
        const di = (dstRow + x) * 4;
        const add = Math.min(1, Math.max(0, (gx + gy) * GLINT_GAIN)) * 255;
        dst[di] = src[si]! + add;
        dst[di + 1] = src[si + 1]! + add;
        dst[di + 2] = src[si + 2]! + add;
        dst[di + 3] = 255;
      }
    }
    offCtx.putImageData(buf, 0, 0, px0, py0, px1 - px0, py1 - py0);
    ctx.drawImage(off, px0, py0, px1 - px0, py1 - py0, px0, py0, px1 - px0, py1 - py0);
  }

  /* Build the karaoke caption once: plain words stay grey, bracketed words
   * become spans that light up white one after another. */
  private buildCaption(): void {
    this.removeCaption();
    const lines = parseCaption(this.captionText);
    const total = lines.reduce((n, line) => n + line.length, 0);
    this.karaokeStep = karaokeStepMs(this.durationMs, total);
    const box = document.createElement("div");
    box.setAttribute("class", "dsh-opening-pool-caption");
    box.setAttribute("style", CAPTION_BOX_STYLE.replace("%FONT%", this.captionFont));
    const spans: HTMLElement[] = [];
    for (const line of lines) {
      const row = document.createElement("div");
      for (const tok of line) {
        const s = document.createElement("span");
        s.textContent = tok.text;
        if (tok.emph) {
          s.setAttribute("class", "k");
          s.setAttribute("style", K_SPAN_STYLE);
          spans.push(s);
        }
        row.append(s);
      }
      box.append(row);
    }
    this.karaokeSpans = spans;
    this.karaokeIdx = -1;
    this.captionEl = box;
    this.runtime.container.append(box);
  }

  /* Fade the caption in, then advance the karaoke: the current word turns
   * white, everything before it eases back to grey. DOM writes are incremental. */
  private stepKaraoke(t: number): void {
    const box = this.captionEl;
    if (box === null) return;
    if (t >= CAPTION_IN_MS && box.style.opacity !== "1") box.style.opacity = "1";
    const spans = this.karaokeSpans;
    if (spans.length === 0) return;
    const idx =
      t < KARAOKE_AT_MS
        ? -1
        : Math.min(spans.length - 1, Math.floor((t - KARAOKE_AT_MS) / this.karaokeStep));
    if (idx === this.karaokeIdx) return;
    if (idx > this.karaokeIdx) {
      for (let i = this.karaokeIdx + 1; i < idx; i++) spans[i]!.setAttribute("style", K_SPAN_STYLE);
      spans[idx]!.setAttribute("style", K_ON_STYLE);
    } else {
      for (let i = 0; i < spans.length; i++) spans[i]!.setAttribute("style", K_SPAN_STYLE);
    }
    this.karaokeIdx = idx;
  }

  private removeCaption(): void {
    this.captionEl?.remove();
    this.captionEl = null;
    this.karaokeSpans = [];
    this.karaokeIdx = -1;
  }

  private beginRun(): void {
    this.cancelRaf();
    this.buildLayout();
    this.buildCaption();
    this.lastSplashX = -1;
    this.lastSplashY = -1;
    if (this.rippleStrength > 0 && this.ctx !== null) {
      this.runtime.container.addEventListener("pointermove", this.onPointerMove);
    }
    this.startTime = performance.now();
    this.lastNow = this.startTime;
    this.rafId = requestAnimationFrame(this.frame);
  }

  private readonly frame = (now: number): void => {
    if (this.destroyed || this.completed) return;
    const ctx = this.ctx;
    if (ctx === null) return;
    const t = now - this.startTime;
    if (t >= this.durationMs) {
      this.showClean(true);
      this.markCompleted();
      return;
    }
    const dt = Math.min(0.05, Math.max(0, (now - this.lastNow) / 1000));
    this.lastNow = now;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    // The still pool: one drawImage, no camera, no slices.
    if (this.base !== null) {
      ctx.drawImage(this.base, 0, 0, this.vw, this.vh);
    }
    this.stepWater();
    this.stepDust(t / 1000, dt);
    this.drawPulse(t);
    if (this.grains.length > 0) {
      ctx.globalAlpha = GRAIN_ALPHA;
      ctx.drawImage(this.grains[(Math.random() * this.grains.length) | 0]!, 0, 0, this.vw, this.vh);
      ctx.globalAlpha = 1;
    }
    this.stepKaraoke(t);
    this.rafId = requestAnimationFrame(this.frame);
  };

  /* Final graded frame (skip/reduced motion also drops the caption; the
   * natural end keeps it for the hand-over). */
  private showClean(keepCaption: boolean): void {
    this.cancelRaf();
    if (!keepCaption) this.removeCaption();
    const ctx = this.ctx;
    if (ctx === null || !this.imageReady()) return;
    if (this.base === null) this.buildLayout();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#04050e";
    ctx.fillRect(0, 0, this.vw, this.vh);
    if (this.base !== null) {
      ctx.drawImage(this.base, 0, 0, this.vw, this.vh);
    }
  }
}

export const poolAnimation: OpeningAnimation = {
  id: "pool",
  kind: "image",
  labelKey: "anim.pool.label",
  descriptionKey: "anim.pool.desc",
  paramsSchema: {
    durationMs: { type: "number", default: 20000, min: 3000, max: 30000, step: 500 },
    rippleStrength: { type: "number", default: 1, min: 0, max: 3, step: 0.1 },
    caption: { type: "string", default: DEFAULT_CAPTION },
    captionFont: { type: "string", default: DEFAULT_FONT },
  },
  create: (runtime) => new PoolEngine(runtime),
};
