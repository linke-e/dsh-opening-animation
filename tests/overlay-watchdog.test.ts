import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OverlayRunner } from "../src/client/overlay";
import { getTransition, registerTransition } from "../src/client/transitions";
import type { TransitionPreset } from "../src/client/transitions";
import type { AnimationRuntime, OpeningAnimation } from "../src/client/registry";

/** An engine that never completes on its own; it optionally reports media
 * readiness through runtime.markLoaded, exactly like the real engines do. */
function neverEndingAnimation(markLoadedOnStart: boolean): OpeningAnimation {
  return {
    id: "test-never-ending",
    kind: "image",
    labelKey: "anim.test.label",
    create: (runtime: AnimationRuntime) => ({
      start: () => {
        if (markLoadedOnStart) runtime.markLoaded?.();
      },
      skip: () => {},
      destroy: () => {},
    }),
  };
}

function mountRunner(markLoadedOnStart: boolean, maxDurationMs = 60_000): OverlayRunner {
  const runner = new OverlayRunner({
    animation: neverEndingAnimation(markLoadedOnStart),
    media: { url: "data:image/png;base64,AAAA", kind: "image", mime: "image/png", name: "t.png" },
    transition: getTransition("cross-fade"),
    transitionScale: 1,
    maxDurationMs,
    showSkipHint: false,
    params: {},
    t: (key) => key,
    onDone: () => {},
  });
  runner.mount();
  return runner;
}

describe("OverlayRunner load-timeout watchdog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.querySelectorAll(".dsh-opening-root").forEach((el) => el.remove());
    delete document.body.dataset.dshOpening;
  });

  it("hands the screen back after 8s when the engine never reports readiness", () => {
    const runner = mountRunner(false);
    vi.advanceTimersByTime(7_900);
    expect(document.querySelector(".dsh-opening-root.dsh-opening-exit-cross-fade")).toBeNull();
    vi.advanceTimersByTime(200);
    expect(document.querySelector(".dsh-opening-root.dsh-opening-exit-cross-fade")).not.toBeNull();
    runner.destroy();
  });

  it("keeps playing past 8s once the engine reports readiness, under the max-duration guard", () => {
    const runner = mountRunner(true, 20_000);
    vi.advanceTimersByTime(8_000);
    // without markLoaded the load-timeout would have handed the screen back here
    expect(document.querySelector(".dsh-opening-root.dsh-opening-exit-cross-fade")).toBeNull();
    vi.advanceTimersByTime(12_000);
    // the max-duration watchdog still guards runaway engines
    expect(document.querySelector(".dsh-opening-root.dsh-opening-exit-cross-fade")).not.toBeNull();
    runner.destroy();
  });
});

/** A video-kind runner with a bare <video> in the stage; the watchdog reads
 * readyState/ended off this element and timeupdate via the stage capture
 * listener. The engine reports readiness so the load timeout stays out of the
 * way and the assertions land on the stall watchdog. */
function mountVideoRunner(): OverlayRunner {
  const runner = new OverlayRunner({
    animation: neverEndingAnimation(true),
    media: { url: "data:video/mp4;base64,AAAA", kind: "video", mime: "video/mp4", name: "t.mp4" },
    transition: getTransition("cross-fade"),
    transitionScale: 1,
    maxDurationMs: 60_000,
    showSkipHint: false,
    params: {},
    t: (key) => key,
    onDone: () => {},
  });
  runner.mount();
  const stage = document.querySelector(".dsh-opening-stage") as HTMLElement;
  stage.append(document.createElement("video"));
  return runner;
}

