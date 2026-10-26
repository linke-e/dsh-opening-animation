import { describe, expect, it, vi } from "vitest";
import { getTransition, listTransitions, registerTransition } from "../src/client/transitions";

describe("transitions", () => {
  it("exposes the four built-in presets", () => {
    const ids = listTransitions().map((preset) => preset.id);
    expect(ids).toEqual(expect.arrayContaining(["cross-fade", "dip-to-bg", "zoom-fade", "glass-wipe"]));
    expect(getTransition("cross-fade").exitMs).toBe(700);
  });

  it("declares the glass-wipe setup with its three-phase base durations", () => {
    const preset = getTransition("glass-wipe");
    expect(preset.exitMs).toBe(2750);
    expect(preset.enterDelayMs).toBe(900);
    expect(preset.enterMs).toBe(1850);
    // the enter window runs inside the three phases: the total the overlay
    // budgets (and tears down at) equals exitMs, not the back-to-back sum
    expect(preset.totalMs).toBe(2750);
    expect(typeof preset.setup).toBe("function");
  });

  it("warns and falls back to cross-fade on unknown ids", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const preset = getTransition("does-not-exist");
    expect(preset.id).toBe("cross-fade");
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("registers and unregisters custom presets", () => {
    const unregister = registerTransition({
      id: "test-trans",
      labelKey: "trans.test.label",
      exitMs: 100,
      enterDelayMs: 0,
      enterMs: 100,
      exitClass: "x",
    });
    expect(getTransition("test-trans").exitMs).toBe(100);
    unregister();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getTransition("test-trans").id).toBe("cross-fade");
    warn.mockRestore();
  });
});
