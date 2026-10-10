// glitch engine, "Monoclonal Ghost" cut. The picture fills the screen and the
// camera pushes in slowly — a Ken-Burns zoom from 1.02 to 1.08 with a slight
// rightward drift — over a graded frame: cooled blues, a warm window glow in
// the upper right, darkened corners. Painted on top every frame: ~50 dust
// motes drifting down (denser and brighter inside the window light), RGB
// fringe pulses on the screen edges every couple of seconds, and full-screen
// film grain refreshed every frame. Every so often the signal breaks up for
// 100–180 ms, VHS style: the container gets a .glitching class, the picture
// is cut into eight horizontal bands, three to five of them jump sideways —
// mostly small jitters plus occasional big shifts, a couple sheared skew-wise
// — and the offsets re-roll two or three times within the burst while
// brightness flickers; the current caption word splits into red / cyan
// ghosts with a wider letter-spacing. A DOM caption sits low and left,
// playing karaoke: words wrapped in [brackets] light up white one after
// another while earlier ones fade back to grey. Bursts are scheduled by a
// self-rescheduling random timeout (1.5–3 s gaps) — never a fixed beat.
// Underneath it all a VHS tracking wave runs the whole time: the graded
// frame is drawn as ~14 thick horizontal slices, each pushed up/down by a
// sine that travels from the bottom edge to the top (1.5–2 crests per
// second, 80–160 px wavelength), strongest at the top (±8–15 px) and dying
// out toward the bottom where a ±2 px slow breath keeps the frame barely
// alive. Every frame is a handful of drawImage and fillRect calls — nothing
// per-pixel.
// After durationMs the engine freezes on the final graded frame and hands
// over to the transition; reduced motion renders that frame at once; skip()
// does the same and drops the caption.

import type {
  AnimationController,
  AnimationRuntime,
  OpeningAnimation,
} from "../registry";

/** Camera: zoom range over the run and the rightward drift (viewport widths). */
const ZOOM_START = 1.02;
const ZOOM_END = 1.08;
const SHIFT_X = 0.025;
/** Graded base oversize so the pushed-in frame never runs out of picture. */
const BASE_PAD = 1.12;

const DUST_COUNT = 50;
const GRAIN_FRAMES = 5;
const GRAIN_ALPHA = 0.05;

const CAPTION_IN_MS = 600;
const KARAOKE_AT_MS = 1200;
const KARAOKE_STEP_MAX = 900;
const KARAOKE_STEP_MIN = 300;
const KARAOKE_TAIL_MS = 800;

const PULSE_LEN = 260;

/** Random VHS bursts: gap between bursts, burst length, band count and shift
 * ranges (small jitters + occasional big jumps), skew range, and how many
 * times the offsets re-roll inside one burst — all in ms / px / tan. */
const GLITCH_GAP_MS = [1500, 3000] as const;
const GLITCH_LEN_MS = [100, 180] as const;
const GLITCH_BANDS = 8;
const GLITCH_BAND_COUNT = [3, 5] as const;
const GLITCH_DX_SMALL = [5, 14] as const;
const GLITCH_DX_BIG = [12, 34] as const;
const GLITCH_BIG_CHANCE = 0.4;
const GLITCH_SKEW = [0.09, 0.3] as const;
const GLITCH_SKEW_CHANCE = 0.3;
const GLITCH_BRIGHT = [0.9, 1.15] as const;
const GLITCH_PHASES = [2, 3] as const;

/** VHS tracking wave: a permanent, low-amplitude sine that travels from the
 * bottom edge to the top through ~14 thick horizontal slices. */
const WAVE_SLICES = 14;
const WAVE_LAMBDA = [80, 160] as const; // px per crest
const WAVE_CRESTS_PER_SEC = [1.5, 2] as const;
const WAVE_TOP_AMP = [8, 15] as const; // px at the top edge
const WAVE_BREATH = 2; // px ambient breathing near the bottom
const WAVE_BREATH_PERIOD = 6; // seconds per breath cycle
const WAVE_X_FACTOR = 0.35; // slight sideways sway share of the push
const WAVE_SEAM = 8; // px of spare each slice draws past its edges, so adjacent slices always interlock

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
 * Empty brackets vanish and an unclosed bracket degrades to plain text. */
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

/** Camera state at normalized progress p: zoom 1.02→1.08, drift 0→SHIFT_X. */
export function kenBurns(p: number): { zoom: number; shift: number } {
  const t = Math.min(1, Math.max(0, p));
  return { zoom: ZOOM_START + (ZOOM_END - ZOOM_START) * t, shift: SHIFT_X * t };
}

/** Karaoke step for `count` highlights: aim for a leisurely pace, but never
 * so slow that the words can't all light up before the run ends — when the
 * budget is tight the step speeds up (down to 300 ms) instead of running out. */
