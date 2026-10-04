import { describe, expect, it } from "vitest";
import { extractDominantColor } from "../src/client/dominant-color";

describe("extractDominantColor", () => {
  it("falls back to the plugin backdrop when pixel data is unreadable", () => {
    // jsdom ships no 2d context implementation, so the helper must degrade
    // instead of throwing.
    const img = new Image();
    expect(extractDominantColor(img)).toBe("#04050e");
  });
});
