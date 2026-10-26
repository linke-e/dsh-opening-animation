// glass-wipe transition: the hand-over moment staged as frosted glass. The
// preset's visuals live in a custom stack appended to the overlay root, on
// top of the still-playing opening:
// phase 1 (blur-in) frosts the opening itself — the pane is a transparent
// layer whose backdrop-filter blur rises from 0 to full while a light tint
// fades in, so what grows blurry is the LIVE opening underneath (a video
// keeps playing through the frost; the video handoff window makes it land on
// its final frame exactly as the wipe completes); phase 2 (wipe) sweeps a
// wide soft-bristle brush across the frost in three folding strokes (the
// brush motion from the reference clip: left-middle → upper-right, fold back
// left → right, lower-left → lower-right), each stamped impression being a
// procedural bristle texture so the erased area accumulates organically;
// whatever the strokes leave uncovered then spreads to the full screen from
// the brush's last position as a soft-edged circle. The erased, crisp area
// shows the wallpaper: dsh-custom-skin's active image when its preferences
// and library resolve, otherwise the opening's own media (a video stays
// frame-aligned with the opening by seeding its currentTime from the stage's
// video); phase 3 (settle) cross-fades the whole overlay root into the
// revealed UI.
// The wipe runs on two canvases: a mask canvas accumulates the brush
// impressions, and the crisp canvas composites the source through it
// (destination-in) every frame. Without a 2D context (test environments) the
// choreography is skipped and the transition degrades to its timing skeleton.
// The wallpaper lookup is read-only and best-effort (same access shape as
// the controller's ADR-006 handoff: no version argument, never create or
// upgrade the skin's database), capped at a short timeout; any failure falls
// back to the opening's media. Every broken-media path still lands on the
// settle fade, so the transition stays decoration that never traps the UI
// (ADR-005).

import type { TransitionSetupContext, TransitionSetupResult } from "./transitions";

const BLUR_IN_MS = 900;
const WIPE_MS = 1400;
/** The brush-stroke window inside the wipe; the rest is the spread that
 * fills whatever the strokes left uncovered. */
const BRUSH_MS = 1000;
const SETTLE_MS = 450;
const BLUR_PX = 28;
const SKIN_PREFS_KEY = "dsh-custom-skin.preferences.v1";
const SKIN_DB_NAME = "dsh-custom-skin";
const SKIN_STORE = "wallpapers";
/** The wallpaper lookup must land inside the blur-in window; past it the
 * wipe starts on the opening's media rather than stalling the transition. */
const SKIN_TIMEOUT_MS = 250;
const SKIN_FITS = ["cover", "contain", "fill"];
const SKIN_POSITIONS = ["center", "top", "bottom"];
/** The settle class on the overlay root: the whole overlay (stack plus the
 * stage's final frame) cross-fades into the revealed UI, so no orphan tail
 * frame is ever shown on its own. */
const GW_EXIT_CLASS = "dsh-opening-gw-exit";

/** The brush path, normalized to the viewport: three folding strokes (start,
 * end, width gain per stroke) mirroring the reference clip's motion. */
const BRUSH_STROKES: readonly (readonly [{ x: number; y: number }, { x: number; y: number }, number])[] = [
  [{ x: 0.18, y: 0.42 }, { x: 0.82, y: 0.22 }, 0.85],
  [{ x: 0.15, y: 0.60 }, { x: 0.88, y: 0.48 }, 1.0],
  [{ x: 0.20, y: 0.80 }, { x: 0.90, y: 0.72 }, 1.1],
];
/** Stamp footprint, as a fraction of the viewport width. */
const STAMP_W = 0.5;
const STAMP_H = 0.32;
/** Impressions per stroke control the overlap density (each stamp is drawn
 * at partial alpha; overlapping builds the solid core with bristled edges). */
const STAMPS_PER_STROKE = 26;
/** Canvas resolution cap: the transition lasts ~2.5 s, doubling pixels past
 * this buys nothing. */
const MAX_DPR = 2;