export function karaokeStepMs(durationMs: number, count: number): number {
  const ideal = (durationMs - KARAOKE_AT_MS - KARAOKE_TAIL_MS) / Math.max(1, count);
  return Math.min(KARAOKE_STEP_MAX, Math.max(KARAOKE_STEP_MIN, ideal));
}

export interface WaveConfig {
  /** Px per crest. */
  lambda: number;
  /** Crests passing a fixed row per second. */
  crests: number;
  /** Push amplitude at the very top edge, px. */
  topAmp: number;
}

/** Tracking-wave offset for one slice at `depthPx` above the bottom edge of a
 * frame `frameH` tall. The sine phase travels upward (deeper = later), the
 * envelope is strongest at the top and dies toward the bottom, and a slow
 * ±2 px breath keeps the whole frame gently alive. */
export function waveOffset(depthPx: number, frameH: number, tSec: number, cfg: WaveConfig): { dy: number; dx: number } {
  const topFactor = frameH > 0 ? Math.min(1, Math.max(0, depthPx / frameH)) : 0;
  const envelope = Math.pow(topFactor, 1.5) * cfg.topAmp;
  const breath = WAVE_BREATH * Math.sin((Math.PI * 2 * tSec) / WAVE_BREATH_PERIOD);
  const phase = Math.PI * 2 * (depthPx / cfg.lambda - tSec * cfg.crests);
  return {
    dy: envelope * Math.sin(phase) + breath,
    dx: envelope * WAVE_X_FACTOR * Math.sin(phase + Math.PI / 2),
  };
}

export interface GlitchBand {
  /** Horizontal band index, 0 (top) … GLITCH_BANDS-1 (bottom). */
  index: number;
  /** Sideways shift in CSS px, signed. */
  dx: number;
  /** Horizontal shear around the band's center (tan); 0 = none. */
  skew: number;
}

/** One burst phase displaces 3–5 of the eight horizontal bands: mostly small
 * jitters with the occasional big jump, and some bands also shear. */