describe("OverlayRunner video stall watchdog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.querySelectorAll(".dsh-opening-root").forEach((el) => el.remove());
    delete document.body.dataset.dshOpening;
  });

  it("hands back when timeupdate stops, even with readyState dropped below HAVE_CURRENT_DATA", () => {
    const runner = mountVideoRunner();
    const video = document.querySelector("video") as HTMLVideoElement;
    video.dispatchEvent(new Event("timeupdate"));
    vi.advanceTimersByTime(1_000);
    video.dispatchEvent(new Event("timeupdate"));
    // playback stalls and the element drops to HAVE_NOTHING
    Object.defineProperty(video, "readyState", { value: 0 });
    vi.advanceTimersByTime(11_000);
    expect(document.querySelector(".dsh-opening-root.dsh-opening-exit-cross-fade")).not.toBeNull();
    runner.destroy();
  });

  it("keeps playing while timeupdate keeps firing", () => {
    const runner = mountVideoRunner();
    const video = document.querySelector("video") as HTMLVideoElement;
    for (let elapsed = 0; elapsed <= 15; elapsed += 1) {
      video.dispatchEvent(new Event("timeupdate"));
      vi.advanceTimersByTime(1_000);
    }
    expect(document.querySelector(".dsh-opening-root.dsh-opening-exit-cross-fade")).toBeNull();
    runner.destroy();
  });
});

