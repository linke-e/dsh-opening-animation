// video-player engine: a muted autoplaying <video> filling the stage.
// ended → runtime.complete() (a user-chosen video always plays to the end —
// the image max-duration watchdog never applies); error → runtime.fail();
// a rejected play() is retried once (autoplay policy races) before failing.
// muted is a hard browser autoplay requirement, not a preference.
// Params: scale (element transform, 1 = no zoom) and offsetX/offsetY (percent
// of the screen, 0 = centered) position the video; fit keeps choosing how the
// video content fills its element (cover/contain) beneath the transform.

import type {
  AnimationController,
  AnimationRuntime,
  OpeningAnimation,
} from "../registry";

export class VideoPlayerEngine implements AnimationController {
  private readonly runtime: AnimationRuntime;
  private readonly video: HTMLVideoElement;
  private completed = false;
  private destroyed = false;

  private readonly onEnded = (): void => {
    if (this.destroyed || this.completed) return;
    this.markCompleted();
  };

  private readonly onError = (): void => {
    if (this.destroyed || this.completed) return;
    this.runtime.fail(new Error("video element raised an error"));
  };

  constructor(runtime: AnimationRuntime) {
    this.runtime = runtime;
    const p = runtime.params;
    const fit = p.fit === "contain" ? "contain" : "cover";
    const scale = VideoPlayerEngine.number(p.scale, 1);
    const offsetX = VideoPlayerEngine.number(p.offsetX, 0);
    const offsetY = VideoPlayerEngine.number(p.offsetY, 0);

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
  },
  create: (runtime) => new VideoPlayerEngine(runtime),
};
