// code-rain engine — a faithful canvas-2D remake of the hello-matrix piece
// (CodePen by Manan Tank, MIT, https://codepen.io/MananTank/pen/rNVQKPR):
// "Hello World" in 92 languages falls as matrix rain. Every column is one
// stream built from a random phrase, its glyphs descending in lockstep at a
// per-stream random speed; each glyph flickers to a random digit 10% of the
// time, has a 30% chance of rendering one step brighter, and the phrase's
// first glyph (the stream's bottom) dims instead — all over a per-frame 40%
// fade that leaves the falling trails, and glyphs wrap to the top edge as
// they cross the bottom one, like the reference. The viewport starts
// rain-free: every stream enters from above the top edge (its bottom edge
// crossing the top on the way down, staggered per stream), so the rain grows
// in from nothing. The user's picture or video
// sits behind the rain as the backdrop (cover or contain, dimmed by the dim
// param so the rain stays readable; the reference's black ground is what the
// dim overlay paints when no backdrop has arrived yet). The video backdrop
// is a pure backdrop with the constructivism1 semantics: muted autoplay
// (playsInline, loop per param), ended never completes the engine —
// durationMs owns the hand-over; volume > 0 probes an unmute on the first
// playing event and falls back to silent playback; a failing backdrop fails
// the run. The rain starts immediately over the black ground and never
// stops: at durationMs the last frame freezes and the run hands over; skip()
// freezes the same way. Without a 2d context (jsdom) every draw
// short-circuits and the frame loop never starts.

import type {
  AnimationController,
  AnimationRuntime,
  OpeningAnimation,
} from "../registry";

/* "Hello World" in 92 languages — the hello-matrix stream source, verbatim. */
export const LANGS: ReadonlyArray<string> = [
  "Hello World", "مرحبا بالعالم", "Salam Dünya", "Прывітанне Сусвет", "Здравей свят",
  "ওহে বিশ্ব", "Zdravo svijete", "Hola món", "Kumusta Kalibutan", "Ahoj světe",
  "Helo Byd", "Hej Verden", "Hallo Welt", "Γειά σου Κόσμε", "Hello World",
  "Hello World", "Hola Mundo", "Tere, Maailm", "Kaixo Mundua", "سلام دنیا",
  "Hei maailma", "Bonjour le monde", "Dia duit an Domhan", "Ola mundo", "હેલો વર્લ્ડ",
  "Sannu Duniya", "नमस्ते दुनिया", "Hello World", "Pozdrav svijete", "Bonjou Mondyal la",
  "Helló Világ", "Բարեւ աշխարհ", "Halo Dunia", "Ndewo Ụwa", "Halló heimur",
  "Ciao mondo", "שלום עולם", "こんにちは世界", "Hello World", "Გამარჯობა მსოფლიო",
  "Сәлем Әлем", "សួស្តី​ពិភពលោក", "ಹಲೋ ವರ್ಲ್ಡ್", "안녕하세요 월드", "Ciao mondo",
  "ສະ​ບາຍ​ດີ​ຊາວ​ໂລກ", "Labas pasauli", "Sveika pasaule", "Hello World", "Kia Ora",
  "Здраво свету", "ഹലോ വേൾഡ്", "Сайн уу", "हॅलो वर्ल्ड", "Hai dunia",
  "Hello dinja", "မင်္ဂလာပါကမ္ဘာလောက", "नमस्कार संसार", "Hallo Wereld", "Hei Verden",
  "Moni Dziko Lapansi", "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਦੁਨਿਆ", "Witaj świecie", "Olá Mundo", "Salut Lume",
  "Привет, мир", "හෙලෝ වර්ල්ඩ්", "Ahoj svet", "Pozdravljen, svet", "Waad salaaman tihiin",
  "Përshendetje Botë", "Здраво Свете", "Lefatše Lumela", "Halo Dunya", "Hej världen",
  "Salamu, Dunia", "ஹலோ வேர்ல்ட்", "హలో వరల్డ్", "Салом Ҷаҳон", "สวัสดีชาวโลก",
  "Kamusta Mundo", "Selam Dünya", "Привіт Світ", "ہیلو ورلڈ", "Salom Dunyo",
  "Chào thế giới", "העלא וועלט", "Mo ki O Ile Aiye", "你好，世界", "你好，世界",
  "你好，世界", "Sawubona Mhlaba",
];

