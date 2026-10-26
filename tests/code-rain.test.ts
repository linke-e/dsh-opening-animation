import { describe, expect, it, vi } from "vitest";
import {
  buildRainStreams,
  codeRainAnimation,
  codeRainVideoAnimation,
  CodeRainEngine,
  initialGlyphY,
  LANGS,
} from "../src/client/animations/code-rain";
import { listAnimations, resolveAnimation, resolveAnimationParams } from "../src/client/registry";

function makeRuntime(
  kind: "image" | "video",
  params: Readonly<Record<string, unknown>> = {},
) {
  const calls = { complete: 0, fail: 0, markLoaded: 0 };
  const runtime = {
    container: document.createElement("div"),
    media: {
      url: kind === "video" ? "data:video/mp4;base64,AAAA" : "data:image/png;base64,AAAA",
      kind,
      mime: kind === "video" ? "video/mp4" : "image/png",
      name: kind === "video" ? "t.mp4" : "t.png",
    },
    params,
    t: (key: string) => key,
    markLoaded: () => {
      calls.markLoaded += 1;
    },
    complete: () => {
      calls.complete += 1;
    },
    fail: () => {
      calls.fail += 1;
    },
  };
  return { calls, runtime };
}

function mediaOf(engine: CodeRainEngine): HTMLImageElement | HTMLVideoElement {
  return Reflect.get(engine, "media") as HTMLImageElement | HTMLVideoElement;
}

describe("code-rain registry entries", () => {
  it("resolves both entries by id and kind and appears in listings", () => {
    expect(resolveAnimation("image", "code-rain")?.id).toBe("code-rain");
    expect(resolveAnimation("video", "code-rain-video")?.id).toBe("code-rain-video");
    expect(resolveAnimation("video", "code-rain")).toBeUndefined();
    expect(resolveAnimation("image", "code-rain-video")).toBeUndefined();
    expect(listAnimations("image").map((animation) => animation.id)).toContain("code-rain");
    expect(listAnimations("video").map((animation) => animation.id)).toContain("code-rain-video");
  });

  it("defaults its params and clamps numeric overrides (image entry)", () => {
    expect(resolveAnimationParams(codeRainAnimation)).toEqual({
      durationMs: 6000,
      fontSize: 18,
      dim: 0.45,
      mediaFit: "cover",
    });
    const clamped = resolveAnimationParams(codeRainAnimation, {
      durationMs: 99_999,
      fontSize: 999,
      dim: 5,
    });
    expect(clamped.durationMs).toBe(30_000);
    expect(clamped.fontSize).toBe(30);
    expect(clamped.dim).toBe(1);
  });

  it("adds the video backdrop params on the video entry", () => {
    expect(resolveAnimationParams(codeRainVideoAnimation)).toEqual({
      durationMs: 6000,
      fontSize: 18,
      dim: 0.45,
      mediaFit: "cover",
      loop: "loop",
      volume: 0,
    });
  });
});

describe("buildRainStreams", () => {
  it("is deterministic for a given seed", () => {
    const a = buildRainStreams(42, 1920, 18);
    const b = buildRainStreams(42, 1920, 18);
    expect(a).toEqual(b);
  });

  it("tiles the viewport with one stream per charSize column", () => {
    const streams = buildRainStreams(42, 1920, 18);
    // the reference's for (x = 0; x < width; x += charSize): the last column
    // may overrun the right edge, so the count is a ceiling
    expect(streams.length).toBe(Math.ceil(1920 / 18));
    for (const [i, stream] of streams.entries()) {
      expect(stream.x).toBeCloseTo(i * 18, 6);
    }
  });

  it("builds each stream from a hello-matrix phrase, reversed, first char last", () => {
    const streams = buildRainStreams(42, 1920, 18);
    for (const stream of streams) {
      const phrase = stream.glyphs.slice().reverse().join("");
      expect(LANGS).toContain(phrase);
      // the phrase's first glyph is the stream's bottom glyph
      expect(stream.glyphs[stream.glyphs.length - 1]).toBe(phrase[0]);
      // the reference's random(2, 10) px/frame at 60fps
      expect(stream.speedPx).toBeGreaterThanOrEqual(120);
      expect(stream.speedPx).toBeLessThanOrEqual(600);
      // the reference's random(length * 4) * charSize scatter
      expect(stream.startPx).toBeGreaterThanOrEqual(0);
      expect(stream.startPx).toBeLessThan(stream.glyphs.length * 4 * 18);
    }
  });
  it("starts every stream above the top edge so the rain grows in from nothing", () => {
    const streams = buildRainStreams(42, 1920, 18);
    for (const stream of streams) {
      const ys = initialGlyphY(stream, 18);
      expect(ys.length).toBe(stream.glyphs.length);
      // the bottom glyph (the phrase's first char) starts at or above the top
      // edge: the stream's bottom edge enters at the page top, not mid-screen
      expect(ys[ys.length - 1]).toBeLessThanOrEqual(-18);
      expect(ys[ys.length - 1]).toBe(-18 - stream.startPx);
      // glyphs ascend in charSize slots above the bottom one
      for (let k = 1; k < ys.length; k++) {
        expect(ys[k - 1]).toBeCloseTo((ys[k] ?? 0) - 18, 6);
      }
    }
    // the per-stream scatter staggers the entries (not every stream enters at once)
    const bottoms = streams.slice(0, 20).map((stream) => initialGlyphY(stream, 18).at(-1));
    expect(new Set(bottoms).size).toBeGreaterThan(1);
  });
});

