// OpeningController: snapshot/subscription store for the settings panel plus
// the playback orchestration. The overlay path never touches React; IndexedDB
// mutations run through a serial queue (same pattern as dsh-custom-skin) to
// keep multi-tab writes safe.

import {
  clearRecords,
  deleteRecord,
  getAllRecords,
  makeId,
  openDatabase,
  putRecord,
  requestResult,
  transactionDone,
  type MediaRecord,
  STORE,
} from "./media-store";
import { OverlayRunner } from "./overlay";
import {
  DEFAULT_PREFERENCES,
  IMAGE_PLAYBACK_ORDERS,
  PREFS_KEY,
  clearLastPlayedImageId,
  readLastPlayedImageId,
  structuredClonePreferences,
  writeLastPlayedImageId,
  type ImagePlaybackOrder,
  type OpeningPreferences,
} from "./preferences";
import { isImportableImage, MAX_IMAGE_PIXELS } from "./media-probe";
import {
  listAnimations,
  resolveAnimation,
  resolveAnimationParams,
  type MediaKind,
  type OpeningAnimation,
} from "./registry";
import { removeCriticalStyles } from "./styles";
import { getTransition } from "./transitions";

export type OpeningError = "storage" | "invalid-file" | "unsupported-codec" | "mutation" | "capacity" | "quota";

export interface MediaSummary {
  id: string;
  name: string;
  type: string;
  kind: MediaKind;
  createdAt: number;
  /** Long-lived object URL for settings thumbnails; owned by the controller. */
  url: string;
}

/** Result of the last import when the library cap cut it short; cleared by any
 * other mutation. Rendered via the "importPartial" locale template. */
export interface ImportSummary {
  imported: number;
  skipped: number;
}

export interface OpeningSnapshot {
  ready: boolean;
  enabled: boolean;
  media: ReadonlyArray<MediaSummary>;
  activeId?: string;
  activeKind?: MediaKind;
  animationByKind: { image: string; video: string };
  imageOrder: ImagePlaybackOrder;
  transitionId: string;
  transitionScale: number;
  maxDurationMs: number;
  showSkipHint: boolean;
  skinHandoff: boolean;
  paramOverrides: Readonly<Record<string, Readonly<Record<string, number | string>>>>;
  playing: boolean;
  importSummary?: ImportSummary;
  error?: OpeningError;
}

/** Library cap; exported for the import-summary locale template. */
export const MAX_MEDIA = 8;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_BYTES = 256 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/x-matroska"]);
const SKIN_DB_NAME = "dsh-custom-skin";
const SKIN_STORE = "wallpapers";
const SKIN_MAX_IMAGES = 24;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const kindOfType = (type: string): MediaKind => (VIDEO_TYPES.has(type) ? "video" : "image");

/** IndexedDB signals a full storage quota by aborting with this error name
 * (DOMException in real browsers; plain Error with the same name elsewhere). */
function isQuotaError(err: unknown): boolean {
  return err instanceof Error && err.name === "QuotaExceededError";
}

