import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFERENCES,
  PREFS_KEY,
  parsePreferences,
} from "../src/client/preferences";

function storageWith(value: string | null): Pick<Storage, "getItem"> {
  return { getItem: () => value };
}

describe("preferences parsing", () => {
  it("returns defaults for missing or corrupted JSON", () => {
    expect(parsePreferences(storageWith(null))).toEqual({ ...DEFAULT_PREFERENCES, activeId: undefined });
    expect(parsePreferences(storageWith("not json {"))).toEqual({ ...DEFAULT_PREFERENCES, activeId: undefined });
    expect(parsePreferences(storageWith("42"))).toEqual({ ...DEFAULT_PREFERENCES, activeId: undefined });
  });

  it("keeps valid fields and falls back per field", () => {
    const prefs = parsePreferences(
      storageWith(
        JSON.stringify({
          enabled: true,
          activeId: "abc",
          transitionScale: 9,
          maxDurationMs: -5,
          showSkipHint: "yes",
          animationByKind: { image: "grid-reveal-spread" },
        }),
      ),
    );
    expect(prefs.enabled).toBe(true);
    expect(prefs.activeId).toBe("abc");
    expect(prefs.transitionScale).toBe(2); // clamped
    expect(prefs.maxDurationMs).toBe(3000); // valid number → clamped, not reset to default
    expect(prefs.showSkipHint).toBe(true); // non-boolean → default
    expect(prefs.animationByKind.video).toBe(DEFAULT_PREFERENCES.animationByKind.video);
    expect(prefs.animationByKind.image).toBe("grid-reveal-spread");
  });

  it("round-trips through the persisted key", () => {
    const prefs = parsePreferences(storageWith(null));
    expect(prefs.enabled).toBe(false);
    expect(PREFS_KEY).toBe("dsh.opening-animation.preferences.v1");
  });
});
