import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Glitch404Engine,
  glitch404Animation,
  invertColor,
} from "../src/client/animations/glitch-404";
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

function fireImageLoad(engine: Glitch404Engine): void {
  const img = Reflect.get(engine, "img") as HTMLImageElement;
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

describe("glitch-404 registry entry", () => {
  it("resolves by id and kind and appears in listings", () => {
    expect(resolveAnimation("image", "glitch-404")?.id).toBe("glitch-404");
    expect(resolveAnimation("video", "glitch-404")).toBeUndefined();
    expect(listAnimations("image").map((animation) => animation.id)).toContain("glitch-404");
  });

  it("only carries durationMs/mask/textColor and clamps numeric overrides", () => {
    expect(resolveAnimationParams(glitch404Animation)).toEqual({ durationMs: 6000, mask: 0.5, textColor: "" });
    const clamped = resolveAnimationParams(glitch404Animation, { durationMs: 99_999, mask: 3, textColor: "#ff0" });
    expect(clamped.durationMs).toBe(60_000);
    expect(clamped.mask).toBe(1);
    expect(clamped.textColor).toBe("#ff0");
    expect(resolveAnimationParams(glitch404Animation, { mask: -1 }).mask).toBe(0);
  });
});

describe("invertColor", () => {
  it("inverts rgb() and #rrggbb colors and falls back to white", () => {
    expect(invertColor("rgb(4, 5, 14)")).toBe("rgb(251, 250, 241)");
    expect(invertColor("#04050e")).toBe("rgb(251, 250, 241)");
    expect(invertColor("#FFFFFF")).toBe("rgb(0, 0, 0)");
    expect(invertColor("not a color")).toBe("#ffffff");
  });
});

describe("glitch-404 readability params", () => {
  it("applies the mask strength and the pinned text color", async () => {
    const { runtime } = makeRuntime({ mask: 0.8, textColor: "#ffcc00" });
    const engine = new Glitch404Engine(runtime);
    engine.start();
    fireImageLoad(engine);
    await flush();
    const root = runtime.container.querySelector<HTMLElement>(".dsh-opening-g404")!;
    const mask = runtime.container.querySelector<HTMLElement>(".dsh-opening-g404-mask")!;
    expect(mask.style.opacity).toBe("0.8");
    expect(root.style.getPropertyValue("--dsh-g404-text")).toBe("#ffcc00");
    expect(runtime.container.querySelector(".dsh-opening-g404-outro")).toBeNull();
    engine.destroy();
  });

  it("derives the text color from the picture's dominant color inverse by default", async () => {
    const { runtime } = makeRuntime({ mask: 0 });
    const engine = new Glitch404Engine(runtime);
    engine.start();
    fireImageLoad(engine);
    await flush();
    const root = runtime.container.querySelector<HTMLElement>(".dsh-opening-g404")!;
    const mask = runtime.container.querySelector<HTMLElement>(".dsh-opening-g404-mask")!;
    // jsdom has no 2d context, so extraction falls back to #04050e
    expect(root.style.getPropertyValue("--dsh-g404-text")).toBe("rgb(251, 250, 241)");
    expect(mask.style.opacity).toBe("0");
    engine.destroy();
  });
});

describe("glitch-404 reference remake layout", () => {
  it("builds the code block and both fixed ghost pairs like the reference", async () => {
    const { runtime } = makeRuntime();
    const engine = new Glitch404Engine(runtime);
    engine.start();
    fireImageLoad(engine);
    await flush();
    const root = runtime.container.querySelector<HTMLElement>(".dsh-opening-g404")!;
    expect(root.classList.contains("dsh-opening-g404-run")).toBe(true);

    // the colored source-code block, verbatim content
    const code = root.querySelector<HTMLElement>(".dsh-opening-g404-code")!;
    expect(code.querySelector("pre > code")).not.toBeNull();
    expect(code.innerHTML).toContain("DOCTYPE html");
    expect(code.innerHTML).toContain("everything");
    expect(code.querySelector(".dsh-orange")).not.toBeNull();
    expect(code.querySelector(".dsh-comment")?.textContent).toContain("The file you are looking for");

    // main line: two ghosts with the reference text
    const mainGhosts = root.querySelectorAll<HTMLElement>(".dsh-opening-g404-main .dsh-opening-g404-ghost");
    expect(mainGhosts).toHaveLength(2);
    for (const ghost of mainGhosts) expect(ghost.textContent).toBe("error 404");

    // info line: two ghosts offset apart, inside the warped error container
    const subGhosts = root.querySelectorAll<HTMLElement>(".dsh-opening-g404-info .dsh-opening-g404-ghost");
    expect(subGhosts).toHaveLength(2);
    for (const ghost of subGhosts) expect(ghost.textContent).toBe("file not found");
    expect(subGhosts[0]?.classList.contains("dsh-opening-g404-ghost-a")).toBe(true);
    expect(subGhosts[1]?.classList.contains("dsh-opening-g404-ghost-b")).toBe(true);
    expect(root.querySelector(".dsh-opening-g404-beam")).toBeNull(); // no beam in the remake
    engine.destroy();
  });
});

describe("glitch-404 engine lifecycle (jsdom)", () => {
  it("constructs, starts and skips to the black final frame exactly once", () => {
    const { runtime, calls } = makeRuntime();
    const engine = new Glitch404Engine(runtime);
    expect(() => engine.start()).not.toThrow();
    expect(calls.complete).toBe(0);
    engine.skip();
    const fade = runtime.container.querySelector<HTMLElement>(".dsh-opening-g404-fade");
    expect(fade?.style.opacity).toBe("1");
    expect(calls.complete).toBe(1);
    engine.skip(); // idempotent
    expect(calls.complete).toBe(1);
    engine.destroy();
  });

  it("reports readiness on image load, fails on image error, and stops after destroy", async () => {
    const { runtime, calls } = makeRuntime();
    const engine = new Glitch404Engine(runtime);
    engine.start();
    fireImageLoad(engine);
    await flush();
    expect(calls.markLoaded).toBe(1);
    const img = Reflect.get(engine, "img") as HTMLImageElement;
    img.dispatchEvent(new Event("error"));
    expect(calls.fail).toBe(1);
    engine.destroy();
    img.dispatchEvent(new Event("error"));
    expect(calls.fail).toBe(1);
  });

  it("completes at once under reduced motion, on the black final frame", async () => {
    const { runtime, calls } = makeRuntime({}, true);
    const engine = new Glitch404Engine(runtime);
    engine.start();
    fireImageLoad(engine);
    await flush();
    expect(calls.complete).toBe(1);
    const fade = runtime.container.querySelector<HTMLElement>(".dsh-opening-g404-fade");
    expect(fade?.style.opacity).toBe("1");
    engine.skip();
    expect(calls.complete).toBe(1);
    engine.destroy();
  });

  it("strobes until durationMs, then sinks into black and completes", async () => {
    vi.useFakeTimers();
    const { runtime, calls } = makeRuntime({ durationMs: 4000 });
    const engine = new Glitch404Engine(runtime);
    engine.start();
    fireImageLoad(engine);
    await flush();
    const fade = runtime.container.querySelector<HTMLElement>(".dsh-opening-g404-fade")!;
    expect(runtime.container.querySelector(".dsh-opening-g404-outro")).toBeNull();
    expect(fade.style.opacity).toBe("");

    // the black-out starts at durationMs - FADE_MS = 3100 and completes 900+250 later
    vi.advanceTimersByTime(3000);
    expect(runtime.container.querySelector(".dsh-opening-g404-outro")).toBeNull();
    expect(calls.complete).toBe(0);
    vi.advanceTimersByTime(100);
    expect(runtime.container.querySelector(".dsh-opening-g404-outro")).not.toBeNull();
    expect(fade.style.opacity).toBe("1");
    expect(calls.complete).toBe(0);
    vi.advanceTimersByTime(1150);
    expect(calls.complete).toBe(1);
    engine.skip(); // idempotent
    expect(calls.complete).toBe(1);
    engine.destroy();
  });
});
