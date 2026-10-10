import { describe, expect, it } from "vitest";
import {
  DEFAULT_CAPTION,
  glitchAnimation,
  GlitchEngine,
  karaokeStepMs,
  kenBurns,
  parseCaption,
  rollGlitchBands,
  waveOffset,
} from "../src/client/animations/glitch";
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

describe("glitch caption parsing", () => {
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

describe("glitch camera", () => {
  it("pushes from 1.02 to 1.08 with a slight rightward drift", () => {
    expect(kenBurns(0)).toEqual({ zoom: 1.02, shift: 0 });
    expect(kenBurns(1)).toEqual({ zoom: 1.08, shift: 0.025 });
    expect(kenBurns(0.5).zoom).toBeCloseTo(1.05, 10);
    expect(kenBurns(2)).toEqual(kenBurns(1));
    expect(kenBurns(-1)).toEqual(kenBurns(0));
  });
});

describe("vhs tracking wave", () => {
  const cfg = { lambda: 120, crests: 2, topAmp: 11 };

  it("pushes hardest at the top and dies out at the bottom", () => {
    let topMax = 0;
    let bottomMax = 0;
    for (let i = 0; i <= 300; i++) {
      const t = (i / 300) * 3; // 3 s covers several crest passes
      topMax = Math.max(topMax, Math.abs(waveOffset(1080, 1080, t, cfg).dy));
      bottomMax = Math.max(bottomMax, Math.abs(waveOffset(10, 1080, t, cfg).dy));
    }
    expect(topMax).toBeGreaterThan(8); // ±8–15 px envelope at the top edge
    expect(topMax).toBeLessThanOrEqual(13.1); // topAmp + breath 2
    expect(bottomMax).toBeLessThanOrEqual(2.05); // breath only near the bottom
  });

  it("travels upward: a crest reaches half a wavelength higher a quarter period later", () => {
    // depth and depth+lambda share the same phase family (spatial period), so
    // compare half a wavelength apart instead: the crest must arrive later
    // the higher it is — the wave climbs from the bottom edge.
    const firstCrest = (depth: number) => {
      for (let i = 0; i < 900; i++) {
        const t = (i / 900) * 3;
        if (waveOffset(depth, 1080, t, cfg).dy > 8) return t; // near-crest only
      }
      return Number.NaN;
    };
    const t1 = firstCrest(900);
    const t2 = firstCrest(900 + cfg.lambda / 2);
    expect(t1).toBeGreaterThan(0);
    expect(t2 - t1).toBeCloseTo(1 / (2 * cfg.crests), 1); // a quarter second later
  });
});

describe("glitch burst bands", () => {
  it("rolls 3-5 distinct bands of eight with jittered shifts and occasional shear", () => {
    let skewed = 0;
    for (let i = 0; i < 80; i++) {
      const bands = rollGlitchBands();
      expect(bands.length).toBeGreaterThanOrEqual(3);
      expect(bands.length).toBeLessThanOrEqual(5);
      const seen = new Set<number>();
      for (const band of bands) {
        expect(band.index).toBeGreaterThanOrEqual(0);
        expect(band.index).toBeLessThanOrEqual(7);
        expect(seen.has(band.index)).toBe(false);
        seen.add(band.index);
        expect(Math.abs(band.dx)).toBeGreaterThanOrEqual(5);
        expect(Math.abs(band.dx)).toBeLessThanOrEqual(34);
        expect(Number.isInteger(band.dx)).toBe(true);
        if (band.skew === 0) continue;
        skewed += 1;
        expect(Math.abs(band.skew)).toBeGreaterThanOrEqual(0.09);
        expect(Math.abs(band.skew)).toBeLessThanOrEqual(0.3);
      }
    }
    expect(skewed).toBeGreaterThan(0); // shearing does occur across rolls
  });
});

describe("glitch karaoke step", () => {
  it("keeps a leisurely pace when the budget allows, and speeds up to fit when tight", () => {
    const words = 13;
    expect(karaokeStepMs(20_000, words)).toBe(900); // 18 s budget → cap at 900 ms
    expect(karaokeStepMs(10_000, words)).toBeCloseTo(615.4, 0); // fits: 1200 + 12×615 ≈ 8.6 s < 10 s
    expect(karaokeStepMs(4_000, words)).toBe(300); // floor: still lights every word in time
    expect(karaokeStepMs(20_000, 1)).toBe(900);
  });
});

describe("glitch params", () => {
  it("defaults caption text and font, and accepts string overrides", () => {
    const d = resolveAnimationParams(glitchAnimation);
    expect(d.durationMs).toBe(20_000);
    expect(d.caption).toBe(DEFAULT_CAPTION);
    expect(typeof d.captionFont).toBe("string");
    expect(String(d.captionFont).length).toBeGreaterThan(0);
    const o = resolveAnimationParams(glitchAnimation, {
      caption: "自定义\n[文本]",
      captionFont: "Georgia, serif",
    });
    expect(o.caption).toBe("自定义\n[文本]");
    expect(o.captionFont).toBe("Georgia, serif");
  });
});

describe("glitch engine lifecycle (jsdom, no 2d context)", () => {
  it("constructs, starts and skips to completion without throwing on a null context", () => {
    const { runtime, calls } = makeRuntime();
    const engine = new GlitchEngine(runtime);
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
    const engine = new GlitchEngine(runtime);
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
    const engine = new GlitchEngine(runtime);
    engine.start();
    const img = Reflect.get(engine, "img") as HTMLImageElement;
    img.dispatchEvent(new Event("error"));
    expect(calls.fail).toBe(1);
    engine.destroy();
    img.dispatchEvent(new Event("error"));
    expect(calls.fail).toBe(1);
  });
});
