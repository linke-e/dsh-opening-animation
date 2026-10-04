// wipe-reveal engine, ported from the vendored image-reveal-animation-using-
// gsap-scrolltrigger project (GSAP timeline → rAF interpolation, no dependency).
// Backdrop = the picture's dominant color. The reveal always runs left → right,
// across the picture's own extent: the picture sits at scale s (0–2) with its
// left edge at xL, where xL/(W - xL) = |1 - s| (W = viewport width), i.e.
// xL = W·|1-s|/(1+|1-s|). Phase 1 is a pure wipe: a clipping container pinned
// at xL grows from 0 to s·W, uncovering the static scaled picture from its
// left edge to its right edge. Phase 2 lands the picture as the backdrop: the
// container's left edge (xL → 0), width (s·W → W) and the picture's scale
// (s → 1) interpolate in lockstep — at every instant the container exactly
// covers the picture's drawn extent — ending on a full-viewport cover, then
// runtime.complete() hands over to the transition (UI fades in).
// The picture element is one viewport wide/tall (object-fit cover), so scale 1
// is its normal full-screen size. Reduced motion renders that final picture
// immediately.

import type {
  AnimationController,
  AnimationRuntime,
  OpeningAnimation,
} from "../registry";
import { extractDominantColor, whenDecoded } from "../dominant-color";

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class WipeRevealEngine implements AnimationController {
  private readonly runtime: AnimationRuntime;
  private readonly root: HTMLDivElement;
  private readonly reveal: HTMLDivElement;
  private readonly img: HTMLImageElement;
  private readonly wipeInMs: number;
  private readonly expandMs: number;
  private readonly imgScale: number;
  /** Picture left edge in % of the viewport: |1-s| ratio rule (see header). */
  private readonly baseLeft: number;

  private startTime = 0;
  private completed = false;
  private destroyed = false;
  private rafId = 0;

  private readonly onImgLoad = (): void => {
    if (this.destroyed) return;
    whenDecoded(this.img, () => {
      if (this.destroyed) return;
      this.root.style.background = extractDominantColor(this.img);
      if (this.runtime.reducedMotion) {
        this.showFinal();
        this.markCompleted();
        return;
      }
      this.beginRun();
    });
  };

  private readonly onImgError = (): void => {
    if (!this.destroyed && !this.completed) this.runtime.fail(new Error("opening image failed to load"));
  };

  constructor(runtime: AnimationRuntime) {
    this.runtime = runtime;
    const p = runtime.params;
    this.wipeInMs = WipeRevealEngine.number(p.wipeInMs, 1400);
    this.expandMs = WipeRevealEngine.number(p.expandMs, 1100);
    this.imgScale = WipeRevealEngine.clamp(WipeRevealEngine.number(p.imgScale, 1.3), 0, 2);
    const k = Math.abs(1 - this.imgScale);
    this.baseLeft = (k / (1 + k)) * 100;

    this.root = document.createElement("div");
    this.root.className = "dsh-opening-wipe";
    this.reveal = document.createElement("div");
    this.reveal.className = "dsh-opening-wipe-reveal";
    this.img = document.createElement("img");
    this.img.className = "dsh-opening-wipe-img";
    this.img.alt = "";
    this.reveal.append(this.img);
    this.root.append(this.reveal);
    this.reveal.style.left = `${this.baseLeft}%`;
    this.reveal.style.width = "0%";
    this.img.style.transform = `scale(${this.imgScale})`;
    runtime.container.append(this.root);

    this.img.addEventListener("load", this.onImgLoad);
    this.img.addEventListener("error", this.onImgError);
  }

  start(): void {
    this.img.src = this.runtime.media.url;
  }

  skip(): void {
    if (this.destroyed || this.completed) return;
    this.cancelRaf();
    if (this.img.complete && this.img.naturalWidth > 0) this.showFinal();
    this.markCompleted();
  }

  destroy(): void {
    this.destroyed = true;
    this.cancelRaf();
    this.img.removeEventListener("load", this.onImgLoad);
    this.img.removeEventListener("error", this.onImgError);
    this.root.remove();
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

  private readonly frame = (now: number): void => {
    if (this.destroyed || this.completed) return;
    const t = now - this.startTime;

    if (t < this.wipeInMs) {
      // Pure wipe: the container pinned at the picture's left edge grows to
      // s·W, uncovering the static scaled picture left edge → right edge.
      const e = easeOutCubic(Math.min(1, t / this.wipeInMs));
      this.reveal.style.width = `${this.imgScale * 100 * e}%`;
    } else if (t < this.wipeInMs + this.expandMs) {
      // Land the picture as the backdrop. Container left, container width and
      // picture scale share one eased progress, so the clipping container
      // always exactly covers the picture's drawn extent.
      const e = easeInOutCubic((t - this.wipeInMs) / this.expandMs);
      this.reveal.style.left = `${this.baseLeft * (1 - e)}%`;
      this.reveal.style.width = `${(this.imgScale + (1 - this.imgScale) * e) * 100}%`;
      this.img.style.transform = `scale(${this.imgScale + (1 - this.imgScale) * e})`;
    } else {
      this.showFinal();
      this.markCompleted();
      return;
    }
    this.rafId = requestAnimationFrame(this.frame);
  };

  private beginRun(): void {
    this.cancelRaf();
    this.startTime = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  /* Freeze on the full-screen backdrop picture (skip / reduced motion / end). */
  private showFinal(): void {
    if (!(this.img.complete && this.img.naturalWidth > 0)) return;
    this.cancelRaf();
    this.reveal.style.left = "0%";
    this.reveal.style.width = "100%";
    this.img.style.transform = "scale(1)";
  }

  private static number(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }

  private static clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}

export const wipeRevealAnimation: OpeningAnimation = {
  id: "wipe-reveal",
  kind: "image",
  labelKey: "anim.wipe-reveal.label",
  descriptionKey: "anim.wipe-reveal.desc",
  paramsSchema: {
    wipeInMs: { type: "number", default: 1400, min: 400, max: 5000, step: 100 },
    expandMs: { type: "number", default: 1100, min: 300, max: 5000, step: 100 },
    imgScale: { type: "number", default: 1.3, min: 0, max: 2, step: 0.05 },
  },
  create: (runtime) => new WipeRevealEngine(runtime),
};
