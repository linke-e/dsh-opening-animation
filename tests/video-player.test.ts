import { beforeEach, describe, expect, it, vi } from "vitest";
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

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
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
    });
    const clamped = resolveAnimationParams(videoPlayerAnimation, { volume: 999 });
    expect(clamped.volume).toBe(100);
    const muted = resolveAnimationParams(videoPlayerAnimation, { volume: -5 });
    expect(muted.volume).toBe(0);
  });
});

describe("video-player audio behavior", () => {
  it("starts muted (autoplay policy) and unmutes with the configured volume on playing", async () => {
    const { runtime } = makeRuntime({ volume: 50 });
    const engine = new VideoPlayerEngine(runtime);
    const video = await startPlaying(engine);
    expect(video.muted).toBe(true); // still muted before the first playing event
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

  it("re-kicks play() when unmuting left the video paused, and falls back to silent on rejection", async () => {
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
    video.dispatchEvent(new Event("playing"));
    expect(video.muted).toBe(false);
    expect(video.volume).toBeCloseTo(0.8, 6);
    await vi.waitFor(() => {
      expect(play).toHaveBeenCalledTimes(2);
      expect(video.muted).toBe(true);
    });
    expect(calls.fail).toBe(0); // silent playback must not fail the opening
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
