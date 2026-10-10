// The browser tsconfig carries no Node types; this import only runs under vitest.
// @ts-expect-error node:buffer has no type declarations in this project
import { Blob as NodeBlob } from "node:buffer";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpeningController } from "../src/client/controller";
import { openDatabase, putRecord, DB_NAME } from "../src/client/media-store";
import { DEFAULT_PREFERENCES, PREFS_KEY, parsePreferences } from "../src/client/preferences";

const SKIN_DB = "dsh-custom-skin";
const SKIN_STORE = "wallpapers";

function makeController(): OpeningController {
  return new ControllerForPrefs({ ...DEFAULT_PREFERENCES, activeId: undefined });
}

// Alias keeps the autoplay test's dynamic import distinct from this binding.
const ControllerForPrefs = OpeningController;

function imageFile(name = "a.png"): File {
  return new File([new Blob(["image-bytes"])], name, { type: "image/png" });
}

function videoFile(): File {
  return new File([new Blob(["video-bytes"])], "b.mp4", { type: "video/mp4" });
}

async function seedMedia(id: string): Promise<void> {
  const db = await openDatabase();
  // fake-indexeddb clones blobs with the Node Blob class; a jsdom Blob is not
  // recognized there, so seeded records use the Node-side Blob.
  const blob = new NodeBlob(["x"]) as unknown as Blob;
  await putRecord(db, { id, name: `${id}.png`, type: "image/png", blob, createdAt: 1 });
  db.close();
}

/** The handoff must never create the skin database; give it an existing one. */
async function seedSkinLibrary(): Promise<void> {
  const request = indexedDB.open(SKIN_DB, 1);
  request.onupgradeneeded = () => {
    request.result.createObjectStore(SKIN_STORE, { keyPath: "id" });
  };
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
}

async function openSkinLibrary(): Promise<IDBDatabase> {
  const request = indexedDB.open(SKIN_DB);
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return db;
}

beforeEach(() => {
  localStorage.clear();
  indexedDB = new IDBFactory();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("OpeningController snapshots", () => {
  it("starts unready and disabled with no media", () => {
    const controller = makeController();
    const snap = controller.getSnapshot();
    expect(snap.ready).toBe(false);
    expect(snap.enabled).toBe(false);
    expect(snap.media).toEqual([]);
    expect(snap.playing).toBe(false);
  });

  it("becomes ready after initialize and persists new media", async () => {
    const controller = makeController();
    await controller.initialize();
    expect(controller.getSnapshot().ready).toBe(true);
    await controller.addFiles([imageFile()]);
    const snap = controller.getSnapshot();
    expect(snap.media).toHaveLength(1);
    expect(snap.activeId).toBe(snap.media[0]?.id);
    expect(snap.activeKind).toBe("image");
    const stored = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as { activeId?: string };
    expect(stored.activeId).toBe(snap.activeId);
  });

  it("rejects unsupported files with invalid-file and codec-blocked videos with unsupported-codec", async () => {
    const controller = makeController();
    await controller.initialize();
    await controller.addFiles([new File(["x"], "x.txt", { type: "text/plain" })]);
    expect(controller.getSnapshot().error).toBe("invalid-file");
    // jsdom canPlayType always returns "" → mp4 is rejected as an unsupported codec
    await controller.addFiles([videoFile()]);
    expect(controller.getSnapshot().error).toBe("unsupported-codec");
    expect(controller.getSnapshot().media).toHaveLength(0);
  });

  it("removes media, clears the active selection, and wipes the library on clear", async () => {
    const controller = makeController();
    await controller.initialize();
    await controller.addFiles([imageFile("one.png"), imageFile("two.png")]);
    const first = controller.getSnapshot().media[0]?.id as string;
    controller.select(first);
    expect(controller.getSnapshot().activeId).toBe(first);
    await controller.remove(first);
    expect(controller.getSnapshot().media).toHaveLength(1);
    expect(controller.getSnapshot().activeId).toBeUndefined();
    await controller.clear();
    expect(controller.getSnapshot().media).toHaveLength(0);
  });

  it("validates and clamps configuration updates", async () => {
    const controller = makeController();
    await controller.initialize();
    controller.setAnimation("image", "not-registered");
    expect(controller.getSnapshot().animationByKind.image).toBe("tap-reveal");
    controller.setTransition("not-a-transition");
    expect(controller.getSnapshot().transitionId).toBe("cross-fade");
    controller.setTransition("zoom-fade");
    expect(controller.getSnapshot().transitionId).toBe("zoom-fade");
    controller.setTransitionScale(99);
    expect(controller.getSnapshot().transitionScale).toBe(2);
    controller.setMaxDuration(1);
    expect(controller.getSnapshot().maxDurationMs).toBe(3000);
    controller.setParam("pool", "durationMs", 8000);
    expect(controller.getSnapshot().paramOverrides["pool"]?.durationMs).toBe(8000);
  });

  it("reports a storage error and un-pends when IndexedDB is unavailable", async () => {
    document.documentElement.dataset.dshOpeningPending = "1";
    const controller = makeController();
    const indexedDb = globalThis.indexedDB;
    // @ts-expect-error simulate a privacy-mode browser without IndexedDB
    delete globalThis.indexedDB;
    try {
      await controller.initialize();
      expect(controller.getSnapshot().error).toBe("storage");
      expect(controller.getSnapshot().ready).toBe(true);
      expect(document.documentElement.dataset.dshOpeningPending).toBeUndefined();
    } finally {
      globalThis.indexedDB = indexedDb;
    }
  });
});

describe("playback pipeline (jsdom fail-open watchdog)", () => {
  it("mounts the overlay on preview and tears it down at the load watchdog", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {}); // jsdom canvas not implemented
    const controller = makeController();
    await controller.initialize();
    await controller.addFiles([imageFile()]);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    controller.preview();
    expect(controller.getSnapshot().playing).toBe(true);
    expect(document.querySelector(".dsh-opening-root")).not.toBeNull();
    expect(document.body.dataset.dshOpening).toBe("active");

    await vi.advanceTimersByTimeAsync(8100); // load watchdog fires (image never loads in jsdom)
    await vi.advanceTimersByTimeAsync(1600); // transition exit+enter+buffer
    expect(document.querySelector(".dsh-opening-root")).toBeNull();
    expect(document.body.dataset.dshOpening).toBeUndefined();
    expect(document.documentElement.dataset.dshOpeningPending).toBeUndefined();
    expect(controller.getSnapshot().playing).toBe(false);
    expect(warn).toHaveBeenCalled();
  });

  it("skips through a click and cleans up without a trace", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const controller = makeController();
    await controller.initialize();
    await controller.addFiles([imageFile()]);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    controller.preview();
    const root = document.querySelector(".dsh-opening-root") as HTMLElement;
    root.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(1700);
    expect(document.querySelector(".dsh-opening-root")).toBeNull();
    expect(document.querySelector("style[data-plugin='dsh-opening-animation']")).toBeNull();
    expect(controller.getSnapshot().playing).toBe(false);
  });

  it("ignores preview while a run is already in flight", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const controller = makeController();
    await controller.initialize();
    await controller.addFiles([imageFile()]);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    controller.preview();
    const first = document.querySelector(".dsh-opening-root");
    controller.preview();
    expect(document.querySelector(".dsh-opening-root")).toBe(first);
    await vi.advanceTimersByTimeAsync(9800);
  });
});

