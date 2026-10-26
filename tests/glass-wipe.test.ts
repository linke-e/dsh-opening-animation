import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isBlobLike, sampleBrushPath, setupGlassWipe } from "../src/client/glass-wipe";
import type { TransitionSetupContext, TransitionSetupResult } from "../src/client/transitions";
import type { ResolvedMedia } from "../src/client/registry";

// Node's macrotask pump (the DOM lib has no type for it); fake-indexeddb
// schedules its transaction steps through it.
declare const setImmediate: (callback: () => void) => unknown;

const MEDIA_URL = "data:image/png;base64,AAAA";
const SKIN_PREFS_KEY = "dsh-custom-skin.preferences.v1";
const SKIN_DB_NAME = "dsh-custom-skin";
const SKIN_STORE = "wallpapers";

/** jsdom never decodes images, so preload()'s Image never fires; this fake
 * records every instance for the test to settle by hand. */
class FakeImage {
  static instances: FakeImage[] = [];
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = "";
  constructor() {
    FakeImage.instances.push(this);
  }
}

function makeContext(overrides: Partial<TransitionSetupContext> = {}): TransitionSetupContext {
  const media: ResolvedMedia = { url: MEDIA_URL, kind: "image", mime: "image/png", name: "t.png" };
  return { root: document.createElement("div"), media, scale: 1, ...overrides };
}

async function flush(): Promise<void> {
  // fake-indexeddb schedules every transaction step through a (real,
  // unfaked) setImmediate: pump macrotasks so its chain runs while the fake
  // timers stay frozen.
  for (let round = 0; round < 8; round += 1) {
    await new Promise<void>((resolve) => setImmediate(() => resolve()));
  }
}

/** Creates the skin database and stores one wallpaper. Runs on real timers:
 * fake-indexeddb settles through queueMicrotask, which useFakeTimers fakes. */
