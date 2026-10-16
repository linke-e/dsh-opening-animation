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

/** Inject a user activation on Navigator (jsdom ships none). The engine no
 * longer gates its unmute on this — injecting it only tags a test as the
 * "with a user gesture" scenario, where a browser would certainly allow
 * audible autoplay. Tests must clean this up. */
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

function fadeInTimerOf(engine: VideoPlayerEngine): unknown {
  return Reflect.get(engine, "fadeInTimer");
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
      fadeInMs: 1000,
    });
    const clamped = resolveAnimationParams(videoPlayerAnimation, {
      volume: 999,
      fadeOutMs: 99999,
      fadeInMs: 99999,
    });
    expect(clamped.volume).toBe(100);
    expect(clamped.fadeOutMs).toBe(10000);
    expect(clamped.fadeInMs).toBe(10000);
    const muted = resolveAnimationParams(videoPlayerAnimation, {
      volume: -5,
      fadeOutMs: -5,
      fadeInMs: -5,
    });
    expect(muted.volume).toBe(0);
    expect(muted.fadeOutMs).toBe(0);
    expect(muted.fadeInMs).toBe(0);
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

  it("falls back to muted playback when unmuting leaves the video paused, and re-kicks play()", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play");
    const { runtime, calls } = makeRuntime({ volume: 80 });
    const engine = new VideoPlayerEngine(runtime);
    const video = videoOf(engine);
    // jsdom videos report paused=true by default: unmuting "pauses" the video
    // synchronously, so the engine must fall back to muted playback itself
    engine.start();
    await vi.waitFor(() => {
      expect(play).toHaveBeenCalledTimes(1);
    });
    play.mockRejectedValueOnce(new Error("autoplay policy"));
    grantUserActivation(true);
    video.dispatchEvent(new Event("playing"));
    // the unmute probe ran (the volume was applied) and the sync-pause branch
    // muted again immediately — the silent-fallback play() (#2) was rejected
    // and only logged; the 10 s stall watchdog is the last-resort safety net,
    // and the video must never stay frozen on a paused frame
    expect(video.volume).toBeCloseTo(0.8, 6);
    await vi.waitFor(() => {
      expect(play).toHaveBeenCalledTimes(2);
      expect(video.muted).toBe(true);
    });
    expect(calls.fail).toBe(0); // silent playback must not fail the opening
    engine.destroy();
  });

  it("stays audible without any user activation when the browser allows audible autoplay", async () => {
    // No userActivation injected at all (jsdom ships none): a page reload
    // with no in-page click. A browser lets such a page play audible when
    // the site's Media Engagement Index is high or the site is
    // allow-listed — so the unmute probe must go through and stay.
    const play = vi.spyOn(HTMLMediaElement.prototype, "play");
    const { runtime } = makeRuntime({ volume: 50 });
    const engine = new VideoPlayerEngine(runtime);
    const video = videoOf(engine);
    engine.start();
    await vi.waitFor(() => {
      expect(play).toHaveBeenCalledTimes(1);
    });
    Object.defineProperty(video, "paused", { value: false, configurable: true }); // audible autoplay allowed
    video.dispatchEvent(new Event("playing"));
    expect(video.muted).toBe(false);
    expect(video.volume).toBeCloseTo(0.5, 6);
    expect(play).toHaveBeenCalledTimes(1); // the browser let it play — no fallback re-kick
    engine.destroy();
  });

  it("falls back to muted playback when the browser pauses after the unmute (async policy rejection)", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play");
    const { runtime, calls } = makeRuntime({ volume: 50 });
    const engine = new VideoPlayerEngine(runtime);
    const video = videoOf(engine);
    engine.start();
    await vi.waitFor(() => {
      expect(play).toHaveBeenCalledTimes(1);
    });
    Object.defineProperty(video, "paused", { value: false, configurable: true });
    video.dispatchEvent(new Event("playing"));
    expect(video.muted).toBe(false); // the unmute probe went through, briefly audible
    // the autoplay policy pauses the video asynchronously after the unmute:
    // the engine must mute again and resume playing so it never freezes
    video.dispatchEvent(new Event("pause"));
    await vi.waitFor(() => {
      expect(video.muted).toBe(true);
      expect(play).toHaveBeenCalledTimes(2); // silent playback resumed
    });
    expect(calls.fail).toBe(0);
    engine.destroy();
  });

  it("ignores pause events after skip or destroy (engine-driven pauses never re-play)", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play");
    // skip path: unmuted, then skip() completes — a pause from then on is
    // engine-driven and must not trigger the silent fallback
    const skipped = makeRuntime({ volume: 50 });
    const skipEngine = new VideoPlayerEngine(skipped.runtime);
    const skipVideo = await startPlaying(skipEngine);
    skipVideo.dispatchEvent(new Event("playing"));
    expect(skipVideo.muted).toBe(false);
    skipEngine.skip();
    expect(skipped.calls.complete).toBe(1);
    skipVideo.dispatchEvent(new Event("pause"));
    expect(skipVideo.muted).toBe(false); // guard saw completed — no fallback mute
    expect(play).toHaveBeenCalledTimes(1); // only start()'s play — no re-kick
    // destroy path: the pause listener is removed, a stray pause is a no-op
    const destroyed = makeRuntime({ volume: 50 });
    const destroyEngine = new VideoPlayerEngine(destroyed.runtime);
    const destroyVideo = await startPlaying(destroyEngine);
    destroyVideo.dispatchEvent(new Event("playing"));
    expect(destroyVideo.muted).toBe(false);
    destroyEngine.destroy();
    destroyVideo.dispatchEvent(new Event("pause"));
    expect(destroyVideo.muted).toBe(false);
    expect(play).toHaveBeenCalledTimes(2); // still only the two start() plays
    expect(destroyed.calls.complete).toBe(0);
    expect(destroyed.calls.fail).toBe(0);
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

describe("video-player start-of-playback audio fade-in", () => {
  // The fade-in steps on the same 50 ms interval (TICK_MS inside the engine).
  const TICK = 50;

  it("ramps the volume up linearly and stops itself at the configured volume", () => {
    vi.useFakeTimers();
    try {
      const { runtime } = makeRuntime({ volume: 50, fadeInMs: 1000 });
      const engine = new VideoPlayerEngine(runtime);
      const video = videoOf(engine);
      Object.defineProperty(video, "paused", { value: false, configurable: true });
      engine.start();
      // no user activation injected: the behavior probe always tries to
      // unmute, and audible autoplay "allowed" (paused=false) arms the fade-in
      video.dispatchEvent(new Event("playing"));
      expect(video.muted).toBe(false);
      expect(fadeInTimerOf(engine)).not.toBeNull();
      // the ramp starts from true silence: the unmute probe wrote the full
      // target volume, and without the immediate zero the first tick (up to
      // 50 ms away) would play at 100% — the pop the fade exists to prevent
      expect(video.volume).toBe(0);
      // constant gain = a linear ramp: after n ticks the volume is
      // targetVolume * (n * TICK / 1000)
      for (let n = 1; n <= 19; n += 1) {
        vi.advanceTimersByTime(TICK);
        expect(video.volume).toBeCloseTo(0.5 * ((n * TICK) / 1000), 6);
      }
      // the 20th tick reaches the window end (1000 ms): exact volume, stop
      vi.advanceTimersByTime(TICK);
      expect(video.volume).toBeCloseTo(0.5, 6);
      expect(fadeInTimerOf(engine)).toBeNull(); // the interval stopped itself
      vi.advanceTimersByTime(2000); // no more ticks — the volume stays put
      expect(video.volume).toBeCloseTo(0.5, 6);
      engine.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not fade in at all when fadeInMs is 0", () => {
    const { runtime } = makeRuntime({ volume: 50, fadeInMs: 0 });
    const engine = new VideoPlayerEngine(runtime);
    const video = videoOf(engine);
    Object.defineProperty(video, "paused", { value: false, configurable: true });
    engine.start();
    video.dispatchEvent(new Event("playing"));
    expect(video.muted).toBe(false);
    expect(video.volume).toBeCloseTo(0.5, 6); // straight to the target volume
    expect(fadeInTimerOf(engine)).toBeNull(); // no listener, no timer, ever
    engine.destroy();
  });

  it("does not start the fade-in when the unmute falls back to silent", () => {
    vi.useFakeTimers();
    try {
      const { runtime } = makeRuntime({ volume: 50, fadeInMs: 1000 });
      const engine = new VideoPlayerEngine(runtime);
      const video = videoOf(engine);
      // jsdom videos report paused=true by default: the unmute probe trips
      // the synchronous policy pause and the engine falls back to muted
      engine.start();
      video.dispatchEvent(new Event("playing"));
      expect(video.muted).toBe(true); // the fallback muted the video again
      expect(fadeInTimerOf(engine)).toBeNull(); // no fade-in was armed
      vi.advanceTimersByTime(2000);
      // silent from here on: the volume keeps the value the unmute probe
      // applied, and no ramp is rewriting it
      expect(video.volume).toBeCloseTo(0.5, 6);
      engine.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("starts the fade-in when the hint click unmutes", () => {
    vi.useFakeTimers();
    try {
      const { runtime } = makeRuntime({ volume: 50, fadeInMs: 1000 });
      const engine = new VideoPlayerEngine(runtime);
      const video = videoOf(engine);
      engine.start();
      video.dispatchEvent(new Event("playing")); // policy fallback: muted + hint
      expect(video.muted).toBe(true);
      const hint = runtime.container.querySelector<HTMLElement>(".dsh-opening-unmute-hint");
      expect(hint).not.toBeNull();
      Object.defineProperty(video, "paused", { value: false, configurable: true }); // the gesture lets it play
      hint!.dispatchEvent(new Event("click", { bubbles: true }));
      expect(video.muted).toBe(false);
      expect(fadeInTimerOf(engine)).not.toBeNull(); // the fade-in took over
      // same linear ramp, rising from (near) silence toward 0.5
      for (let n = 1; n <= 5; n += 1) {
        vi.advanceTimersByTime(TICK);
        expect(video.volume).toBeCloseTo(0.5 * ((n * TICK) / 1000), 6);
      }
      engine.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("hands over to the fade-out: the fade-in stops and the fade-out continues from the current volume", () => {
    vi.useFakeTimers();
    try {
      const { runtime } = makeRuntime({ volume: 50, fadeInMs: 10000, fadeOutMs: 1500 });
      const engine = new VideoPlayerEngine(runtime);
      const video = videoOf(engine);
      Object.defineProperty(video, "paused", { value: false, configurable: true });
      Object.defineProperty(video, "duration", { value: 10, configurable: true });
      engine.start();
      video.dispatchEvent(new Event("playing")); // fade-in armed
      expect(fadeInTimerOf(engine)).not.toBeNull();
      vi.advanceTimersByTime(2 * TICK); // 100 ms into the ramp
      const volumeIntoFadeOut = 0.5 * ((2 * TICK) / 10000);
      expect(video.volume).toBeCloseTo(volumeIntoFadeOut, 6);
      // enter the fade-out window: 1000 ms left < fadeOutMs 1500
      Object.defineProperty(video, "currentTime", { value: 9, configurable: true });
      video.dispatchEvent(new Event("timeupdate"));
      expect(fadingOf(engine)).toBe(true);
      expect(fadeInTimerOf(engine)).toBeNull(); // the fade-in was stopped
      // the exponential fade-out starts from the current (mid-ramp) volume
      vi.advanceTimersByTime(TICK);
      expect(video.volume).toBeCloseTo(volumeIntoFadeOut * 0.01 ** (TICK / 1500), 6);
      engine.destroy();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("video-player unmute hint", () => {
  /** Enter the policy-rejected scenario: jsdom videos report paused=true by
   * default, so the unmute probe on playing "pauses" the video synchronously
   * and the engine falls back to muted playback (and shows the hint). No
   * userActivation is needed — the new implementation never gates on it. */
  function startPolicyRejected(engine: VideoPlayerEngine): HTMLVideoElement {
    const video = videoOf(engine);
    engine.start();
    video.dispatchEvent(new Event("playing"));
    return video;
  }

  it("shows the click-for-sound hint after the policy forces a silent fallback", () => {
    const { runtime } = makeRuntime({ volume: 50 });
    const engine = new VideoPlayerEngine(runtime);
    const video = startPolicyRejected(engine);
    expect(video.muted).toBe(true); // the fallback muted the video again
    const hint = runtime.container.querySelector(".dsh-opening-unmute-hint");
    expect(hint).not.toBeNull();
    expect(hint?.textContent).toBe("video.unmuteHint"); // t is an identity function
    engine.destroy();
  });

  it("shows no hint when the user configured a silent volume", () => {
    const { runtime } = makeRuntime({ volume: 0, fadeOutMs: 0 });
    const engine = new VideoPlayerEngine(runtime);
    startPolicyRejected(engine);
    expect(runtime.container.querySelector(".dsh-opening-unmute-hint")).toBeNull();
    engine.destroy();
  });

  it("unmutes on the hint click without skipping the opening", () => {
    const { runtime, calls } = makeRuntime({ volume: 50 });
    const engine = new VideoPlayerEngine(runtime);
    const video = startPolicyRejected(engine);
    // the overlay's click-anywhere-to-skip handler lives at the container
    // root: the hint's click must stopPropagation before it gets there
    const containerClicks = vi.fn();
    runtime.container.addEventListener("click", containerClicks);
    const hint = runtime.container.querySelector<HTMLElement>(".dsh-opening-unmute-hint");
    expect(hint).not.toBeNull();
    Object.defineProperty(video, "paused", { value: false, configurable: true }); // the gesture lets it play
    hint!.dispatchEvent(new Event("click", { bubbles: true }));
    expect(video.muted).toBe(false);
    expect(video.volume).toBeCloseTo(0.5, 6); // volume param 50 → 0.5
    expect(runtime.container.querySelector(".dsh-opening-unmute-hint")).toBeNull();
    expect(containerClicks).not.toHaveBeenCalled(); // stopPropagation held
    expect(calls.complete).toBe(0); // the hint click never skips the opening
    engine.destroy();
  });

  it("never shows more than one hint across repeated fallback paths", () => {
    const { runtime } = makeRuntime({ volume: 50 });
    const engine = new VideoPlayerEngine(runtime);
    const video = startPolicyRejected(engine);
    expect(runtime.container.querySelectorAll(".dsh-opening-unmute-hint")).toHaveLength(1);
    // a repeated playing event early-exits (already unmuted) — no second hint
    video.dispatchEvent(new Event("playing"));
    expect(runtime.container.querySelectorAll(".dsh-opening-unmute-hint")).toHaveLength(1);
    // the async policy-rejection path falls back again on pause — the
    // existing hint is reused, never duplicated
    video.dispatchEvent(new Event("pause"));
    expect(runtime.container.querySelectorAll(".dsh-opening-unmute-hint")).toHaveLength(1);
    engine.destroy();
  });

  it("removes the hint together with the engine on destroy", () => {
    const { runtime } = makeRuntime({ volume: 50 });
    const engine = new VideoPlayerEngine(runtime);
    startPolicyRejected(engine);
    expect(runtime.container.querySelector(".dsh-opening-unmute-hint")).not.toBeNull();
    engine.destroy();
    expect(runtime.container.querySelector(".dsh-opening-unmute-hint")).toBeNull();
  });
});