/** p5 HSB fills from the reference: the plain glyph, the 30%-lit glyph, the
 * dim one (flicker digits and the phrase's first glyph). */
const GREEN_HEAD = "#00FF00";
const GREEN_LIT = "#00E500";
const GREEN_DIM = "#B3FFB3";
const MONO = 'ui-monospace, "Cascadia Mono", Consolas, monospace';
/** The reference's per-frame trail fade (background(0, 0.4)). */
const TRAIL_FADE = 0.4;
/** Per-glyph flicker odds from the reference. */
const DIGIT_FLICKER_P = 0.1;
const LIT_P = 0.3;
/** The reference's per-stream fall speed range, px per 60fps frame. */
const SPEED_MIN = 2;
const SPEED_MAX = 10;
/** The reference runs at a fixed 60fps; faster displays only waste fillText calls. */
const FRAME_MS = 1000 / 60;

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

/** One falling column: a phrase's glyphs in draw order (top first), the
 * phrase's first glyph last, at one glyph per charSize slot. */
export interface RainStream {
  /** Left edge in CSS px (one stream per charSize-wide column). */
  x: number;
  /** Glyphs top-to-bottom; `glyphs[length - 1]` is the phrase's first char. */
  glyphs: string[];
  /** Fall speed in px/s (the reference's random(2, 10) px/frame at 60fps). */
  speedPx: number;
  /** How far this stream starts above the top edge (beyond its own length) —
   * the reference's random(phrase length * 4) * charSize, now staggering the
   * streams' entry into an initially rain-free viewport. */
  startPx: number;
}

/** Deterministic stream schedule: one stream per charSize column across the
 * viewport, each a random phrase with a random speed and start offset. */
export function buildRainStreams(seed: number, vw: number, charSize: number): RainStream[] {
  const rnd = mulberry32((seed ^ 0x51ED270B) >>> 0);
  const streams: RainStream[] = [];
  for (let x = 0; x < vw; x += charSize) {
    const phrase = LANGS[Math.floor(rnd() * LANGS.length)] ?? "Hello World";
    const glyphs: string[] = [];
    for (let i = phrase.length - 1; i >= 0; i--) glyphs.push(phrase[i] ?? " ");
    streams.push({
      x,
      glyphs,
      speedPx: (SPEED_MIN + rnd() * (SPEED_MAX - SPEED_MIN)) * 60,
      startPx: rnd() * phrase.length * 4 * charSize,
    });
  }
  return streams;
}

/** Glyph y positions at t = 0: the whole stream sits above the top edge, so
 * the rain grows in from nothing — each stream's bottom edge enters at the
 * page top and moves down to the page bottom. The per-stream scatter
 * (startPx, the reference's random(length * 4) * charSize) staggers when the
 * streams enter instead of scattering them inside the viewport. */
export function initialGlyphY(stream: RainStream, charSize: number): number[] {
  return stream.glyphs.map((_, k) => (k - stream.glyphs.length) * charSize - stream.startPx);
}

export class CodeRainEngine implements AnimationController {
  private readonly runtime: AnimationRuntime;
  private readonly canvas: HTMLCanvasElement;
  /** Null in environments without a 2d context (jsdom); every draw short-circuits. */
  private readonly ctx: CanvasRenderingContext2D | null;
  /** Transparent trail layer: glyphs land here and fade out per frame, so
   * the backdrop (media + dim) can be composited underneath every frame. */
  private readonly trail: HTMLCanvasElement;
  private readonly trailCtx: CanvasRenderingContext2D | null;
  private readonly media: HTMLImageElement | HTMLVideoElement;
  private readonly durationMs: number;
  private readonly charSize: number;
  private readonly dim: number;
  private readonly fit: "cover" | "contain";
  /** Video backdrop only: the loop param, "once" keeps the final frame. */
  private readonly videoLoop: boolean;
  /** Video backdrop only: configured loudness 0-1; 0 keeps the plain silent behavior. */
  private readonly targetVolume: number;
  private readonly seed = 20260601;

