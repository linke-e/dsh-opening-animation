// constructivism1 engine — a constructivist poster collage (Rodchenko /
// Lissitzky school, look-referenced from the blue/ink/warm-paper DeepSeek V4
// campaign poster): a warm-paper ground with ink-black geometry,
// constructivist-blue bars, one blue wedge and an ink disc, halftone screens
// and thin ink rules; the user's picture or video sits in the large sharply
// clipped polygon right of center — an ink plate behind it reads as a heavy
// stroke, and misregistered blue/deep-navy under-layers add the print-offset
// feel; an opaque solid-ink collage block presses over the window's
// bottom-right and an irregular ink triangle over its top-right,
// both hard-cutting in while the window unfolds. A skewed ink DEEPSEEK brand
// plate sits top-left; caption blocks (the caption param split on "|", at
// most three) slam down the left column on alternating ink/paper plates with
// a ±1° collage tilt. Every element animates on the shared --cst-total
// duration (durationMs) through its own percentage windows — no negative
// delays: 0-6% the paper hard-cuts in while the top band sweeps across;
// 5-18% the geometry cuts in on the steep cubic-bezier(0.85, 0, 0.15, 1);
// 15-32% the blue wedge sweeps past while the media polygon unfolds from a
// diagonal slit; 18-24% the solid-ink collage block and 21-27% the ink
// triangle hard-cut over the window's corners; 30-58% the caption blocks
// slam in one by one (scale 1.6 → 1); 58-90% is a breathing hold (the media
// eases 1 → 1.045, the lower bar drifts, the halftone-a triangle
// flickers); 90-100% settles. setTimeout(durationMs) then completes the run. The resting styles
// in styles.ts ARE the final frame: .dsh-opening-cst-final (skip) just
// switches the animations off. The video variant keeps the video as a
// pure backdrop: muted autoplay (playsInline, loop per param) — ended never
// completes the engine, durationMs owns the hand-over. volume > 0 probes an
// unmute on the first playing event and falls back to silent playback when
// the autoplay policy pauses it (the video-player engine's behavior probe,
// without its pill); error → fail on both variants.

import type {
  AnimationController,
  AnimationRuntime,
  OpeningAnimation,
} from "../registry";

/** Built-in headline when the caption param is empty or only separators. */
const DEFAULT_CAPTION = "DEEPSEEK|HARNESS";
/** The brand plate text — a fixed visual mark of this engine, not a param. */
const BRAND_TEXT = "DEEPSEEK";
/** More than three poster blocks would crowd the left column. */
const MAX_CAPTION_BLOCKS = 3;

const DEFAULT_DURATION_MS = 6500;
const MIN_DURATION_MS = 3000;
const MAX_DURATION_MS = 20000;

/** Split the caption param into at most three poster blocks; blank segments
 * are dropped, and an empty result falls back to the built-in headline.
 *
 * @param caption - Raw caption param, blocks separated by "|".
 * @returns One to three caption lines, ready for uppercase display.
 */
export function captionLines(caption: string): string[] {
  const lines = caption
    .split("|")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) lines.push(...DEFAULT_CAPTION.split("|"));
  return lines.slice(0, MAX_CAPTION_BLOCKS);
}

function div(className: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = className;
  return el;
}

export class Constructivism1Engine implements AnimationController {
  private readonly runtime: AnimationRuntime;
  private readonly root: HTMLDivElement;
  private readonly mediaEl: HTMLImageElement | HTMLVideoElement;
  private readonly durationMs: number;
  /** Video variant only: the loop param, "once" keeps the final frame. */
  private readonly videoLoop: boolean;
  /** Video variant only: configured loudness 0-1; 0 keeps the plain silent behavior. */
  private readonly targetVolume: number;

  private completeTimer = 0;
  private completed = false;
  private destroyed = false;
  /** Video variant only: the unmute probe has run (silent fallback is final). */
  private unmuted = false;

  private readonly onImgLoad = (): void => {
    if (this.destroyed) return;
    this.runtime.markLoaded?.();
  };

  private readonly onVideoReady = (): void => {
    if (this.destroyed || this.completed) return;
    this.runtime.markLoaded?.();
  };

  private readonly onMediaError = (): void => {
    if (this.destroyed || this.completed) return;
    // A late timer must never complete after the failure hand-over.
    window.clearTimeout(this.completeTimer);
    this.runtime.fail(new Error("opening media failed to load"));
  };

