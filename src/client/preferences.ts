// localStorage-backed user preferences. Any corrupted input falls back to the
// default per field; parsing never throws.

export interface OpeningPreferences {
  enabled: boolean;
  activeId?: string;
  animationByKind: { image: string; video: string };
  transitionId: string;
  transitionScale: number;
  maxDurationMs: number;
  showSkipHint: boolean;
  paramOverrides: Record<string, Record<string, number | string>>;
  skinHandoff: boolean;
}

export const PREFS_KEY = "dsh.opening-animation.preferences.v1";

export const DEFAULT_ANIMATION_BY_KIND = { image: "tap-reveal", video: "video-player" } as const;

export const DEFAULT_PREFERENCES: Readonly<OpeningPreferences> = Object.freeze({
  enabled: false,
  activeId: undefined,
  animationByKind: { ...DEFAULT_ANIMATION_BY_KIND },
  transitionId: "cross-fade",
  transitionScale: 1,
  maxDurationMs: 15000,
  showSkipHint: true,
  paramOverrides: {},
  skinHandoff: false,
});

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isParamValue(value: unknown): value is number | string {
  return typeof value === "number" && Number.isFinite(value) || typeof value === "string";
}

function parseParamOverrides(value: unknown): Record<string, Record<string, number | string>> {
  if (typeof value !== "object" || value === null) return {};
  const result: Record<string, Record<string, number | string>> = {};
  for (const [animId, entries] of Object.entries(value)) {
    if (typeof entries !== "object" || entries === null) continue;
    const clean: Record<string, number | string> = {};
    for (const [key, param] of Object.entries(entries)) {
      if (isParamValue(param)) clean[key] = param;
    }
    if (Object.keys(clean).length > 0) result[animId] = clean;
  }
  return result;
}

/** Read preferences from localStorage, falling back per field. */
export function parsePreferences(storage: Pick<Storage, "getItem"> = localStorage): OpeningPreferences {
  let raw: string | null = null;
  try {
    raw = storage.getItem(PREFS_KEY);
  } catch {
    return structuredClonePreferences(DEFAULT_PREFERENCES);
  }
  let value: unknown;
  try {
    value = JSON.parse(raw ?? "{}");
  } catch {
    return structuredClonePreferences(DEFAULT_PREFERENCES);
  }
  if (typeof value !== "object" || value === null) return structuredClonePreferences(DEFAULT_PREFERENCES);
  const v = value as Record<string, unknown>;
  const rawByKind = typeof v.animationByKind === "object" && v.animationByKind !== null
    ? (v.animationByKind as Record<string, unknown>)
    : {};
  const animationByKind: { image: string; video: string } = {
    image: typeof rawByKind.image === "string" ? rawByKind.image : DEFAULT_ANIMATION_BY_KIND.image,
    video: typeof rawByKind.video === "string" ? rawByKind.video : DEFAULT_ANIMATION_BY_KIND.video,
  };
  const scale = typeof v.transitionScale === "number" && Number.isFinite(v.transitionScale) ? clamp(v.transitionScale, 0.5, 2) : DEFAULT_PREFERENCES.transitionScale;
  const maxDuration = typeof v.maxDurationMs === "number" && Number.isFinite(v.maxDurationMs)
    ? clamp(v.maxDurationMs, 3000, 120000)
    : DEFAULT_PREFERENCES.maxDurationMs;
  return {
    enabled: typeof v.enabled === "boolean" ? v.enabled : DEFAULT_PREFERENCES.enabled,
    activeId: typeof v.activeId === "string" ? v.activeId : undefined,
    animationByKind,
    transitionId: typeof v.transitionId === "string" ? v.transitionId : DEFAULT_PREFERENCES.transitionId,
    transitionScale: scale,
    maxDurationMs: maxDuration,
    showSkipHint: typeof v.showSkipHint === "boolean" ? v.showSkipHint : DEFAULT_PREFERENCES.showSkipHint,
    paramOverrides: parseParamOverrides(v.paramOverrides),
    skinHandoff: typeof v.skinHandoff === "boolean" ? v.skinHandoff : DEFAULT_PREFERENCES.skinHandoff,
  };
}

export function structuredClonePreferences(prefs: Readonly<OpeningPreferences>): OpeningPreferences {
  return {
    enabled: prefs.enabled,
    activeId: prefs.activeId,
    animationByKind: { ...prefs.animationByKind },
    transitionId: prefs.transitionId,
    transitionScale: prefs.transitionScale,
    maxDurationMs: prefs.maxDurationMs,
    showSkipHint: prefs.showSkipHint,
    paramOverrides: Object.fromEntries(Object.entries(prefs.paramOverrides).map(([k, v]) => [k, { ...v }])),
    skinHandoff: prefs.skinHandoff,
  };
}
