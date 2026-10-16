// Tests for the early fullscreen cover: it hides the host splash and the app's
// first frame between bundle evaluation and the opening overlay mount. The
// factory body itself is not unit-tested — each test calls
// installEarlyCover/removeEarlyCover directly to simulate what
// src/client/index.ts does synchronously when the host evaluates the bundle.
// The browser tsconfig carries no Node types; this import only runs under vitest.
// @ts-expect-error node:buffer has no type declarations in this project
import { Blob as NodeBlob } from "node:buffer";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpeningController } from "../src/client/controller";
import { openDatabase, putRecord } from "../src/client/media-store";
import { OverlayRunner } from "../src/client/overlay";
import { DEFAULT_PREFERENCES, PREFS_KEY, parsePreferences } from "../src/client/preferences";
import { installEarlyCover, removeEarlyCover } from "../src/client/styles";
import { apply, EARLY_SCRIPT, type EarlyInjectionRow } from "../src/index";

beforeEach(() => {
  localStorage.clear();
  indexedDB = new IDBFactory();
  document.body.innerHTML = "";
  delete document.documentElement.dataset.dshOpeningPending;
});

afterEach(() => {
  removeEarlyCover();
  // The host-injected early style tags live in the head, which no test's
  // body-level cleanup touches; drop leftovers so later tests start clean.
  document.querySelectorAll("style[data-dsh-opening-early='1']").forEach((tag) => tag.remove());
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** Execute the injected head script the way the browser parser would: a plain
 * function body over the jsdom globals. */
function runEarlyScript(): void {
  new Function(EARLY_SCRIPT)();
}

async function seedMedia(id: string): Promise<void> {
  const db = await openDatabase();
  // fake-indexeddb clones blobs with the Node Blob class; a jsdom Blob is not
  // recognized there, so seeded records use the Node-side Blob.
  const blob = new NodeBlob(["x"]) as unknown as Blob;
  await putRecord(db, { id, name: id, type: "image/png", blob, createdAt: 1 });
  db.close();
}

describe("early cover element", () => {
  it("installs exactly one fullscreen cover and is idempotent", () => {
    installEarlyCover();
    installEarlyCover();
    const covers = document.querySelectorAll(".dsh-opening-early");
    expect(covers).toHaveLength(1);
    const cover = covers[0] as HTMLElement;
    expect(cover.parentElement).toBe(document.body);
    expect(cover.style.position).toBe("fixed");
    // CSSOM normalizes the unitless 0 to a length (same in real browsers).
    expect(cover.style.inset).toBe("0px");
    expect(cover.style.zIndex).toBe("2147483646");
    expect(cover.style.backgroundColor).toBe("rgb(4, 5, 14)");
  });

  it("removeEarlyCover is idempotent and clears the fail-safe timer", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    removeEarlyCover(); // no cover installed: must not throw
    installEarlyCover();
    removeEarlyCover();
    removeEarlyCover();
    expect(document.querySelector(".dsh-opening-early")).toBeNull();
    expect(vi.getTimerCount()).toBe(0); // the fail-safe timer did not survive
    await vi.advanceTimersByTimeAsync(4000); // nothing throws or re-appears
    expect(document.querySelector(".dsh-opening-early")).toBeNull();
  });

  it("force-removes the cover after the 4s fail-safe", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    installEarlyCover();
    expect(document.querySelector(".dsh-opening-early")).not.toBeNull();
    expect(vi.getTimerCount()).toBe(1); // exactly the fail-safe timer
    await vi.advanceTimersByTimeAsync(3999);
    expect(document.querySelector(".dsh-opening-early")).not.toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(document.querySelector(".dsh-opening-early")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("early cover lifecycle (controller load endpoints)", () => {
  it("removes the cover and un-pends when the active id is not in the library", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await seedMedia("m1");
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ ...DEFAULT_PREFERENCES, enabled: true, activeId: "ghost" }),
    );
    // Fresh module graph: the once-per-document guard is module-level and this
    // endpoint only runs while playback is still possible. The cover must be
    // installed through the same fresh styles instance the controller uses,
    // or its teardown could not lift the element.
    vi.resetModules();
    const [{ OpeningController: Fresh }, { installEarlyCover: install }] = await Promise.all([
      import("../src/client/controller"),
      import("../src/client/styles"),
    ]);
    install();
    document.documentElement.dataset.dshOpeningPending = "1";
    expect(document.querySelector(".dsh-opening-early")).not.toBeNull();
    const controller = new Fresh(parsePreferences());
    await controller.initialize();
    expect(controller.getSnapshot().activeId).toBeUndefined(); // stale id dropped
    expect(controller.getSnapshot().error).toBeUndefined();
    expect(controller.getSnapshot().playing).toBe(false);
    expect(document.documentElement.dataset.dshOpeningPending).toBeUndefined();
    expect(document.querySelector(".dsh-opening-early")).toBeNull();
    controller.dispose();
  });

  it("lifts the cover 50ms after the overlay mounts on the playback path", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await seedMedia("m1");
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ ...DEFAULT_PREFERENCES, enabled: true, activeId: "m1" }),
    );
    // jsdom cannot paint a frame; the watchdog suite mocks mount the same way.
    vi.spyOn(OverlayRunner.prototype, "mount").mockImplementation(() => {});
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    installEarlyCover(); // what the factory body does at bundle evaluation
    expect(document.querySelector(".dsh-opening-early")).not.toBeNull();
    const controller = new OpeningController(parsePreferences());
    await controller.initialize();
    expect(controller.getSnapshot().playing).toBe(true); // mount() succeeded
    await vi.advanceTimersByTimeAsync(49); // still held before the lift fires
    expect(document.querySelector(".dsh-opening-early")).not.toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(document.querySelector(".dsh-opening-early")).toBeNull();
    controller.dispose();
  });

  it("removes the cover on the no-playback storage-error path", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    document.documentElement.dataset.dshOpeningPending = "1";
    installEarlyCover();
    expect(document.querySelector(".dsh-opening-early")).not.toBeNull();
    const indexedDb = globalThis.indexedDB;
    // @ts-expect-error simulate a privacy-mode browser without IndexedDB
    delete globalThis.indexedDB;
    try {
      const controller = new OpeningController(parsePreferences());
      await controller.initialize();
      expect(controller.getSnapshot().error).toBe("storage");
      expect(document.documentElement.dataset.dshOpeningPending).toBeUndefined();
      expect(document.querySelector(".dsh-opening-early")).toBeNull();
    } finally {
      globalThis.indexedDB = indexedDb;
    }
  });
});

