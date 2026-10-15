// localStorage-backed user preferences. Any corrupted input falls back to the
// default per field; parsing never throws.

export interface OpeningPreferences {
  enabled: boolean;
  activeId?: string;
  animationByKind: { image: string; video: string };
  /** Which image opening a startup playback runs (videos always play the selection). */
  imageOrder: ImagePlaybackOrder;
  transitionId: string;
  transitionScale: number;
  maxDurationMs: number;
  showSkipHint: boolean;
  paramOverrides: Record<string, Record<string, number | string>>;
  skinHandoff: boolean;
}

export type ImagePlaybackOrder = "single" | "sequence" | "shuffle";

export const IMAGE_PLAYBACK_ORDERS: readonly ImagePlaybackOrder[] = ["single", "sequence", "shuffle"];

export const PREFS_KEY = "dsh.opening-animation.preferences.v1";

/** Key of the startup playback cursor: the image id played by the last
 * startup, independent of the preferences payload. */
export const CURSOR_KEY = "dsh.opening-animation.cursor.v1";

export const DEFAULT_ANIMATION_BY_KIND = { image: "tap-reveal", video: "video-player" } as const;

export const DEFAULT_PREFERENCES: Readonly<OpeningPreferences> = Object.freeze({
  enabled: false,
  activeId: undefined,
  animationByKind: { ...DEFAULT_ANIMATION_BY_KIND },
  imageOrder: "single",
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
    imageOrder: typeof v.imageOrder === "string" && (IMAGE_PLAYBACK_ORDERS as readonly string[]).includes(v.imageOrder)
      ? (v.imageOrder as ImagePlaybackOrder)
      : DEFAULT_PREFERENCES.imageOrder,
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
    imageOrder: prefs.imageOrder,
    transitionId: prefs.transitionId,
    transitionScale: prefs.transitionScale,
    maxDurationMs: prefs.maxDurationMs,
    showSkipHint: prefs.showSkipHint,
    paramOverrides: Object.fromEntries(Object.entries(prefs.paramOverrides).map(([k, v]) => [k, { ...v }])),
    skinHandoff: prefs.skinHandoff,
  };
}

/** The image id played by the last startup playback, if any. Any corrupted or
 * empty entry falls back to undefined; parsing never throws. */
export function readLastPlayedImageId(storage: Pick<Storage, "getItem"> = localStorage): string | undefined {
  try {
    const raw = storage.getItem(CURSOR_KEY);
    if (raw === null) return undefined;
    const value: unknown = JSON.parse(raw);
    return typeof value === "string" && value !== "" ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Record the image id played by this startup; storage-full/blocked keeps it in-memory only. */
export function writeLastPlayedImageId(id: string, storage: Pick<Storage, "setItem"> = localStorage): void {
  try {
    storage.setItem(CURSOR_KEY, JSON.stringify(id));
  } catch {
    // storage full or blocked: the cursor stays in-memory only
  }
}

/** Drop the startup playback cursor; best-effort, never throws. */
export function clearLastPlayedImageId(storage: Pick<Storage, "removeItem"> = localStorage): void {
  try {
    storage.removeItem(CURSOR_KEY);
  } catch {
    // best-effort
  }
}