  private vw = 0;
  private vh = 0;
  private dpr = 1;
  private streams: RainStream[] = [];
  /** Per-glyph live y in CSS px, mirroring the reference's per-Char state:
   * each glyph falls independently and wraps to the top edge as it crosses
   * the bottom one (glyph k of stream s starts at startPx + (k+1)*charSize). */
  private glyphY: number[][] = [];
  private startTime = 0;
  private lastDraw = 0;
  private completed = false;
  private destroyed = false;
  /** Video backdrop only: the unmute probe has run (silent fallback is final). */
  private unmuted = false;
  private rafId = 0;
  private completeTimer = 0;
  private resizeTimer = 0;

  private readonly onImgLoad = (): void => {
    if (this.destroyed || this.completed) return;
    this.prepare();
    this.runtime.markLoaded?.();
  };

  private readonly onVideoReady = (): void => {
    if (this.destroyed || this.completed) return;
    this.prepare();
    this.runtime.markLoaded?.();
  };

  private readonly onMediaError = (): void => {
    if (this.destroyed || this.completed) return;
    window.clearTimeout(this.completeTimer);
    this.runtime.fail(new Error("opening media failed to load"));
  };

  private readonly onPlaying = (): void => {
    if (!(this.media instanceof HTMLVideoElement)) return;
    if (this.destroyed || this.completed || this.unmuted) return;
    if (this.targetVolume <= 0) return; // volume 0 keeps the plain silent behavior
    // Behavior probe (video-player's, simplified — no pill here): always try
    // to unmute. A browser that allows audible autoplay leaves it audible;
    // one that does not pauses the video — synchronously or via the pause
    // listener — and we fall back to muted playback so the backdrop never
    // freezes.
    this.unmuted = true;
    this.media.muted = false;
    this.media.volume = this.targetVolume;
    if (this.media.paused) this.fallBackToSilent();
  };

  private readonly onPause = (): void => {
    if (!(this.media instanceof HTMLVideoElement)) return;
    // A pause arriving after the unmute attempt is the autoplay policy
    // rejecting audible playback. A natural end also pauses first, but the
    // video is a backdrop here: ended leaves it frozen on its final frame
    // and never completes this engine (durationMs owns the hand-over).
    if (this.destroyed || this.completed || !this.unmuted || this.media.ended) return;
    this.fallBackToSilent();
  };

