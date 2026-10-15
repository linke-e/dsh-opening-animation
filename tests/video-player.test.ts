import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  VideoPlayerEngine,
  videoPlayerAnimation,
} from "../src/client/animations/video-player";
import { resolveAnimation, resolveAnimationParams } from "../src/client/registry";

function makeRuntime(params: Readonly<Record<string, unknown>> = {}) {
  const calls = { complete: 0, fail: 0 };
  return {
    calls,
    runtime: {
      container: document.createElement("div"),
      media: { url: "data:video/mp4;base64,AAAA", kind: "video" as const, mime: "video/mp4", name: "t.mp4" },
      reducedMotion: false,
      params,
      t: (key: string) => key,
      markLoaded: () => {},
      complete: () => {
        calls.complete += 1;
      },
      fail: () => {
        calls.fail += 1;
      },
    },
  };
}

function videoOf(engine: VideoPlayerEngine): HTMLVideoElement {
  return Reflect.get(engine, "video") as HTMLVideoElement;
}

/** Simulate the browser's autoplay policy: start muted, playback running. */
async function startPlaying(engine: VideoPlayerEngine): Promise<HTMLVideoElement> {
  const video = videoOf(engine);
  Object.defineProperty(video, "paused", { value: false, configurable: true });
  engine.start();
  await vi.waitFor(() => {
    expect(video.paused).toBe(false);
  });
  return video;
}

/** Inject a user activation on Navigator (jsdom ships none); the unmute path
 * only runs when the browser reports one. Tests must clean this up. */
function grantUserActivation(hasBeenActive: boolean): void {
  Object.defineProperty(Navigator.prototype, "userActivation", {
    value: { hasBeenActive },
    configurable: true,
  });
}

function revokeUserActivation(): void {
  delete (Navigator.prototype as unknown as { userActivation?: unknown }).userActivation;
}

function fadingOf(engine: VideoPlayerEngine): boolean {
  return Reflect.get(engine, "fading") === true;
}

function fadeTimerOf(engine: VideoPlayerEngine): unknown {
  return Reflect.get(engine, "fadeTimer");
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
});

afterEach(() => {
  revokeUserActivation();
});

describe("video-player registry entry", () => {
  it("keeps resolving after the volume addition and defaults/clamps params", () => {
    expect(resolveAnimation("video", "video-player")?.id).toBe("video-player");
    expect(resolveAnimationParams(videoPlayerAnimation)).toEqual({
      fit: "cover",
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      volume: 100,
      fadeOutMs: 1500,
    });
    const clamped = resolveAnimationParams(videoPlayerAnimation, { volume: 999, fadeOutMs: 99999 });
    expect(clamped.volume).toBe(100);
    expect(clamped.fadeOutMs).toBe(10000);
    const muted = resolveAnimationParams(videoPlayerAnimation, { volume: -5, fadeOutMs: -5 });
    expect(muted.volume).toBe(0);
    expect(muted.fadeOutMs).toBe(0);
  });
});

