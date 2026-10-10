import { describe, expect, it } from "vitest";
import {
  DEFAULT_CAPTION,
  karaokeStepMs,
  parseCaption,
  PoolEngine,
  poolAnimation,
  splashWaterField,
  stepWaterField,
} from "../src/client/animations/pool";
import { resolveAnimationParams } from "../src/client/registry";

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

describe("pool caption parsing", () => {
  it("splits lines and marks bracketed words as highlights", () => {
    const lines = parseCaption("My [finger] rests [upon] ink,\na [silent] [testament].");
    expect(lines.length).toBe(2);
    expect(lines[0]).toEqual([
      { text: "My ", emph: false },
      { text: "finger", emph: true },
      { text: " rests ", emph: false },
      { text: "upon", emph: true },
      { text: " ink,", emph: false },
    ]);
    expect(lines[1]!.filter((t) => t.emph).map((t) => t.text)).toEqual(["silent", "testament"]);
  });

  it("drops empty highlights and survives an unclosed bracket", () => {
    const lines = parseCaption("a [] b [open c");
    expect(lines[0]).toEqual([
      { text: "a ", emph: false },
      { text: " b ", emph: false },
      { text: "open c", emph: false },
    ]);
  });

  it("skips blank lines", () => {
    const lines = parseCaption("first\n\n   \nsecond line");
    expect(lines.length).toBe(2);
    expect(lines[1]![0]!.text).toBe("second line");
  });
});

describe("water field", () => {
  const W = 9;
  const H = 7;

  it("keeps a flat field flat through a step", () => {
    const prev = new Float32Array(W * H);
    const cur = new Float32Array(W * H);
    stepWaterField(prev, cur, W, H, 0.985);
    for (let i = 0; i < prev.length; i++) expect(prev[i]).toBe(0);
  });

  it("spreads a single cell to its four neighbors in one step", () => {
    const prev = new Float32Array(W * H);
    const cur = new Float32Array(W * H);
    const c = 3 * W + 4; // interior cell
    cur[c] = 1;
    stepWaterField(prev, cur, W, H, 0.985);
    expect(prev[c - 1]).not.toBe(0);
    expect(prev[c + 1]).not.toBe(0);
    expect(prev[c - W]).not.toBe(0);
    expect(prev[c + W]).not.toBe(0);
  });

  it("splash leaves cells outside the radius untouched", () => {
    const field = new Float32Array(W * H);
    splashWaterField(field, W, H, 4, 3, 2, 1.2);
    // Nearest corner cells beyond the splash circle (distance √8 > 2).
    expect(field[5 * W + 6]).toBe(0);
    expect(field[1 * W + 2]).toBe(0);
    // Inside the circle the Gaussian kernel does inject (float32 precision).
    expect(field[3 * W + 4]).toBeCloseTo(1.2, 5);
  });

  it("leaves the field unchanged when strength is 0", () => {
    const field = new Float32Array(W * H);
    splashWaterField(field, W, H, 4, 3, 2, 0);
    for (let i = 0; i < field.length; i++) expect(field[i]).toBe(0);
  });

  it("damps instead of diverging: 60 steps peak strictly below the initial peak", () => {
    let prev = new Float32Array(W * H);
    let cur = new Float32Array(W * H);
    splashWaterField(cur, W, H, 4, 3, 2, 1.2);
    let peak = 0;
    for (let i = 0; i < cur.length; i++) peak = Math.max(peak, Math.abs(cur[i]!));
    for (let s = 0; s < 60; s++) {
      stepWaterField(prev, cur, W, H, 0.985);
      const tmp = prev;
      prev = cur;
      cur = tmp;
    }
    let last = 0;
    for (let i = 0; i < cur.length; i++) last = Math.max(last, Math.abs(cur[i]!));
    expect(last).toBeLessThan(peak);
  });
});

describe("pool karaoke step", () => {
  it("keeps a leisurely pace when the budget allows, and speeds up to fit when tight", () => {
    const words = 13;
    expect(karaokeStepMs(20_000, words)).toBe(900); // 18 s budget → cap at 900 ms
    expect(karaokeStepMs(10_000, words)).toBeCloseTo(615.4, 0); // fits: 1200 + 12×615 ≈ 8.6 s < 10 s
    expect(karaokeStepMs(4_000, words)).toBe(300); // floor: still lights every word in time
    expect(karaokeStepMs(20_000, 1)).toBe(900);
  });
});

describe("pool params", () => {
  it("defaults caption text and font, and accepts string overrides", () => {
    const d = resolveAnimationParams(poolAnimation);
    expect(d.durationMs).toBe(20_000);
    expect(d.rippleStrength).toBe(1);
    expect(d.caption).toBe(DEFAULT_CAPTION);
    expect(typeof d.captionFont).toBe("string");
    expect(String(d.captionFont).length).toBeGreaterThan(0);
    const o = resolveAnimationParams(poolAnimation, {
      caption: "自定义\n[文本]",
      captionFont: "Georgia, serif",
    });
    expect(o.caption).toBe("自定义\n[文本]");
    expect(o.captionFont).toBe("Georgia, serif");
  });

  it("clamps ripple strength overrides to the schema range", () => {
    expect(resolveAnimationParams(poolAnimation, { rippleStrength: 99 }).rippleStrength).toBe(3);
  });
});

describe("pool engine lifecycle (jsdom, no 2d context)", () => {
  it("constructs, starts and skips to completion without throwing on a null context", () => {
    const { runtime, calls } = makeRuntime();
    const engine = new PoolEngine(runtime);
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
    const engine = new PoolEngine(runtime);
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
    const engine = new PoolEngine(runtime);
    engine.start();
    const img = Reflect.get(engine, "img") as HTMLImageElement;
    img.dispatchEvent(new Event("error"));
    expect(calls.fail).toBe(1);
    engine.destroy();
    img.dispatchEvent(new Event("error"));
    expect(calls.fail).toBe(1);
  });
});