// The host-side index-inject row: its inline head script must cover the
// official splash from the HTML parsing stage, and the client-side teardown
// (removeCriticalStyles) must remove the tags it installs.

describe("early head script (host webserver/index-inject)", () => {
  it("EARLY_SCRIPT text: prefs key, judgment fields, early marker, rules, no script terminator", () => {
    expect(EARLY_SCRIPT).toContain(PREFS_KEY);
    expect(EARLY_SCRIPT).toContain("enabled");
    expect(EARLY_SCRIPT).toContain("activeId");
    expect(EARLY_SCRIPT).toContain("data-dsh-opening-early");
    expect(EARLY_SCRIPT).toContain("html[data-dsh-opening-pending='1'] #root");
    expect(EARLY_SCRIPT).toContain("background:#04050e");
    // A webserver script row must not contain the element-terminating sequence.
    expect(EARLY_SCRIPT.indexOf("</script")).toBe(-1);
  });

  it("apply registers a listener that pushes one head script row per emit", () => {
    const registered: Array<{
      event: string;
      listener: (table: EarlyInjectionRow[]) => unknown;
    }> = [];
    const ctx = {
      on: (event: string, listener: (table: EarlyInjectionRow[]) => unknown): unknown => {
        registered.push({ event, listener });
        return undefined;
      },
    };
    apply(ctx);
    expect(registered).toHaveLength(1);
    expect(registered[0]?.event).toBe("webserver/index-inject");
    const listener = registered[0]?.listener;
    expect(listener).toBeTypeOf("function");
    const table: EarlyInjectionRow[] = [];
    listener?.(table);
    expect(table).toEqual([{ kind: "script", placement: "head", text: EARLY_SCRIPT }]);
    expect(table[0]?.text).toContain(PREFS_KEY);
    // The table is fresh on every render: a second emit pushes the row again.
    const second: EarlyInjectionRow[] = [];
    listener?.(second);
    expect(second).toEqual([{ kind: "script", placement: "head", text: EARLY_SCRIPT }]);
  });

  it("running EARLY_SCRIPT pends the document once and installs exactly one early style", () => {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ ...DEFAULT_PREFERENCES, enabled: true, activeId: "m1" }),
    );
    runEarlyScript();
    runEarlyScript(); // idempotent: the tagged style is not duplicated
    expect(document.documentElement.dataset.dshOpeningPending).toBe("1");
    const styles = document.querySelectorAll("style[data-dsh-opening-early='1']");
    expect(styles).toHaveLength(1);
    expect(styles[0]?.textContent).toContain("html[data-dsh-opening-pending='1'] #root");
    expect(styles[0]?.textContent).toContain("background:#04050e");
  });

  it("running EARLY_SCRIPT without playable preferences leaves the document untouched", () => {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ ...DEFAULT_PREFERENCES, enabled: false, activeId: "m1" }),
    );
    runEarlyScript();
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ ...DEFAULT_PREFERENCES, enabled: true, activeId: "" }),
    );
    runEarlyScript();
    expect(document.documentElement.dataset.dshOpeningPending).toBeUndefined();
    expect(document.querySelectorAll("style[data-dsh-opening-early='1']")).toHaveLength(0);
  });
});

