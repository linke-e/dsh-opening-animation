// The browser tsconfig carries no Node types; this import only runs under vitest.
// @ts-expect-error node:buffer has no type declarations in this project
import { Blob as NodeBlob } from "node:buffer";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpeningController } from "../src/client/controller";
import { openDatabase, putRecord, DB_NAME } from "../src/client/media-store";
import {
  CURSOR_KEY,
  DEFAULT_PREFERENCES,
  PREFS_KEY,
  parsePreferences,
  readLastPlayedImageId,
  writeLastPlayedImageId,
  type ImagePlaybackOrder,
} from "../src/client/preferences";

// jsdom never fires Image load/error, so decode probing is mocked for every
// controller test; files named "broken-*" take the undecodable path.
vi.mock("../src/client/media-probe", () => ({
  isImportableImage: async (file: File) => !file.name.startsWith("broken-"),
  MAX_IMAGE_PIXELS: 32_000_000,
}));

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

/** Seed one record with an explicit type/createdAt; the record name equals the
 * id so overlay-mount spies can assert which media actually played. */
async function seedRecord(id: string, type: string, createdAt: number): Promise<void> {
  const db = await openDatabase();
  const blob = new NodeBlob(["x"]) as unknown as Blob;
  await putRecord(db, { id, name: id, type, blob, createdAt });
  db.close();
}

/** A controller from a fresh module graph (resets the module-level
 * once-per-document guard) plus the names of the media its startup playback
 * actually mounted, captured by spying on OverlayRunner#mount. */