  private readonly onPlaying = (): void => {
    if (!(this.mediaEl instanceof HTMLVideoElement)) return;
    if (this.destroyed || this.completed || this.unmuted) return;
    if (this.targetVolume <= 0) return; // volume 0 keeps the plain silent behavior
    // Behavior probe (video-player's, simplified — no pill here): always try
    // to unmute. A browser that allows audible autoplay leaves it audible;
    // one that does not pauses the video — synchronously (handled below) or
    // asynchronously (handled by the pause listener) — and we fall back to
    // muted playback so the backdrop never freezes.
    this.unmuted = true;
    this.mediaEl.muted = false;
    this.mediaEl.volume = this.targetVolume;
    if (this.mediaEl.paused) this.fallBackToSilent();
  };

  private readonly onPause = (): void => {
    if (!(this.mediaEl instanceof HTMLVideoElement)) return;
    // A pause arriving after the unmute attempt is the autoplay policy
    // rejecting audible playback. A natural end also pauses first, but the
    // video is a backdrop here: ended leaves it frozen on its final frame
    // and never completes this engine (durationMs owns the hand-over).
    if (this.destroyed || this.completed || !this.unmuted || this.mediaEl.ended) return;
    this.fallBackToSilent();
  };

  constructor(runtime: AnimationRuntime) {
    this.runtime = runtime;
    const p = runtime.params;
    this.durationMs = Constructivism1Engine.clamp(
      Constructivism1Engine.number(p.durationMs, DEFAULT_DURATION_MS),
      MIN_DURATION_MS,
      MAX_DURATION_MS,
    );
    this.videoLoop = p.loop !== "once";
    // HTMLMediaElement.volume lives in 0-1; the param is 0-100.
    this.targetVolume = Constructivism1Engine.clamp(Constructivism1Engine.number(p.volume, 0), 0, 100) / 100;
    const fit = p.mediaFit === "contain" ? "contain" : "cover";
    const accent = typeof p.accentColor === "string" ? p.accentColor.trim() : "";
    const caption = typeof p.caption === "string" ? p.caption : "";

    this.root = div("dsh-opening-cst");
    this.root.style.setProperty("--cst-total", `${this.durationMs}ms`);
    if (accent.length > 0) this.root.style.setProperty("--cst-accent", accent);

    const paper = div("dsh-opening-cst-paper");
    const band = div("dsh-opening-cst-band");
    const lines = div("dsh-opening-cst-lines");
    const halftoneA = div("dsh-opening-cst-halftone-a");
    const halftoneB = div("dsh-opening-cst-halftone-b");
    const stripeA = div("dsh-opening-cst-stripe-a");
    const stripeB = div("dsh-opening-cst-stripe-b");
    const wedge = div("dsh-opening-cst-wedge");
    const disc = div("dsh-opening-cst-disc");

    // The media polygon: misregistered blue/deep-navy under-layers and the
    // ink stroke plate sit behind the clipped media window; all four layers
    // unfold from the same diagonal slit through one shared clip animation.
    const frame = div("dsh-opening-cst-frame");
    const layerBlue = div("dsh-opening-cst-layer dsh-opening-cst-frame-blue");
    const layerDeep = div("dsh-opening-cst-layer dsh-opening-cst-frame-deep");
    const layerInk = div("dsh-opening-cst-layer dsh-opening-cst-frame-ink");
    const layerClip = div("dsh-opening-cst-layer dsh-opening-cst-frame-clip");
    if (runtime.media.kind === "video") {
      const video = document.createElement("video");
      video.className = "dsh-opening-cst-media";
      video.autoplay = true;
      video.muted = true; // playback always starts muted; the probe may unmute
      video.playsInline = true;
      video.loop = this.videoLoop;
      video.style.objectFit = fit;
      this.mediaEl = video;
    } else {
      const img = document.createElement("img");
      img.className = "dsh-opening-cst-media";
      img.alt = "";
      img.style.objectFit = fit;
      this.mediaEl = img;
    }
    layerClip.append(this.mediaEl);
    frame.append(layerBlue, layerDeep, layerInk, layerClip);

    // The two collage pieces pressed over the window's corners: z 4 — above
    // the media frame (3), below the caption column (5), per styles.ts.
    const corner = div("dsh-opening-cst-corner");
    const tri = div("dsh-opening-cst-tri");

    const brand = div("dsh-opening-cst-brand");
    brand.textContent = BRAND_TEXT;
    const col = div("dsh-opening-cst-col");
    captionLines(caption).forEach((line, index) => {
      const block = div(
        `dsh-opening-cst-block ${index % 2 === 0 ? "dsh-opening-cst-block-ink" : "dsh-opening-cst-block-paper"} dsh-opening-cst-block-${index}`,
      );
      block.textContent = line;
      block.style.setProperty("--cst-rot", `${index % 2 === 0 ? -1 : 1}deg`);
      block.style.setProperty("--cst-shift", `${(index * 1.6).toFixed(1)}vw`);
      col.append(block);
    });

    this.root.append(paper, lines, halftoneB, stripeA, stripeB, frame, corner, tri, wedge, disc, halftoneA, col, brand, band);
    runtime.container.append(this.root);

    if (this.mediaEl instanceof HTMLImageElement) {
      this.mediaEl.addEventListener("load", this.onImgLoad);
      this.mediaEl.addEventListener("error", this.onMediaError);
    } else {
      this.mediaEl.addEventListener("canplay", this.onVideoReady);
      this.mediaEl.addEventListener("error", this.onMediaError);
      this.mediaEl.addEventListener("playing", this.onPlaying);
      this.mediaEl.addEventListener("pause", this.onPause);
    }
  }