describe("host-injected early state teardown (controller endpoints)", () => {
  it("clears the host-injected pending state and early styles on the no-playback path", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await seedMedia("m1");
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ ...DEFAULT_PREFERENCES, enabled: true, activeId: "ghost" }),
    );
    // Fresh module graph: the once-per-document guard is module-level, and the
    // cover must be installed through the same fresh styles instance the
    // controller uses, or its teardown could not lift the element.
    vi.resetModules();
    const [{ OpeningController: Fresh }, { installEarlyCover: install }] = await Promise.all([
      import("../src/client/controller"),
      import("../src/client/styles"),
    ]);
    install();
    runEarlyScript(); // what the host head script did at parse time
    expect(document.documentElement.dataset.dshOpeningPending).toBe("1");
    expect(document.querySelectorAll("style[data-dsh-opening-early='1']")).toHaveLength(1);
    const controller = new Fresh(parsePreferences());
    await controller.initialize();
    expect(document.documentElement.dataset.dshOpeningPending).toBeUndefined();
    expect(document.querySelectorAll("style[data-dsh-opening-early='1']")).toHaveLength(0);
    controller.dispose();
  });

  it("clears the host-injected pending state and early styles on the playback path hand-back", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await seedMedia("m1");
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ ...DEFAULT_PREFERENCES, enabled: true, activeId: "m1" }),
    );
    // Fresh module graph for the once-per-document guard; jsdom cannot paint a
    // frame, so mount is mocked the same way the watchdog suite mocks it.
    vi.resetModules();
    const [{ OpeningController: Fresh }, { OverlayRunner: FreshRunner }, { installEarlyCover: install }] =
      await Promise.all([
        import("../src/client/controller"),
        import("../src/client/overlay"),
        import("../src/client/styles"),
      ]);
    vi.spyOn(FreshRunner.prototype, "mount").mockImplementation(() => {});
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    install();
    runEarlyScript();
    expect(document.documentElement.dataset.dshOpeningPending).toBe("1");
    expect(document.querySelectorAll("style[data-dsh-opening-early='1']")).toHaveLength(1);
    const controller = new Fresh(parsePreferences());
    await controller.initialize();
    expect(controller.getSnapshot().playing).toBe(true);
    // Hand-back: dispose aborts the overlay runner, whose teardown un-pends
    // the document and removes every early style tag, host-included.
    controller.dispose();
    expect(document.documentElement.dataset.dshOpeningPending).toBeUndefined();
    expect(document.querySelectorAll("style[data-dsh-opening-early='1']")).toHaveLength(0);
  });

  it("clears cover, pending, and host early styles when the overlay mount throws", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await seedMedia("m1");
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ ...DEFAULT_PREFERENCES, enabled: true, activeId: "m1" }),
    );
    // Fresh module graph for the once-per-document guard; a throwing mount
    // exercises the playOnce catch branch: removeEarlyCover plus
    // runner.abort(), whose teardown must also un-pend and lift the
    // host-injected early styles.
    vi.resetModules();
    const [{ OpeningController: Fresh }, { OverlayRunner: FreshRunner }, { installEarlyCover: install }] =
      await Promise.all([
        import("../src/client/controller"),
        import("../src/client/overlay"),
        import("../src/client/styles"),
      ]);
    vi.spyOn(FreshRunner.prototype, "mount").mockImplementation(() => {
      throw new Error("mount failed");
    });
    install();
    runEarlyScript();
    expect(document.querySelector(".dsh-opening-early")).not.toBeNull();
    expect(document.documentElement.dataset.dshOpeningPending).toBe("1");
    expect(document.querySelectorAll("style[data-dsh-opening-early='1']")).toHaveLength(1);
    const controller = new Fresh(parsePreferences());
    await controller.initialize();
    expect(controller.getSnapshot().playing).toBe(false); // onDone fired via abort
    expect(document.querySelector(".dsh-opening-early")).toBeNull();
    expect(document.documentElement.dataset.dshOpeningPending).toBeUndefined();
    expect(document.querySelectorAll("style[data-dsh-opening-early='1']")).toHaveLength(0);
    controller.dispose();
  });
});
