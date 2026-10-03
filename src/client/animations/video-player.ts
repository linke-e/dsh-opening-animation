// video-player engine: a muted autoplaying <video> filling the stage.
// ended → runtime.complete() (a user-chosen video always plays to the end —
// the image max-duration watchdog never applies); error → runtime.fail();
// a rejected play() is retried once (autoplay policy races) before failing.
// muted is a hard browser autoplay requirement, not a preference.

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
    const fit = runtime.params.fit === "contain" ? "contain" : "cover";
    this.video = document.createElement("video");
    this.video.src = runtime.media.url;
    this.video.autoplay = true;
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.style.objectFit = fit;
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
}

export const videoPlayerAnimation: OpeningAnimation = {
  id: "video-player",
  kind: "video",
  labelKey: "anim.video-player.label",
  descriptionKey: "anim.video-player.desc",
  paramsSchema: {
    fit: { type: "enum", default: "cover", options: ["cover", "contain"] },
  },
  create: (runtime) => new VideoPlayerEngine(runtime),
};