export interface BrushSample {
  x: number;
  y: number;
  /** Stamp scale relative to its base footprint. */
  scale: number;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** progress (0..1) → brush center (normalized) and stamp scale. Three
 * folding strokes; each stroke enters thin, runs wide, leaves slightly
 * narrower, and each later stroke sweeps wider than the previous one. */
export function sampleBrushPath(progress: number): BrushSample {
  const clamped = Math.min(0.999999, Math.max(0, progress));
  const strokeIndex = Math.min(BRUSH_STROKES.length - 1, Math.floor(clamped * BRUSH_STROKES.length));
  const [from, to, widthGain] = BRUSH_STROKES[strokeIndex]!;
  const local = clamped * BRUSH_STROKES.length - strokeIndex;
  const eased = easeInOut(local);
  let envelope = 1;
  if (local < 0.15) envelope = 0.55 + (local / 0.15) * 0.45;
  else if (local > 0.9) envelope = 1 - ((local - 0.9) / 0.1) * 0.15;
  return {
    x: from.x + (to.x - from.x) * eased,
    y: from.y + (to.y - from.y) * eased,
    scale: envelope * widthGain,
  };
}

/** Procedural bristle stamp: a soft elliptical core overlaid with horizontal
 * bristle streaks and dry-brush speckling, so impressions accumulate into a
 * streaked, frayed stroke like the reference clip's wide brush. */
function buildBrushStamp(widthPx: number, heightPx: number): HTMLCanvasElement | null {
  const stamp = document.createElement("canvas");
  stamp.width = Math.max(2, Math.round(widthPx));
  stamp.height = Math.max(2, Math.round(heightPx));
  const g = stamp.getContext("2d");
  if (g === null) return null;
  const w = stamp.width;
  const h = stamp.height;
  // Soft elliptical core.
  const core = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) / 2);
  core.addColorStop(0, "rgba(255,255,255,0.95)");
  core.addColorStop(0.7, "rgba(255,255,255,0.75)");
  core.addColorStop(1, "rgba(255,255,255,0)");
  g.save();
  g.translate(w / 2, h / 2);
  g.scale(1, h / w);
  g.fillStyle = core;
  g.beginPath();
  g.arc(0, 0, w / 2, 0, Math.PI * 2);
  g.fill();
  g.restore();
  // Bristle streaks: thin horizontal strokes, some reaching past the core.
  for (let i = 0; i < 26; i += 1) {
    const y = h * (0.12 + Math.random() * 0.76);
    const inset = Math.random() * w * 0.18;
    const reach = Math.random() * w * 0.1;
    g.strokeStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.5})`;
    g.lineWidth = Math.max(1, h * (0.01 + Math.random() * 0.02));
    g.beginPath();
    g.moveTo(inset, y);
    g.lineTo(w - inset - reach * Math.random(), y + (Math.random() - 0.5) * h * 0.05);
    g.stroke();
  }
  // Dry-brush speckling: punch small transparent holes through the wet core.
  g.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 90; i += 1) {
    const r = Math.random() * h * 0.035;
    g.beginPath();
    g.arc(Math.random() * w, Math.random() * h, r, 0, Math.PI * 2);
    g.fillStyle = `rgba(0,0,0,${0.2 + Math.random() * 0.5})`;
    g.fill();
  }
  g.globalCompositeOperation = "source-over";
  return stamp;
}

/** The skin's active wallpaper, resolved: object URL (self-owned, revoked on
 * dispose) plus the presentation fields the wipe honors from the skin's
 * preferences (dim/blur/surface stay skin-only). */
interface SkinWallpaper {
  url: string;
  fit: string;
  pos: string;
}

interface SkinWallpaperRecord {
  id?: unknown;
  type?: unknown;
  blob?: unknown;
}

/** True Blob, or the same shape from a structured-clone implementation that
 * lost the prototype across the IndexedDB roundtrip (jsdom + fake-indexeddb
 * test databases flatten a Blob to an empty object, so test seeds store a
 * Blob-shaped plain object and land on the duck arm); a real browser's
 * records always take the instanceof arm. */
export function isBlobLike(value: unknown): value is Blob {
  if (value instanceof Blob) return true;
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { size?: unknown; type?: unknown };
  return typeof candidate.size === "number" && typeof candidate.type === "string";
}

/** Builds the transition stack, runs the three-phase schedule and returns the
 * preset's base durations plus the disposer. The overlay still scales the
 * durations; the CSS variables here carry the scaled values. */
export function setupGlassWipe(context: TransitionSetupContext): TransitionSetupResult {
  const { root, media, scale } = context;
  const blurMs = Math.round(BLUR_IN_MS * scale);
  const wipeMs = Math.round(WIPE_MS * scale);
  const brushMs = Math.round(BRUSH_MS * scale);
  const settleMs = Math.round(SETTLE_MS * scale);

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);

  const stack = document.createElement("div");
  stack.className = "dsh-opening-gw";
  // The pane stays empty: its CSS backdrop-filter is what blurs the LIVE
  // opening underneath (the stage keeps playing through the frost).
  const pane = document.createElement("div");
  pane.className = "dsh-opening-gw-pane";
  // The crisp layer is a canvas composited every frame: source through the
  // accumulating brush mask (destination-in).
  const clear = document.createElement("canvas");
  clear.className = "dsh-opening-gw-clear";
  clear.width = Math.max(2, Math.round(vw * dpr));
  clear.height = Math.max(2, Math.round(vh * dpr));
  // Observability marker for the current crisp source (media until the
  // wallpaper resolves, then "wallpaper").
  clear.dataset.gwSource = "media";
  stack.append(pane, clear);
  // The variables live on the root so both the stack's layers and the root's
  // own settle class (see GW_EXIT_CLASS) inherit them.
  root.style.setProperty("--gw-blur-ms", `${blurMs}ms`);
  root.style.setProperty("--gw-wipe-ms", `${wipeMs}ms`);
  root.style.setProperty("--gw-settle-ms", `${settleMs}ms`);
  root.style.setProperty("--gw-blur", `${BLUR_PX}px`);
  root.append(stack);

  let destroyed = false;
  let wallpaperUrl: string | undefined;
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number): void => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };

  const clearCtx = clear.getContext("2d");
  const mask = document.createElement("canvas");
  mask.width = clear.width;
  mask.height = clear.height;
  const maskCtx = mask.getContext("2d");
  const stamp = clearCtx !== null && maskCtx !== null
    ? buildBrushStamp(STAMP_W * vw * dpr, STAMP_H * vw * dpr)
    : null;
  const choreographed = clearCtx !== null && maskCtx !== null && stamp !== null;

  /** The crisp source: the opening's media until the wallpaper resolves. A
   * video source plays hidden inside the stack, frame-seeded to the
   * opening's own video so the erased area shows the same moment. */
  interface CrispSource {
    image?: HTMLImageElement;
    video?: HTMLVideoElement;
    fit: string;
    pos: string;
  }
  let source: CrispSource = { fit: "cover", pos: "center" };
  if (media.kind === "video") {
    const video = document.createElement("video");
    video.src = media.url;
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.style.display = "none";
    const opening = openingVideo(root);
    if (opening !== null && Number.isFinite(opening.currentTime) && opening.currentTime > 0) {
      video.addEventListener(
        "loadedmetadata",
        () => {
          try {
            video.currentTime = opening.currentTime;
          } catch {
            // seeking an unseekable stream is best-effort
          }
        },
        { once: true },
      );
    }
    // jsdom's play() returns undefined; guard before chaining the catch.
    const playing = video.play();
    if (playing !== undefined) {
      playing.catch(() => {
        // a paused crisp video still shows its first frame; the frost keeps playing
      });
    }
    stack.append(video);
    source.video = video;
  } else {
    const image = new Image();
    image.src = media.url;
    source.image = image;
  }

  let rafId = 0;
  let wipeStart = 0;
  let stampedThrough = 0;

  /** Stamps brush impressions along the path from `through` to `progress`
   * (both 0..1), rotating and jittering each impression slightly. */
  const stampBrush = (through: number, progress: number): void => {
    if (maskCtx === null || stamp === null) return;
    const w = clear.width;
    const h = clear.height;
    const stampW = STAMP_W * w;
    const stampH = STAMP_H * w;
    const steps = Math.max(1, Math.round((progress - through) * BRUSH_STROKES.length * STAMPS_PER_STROKE));
    for (let i = 1; i <= steps; i += 1) {
      const sample = sampleBrushPath(through + ((progress - through) * i) / steps);
      maskCtx.save();
      maskCtx.translate(sample.x * w, sample.y * h);
      maskCtx.rotate((Math.random() - 0.5) * 0.28);
      if (Math.random() < 0.5) maskCtx.scale(-1, 1);
      const sw = stampW * sample.scale;
      const sh = stampH * sample.scale;
      maskCtx.drawImage(stamp, -sw / 2, -sh / 2 + (Math.random() - 0.5) * sh * 0.08, sw, sh);
      maskCtx.restore();
    }
  };

  /** Spreads a soft-edged circle from the brush's last position until the
   * mask covers the whole screen. */
  const stampSpread = (progress: number): void => {
    if (maskCtx === null) return;
    const w = clear.width;
    const h = clear.height;
    const last = BRUSH_STROKES[BRUSH_STROKES.length - 1]!;
    const cx = last[1].x * w;
    const cy = last[1].y * h;
    const far = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
    const radius = far * easeInOut(Math.min(1, progress));
    const gradient = maskCtx.createRadialGradient(cx, cy, Math.max(0, radius * 0.86), cx, cy, radius);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    maskCtx.fillStyle = gradient;
    maskCtx.beginPath();
    maskCtx.arc(cx, cy, radius, 0, Math.PI * 2);
    maskCtx.fill();
  };

  /** Composites the crisp canvas: source drawn in, then masked by the
   * accumulated brush impressions. */
  const composite = (): void => {
    if (clearCtx === null) return;
    const w = clear.width;
    const h = clear.height;
    clearCtx.clearRect(0, 0, w, h);
    const mediaSource = source.video ?? source.image;
    if (mediaSource !== undefined) {
      const sw = mediaSource instanceof HTMLVideoElement ? mediaSource.videoWidth : mediaSource.naturalWidth;
      const sh = mediaSource instanceof HTMLVideoElement ? mediaSource.videoHeight : mediaSource.naturalHeight;
      if (sw > 0 && sh > 0) {
        const scaleMode = source.fit === "contain" || source.fit === "fill" ? source.fit : "cover";
        let dw = w;
        let dh = h;
        if (scaleMode !== "fill") {
          const gain = scaleMode === "cover" ? Math.max(w / sw, h / sh) : Math.min(w / sw, h / sh);
          dw = sw * gain;
          dh = sh * gain;
        }
        const dy = source.pos === "top" ? 0 : source.pos === "bottom" ? h - dh : (h - dh) / 2;
        clearCtx.drawImage(mediaSource, (w - dw) / 2, dy, dw, dh);
      }
    }
    clearCtx.globalCompositeOperation = "destination-in";
    clearCtx.drawImage(mask, 0, 0);
    clearCtx.globalCompositeOperation = "source-over";
  };

  /** The wipe's rAF loop: brush strokes first, then the spread that fills
   * the rest of the screen; done, the mask stays full and the loop stops. */
  const wipeFrame = (now: number): void => {
    if (destroyed) return;
    const t = now - wipeStart;
    if (t < brushMs) {
      const progress = t / brushMs;
      stampBrush(stampedThrough, progress);
      stampedThrough = progress;
    } else if (t < wipeMs) {
      if (stampedThrough < 1) {
        stampBrush(stampedThrough, 1);
        stampedThrough = 1;
      }
      stampSpread((t - brushMs) / Math.max(1, wipeMs - brushMs));
    } else {
      maskCtx?.fillRect(0, 0, mask.width, mask.height);
      composite();
      return;
    }
    composite();
    rafId = requestAnimationFrame(wipeFrame);
  };

  const startWipe = (): void => {
    if (!choreographed) return;
    wipeStart = performance.now();
    rafId = requestAnimationFrame(wipeFrame);
  };

  // Phase schedule. One synchronous reflow pins the initial frame (the same
  // pattern the overlay's revealApp uses), then the classes chain:
  // blur-in → wipe (brush strokes, then the spread) → settle. The overlay
  // un-pends and fades #root in when the wipe starts (enterDelayMs =
  // BLUR_IN_MS), so the UI is fully there when the stack settles out.
  void stack.offsetHeight;
  stack.classList.add("dsh-opening-gw-run");
  later(() => {
    stack.classList.add("dsh-opening-gw-wipe");
    startWipe();
  }, blurMs);
  later(() => {
    // Settle: drop the root's backdrop and cross-fade the WHOLE overlay —
    // stack and the stage's final frame together — into the app. Fading only
    // the stack would expose the stage behind it (a video opening's tail
    // frame) for its own beat before the teardown snapped to the UI.
    root.style.background = "transparent";
    root.classList.add(GW_EXIT_CLASS);
  }, blurMs + wipeMs);

  // Wallpaper handoff: decoded first (no half-decoded frame under the brush),
  // then the crisp source switches. The frosted pane is untouched — it blurs
  // the live opening, never the wallpaper. Abandoned — media kept as-is — on
  // timeout, storage failure or a broken image.
  void resolveSkinWallpaper().then((wallpaper) => {
    if (destroyed) {
      revokeWallpaper(wallpaper);
      return;
    }
    if (wallpaper === null) return;
    wallpaperUrl = wallpaper.url;
    void preload(wallpaper.url).then((loaded) => {
      if (destroyed) return;
      if (!loaded) return;
      if (source.video !== undefined) {
        source.video.pause();
        source.video.remove();
      }
      const image = new Image();
      image.src = wallpaper.url;
      source = { image, fit: wallpaper.fit, pos: wallpaper.pos };
      clear.dataset.gwSource = "wallpaper";
    });
  });

  return {
    exitMs: BLUR_IN_MS + WIPE_MS + SETTLE_MS,
    enterDelayMs: BLUR_IN_MS,
    enterMs: WIPE_MS + SETTLE_MS,
    dispose: () => {
      destroyed = true;
      cancelAnimationFrame(rafId);
      for (const id of timers) window.clearTimeout(id);
      timers.clear();
      stack.remove();
      if (wallpaperUrl !== undefined) URL.revokeObjectURL(wallpaperUrl);
    },
  };
}

function revokeWallpaper(wallpaper: SkinWallpaper | null): void {
  if (wallpaper !== null) URL.revokeObjectURL(wallpaper.url);
}

/** The opening's own video (the video-player engine's stage-direct element)
 * when one is playing; null otherwise. */
function openingVideo(root: HTMLElement): HTMLVideoElement | null {
  const stage = root.querySelector(".dsh-opening-stage");
  if (stage === null) return null;
  for (const child of stage.children) {
    if (child instanceof HTMLVideoElement) return child;
  }
  return null;
}

/** Resolves after the image decoded (true) or failed (false). */
function preload(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = url;
  });
}

/** The skin's active wallpaper, or null when dsh-custom-skin is absent,
 * disabled, has no resolvable active image, or answers too slowly. The
 * timeout loser keeps running: its object URL is revoked on arrival so the
 * abandoned lookup leaks nothing. */
async function resolveSkinWallpaper(): Promise<SkinWallpaper | null> {
  const lookup = readSkinWallpaper().catch(() => null);
  const result = await Promise.race([
    lookup,
    new Promise<null>((resolve) => {
      window.setTimeout(() => resolve(null), SKIN_TIMEOUT_MS);
    }),
  ]);
  if (result !== null) return result;
  void lookup.then(revokeWallpaper);
  return null;
}

async function readSkinWallpaper(): Promise<SkinWallpaper | null> {
  const prefs = readSkinPreferences();
  if (prefs === null) return null;
  const blob = await readSkinBlob(prefs.activeId);
  if (blob === null) return null;
  return { url: URL.createObjectURL(blob), fit: prefs.fit, pos: prefs.pos };
}

/** The skin's presentation preferences, reduced to what the wipe honors;
 * null = no usable preferences (plugin absent, never loaded, or disabled). */
function readSkinPreferences(): { activeId: string; fit: string; pos: string } | null {
  try {
    const raw = localStorage.getItem(SKIN_PREFS_KEY);
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const v = value as Record<string, unknown>;
    if (v.enabled !== true) return null;
    if (typeof v.activeId !== "string" || v.activeId === "") return null;
    const fit = typeof v.fit === "string" && SKIN_FITS.includes(v.fit) ? v.fit : "cover";
    const pos = typeof v.position === "string" && SKIN_POSITIONS.includes(v.position) ? v.position : "center";
    return { activeId: v.activeId, fit, pos };
  } catch {
    return null;
  }
}

function readSkinBlob(id: string): Promise<Blob | null> {
  return new Promise((resolve, reject) => {
    // No version argument: opening must never create or upgrade the skin's
    // database (the controller's ADR-006 handoff opens it the same way).
    const request = indexedDB.open(SKIN_DB_NAME);
    request.onupgradeneeded = () => {
      try {
        request.transaction?.abort();
      } catch {
        // aborting a fresh open is best-effort
      }
    };
    request.onerror = () => reject(request.error ?? new Error("skin database unavailable"));
    request.onsuccess = () => {
      const database = request.result;
      const finish = (blob: Blob | null, error?: unknown): void => {
        database.close();
        if (error !== undefined) reject(error);
        else resolve(blob);
      };
      try {
        const store = database.transaction(SKIN_STORE, "readonly").objectStore(SKIN_STORE);
        const get = store.get(id) as IDBRequest<SkinWallpaperRecord | undefined>;
        get.onsuccess = () => {
          const record = get.result;
          if (record === undefined) {
            finish(null);
            return;
          }
          const blob = record.blob;
          finish(
            isBlobLike(blob) && typeof record.type === "string" && record.type.startsWith("image/")
              ? blob
              : null,
          );
        };
        get.onerror = () => finish(null, get.error ?? new Error("skin read failed"));
      } catch (err) {
        finish(null, err);
      }
    };
  });
}
