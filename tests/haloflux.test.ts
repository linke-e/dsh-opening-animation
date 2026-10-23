import { afterEach, describe, expect, it, vi } from "vitest";
import { HalofluxEngine, halofluxAnimation, halofluxVideoAnimation } from "../src/client/animations/haloflux";
import { resolveAnimation, resolveAnimationParams } from "../src/client/registry";
import type { AnimationRuntime, OpeningAnimation, ResolvedMedia } from "../src/client/registry";

function imageItem(url: string): ResolvedMedia {
  return { url, kind: "image", mime: "image/png", name: url };
}
function videoItem(url: string): ResolvedMedia {
  return { url, kind: "video", mime: "video/mp4", name: url };
}
const IMAGE_MEDIA = imageItem("data:image/png;base64,AAAA");
const VIDEO_MEDIA = videoItem("blob:mock-video");

function makeRuntime(media: ResolvedMedia, params: Readonly<Record<string, unknown>> = {}, library?: ResolvedMedia[]) {
  const calls = { complete: 0, fail: 0, markLoaded: 0 };
  const container = document.createElement("div");
  document.body.append(container);
  return {
    calls,
    container,
    runtime: {
      container,
      media,
      ...(library ? { library } : {}),
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

const gradient = { addColorStop: () => {} };
const ctxStub = {
  setTransform: () => {},
  clearRect: () => {},
  drawImage: () => {},
  fillRect: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  stroke: () => {},
  arc: () => {},
  fill: () => {},
  save: () => {},
  restore: () => {},
  translate: () => {},
  rotate: () => {},
  scale: () => {},
  clip: () => {},
  quadraticCurveTo: () => {},
  fillText: () => {},
  createRadialGradient: () => gradient,
} as unknown as CanvasRenderingContext2D;

function mock2d(): void {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctxStub);
  globalThis.Path2D = class {
    moveTo(): void {}
    lineTo(): void {}
  } as unknown as typeof Path2D;
}

function wallCanvases(engine: HalofluxEngine): NodeListOf<HTMLCanvasElement> {
  const root = Reflect.get(engine, "root") as HTMLElement;
  return root.querySelectorAll(".hx-mcv");
}

function wallShown(engine: HalofluxEngine): boolean {
  return [...wallCanvases(engine)].every((cv) => cv.classList.contains("hx-mcv-show"));
}

function slotSourceKinds(engine: HalofluxEngine): string[] {
  return (Reflect.get(engine, "slotSource") as WallSourceLike[]).map((s) => s.kind);
}
function slotSourceUrls(engine: HalofluxEngine): string[] {
  return (Reflect.get(engine, "slotSource") as WallSourceLike[]).map((s) => s.url);
}
interface WallSourceLike {
  kind: string;
  ready: boolean;
  ended?: boolean;
  primary?: boolean;
  url: string;
  img?: HTMLImageElement;
  video?: HTMLVideoElement;
}

function sourcesOf(engine: HalofluxEngine): WallSourceLike[] {
  return Reflect.get(engine, "sources") as WallSourceLike[];
}

function sourceForUrl(engine: HalofluxEngine, url: string): WallSourceLike {
  return sourcesOf(engine).find((s) => s.url === url)!;
}

/** Advance through the glitch phase (already at the hook): the wall must have
 * cut in. GLITCH_MS = 900 plus a small buffer. */
async function runToWallCut(engine: HalofluxEngine): Promise<void> {
  vi.advanceTimersByTime(950);
  await Promise.resolve();
  expect(wallShown(engine)).toBe(true);
}

describe("haloflux registry entries", () => {
  it("resolves the image variant by id and kind only", () => {
    expect(resolveAnimation("image", "haloflux")?.id).toBe("haloflux");
    expect(resolveAnimation("video", "haloflux")).toBeUndefined();
  });

  it("resolves the video variant by id and kind only", () => {
    expect(resolveAnimation("video", "haloflux-video")?.id).toBe("haloflux-video");
    expect(resolveAnimation("image", "haloflux-video")).toBeUndefined();
  });

  it("merges defaults: hookMs 5000, wallMedia off, run 5000, video volume 100", () => {
    expect(resolveAnimationParams(halofluxAnimation, {})).toEqual({ hookMs: 5000, wallMedia: "off", durationMs: 5000 });
    expect(resolveAnimationParams(halofluxVideoAnimation, {})).toEqual({ hookMs: 5000, wallMedia: "off", durationMs: 5000, volume: 100 });
  });

  it("clamps hookMs/durationMs overrides and rejects unknown wallMedia values", () => {
    expect(resolveAnimationParams(halofluxAnimation, { hookMs: 50 })).toEqual({ hookMs: 2000, wallMedia: "off", durationMs: 5000 });
    expect(resolveAnimationParams(halofluxAnimation, { hookMs: 99_999 })).toEqual({ hookMs: 15_000, wallMedia: "off", durationMs: 5000 });
    expect(resolveAnimationParams(halofluxAnimation, { hookMs: 7500, wallMedia: "bogus" })).toEqual({ hookMs: 7500, wallMedia: "off", durationMs: 5000 });
    expect(resolveAnimationParams(halofluxAnimation, { wallMedia: "single" })).toEqual({ hookMs: 5000, wallMedia: "single", durationMs: 5000 });
    // the run length stops at the watchdog's 120 s bottom line
    expect(resolveAnimationParams(halofluxAnimation, { durationMs: 999_999 }).durationMs).toBe(120_000);
    expect(resolveAnimationParams(halofluxAnimation, { durationMs: 60_000 }).durationMs).toBe(60_000);
  });

  it("respects the watchdog bottom line: no selfTimed escape hatch", () => {
    expect("selfTimed" in halofluxAnimation).toBe(false);
    expect("selfTimed" in halofluxVideoAnimation).toBe(false);
  });
});

describe("haloflux engine lifecycle", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.useRealTimers();
    delete (globalThis as { Path2D?: unknown }).Path2D;
  });

  it("mounts the page structure: style, header KPIs, eight panels, eight hidden wall slots", () => {
    const { runtime, container } = makeRuntime(IMAGE_MEDIA);
    const engine = new HalofluxEngine(runtime);
    engine.start();
    const root = container.querySelector(".dsh-opening-hx") as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.querySelectorAll(".hx-p").length).toBe(8);
    expect(root.querySelectorAll(".hx-kpi").length).toBe(5);
    expect(root.querySelector("style")?.textContent).toContain(".dsh-opening-hx");
    const slots = wallCanvases(engine);
    expect(slots.length).toBe(8);
    expect([...slots].every((cv) => !cv.classList.contains("hx-mcv-show"))).toBe(true);
    engine.destroy();
    expect(container.querySelector(".dsh-opening-hx")).toBeNull();
  });

  it("fails open and completes at once without a 2d context (jsdom)", () => {
    const { runtime, calls } = makeRuntime(IMAGE_MEDIA);
    const engine = new HalofluxEngine(runtime);
    engine.start();
    expect(calls.markLoaded).toBe(1);
    expect(calls.complete).toBe(1);
    engine.destroy();
  });

  it("off mode (default): durationMs is the whole run — no sources, no wall, no transition", () => {
    vi.useFakeTimers();
    mock2d();
    // hookMs is meaningless in off mode: only durationMs ends the run
    const { runtime, calls } = makeRuntime(IMAGE_MEDIA, { hookMs: 2000, durationMs: 8000 });
    const engine = new HalofluxEngine(runtime);
    engine.start();
    // no user media: nothing preloads (jsdom <img> with no src never loads)
    expect(sourcesOf(engine)).toEqual([]);
    expect(wallShown(engine)).toBe(false);
    expect(calls.complete).toBe(0);

    vi.advanceTimersByTime(7999);
    expect(calls.complete).toBe(0);
    vi.advanceTimersByTime(50);
    expect(calls.complete).toBe(1); // the run ends at durationMs
    expect(wallShown(engine)).toBe(false); // panels were never replaced
    engine.destroy();
  });

  it("off mode clamps the run length to the watchdog's 120 s bottom line", () => {
    vi.useFakeTimers();
    mock2d();
    const { runtime } = makeRuntime(IMAGE_MEDIA, { durationMs: 999_999 });
    const engine = new HalofluxEngine(runtime);
    engine.start();
    // driving 120 s of page timers in a test would run thousands of panel
    // ticks; the clamp (registry) and the end-at-durationMs semantics (above)
    // are both covered, so assert the engine took the clamped value
    expect(Reflect.get(engine, "runMs")).toBe(120_000);
    engine.destroy();
  });

  it("off mode streams the default BGM via a Blob URL and fades it out on completion", async () => {
    vi.useFakeTimers();
    mock2d();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined as never);
    const { runtime, calls } = makeRuntime(IMAGE_MEDIA);
    const engine = new HalofluxEngine(runtime);
    engine.start();
    const bgm = Reflect.get(engine, "bgm") as HTMLAudioElement;
    expect(bgm).not.toBeNull();
    expect(bgm.volume).toBeCloseTo(0.55, 5);
    // streaming assembly: base64 → Blob → object URL (async)
    await vi.waitFor(() => expect(bgm.src.startsWith("blob:")).toBe(true));
    expect(calls.complete).toBe(0);

    vi.advanceTimersByTime(5000); // durationMs = the whole run
    expect(calls.complete).toBe(1);
    // the fade runs after completion: volume ramps to 0, then paused + revoked
    vi.advanceTimersByTime(200);
    expect(bgm.volume).toBeLessThan(0.55);
    vi.advanceTimersByTime(300);
    expect(bgm.volume).toBe(0);
    expect(Reflect.get(engine, "bgmUrl")).toBeNull();
    engine.destroy();
  });

  it("off mode: destroy stops the BGM at once; all mode never starts one", () => {
    vi.useFakeTimers();
    mock2d();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined as never);

    const off = makeRuntime(IMAGE_MEDIA);
    const offEngine = new HalofluxEngine(off.runtime);
    offEngine.start();
    expect(Reflect.get(offEngine, "bgm")).not.toBeNull();
    offEngine.destroy();
    expect(Reflect.get(offEngine, "bgm")).toBeNull();

    const all = makeRuntime(IMAGE_MEDIA, { wallMedia: "all" });
    const allEngine = new HalofluxEngine(all.runtime);
    allEngine.start();
    expect(Reflect.get(allEngine, "bgm")).toBeNull(); // wall mode: no BGM
    allEngine.destroy();
  });

  it("all mode: fills the eight slots from the library in order and wraps around", () => {
    const library = [imageItem("a"), videoItem("b"), imageItem("c")];
    const { runtime } = makeRuntime(IMAGE_MEDIA, { wallMedia: "all" }, library);
    const engine = new HalofluxEngine(runtime);
    engine.start();
    expect(slotSourceKinds(engine)).toEqual(["image", "video", "image", "image", "video", "image", "image", "video"]);
    expect(sourcesOf(engine).length).toBe(3);
    engine.destroy();
  });

  it("single mode: every slot shows the currently selected item", () => {
    const library = [imageItem("a"), imageItem("b")];
    const { runtime } = makeRuntime(IMAGE_MEDIA, { wallMedia: "single" }, library);
    const engine = new HalofluxEngine(runtime);
    engine.start();
    expect(slotSourceUrls(engine)).toEqual(Array(8).fill(IMAGE_MEDIA.url));
    expect(sourcesOf(engine).length).toBe(1); // one decode for the whole wall
    engine.destroy();
  });

  it("falls back to the selected media when no library is provided (all mode)", () => {
    const { runtime } = makeRuntime(IMAGE_MEDIA, { wallMedia: "all" });
    const engine = new HalofluxEngine(runtime);
    engine.start();
    expect(sourcesOf(engine).length).toBe(1);
    expect(slotSourceKinds(engine)).toEqual(Array(8).fill("image"));
    engine.destroy();
  });

  it("decodes one video per unique URL and marks the first as the program source", () => {
    const library = [videoItem("v1"), imageItem("i1"), videoItem("v1"), videoItem("v2")];
    const { runtime } = makeRuntime(VIDEO_MEDIA, { wallMedia: "all" }, library);
    const engine = new HalofluxEngine(runtime);
    engine.start();
    const sources = sourcesOf(engine);
    expect(sources.length).toBe(3); // v1 deduped
    expect(sources.filter((s) => s.primary).map((s) => s.url)).toEqual(["v1"]);
    engine.destroy();
  });

  it("warns when more than four unique video sources decode at once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const library = ["v1", "v2", "v3", "v4", "v5"].map(videoItem);
    const { runtime } = makeRuntime(VIDEO_MEDIA, { wallMedia: "all", volume: 0 }, library);
    const engine = new HalofluxEngine(runtime);
    engine.start();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain("5 unique video sources");
    engine.destroy();
  });

  it("does not warn at the guard threshold", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const library = ["v1", "v2", "v3", "v4"].map(videoItem);
    const { runtime } = makeRuntime(VIDEO_MEDIA, { wallMedia: "all", volume: 0 }, library);
    const engine = new HalofluxEngine(runtime);
    engine.start();
    expect(warn).not.toHaveBeenCalled();
    engine.destroy();
  });

  it("all mode: hook → content glitch → slot layers → items draw → hold → complete", async () => {
    vi.useFakeTimers();
    mock2d();
    const { runtime, calls } = makeRuntime(IMAGE_MEDIA, { wallMedia: "all", hookMs: 5000 });
    const engine = new HalofluxEngine(runtime);
    engine.start();
    expect(calls.markLoaded).toBe(1);
    expect(calls.complete).toBe(0);

    vi.advanceTimersByTime(5050); // hook fires; the panels' own content tears
    expect(Reflect.get(engine, "phase")).toBe("glitch");
    expect(Reflect.get(engine, "glitchStage")).toBe("content");
    // the green slots stay hidden in the first half — the instruments glitch,
    // they do not blink to green (the实测 bug this regression locks in)
    expect(wallShown(engine)).toBe(false);
    expect(calls.complete).toBe(0);

    vi.advanceTimersByTime(500); // second half: the slots cut in with layers
    expect(Reflect.get(engine, "glitchStage")).toBe("wall");
    expect(wallShown(engine)).toBe(true);
    expect((Reflect.get(engine, "glitchLayers") as unknown[]).length).toBe(8);

    await runToWallCut(engine);
    expect(calls.complete).toBe(0); // holding the wall

    vi.advanceTimersByTime(2700); // IMAGE_HOLD_MS elapsed
    expect(calls.complete).toBe(1);
    engine.destroy();
  });

  it("all mode (video): the wall plays both sources; every ended completes", async () => {
    vi.useFakeTimers();
    mock2d();
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined as never);
    const library = [videoItem("v1"), videoItem("v2")];
    const { runtime, calls } = makeRuntime(VIDEO_MEDIA, { wallMedia: "all", hookMs: 5000 }, library);
    const engine = new HalofluxEngine(runtime);
    engine.start();
    expect(play).not.toHaveBeenCalled(); // muted preload only during phase A

    vi.advanceTimersByTime(5000 + 50); // hook fires; the slots run their layers
    await runToWallCut(engine);
    expect(play).toHaveBeenCalledTimes(2);
    expect(calls.complete).toBe(0);

    sourceForUrl(engine, "v1").video!.dispatchEvent(new Event("ended"));
    expect(calls.complete).toBe(0); // waiting for the second source
    sourceForUrl(engine, "v2").video!.dispatchEvent(new Event("ended"));
    expect(calls.complete).toBe(1);
    engine.destroy();
  });

  it("all mode (video): a policy pause on the program source falls back to a muted pill", async () => {
    vi.useFakeTimers();
    mock2d();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined as never);
    const library = [imageItem("i1"), videoItem("v1"), videoItem("v2")];
    const { runtime, container } = makeRuntime(VIDEO_MEDIA, { wallMedia: "all", hookMs: 2000, volume: 80 }, library);
    const engine = new HalofluxEngine(runtime);
    engine.start();
    vi.advanceTimersByTime(2000 + 50); // hook fires
    await runToWallCut(engine);

    const program = sourceForUrl(engine, "v1").video!;
    Object.defineProperty(program, "paused", { value: true, configurable: true });
    program.dispatchEvent(new Event("playing"));
    expect(program.muted).toBe(true);
    const pill = container.querySelector<HTMLButtonElement>(".dsh-opening-unmute-hint");
    expect(pill?.textContent).toBe("video.unmuteHint");
    pill!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(program.muted).toBe(false);
    expect(container.querySelector(".dsh-opening-unmute-hint")).toBeNull();
    engine.destroy();
  });

  it("skip freezes on the wall (all mode), idempotently", () => {
    vi.useFakeTimers();
    mock2d();
    const { runtime, calls } = makeRuntime(IMAGE_MEDIA, { wallMedia: "all", hookMs: 5000 });
    const engine = new HalofluxEngine(runtime);
    engine.start();
    engine.skip();
    expect(calls.complete).toBe(1);
    expect(wallShown(engine)).toBe(true);
    engine.skip();
    expect(calls.complete).toBe(1);
    engine.destroy();
  });

  it("skip in off mode leaves the panels untouched", () => {
    vi.useFakeTimers();
    mock2d();
    const { runtime, calls } = makeRuntime(IMAGE_MEDIA, { hookMs: 5000 });
    const engine = new HalofluxEngine(runtime);
    engine.start();
    engine.skip();
    expect(calls.complete).toBe(1);
    expect(wallShown(engine)).toBe(false);
    engine.destroy();
  });

  it("destroy cancels every phase timer: no completion afterwards", async () => {
    vi.useFakeTimers();
    mock2d();
    const { runtime, calls } = makeRuntime(IMAGE_MEDIA, { wallMedia: "all", hookMs: 5000 });
    const engine = new HalofluxEngine(runtime);
    engine.start();
    engine.destroy();
    vi.advanceTimersByTime(30_000);
    await Promise.resolve();
    expect(calls.complete).toBe(0);
    expect(document.querySelector(".dsh-opening-hx")).toBeNull();
  });

  it("fails the run when a wall source errors", () => {
    vi.useFakeTimers();
    mock2d();
    const { runtime, calls } = makeRuntime(IMAGE_MEDIA, { wallMedia: "all" });
    const engine = new HalofluxEngine(runtime);
    engine.start();
    sourceForUrl(engine, IMAGE_MEDIA.url).img!.dispatchEvent(new Event("error"));
    expect(calls.fail).toBe(1);
    expect(calls.complete).toBe(0);
    engine.destroy();
  });
});

describe("haloflux registration wiring", () => {
  it("shares one label/description key pair across both variants", () => {
    expect(halofluxAnimation.labelKey).toBe(halofluxVideoAnimation.labelKey);
    expect(halofluxAnimation.descriptionKey).toBe(halofluxVideoAnimation.descriptionKey);
    expect(halofluxAnimation.kind).toBe("image");
    expect(halofluxVideoAnimation.kind).toBe("video");
  });

  it("creates engines of the declared class", () => {
    const { runtime } = makeRuntime(IMAGE_MEDIA);
    const created = halofluxAnimation.create(runtime);
    expect(created).toBeInstanceOf(HalofluxEngine);
    created.destroy();
  });
});
