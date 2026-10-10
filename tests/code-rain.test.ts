import { describe, expect, it } from "vitest";
import {
  buildRainColumns,
  codeRainAnimation,
  CodeRainEngine,
} from "../src/client/animations/code-rain";
import { listAnimations, resolveAnimation, resolveAnimationParams } from "../src/client/registry";

function makeRuntime(params: Readonly<Record<string, unknown>> = {}, reducedMotion = false) {
  const calls = { complete: 0, fail: 0, markLoaded: 0 };
  return {
    calls,
    runtime: {
      container: document.createElement("div"),
      media: { url: "data:image/png;base64,AAAA", kind: "image" as const, mime: "image/png", name: "t.png" },
      reducedMotion,
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
    },
  };
}

describe("code-rain registry entry", () => {
  it("resolves by id and kind and appears in listings", () => {
    expect(resolveAnimation("image", "code-rain")?.id).toBe("code-rain");
    expect(resolveAnimation("video", "code-rain")).toBeUndefined();
    expect(listAnimations("image").map((animation) => animation.id)).toContain("code-rain");
  });

  it("defaults its params and clamps numeric overrides", () => {
    expect(resolveAnimationParams(codeRainAnimation)).toEqual({
      durationMs: 6000,
      columns: 40,
    });
    const clamped = resolveAnimationParams(codeRainAnimation, {
      durationMs: 99_999,
      columns: 999,
    });
    expect(clamped.durationMs).toBe(30_000);
    expect(clamped.columns).toBe(96);
  });
});

describe("code-rain timeline and columns", () => {
  it("builds deterministic columns that tile the viewport with staggered starts", () => {
    const a = buildRainColumns(42, 40, 1920, 6000);
    const b = buildRainColumns(42, 40, 1920, 6000);
    expect(a).toEqual(b);
    expect(a.length).toBe(40);
    for (const [i, col] of a.entries()) {
      expect(col.x).toBeCloseTo(i * 48, 6);
      expect(col.w).toBeCloseTo(48, 6);
      expect(col.start).toBeGreaterThanOrEqual(0);
      expect(col.start).toBeLessThan(6000 * 0.18);
      // every stream is fully off-screen at least the settling margin
      // (400 ms) before the hand-over at total
      expect(col.end).toBeLessThanOrEqual(6000 - 400);
      expect(col.end - col.start).toBeGreaterThanOrEqual(6000 * 0.35);
    }
    const last = a[a.length - 1]!;
    expect(last.x + last.w).toBeCloseTo(1920, 6);
    // one designated stream finishes exactly at the last slot, so its tail
    // visibly sweeps the bottom edge right before the settling margin starts
    expect(a.some((col) => col.end === 6000 - 400)).toBe(true);
  });
});

describe("code-rain engine lifecycle (jsdom, no 2d context)", () => {
  it("constructs, starts and skips to completion without throwing on a null context", () => {
    const { runtime, calls } = makeRuntime();
    const engine = new CodeRainEngine(runtime);
    expect(() => engine.start()).not.toThrow();
    expect(calls.complete).toBe(0);
    engine.skip();
    expect(calls.complete).toBe(1);
    engine.skip(); // idempotent
    expect(calls.complete).toBe(1);
    engine.destroy();
  });

  it("reports readiness and completes exactly once on reduced motion at image load", () => {
    const { runtime, calls } = makeRuntime({}, true);
    const engine = new CodeRainEngine(runtime);
    engine.start();
    const img = Reflect.get(engine, "img") as HTMLImageElement;
    Object.defineProperty(img, "complete", { value: true, configurable: true });
    Object.defineProperty(img, "naturalWidth", { value: 4, configurable: true });
    img.dispatchEvent(new Event("load"));
    expect(calls.markLoaded).toBe(1);
    expect(calls.complete).toBe(1);
    engine.skip();
    expect(calls.complete).toBe(1);
    engine.destroy();
  });

  it("fails the run when the image errors, and destroy stops further callbacks", () => {
    const { runtime, calls } = makeRuntime();
    const engine = new CodeRainEngine(runtime);
    engine.start();
    const img = Reflect.get(engine, "img") as HTMLImageElement;
    img.dispatchEvent(new Event("error"));
    expect(calls.fail).toBe(1);
    engine.destroy();
    img.dispatchEvent(new Event("error"));
    expect(calls.fail).toBe(1);
  });
});
