// video-player engine: an autoplaying <video> filling the stage.
// ended → runtime.complete() (a user-chosen video always plays to the end —
// the image max-duration watchdog never applies); error → runtime.fail();
// a rejected play() is retried once (autoplay policy races) before failing.
// Playback always STARTS muted — that part is a hard browser autoplay
// requirement, not a preference. On the first playing event the engine
// ALWAYS attempts to unmute (volume/100) — unmute is probed, not gated on a
// user activation, so a reload with no in-page click can still be audible
// when the browser allows audible autoplay (a user gesture, a high Media
// Engagement Index, or an allow-listed site). If the autoplay policy rejects
// audible playback it pauses the video synchronously or asynchronously; the
// engine detects that pause and falls back to muted, playing again so
// playback resumes — audible when possible, silent when not, never frozen
// (a muted play() is always policy-allowed; the unlikely case of it being
// rejected too is logged and left to the error event path).
// Params: scale (element transform, 1 = no zoom) and offsetX/offsetY (percent
// of the screen, 0 = centered) position the video; fit keeps choosing how the
// video content fills its element (cover/contain) beneath the transform;
// volume (0-100, 0 = always silent) sets the audible playback loudness.
// Near the end of the video the audio fades out along an exponential curve
// (fadeOutMs, default 1500 ms, 0 = off): the fade starts from the current
// volume and decays 40 dB within the window — fast at first, then slower —
// reaching silence exactly at fadeOutMs; skip() and destroy() stop the fade
// immediately, and once it is running a playing event no longer unmutes, so
// the fade can never be reset by a late unmute.

import type {
  AnimationController,
  AnimationRuntime,
  OpeningAnimation,
} from "../registry";

/** Fade tick in ms: the exponential audio fade is stepped by an interval. */
const TICK_MS = 50;

export class VideoPlayerEngine implements AnimationController {
  private readonly runtime: AnimationRuntime;
  private readonly video: HTMLVideoElement;
  private readonly targetVolume: number;
  /** Audio fade-out window in ms; 0 = the whole fade machinery stays off. */
  private readonly fadeOutMs: number;
  private completed = false;
  private destroyed = false;
  private unmuted = false;
  private fading = false;
  private fadeTimer: number | null = null;

  private readonly onEnded = (): void => {
    if (this.destroyed || this.completed) return;
    this.stopFade();
    this.markCompleted();
  };

  private readonly onError = (): void => {
    if (this.destroyed || this.completed) return;
    this.stopFade();
    this.runtime.fail(new Error("video element raised an error"));
  };

  private readonly onPause = (): void => {
    // A pause arriving after the unmute attempt is the autoplay policy
    // rejecting audible playback (sync/async); fall back to silent playback
    // instead of staying frozen. Engine-driven pauses are excluded: skip()
    // and destroy() complete/destroy before pausing, and this guard sees it.
    // Natural playback end also pauses first (spec: pause, then ended) —
    // playing again there would restart the video inside the hand-off
    // window, so an ended video is left alone.
    if (this.destroyed || this.completed || !this.unmuted || this.video.ended) return;
    this.fallBackToSilent();
  };

  private readonly onPlaying = (): void => {
    if (this.destroyed || this.completed || this.unmuted) return;
    if (this.fading) return; // a running fade must not be reset by an unmute
    if (this.targetVolume <= 0) return; // volume 0 keeps the plain silent behavior
    // Behavior probe: always try to unmute. A browser that allows audible
    // autoplay (user gesture, high Media Engagement Index, allow-listed
    // site) leaves the video audible. One that does not pauses it —
    // synchronously (handled right below) or asynchronously (handled by the
    // pause listener) — and the engine falls back to muted playback.
    this.unmuted = true;
    this.video.muted = false;
    this.video.volume = this.targetVolume;
    if (this.video.paused) {
      // Some browsers pause synchronously when the mute flips off
      // mid-autoplay; fall back to muted playback at once.
      this.fallBackToSilent();
    }
  };

  private fallBackToSilent(): void {
    if (this.destroyed || this.completed) return;
    this.video.muted = true;
    void this.video.play().catch((err: unknown) => {
      console.debug("[dsh-opening-animation] silent-fallback play rejected", err);
    });
  }

  private readonly onTimeUpdate = (): void => {
    if (this.fading || this.destroyed || this.completed) return;
    const duration = this.video.duration;
    // jsdom (and unloaded videos) report no usable duration — never fade there.
    if (!Number.isFinite(duration) || duration <= 0) return;
    if (this.video.currentTime <= 0) return; // playback has not started
    // duration/currentTime are seconds; fadeOutMs is milliseconds — the
    // comparison must happen in ms, or every video fades from its first tick.
    const remainingMs = (duration - this.video.currentTime) * 1000;
    if (remainingMs < 0 || remainingMs > this.fadeOutMs) return;
    this.startFadeOut();
  };

  constructor(runtime: AnimationRuntime) {
    this.runtime = runtime;
    const p = runtime.params;
    const fit = p.fit === "contain" ? "contain" : "cover";
    const scale = VideoPlayerEngine.number(p.scale, 1);
    const offsetX = VideoPlayerEngine.number(p.offsetX, 0);
    const offsetY = VideoPlayerEngine.number(p.offsetY, 0);
    this.targetVolume = VideoPlayerEngine.clamp01(VideoPlayerEngine.number(p.volume, 100) / 100);
    this.fadeOutMs =
      typeof p.fadeOutMs === "number" && Number.isFinite(p.fadeOutMs) && p.fadeOutMs > 0
        ? p.fadeOutMs
        : 0;

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
    // Not gated on the fade: whenever the engine exists, a policy pause after
    // the unmute attempt must fall back to silent playback instead of
    // freezing the picture.
    this.video.addEventListener("pause", this.onPause);
    // Armed only when the fade is enabled; with fadeOutMs = 0 no listener,
    // timer or fade state ever exists.
    if (this.fadeOutMs > 0) {
      this.video.addEventListener("timeupdate", this.onTimeUpdate);
    }
  }

  start(): void {
    this.playWithRetry(1);
  }

  skip(): void {
    if (this.destroyed || this.completed) return;
    this.stopFade();
    try {
      this.video.pause();
    } catch {
      // pausing an unstarted video is harmless
    }
    this.markCompleted();
  }

  destroy(): void {
    this.destroyed = true;
    this.stopFade();
    this.video.removeEventListener("ended", this.onEnded);
    this.video.removeEventListener("error", this.onError);
    this.video.removeEventListener("playing", this.onPlaying);
    this.video.removeEventListener("pause", this.onPause);
    this.video.removeEventListener("timeupdate", this.onTimeUpdate);
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

  /** Exponential audio fade over fadeOutMs: volume *= 0.01 every fadeOutMs,
   * i.e. a 40 dB decay within the window (fast at first, then slower),
   * starting from the volume the video had when the fade began. */
  private startFadeOut(): void {
    this.fading = true;
    const startVolume = this.video.volume;
    let ticks = 0;
    this.fadeTimer = window.setInterval(() => {
      ticks += 1;
      const elapsed = ticks * TICK_MS;
      if (elapsed >= this.fadeOutMs) {
        this.video.volume = 0;
        this.stopFade();
        return;
      }
      this.video.volume = startVolume * Math.pow(0.01, elapsed / this.fadeOutMs);
    }, TICK_MS);
  }

  private stopFade(): void {
    if (this.fadeTimer !== null) {
      window.clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }
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
    fadeOutMs: { type: "number", default: 1500, min: 0, max: 10000, step: 100 },
  },
  create: (runtime) => new VideoPlayerEngine(runtime),
};