describe("once-per-document autoplay", () => {
  it("auto-plays for enabled prefs on the first controller only", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    await seedMedia("m1");
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ ...DEFAULT_PREFERENCES, enabled: true, activeId: "m1" }),
    );
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.resetModules();
    const { OpeningController: Fresh } = await import("../src/client/controller");
    const first = new Fresh(parsePreferences());
    await first.initialize();
    await vi.advanceTimersByTimeAsync(10);
    expect(document.querySelector(".dsh-opening-root")).not.toBeNull();
    first.dispose();
    await vi.advanceTimersByTimeAsync(10);

    const second = new Fresh(parsePreferences());
    await second.initialize();
    await vi.advanceTimersByTimeAsync(10);
    expect(document.querySelector(".dsh-opening-root")).toBeNull();
    second.dispose();
  });
});

describe("skin handoff (ADR-006)", () => {
  it("copies uploaded images into the skin library when enabled", async () => {
    await seedSkinLibrary();
    const controller = makeController();
    await controller.initialize();
    controller.setSkinHandoff(true);
    await controller.addFiles([imageFile("handoff.png")]);
    // The handoff is fire-and-forget; wait until the copy lands.
    await vi.waitFor(async () => {
      const db = await openSkinLibrary();
      const count = await new Promise<number>((resolve, reject) => {
        const request = db.transaction(SKIN_STORE, "readonly").objectStore(SKIN_STORE).count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      expect(count).toBe(1);
    });
    const db = await openSkinLibrary();
    const records = await new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
      const request = db.transaction(SKIN_STORE, "readonly").objectStore(SKIN_STORE).getAll();
      request.onsuccess = () => resolve(request.result as Array<Record<string, unknown>>);
      request.onerror = () => reject(request.error);
    });
    db.close();
    expect(records[0]?.name).toBe("handoff.png");
  });

  it("leaves the skin library untouched when disabled", async () => {
    await seedSkinLibrary();
    const controller = makeController();
    await controller.initialize();
    await controller.addFiles([imageFile("nohand.png")]);
    const db = await openSkinLibrary();
    const count = await new Promise<number>((resolve, reject) => {
      const request = db.transaction(SKIN_STORE, "readonly").objectStore(SKIN_STORE).count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    expect(count).toBe(0);
  });

  it("never creates the skin database when it is missing", async () => {
    const controller = makeController();
    await controller.initialize();
    controller.setSkinHandoff(true);
    await controller.addFiles([imageFile("missing.png")]);
    const databases = await indexedDB.databases();
    expect(databases.map((info) => info.name)).not.toContain(SKIN_DB);
    expect(databases.map((info) => info.name)).toContain(DB_NAME);
  });
});
