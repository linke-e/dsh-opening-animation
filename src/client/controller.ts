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
  transactionDone,
  type MediaRecord,
  STORE,
} from "./media-store";
import { OverlayRunner } from "./overlay";
import {
  DEFAULT_PREFERENCES,
  PREFS_KEY,
  structuredClonePreferences,
  type OpeningPreferences,
} from "./preferences";
import {
  listAnimations,
  resolveAnimation,
  resolveAnimationParams,
  type MediaKind,
  type OpeningAnimation,
} from "./registry";
import { removeCriticalStyles } from "./styles";
import { getTransition } from "./transitions";

export type OpeningError = "storage" | "invalid-file" | "unsupported-codec" | "mutation";

export interface MediaSummary {
  id: string;
  name: string;
  type: string;
  kind: MediaKind;
  createdAt: number;
  /** Long-lived object URL for settings thumbnails; owned by the controller. */
  url: string;
}

export interface OpeningSnapshot {
  ready: boolean;
  enabled: boolean;
  media: ReadonlyArray<MediaSummary>;
  activeId?: string;
  activeKind?: MediaKind;
  animationByKind: { image: string; video: string };
  transitionId: string;
  transitionScale: number;
  maxDurationMs: number;
  showSkipHint: boolean;
  skinHandoff: boolean;
  paramOverrides: Readonly<Record<string, Readonly<Record<string, number | string>>>>;
  playing: boolean;
  error?: OpeningError;
}

const MAX_MEDIA = 8;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_BYTES = 256 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/x-matroska"]);
const SKIN_DB_NAME = "dsh-custom-skin";
const SKIN_STORE = "wallpapers";
const SKIN_MAX_IMAGES = 24;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const kindOfType = (type: string): MediaKind => (VIDEO_TYPES.has(type) ? "video" : "image");

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
        this.playOnce();
      }
    } catch (err) {
      console.warn("[dsh-opening-animation] local media storage unavailable", err);
      this.teardownPending();
      this.publish({ ...this.snapshot, ready: true, error: "storage" });
    }
  }

  /** Add files to the local library after type/size/codec validation. */
  async addFiles(files: File[]): Promise<void> {
    const accepted: Array<{ file: File; kind: MediaKind }> = [];
    let invalid = false;
    let codecBlocked = false;
    for (const file of files) {
      if (IMAGE_TYPES.has(file.type) && file.size > 0 && file.size <= MAX_IMAGE_BYTES) {
        accepted.push({ file, kind: "image" });
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
      const capacity = Math.max(0, MAX_MEDIA - this.snapshot.media.length);
      const batch = accepted.slice(0, capacity);
      if (batch.length === 0) {
        this.publish({ ...this.snapshot, error: "invalid-file" });
        return;
      }
      const records: MediaRecord[] = batch.map(({ file }, index) => ({
        id: makeId(),
        name: file.name,
        type: file.type,
        blob: file,
        createdAt: Date.now() + index,
      }));
      const transaction = this.database.transaction(STORE, "readwrite");
      for (const record of records) transaction.objectStore(STORE).put(record);
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
      for (const url of this.objectUrls.values()) URL.revokeObjectURL(url);
      this.objectUrls.clear();
      this.publish({ ...this.snapshot, media: [], activeId: undefined, error: undefined });
      this.persist();
    }, "mutation");
  }

  select(id: string): void {
    if (!this.snapshot.media.some((item) => item.id === id)) return;
    this.update({ activeId: id, error: undefined });
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
      transitionId: defaults.transitionId,
      transitionScale: defaults.transitionScale,
      maxDurationMs: defaults.maxDurationMs,
      showSkipHint: defaults.showSkipHint,
      skinHandoff: defaults.skinHandoff,
      paramOverrides: defaults.paramOverrides,
      error: undefined,
    });
    this.persist();
  }

  /** Replay the current configuration immediately (independent of the once-per-document guard). */
  preview(): void {
    if (this.disposed || this.activeRunner !== undefined) return;
    if (this.snapshot.activeId === undefined) return;
    this.playOnce();
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

  private playOnce(): void {
    if (this.disposed || this.activeRunner !== undefined) return;
    const snapshot = this.snapshot;
    const activeId = snapshot.activeId;
    if (activeId === undefined) {
      this.teardownPending();
      return;
    }
    const record = this.records.get(activeId);
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
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
    this.publish({ ...this.snapshot, ...patch });
    this.persist();
  }

  private enqueue(operation: () => Promise<void>, error: OpeningError): Promise<void> {
    this.queue = this.queue
      .catch(() => {})
      .then(async () => {
        if (this.disposed) return;
        try {
          await operation();
        } catch (err) {
          console.warn("[dsh-opening-animation] media mutation failed", err);
          this.publish({ ...this.snapshot, error });
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