/** Container-level support plus common codec probes; unsupported encodings are rejected at import time. */
function videoSupported(type: string): boolean {
  try {
    const probe = document.createElement("video");
    if (probe.canPlayType(type) !== "") return true;
    if (type === "video/mp4") {
      if (probe.canPlayType('video/mp4; codecs="avc1.42E01E"') !== "") return true;
      if (probe.canPlayType('video/mp4; codecs="avc1.640028"') !== "") return true;
      if (probe.canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"') !== "") return true;
    }
    if (type === "video/webm") {
      if (probe.canPlayType('video/webm; codecs="vp8"') !== "") return true;
      if (probe.canPlayType('video/webm; codecs="vp9"') !== "") return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Module-level: the opening plays at most once per document load; preview() bypasses this.
let playedThisDocument = false;

export class OpeningController {
  private snapshot: OpeningSnapshot;
  private readonly listeners = new Set<() => void>();
  private readonly objectUrls = new Map<string, string>();
  private readonly records = new Map<string, MediaRecord>();
  private database?: IDBDatabase;
  private initialization?: Promise<void>;
  private queue: Promise<void> = Promise.resolve();
  private disposed = false;
  private activeRunner?: OverlayRunner;
  private t: (key: string) => string = (key) => key;

  constructor(earlyPrefs: OpeningPreferences) {
    this.snapshot = {
      ready: false,
      enabled: earlyPrefs.enabled,
      media: [],
      activeId: earlyPrefs.activeId,
      animationByKind: { ...earlyPrefs.animationByKind },
      imageOrder: earlyPrefs.imageOrder,
      transitionId: earlyPrefs.transitionId,
      transitionScale: earlyPrefs.transitionScale,
      maxDurationMs: earlyPrefs.maxDurationMs,
      showSkipHint: earlyPrefs.showSkipHint,
      skinHandoff: earlyPrefs.skinHandoff,
      paramOverrides: earlyPrefs.paramOverrides,
      playing: false,
    };
  }

  /** Inject the locale-bound translate function (called once from apply). */
  attachLocale(t: (key: string) => string): void {
    this.t = t;
  }

  getSnapshot = (): OpeningSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  initialize(): Promise<void> {
    this.initialization ??= this.load();
    return this.initialization;
  }

  private async load(): Promise<void> {
    try {
      this.database = await openDatabase();
      const records = (await getAllRecords(this.database)).sort((left, right) => right.createdAt - left.createdAt);
      const media = records.map((record) => {
        this.records.set(record.id, record);
        return {
          id: record.id,
          name: record.name,
          type: record.type,
          kind: kindOfType(record.type),
          createdAt: record.createdAt,
          url: this.createUrl(record.id, record.blob),
        };
      });
      const activeId =
        this.snapshot.activeId !== undefined && media.some((item) => item.id === this.snapshot.activeId)
          ? this.snapshot.activeId
          : undefined;
      this.publish({ ...this.snapshot, ready: true, media, activeId });
      this.persist();
      if (!playedThisDocument && this.snapshot.enabled && this.snapshot.activeId !== undefined) {
        playedThisDocument = true;
        // The startup selection only affects images: "sequence" starts from the
        // selected item and advances through the image list on each startup,
        // wrapping around; "shuffle" never repeats the previous image when
        // there is more than one. The preview path is unaffected (it always
        // plays the selected media).
        const startupId = this.resolveStartupMediaId();
        if (startupId !== undefined) {
          const startup = this.snapshot.media.find((item) => item.id === startupId);
          if (startup?.kind === "image" && this.snapshot.imageOrder !== "single") {
            writeLastPlayedImageId(startupId);
          }
        }
        this.playOnce(false, startupId);
      }
    } catch (err) {
      console.warn("[dsh-opening-animation] local media storage unavailable", err);
      this.teardownPending();
      this.publish({ ...this.snapshot, ready: true, error: "storage" });
    }
  }

  /** Add files to the local library after type/size/decode validation. The
   * library cap is re-checked inside the write transaction (another tab can
   * change the store between the snapshot and this write); anything cut by
   * the cap is reported instead of dropped silently. */
  async addFiles(files: File[]): Promise<void> {
    const accepted: Array<{ file: File; kind: MediaKind }> = [];
    let invalid = false;
    let codecBlocked = false;
    for (const file of files) {
      if (IMAGE_TYPES.has(file.type) && file.size > 0 && file.size <= MAX_IMAGE_BYTES) {
        if (await isImportableImage(file)) accepted.push({ file, kind: "image" });
        else invalid = true;
      } else if (VIDEO_TYPES.has(file.type) && file.size > 0 && file.size <= MAX_VIDEO_BYTES) {
        if (videoSupported(file.type)) accepted.push({ file, kind: "video" });
        else codecBlocked = true;
      } else {
        invalid = true;
      }
    }
    if (accepted.length === 0) {
      this.publish({ ...this.snapshot, error: codecBlocked ? "unsupported-codec" : invalid ? "invalid-file" : this.snapshot.error });
      return;
    }
    const skipped = invalid || codecBlocked;
    const codecError = codecBlocked;
    return this.enqueue(async () => {
      await this.initialization;
      if (this.disposed) return;
      if (this.database === undefined) {
        this.publish({ ...this.snapshot, error: "storage" });
        return;
      }
      const transaction = this.database.transaction(STORE, "readwrite");
      const store = transaction.objectStore(STORE);
      const storedCount = await requestResult(store.count());
      const capacity = Math.max(0, MAX_MEDIA - storedCount);
      const batch = accepted.slice(0, capacity);
      const skippedCapacity = accepted.length - batch.length;
      if (batch.length === 0) {
        this.publish({
          ...this.snapshot,
          error: skipped ? (codecError ? "unsupported-codec" : "invalid-file") : "capacity",
        });
        return;
      }
      const records: MediaRecord[] = batch.map(({ file }, index) => ({
        id: makeId(),
        name: file.name,
        type: file.type,
        blob: file,
        createdAt: Date.now() + index,
      }));
      for (const record of records) store.put(record);
      await transactionDone(transaction);
      const added = records.map((record) => {
        this.records.set(record.id, record);
        return {
          id: record.id,
          name: record.name,
          type: record.type,
          kind: kindOfType(record.type),
          createdAt: record.createdAt,
          url: this.createUrl(record.id, record.blob),
        };
      }).reverse();
      const first = added[0];
      this.publish({
        ...this.snapshot,
        media: [...added, ...this.snapshot.media],
        activeId: this.snapshot.activeId ?? first?.id,
        importSummary: skippedCapacity > 0 ? { imported: batch.length, skipped: skippedCapacity } : undefined,
        error: skipped ? (codecError ? "unsupported-codec" : "invalid-file") : undefined,
      });
      this.persist();
      if (this.snapshot.skinHandoff) {
        void this.handOffToSkin(records.filter((record) => kindOfType(record.type) === "image"));
      }
    }, "mutation");
  }

  async remove(id: string): Promise<void> {
    return this.enqueue(async () => {
      if (this.disposed || this.database === undefined) return;
      const transaction = this.database.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).delete(id);
      await transactionDone(transaction);
      this.records.delete(id);
      if (readLastPlayedImageId() === id) clearLastPlayedImageId();
      const url = this.objectUrls.get(id);
      if (url !== undefined) URL.revokeObjectURL(url);
      this.objectUrls.delete(id);
      this.publish({
        ...this.snapshot,
        media: this.snapshot.media.filter((item) => item.id !== id),
        activeId: this.snapshot.activeId === id ? undefined : this.snapshot.activeId,
        error: undefined,
      });
      this.persist();
    }, "mutation");
  }

  async clear(): Promise<void> {
    return this.enqueue(async () => {
      if (this.disposed || this.database === undefined) return;
      const transaction = this.database.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).clear();
      await transactionDone(transaction);
      this.records.clear();
      clearLastPlayedImageId();
      for (const url of this.objectUrls.values()) URL.revokeObjectURL(url);
      this.objectUrls.clear();
      this.publish({ ...this.snapshot, media: [], activeId: undefined, error: undefined });
      this.persist();
    }, "mutation");
  }

  select(id: string): void {
    if (!this.snapshot.media.some((item) => item.id === id)) return;
    // A new selection is a new starting point for sequence/shuffle rotations.
    if (id !== this.snapshot.activeId) clearLastPlayedImageId();
    this.update({ activeId: id, error: undefined });
  }

  setImageOrder(order: ImagePlaybackOrder): void {
    if (!IMAGE_PLAYBACK_ORDERS.includes(order)) return;
    // A new order restarts the rotation from the selected item.
    clearLastPlayedImageId();
    this.update({ imageOrder: order });
  }

  setEnabled(enabled: boolean): void {
    this.update({ enabled });
  }

  setAnimation(kind: MediaKind, animId: string): void {
    if (resolveAnimation(kind, animId) === undefined) return;
    this.update({ animationByKind: { ...this.snapshot.animationByKind, [kind]: animId } });
  }

  setTransition(id: string): void {
    this.update({ transitionId: getTransition(id).id });
  }

  setTransitionScale(scale: number): void {
    if (!Number.isFinite(scale)) return;
    this.update({ transitionScale: clamp(scale, 0.5, 2) });
  }

  setMaxDuration(maxDurationMs: number): void {
    if (!Number.isFinite(maxDurationMs)) return;
    this.update({ maxDurationMs: clamp(maxDurationMs, 3000, 120000) });
  }

  setSkipHint(showSkipHint: boolean): void {
    this.update({ showSkipHint });
  }

  setSkinHandoff(skinHandoff: boolean): void {
    this.update({ skinHandoff });
  }

  setParam(animId: string, key: string, value: number | string): void {
    const overrides = { ...this.snapshot.paramOverrides };
    const entries = { ...overrides[animId], [key]: value };
    overrides[animId] = entries;
    this.update({ paramOverrides: overrides });
  }

  /** Restore behavior defaults; the media library and the active selection survive. */
  reset(): void {
    const defaults = structuredClonePreferences(DEFAULT_PREFERENCES);
    this.publish({
      ...this.snapshot,
      enabled: defaults.enabled,
      animationByKind: defaults.animationByKind,
      imageOrder: defaults.imageOrder,
      transitionId: defaults.transitionId,
      transitionScale: defaults.transitionScale,
      maxDurationMs: defaults.maxDurationMs,
      showSkipHint: defaults.showSkipHint,
      skinHandoff: defaults.skinHandoff,
      paramOverrides: defaults.paramOverrides,
      importSummary: undefined,
      error: undefined,
    });
    clearLastPlayedImageId();
    this.persist();
  }

  /** Replay the current configuration immediately (independent of the once-per-document guard).
   * A preview is an explicit request to watch the animation, so it plays even under
   * prefers-reduced-motion; only the unattended startup playback honors the setting. */
  preview(): void {
    if (this.disposed || this.activeRunner !== undefined) return;
    if (this.snapshot.activeId === undefined) return;
    this.playOnce(true);
  }

  dispose(): void {
    this.disposed = true;
    this.activeRunner?.abort();
    this.activeRunner = undefined;
    this.database?.close();
    this.database = undefined;
    for (const url of this.objectUrls.values()) URL.revokeObjectURL(url);
    this.objectUrls.clear();
    this.records.clear();
    this.listeners.clear();
  }

  private playOnce(forceMotion = false, mediaId: string | undefined = this.snapshot.activeId): void {
    if (this.disposed || this.activeRunner !== undefined) return;
    const snapshot = this.snapshot;
    if (mediaId === undefined) {
      this.teardownPending();
      return;
    }
    const record = this.records.get(mediaId);
    if (record === undefined) {
      this.teardownPending();
      return;
    }
    const kind = kindOfType(record.type);
    const animation = resolveAnimation(kind, snapshot.animationByKind[kind]);
    if (animation === undefined) {
      this.teardownPending();
      return;
    }
    let url: string;
    try {
      url = URL.createObjectURL(record.blob);
    } catch (err) {
      console.warn("[dsh-opening-animation] object URL creation failed", err);
      this.teardownPending();
      return;
    }
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches && !forceMotion;
    this.publish({ ...snapshot, playing: true });
    const runner = new OverlayRunner({
      animation,
      media: { url, kind, mime: record.type, name: record.name },
      transition: getTransition(snapshot.transitionId),
      transitionScale: snapshot.transitionScale,
      maxDurationMs: snapshot.maxDurationMs,
      showSkipHint: snapshot.showSkipHint,
      reducedMotion,
      params: this.mergeParams(animation),
      t: this.t,
      onDone: () => {
        this.activeRunner = undefined;
        if (!this.disposed) this.publish({ ...this.snapshot, playing: false });
      },
    });
    this.activeRunner = runner;
    try {
      runner.mount();
    } catch (err) {
      console.warn("[dsh-opening-animation] overlay mount failed", err);
      runner.abort();
    }
  }

  /** Picks the media one startup playback runs. The startup selection only
   * affects images — videos always play the selected item. "sequence" starts
   * from the selected item and advances through the image list (media is
   * sorted by createdAt descending, matching the settings grid order),
   * wrapping around; "shuffle" picks a random image that never repeats the
   * previous one when there is more than one. An invalid or absent cursor
   * (first use, or the previously played image was removed) falls back to the
   * selected item. The preview path is unaffected (it always plays the
   * selection). */
  private resolveStartupMediaId(): string | undefined {
    const activeId = this.snapshot.activeId;
    if (activeId === undefined) return undefined;
    const active = this.snapshot.media.find((item) => item.id === activeId);
    if (active === undefined) return undefined;
    if (active.kind !== "image" || this.snapshot.imageOrder === "single") return activeId;
    const images = this.snapshot.media.filter((item) => item.kind === "image").map((item) => item.id);
    if (this.snapshot.imageOrder === "shuffle") {
      const last = readLastPlayedImageId();
      const pool = images.length > 1 && last !== undefined ? images.filter((id) => id !== last) : images;
      return pool[Math.floor(Math.random() * pool.length)] ?? activeId;
    }
    const last = readLastPlayedImageId();
    const index = last !== undefined ? images.indexOf(last) : -1;
    return index >= 0 ? images[(index + 1) % images.length]! : activeId;
  }

  /** Missing media/animation: un-pend and end without a trace. */
  private teardownPending(): void {
    delete document.documentElement.dataset.dshOpeningPending;
    removeCriticalStyles();
  }

  private mergeParams(animation: OpeningAnimation): Record<string, unknown> {
    return resolveAnimationParams(animation, this.snapshot.paramOverrides[animation.id]);
  }

  /** ADR-006: one-way copy of images into the wallpaper plugin's library. Best-effort, silent on failure. */
  private async handOffToSkin(records: MediaRecord[]): Promise<void> {
    if (records.length === 0) return;
    let database: IDBDatabase | null = null;
    try {
      const opened = await new Promise<IDBDatabase>((resolve, reject) => {
        // No version argument: opening must never create or upgrade the skin's database.
        const request = indexedDB.open(SKIN_DB_NAME);
        request.onupgradeneeded = () => {
          try {
            request.transaction?.abort();
          } catch {
            // aborting a fresh open is best-effort
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("skin database unavailable"));
      });
      database = opened;
      const count = await new Promise<number>((resolve, reject) => {
        const transaction = opened.transaction(SKIN_STORE, "readonly");
        const request = transaction.objectStore(SKIN_STORE).count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("skin count failed"));
      });
      const capacity = Math.max(0, SKIN_MAX_IMAGES - count);
      const batch = records.slice(0, capacity);
      if (batch.length === 0) return;
      await new Promise<void>((resolve, reject) => {
        const transaction = opened.transaction(SKIN_STORE, "readwrite");
        for (const record of batch) transaction.objectStore(SKIN_STORE).put(record);
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error ?? new Error("skin write aborted"));
        transaction.onerror = () => reject(transaction.error ?? new Error("skin write failed"));
      });
    } catch {
      console.debug("[dsh-opening-animation] wallpaper handoff skipped (skin library unavailable)");
    } finally {
      database?.close();
    }
  }

  private update(patch: Partial<OpeningSnapshot>): void {
    // Any explicit user action acknowledges (and clears) an import notice.
    this.publish({ ...this.snapshot, importSummary: undefined, ...patch });
    this.persist();
  }

  private enqueue(operation: () => Promise<void>, error: OpeningError): Promise<void> {
    this.queue = this.queue
      .catch(() => {
        // Queue self-healing: the failure below is already published per step.
      })
      .then(async () => {
        if (this.disposed) return;
        try {
          await operation();
        } catch (err) {
          console.warn("[dsh-opening-animation] media mutation failed", err);
          this.publish({ ...this.snapshot, error: isQuotaError(err) ? "quota" : error });
        }
      });
    return this.queue;
  }

  private publish(snapshot: OpeningSnapshot): void {
    if (this.disposed) return;
    const activeKind = snapshot.activeId !== undefined
      ? snapshot.media.find((item) => item.id === snapshot.activeId)?.kind
      : undefined;
    this.snapshot = Object.freeze({ ...snapshot, media: Object.freeze([...snapshot.media]), activeKind });
    for (const listener of this.listeners) listener();
  }

  private persist(): void {
    const s = this.snapshot;
    const prefs: OpeningPreferences = {
      enabled: s.enabled,
      activeId: s.activeId,
      animationByKind: { ...s.animationByKind },
      imageOrder: s.imageOrder,
      transitionId: s.transitionId,
      transitionScale: s.transitionScale,
      maxDurationMs: s.maxDurationMs,
      showSkipHint: s.showSkipHint,
      paramOverrides: Object.fromEntries(Object.entries(s.paramOverrides).map(([key, value]) => [key, { ...value }])),
      skinHandoff: s.skinHandoff,
    };
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // storage full or blocked: preferences stay in-memory only
    }
  }

  private createUrl(id: string, blob: Blob): string {
    const url = URL.createObjectURL(blob);
    this.objectUrls.set(id, url);
    return url;
  }
}

export { listAnimations };