describe("video-player audio behavior", () => {
  it("starts muted (autoplay policy) and unmutes with the configured volume on playing", async () => {
    const { runtime } = makeRuntime({ volume: 50 });
    const engine = new VideoPlayerEngine(runtime);
    const video = await startPlaying(engine);
    expect(video.muted).toBe(true); // still muted before the first playing event
    grantUserActivation(true);
    video.dispatchEvent(new Event("playing"));
    expect(video.muted).toBe(false);
    expect(video.volume).toBeCloseTo(0.5, 6);
    // a repeated playing event must not flip anything again
    video.dispatchEvent(new Event("playing"));
    expect(video.muted).toBe(false);
    engine.destroy();
  });

  it("keeps the plain silent behavior when volume is 0", async () => {
    const { runtime } = makeRuntime({ volume: 0 });
    const engine = new VideoPlayerEngine(runtime);
    const video = await startPlaying(engine);
    video.dispatchEvent(new Event("playing"));
    expect(video.muted).toBe(true);
    expect(video.volume).toBe(1); // untouched jsdom default
    engine.destroy();
  });

  it("re-kicks play() when unmuting left the video paused, and falls back to muted playback on rejection", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play");
    const { runtime, calls } = makeRuntime({ volume: 80 });
    const engine = new VideoPlayerEngine(runtime);
    const video = videoOf(engine);
    // stays paused: unmuting paused the video, so the engine must re-kick
    engine.start();
    await vi.waitFor(() => {
      expect(play).toHaveBeenCalledTimes(1);
    });
    play.mockRejectedValueOnce(new Error("autoplay policy"));
    grantUserActivation(true);
    video.dispatchEvent(new Event("playing"));
    expect(video.muted).toBe(false);
    expect(video.volume).toBeCloseTo(0.8, 6);
    await vi.waitFor(() => {
      // muted again (play #2 rejected) and a third play() resumes silent
      // playback so the video can never stay frozen on a paused frame
      expect(play).toHaveBeenCalledTimes(3);
      expect(video.muted).toBe(true);
    });
    expect(calls.fail).toBe(0); // silent playback must not fail the opening
    engine.destroy();
  });

  it("stays muted when navigator.userActivation is undefined (startup autoplay)", async () => {
    Object.defineProperty(Navigator.prototype, "userActivation", { value: undefined, configurable: true });
    const play = vi.spyOn(HTMLMediaElement.prototype, "play");
    const { runtime } = makeRuntime({ volume: 50 });
    const engine = new VideoPlayerEngine(runtime);
    const video = videoOf(engine);
    engine.start();
    await vi.waitFor(() => {
      expect(play).toHaveBeenCalledTimes(1);
    });
    video.dispatchEvent(new Event("playing"));
    expect(video.muted).toBe(true); // no user activation → no unmute, ever
    expect(video.volume).toBe(1); // untouched jsdom default
    expect(play).toHaveBeenCalledTimes(1); // no re-kick, no extra play() calls
    engine.destroy();
  });

  it("stays muted when the user activation has never been active", async () => {
    grantUserActivation(false);
    const play = vi.spyOn(HTMLMediaElement.prototype, "play");
    const { runtime } = makeRuntime({ volume: 50 });
    const engine = new VideoPlayerEngine(runtime);
    const video = videoOf(engine);
    engine.start();
    await vi.waitFor(() => {
      expect(play).toHaveBeenCalledTimes(1);
    });
    video.dispatchEvent(new Event("playing"));
    expect(video.muted).toBe(true);
    expect(video.volume).toBe(1);
    expect(play).toHaveBeenCalledTimes(1);
    engine.destroy();
  });

  it("completes on ended and stops reacting to playing after destroy", async () => {
    const { runtime, calls } = makeRuntime({ volume: 40 });
    const engine = new VideoPlayerEngine(runtime);
    const video = await startPlaying(engine);
    engine.destroy();
    video.dispatchEvent(new Event("playing"));
    expect(video.muted).toBe(true); // listeners are gone; no unmute after destroy
    video.dispatchEvent(new Event("ended"));
    expect(calls.complete).toBe(0);
    engine.skip(); // destroy first, then skip must be a no-op, not a double hand-over
    expect(calls.complete).toBe(0);
    expect(calls.fail).toBe(0);
  });
});

