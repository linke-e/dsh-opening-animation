// OverlayRunner: owns the fullscreen overlay lifecycle.
// mount() → engine plays inside .dsh-opening-stage → completion (engine
// complete / user skip / watchdog) → transition per TransitionPreset →
// destroy(). Every failure path is fail-open: abort() tears the overlay down
// without a transition and restores #root, because the opening animation is
// decoration and must never trap the UI (ADR-005).

import { removeCriticalStyles } from "./styles";
import type { AnimationController, AnimationRuntime, OpeningAnimation, ResolvedMedia } from "./registry";
import type { TransitionPreset } from "./transitions";

export interface OverlayRunnerOptions {
  animation: OpeningAnimation;
  media: ResolvedMedia;
  transition: TransitionPreset;
  transitionScale: number;
  /** Image animations only; videos always play to the end. */
  maxDurationMs: number;
  showSkipHint: boolean;
  reducedMotion: boolean;
  /** Merged engine parameters (read for the overlay backdrop color). */
  params: Readonly<Record<string, unknown>>;
  t: (key: string) => string;
  /** Called exactly once when the overlay is fully torn down. */
  onDone: () => void;
}

const LOAD_TIMEOUT_MS = 8000;
const VIDEO_STALL_MS = 10000;
const VIDEO_CHECK_INTERVAL_MS = 1000;
const SKIP_HINT_DELAY_MS = 800;
const TRANSITION_BUFFER_MS = 150;

interface CapturedRootInline {
  opacity: string;
  transform: string;
  transition: string;
}

export class OverlayRunner {
  private readonly opts: OverlayRunnerOptions;
  private rootEl: HTMLDivElement | null = null;
  private stageEl: HTMLDivElement | null = null;
  private engine: AnimationController | null = null;
  private phase: "idle" | "playing" | "transition" | "destroyed" = "idle";
  private transitionStarted = false;
  private readonly timers = new Set<number>();
  private capturedRootInline: CapturedRootInline | null = null;
  private videoProgressAt = 0;

  private readonly onSkipClick = (): void => {
    this.requestSkip();
  };