  start(): void {
    if (this.destroyed || this.completed) return;
    this.mediaEl.src = this.runtime.media.url;
    if (this.mediaEl instanceof HTMLVideoElement) this.playWithRetry(1);
    this.completeTimer = window.setTimeout(() => this.markCompleted(), this.durationMs);
  }

  skip(): void {
    if (this.destroyed || this.completed) return;
    this.root.classList.add("dsh-opening-cst-final");
    // The final frame must be a freeze: pause the video backdrop so it does
    // not keep playing (or sounding) through the hand-off transition.
    if (this.mediaEl instanceof HTMLVideoElement) {
      try {
        this.mediaEl.pause();
      } catch {
        // pausing an unstarted video is harmless
      }
    }
    this.markCompleted();
  }

  destroy(): void {
    this.destroyed = true;
    window.clearTimeout(this.completeTimer);
    if (this.mediaEl instanceof HTMLImageElement) {
      this.mediaEl.removeEventListener("load", this.onImgLoad);
      this.mediaEl.removeEventListener("error", this.onMediaError);
    } else {
      this.mediaEl.removeEventListener("canplay", this.onVideoReady);
      this.mediaEl.removeEventListener("error", this.onMediaError);
      this.mediaEl.removeEventListener("playing", this.onPlaying);
      this.mediaEl.removeEventListener("pause", this.onPause);
      try {
        this.mediaEl.pause();
        this.mediaEl.removeAttribute("src");
        this.mediaEl.load();
      } catch {
        // teardown best-effort
      }
    }
    this.root.remove();
  }

  private markCompleted(): void {
    if (this.completed) return;
    this.completed = true;
    window.clearTimeout(this.completeTimer);
    this.runtime.complete();
  }

  private fallBackToSilent(): void {
    if (!(this.mediaEl instanceof HTMLVideoElement)) return;
    // Back to muted playback (always policy-allowed); unmuted stays true so
    // a later playing event never re-probes and the states cannot loop.
    this.mediaEl.muted = true;
    void this.mediaEl.play().catch((err: unknown) => {
      console.debug("[dsh-opening-animation] constructivism1 silent-fallback play rejected", err);
    });
  }

  private playWithRetry(retries: number): void {
    if (this.destroyed || this.completed) return;
    if (!(this.mediaEl instanceof HTMLVideoElement)) return;
    void this.mediaEl.play().catch(() => {
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

  private static number(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }

  private static clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}

export const constructivism1Animation: OpeningAnimation = {
  id: "constructivism1",
  kind: "image",
  labelKey: "anim.constructivism1.label",
  descriptionKey: "anim.constructivism1.desc",
  paramsSchema: {
    durationMs: { type: "number", default: DEFAULT_DURATION_MS, min: MIN_DURATION_MS, max: MAX_DURATION_MS, step: 250 },
    caption: { type: "string", default: "" },
    mediaFit: { type: "enum", default: "cover", options: ["cover", "contain"] },
    accentColor: { type: "string", default: "#173F9E" },
  },
  create: (runtime) => new Constructivism1Engine(runtime),
};

export const constructivism1VideoAnimation: OpeningAnimation = {
  id: "constructivism1-video",
  kind: "video",
  labelKey: "anim.constructivism1.label",
  descriptionKey: "anim.constructivism1.desc",
  paramsSchema: {
    durationMs: { type: "number", default: DEFAULT_DURATION_MS, min: MIN_DURATION_MS, max: MAX_DURATION_MS, step: 250 },
    caption: { type: "string", default: "" },
    mediaFit: { type: "enum", default: "cover", options: ["cover", "contain"] },
    accentColor: { type: "string", default: "#173F9E" },
    loop: { type: "enum", default: "loop", options: ["loop", "once"] },
    volume: { type: "number", default: 0, min: 0, max: 100, step: 5 },
  },
  create: (runtime) => new Constructivism1Engine(runtime),
};