export function rollGlitchBands(): GlitchBand[] {
  const count = GLITCH_BAND_COUNT[0] + Math.floor(Math.random() * (GLITCH_BAND_COUNT[1] - GLITCH_BAND_COUNT[0] + 1));
  const indices = Array.from({ length: GLITCH_BANDS }, (_, i) => i);
  const bands: GlitchBand[] = [];
  for (let n = 0; n < count; n++) {
    const index = indices.splice(Math.floor(Math.random() * indices.length), 1)[0]!;
    const range = Math.random() < GLITCH_BIG_CHANCE ? GLITCH_DX_BIG : GLITCH_DX_SMALL;
    const dx = (range[0] + Math.random() * (range[1] - range[0])) * (Math.random() < 0.5 ? -1 : 1);
    const skew =
      Math.random() < GLITCH_SKEW_CHANCE
        ? (GLITCH_SKEW[0] + Math.random() * (GLITCH_SKEW[1] - GLITCH_SKEW[0])) * (Math.random() < 0.5 ? -1 : 1)
        : 0;
    bands.push({ index, dx: Math.round(dx), skew });
  }
  return bands;
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
/** The lit word during a burst: red/cyan ghosts plus a wider tracking. */
const K_GLITCH_STYLE = [
  "font-weight:700",
  "color:#eef1f3",
  "text-shadow:-2px 0 rgba(255,0,80,0.8),2px 0 rgba(0,200,255,0.8),0 1px 3px rgba(0,0,0,0.55)",
  "letter-spacing:2px",
  "transition:color 0.55s ease,text-shadow 0.05s ease,letter-spacing 0.05s ease",
].join(";");

export class GlitchEngine implements AnimationController {
  private readonly runtime: AnimationRuntime;
  private readonly canvas: HTMLCanvasElement;
  /** Null in environments without a 2d context (jsdom); drawing short-circuits. */
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly img = new Image();
  private readonly durationMs: number;
  private readonly captionText: string;
  private readonly captionFont: string;

  private vw = 0;
  private vh = 0;
  private dpr = 1;
  /** Graded picture (cool grade + window glow + vignette), oversized for the camera. */
  private base: HTMLCanvasElement | null = null;
  private grains: HTMLCanvasElement[] = [];
  private dust: Dust[] = [];
  private pulseAt = Number.POSITIVE_INFINITY;
  private fringe: FringeBar[] = [];
  private captionEl: HTMLElement | null = null;
  private karaokeSpans: HTMLElement[] = [];
  private karaokeIdx = -1;
  private karaokeStep = KARAOKE_STEP_MAX;
  private glitchTimer = 0;
  private glitchStart = 0;
  private glitchLen = 0;
  private glitchOn = false;
  private glitchPhases: GlitchBand[][] = [];
  private waveCfg: WaveConfig = { lambda: 120, crests: 1.75, topAmp: 11 };
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

  constructor(runtime: AnimationRuntime) {
    this.runtime = runtime;
    const p = runtime.params;
    this.durationMs = GlitchEngine.number(p.durationMs, 20000);
    this.captionText = typeof p.caption === "string" ? p.caption : DEFAULT_CAPTION;
    this.captionFont =
      typeof p.captionFont === "string" && p.captionFont.trim() !== "" ? p.captionFont : DEFAULT_FONT;

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
    this.stopGlitch();
    this.cancelRaf();
    window.clearTimeout(this.resizeTimer);
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

  /* Viewport fit, graded base, grain frames, dust field, fringe schedule. */
  private buildLayout(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.vw = this.runtime.container.clientWidth || window.innerWidth;
    this.vh = this.runtime.container.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(this.vw * this.dpr);
    this.canvas.height = Math.round(this.vh * this.dpr);
    this.buildBase();
    this.buildGrain();
    this.dust = Array.from({ length: DUST_COUNT }, () => this.rollDust(true));
    this.pulseAt = 800 + Math.random() * 400;
    this.rollFringe();
  }

  /* Bake the look once: cover-fit the picture oversized, cool the grade down,
   * lay a warm glow where the window light sits, darken the corners. */
  private buildBase(): void {
    const W = Math.ceil(this.vw * BASE_PAD);
    const H = Math.ceil(this.vh * BASE_PAD);
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

  /* Build the karaoke caption once: plain words stay grey, bracketed words
   * become spans that light up white one after another. */
  private buildCaption(): void {
    this.removeCaption();
    const lines = parseCaption(this.captionText);
    const total = lines.reduce((n, line) => n + line.length, 0);
    this.karaokeStep = karaokeStepMs(this.durationMs, total);
    const box = document.createElement("div");
    box.setAttribute("class", "dsh-opening-glitch-caption");
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
      spans[idx]!.setAttribute("style", this.glitchOn ? K_GLITCH_STYLE : K_ON_STYLE);
    } else {
      for (let i = 0; i < spans.length; i++) spans[i]!.setAttribute("style", K_SPAN_STYLE);
    }
    this.karaokeIdx = idx;
  }

  /* VHS bursts: a self-rescheduling random timeout fires a 100–180 ms burst
   * after a 1.5–3 s gap — no fixed beat. A burst re-rolls its band offsets
   * two or three times while it lasts (the tear keeps jumping), shears a few
   * bands, flickers brightness, and ghosts the lit word. */
  private scheduleGlitch(): void {
    this.glitchTimer = window.setTimeout(() => {
      if (this.destroyed || this.completed) return;
      const span = GLITCH_LEN_MS[1] - GLITCH_LEN_MS[0];
      const len = GLITCH_LEN_MS[0] + Math.random() * span;
      this.glitchOn = true;
      this.glitchStart = performance.now();
      this.glitchLen = len;
      const phases = GLITCH_PHASES[0] + Math.floor(Math.random() * (GLITCH_PHASES[1] - GLITCH_PHASES[0] + 1));
      this.glitchPhases = Array.from({ length: phases }, () => rollGlitchBands());
      this.runtime.container.classList.add("glitching");
      this.setCaptionGlitch(true);
      this.glitchTimer = window.setTimeout(() => {
        this.stopGlitch();
        this.scheduleGlitch();
      }, len);
    }, GLITCH_GAP_MS[0] + Math.random() * (GLITCH_GAP_MS[1] - GLITCH_GAP_MS[0]));
  }

  private stopGlitch(): void {
    window.clearTimeout(this.glitchTimer);
    this.glitchTimer = 0;
    this.glitchOn = false;
    this.glitchStart = 0;
    this.glitchLen = 0;
    this.glitchPhases = [];
    this.runtime.container.classList.remove("glitching");
    const i = this.karaokeIdx;
    if (i >= 0 && i < this.karaokeSpans.length) {
      this.karaokeSpans[i]!.setAttribute("style", K_ON_STYLE);
    }
  }

  private setCaptionGlitch(on: boolean): void {
    const i = this.karaokeIdx;
    if (i < 0 || i >= this.karaokeSpans.length) return;
    this.karaokeSpans[i]!.setAttribute("style", on ? K_GLITCH_STYLE : K_ON_STYLE);
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
    this.waveCfg = {
      lambda: WAVE_LAMBDA[0] + Math.random() * (WAVE_LAMBDA[1] - WAVE_LAMBDA[0]),
      crests: WAVE_CRESTS_PER_SEC[0] + Math.random() * (WAVE_CRESTS_PER_SEC[1] - WAVE_CRESTS_PER_SEC[0]),
      topAmp: WAVE_TOP_AMP[0] + Math.random() * (WAVE_TOP_AMP[1] - WAVE_TOP_AMP[0]),
    };
    this.startTime = performance.now();
    this.lastNow = this.startTime;
    this.rafId = requestAnimationFrame(this.frame);
    this.scheduleGlitch();
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
    const kb = kenBurns(t / this.durationMs);
    const w = this.vw * kb.zoom;
    const h = this.vh * kb.zoom;
    const bx = (this.vw - w) / 2 + kb.shift * this.vw;
    const by = (this.vh - h) / 2;
    if (this.base !== null) {
      if (this.glitchOn && this.glitchPhases.length > 0) {
        // VHS tear: eight horizontal slices, 3–5 of them shoved sideways
        // (a few sheared) while brightness flickers between 0.9 and 1.15;
        // the offsets re-roll two or three times inside one burst.
        ctx.filter = `brightness(${(GLITCH_BRIGHT[0] + Math.random() * (GLITCH_BRIGHT[1] - GLITCH_BRIGHT[0])).toFixed(3)})`;
        const elapsed = now - this.glitchStart;
        const phase = this.glitchPhases[
          Math.min(this.glitchPhases.length - 1, Math.floor((elapsed / this.glitchLen) * this.glitchPhases.length))
        ]!;
        const bh = h / GLITCH_BANDS;
        for (let i = 0; i < GLITCH_BANDS; i++) {
          const band = phase.find((b) => b.index === i);
          const sy = (i * this.base.height) / GLITCH_BANDS;
          const sh = this.base.height / GLITCH_BANDS;
          const ty = by + i * bh;
          if (band === undefined) {
            ctx.drawImage(this.base, 0, sy, this.base.width, sh, bx, ty, w, bh);
          } else if (band.skew !== 0) {
            ctx.save();
            const cy = ty + bh / 2;
            ctx.translate(0, cy);
            ctx.transform(1, 0, band.skew, 1, 0, 0);
            ctx.translate(0, -cy);
            ctx.drawImage(this.base, 0, sy, this.base.width, sh, bx + band.dx, ty, w, bh);
            ctx.restore();
          } else {
            ctx.drawImage(this.base, 0, sy, this.base.width, sh, bx + band.dx, ty, w, bh);
          }
        }
        ctx.filter = "none";
      } else {
        // VHS tracking wave: thick slices pushed by a sine that travels from
        // the bottom edge to the top. Adjacent slices can differ by more than
        // 20 px at the top (a wavelength is barely one or two slices tall), so
        // a fixed overlap can't close the gaps: every slice instead stretches
        // down to the NEXT slice's pushed top edge plus a little spare, and a
        // little spare sideways, so the stack always interlocks.
        const slices = WAVE_SLICES;
        const bh = h / slices;
        const tSec = t / 1000;
        const offs = [];
        for (let i = 0; i < slices; i++) {
          const depthPx = h * (1 - (i + 0.5) / slices);
          offs.push(waveOffset(depthPx, h, tSec, this.waveCfg));
        }
        for (let i = 0; i < slices; i++) {
          const o = offs[i]!;
          const next = offs[i + 1];
          const topI = by + i * bh + o.dy;
          const topNext = i + 1 < slices ? by + (i + 1) * bh + next!.dy : topI + bh;
          const drawH = Math.max(2, topNext - topI + WAVE_SEAM);
          const srcY = (i * this.base.height) / slices;
          const srcH = Math.min(
            (this.base.height / slices) * (drawH / bh),
            this.base.height - srcY,
          );
          ctx.drawImage(
            this.base,
            0, srcY, this.base.width, srcH,
            bx + o.dx - WAVE_SEAM, topI, w + 2 * WAVE_SEAM, drawH,
          );
        }
      }
    }
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

  /* Final graded frame at the end of the camera move (skip/reduced motion
   * also drops the caption; the natural end keeps it for the hand-over). */
  private showClean(keepCaption: boolean): void {
    this.stopGlitch();
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
    const kb = kenBurns(1);
    const w = this.vw * kb.zoom;
    const h = this.vh * kb.zoom;
    if (this.base !== null) {
      ctx.drawImage(this.base, (this.vw - w) / 2 + kb.shift * this.vw, (this.vh - h) / 2, w, h);
    }
  }
}

export const glitchAnimation: OpeningAnimation = {
  id: "glitch",
  kind: "image",
  labelKey: "anim.glitch.label",
  descriptionKey: "anim.glitch.desc",
  paramsSchema: {
    durationMs: { type: "number", default: 20000, min: 3000, max: 30000, step: 500 },
    caption: { type: "string", default: DEFAULT_CAPTION },
    captionFont: { type: "string", default: DEFAULT_FONT },
  },
  create: (runtime) => new GlitchEngine(runtime),
};