describe("video-player end-of-playback audio fade", () => {
  // The fade steps on a 50 ms interval (TICK_MS inside the engine, not exported).
  const TICK = 50;

  it("fades the audio out exponentially near the end and lands on silence", () => {
    vi.useFakeTimers();
    try {
      // makeRuntime passes params verbatim (no defaults merge), so fadeOutMs
      // is spelled out even though 1500 is the schema default
      const { runtime, calls } = makeRuntime({ fadeOutMs: 1500 });
      const engine = new VideoPlayerEngine(runtime);
      const video = videoOf(engine);
      Object.defineProperty(video, "duration", { value: 10, configurable: true });
      engine.start();
      expect(video.volume).toBe(1); // jsdom default; the fade starts from here
      // 1 s left < the 1500 ms fade window → the next timeupdate arms the fade
      Object.defineProperty(video, "currentTime", { value: 9, configurable: true });
      video.dispatchEvent(new Event("timeupdate"));
      expect(fadingOf(engine)).toBe(true);
      let prev = video.volume;
      let first = 0;
      for (let i = 0; i < 5; i += 1) {
        vi.advanceTimersByTime(TICK);
        const current = video.volume;
        expect(current).toBeLessThan(prev); // monotonically quieter
        if (i === 0) first = current;
        prev = current;
      }
      // exponential curve: after one tick the volume is 0.01^(50/1500),
      // after five ticks 0.01^(250/1500)
      expect(first).toBeCloseTo(0.01 ** (TICK / 1500), 6);
      expect(prev).toBeCloseTo(0.01 ** ((5 * TICK) / 1500), 6);
      vi.advanceTimersByTime(1500); // run past the fade window
      expect(video.volume).toBe(0);
      expect(fadeTimerOf(engine)).toBeNull(); // the interval stopped itself
      // ended during/after a fade still completes normally — the video is
      // silent by then, so no residual volume can be heard
      video.dispatchEvent(new Event("ended"));
      expect(calls.complete).toBe(1);
      engine.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("never arms the fade when fadeOutMs is 0", () => {
    const { runtime } = makeRuntime({ fadeOutMs: 0 });
    const engine = new VideoPlayerEngine(runtime);
    const video = videoOf(engine);
    Object.defineProperty(video, "duration", { value: 10, configurable: true });
    Object.defineProperty(video, "currentTime", { value: 9.9, configurable: true });
    video.dispatchEvent(new Event("timeupdate"));
    expect(fadingOf(engine)).toBe(false);
    expect(video.volume).toBe(1); // untouched jsdom default
    expect(fadeTimerOf(engine)).toBeNull(); // no listener, no timer, ever
    engine.destroy();
  });

  it("does not fade while the guard conditions do not hold", () => {
    const { runtime } = makeRuntime({ fadeOutMs: 1500 }); // fade armed, guards reject
    const engine = new VideoPlayerEngine(runtime);
    const video = videoOf(engine);
    // jsdom reports no usable duration by default → the finite/positive check fails
    Object.defineProperty(video, "currentTime", { value: 9, configurable: true });
    video.dispatchEvent(new Event("timeupdate"));
    expect(fadingOf(engine)).toBe(false);
    expect(video.volume).toBe(1);
    // currentTime 0 (playback never started) must not trigger either
    Object.defineProperty(video, "duration", { value: 10, configurable: true });
    Object.defineProperty(video, "currentTime", { value: 0, configurable: true });
    video.dispatchEvent(new Event("timeupdate"));
    expect(fadingOf(engine)).toBe(false);
    expect(video.volume).toBe(1);
    engine.destroy();
  });

  it("does not fade mid-playback: remaining time is seconds, the window is ms", () => {
    // Regression: duration/currentTime are seconds, fadeOutMs milliseconds —
    // comparing them raw made every video fade from its first timeupdate.
    const { runtime } = makeRuntime({ fadeOutMs: 1500 });
    const engine = new VideoPlayerEngine(runtime);
    const video = videoOf(engine);
    Object.defineProperty(video, "duration", { value: 10, configurable: true });
    Object.defineProperty(video, "currentTime", { value: 1, configurable: true }); // 9 s = 9000 ms left
    video.dispatchEvent(new Event("timeupdate"));
    expect(fadingOf(engine)).toBe(false);
    expect(video.volume).toBe(1); // untouched — playback keeps its volume
    engine.destroy();
  });

  it("does not unmute on playing once the fade has started", () => {
    vi.useFakeTimers();
    try {
      grantUserActivation(true);
      const { runtime } = makeRuntime({ volume: 50, fadeOutMs: 1500 });
      const engine = new VideoPlayerEngine(runtime);
      const video = videoOf(engine);
      Object.defineProperty(video, "duration", { value: 10, configurable: true });
      engine.start();
      // still muted (no playing event yet): the fade starts from the jsdom
      // default volume 1, not from the configured 0.5
      Object.defineProperty(video, "currentTime", { value: 9, configurable: true });
      video.dispatchEvent(new Event("timeupdate"));
      expect(fadingOf(engine)).toBe(true);
      // without the fading guard this playing event would unmute and reset
      // the volume to 0.5 mid-fade
      video.dispatchEvent(new Event("playing"));
      expect(video.muted).toBe(true);
      vi.advanceTimersByTime(TICK);
      expect(video.volume).toBeCloseTo(0.01 ** (TICK / 1500), 6); // fade from 1 continues
      vi.advanceTimersByTime(1500);
      expect(video.volume).toBe(0);
      engine.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops the fade immediately on skip and still completes", () => {
    vi.useFakeTimers();
    try {
      const { runtime, calls } = makeRuntime({ fadeOutMs: 1500 });
      const engine = new VideoPlayerEngine(runtime);
      const video = videoOf(engine);
      Object.defineProperty(video, "duration", { value: 10, configurable: true });
      engine.start();
      Object.defineProperty(video, "currentTime", { value: 9, configurable: true });
      video.dispatchEvent(new Event("timeupdate"));
      expect(fadingOf(engine)).toBe(true);
      vi.advanceTimersByTime(2 * TICK); // some fade progress
      const volumeAtSkip = video.volume;
      engine.skip();
      expect(calls.complete).toBe(1);
      expect(fadeTimerOf(engine)).toBeNull();
      vi.advanceTimersByTime(2000); // no more ticks — the volume stays frozen
      expect(video.volume).toBeCloseTo(volumeAtSkip, 6);
      engine.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects a timeupdate past the end and never re-arms after ended", () => {
    const { runtime, calls } = makeRuntime({ fadeOutMs: 1500 });
    const engine = new VideoPlayerEngine(runtime);
    const video = videoOf(engine);
    Object.defineProperty(video, "duration", { value: 10, configurable: true });
    engine.start();
    // remaining < 0 (currentTime beyond the duration): the guard rejects
    Object.defineProperty(video, "currentTime", { value: 11, configurable: true });
    video.dispatchEvent(new Event("timeupdate"));
    expect(fadingOf(engine)).toBe(false);
    expect(fadeTimerOf(engine)).toBeNull();
    expect(video.volume).toBe(1);
    // after ended (completed), a stray timeupdate must not arm the fade
    Object.defineProperty(video, "currentTime", { value: 9, configurable: true });
    video.dispatchEvent(new Event("ended"));
    expect(calls.complete).toBe(1);
    video.dispatchEvent(new Event("timeupdate"));
    expect(fadingOf(engine)).toBe(false);
    expect(fadeTimerOf(engine)).toBeNull();
    expect(video.volume).toBe(1);
    engine.destroy();
  });

  it("stops the fade on error and fails the run", () => {
    vi.useFakeTimers();
    try {
      const { runtime, calls } = makeRuntime({ fadeOutMs: 1500 });
      const engine = new VideoPlayerEngine(runtime);
      const video = videoOf(engine);
      Object.defineProperty(video, "duration", { value: 10, configurable: true });
      engine.start();
      Object.defineProperty(video, "currentTime", { value: 9, configurable: true });
      video.dispatchEvent(new Event("timeupdate"));
      expect(fadingOf(engine)).toBe(true);
      video.dispatchEvent(new Event("error"));
      expect(calls.fail).toBe(1);
      expect(fadeTimerOf(engine)).toBeNull();
      const volumeAtError = video.volume;
      vi.advanceTimersByTime(2000); // no more ticks — the fade is gone
      expect(video.volume).toBeCloseTo(volumeAtError, 6);
      engine.destroy();
    } finally {
      vi.useRealTimers();
    }
  });
});