async function freshControllerWithMounts(): Promise<{
  Controller: typeof OpeningController;
  played: string[];
}> {
  vi.resetModules();
  const [{ OpeningController: Fresh }, { OverlayRunner: Runner }] = await Promise.all([
    import("../src/client/controller"),
    import("../src/client/overlay"),
  ]);
  const played: string[] = [];
  vi.spyOn(Runner.prototype, "mount").mockImplementation(function (this: InstanceType<typeof Runner>) {
    const opts = Reflect.get(this, "opts") as { media: { name: string } };
    played.push(opts.media.name);
  });
  return { Controller: Fresh, played };
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

  it("rejects undecodable images as invalid files", async () => {
    const controller = makeController();
    await controller.initialize();
    await controller.addFiles([imageFile("broken-cut.png")]);
    expect(controller.getSnapshot().error).toBe("invalid-file");
    expect(controller.getSnapshot().media).toHaveLength(0);
  });

  it("reports capacity when the library is full and a summary when the cap cuts a batch", async () => {
    const controller = makeController();
    await controller.initialize();
    await controller.addFiles(Array.from({ length: 8 }, (_, index) => imageFile(`full-${index}.png`)));
    expect(controller.getSnapshot().media).toHaveLength(8);
    await controller.addFiles([imageFile("extra.png")]);
    expect(controller.getSnapshot().error).toBe("capacity");
    expect(controller.getSnapshot().media).toHaveLength(8);
    expect(controller.getSnapshot().importSummary).toBeUndefined();
    const dropped = controller.getSnapshot().media[0]?.id as string;
    await controller.remove(dropped);
    await controller.addFiles([imageFile("e1.png"), imageFile("e2.png"), imageFile("e3.png")]);
    const snap = controller.getSnapshot();
    expect(snap.media).toHaveLength(8);
    expect(snap.error).toBeUndefined();
    expect(snap.importSummary).toEqual({ imported: 1, skipped: 2 });
  });

  it("reports quota when a write aborts with QuotaExceededError", async () => {
    const controller = makeController();
    await controller.initialize();
    const quota = Object.assign(new Error("storage full"), { name: "QuotaExceededError" });
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => {
      throw quota;
    });
    await controller.addFiles([imageFile("q.png")]);
    expect(controller.getSnapshot().error).toBe("quota");
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

describe("startup playback order", () => {
  function prefsFor(activeId: string, imageOrder: ImagePlaybackOrder): string {
    return JSON.stringify({ ...DEFAULT_PREFERENCES, enabled: true, activeId, imageOrder });
  }

  it("advances through the image list in sequence and wraps around", async () => {
    await seedRecord("img-a", "image/png", 1);
    await seedRecord("img-b", "image/png", 2); // createdAt desc → grid order: img-b, img-a
    localStorage.setItem(PREFS_KEY, prefsFor("img-a", "sequence"));

    let { Controller, played } = await freshControllerWithMounts();
    let controller = new Controller(parsePreferences());
    await controller.initialize();
    expect(played).toEqual(["img-a"]); // no cursor yet → starts from the selection
    expect(readLastPlayedImageId()).toBe("img-a");
    controller.dispose();

    ({ Controller, played } = await freshControllerWithMounts());
    controller = new Controller(parsePreferences());
    await controller.initialize();
    expect(played).toEqual(["img-b"]); // cursor img-a → next in the list
    expect(readLastPlayedImageId()).toBe("img-b");
    controller.dispose();

    ({ Controller, played } = await freshControllerWithMounts());
    controller = new Controller(parsePreferences());
    await controller.initialize();
    expect(played).toEqual(["img-a"]); // wraps around to the first
    controller.dispose();
  });

  it("falls back to the selection when the sequence cursor is invalid", async () => {
    await seedRecord("img-a", "image/png", 1);
    await seedRecord("img-b", "image/png", 2);
    localStorage.setItem(PREFS_KEY, prefsFor("img-b", "sequence"));
    localStorage.setItem(CURSOR_KEY, JSON.stringify("removed-id"));
    const { Controller, played } = await freshControllerWithMounts();
    const controller = new Controller(parsePreferences());
    await controller.initialize();
    expect(played).toEqual(["img-b"]);
    expect(readLastPlayedImageId()).toBe("img-b");
    controller.dispose();
  });

  it("never repeats the previous image under shuffle when there is more than one", async () => {
    await seedRecord("img-a", "image/png", 1);
    await seedRecord("img-b", "image/png", 2);
    localStorage.setItem(PREFS_KEY, prefsFor("img-a", "shuffle"));
    localStorage.setItem(CURSOR_KEY, JSON.stringify("img-a"));
    const { Controller, played } = await freshControllerWithMounts();
    const controller = new Controller(parsePreferences());
    await controller.initialize();
    expect(played).toEqual(["img-b"]); // the pool excluded the previous img-a
    expect(readLastPlayedImageId()).toBe("img-b");
    controller.dispose();
  });

  it("keeps videos on the selection and never writes the cursor", async () => {
    // jsdom canPlayType always returns "" → seed the record instead of addFiles
    await seedRecord("vid", "video/mp4", 1);
    localStorage.setItem(PREFS_KEY, prefsFor("vid", "sequence"));
    const { Controller, played } = await freshControllerWithMounts();
    const controller = new Controller(parsePreferences());
    await controller.initialize();
    expect(played).toEqual(["vid"]);
    expect(readLastPlayedImageId()).toBeUndefined();
    controller.dispose();
  });

  it("preview plays the selection and leaves the cursor untouched", async () => {
    await seedRecord("img-a", "image/png", 1);
    await seedRecord("img-b", "image/png", 2);
    // enabled stays off so initialize() does not consume the startup playback
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ ...DEFAULT_PREFERENCES, enabled: false, activeId: "img-a", imageOrder: "sequence" }),
    );
    localStorage.setItem(CURSOR_KEY, JSON.stringify("img-b"));
    const { Controller, played } = await freshControllerWithMounts();
    const controller = new Controller(parsePreferences());
    await controller.initialize();
    controller.preview();
    expect(played).toEqual(["img-a"]); // preview ignores the rotation
    expect(readLastPlayedImageId()).toBe("img-b");
    controller.dispose();
  });

  it("clears the cursor when the selection changes", async () => {
    await seedRecord("img-a", "image/png", 1);
    await seedRecord("img-b", "image/png", 2);
    const controller = makeController();
    await controller.initialize();
    writeLastPlayedImageId("img-b");
    controller.select("img-a");
    expect(controller.getSnapshot().activeId).toBe("img-a");
    expect(readLastPlayedImageId()).toBeUndefined();
  });

  it("clears the cursor when the order changes and rejects unknown orders", async () => {
    const controller = makeController();
    await controller.initialize();
    writeLastPlayedImageId("img-a");
    controller.setImageOrder("sequence");
    expect(controller.getSnapshot().imageOrder).toBe("sequence");
    expect(readLastPlayedImageId()).toBeUndefined();
    writeLastPlayedImageId("img-a");
    controller.setImageOrder("chaos" as ImagePlaybackOrder);
    expect(controller.getSnapshot().imageOrder).toBe("sequence"); // unchanged
    expect(readLastPlayedImageId()).toBe("img-a"); // rejected orders keep the cursor
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
