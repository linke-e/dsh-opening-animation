import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatLockClock,
  formatLockDate,
  GlassEngine,
  glassAnimation,
} from "../src/client/animations/glass";
import { listAnimations, resolveAnimation, resolveAnimationParams } from "../src/client/registry";

const MEDIA_URL = "data:image/png;base64,AAAA";

function makeRuntime(params: Readonly<Record<string, unknown>> = {}, reducedMotion = false) {
  const calls = { complete: 0, fail: 0, markLoaded: 0 };
  return {
    calls,
    runtime: {
      container: document.createElement("div"),
      media: { url: MEDIA_URL, kind: "image" as const, mime: "image/png", name: "t.png" },
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

function fireUnderLoad(engine: GlassEngine): void {
  const img = Reflect.get(engine, "under") as HTMLImageElement;
  Object.defineProperty(img, "complete", { value: true, configurable: true });
  Object.defineProperty(img, "naturalWidth", { value: 4, configurable: true });
  img.dispatchEvent(new Event("load"));
}

/** Drain the whenDecoded microtask chain. */
const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

afterEach(() => {
  vi.useRealTimers();
});

describe("glass clock formatting", () => {
  it("renders a zero-padded 24-hour clock", () => {
    expect(formatLockClock(new Date(2026, 9, 11, 9, 5))).toBe("09:05");
    expect(formatLockClock(new Date(2026, 9, 11, 23, 59))).toBe("23:59");
  });

  it("renders the long local date in the requested locale", () => {
    expect(formatLockDate(new Date(2026, 9, 11), "en-US")).toBe("Sunday, October 11");
  });
});

describe("glass registry entry", () => {
  it("resolves by id and kind and appears in listings", () => {
    expect(resolveAnimation("image", "glass")?.id).toBe("glass");
    expect(resolveAnimation("video", "glass")).toBeUndefined();
    expect(listAnimations("image").map((animation) => animation.id)).toContain("glass");
  });

  it("defaults its params and passes string overrides through", () => {
    expect(resolveAnimationParams(glassAnimation)).toEqual({ hintText: "", lockBg: "" });
    expect(resolveAnimationParams(glassAnimation, { hintText: "解锁", lockBg: "https://x/y.png" })).toEqual({
      hintText: "解锁",
      lockBg: "https://x/y.png",
    });
  });
});

describe("glass layered lock screen (jsdom)", () => {
  it("reveals the user picture underneath and defaults the lock background to it", () => {
    const { runtime } = makeRuntime();
    const engine = new GlassEngine(runtime);
    engine.start();
    const under = runtime.container.querySelector<HTMLImageElement>(".dsh-opening-glass-under");
    const lockBg = runtime.container.querySelector<HTMLImageElement>(".dsh-opening-glass-bg");
    const screen = runtime.container.querySelector<HTMLElement>(".dsh-opening-glass-screen");
    expect(under?.src).toBe(MEDIA_URL);
    expect(lockBg?.src).toBe(MEDIA_URL); // lockBg empty → the active picture
    expect(screen?.querySelector(".dsh-opening-glass-veil")).not.toBeNull();
    expect(screen?.querySelector(".dsh-opening-glass-content")).not.toBeNull();
    engine.destroy();
  });

  it("blurs the configured lock screen background and keeps the user picture beneath", () => {
    const { runtime } = makeRuntime({ lockBg: "https://example.com/lock.png" });
    const engine = new GlassEngine(runtime);
    engine.start();
    const under = runtime.container.querySelector<HTMLImageElement>(".dsh-opening-glass-under");
    const lockBg = runtime.container.querySelector<HTMLImageElement>(".dsh-opening-glass-bg");
    expect(lockBg?.src).toBe("https://example.com/lock.png");
    expect(under?.src).toBe(MEDIA_URL);
    engine.destroy();
  });

  it("falls back to the user picture when the lockBg URL fails", () => {
    const { runtime, calls } = makeRuntime({ lockBg: "https://example.com/broken.png" });
    const engine = new GlassEngine(runtime);
    engine.start();
    const lockBg = runtime.container.querySelector<HTMLImageElement>(".dsh-opening-glass-bg")!;
    lockBg.dispatchEvent(new Event("error"));
    expect(lockBg.src).toBe(MEDIA_URL);
    expect(calls.fail).toBe(0);
    // the fallback must not loop
    lockBg.dispatchEvent(new Event("error"));
    expect(lockBg.src).toBe(MEDIA_URL);
    engine.destroy();
  });

  it("renders clock, date and the hint (custom text wins over the locale default)", () => {
    const { runtime } = makeRuntime({ hintText: "TOUCH" });
    const engine = new GlassEngine(runtime);
    engine.start();
    expect(runtime.container.querySelector<HTMLElement>(".dsh-opening-glass-clock")?.textContent).toBe(
      formatLockClock(new Date()),
    );
    expect(runtime.container.querySelector<HTMLElement>(".dsh-opening-glass-date")?.textContent).toBe(
      formatLockDate(new Date()),
    );
    expect(runtime.container.querySelector<HTMLElement>(".dsh-opening-glass-hint")?.textContent).toBe("TOUCH");
    engine.destroy();
  });

  it("uses the locale default text when the hint param is empty", () => {
    const { runtime } = makeRuntime();
    const engine = new GlassEngine(runtime);
    engine.start();
    expect(runtime.container.querySelector<HTMLElement>(".dsh-opening-glass-hint")?.textContent).toBe(
      "anim.glass.hintDefault",
    );
    engine.destroy();
  });

  it("slides the lock screen up on the first click without bubbling as a skip, then completes", () => {
    vi.useFakeTimers();
    const { runtime, calls } = makeRuntime();
    const skipSpy = vi.fn();
    runtime.container.addEventListener("click", skipSpy);
    const engine = new GlassEngine(runtime);
    engine.start();
    const root = runtime.container.querySelector<HTMLElement>(".dsh-opening-glass")!;
    const screen = runtime.container.querySelector<HTMLElement>(".dsh-opening-glass-screen")!;
    root.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(skipSpy).not.toHaveBeenCalled();
    expect(screen.classList.contains("dsh-opening-glass-unlocked")).toBe(true);
    expect(root.classList.contains("dsh-opening-glass-unlocked")).toBe(false);

    // transitionend on the transform completes; the backstop stays as a guard
    screen.dispatchEvent(new TransitionEvent("transitionend", { propertyName: "transform" }));
    expect(calls.complete).toBe(1);
    // a second click after completion does nothing
    root.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(calls.complete).toBe(1);
    // the backstop fires later but completion is idempotent
    vi.advanceTimersByTime(850);
    expect(calls.complete).toBe(1);
    engine.destroy();
  });

  it("ignores a transitionend that is not the slide (e.g. opacity)", () => {
    vi.useFakeTimers();
    const { runtime, calls } = makeRuntime();
    const engine = new GlassEngine(runtime);
    engine.start();
    const screen = runtime.container.querySelector<HTMLElement>(".dsh-opening-glass-screen")!;
    runtime.container.querySelector<HTMLElement>(".dsh-opening-glass")!.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    screen.dispatchEvent(new TransitionEvent("transitionend", { propertyName: "opacity" }));
    expect(calls.complete).toBe(0);
    vi.advanceTimersByTime(850);
    expect(calls.complete).toBe(1);
    engine.destroy();
  });

  it("completes at once under reduced motion and never registers the slide", async () => {
    const { runtime, calls } = makeRuntime({}, true);
    const engine = new GlassEngine(runtime);
    engine.start();
    fireUnderLoad(engine);
    await flush();
    expect(calls.complete).toBe(1);
    expect(runtime.container.querySelector(".dsh-opening-glass-reduced")).not.toBeNull();
    engine.destroy();
  });

  it("reports readiness on the under picture, fails on its error, and skip completes once", async () => {
    const { runtime, calls } = makeRuntime();
    const engine = new GlassEngine(runtime);
    engine.start();
    fireUnderLoad(engine);
    await flush();
    expect(calls.markLoaded).toBe(1);
    engine.skip();
    expect(calls.complete).toBe(1);
    engine.skip();
    expect(calls.complete).toBe(1);
    const under = Reflect.get(engine, "under") as HTMLImageElement;
    under.dispatchEvent(new Event("error"));
    expect(calls.fail).toBe(0); // already completed; the guard skips fail
    engine.destroy();
    under.dispatchEvent(new Event("error"));
    expect(calls.fail).toBe(0);
    engine.destroy();
  });
});