describe("code-rain engine lifecycle (jsdom, no 2d context)", () => {
  it("constructs, starts and skips to completion without throwing on a null context", () => {
    const { runtime, calls } = makeRuntime("image");
    const engine = new CodeRainEngine(runtime);
    expect(() => engine.start()).not.toThrow();
    expect(calls.complete).toBe(0);
    engine.skip();
    expect(calls.complete).toBe(1);
    engine.skip(); // idempotent
    expect(calls.complete).toBe(1);
    engine.destroy();
  });

  it("fails the run when the image errors, and destroy stops further callbacks", () => {
    const { runtime, calls } = makeRuntime("image");
    const engine = new CodeRainEngine(runtime);
    engine.start();
    const img = mediaOf(engine) as HTMLImageElement;
    img.dispatchEvent(new Event("error"));
    expect(calls.fail).toBe(1);
    engine.destroy();
    img.dispatchEvent(new Event("error"));
    expect(calls.fail).toBe(1);
  });

  it("reports readiness on the video's canplay and honors loop=once", () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const { runtime, calls } = makeRuntime("video", { loop: "once", volume: 0 });
    const engine = new CodeRainEngine(runtime);
    engine.start();
    const video = mediaOf(engine) as HTMLVideoElement;
    expect(video.loop).toBe(false);
    expect(calls.markLoaded).toBe(0);
    video.dispatchEvent(new Event("canplay"));
    expect(calls.markLoaded).toBe(1);
    engine.destroy();
    vi.restoreAllMocks();
  });

  it("probes an unmute with the configured volume on the first playing event", () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const { runtime } = makeRuntime("video", { volume: 55 });
    const engine = new CodeRainEngine(runtime);
    const video = mediaOf(engine) as HTMLVideoElement;
    Object.defineProperty(video, "paused", { value: false, configurable: true });
    engine.start();
    expect(video.muted).toBe(true); // still muted before the first playing event
    video.dispatchEvent(new Event("playing"));
    expect(video.muted).toBe(false);
    expect(video.volume).toBeCloseTo(0.55, 5);
    video.dispatchEvent(new Event("playing")); // a repeated event must not flip again
    expect(video.muted).toBe(false);
    engine.destroy();
    vi.restoreAllMocks();
  });

  it("falls back to silent playback when the unmute is paused by the autoplay policy", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const { runtime, calls } = makeRuntime("video", { volume: 55 });
    const engine = new CodeRainEngine(runtime);
    engine.start();
    await vi.waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    // jsdom videos report paused=true by default: unmuting "pauses" the video
    // synchronously, so the engine must fall back to muted playback itself.
    mediaOf(engine).dispatchEvent(new Event("playing"));
    expect((mediaOf(engine) as HTMLVideoElement).muted).toBe(true);
    await vi.waitFor(() => expect(play).toHaveBeenCalledTimes(2));
    expect(calls.fail).toBe(0); // a silent backdrop must not fail the opening
    engine.destroy();
    vi.restoreAllMocks();
  });

  it("never completes when the video ends: durationMs owns the hand-over", () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const { runtime, calls } = makeRuntime("video", { volume: 55 });
    const engine = new CodeRainEngine(runtime);
    engine.start();
    const video = mediaOf(engine) as HTMLVideoElement;
    video.dispatchEvent(new Event("playing"));
    Object.defineProperty(video, "ended", { value: true, configurable: true });
    video.dispatchEvent(new Event("pause")); // a natural end pauses first
    expect(calls.complete).toBe(0);
    engine.destroy();
    vi.restoreAllMocks();
  });
});
