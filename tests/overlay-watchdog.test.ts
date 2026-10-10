import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OverlayRunner } from "../src/client/overlay";
import { getTransition } from "../src/client/transitions";
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
    reducedMotion: false,
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