  private readonly onKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") this.requestSkip();
  };

  private readonly onTimeUpdate = (): void => {
    this.videoProgressAt = Date.now();
  };

  constructor(opts: OverlayRunnerOptions) {
    this.opts = opts;
  }

  mount(): void {
    if (this.phase !== "idle") return;
    this.phase = "playing";

    const root = document.createElement("div");
    root.className = "dsh-opening-root";
    const bg = this.opts.params.bg;
    root.style.setProperty(
      "--dsh-opening-bg",
      typeof bg === "string" && bg.length > 0 && bg !== "auto" ? bg : "#04050e",
    );
    const stage = document.createElement("div");
    stage.className = "dsh-opening-stage";
    root.append(stage);
    if (this.opts.showSkipHint) {
      const hint = document.createElement("div");
      hint.className = "dsh-opening-skip";
      hint.textContent = this.opts.t("skip.hint");
      root.append(hint);
      this.setTimer(() => hint.classList.add("dsh-opening-skip-show"), SKIP_HINT_DELAY_MS);
    }
    this.rootEl = root;
    this.stageEl = stage;
    document.body.append(root);
    document.body.dataset.dshOpening = "active";

    root.addEventListener("click", this.onSkipClick);
    document.addEventListener("keydown", this.onKeydown);

    // Watchdogs. Any fire hands the screen back; the transition guard makes them one-shot.
    this.setTimer(() => this.fireLoadTimeout(), LOAD_TIMEOUT_MS);
    if (this.opts.media.kind === "image") {
      this.setTimer(() => this.fireMaxDuration(), this.opts.maxDurationMs);
    } else {
      stage.addEventListener("timeupdate", this.onTimeUpdate, true);
      this.setTimer(this.checkVideoStall, VIDEO_CHECK_INTERVAL_MS);
    }

    const runtime: AnimationRuntime = {
      container: stage,
      media: this.opts.media,
      reducedMotion: this.opts.reducedMotion,
      params: this.opts.params,
      t: this.opts.t,
      complete: () => this.handleComplete(),
      fail: (err: unknown) => this.handleFail(err),
    };
    try {
      this.engine = this.opts.animation.create(runtime);
      this.engine.start();
    } catch (err) {
      this.handleFail(err);
    }
  }

  /** External skip trigger (click/Esc are bound by the runner itself). */
  skip(): void {
    this.requestSkip();
  }

  /** Fail-open: remove everything immediately, no transition. */
  abort(): void {
    this.destroy();
  }

  destroy(): void {
    if (this.phase === "destroyed") return;
    this.phase = "destroyed";
    this.clearTimers();
    document.removeEventListener("keydown", this.onKeydown);
    this.rootEl?.removeEventListener("click", this.onSkipClick);
    this.stageEl?.removeEventListener("timeupdate", this.onTimeUpdate, true);
    try {
      this.engine?.destroy();
    } catch (err) {
      console.warn("[dsh-opening-animation] engine destroy failed", err);
    }
    this.rootEl?.remove();
    this.rootEl = null;
    this.stageEl = null;
    delete document.body.dataset.dshOpening;
    delete document.documentElement.dataset.dshOpeningPending;
    removeCriticalStyles();
    this.restoreRootInline();
    URL.revokeObjectURL(this.opts.media.url);
    this.opts.onDone();
  }

  private requestSkip(): void {
    if (this.transitionStarted || this.phase === "destroyed") return;
    try {
      this.engine?.skip();
    } catch (err) {
      console.warn("[dsh-opening-animation] engine skip failed", err);
    }
    this.beginTransition();
  }

  private handleComplete(): void {
    if (this.transitionStarted || this.phase === "destroyed") return;
    this.beginTransition();
  }

  private handleFail(err: unknown): void {
    console.warn("[dsh-opening-animation]", err);
    this.abort();
  }

  private fireLoadTimeout(): void {
    if (this.transitionStarted || this.phase === "destroyed") return;
    // A video that already has playable data is fine: ended/no-progress take over from here.
    if (this.opts.media.kind === "video") {
      const video = this.stageEl?.querySelector("video");
      if (video !== undefined && video !== null && video.readyState >= 2) return;
    }
    console.warn("[dsh-opening-animation] media load timeout, handing the screen back");
    this.beginTransition();
  }

  private fireMaxDuration(): void {
    if (this.transitionStarted || this.phase === "destroyed") return;
    console.warn("[dsh-opening-animation] image max duration reached, handing the screen back");
    this.beginTransition();
  }

  private readonly checkVideoStall = (): void => {
    if (this.transitionStarted || this.phase === "destroyed") return;
    const video = this.stageEl?.querySelector("video");
    if (video !== undefined && video !== null && video.readyState >= 2 && !video.ended) {
      if (this.videoProgressAt === 0) {
        this.videoProgressAt = Date.now();
      } else if (Date.now() - this.videoProgressAt > VIDEO_STALL_MS) {
        console.warn("[dsh-opening-animation] video stalled without progress, handing the screen back");
        this.beginTransition();
        return;
      }
    }
    this.setTimer(this.checkVideoStall, VIDEO_CHECK_INTERVAL_MS);
  };

  private beginTransition(): void {
    if (this.transitionStarted || this.phase === "destroyed") return;
    this.transitionStarted = true;
    this.phase = "transition";
    this.clearTimers();
    this.stageEl?.removeEventListener("timeupdate", this.onTimeUpdate, true);

    const preset = this.opts.transition;
    const scale = this.opts.reducedMotion ? 0 : this.opts.transitionScale;
    const exitMs = Math.max(1, Math.round(this.opts.reducedMotion ? 250 : preset.exitMs * scale));
    const enterMs = Math.max(1, Math.round(this.opts.reducedMotion ? 250 : preset.enterMs * scale));
    const enterDelay = Math.round(this.opts.reducedMotion ? 0 : preset.enterDelayMs * scale);

    this.rootEl?.style.setProperty("--dsh-opening-exit-ms", `${exitMs}ms`);
    this.rootEl?.classList.add(preset.exitClass);

    this.setTimer(() => this.revealApp(enterMs), enterDelay);
    this.setTimer(() => this.destroy(), exitMs + enterDelay + enterMs + TRANSITION_BUFFER_MS);
  }

  /** Un-pending the app and run the #root enter animation via inline styles. */
  private revealApp(enterMs: number): void {
    if (this.phase === "destroyed") return;
    const appRoot = document.getElementById("root");
    const preset = this.opts.transition;
    if (appRoot !== null) {
      this.capturedRootInline = {
        opacity: appRoot.style.opacity,
        transform: appRoot.style.transform,
        transition: appRoot.style.transition,
      };
      appRoot.style.transition = "none";
      appRoot.style.opacity = "0";
      if (preset.enterTransform !== undefined) appRoot.style.transform = preset.enterTransform;
    }
    delete document.documentElement.dataset.dshOpeningPending;
    removeCriticalStyles();
    if (appRoot !== null && this.capturedRootInline !== null) {
      void appRoot.offsetHeight; // force reflow so the transition runs from the hidden frame
      appRoot.style.transition = `opacity ${enterMs}ms ease${preset.enterTransform !== undefined ? `, transform ${enterMs}ms ease` : ""}`;
      appRoot.style.opacity = this.capturedRootInline.opacity;
      appRoot.style.transform = this.capturedRootInline.transform;
    }
  }

  private restoreRootInline(): void {
    const appRoot = document.getElementById("root");
    const captured = this.capturedRootInline;
    this.capturedRootInline = null;
    if (appRoot === null || captured === null) return;
    appRoot.style.opacity = captured.opacity;
    appRoot.style.transform = captured.transform;
    appRoot.style.transition = captured.transition;
  }

  private setTimer(fn: () => void, ms: number): number {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
    return id;
  }

  private clearTimers(): void {
    for (const id of this.timers) window.clearTimeout(id);
    this.timers.clear();
  }
}
