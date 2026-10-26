import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fakeCodeAnimation,
  fakeCodeVideoAnimation,
  FakeCodeEngine,
  fakeCodeLines,
  TEXT_LINES,
} from "../src/client/animations/fake-code";
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

function mediaOf(engine: FakeCodeEngine): HTMLImageElement | HTMLVideoElement {
  return Reflect.get(engine, "media") as HTMLImageElement | HTMLVideoElement;
}

describe("fake-code registry entries", () => {
  it("resolves both entries by id and kind and appears in listings", () => {
    expect(resolveAnimation("image", "fake-code")?.id).toBe("fake-code");
    expect(resolveAnimation("video", "fake-code-video")?.id).toBe("fake-code-video");
    expect(resolveAnimation("video", "fake-code")).toBeUndefined();
    expect(resolveAnimation("image", "fake-code-video")).toBeUndefined();
    expect(listAnimations("image").map((animation) => animation.id)).toContain("fake-code");
    expect(listAnimations("video").map((animation) => animation.id)).toContain("fake-code-video");
  });

  it("defaults its params and clamps numeric overrides (image entry)", () => {
    expect(resolveAnimationParams(fakeCodeAnimation)).toEqual({
      durationMs: 8000,
      typeMs: 5,
      lineMs: 100,
      dim: 0.45,
      mediaFit: "cover",
      text: "",
    });
    const clamped = resolveAnimationParams(fakeCodeAnimation, {
      durationMs: 99_999,
      typeMs: 0,
      lineMs: 999,
      dim: 5,
    });
    expect(clamped.durationMs).toBe(30_000);
    expect(clamped.typeMs).toBe(1);
    expect(clamped.lineMs).toBe(500);
    expect(clamped.dim).toBe(1);
  });

  it("adds the video backdrop params on the video entry", () => {
    expect(resolveAnimationParams(fakeCodeVideoAnimation)).toEqual({
      durationMs: 8000,
      typeMs: 5,
      lineMs: 100,
      dim: 0.45,
      mediaFit: "cover",
      text: "",
      loop: "loop",
      volume: 0,
    });
  });
});

describe("fakeCodeLines", () => {
  it("falls back to the built-in kernel snippet for blank text", () => {
    expect(fakeCodeLines("")).toEqual([...TEXT_LINES]);
    expect(fakeCodeLines("   ")).toEqual([...TEXT_LINES]);
    expect(TEXT_LINES.length).toBeGreaterThan(20);
    expect(TEXT_LINES[TEXT_LINES.length - 1]).toBe("echo('Hello World');");
  });

  it("splits custom text on real newlines or /n exactly like the reference's data-text", () => {
    expect(fakeCodeLines("a/nb")).toEqual(["a", "b"]);
    expect(fakeCodeLines("/n a /n")).toEqual(["", " a ", ""]);
    // the multi-line editor arrives with real newlines
    expect(fakeCodeLines("let a = 1;\nlet b = 2;\n\nprint(a);")).toEqual([
      "let a = 1;",
      "let b = 2;",
      "",
      "print(a);",
    ]);
  });
});

describe("fake-code engine typing and lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("types lines on the reference's cadence: lineMs stagger, typeMs characters", () => {
    const { runtime, calls } = makeRuntime("image");
    const engine = new FakeCodeEngine(runtime);
    engine.start();
    const lines = runtime.container.querySelectorAll(".dsh-opening-fc-line");
    expect(lines.length).toBe(TEXT_LINES.length);
    // line 0 after three character steps (the first lands synchronously when
    // the line's timer fires, then one per typeMs); line 1 not yet started
    vi.advanceTimersByTime(5 * 2);
    expect(lines[0]?.textContent).toBe(TEXT_LINES[0]?.slice(0, 3));
    expect(lines[1]?.textContent ?? "").toBe("");
    // line 1 starts at lineMs and types its first character
    vi.advanceTimersByTime(100);
    expect(lines[1]?.textContent).toBe(TEXT_LINES[1]?.slice(0, 1));
    expect(calls.complete).toBe(0);
    engine.destroy();
  });

  it("completes at durationMs even though typing may still be running", () => {
    const { runtime, calls } = makeRuntime("image");
    const engine = new FakeCodeEngine(runtime);
    engine.start();
    vi.advanceTimersByTime(8000);
    expect(calls.complete).toBe(1);
    engine.destroy();
  });

  it("skip freezes the typed-so-far frame and is idempotent", () => {
    const { runtime, calls } = makeRuntime("image");
    const engine = new FakeCodeEngine(runtime);
    engine.start();
    vi.advanceTimersByTime(5 * 2);
    const frozen = runtime.container.querySelectorAll(".dsh-opening-fc-line")[0]?.textContent;
    engine.skip();
    expect(calls.complete).toBe(1);
    vi.advanceTimersByTime(10_000);
    expect(runtime.container.querySelectorAll(".dsh-opening-fc-line")[0]?.textContent).toBe(frozen);
    engine.skip(); // idempotent
    expect(calls.complete).toBe(1);
    engine.destroy();
  });

  it("destroy clears every pending line and character timer", () => {
    const { runtime, calls } = makeRuntime("image");
    const engine = new FakeCodeEngine(runtime);
    engine.start();
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    engine.destroy();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(calls.complete).toBe(0);
    expect(calls.fail).toBe(0);
  });

  it("fails the run when the image errors, and destroy stops further callbacks", () => {
    const { runtime, calls } = makeRuntime("image");
    const engine = new FakeCodeEngine(runtime);
    engine.start();
    mediaOf(engine).dispatchEvent(new Event("error"));
    expect(calls.fail).toBe(1);
    engine.destroy();
    mediaOf(engine).dispatchEvent(new Event("error"));
    expect(calls.fail).toBe(1);
  });

  it("reports readiness on the video's canplay and honors loop=once", () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const { runtime, calls } = makeRuntime("video", { loop: "once", volume: 0 });
    const engine = new FakeCodeEngine(runtime);
    engine.start();
    const video = mediaOf(engine) as HTMLVideoElement;
    expect(video.loop).toBe(false);
    expect(calls.markLoaded).toBe(0);
    video.dispatchEvent(new Event("canplay"));
    expect(calls.markLoaded).toBe(1);
    engine.destroy();
    vi.restoreAllMocks();
  });
});