async function seedSkinLibrary(activeId: string | null): Promise<void> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(SKIN_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(SKIN_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  if (activeId !== null) {
    const write = database.transaction(SKIN_STORE, "readwrite");
    write.objectStore(SKIN_STORE).put({
      id: activeId,
      name: "w.png",
      type: "image/png",
      // fake-indexeddb's clone flattens a Blob to an empty object; the
      // Blob-shaped plain object lands on isBlobLike's duck arm instead
      blob: { size: 1, type: "image/png" },
    });
    await new Promise<void>((resolve, reject) => {
      write.oncomplete = () => resolve();
      write.onabort = () => reject(write.error);
    });
  }
  database.close();
}

beforeEach(() => {
  FakeImage.instances = [];
  vi.stubGlobal("Image", FakeImage);
  // jsdom ships a native createObjectURL that rejects non-Blob stand-ins
  // (the wallpaper seeds survive the fake-indexeddb roundtrip as plain
  // objects), so the tests pin the blob:mock-* shape the project setup
  // installs for older jsdom.
  let mockUrl = 0;
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:mock-${++mockUrl}`);
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

describe("brush path", () => {
  it("starts on the first stroke's entry, folds through three strokes, ends at the last exit", () => {
    const first = sampleBrushPath(0);
    expect(first.x).toBeCloseTo(0.18);
    expect(first.y).toBeCloseTo(0.42);
    expect(first.scale).toBeLessThan(1); // enters thin

    const last = sampleBrushPath(1);
    expect(last.x).toBeCloseTo(0.9);
    expect(last.y).toBeCloseTo(0.72);

    // mid-stroke: later strokes sweep wider than earlier ones
    expect(sampleBrushPath(0.75).scale).toBeGreaterThan(sampleBrushPath(0.5).scale);
    expect(sampleBrushPath(0.5).scale).toBeGreaterThanOrEqual(sampleBrushPath(0.25).scale);

    // the path folds: mid-stroke samples stay inside the viewport bounds
    for (const step of [0.1, 0.25, 0.4, 0.55, 0.7, 0.85]) {
      const sample = sampleBrushPath(step);
      expect(sample.x).toBeGreaterThan(0);
      expect(sample.x).toBeLessThan(1);
      expect(sample.y).toBeGreaterThan(0);
      expect(sample.y).toBeLessThan(1);
      expect(sample.scale).toBeGreaterThan(0);
    }
  });
});

describe("glass-wipe stack (jsdom)", () => {
  it("builds the frosted stack with a canvas crisp layer and chains the phase classes", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const context = makeContext();
    const result: TransitionSetupResult = setupGlassWipe(context) as TransitionSetupResult;
    const stack = context.root.querySelector<HTMLElement>(".dsh-opening-gw")!;
    const pane = stack.querySelector<HTMLElement>(".dsh-opening-gw-pane")!;
    const clear = stack.querySelector<HTMLCanvasElement>(".dsh-opening-gw-clear")!;

    expect(result.exitMs).toBe(2750);
    expect(result.enterDelayMs).toBe(900);
    expect(result.enterMs).toBe(1850);
    // the pane is empty (backdrop-filter blurs the live opening underneath);
    // the crisp layer is a canvas starting on the opening's media
    expect(pane.style.backgroundImage).toBe("");
    expect(clear.tagName).toBe("CANVAS");
    expect(clear.dataset.gwSource).toBe("media");
    expect(stack.classList.contains("dsh-opening-gw-run")).toBe(true);

    vi.advanceTimersByTime(900);
    expect(stack.classList.contains("dsh-opening-gw-wipe")).toBe(true);
    expect(context.root.classList.contains("dsh-opening-gw-exit")).toBe(false);

    vi.advanceTimersByTime(1400);
    // settle cross-fades the WHOLE overlay root (stack plus the stage's
    // final frame) into the app — no orphan tail frame of its own
    expect(context.root.classList.contains("dsh-opening-gw-exit")).toBe(true);
    // settle clears the root's backdrop so the cross-fade lands on the app
    expect(context.root.style.background).toBe("transparent");

    expect(context.root.contains(stack)).toBe(true);
    result.dispose?.();
    expect(context.root.contains(stack)).toBe(false);
  });

  it("scales the phase durations for the CSS variables and returns unscaled bases", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const context = makeContext({ scale: 2 });
    const result = setupGlassWipe(context) as TransitionSetupResult;
    // the variables live on the root so the settle class inherits them too
    expect(context.root.style.getPropertyValue("--gw-blur-ms")).toBe("1800ms");
    expect(context.root.style.getPropertyValue("--gw-wipe-ms")).toBe("2800ms");
    expect(context.root.style.getPropertyValue("--gw-settle-ms")).toBe("900ms");
    expect(result.exitMs).toBe(2750); // base values; the overlay scales them

    vi.advanceTimersByTime(1800);
    expect(context.root.querySelector(".dsh-opening-gw")!.classList.contains("dsh-opening-gw-wipe")).toBe(true);
    result.dispose?.();
  });

  it("fills video media as a hidden muted autoplay video feeding the crisp canvas", () => {
    const context = makeContext({
      media: { url: "data:video/mp4;base64,AAAA", kind: "video", mime: "video/mp4", name: "t.mp4" },
    });
    const result = setupGlassWipe(context) as TransitionSetupResult;
    const stack = context.root.querySelector<HTMLElement>(".dsh-opening-gw")!;
    const pane = stack.querySelector<HTMLElement>(".dsh-opening-gw-pane")!;
    expect(pane.querySelector("video")).toBeNull(); // the frost blurs the live opening
    const video = stack.querySelector("video");
    expect(video).not.toBeNull();
    expect(video?.muted).toBe(true);
    expect(video?.autoplay).toBe(true);
    result.dispose?.();
  });

  it("seeds the crisp video to the opening video's playback position", async () => {
    const context = makeContext({
      media: { url: "data:video/mp4;base64,AAAA", kind: "video", mime: "video/mp4", name: "t.mp4" },
    });
    // the overlay's stage with the opening's own video, 7.3 s into playback
    const stage = document.createElement("div");
    stage.className = "dsh-opening-stage";
    const openingVideo = document.createElement("video");
    stage.append(openingVideo);
    context.root.prepend(stage);
    Object.defineProperty(openingVideo, "currentTime", { value: 7.3, configurable: true });

    const result = setupGlassWipe(context) as TransitionSetupResult;
    const video = context.root.querySelector<HTMLElement>(".dsh-opening-gw")!.querySelector("video")!;
    let seekedTo = -1;
    Object.defineProperty(video, "currentTime", {
      get: () => seekedTo,
      set: (value: number) => {
        seekedTo = value;
      },
      configurable: true,
    });
    video.dispatchEvent(new Event("loadedmetadata"));
    await flush();
    expect(seekedTo).toBe(7.3);
    result.dispose?.();
  });

  it("dispose clears pending phase timers", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const context = makeContext();
    const result = setupGlassWipe(context) as TransitionSetupResult;
    const stack = context.root.querySelector<HTMLElement>(".dsh-opening-gw")!;
    result.dispose?.();
    vi.advanceTimersByTime(5000);
    expect(stack.classList.contains("dsh-opening-gw-wipe")).toBe(false);
    expect(context.root.classList.contains("dsh-opening-gw-exit")).toBe(false);
  });
});

describe("isBlobLike", () => {
  it("accepts a true Blob, a Blob-shaped plain object, and nothing else", () => {
    expect(isBlobLike(new Blob(["x"], { type: "image/png" }))).toBe(true);
    expect(isBlobLike({ size: 1, type: "image/png" })).toBe(true);
    expect(isBlobLike({})).toBe(false);
    expect(isBlobLike({ size: "1", type: "image/png" })).toBe(false);
    expect(isBlobLike("image/png")).toBe(false);
    expect(isBlobLike(null)).toBe(false);
    expect(isBlobLike(undefined)).toBe(false);
  });
});

describe("glass-wipe wallpaper handoff", () => {
  it("switches the crisp source to the skin's active wallpaper once decoded", async () => {
    localStorage.setItem(SKIN_PREFS_KEY, JSON.stringify({ enabled: true, activeId: "wall-1", fit: "contain", position: "top" }));
    await seedSkinLibrary("wall-1");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const context = makeContext();
    const result = setupGlassWipe(context) as TransitionSetupResult;
    await flush(); // the lookup beats the 250 ms timeout on the microtask queue
    // one image exists already: the crisp layer's initial media source
    expect(FakeImage.instances.length).toBe(2);
    FakeImage.instances[1]!.onload?.(); // jsdom never decodes: settle by hand
    await flush();
    const clear = context.root.querySelector<HTMLCanvasElement>(".dsh-opening-gw-clear")!;
    // only the crisp source switches — the frost keeps blurring the opening
    expect(clear.dataset.gwSource).toBe("wallpaper");
    expect(FakeImage.instances.length).toBe(3); // media source + preload probe + wallpaper source
    expect(FakeImage.instances[2]!.src).toContain("blob:mock-");
    result.dispose?.();
  });

  it("keeps the opening's media when dsh-custom-skin is absent", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const context = makeContext();
    const result = setupGlassWipe(context) as TransitionSetupResult;
    vi.advanceTimersByTime(300);
    await flush();
    const clear = context.root.querySelector<HTMLCanvasElement>(".dsh-opening-gw-clear")!;
    expect(clear.dataset.gwSource).toBe("media");
    result.dispose?.();
  });

  it("keeps the opening's media when the skin is disabled", async () => {
    localStorage.setItem(SKIN_PREFS_KEY, JSON.stringify({ enabled: false, activeId: "wall-1" }));
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const context = makeContext();
    const result = setupGlassWipe(context) as TransitionSetupResult;
    vi.advanceTimersByTime(300);
    await flush();
    expect(context.root.querySelector<HTMLCanvasElement>(".dsh-opening-gw-clear")!.dataset.gwSource).toBe("media");
    result.dispose?.();
  });

  it("keeps the opening's media when the active id is not in the skin's library", async () => {
    localStorage.setItem(SKIN_PREFS_KEY, JSON.stringify({ enabled: true, activeId: "missing" }));
    await seedSkinLibrary(null);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const context = makeContext();
    const result = setupGlassWipe(context) as TransitionSetupResult;
    vi.advanceTimersByTime(300);
    await flush();
    expect(context.root.querySelector<HTMLCanvasElement>(".dsh-opening-gw-clear")!.dataset.gwSource).toBe("media");
    result.dispose?.();
  });

  it("keeps the opening's media when the wallpaper image fails to decode", async () => {
    localStorage.setItem(SKIN_PREFS_KEY, JSON.stringify({ enabled: true, activeId: "wall-1" }));
    await seedSkinLibrary("wall-1");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const context = makeContext();
    const result = setupGlassWipe(context) as TransitionSetupResult;
    await flush();
    // instances[0] is the crisp layer's initial media source; the preload
    // probe for the wallpaper is instances[1]
    FakeImage.instances[1]!.onerror?.();
    await flush();
    expect(context.root.querySelector<HTMLCanvasElement>(".dsh-opening-gw-clear")!.dataset.gwSource).toBe("media");
    result.dispose?.();
  });

  it("revokes the wallpaper URL on dispose and on a lookup landing after dispose", async () => {
    localStorage.setItem(SKIN_PREFS_KEY, JSON.stringify({ enabled: true, activeId: "wall-1" }));
    await seedSkinLibrary("wall-1");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    const context = makeContext();
    const result = setupGlassWipe(context) as TransitionSetupResult;
    await flush();
    expect(FakeImage.instances.length).toBe(2); // media source + preload probe
    result.dispose?.();
    expect(revoke).toHaveBeenCalledWith(expect.stringMatching(/^blob:mock-/));
    revoke.mockClear();

    // a late lookup (disposed before it lands) releases its object URL too
    const late = makeContext();
    const lateResult = setupGlassWipe(late) as TransitionSetupResult;
    lateResult.dispose?.();
    await flush();
    expect(revoke).toHaveBeenCalledWith(expect.stringMatching(/^blob:mock-/));
  });

  it("releases the URL of a lookup that lost the timeout race", async () => {
    localStorage.setItem(SKIN_PREFS_KEY, JSON.stringify({ enabled: true, activeId: "wall-1" }));
    await seedSkinLibrary("wall-1");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const context = makeContext();
    const result = setupGlassWipe(context) as TransitionSetupResult;
    // the timeout wins the race before any macrotask pump
    vi.advanceTimersByTime(250);
    await flush();
    // the loser keeps running and must clean up its own object URL
    await flush();
    expect(revoke).toHaveBeenCalledWith(expect.stringMatching(/^blob:mock-/));
    result.dispose?.();
  });
});