  private readonly onResize = (): void => {
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => {
      if (this.destroyed || this.completed) return;
      this.prepare();
    }, 200);
  };

  constructor(runtime: AnimationRuntime) {
    this.runtime = runtime;
    const p = runtime.params;
    this.durationMs = CodeRainEngine.clamp(
      CodeRainEngine.number(p.durationMs, 6000),
      1000,
      30_000,
    );
    this.charSize = CodeRainEngine.clamp(CodeRainEngine.number(p.fontSize, 18), 10, 30);
    this.dim = CodeRainEngine.clamp(CodeRainEngine.number(p.dim, 0.45), 0, 1);
    this.fit = p.mediaFit === "contain" ? "contain" : "cover";
    this.videoLoop = p.loop !== "once";
    // HTMLMediaElement.volume lives in 0-1; the param is 0-100.
    this.targetVolume = CodeRainEngine.clamp(CodeRainEngine.number(p.volume, 0), 0, 100) / 100;

    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.trail = document.createElement("canvas");
    this.trailCtx = this.trail.getContext("2d");
    if (runtime.media.kind === "video") {
      const video = document.createElement("video");
      video.autoplay = true;
      video.muted = true; // playback always starts muted; the probe may unmute
      video.playsInline = true;
      video.loop = this.videoLoop;
      this.media = video;
    } else {
      const img = new Image();
      this.media = img;
    }
    runtime.container.append(this.canvas);
    window.addEventListener("resize", this.onResize);
  }

  start(): void {
    if (this.destroyed || this.completed) return;
    if (this.media instanceof HTMLImageElement) {
      this.media.addEventListener("load", this.onImgLoad);
      this.media.addEventListener("error", this.onMediaError);
    } else {
      this.media.addEventListener("canplay", this.onVideoReady);
      this.media.addEventListener("error", this.onMediaError);
      this.media.addEventListener("playing", this.onPlaying);
      this.media.addEventListener("pause", this.onPause);
    }
    this.media.src = this.runtime.media.url;
    if (this.media instanceof HTMLVideoElement) this.playWithRetry(1);

    // The rain starts immediately over the black ground; the backdrop joins
    // whenever its media has loaded.
    this.prepare();
    this.completeTimer = window.setTimeout(() => this.markCompleted(), this.durationMs);
    if (this.ctx !== null) {
      this.startTime = performance.now();
      this.lastDraw = this.startTime;
      this.rafId = requestAnimationFrame(this.frame);
    }
  }

  skip(): void {
    if (this.destroyed || this.completed) return;
    this.cancelRaf();
    window.clearTimeout(this.completeTimer);
    // Freeze on the current frame: the rain stops where it is, like the
    // reference's canvas simply standing still.
    if (this.media instanceof HTMLVideoElement) {
      try {
        this.media.pause();
      } catch {
        // pausing an unstarted video is harmless
      }
    }
    this.markCompleted();
  }

  destroy(): void {
    this.destroyed = true;
    this.cancelRaf();
    window.clearTimeout(this.completeTimer);
    window.clearTimeout(this.resizeTimer);
    window.removeEventListener("resize", this.onResize);
    if (this.media instanceof HTMLImageElement) {
      this.media.removeEventListener("load", this.onImgLoad);
      this.media.removeEventListener("error", this.onMediaError);
    } else {
      this.media.removeEventListener("canplay", this.onVideoReady);
      this.media.removeEventListener("error", this.onMediaError);
      this.media.removeEventListener("playing", this.onPlaying);
      this.media.removeEventListener("pause", this.onPause);
      try {
        this.media.pause();
        this.media.removeAttribute("src");
        this.media.load();
      } catch {
        // teardown best-effort
      }
    }
    this.canvas.remove();
  }

  private static number(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }

  private static clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
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

  /** Viewport fit, trail layer size, stream schedule. Safe to re-run (resize). */
  private prepare(): void {
    const ctx = this.ctx;
    if (ctx === null) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.vw = this.runtime.container.clientWidth || window.innerWidth;
    this.vh = this.runtime.container.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(this.vw * this.dpr);
    this.canvas.height = Math.round(this.vh * this.dpr);
    this.trail.width = this.canvas.width;
    this.trail.height = this.canvas.height;
    for (const layer of [ctx, this.trailCtx]) {
      layer?.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      layer?.clearRect(0, 0, this.vw, this.vh);
    }
    ctx.font = `${this.charSize}px ${MONO}`;
    if (this.trailCtx !== null) this.trailCtx.font = `${this.charSize}px ${MONO}`;
    this.streams = buildRainStreams(this.seed, this.vw, this.charSize);
    this.glyphY = this.streams.map((stream) => initialGlyphY(stream, this.charSize));
  }

  private readonly frame = (now: number): void => {
    if (this.destroyed || this.completed) return;
    if (now - this.lastDraw >= FRAME_MS) {
      this.renderFrame();
      this.lastDraw = now;
    }
    this.rafId = requestAnimationFrame(this.frame);
  };

  private renderFrame(): void {
    const ctx = this.ctx;
    const trailCtx = this.trailCtx;
    if (ctx === null || trailCtx === null) return;
    this.drawBackdrop(ctx);
    this.stepRain(trailCtx);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(this.trail, 0, 0, this.trail.width, this.trail.height, 0, 0, this.vw, this.vh);
  }

  /** The backdrop: the media frame (or plain black until it arrives), dimmed. */
  private drawBackdrop(ctx: CanvasRenderingContext2D): void {
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, this.vw, this.vh);
    const nw = this.media instanceof HTMLImageElement ? this.media.naturalWidth : this.media.videoWidth;
    const nh = this.media instanceof HTMLImageElement ? this.media.naturalHeight : this.media.videoHeight;
    const ready = this.media instanceof HTMLImageElement
      ? this.media.complete && nw > 0
      : this.media.readyState >= 2 && nw > 0;
    if (ready && nw > 0 && nh > 0) {
      const scale = this.fit === "cover"
        ? Math.max(this.vw / nw, this.vh / nh)
        : Math.min(this.vw / nw, this.vh / nh);
      const dw = nw * scale;
      const dh = nh * scale;
      ctx.drawImage(this.media, (this.vw - dw) / 2, (this.vh - dh) / 2, dw, dh);
    }
    if (this.dim > 0) {
      ctx.fillStyle = `rgba(0,0,0,${this.dim})`;
      ctx.fillRect(0, 0, this.vw, this.vh);
    }
  }

  /** One 60fps step: fade the trail, then draw every glyph at its new spot.
   * Each glyph keeps the reference's per-frame flicker draws and wraps to
   * the top edge on crossing the bottom one, exactly like the p5 original. */
  private stepRain(trailCtx: CanvasRenderingContext2D): void {
    trailCtx.globalCompositeOperation = "destination-out";
    trailCtx.fillStyle = `rgba(0,0,0,${TRAIL_FADE})`;
    trailCtx.fillRect(0, 0, this.vw, this.vh);
    trailCtx.globalCompositeOperation = "source-over";
    trailCtx.textBaseline = "alphabetic";
    trailCtx.textAlign = "left";
    const step = FRAME_MS / 1000;
    for (let s = 0; s < this.streams.length; s++) {
      const stream = this.streams[s];
      if (stream === undefined) continue;
      const ys = this.glyphY[s];
      if (ys === undefined) continue;
      for (let k = 0; k < stream.glyphs.length; k++) {
        let gy = (ys[k] ?? stream.startPx) + stream.speedPx * step;
        if (gy > this.vh) gy = 0; // the reference's per-glyph wrap
        ys[k] = gy;
        if (gy < -this.charSize || gy > this.vh + this.charSize) continue;
        const glyph = stream.glyphs[k] ?? " ";
        if (Math.random() < DIGIT_FLICKER_P) {
          trailCtx.fillStyle = GREEN_DIM;
          trailCtx.fillText(`${Math.round(Math.random() * 9)}`, stream.x, gy);
          continue;
        }
        let color = GREEN_HEAD;
        if (Math.random() < LIT_P) {
          color = k === stream.glyphs.length - 1 ? GREEN_DIM : GREEN_LIT;
        }
        trailCtx.fillStyle = color;
        trailCtx.fillText(glyph, stream.x, gy);
      }
    }
  }

  private fallBackToSilent(): void {
    if (!(this.media instanceof HTMLVideoElement)) return;
    // Back to muted playback (always policy-allowed); unmuted stays true so
    // a later playing event never re-probes and the states cannot loop.
    this.media.muted = true;
    void this.media.play().catch((err: unknown) => {
      console.debug("[dsh-opening-animation] code-rain silent-fallback play rejected", err);
    });
  }

  private playWithRetry(retries: number): void {
    if (this.destroyed || this.completed) return;
    if (!(this.media instanceof HTMLVideoElement)) return;
    void this.media.play().catch(() => {
      if (this.destroyed || this.completed) return;
      if (retries <= 0) {
        this.runtime.fail(new Error("video play() rejected repeatedly"));
        return;
      }
      window.setTimeout(() => {
        this.playWithRetry(retries - 1);
      }, 150);
    });
  }
}