describe("OverlayRunner custom transition setup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.querySelectorAll(".dsh-opening-root").forEach((el) => el.remove());
    delete document.body.dataset.dshOpening;
  });

  /** A runner mounted with the given transition preset, told to complete. */
  function mountWith(transition: TransitionPreset): OverlayRunner {
    const runner = new OverlayRunner({
      animation: neverEndingAnimation(true),
      media: { url: "data:image/png;base64,AAAA", kind: "image", mime: "image/png", name: "t.png" },
      transition,
      transitionScale: 1,
      maxDurationMs: 60_000,
      showSkipHint: false,
      params: {},
      t: (key) => key,
      onDone: () => {},
    });
    runner.mount();
    // the engine never completes on its own: drive the transition by hand
    runner.skip();
    return runner;
  }

  it("drives the glass-wipe stack through its phases and tears it down", () => {
    const runner = mountWith(getTransition("glass-wipe"));
    const root = document.querySelector(".dsh-opening-root") as HTMLElement;
    expect(root.classList.contains("dsh-opening-exit-glass-wipe")).toBe(true);
    const stack = root.querySelector<HTMLElement>(".dsh-opening-gw");
    expect(stack).not.toBeNull();
    expect(stack!.classList.contains("dsh-opening-gw-run")).toBe(true);

    vi.advanceTimersByTime(900); // blur-in → wipe; #root un-pends now
    expect(stack!.classList.contains("dsh-opening-gw-wipe")).toBe(true);
    expect(document.documentElement.dataset.dshOpeningPending).toBeUndefined();

    vi.advanceTimersByTime(1400); // wipe → settle
    // settle cross-fades the whole overlay root (stack plus the stage's
    // final frame) into the app
    expect(root.classList.contains("dsh-opening-gw-exit")).toBe(true);
    expect(root.style.background).toBe("transparent");

    // teardown = totalMs (2750: the setup folds every phase into exitMs, so
    // the enter window adds nothing) + buffer; 2300 ms have already advanced
    vi.advanceTimersByTime(2900 - 2300);
    expect(root.querySelector(".dsh-opening-gw")).toBeNull();
    expect(document.querySelector(".dsh-opening-root")).toBeNull();
    runner.destroy(); // idempotent after the auto teardown
  });

  it("reserves the transition budget out of the image max-duration cap", () => {
    // 20 s cap − 2.75 s glass-wipe budget: the watchdog fires at 17.25 s so
    // the whole experience (opening + transition) finishes inside the cap.
    const runner = new OverlayRunner({
      animation: neverEndingAnimation(true),
      media: { url: "data:image/png;base64,AAAA", kind: "image", mime: "image/png", name: "t.png" },
      transition: getTransition("glass-wipe"),
      transitionScale: 1,
      maxDurationMs: 20_000,
      showSkipHint: false,
      params: {},
      t: (key) => key,
      onDone: () => {},
    });
    runner.mount();
    const root = document.querySelector(".dsh-opening-root") as HTMLElement;
    vi.advanceTimersByTime(17_200);
    expect(root.classList.contains("dsh-opening-exit-glass-wipe")).toBe(false);
    vi.advanceTimersByTime(100); // past 17.25 s: the transition has begun
    expect(root.classList.contains("dsh-opening-exit-glass-wipe")).toBe(true);
    // the teardown lands 2.9 s (budget + buffer) after the watchdog
    vi.advanceTimersByTime(2_900);
    expect(document.querySelector(".dsh-opening-root")).toBeNull();
    runner.destroy(); // idempotent after the auto teardown
  });

  it("fires the transition while the main video has the handoff window left, so the wipe lands on its final frame", () => {
    const runner = new OverlayRunner({
      animation: neverEndingAnimation(true),
      media: { url: "data:video/mp4;base64,AAAA", kind: "video", mime: "video/mp4", name: "t.mp4" },
      transition: getTransition("glass-wipe"),
      transitionScale: 1,
      maxDurationMs: 60_000,
      showSkipHint: false,
      params: {},
      t: (key) => key,
      onDone: () => {},
    });
    runner.mount();
    const stage = document.querySelector(".dsh-opening-stage") as HTMLElement;
    const video = document.createElement("video");
    stage.append(video); // stage-direct child = the engine's completion driver

    const root = document.querySelector(".dsh-opening-root") as HTMLElement;
    Object.defineProperty(video, "duration", { value: 10, configurable: true });
    const pauseSpy = vi.spyOn(video, "pause");

    // 3.1 s left, window is 2.4 s: the video keeps playing, no transition yet
    Object.defineProperty(video, "currentTime", { value: 6.9, configurable: true });
    video.dispatchEvent(new Event("timeupdate"));
    expect(root.classList.contains("dsh-opening-exit-glass-wipe")).toBe(false);

    // 2.2 s left: the handoff fires while the video is still playing
    Object.defineProperty(video, "currentTime", { value: 7.8, configurable: true });
    video.dispatchEvent(new Event("timeupdate"));
    expect(root.classList.contains("dsh-opening-exit-glass-wipe")).toBe(true);
    // the video element itself is untouched: no pause — it plays on under
    // the frost and lands on its final frame as the wipe completes
    expect(pauseSpy).not.toHaveBeenCalled();
    runner.destroy();
  });

  it("ignores looped videos and non-main (nested) videos for the handoff", () => {
    const runner = new OverlayRunner({
      animation: neverEndingAnimation(true),
      media: { url: "data:video/mp4;base64,AAAA", kind: "video", mime: "video/mp4", name: "t.mp4" },
      transition: getTransition("glass-wipe"),
      transitionScale: 1,
      maxDurationMs: 60_000,
      showSkipHint: false,
      params: {},
      t: (key) => key,
      onDone: () => {},
    });
    runner.mount();
    const stage = document.querySelector(".dsh-opening-stage") as HTMLElement;
    const root = document.querySelector(".dsh-opening-root") as HTMLElement;

    // a looped stage-direct video has no final frame to align to
    const looped = document.createElement("video");
    stage.append(looped);
    Object.defineProperty(looped, "duration", { value: 10, configurable: true });
    Object.defineProperty(looped, "currentTime", { value: 9.9, configurable: true });
    looped.loop = true;
    looped.dispatchEvent(new Event("timeupdate"));
    expect(root.classList.contains("dsh-opening-exit-glass-wipe")).toBe(false);

    // a nested video (a duration-driven engine's background layer) is not
    // the completion driver — the handoff must not cut its timing short
    const nested = document.createElement("div");
    const inner = document.createElement("video");
    nested.append(inner);
    stage.append(nested);
    Object.defineProperty(inner, "duration", { value: 10, configurable: true });
    Object.defineProperty(inner, "currentTime", { value: 9.9, configurable: true });
    inner.dispatchEvent(new Event("timeupdate"));
    expect(root.classList.contains("dsh-opening-exit-glass-wipe")).toBe(false);
    runner.destroy();
  });

  it("falls back to the cross-fade exit class when a setup throws", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const unregister = registerTransition({
      id: "test-boom",
      labelKey: "trans.test-boom.label",
      exitMs: 200,
      enterDelayMs: 0,
      enterMs: 200,
      exitClass: "dsh-opening-exit-boom",
      setup: () => {
        throw new Error("boom");
      },
    });
    const runner = mountWith(getTransition("test-boom"));
    const root = document.querySelector(".dsh-opening-root") as HTMLElement;
    expect(root.classList.contains("dsh-opening-exit-boom")).toBe(false);
    expect(root.classList.contains("dsh-opening-exit-cross-fade")).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    runner.destroy();
    unregister();
  });
});
