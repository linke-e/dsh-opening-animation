import { afterEach, describe, expect, it, vi } from "vitest";
import { GridMouseEngine, gridMouseAnimation } from "../src/client/animations/grid-mouse";
import { resolveAnimation, resolveAnimationParams } from "../src/client/registry";
import type { AnimationRuntime, ResolvedMedia } from "../src/client/registry";

const MEDIA: ResolvedMedia = {
  url: "data:image/png;base64,AAAA",
  kind: "image",
  mime: "image/png",
  name: "t.png",
};

function makeRuntime(params: Readonly<Record<string, unknown>> = {}) {
  const calls = { complete: 0, fail: 0, markLoaded: 0 };
  const container = document.createElement("div");
  document.body.append(container);
  return {
    calls,
    container,
    runtime: {
      container,
      media: MEDIA,
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
    } satisfies AnimationRuntime,
  };
}

function fireImageLoad(engine: GridMouseEngine): void {
  const img = Reflect.get(engine, "img") as HTMLImageElement;
  Object.defineProperty(img, "complete", { value: true, configurable: true });
  Object.defineProperty(img, "naturalWidth", { value: 4, configurable: true });
  Object.defineProperty(img, "naturalHeight", { value: 4, configurable: true });
  img.dispatchEvent(new Event("load"));
}

describe("grid-mouse registry entry", () => {
  it("resolves by id and kind and merges its parameter defaults", () => {
    expect(resolveAnimation("image", "grid-mouse")?.id).toBe("grid-mouse");
    expect(resolveAnimation("video", "grid-mouse")).toBeUndefined();
    const params = resolveAnimationParams(gridMouseAnimation, {});
    expect(params.cellSize).toBe(85);
    expect(params.durationMs).toBe(8000);
  });
});

describe("grid-mouse engine lifecycle", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("mounts one canvas on the stage and removes it on destroy", () => {
    const { runtime, calls, container } = makeRuntime();
    const engine = new GridMouseEngine(runtime);
    engine.start();
    expect(container.querySelectorAll("canvas").length).toBe(1);
    expect(calls.complete).toBe(0);
    engine.destroy();
    expect(container.querySelectorAll("canvas").length).toBe(0);
  });

  it("fails the run when the image errors", () => {
    const { runtime, calls } = makeRuntime();
    const engine = new GridMouseEngine(runtime);
    engine.start();
    const img = Reflect.get(engine, "img") as HTMLImageElement;
    img.dispatchEvent(new Event("error"));
    expect(calls.fail).toBe(1);
    expect(calls.complete).toBe(0);
    engine.destroy();
  });

  it("skip completes once even before the picture is ready", () => {
    const { runtime, calls } = makeRuntime();
    const engine = new GridMouseEngine(runtime);
    engine.start();
    engine.skip();
    expect(calls.complete).toBe(1);
    engine.skip(); // idempotent
    expect(calls.complete).toBe(1);
    engine.destroy();
  });

  it("reports readiness and hands over at once without a 2d context", () => {
    const { runtime, calls } = makeRuntime({ durationMs: 4000 });
    const engine = new GridMouseEngine(runtime);
    engine.start();
    fireImageLoad(engine);
    expect(calls.markLoaded).toBe(1);
    // jsdom has no 2d context: the engine completes instead of stalling.
    expect(calls.complete).toBe(1);
    engine.destroy();
  });

  it("completes from the first rendered frame after durationMs, idempotently", () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      setTransform: () => {},
      clearRect: () => {},
      drawImage: () => {},
    } as unknown as CanvasRenderingContext2D);
    const { runtime, calls } = makeRuntime({ durationMs: 4000 });
    const engine = new GridMouseEngine(runtime);
    engine.start();
    fireImageLoad(engine);
    // The playback length runs from the first rendered frame, not from start().
    expect(calls.complete).toBe(0);
    vi.advanceTimersByTime(3900);
    expect(calls.complete).toBe(0);
    vi.advanceTimersByTime(300);
    expect(calls.complete).toBe(1);
    engine.skip(); // idempotent
    expect(calls.complete).toBe(1);
    engine.destroy();
  });

  it("takes over from the tour on pointermove and stays quiet after destroy", () => {
    const { runtime, calls, container } = makeRuntime();
    const engine = new GridMouseEngine(runtime);
    engine.start();
    fireImageLoad(engine);
    container.dispatchEvent(new MouseEvent("pointermove", { clientX: 12, clientY: 34 }));
    expect(calls.complete).toBe(1);
    engine.destroy();
    container.dispatchEvent(new MouseEvent("pointermove", { clientX: 0, clientY: 0 }));
    expect(calls.complete).toBe(1);
  });

  it("shows only the untouched picture once the strength decays, and redraws cells near the pointer", () => {
    const draws: number[][] = [];
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      setTransform: () => {},
      clearRect: () => {},
      drawImage: (...args: unknown[]) => {
        draws.push(args as number[]);
      },
    } as unknown as CanvasRenderingContext2D);
    const { runtime } = makeRuntime();
    const engine = new GridMouseEngine(runtime);
    engine.start();
    fireImageLoad(engine); // first frame: clean picture + the rAF loop starts
    engine.skip(); // stop the loop; drawFrame is driven manually below
    draws.length = 0;

    // Strength fully decayed (pointer at rest): the base picture only — no
    // cell is redrawn, exactly the reference's behavior with m.s → 0.
    Reflect.set(engine, "strength", 0);
    const drawFrame = Reflect.get(engine, "drawFrame") as () => void;
    drawFrame.call(engine);
    expect(draws.length).toBe(1);
    expect(draws[0]!.length).toBe(5); // drawImage(img, ox, oy, w, h): the base pass

    // A strong pointer presence: the base picture first, then many 9-argument
    // cell redraws around the eased pointer — the rest of the cells stay as
    // the base picture.
    Reflect.set(engine, "strength", 2);
    Reflect.set(engine, "smooth", { x: 512, y: 384 });
    drawFrame.call(engine);
    expect(draws[0]!.length).toBe(5);
    expect(draws.filter((entry) => entry.length === 9).length).toBeGreaterThan(2);
    engine.destroy();
  });
});
