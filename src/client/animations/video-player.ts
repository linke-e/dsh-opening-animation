// video-player engine: an autoplaying <video> filling the stage.
// ended → runtime.complete() (a user-chosen video always plays to the end —
// the image max-duration watchdog never applies); error → runtime.fail();
// a rejected play() is retried once (autoplay policy races) before failing.
// Playback always STARTS muted — that part is a hard browser autoplay
// requirement, not a preference. With volume > 0 the engine unmutes on the
// first playing event and applies volume/100; if unmuting got the video
// paused, one play() re-kick is attempted, and a rejection falls back to
// silent playback (no sound must never fail the opening).
// Params: scale (element transform, 1 = no zoom) and offsetX/offsetY (percent
// of the screen, 0 = centered) position the video; fit keeps choosing how the
// video content fills its element (cover/contain) beneath the transform;
// volume (0-100, 0 = always silent) sets the audible playback loudness.

import type {
  AnimationController,
  AnimationRuntime,
  OpeningAnimation,
} from "../registry";

export class VideoPlayerEngine implements AnimationController {
  private readonly runtime: AnimationRuntime;
  private readonly video: HTMLVideoElement;
  private readonly targetVolume: number;
  private completed = false;
  private destroyed = false;
  private unmuted = false;

  private readonly onEnded = (): void => {
    if (this.destroyed || this.completed) return;
    this.markCompleted();
  };

  private readonly onError = (): void => {
    if (this.destroyed || this.completed) return;
    this.runtime.fail(new Error("video element raised an error"));
  };

  private readonly onPlaying = (): void => {
    if (this.destroyed || this.completed || this.unmuted) return;
    if (this.targetVolume <= 0) return; // volume 0 keeps the plain silent behavior
    this.unmuted = true;
    this.video.muted = false;
    this.video.volume = this.targetVolume;
    if (this.video.paused) {
      // Some browsers pause when muted flips off mid-autoplay; one re-kick,
      // then fall back to silent — a missing soundtrack never fails the run.
      void this.video.play().catch(() => {
        if (this.destroyed || this.completed) return;
        this.video.muted = true;
      });
    }
  };

  constructor(runtime: AnimationRuntime) {
    this.runtime = runtime;
    const p = runtime.params;
    const fit = p.fit === "contain" ? "contain" : "cover";
    const scale = VideoPlayerEngine.number(p.scale, 1);
    const offsetX = VideoPlayerEngine.number(p.offsetX, 0);
    const offsetY = VideoPlayerEngine.number(p.offsetY, 0);
    this.targetVolume = VideoPlayerEngine.clamp01(VideoPlayerEngine.number(p.volume, 100) / 100);

    this.video = document.createElement("video");
    this.video.src = runtime.media.url;
    this.video.autoplay = true;
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.style.objectFit = fit;
    // Percent translate is relative to the element itself (full-screen here),
    // so offsets read directly as fractions of the screen.
    this.video.style.transform = `translate(${offsetX}%, ${offsetY}%) scale(${scale})`;
    runtime.container.append(this.video);
    this.video.addEventListener("ended", this.onEnded);
    this.video.addEventListener("error", this.onError);
    this.video.addEventListener("playing", this.onPlaying);
  }

  start(): void {
    this.playWithRetry(1);
  }

  skip(): void {
    if (this.destroyed || this.completed) return;
    try {
      this.video.pause();
    } catch {
      // pausing an unstarted video is harmless
    }
    this.markCompleted();
  }

  destroy(): void {
    this.destroyed = true;
    this.video.removeEventListener("ended", this.onEnded);
    this.video.removeEventListener("error", this.onError);
    this.video.removeEventListener("playing", this.onPlaying);
    try {
      this.video.pause();
      this.video.removeAttribute("src");
      this.video.load();
    } catch {
      // teardown best-effort
    }
    this.video.remove();
  }

  private playWithRetry(retries: number): void {
    if (this.destroyed || this.completed) return;
    void this.video.play().catch(() => {
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

  private markCompleted(): void {
    if (this.completed) return;
    this.completed = true;
    this.runtime.complete();
  }

  private static number(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }

  private static clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
  }
}

export const videoPlayerAnimation: OpeningAnimation = {
  id: "video-player",
  kind: "video",
  labelKey: "anim.video-player.label",
  descriptionKey: "anim.video-player.desc",
  paramsSchema: {
    fit: { type: "enum", default: "cover", options: ["cover", "contain"] },
    scale: { type: "number", default: 1, min: 0.1, max: 3, step: 0.05 },
    offsetX: { type: "number", default: 0, min: -100, max: 100, step: 1 },
    offsetY: { type: "number", default: 0, min: -100, max: 100, step: 1 },
    volume: { type: "number", default: 100, min: 0, max: 100, step: 5 },
  },
  create: (runtime) => new VideoPlayerEngine(runtime),
};
