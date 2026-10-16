import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Constructivism1Engine,
  captionLines,
  constructivism1Animation,
  constructivism1VideoAnimation,
} from "../src/client/animations/constructivism1";
import { listAnimations, resolveAnimation, resolveAnimationParams } from "../src/client/registry";
import { GLOBAL_STYLES } from "../src/client/styles";

const IMAGE_URL = "data:image/png;base64,AAAA";
const VIDEO_URL = "data:video/mp4;base64,AAAA";

function makeRuntime(
  params: Readonly<Record<string, unknown>> = {},
  kind: "image" | "video" = "image",
) {
  const calls = { complete: 0, fail: 0, markLoaded: 0 };
  return {
    calls,
    runtime: {
      container: document.createElement("div"),
      media: {
        url: kind === "image" ? IMAGE_URL : VIDEO_URL,
        kind,
        mime: kind === "image" ? "image/png" : "video/mp4",
        name: kind === "image" ? "t.png" : "t.mp4",
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
    },
  };
}

function mediaOf(engine: Constructivism1Engine): HTMLImageElement | HTMLVideoElement {
  return Reflect.get(engine, "mediaEl") as HTMLImageElement | HTMLVideoElement;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("caption splitting", () => {
  it("falls back to the built-in headline and caps the blocks at three", () => {
    expect(captionLines("")).toEqual(["DEEPSEEK", "HARNESS"]);
    expect(captionLines("  |  ")).toEqual(["DEEPSEEK", "HARNESS"]);
    expect(captionLines("ART IS|A WEAPON")).toEqual(["ART IS", "A WEAPON"]);
    expect(captionLines("A|B|C|D")).toEqual(["A", "B", "C"]);
  });
});

describe("constructivism1 registry entries", () => {
  it("registers both ids with mutually exclusive kinds", () => {
    expect(resolveAnimation("image", "constructivism1")?.id).toBe("constructivism1");
    expect(resolveAnimation("video", "constructivism1")).toBeUndefined();
    expect(resolveAnimation("video", "constructivism1-video")?.id).toBe("constructivism1-video");
    expect(resolveAnimation("image", "constructivism1-video")).toBeUndefined();
    expect(listAnimations("image").map((animation) => animation.id)).toContain("constructivism1");
    expect(listAnimations("video").map((animation) => animation.id)).toContain("constructivism1-video");
  });

  it("shares the label keys and defaults the two param sets", () => {
    expect(constructivism1Animation.labelKey).toBe(constructivism1VideoAnimation.labelKey);
    expect(resolveAnimationParams(constructivism1Animation)).toEqual({
      durationMs: 6500,
      caption: "",
      mediaFit: "cover",
      accentColor: "#173F9E",
    });
    expect(resolveAnimationParams(constructivism1VideoAnimation)).toEqual({
      durationMs: 6500,
      caption: "",
      mediaFit: "cover",
      accentColor: "#173F9E",
      loop: "loop",
      volume: 0,
    });
  });

  it("clamps number overrides to the schema range", () => {
    const clamped = resolveAnimationParams(constructivism1VideoAnimation, {
      durationMs: 99999,
      volume: 120,
    });
    expect(clamped.durationMs).toBe(20000);
    expect(clamped.volume).toBe(100);
  });
});

describe("constructivism1 image variant (jsdom)", () => {
  it("builds the poster DOM, sets the img src and honors mediaFit", () => {
    const { runtime } = makeRuntime();
    const engine = new Constructivism1Engine(runtime);
    engine.start();
    const img = runtime.container.querySelector<HTMLImageElement>(".dsh-opening-cst-media");
    expect(img?.src).toBe(IMAGE_URL);
    expect(img?.style.objectFit).toBe("cover");
    expect(runtime.container.querySelector(".dsh-opening-cst-frame-clip .dsh-opening-cst-media")).not.toBeNull();
    expect(runtime.container.querySelector(".dsh-opening-cst-brand")?.textContent).toBe("DEEPSEEK");
    engine.destroy();

    const contain = makeRuntime({ mediaFit: "contain" });
    const engine2 = new Constructivism1Engine(contain.runtime);
    engine2.start();
    expect(contain.runtime.container.querySelector<HTMLElement>(".dsh-opening-cst-media")?.style.objectFit).toBe(
      "contain",
    );
    engine2.destroy();
  });

  it("presses the corner collage block and the ink triangle over the media window", () => {
    const { runtime } = makeRuntime();
    const engine = new Constructivism1Engine(runtime);
    engine.start();
    expect(runtime.container.querySelector(".dsh-opening-cst-corner")).not.toBeNull();
    expect(runtime.container.querySelector(".dsh-opening-cst-tri")).not.toBeNull();
    // Layer order: both pieces render after the media frame and before the
    // caption column; the z-index itself (frame 3 < corner/tri 4 < column 5)
    // lives in the stylesheet — jsdom cannot see class styles.
    const root = runtime.container.querySelector(".dsh-opening-cst")!;
    const order = [...root.children].map((el) => el.className);
    const at = (name: string): number => order.findIndex((className) => className.startsWith(name));
    const frameAt = at("dsh-opening-cst-frame");
    const cornerAt = at("dsh-opening-cst-corner");
    const triAt = at("dsh-opening-cst-tri");
    const colAt = at("dsh-opening-cst-col");
    expect(frameAt).toBeGreaterThanOrEqual(0);
    expect(cornerAt).toBeGreaterThan(frameAt);
    expect(triAt).toBeGreaterThan(cornerAt);
    expect(colAt).toBeGreaterThan(triAt);
    // The print-offset under-layers are blue over deep ink-navy — no red layer.
    expect(runtime.container.querySelector(".dsh-opening-cst-frame-deep")).not.toBeNull();
    expect(runtime.container.querySelector(".dsh-opening-cst-frame-red")).toBeNull();
    engine.destroy();
  });

  it("keeps the recolored poster free of any red default", () => {
    const css = GLOBAL_STYLES.toLowerCase();
    expect(css).not.toContain("#e23a2e");
    expect(css).toContain("--cst-paper: #e3d1bd");
    expect(css).toContain("--cst-ink: #141414");
    expect(css).toContain("--cst-blue: #173f9e");
    expect(css).toContain("--cst-deep: #001333");
    expect(css).toContain("--cst-cream: #efe0c9");
    expect(css).toContain("--cst-accent: #173f9e");
  });

  it("keeps the corner and halftone-a collage blocks flat solid ink with no texture layers", () => {
    for (const selector of [".dsh-opening-cst-corner {", ".dsh-opening-cst-halftone-a {"]) {
      const start = GLOBAL_STYLES.indexOf(selector);
      const end = GLOBAL_STYLES.indexOf("}", start);
      const rule = GLOBAL_STYLES.slice(start, end);
      expect(rule).not.toContain("radial-gradient");
      expect(rule).not.toContain("repeating-linear-gradient");
      expect(rule).toContain("background-color: var(--cst-ink)");
    }
  });

  it("renders the default caption blocks and honors a custom caption", () => {
    const { runtime } = makeRuntime();
    const engine = new Constructivism1Engine(runtime);
    engine.start();
    const blocks = [...runtime.container.querySelectorAll<HTMLElement>(".dsh-opening-cst-block")];
    expect(blocks.map((block) => block.textContent)).toEqual(["DEEPSEEK", "HARNESS"]);
    engine.destroy();

    const custom = makeRuntime({ caption: "ART|IS|A|WEAPON" });
    const engine2 = new Constructivism1Engine(custom.runtime);
    engine2.start();
    const customBlocks = [...custom.runtime.container.querySelectorAll<HTMLElement>(".dsh-opening-cst-block")];
    expect(customBlocks.map((block) => block.textContent)).toEqual(["ART", "IS", "A"]);
    engine2.destroy();
  });

  it("reports readiness on img load and fails on its error", () => {
    const { runtime, calls } = makeRuntime({ durationMs: 4000 });
    const engine = new Constructivism1Engine(runtime);
    engine.start();
    mediaOf(engine).dispatchEvent(new Event("load"));
    expect(calls.markLoaded).toBe(1);
    mediaOf(engine).dispatchEvent(new Event("error"));
    expect(calls.fail).toBe(1);
    engine.destroy();
  });
});

describe("constructivism1 timeline (jsdom)", () => {
  it("completes exactly once after durationMs", () => {
    vi.useFakeTimers();
    const { runtime, calls } = makeRuntime({ durationMs: 4000 });
    const engine = new Constructivism1Engine(runtime);
    engine.start();
    vi.advanceTimersByTime(3999);
    expect(calls.complete).toBe(0);
    vi.advanceTimersByTime(1);
    expect(calls.complete).toBe(1);
    vi.advanceTimersByTime(10000);
    expect(calls.complete).toBe(1); // idempotent
    engine.destroy();
  });

  it("skip lands on the final-frame class, is idempotent and beats the timer", () => {
    vi.useFakeTimers();
    const { runtime, calls } = makeRuntime({ durationMs: 5000 });
    const engine = new Constructivism1Engine(runtime);
    engine.start();
    engine.skip();
    expect(calls.complete).toBe(1);
    expect(runtime.container.querySelector(".dsh-opening-cst-final")).not.toBeNull();
    engine.skip();
    expect(calls.complete).toBe(1);
    vi.advanceTimersByTime(8000);
    expect(calls.complete).toBe(1);
    engine.destroy();
  });

  it("does not complete after destroy", () => {
    vi.useFakeTimers();
    const { runtime, calls } = makeRuntime({ durationMs: 4000 });
    const engine = new Constructivism1Engine(runtime);
    engine.start();
    engine.destroy();
    vi.advanceTimersByTime(10000);
    expect(calls.complete).toBe(0);
    expect(calls.fail).toBe(0);
    expect(runtime.container.querySelector(".dsh-opening-cst")).toBeNull();
  });

  it("does not complete after a failed media load", () => {
    vi.useFakeTimers();
    const { runtime, calls } = makeRuntime({ durationMs: 4000 });
    const engine = new Constructivism1Engine(runtime);
    engine.start();
    mediaOf(engine).dispatchEvent(new Event("error"));
    expect(calls.fail).toBe(1);
    vi.advanceTimersByTime(10000);
    expect(calls.complete).toBe(0);
    engine.destroy();
  });
});

describe("constructivism1 caption fit", () => {
  /** Instance-level layout stubs: jsdom defines offsetWidth on
   * HTMLElement.prototype and clientWidth on Element.prototype, so the stubs
   * are own properties on the measured elements (an own property shadows the
   * whole prototype chain) plus a global getComputedStyle. `blockOffset` is
   * read through the getter on every access. Returns the restore function. */
  function stubMeasure(
    container: HTMLElement,
    blockOffset: () => number,
    colClient: number,
    cs: { fontSize: string; paddingLeft: string; paddingRight: string },
  ): () => void {
    const col = container.querySelector<HTMLElement>(".dsh-opening-cst-col")!;
    const blocks = [...container.querySelectorAll<HTMLElement>(".dsh-opening-cst-block")];
    Object.defineProperty(col, "clientWidth", { configurable: true, get: () => colClient });
    for (const block of blocks) {
      Object.defineProperty(block, "offsetWidth", { configurable: true, get: blockOffset });
    }
    vi.stubGlobal("getComputedStyle", () => cs as unknown as CSSStyleDeclaration);
    return () => {
      vi.unstubAllGlobals();
    };
  }

  const FAKE_CS = { fontSize: "119px", paddingLeft: "20px", paddingRight: "20px" };

  it("leaves font-size untouched when there is no layout (detached container)", () => {
    const { runtime } = makeRuntime();
    const engine = new Constructivism1Engine(runtime);
    engine.start();
    for (const block of runtime.container.querySelectorAll<HTMLElement>(".dsh-opening-cst-block")) {
      expect(block.style.fontSize).toBe("");
    }
    engine.destroy();
  });

  it("shrinks an overflowing block so its text lands inside the column", () => {
    const { runtime } = makeRuntime();
    const engine = new Constructivism1Engine(runtime); // DOM exists now
    const restore = stubMeasure(runtime.container, () => 800, 537, FAKE_CS);
    try {
      engine.start();
      const blocks = [...runtime.container.querySelectorAll<HTMLElement>(".dsh-opening-cst-block")];
      // scale = (537 - 40) / (800 - 40) = 497/760; 119px * 497/760 = 77.8197…
      expect(blocks[0]!.style.fontSize).toBe("77.82px");
      expect(blocks[1]!.style.fontSize).toBe("77.82px");
      engine.destroy();
    } finally {
      restore();
    }
  });

  it("re-baselines on a later refit once the text fits again", () => {
    const { runtime } = makeRuntime();
    const engine = new Constructivism1Engine(runtime);
    let blockOffset = 800;
    const restore = stubMeasure(runtime.container, () => blockOffset, 537, FAKE_CS);
    try {
      engine.start();
      const block = runtime.container.querySelector<HTMLElement>(".dsh-opening-cst-block")!;
      expect(block.style.fontSize).not.toBe("");
      blockOffset = 500; // narrower face (or smaller viewport) — fits now
      window.dispatchEvent(new Event("resize"));
      expect(block.style.fontSize).toBe(""); // inline override cleared
      engine.destroy();
    } finally {
      restore();
    }
  });

  it("stops refitting after destroy", () => {
    const { runtime } = makeRuntime();
    const engine = new Constructivism1Engine(runtime);
    const restore = stubMeasure(runtime.container, () => 800, 537, FAKE_CS);
    try {
      engine.start();
      engine.destroy();
      const block = runtime.container.querySelector<HTMLElement>(".dsh-opening-cst-block");
      expect(block).toBeNull(); // the root is gone; a late fonts.ready must not throw
      expect(() => window.dispatchEvent(new Event("resize"))).not.toThrow();
    } finally {
      restore();
    }
  });
});

describe("constructivism1 video variant (jsdom)", () => {
  it("starts the video muted, inline and looping, with once disabling the loop", () => {
    const { runtime } = makeRuntime({}, "video");
    const engine = new Constructivism1Engine(runtime);
    engine.start();
    const video = runtime.container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video?.src).toBe(VIDEO_URL);
    expect(video?.muted).toBe(true);
    expect(video?.playsInline).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.autoplay).toBe(true);
    engine.destroy();

    const once = makeRuntime({ loop: "once" }, "video");
    const engine2 = new Constructivism1Engine(once.runtime);
    engine2.start();
    expect(once.runtime.container.querySelector("video")?.loop).toBe(false);
    engine2.destroy();
  });

  it("never completes on video ended — the backdrop stops, durationMs owns the hand-over", () => {
    vi.useFakeTimers();
    const { runtime, calls } = makeRuntime({ loop: "once", durationMs: 6000 }, "video");
    const engine = new Constructivism1Engine(runtime);
    engine.start();
    runtime.container.querySelector("video")!.dispatchEvent(new Event("ended"));
    expect(calls.complete).toBe(0);
    vi.advanceTimersByTime(6000);
    expect(calls.complete).toBe(1); // still the timer's hand-over
    engine.destroy();
  });

  it("pauses the video backdrop on skip so the final frame is a freeze", async () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockReturnValue(undefined);
    const { runtime, calls } = makeRuntime({ durationMs: 6000 }, "video");
    const engine = new Constructivism1Engine(runtime);
    engine.start();
    expect(pause).not.toHaveBeenCalled();
    engine.skip();
    expect(calls.complete).toBe(1);
    expect(pause).toHaveBeenCalledTimes(1); // the backdrop is frozen, not playing on
    engine.skip();
    expect(pause).toHaveBeenCalledTimes(1); // idempotent — no second pause after completion
    engine.destroy();
  });

  it("fails the run on a video error and never completes afterwards", () => {
    vi.useFakeTimers();
    const { runtime, calls } = makeRuntime({ durationMs: 4000 }, "video");
    const engine = new Constructivism1Engine(runtime);
    engine.start();
    runtime.container.querySelector("video")!.dispatchEvent(new Event("error"));
    expect(calls.fail).toBe(1);
    vi.advanceTimersByTime(10000);
    expect(calls.complete).toBe(0);
    engine.destroy();
  });

  it("reports readiness on canplay", () => {
    const { runtime, calls } = makeRuntime({}, "video");
    const engine = new Constructivism1Engine(runtime);
    engine.start();
    mediaOf(engine).dispatchEvent(new Event("canplay"));
    expect(calls.markLoaded).toBe(1);
    engine.destroy();
  });

  it("probes an unmute with the configured volume on the first playing event", () => {
    const { runtime } = makeRuntime({ volume: 50 }, "video");
    const engine = new Constructivism1Engine(runtime);
    const video = runtime.container.querySelector("video")!;
    Object.defineProperty(video, "paused", { value: false, configurable: true });
    engine.start();
    expect(video.muted).toBe(true); // still muted before the first playing event
    video.dispatchEvent(new Event("playing"));
    expect(video.muted).toBe(false);
    expect(video.volume).toBeCloseTo(0.5, 6);
    video.dispatchEvent(new Event("playing")); // a repeated event must not flip again
    expect(video.muted).toBe(false);
    engine.destroy();
  });

  it("falls back to silent playback when the unmute is paused by the autoplay policy", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play");
    const { runtime, calls } = makeRuntime({ volume: 50 }, "video");
    const engine = new Constructivism1Engine(runtime);
    const video = runtime.container.querySelector("video")!;
    engine.start();
    await vi.waitFor(() => {
      expect(play).toHaveBeenCalledTimes(1);
    });
    // jsdom videos report paused=true by default: unmuting "pauses" the video
    // synchronously, so the engine must fall back to muted playback itself.
    video.dispatchEvent(new Event("playing"));
    expect(video.muted).toBe(true);
    await vi.waitFor(() => {
      expect(play).toHaveBeenCalledTimes(2); // silent playback resumed
    });
    expect(calls.fail).toBe(0); // a silent backdrop must not fail the opening
    engine.destroy();
  });
});