export const codeRainAnimation: OpeningAnimation = {
  id: "code-rain",
  kind: "image",
  labelKey: "anim.code-rain.label",
  descriptionKey: "anim.code-rain.desc",
  paramsSchema: {
    durationMs: { type: "number", default: 6000, min: 1000, max: 30000, step: 500 },
    fontSize: { type: "number", default: 18, min: 10, max: 30, step: 2 },
    dim: { type: "number", default: 0.45, min: 0, max: 1, step: 0.05 },
    mediaFit: { type: "enum", default: "cover", options: ["cover", "contain"] },
  },
  create: (runtime) => new CodeRainEngine(runtime),
};

export const codeRainVideoAnimation: OpeningAnimation = {
  id: "code-rain-video",
  kind: "video",
  labelKey: "anim.code-rain.label",
  descriptionKey: "anim.code-rain.desc",
  paramsSchema: {
    durationMs: { type: "number", default: 6000, min: 1000, max: 30000, step: 500 },
    fontSize: { type: "number", default: 18, min: 10, max: 30, step: 2 },
    dim: { type: "number", default: 0.45, min: 0, max: 1, step: 0.05 },
    mediaFit: { type: "enum", default: "cover", options: ["cover", "contain"] },
    loop: { type: "enum", default: "loop", options: ["loop", "once"] },
    volume: { type: "number", default: 0, min: 0, max: 100, step: 5 },
  },
  create: (runtime) => new CodeRainEngine(runtime),
};
