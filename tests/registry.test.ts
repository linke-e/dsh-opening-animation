import { describe, expect, it } from "vitest";
import {
  listAnimations,
  registerAnimation,
  resolveAnimation,
  resolveAnimationParams,
  type OpeningAnimation,
} from "../src/client/registry";

const def: OpeningAnimation = {
  id: "test-anim",
  kind: "image",
  labelKey: "anim.test.label",
  paramsSchema: {
    size: { type: "number", default: 10, min: 1, max: 100, step: 1 },
    mode: { type: "enum", default: "a", options: ["a", "b"] },
  },
  create: () => ({
    start: () => {},
    skip: () => {},
    destroy: () => {},
  }),
};

describe("animation registry", () => {
  it("resolves built-in animations by id and kind", () => {
    expect(resolveAnimation("image", "grid-reveal")?.id).toBe("grid-reveal");
    expect(resolveAnimation("image", "grid-reveal-spread")?.id).toBe("grid-reveal-spread");
    expect(resolveAnimation("video", "video-player")?.id).toBe("video-player");
  });

  it("refuses kind mismatches and unknown ids", () => {
    expect(resolveAnimation("video", "grid-reveal")).toBeUndefined();
    expect(resolveAnimation("image", "video-player")).toBeUndefined();
    expect(resolveAnimation("image", "nope")).toBeUndefined();
  });

  it("lists animations filtered by kind", () => {
    const ids = listAnimations().map((animation) => animation.id);
    expect(ids).toContain("grid-reveal");
    expect(listAnimations("video").map((animation) => animation.id)).toEqual(["video-player"]);
  });

  it("registers and unregisters without disturbing others", () => {
    const unregister = registerAnimation(def);
    expect(resolveAnimation("image", "test-anim")?.id).toBe("test-anim");
    unregister();
    expect(resolveAnimation("image", "test-anim")).toBeUndefined();
  });

  it("merges params: defaults, valid overrides, rejects invalid overrides", () => {
    expect(resolveAnimationParams(def)).toEqual({ size: 10, mode: "a" });
    expect(resolveAnimationParams(def, { size: 42, mode: "b" })).toEqual({ size: 42, mode: "b" });
    expect(resolveAnimationParams(def, { size: Number.NaN, mode: "not-an-option" })).toEqual({ size: 10, mode: "a" });
  });
});
