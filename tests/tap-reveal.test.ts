import { afterEach, describe, expect, it } from "vitest";
import { TapRevealEngine } from "../src/client/animations/tap-reveal";
import type { AnimationRuntime, ResolvedMedia } from "../src/client/registry";

const MEDIA: ResolvedMedia = {
  url: "data:image/png;base64,AAAA",
  kind: "image",
  mime: "image/png",
  name: "t.png",
};

function makeRuntime(): AnimationRuntime {
  const container = document.createElement("div");
  document.body.append(container);
  return {
    container,
    media: MEDIA,
    reducedMotion: false,
    params: {},
    t: (key) => key,
    complete: () => {},
    fail: () => {},
  };
}

const tapRoot = (): HTMLElement => document.querySelector(".dsh-opening-tap") as HTMLElement;
const tapImage = (): HTMLImageElement => tapRoot().querySelector("img") as HTMLImageElement;

function cleanUp(): void {
  document.body.innerHTML = "";
}

describe("tap-reveal click protocol", () => {
  afterEach(cleanUp);

  it("swallows clicks while waiting and once revealing lets them bubble to skip", () => {
    const runtime = makeRuntime();
    let bubbled = 0;
    runtime.container.addEventListener("click", () => {
      bubbled += 1;
    });
    const engine = new TapRevealEngine(runtime);
    engine.start();

    // waiting phase: the click is swallowed (nothing decoded to reveal yet)
    tapRoot().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(bubbled).toBe(0);

    // force the jsdom image into the decoded state the engine checks
    Object.defineProperty(tapImage(), "complete", { value: true });
    Object.defineProperty(tapImage(), "naturalWidth", { value: 4 });

    // first real click starts the reveal and is still swallowed
    tapRoot().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(bubbled).toBe(0);

    // once revealing, clicks bubble to the runner's click-to-skip
    tapRoot().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(bubbled).toBe(1);
    engine.destroy();
  });
});
