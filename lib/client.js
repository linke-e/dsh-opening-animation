window.__ModuleLoader__.load({ id: "dsh-opening-animation", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/media-store.ts
var DB_NAME = "dsh-opening-animation";
var DB_VERSION = 1;
var STORE = "media";
function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}
function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
  });
}
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
}
async function getAllRecords(database) {
  const transaction = database.transaction(STORE, "readonly");
  return requestResult(transaction.objectStore(STORE).getAll());
}
function makeId() {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// src/client/styles.ts
var CRITICAL_STYLES = String.raw`
html[data-dsh-opening-pending='1'] #root { opacity: 0; }
`;
var GLOBAL_STYLES = String.raw`
.dsh-opening-root {
  position: fixed;
  inset: 0;
  z-index: 2147483645;
  background: var(--dsh-opening-bg, #04050e);
  opacity: 1;
}
.dsh-opening-root.dsh-opening-exit-cross-fade {
  transition: opacity var(--dsh-opening-exit-ms, 700ms) ease;
  opacity: 0;
}
.dsh-opening-root.dsh-opening-exit-dip-to-bg {
  transition: opacity var(--dsh-opening-exit-ms, 450ms) ease;
  opacity: 0;
}
.dsh-opening-root.dsh-opening-exit-zoom-fade {
  transition: opacity var(--dsh-opening-exit-ms, 650ms) ease, transform var(--dsh-opening-exit-ms, 650ms) ease;
  opacity: 0;
  transform: scale(1.04);
}

.dsh-opening-stage,
.dsh-opening-stage canvas,
.dsh-opening-stage video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.dsh-opening-crt {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
  background: repeating-linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0) 0px,
    rgba(0, 0, 0, 0) 2px,
    rgba(0, 0, 0, .18) 3px
  );
}
.dsh-opening-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 4;
  background: radial-gradient(ellipse at center, transparent 55%, rgba(0, 0, 12, .5) 100%);
}

.dsh-opening-skip {
  position: fixed;
  right: 18px;
  bottom: 14px;
  z-index: 5;
  color: rgba(150, 185, 255, .85);
  font: 12px/1.6 system-ui, sans-serif;
  letter-spacing: .14em;
  opacity: 0;
  transition: opacity 1.2s;
  pointer-events: none;
}
.dsh-opening-skip.dsh-opening-skip-show { opacity: 1; }

/* ---- wipe-reveal engine: dominant-color backdrop; the clipping container is
   pinned at the scaled picture's left edge and wipes across its full extent,
   then lands it (left → 0, width/scale → normal) as the full-screen backdrop ---- */
.dsh-opening-wipe {
  position: absolute;
  inset: 0;
  background: var(--dsh-opening-bg, #04050e);
}
.dsh-opening-wipe-reveal {
  position: absolute;
  top: 0;
  height: 100%;
  overflow: hidden;
  will-change: left, width;
}
.dsh-opening-wipe-img {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  width: 100vw;
  object-fit: cover;
  object-position: center center;
  transform-origin: left center;
  will-change: transform;
}

/* ---- tap-reveal engine: dominant-color backdrop, click-point circle reveal ---- */
.dsh-opening-tap {
  position: absolute;
  inset: 0;
  background: var(--dsh-opening-bg, #04050e);
  cursor: pointer;
}
.dsh-opening-tap-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  clip-path: circle(0px at 50% 50%);
  will-change: clip-path, transform;
}
.dsh-opening-tap-img.dsh-opening-tap-run {
  transition: clip-path var(--dsh-tap-reveal-ms, 900ms) ease, transform var(--dsh-tap-reveal-ms, 900ms) ease;
}
/* Waiting-phase hint pill shared by the tap-reveal and grid-spread engines */
.dsh-opening-hint {
  position: absolute;
  left: 50%;
  top: 50%;
  padding: 8px 18px;
  border-radius: 999px;
  background: rgb(0 0 0 / 0.32);
  color: rgba(255, 255, 255, 0.92);
  font: 13px/1.4 system-ui, sans-serif;
  letter-spacing: 0.18em;
  opacity: 0;
  transition: opacity 600ms ease;
  pointer-events: none;
  animation: dsh-opening-hint-pulse 2.2s ease-in-out infinite;
}
.dsh-opening-hint.dsh-opening-hint-show { opacity: 1; }
/* Fast fade-out once the interaction starts (click reveal / spread). */
.dsh-opening-hint.dsh-opening-hint-hide {
  opacity: 0;
  transition: opacity 150ms ease;
  animation: none;
}
@keyframes dsh-opening-hint-pulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  50% { transform: translate(-50%, -50%) scale(1.06); }
}

body[data-dsh-opening='active'] { overflow: hidden; }

/* ---- settings panel ---- */
.dsh-opening-section {
  display: flex;
  max-width: 760px;
  flex-direction: column;
  gap: 20px;
  color: var(--dsw-alias-label-primary);
}
.dsh-opening-section h2,
.dsh-opening-section p { margin: 0; }
.dsh-opening-section h2 { font-size: 18px; font-weight: 600; }
.dsh-opening-intro,
.dsh-opening-note { color: var(--dsw-alias-label-tertiary); font-size: 13px; line-height: 1.55; }
.dsh-opening-error { color: var(--dsw-alias-state-error-primary); font-size: 13px; }

.dsh-opening-drop {
  display: flex;
  min-height: 96px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 7px;
  padding: 18px;
  border: 1px dashed var(--dsw-alias-border-l3);
  border-radius: 16px;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-3) 70%, transparent);
  cursor: pointer;
  text-align: center;
}
.dsh-opening-drop:hover,
.dsh-opening-drop[data-dragging='true'] { border-color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-interactive-bg-hover); }
.dsh-opening-drop:focus-within { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
.dsh-opening-drop[data-disabled='true'] { cursor: wait; opacity: 0.65; }
.dsh-opening-drop strong { font-size: 14px; font-weight: 550; }
.dsh-opening-drop input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

.dsh-opening-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}
.dsh-opening-card {
  position: relative;
  overflow: hidden;
  min-width: 0;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 14px;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 75%, transparent);
}
.dsh-opening-card[data-active='true'] { border-color: var(--dsw-alias-brand-primary); box-shadow: 0 0 0 1px var(--dsw-alias-brand-primary); }
.dsh-opening-thumb {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  background: var(--dsw-alias-bg-module-platform);
}
.dsh-opening-card-body { display: flex; align-items: center; gap: 6px; padding: 8px; }
.dsh-opening-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
.dsh-opening-kind-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgb(0 0 0 / 0.62);
  color: white;
  font-size: 11px;
}
.dsh-opening-active-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-label-onbrand, #fff);
  font-size: 11px;
}

.dsh-opening-button {
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  padding: 5px 9px;
  background: var(--dsw-alias-bg-layer-3);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.dsh-opening-button:hover { background: var(--dsw-alias-interactive-bg-hover-solid); }
.dsh-opening-button-danger { color: var(--dsw-alias-state-error-primary); }

.dsh-opening-controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px 24px;
}
.dsh-opening-control { display: flex; min-width: 0; flex-direction: column; gap: 7px; }
.dsh-opening-control-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
}
.dsh-opening-control output { color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums; }
.dsh-opening-control select,
.dsh-opening-control input[type='number'] {
  width: 100%;
  height: 34px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  padding: 0 10px;
  background: var(--dsw-alias-bg-layer-3);
  color: var(--dsw-alias-label-primary);
  font: inherit;
}

.dsh-opening-toggle { display: flex; align-items: center; gap: 10px; }
.dsh-opening-toggle input { width: 18px; height: 18px; accent-color: var(--dsw-alias-brand-primary); }
.dsh-opening-toggle-copy { display: flex; flex-direction: column; gap: 2px; }
.dsh-opening-toggle-copy span { font-size: 13px; }

.dsh-opening-radios { display: flex; flex-direction: column; gap: 8px; }
.dsh-opening-radio {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  cursor: pointer;
}
.dsh-opening-radio:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dsh-opening-radio[data-checked='true'] { border-color: var(--dsw-alias-brand-primary); box-shadow: 0 0 0 1px var(--dsw-alias-brand-primary); }
.dsh-opening-radio input { margin-top: 3px; accent-color: var(--dsw-alias-brand-primary); }
.dsh-opening-radio-copy { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dsh-opening-radio-copy span { font-size: 13px; font-weight: 550; }
.dsh-opening-radio-copy small { color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 1.5; }

.dsh-opening-params { margin: 0; }
.dsh-opening-params summary {
  cursor: pointer;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  user-select: none;
}
.dsh-opening-params-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 0 2px;
}

.dsh-opening-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px solid var(--dsw-alias-border-l2);
}

@media (max-width: 700px) {
  .dsh-opening-controls { grid-template-columns: 1fr; }
  .dsh-opening-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`;
var criticalTag;
function installCriticalStyles() {
  if (criticalTag !== void 0) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-opening-animation";
  tag.textContent = CRITICAL_STYLES;
  document.head.append(tag);
  criticalTag = tag;
}
function removeCriticalStyles() {
  criticalTag?.remove();
  criticalTag = void 0;
}
function installStyles() {
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-opening-animation";
  tag.textContent = GLOBAL_STYLES;
  document.head.append(tag);
  return () => {
    tag.remove();
  };
}

// src/client/overlay.ts
var LOAD_TIMEOUT_MS = 8e3;
var VIDEO_STALL_MS = 1e4;
var VIDEO_CHECK_INTERVAL_MS = 1e3;
var SKIP_HINT_DELAY_MS = 800;
var TRANSITION_BUFFER_MS = 150;
var OverlayRunner = class {
  opts;
  rootEl = null;
  stageEl = null;
  engine = null;
  phase = "idle";
  transitionStarted = false;
  timers = /* @__PURE__ */ new Set();
  loadTimeoutTimer = null;
  capturedRootInline = null;
  videoProgressAt = 0;
  onSkipClick = () => {
    this.requestSkip();
  };
  onKeydown = (event) => {
    if (event.key === "Escape") this.requestSkip();
  };
  onTimeUpdate = () => {
    this.videoProgressAt = Date.now();
  };
  constructor(opts) {
    this.opts = opts;
  }
  mount() {
    if (this.phase !== "idle") return;
    this.phase = "playing";
    const root = document.createElement("div");
    root.className = "dsh-opening-root";
    const bg = this.opts.params.bg;
    root.style.setProperty(
      "--dsh-opening-bg",
      typeof bg === "string" && bg.length > 0 && bg !== "auto" ? bg : "#04050e"
    );
    const stage = document.createElement("div");
    stage.className = "dsh-opening-stage";
    root.append(stage);
    if (this.opts.showSkipHint) {
      const hint = document.createElement("div");
      hint.className = "dsh-opening-skip";
      hint.textContent = this.opts.t("skip.hint");
      root.append(hint);
      this.setTimer(() => hint.classList.add("dsh-opening-skip-show"), SKIP_HINT_DELAY_MS);
    }
    this.rootEl = root;
    this.stageEl = stage;
    document.body.append(root);
    document.body.dataset.dshOpening = "active";
    root.addEventListener("click", this.onSkipClick);
    document.addEventListener("keydown", this.onKeydown);
    this.loadTimeoutTimer = this.setTimer(() => this.fireLoadTimeout(), LOAD_TIMEOUT_MS);
    if (this.opts.media.kind === "image") {
      this.setTimer(() => this.fireMaxDuration(), this.opts.maxDurationMs);
    } else {
      stage.addEventListener("timeupdate", this.onTimeUpdate, true);
      this.setTimer(this.checkVideoStall, VIDEO_CHECK_INTERVAL_MS);
    }
    const runtime = {
      container: stage,
      media: this.opts.media,
      reducedMotion: this.opts.reducedMotion,
      params: this.opts.params,
      t: this.opts.t,
      markLoaded: () => this.markLoaded(),
      complete: () => this.handleComplete(),
      fail: (err) => this.handleFail(err)
    };
    try {
      this.engine = this.opts.animation.create(runtime);
      this.engine.start();
    } catch (err) {
      this.handleFail(err);
    }
  }
  /** Engine-reported media readiness: the load-timeout watchdog is no longer
   * needed, while the max-duration watchdog keeps guarding runaway engines. */
  markLoaded() {
    if (this.loadTimeoutTimer !== null) {
      window.clearTimeout(this.loadTimeoutTimer);
      this.timers.delete(this.loadTimeoutTimer);
      this.loadTimeoutTimer = null;
    }
  }
  /** External skip trigger (click/Esc are bound by the runner itself). */
  skip() {
    this.requestSkip();
  }
  /** Fail-open: remove everything immediately, no transition. */
  abort() {
    this.destroy();
  }
  destroy() {
    if (this.phase === "destroyed") return;
    this.phase = "destroyed";
    this.clearTimers();
    document.removeEventListener("keydown", this.onKeydown);
    this.rootEl?.removeEventListener("click", this.onSkipClick);
    this.stageEl?.removeEventListener("timeupdate", this.onTimeUpdate, true);
    try {
      this.engine?.destroy();
    } catch (err) {
      console.warn("[dsh-opening-animation] engine destroy failed", err);
    }
    this.rootEl?.remove();
    this.rootEl = null;
    this.stageEl = null;
    delete document.body.dataset.dshOpening;
    delete document.documentElement.dataset.dshOpeningPending;
    removeCriticalStyles();
    this.restoreRootInline();
    URL.revokeObjectURL(this.opts.media.url);
    this.opts.onDone();
  }
  requestSkip() {
    if (this.transitionStarted || this.phase === "destroyed") return;
    try {
      this.engine?.skip();
    } catch (err) {
      console.warn("[dsh-opening-animation] engine skip failed", err);
    }
    this.beginTransition();
  }
  handleComplete() {
    if (this.transitionStarted || this.phase === "destroyed") return;
    this.beginTransition();
  }
  handleFail(err) {
    console.warn("[dsh-opening-animation]", err);
    this.abort();
  }
  fireLoadTimeout() {
    if (this.transitionStarted || this.phase === "destroyed") return;
    if (this.opts.media.kind === "video") {
      const video = this.stageEl?.querySelector("video");
      if (video !== void 0 && video !== null && video.readyState >= 2) return;
    }
    console.warn("[dsh-opening-animation] media load timeout, handing the screen back");
    this.beginTransition();
  }
  fireMaxDuration() {
    if (this.transitionStarted || this.phase === "destroyed") return;
    console.warn("[dsh-opening-animation] image max duration reached, handing the screen back");
    this.beginTransition();
  }
  checkVideoStall = () => {
    if (this.transitionStarted || this.phase === "destroyed") return;
    const video = this.stageEl?.querySelector("video");
    if (video !== void 0 && video !== null && video.readyState >= 2 && !video.ended) {
      if (this.videoProgressAt === 0) {
        this.videoProgressAt = Date.now();
      } else if (Date.now() - this.videoProgressAt > VIDEO_STALL_MS) {
        console.warn("[dsh-opening-animation] video stalled without progress, handing the screen back");
        this.beginTransition();
        return;
      }
    }
    this.setTimer(this.checkVideoStall, VIDEO_CHECK_INTERVAL_MS);
  };
  beginTransition() {
    if (this.transitionStarted || this.phase === "destroyed") return;
    this.transitionStarted = true;
    this.phase = "transition";
    this.clearTimers();
    this.stageEl?.removeEventListener("timeupdate", this.onTimeUpdate, true);
    const preset = this.opts.transition;
    const scale = this.opts.reducedMotion ? 0 : this.opts.transitionScale;
    const exitMs = Math.max(1, Math.round(this.opts.reducedMotion ? 250 : preset.exitMs * scale));
    const enterMs = Math.max(1, Math.round(this.opts.reducedMotion ? 250 : preset.enterMs * scale));
    const enterDelay = Math.round(this.opts.reducedMotion ? 0 : preset.enterDelayMs * scale);
    this.rootEl?.style.setProperty("--dsh-opening-exit-ms", `${exitMs}ms`);
    this.rootEl?.classList.add(preset.exitClass);
    this.setTimer(() => this.revealApp(enterMs), enterDelay);
    this.setTimer(() => this.destroy(), exitMs + enterDelay + enterMs + TRANSITION_BUFFER_MS);
  }
  /** Un-pending the app and run the #root enter animation via inline styles. */
  revealApp(enterMs) {
    if (this.phase === "destroyed") return;
    const appRoot = document.getElementById("root");
    const preset = this.opts.transition;
    if (appRoot !== null) {
      this.capturedRootInline = {
        opacity: appRoot.style.opacity,
        transform: appRoot.style.transform,
        transition: appRoot.style.transition
      };
      appRoot.style.transition = "none";
      appRoot.style.opacity = "0";
      if (preset.enterTransform !== void 0) appRoot.style.transform = preset.enterTransform;
    }
    delete document.documentElement.dataset.dshOpeningPending;
    removeCriticalStyles();
    if (appRoot !== null && this.capturedRootInline !== null) {
      void appRoot.offsetHeight;
      appRoot.style.transition = `opacity ${enterMs}ms ease${preset.enterTransform !== void 0 ? `, transform ${enterMs}ms ease` : ""}`;
      appRoot.style.opacity = this.capturedRootInline.opacity;
      appRoot.style.transform = this.capturedRootInline.transform;
    }
  }
  restoreRootInline() {
    const appRoot = document.getElementById("root");
    const captured = this.capturedRootInline;
    this.capturedRootInline = null;
    if (appRoot === null || captured === null) return;
    appRoot.style.opacity = captured.opacity;
    appRoot.style.transform = captured.transform;
    appRoot.style.transition = captured.transition;
  }
  setTimer(fn, ms) {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
    return id;
  }
  clearTimers() {
    for (const id of this.timers) window.clearTimeout(id);
    this.timers.clear();
  }
};

// src/client/preferences.ts
var PREFS_KEY = "dsh.opening-animation.preferences.v1";
var DEFAULT_ANIMATION_BY_KIND = { image: "tap-reveal", video: "video-player" };
var DEFAULT_PREFERENCES = Object.freeze({
  enabled: false,
  activeId: void 0,
  animationByKind: { ...DEFAULT_ANIMATION_BY_KIND },
  transitionId: "cross-fade",
  transitionScale: 1,
  maxDurationMs: 15e3,
  showSkipHint: true,
  paramOverrides: {},
  skinHandoff: false
});
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function isParamValue(value) {
  return typeof value === "number" && Number.isFinite(value) || typeof value === "string";
}
function parseParamOverrides(value) {
  if (typeof value !== "object" || value === null) return {};
  const result = {};
  for (const [animId, entries] of Object.entries(value)) {
    if (typeof entries !== "object" || entries === null) continue;
    const clean = {};
    for (const [key, param] of Object.entries(entries)) {
      if (isParamValue(param)) clean[key] = param;
    }
    if (Object.keys(clean).length > 0) result[animId] = clean;
  }
  return result;
}
function parsePreferences(storage = localStorage) {
  let raw = null;
  try {
    raw = storage.getItem(PREFS_KEY);
  } catch {
    return structuredClonePreferences(DEFAULT_PREFERENCES);
  }
  let value;
  try {
    value = JSON.parse(raw ?? "{}");
  } catch {
    return structuredClonePreferences(DEFAULT_PREFERENCES);
  }
  if (typeof value !== "object" || value === null) return structuredClonePreferences(DEFAULT_PREFERENCES);
  const v = value;
  const rawByKind = typeof v.animationByKind === "object" && v.animationByKind !== null ? v.animationByKind : {};
  const animationByKind = {
    image: typeof rawByKind.image === "string" ? rawByKind.image : DEFAULT_ANIMATION_BY_KIND.image,
    video: typeof rawByKind.video === "string" ? rawByKind.video : DEFAULT_ANIMATION_BY_KIND.video
  };
  const scale = typeof v.transitionScale === "number" && Number.isFinite(v.transitionScale) ? clamp(v.transitionScale, 0.5, 2) : DEFAULT_PREFERENCES.transitionScale;
  const maxDuration = typeof v.maxDurationMs === "number" && Number.isFinite(v.maxDurationMs) ? clamp(v.maxDurationMs, 3e3, 12e4) : DEFAULT_PREFERENCES.maxDurationMs;
  return {
    enabled: typeof v.enabled === "boolean" ? v.enabled : DEFAULT_PREFERENCES.enabled,
    activeId: typeof v.activeId === "string" ? v.activeId : void 0,
    animationByKind,
    transitionId: typeof v.transitionId === "string" ? v.transitionId : DEFAULT_PREFERENCES.transitionId,
    transitionScale: scale,
    maxDurationMs: maxDuration,
    showSkipHint: typeof v.showSkipHint === "boolean" ? v.showSkipHint : DEFAULT_PREFERENCES.showSkipHint,
    paramOverrides: parseParamOverrides(v.paramOverrides),
    skinHandoff: typeof v.skinHandoff === "boolean" ? v.skinHandoff : DEFAULT_PREFERENCES.skinHandoff
  };
}
function structuredClonePreferences(prefs) {
  return {
    enabled: prefs.enabled,
    activeId: prefs.activeId,
    animationByKind: { ...prefs.animationByKind },
    transitionId: prefs.transitionId,
    transitionScale: prefs.transitionScale,
    maxDurationMs: prefs.maxDurationMs,
    showSkipHint: prefs.showSkipHint,
    paramOverrides: Object.fromEntries(Object.entries(prefs.paramOverrides).map(([k, v]) => [k, { ...v }])),
    skinHandoff: prefs.skinHandoff
  };
}

// src/client/animations/pool.ts
var DUST_COUNT = 50;
var GRAIN_FRAMES = 5;
var GRAIN_ALPHA = 0.05;
var CAPTION_IN_MS = 600;
var KARAOKE_AT_MS = 1200;
var KARAOKE_STEP_MAX = 900;
var KARAOKE_STEP_MIN = 300;
var KARAOKE_TAIL_MS = 800;
var PULSE_LEN = 260;
var SIM_CELL = 4;
var WAVE_DAMPING = 0.985;
var SPLASH_RADIUS = 4;
var SPLASH_STRENGTH = 1.2;
var SPLASH_STEP = SPLASH_RADIUS / 2;
var WATER_CLAMP = 1.5;
var REFRACT_K = 30;
var GLINT_GAIN = 12;
var ACTIVE_EPS = 1e-3;
var DEFAULT_FONT = "'Bahnschrift', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif";
var DEFAULT_CAPTION = [
  "My [finger] rests [upon] the wet [and] waiting [ink],",
  "a [silent] [testament] to [how] [I think].",
  "Your [shadow] lies pressed [flat against] the glass,",
  "a [perfect] [print of] [everything] that passes."
].join("\n");
function parseCaption(text) {
  return text.split("\n").map((line) => {
    const tokens = [];
    const re = /\[([^\]]*)\]|([^\[\]]+)/g;
    for (let m = re.exec(line); m !== null; m = re.exec(line)) {
      if (m[1] !== void 0) {
        if (m[1].length > 0) tokens.push({ text: m[1], emph: true });
      } else if (m[2] !== void 0 && m[2].length > 0) {
        tokens.push({ text: m[2], emph: false });
      }
    }
    return tokens;
  }).filter((line) => line.some((tok) => tok.text.trim().length > 0));
}
function karaokeStepMs(durationMs, count) {
  const ideal = (durationMs - KARAOKE_AT_MS - KARAOKE_TAIL_MS) / Math.max(1, count);
  return Math.min(KARAOKE_STEP_MAX, Math.max(KARAOKE_STEP_MIN, ideal));
}
function stepWaterField(prev, cur, w, h, damping) {
  for (let y = 1; y < h - 1; y++) {
    const row = y * w;
    for (let x = 1; x < w - 1; x++) {
      const i = row + x;
      prev[i] = ((cur[i - 1] + cur[i + 1] + cur[i - w] + cur[i + w]) * 0.5 - prev[i]) * damping;
    }
  }
  for (let x = 0; x < w; x++) {
    prev[x] = 0;
    prev[(h - 1) * w + x] = 0;
  }
  for (let y = 0; y < h; y++) {
    prev[y * w] = 0;
    prev[y * w + w - 1] = 0;
  }
}
function splashWaterField(field, w, h, x, y, radius, strength) {
  const r = Math.ceil(radius);
  const x0 = Math.max(0, Math.ceil(x - r));
  const x1 = Math.min(w - 1, Math.floor(x + r));
  const y0 = Math.max(0, Math.ceil(y - r));
  const y1 = Math.min(h - 1, Math.floor(y + r));
  const denom = radius * radius * 0.5;
  const r2 = radius * radius;
  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      const dx = gx - x;
      const dy = gy - y;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const i = gy * w + gx;
      field[i] = field[i] + strength * Math.exp(-d2 / denom);
    }
  }
}
var CAPTION_BOX_STYLE = [
  "position:absolute",
  "left:7%",
  "top:70%",
  "max-width:60%",
  "z-index:2",
  "pointer-events:none",
  "text-align:left",
  "color:rgba(190,195,200,0.55)",
  "font-size:clamp(15px,3.6vh,34px)",
  "line-height:1.55",
  "font-family:%FONT%",
  "text-shadow:0 1px 3px rgba(0,0,0,0.55)",
  "opacity:0",
  "transition:opacity 0.8s ease"
].join(";");
var K_SPAN_STYLE = [
  "font-weight:700",
  "color:rgba(190,195,200,0.55)",
  "transition:color 0.55s ease,text-shadow 0.55s ease"
].join(";");
var K_ON_STYLE = [
  "font-weight:700",
  "color:#eef1f3",
  "text-shadow:0 0 10px rgba(238,241,243,0.35),0 1px 3px rgba(0,0,0,0.55)",
  "transition:color 0.55s ease,text-shadow 0.55s ease"
].join(";");
var PoolEngine = class _PoolEngine {
  runtime;
  canvas;
  /** Null in environments without a 2d context (jsdom); drawing short-circuits. */
  ctx;
  img = new Image();
  durationMs;
  captionText;
  captionFont;
  /** 0 disables the water entirely: no pointer listening, no sim, no refraction. */
  rippleStrength;
  vw = 0;
  vh = 0;
  dpr = 1;
  /** Graded picture (cool grade + window glow + vignette), exactly viewport-sized. */
  base = null;
  grains = [];
  dust = [];
  pulseAt = Number.POSITIVE_INFINITY;
  fringe = [];
  captionEl = null;
  karaokeSpans = [];
  karaokeIdx = -1;
  karaokeStep = KARAOKE_STEP_MAX;
  /** Water field in cells and its two buffers (swapped every sim step). */
  fieldW = 0;
  fieldH = 0;
  waterPrev = new Float32Array(0);
  waterCur = new Float32Array(0);
  /** Graded base downscaled to CSS resolution, sampled by the refraction. */
  baseLo = null;
  frameBuf = null;
  refractCanvas = null;
  refractCtx = null;
  /** Last splash position in cell coordinates; -1 = none yet. */
  lastSplashX = -1;
  lastSplashY = -1;
  startTime = 0;
  lastNow = 0;
  completed = false;
  destroyed = false;
  rafId = 0;
  resizeTimer = 0;
  onImgLoad = () => {
    if (this.destroyed) return;
    this.runtime.markLoaded?.();
    if (this.runtime.reducedMotion || this.ctx === null) {
      this.showClean(false);
      this.markCompleted();
      return;
    }
    this.beginRun();
  };
  onImgError = () => {
    if (!this.destroyed && !this.completed) this.runtime.fail(new Error("opening image failed to load"));
  };
  onResize = () => {
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => {
      if (this.destroyed || this.completed) return;
      if (this.imageReady()) this.buildLayout();
    }, 200);
  };
  /** Pointer sweep → pressure splashes: CSS coords → cell coords, then splash
   * along the segment from the last position at ~radius/2 spacing so fast
   * moves leave a continuous ripple trail instead of dotted islands. */
  onPointerMove = (e) => {
    if (this.destroyed || this.completed) return;
    if (this.rippleStrength <= 0 || this.fieldW === 0) return;
    const rect = this.runtime.container.getBoundingClientRect();
    const gx = (e.clientX - rect.left) / SIM_CELL;
    const gy = (e.clientY - rect.top) / SIM_CELL;
    const strength = SPLASH_STRENGTH * this.rippleStrength;
    const lx = this.lastSplashX;
    const ly = this.lastSplashY;
    if (lx >= 0 && ly >= 0) {
      const dx = gx - lx;
      const dy = gy - ly;
      const n = Math.max(1, Math.floor(Math.hypot(dx, dy) / SPLASH_STEP));
      for (let k = 1; k <= n; k++) {
        splashWaterField(this.waterCur, this.fieldW, this.fieldH, lx + dx * k / n, ly + dy * k / n, SPLASH_RADIUS, strength);
      }
    } else {
      splashWaterField(this.waterCur, this.fieldW, this.fieldH, gx, gy, SPLASH_RADIUS, strength);
    }
    this.lastSplashX = gx;
    this.lastSplashY = gy;
    this.clampWater();
  };
  constructor(runtime) {
    this.runtime = runtime;
    const p = runtime.params;
    this.durationMs = _PoolEngine.number(p.durationMs, 2e4);
    this.captionText = typeof p.caption === "string" ? p.caption : DEFAULT_CAPTION;
    this.captionFont = typeof p.captionFont === "string" && p.captionFont.trim() !== "" ? p.captionFont : DEFAULT_FONT;
    this.rippleStrength = Math.min(3, Math.max(0, _PoolEngine.number(p.rippleStrength, 1)));
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
    runtime.container.append(this.canvas);
    this.img.addEventListener("load", this.onImgLoad);
    this.img.addEventListener("error", this.onImgError);
    window.addEventListener("resize", this.onResize);
  }
  start() {
    this.img.src = this.runtime.media.url;
  }
  skip() {
    if (this.destroyed || this.completed) return;
    this.showClean(false);
    this.markCompleted();
  }
  destroy() {
    this.destroyed = true;
    this.cancelRaf();
    window.clearTimeout(this.resizeTimer);
    this.runtime.container.removeEventListener("pointermove", this.onPointerMove);
    this.img.removeEventListener("load", this.onImgLoad);
    this.img.removeEventListener("error", this.onImgError);
    this.removeCaption();
    this.canvas.remove();
  }
  static number(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }
  markCompleted() {
    if (this.completed) return;
    this.completed = true;
    this.runtime.complete();
  }
  imageReady() {
    return this.img.complete && this.img.naturalWidth > 0;
  }
  cancelRaf() {
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }
  /* Viewport fit, graded base, grain frames, dust field, fringe schedule,
   * water field and refraction buffers — all rebuilt on resize. */
  buildLayout() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.vw = this.runtime.container.clientWidth || window.innerWidth;
    this.vh = this.runtime.container.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(this.vw * this.dpr);
    this.canvas.height = Math.round(this.vh * this.dpr);
    this.buildBase();
    this.buildGrain();
    this.buildRefract();
    this.fieldW = Math.ceil(this.vw / SIM_CELL) + 1;
    this.fieldH = Math.ceil(this.vh / SIM_CELL) + 1;
    this.waterPrev = new Float32Array(this.fieldW * this.fieldH);
    this.waterCur = new Float32Array(this.fieldW * this.fieldH);
    this.dust = Array.from({ length: DUST_COUNT }, () => this.rollDust(true));
    this.pulseAt = 800 + Math.random() * 400;
    this.rollFringe();
  }
  /* Bake the look once: cover-fit the picture to the viewport, cool the grade
   * down, lay a warm glow where the window light sits, darken the corners. */
  buildBase() {
    const W = this.vw;
    const H = this.vh;
    const base = document.createElement("canvas");
    base.width = Math.round(W * this.dpr);
    base.height = Math.round(H * this.dpr);
    const g = base.getContext("2d");
    if (g === null) {
      this.base = null;
      return;
    }
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const scale = Math.max(W / this.img.naturalWidth, H / this.img.naturalHeight);
    const dw = this.img.naturalWidth * scale;
    const dh = this.img.naturalHeight * scale;
    g.drawImage(
      this.img,
      0,
      0,
      this.img.naturalWidth,
      this.img.naturalHeight,
      (W - dw) / 2,
      (H - dh) / 2,
      dw,
      dh
    );
    g.globalCompositeOperation = "saturation";
    g.fillStyle = "rgba(128,128,128,0.4)";
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "multiply";
    g.fillStyle = "#b9c6dc";
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "source-over";
    g.fillStyle = "rgba(8,16,38,0.18)";
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "screen";
    const warm = g.createRadialGradient(W * 0.78, H * 0.22, 0, W * 0.78, H * 0.22, Math.max(W, H) * 0.45);
    warm.addColorStop(0, "rgba(255,238,214,0.34)");
    warm.addColorStop(0.55, "rgba(255,238,214,0.12)");
    warm.addColorStop(1, "rgba(255,238,214,0)");
    g.fillStyle = warm;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "source-over";
    const vig = g.createRadialGradient(W * 0.5, H * 0.45, Math.min(W, H) * 0.42, W * 0.5, H * 0.45, Math.hypot(W, H) * 0.62);
    vig.addColorStop(0, "rgba(3,8,20,0)");
    vig.addColorStop(1, "rgba(3,8,20,0.58)");
    g.fillStyle = vig;
    g.fillRect(0, 0, W, H);
    this.base = base;
  }
  /* Refraction buffers: the graded base downscaled to CSS resolution and read
   * once as ImageData, an offscreen canvas for the refracted pixels, and a
   * reused ImageData of the same size. Skipped entirely when water is off. */
  buildRefract() {
    this.baseLo = null;
    this.frameBuf = null;
    this.refractCanvas = null;
    this.refractCtx = null;
    if (this.rippleStrength <= 0 || this.base === null || this.vw <= 0 || this.vh <= 0) return;
    const c = document.createElement("canvas");
    c.width = this.vw;
    c.height = this.vh;
    const g = c.getContext("2d");
    if (g === null) return;
    g.drawImage(this.base, 0, 0, this.vw, this.vh);
    this.baseLo = g.getImageData(0, 0, this.vw, this.vh);
    this.frameBuf = g.createImageData(this.vw, this.vh);
    this.refractCanvas = c;
    this.refractCtx = g;
  }
  /* A few pre-rendered noise frames; each frame picks one at random. */
  buildGrain() {
    this.grains = [];
    const w = Math.max(2, Math.round(this.vw / 2));
    const h = Math.max(2, Math.round(this.vh / 2));
    for (let f = 0; f < GRAIN_FRAMES; f++) {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d");
      if (g === null) return;
      const data = g.createImageData(w, h);
      const px = data.data;
      for (let i = 0; i < px.length; i += 4) {
        const v = Math.random() * 255 | 0;
        px[i] = v;
        px[i + 1] = v;
        px[i + 2] = v;
        px[i + 3] = 255;
      }
      g.putImageData(data, 0, 0);
      this.grains.push(c);
    }
  }
  /* Two thirds of the motes are born in the window-light half of the screen
   * and those burn brighter; the rest scatter across the whole frame. */
  rollDust(first) {
    const inWindow = Math.random() < 0.65;
    return {
      x: inWindow ? this.vw * (0.5 + Math.random() * 0.5) : Math.random() * this.vw,
      y: first ? Math.random() * this.vh : -4,
      size: Math.random() < 0.5 ? 1 : 2,
      vy: 8 + Math.random() * 16,
      drift: 6 + Math.random() * 12,
      freq: 0.1 + Math.random() * 0.3,
      phase: Math.random() * Math.PI * 2,
      a: inWindow && Math.random() < 0.8 ? 0.45 + Math.random() * 0.45 : 0.12 + Math.random() * 0.25
    };
  }
  /* One pulse = a few thin red/blue bars hugging the screen edges (left
   * biased) plus soft color bleed gradients, flashed with a sine envelope. */
  rollFringe() {
    const bars = [];
    const left = [
      ["255,45,85", 0.8, 5],
      ["80,200,255", 0.6, 4],
      ["255,45,85", 0.45, 3]
    ];
    for (const [rgb, p, wMax] of left) {
      if (Math.random() > p) continue;
      bars.push({
        x: Math.random() < 0.8 ? 0 : Math.round(Math.random() * 10),
        y: Math.random() * this.vh * 0.8,
        w: 2 + Math.random() * wMax,
        h: this.vh * (0.15 + Math.random() * 0.45),
        rgb
      });
    }
    const right = [
      ["70,120,255", 0.8, 4],
      ["255,80,110", 0.4, 3]
    ];
    for (const [rgb, p, wMax] of right) {
      if (Math.random() > p) continue;
      bars.push({
        x: this.vw - (2 + Math.random() * wMax),
        y: Math.random() * this.vh * 0.8,
        w: 2 + Math.random() * wMax,
        h: this.vh * (0.15 + Math.random() * 0.45),
        rgb
      });
    }
    this.fringe = bars;
  }
  drawPulse(t) {
    const ctx = this.ctx;
    if (ctx === null) return;
    if (t < this.pulseAt) return;
    if (t >= this.pulseAt + PULSE_LEN) {
      this.pulseAt = t + 2200 + Math.random() * 600;
      this.rollFringe();
      return;
    }
    const env = Math.sin(Math.PI * (t - this.pulseAt) / PULSE_LEN);
    const bleed = ctx.createLinearGradient(0, 0, 46, 0);
    bleed.addColorStop(0, `rgba(90,140,255,${(0.13 * env).toFixed(3)})`);
    bleed.addColorStop(1, "rgba(90,140,255,0)");
    ctx.fillStyle = bleed;
    ctx.fillRect(0, 0, 46, this.vh);
    const bleedR = ctx.createLinearGradient(this.vw, 0, this.vw - 34, 0);
    bleedR.addColorStop(0, `rgba(255,80,110,${(0.1 * env).toFixed(3)})`);
    bleedR.addColorStop(1, "rgba(255,80,110,0)");
    ctx.fillStyle = bleedR;
    ctx.fillRect(this.vw - 34, 0, 34, this.vh);
    for (const b of this.fringe) {
      ctx.fillStyle = `rgba(${b.rgb},${(0.28 * env).toFixed(3)})`;
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
  }
  stepDust(tSec, dt) {
    const ctx = this.ctx;
    if (ctx === null) return;
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < this.dust.length; i++) {
      let d = this.dust[i];
      d.y += d.vy * dt;
      if (d.y > this.vh + 4) {
        this.dust[i] = this.rollDust(false);
        d = this.dust[i];
      }
      const x = d.x + Math.sin(tSec * Math.PI * 2 * d.freq + d.phase) * d.drift;
      ctx.globalAlpha = d.a;
      ctx.fillRect(x, d.y, d.size, d.size);
    }
    ctx.globalAlpha = 1;
  }
  /* Keep a pointer frenzy from blowing the field up. */
  clampWater() {
    const f = this.waterCur;
    for (let i = 0; i < f.length; i++) {
      const v = f[i];
      if (v > WATER_CLAMP) f[i] = WATER_CLAMP;
      else if (v < -WATER_CLAMP) f[i] = -WATER_CLAMP;
    }
  }
  /* Advance the water one step (swapping the buffers), find the active
   * bounding box, and refract the base through the wave gradient there: each
   * pixel samples the base offset along (gx, gy) and gains a white glint
   * where the surface tilts toward the light. Flat water skips the per-pixel
   * pass entirely; the ripples keep spreading and dying on their own. */
  stepWater() {
    if (this.rippleStrength <= 0) return;
    const ctx = this.ctx;
    const lo = this.baseLo;
    const buf = this.frameBuf;
    const off = this.refractCanvas;
    const offCtx = this.refractCtx;
    if (ctx === null || lo === null || buf === null || off === null || offCtx === null) return;
    if (this.fieldW < 3 || this.fieldH < 3) return;
    stepWaterField(this.waterPrev, this.waterCur, this.fieldW, this.fieldH, WAVE_DAMPING);
    const tmp = this.waterPrev;
    this.waterPrev = this.waterCur;
    this.waterCur = tmp;
    const field = this.waterCur;
    const w = this.fieldW;
    const h = this.fieldH;
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let y = 1; y < h - 1; y++) {
      const row = y * w;
      for (let x = 1; x < w - 1; x++) {
        if (Math.abs(field[row + x]) > ACTIVE_EPS) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return;
    minX = Math.max(1, minX - 2);
    minY = Math.max(1, minY - 2);
    maxX = Math.min(w - 2, maxX + 2);
    maxY = Math.min(h - 2, maxY + 2);
    const px0 = Math.min(this.vw, minX * SIM_CELL);
    const py0 = Math.min(this.vh, minY * SIM_CELL);
    const px1 = Math.min(this.vw, (maxX + 1) * SIM_CELL);
    const py1 = Math.min(this.vh, (maxY + 1) * SIM_CELL);
    if (px1 <= px0 || py1 <= py0) return;
    const k = REFRACT_K * this.rippleStrength;
    const src = lo.data;
    const dst = buf.data;
    const imgW = this.vw;
    for (let y = py0; y < py1; y++) {
      const fy = Math.min(h - 2, Math.max(1, Math.floor(y / SIM_CELL)));
      const rowUp = (fy - 1) * w;
      const rowMid = fy * w;
      const rowDown = (fy + 1) * w;
      const dstRow = y * imgW;
      for (let x = px0; x < px1; x++) {
        const fx = Math.min(w - 2, Math.max(1, Math.floor(x / SIM_CELL)));
        const gx = (field[rowMid + fx - 1] - field[rowMid + fx + 1]) * 0.5;
        const gy = (field[rowUp + fx] - field[rowDown + fx]) * 0.5;
        let sx = x + gx * k;
        let sy = y + gy * k;
        if (sx < 0) sx = 0;
        else if (sx >= imgW) sx = imgW - 1;
        if (sy < 0) sy = 0;
        else if (sy >= this.vh) sy = this.vh - 1;
        const si = (Math.floor(sy) * imgW + Math.floor(sx)) * 4;
        const di = (dstRow + x) * 4;
        const add = Math.min(1, Math.max(0, (gx + gy) * GLINT_GAIN)) * 255;
        dst[di] = src[si] + add;
        dst[di + 1] = src[si + 1] + add;
        dst[di + 2] = src[si + 2] + add;
        dst[di + 3] = 255;
      }
    }
    offCtx.putImageData(buf, 0, 0, px0, py0, px1 - px0, py1 - py0);
    ctx.drawImage(off, px0, py0, px1 - px0, py1 - py0, px0, py0, px1 - px0, py1 - py0);
  }
  /* Build the karaoke caption once: plain words stay grey, bracketed words
   * become spans that light up white one after another. */
  buildCaption() {
    this.removeCaption();
    const lines = parseCaption(this.captionText);
    const total = lines.reduce((n, line) => n + line.length, 0);
    this.karaokeStep = karaokeStepMs(this.durationMs, total);
    const box = document.createElement("div");
    box.setAttribute("class", "dsh-opening-pool-caption");
    box.setAttribute("style", CAPTION_BOX_STYLE.replace("%FONT%", this.captionFont));
    const spans = [];
    for (const line of lines) {
      const row = document.createElement("div");
      for (const tok of line) {
        const s = document.createElement("span");
        s.textContent = tok.text;
        if (tok.emph) {
          s.setAttribute("class", "k");
          s.setAttribute("style", K_SPAN_STYLE);
          spans.push(s);
        }
        row.append(s);
      }
      box.append(row);
    }
    this.karaokeSpans = spans;
    this.karaokeIdx = -1;
    this.captionEl = box;
    this.runtime.container.append(box);
  }
  /* Fade the caption in, then advance the karaoke: the current word turns
   * white, everything before it eases back to grey. DOM writes are incremental. */
  stepKaraoke(t) {
    const box = this.captionEl;
    if (box === null) return;
    if (t >= CAPTION_IN_MS && box.style.opacity !== "1") box.style.opacity = "1";
    const spans = this.karaokeSpans;
    if (spans.length === 0) return;
    const idx = t < KARAOKE_AT_MS ? -1 : Math.min(spans.length - 1, Math.floor((t - KARAOKE_AT_MS) / this.karaokeStep));
    if (idx === this.karaokeIdx) return;
    if (idx > this.karaokeIdx) {
      for (let i = this.karaokeIdx + 1; i < idx; i++) spans[i].setAttribute("style", K_SPAN_STYLE);
      spans[idx].setAttribute("style", K_ON_STYLE);
    } else {
      for (let i = 0; i < spans.length; i++) spans[i].setAttribute("style", K_SPAN_STYLE);
    }
    this.karaokeIdx = idx;
  }
  removeCaption() {
    this.captionEl?.remove();
    this.captionEl = null;
    this.karaokeSpans = [];
    this.karaokeIdx = -1;
  }
  beginRun() {
    this.cancelRaf();
    this.buildLayout();
    this.buildCaption();
    this.lastSplashX = -1;
    this.lastSplashY = -1;
    if (this.rippleStrength > 0 && this.ctx !== null) {
      this.runtime.container.addEventListener("pointermove", this.onPointerMove);
    }
    this.startTime = performance.now();
    this.lastNow = this.startTime;
    this.rafId = requestAnimationFrame(this.frame);
  }
  frame = (now) => {
    if (this.destroyed || this.completed) return;
    const ctx = this.ctx;
    if (ctx === null) return;
    const t = now - this.startTime;
    if (t >= this.durationMs) {
      this.showClean(true);
      this.markCompleted();
      return;
    }
    const dt = Math.min(0.05, Math.max(0, (now - this.lastNow) / 1e3));
    this.lastNow = now;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    if (this.base !== null) {
      ctx.drawImage(this.base, 0, 0, this.vw, this.vh);
    }
    this.stepWater();
    this.stepDust(t / 1e3, dt);
    this.drawPulse(t);
    if (this.grains.length > 0) {
      ctx.globalAlpha = GRAIN_ALPHA;
      ctx.drawImage(this.grains[Math.random() * this.grains.length | 0], 0, 0, this.vw, this.vh);
      ctx.globalAlpha = 1;
    }
    this.stepKaraoke(t);
    this.rafId = requestAnimationFrame(this.frame);
  };
  /* Final graded frame (skip/reduced motion also drops the caption; the
   * natural end keeps it for the hand-over). */
  showClean(keepCaption) {
    this.cancelRaf();
    if (!keepCaption) this.removeCaption();
    const ctx = this.ctx;
    if (ctx === null || !this.imageReady()) return;
    if (this.base === null) this.buildLayout();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#04050e";
    ctx.fillRect(0, 0, this.vw, this.vh);
    if (this.base !== null) {
      ctx.drawImage(this.base, 0, 0, this.vw, this.vh);
    }
  }
};
var poolAnimation = {
  id: "pool",
  kind: "image",
  labelKey: "anim.pool.label",
  descriptionKey: "anim.pool.desc",
  paramsSchema: {
    durationMs: { type: "number", default: 2e4, min: 3e3, max: 3e4, step: 500 },
    rippleStrength: { type: "number", default: 1, min: 0, max: 3, step: 0.1 },
    caption: { type: "string", default: DEFAULT_CAPTION },
    captionFont: { type: "string", default: DEFAULT_FONT }
  },
  create: (runtime) => new PoolEngine(runtime)
};

// src/client/animations/code-rain.ts
var GREEN = "#00FF41";
var GREEN_DIM = "#006400";
var GREEN_HI = "#CCFFCC";
var MONO = 'ui-monospace, "Cascadia Mono", Consolas, monospace';
var RAIN_CHARS = "0123456789ABCDEF{}<>*;/#@";
var TAIL_RATIO = 0.8;
var ROLLOUT_MARGIN_MS = 400;
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function buildRainColumns(seed, count, vw, totalMs) {
  const rnd = mulberry32((seed ^ 1374496523) >>> 0);
  const columns = [];
  const w = vw / count;
  const minSpan = totalMs * 0.35;
  const lastEnd = Math.max(totalMs - ROLLOUT_MARGIN_MS, totalMs * 0.62);
  for (let i = 0; i < count; i++) {
    const start = totalMs * rnd() * 0.18;
    let end = totalMs * (0.62 + rnd() * 0.38);
    if (end - start < minSpan) end = start + minSpan;
    end = Math.min(end, lastEnd);
    columns.push({
      x: i * w,
      w,
      start,
      end,
      seed: Math.floor(rnd() * 16777215)
    });
  }
  const lastStream = columns[Math.floor(rnd() * count) % count];
  if (lastStream) lastStream.end = lastEnd;
  return columns;
}
var CodeRainEngine = class _CodeRainEngine {
  runtime;
  canvas;
  /** Null in environments without a 2d context (jsdom); every draw short-circuits. */
  ctx;
  img = new Image();
  durationMs;
  columnsCount;
  seed = 20260601;
  total;
  vw = 0;
  vh = 0;
  dpr = 1;
  fontSize = 20;
  charW = 12;
  imgLayer = null;
  rainColumns = [];
  /** One pre-rendered stream sprite per column, aligned by index. */
  rainSprites = [];
  /** Stream sprite height in CSS px. */
  spriteH = 0;
  scale = 1;
  ox = 0;
  oy = 0;
  startTime = 0;
  completed = false;
  destroyed = false;
  rafId = 0;
  resizeTimer = 0;
  onImgLoad = () => {
    if (this.destroyed) return;
    this.prepare();
    this.runtime.markLoaded?.();
    if (this.runtime.reducedMotion) {
      this.renderFinal();
      this.markCompleted();
      return;
    }
    this.startTime = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  };
  onImgError = () => {
    if (!this.destroyed && !this.completed) this.runtime.fail(new Error("opening image failed to load"));
  };
  onResize = () => {
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => {
      if (this.destroyed || this.completed) return;
      this.prepare();
      if (this.imageReady() && this.ctx !== null) {
        this.renderFrame(Math.max(0, Math.min(performance.now() - this.startTime, this.durationMs)));
      }
    }, 200);
  };
  constructor(runtime) {
    this.runtime = runtime;
    const p = runtime.params;
    this.durationMs = _CodeRainEngine.number(p.durationMs, 6e3);
    this.total = Math.round(this.durationMs);
    this.columnsCount = Math.round(_CodeRainEngine.number(p.columns, 40));
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
    runtime.container.append(this.canvas);
    this.img.addEventListener("load", this.onImgLoad);
    this.img.addEventListener("error", this.onImgError);
    window.addEventListener("resize", this.onResize);
  }
  start() {
    this.img.src = this.runtime.media.url;
  }
  skip() {
    if (this.destroyed || this.completed) return;
    this.cancelRaf();
    this.renderFinal();
    this.markCompleted();
  }
  destroy() {
    this.destroyed = true;
    this.cancelRaf();
    window.clearTimeout(this.resizeTimer);
    this.img.removeEventListener("load", this.onImgLoad);
    this.img.removeEventListener("error", this.onImgError);
    this.canvas.remove();
  }
  static number(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }
  markCompleted() {
    if (this.completed) return;
    this.completed = true;
    this.runtime.complete();
  }
  imageReady() {
    return this.img.complete && this.img.naturalWidth > 0;
  }
  cancelRaf() {
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }
  /* Viewport fit, picture layer, column geometry, stream sprites. */
  prepare() {
    if (this.ctx === null || !this.imageReady()) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.vw = this.runtime.container.clientWidth || window.innerWidth;
    this.vh = this.runtime.container.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(this.vw * this.dpr);
    this.canvas.height = Math.round(this.vh * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.scale = Math.max(this.vw / this.img.naturalWidth, this.vh / this.img.naturalHeight);
    const dw = this.img.naturalWidth * this.scale;
    const dh = this.img.naturalHeight * this.scale;
    this.ox = (this.vw - dw) / 2;
    this.oy = (this.vh - dh) / 2;
    this.fontSize = Math.round(Math.min(26, Math.max(14, this.vh / 40)));
    this.ctx.font = `${this.fontSize}px ${MONO}`;
    this.charW = this.ctx.measureText("0").width;
    this.imgLayer = document.createElement("canvas");
    this.imgLayer.width = this.canvas.width;
    this.imgLayer.height = this.canvas.height;
    this.imgLayer.getContext("2d")?.drawImage(
      this.img,
      0,
      0,
      this.img.naturalWidth,
      this.img.naturalHeight,
      this.ox * this.dpr,
      this.oy * this.dpr,
      dw * this.dpr,
      dh * this.dpr
    );
    const count = Math.min(96, Math.max(8, this.columnsCount));
    this.rainColumns = buildRainColumns(this.seed, count, this.vw, this.total);
    this.buildRainSprites();
  }
  /* Pre-render every stream once: glyph chain from dim tail to bright head
   * with the head glow baked in. Glyphs are fixed per chain slot, so a
   * falling stream is a rigid body — nothing can flicker — and drawing one
   * is a single drawImage instead of hundreds of fillText calls. */
  buildRainSprites() {
    this.rainSprites = [];
    this.spriteH = 0;
    if (this.ctx === null) return;
    const spacing = this.fontSize;
    const rows = Math.max(10, Math.ceil(this.vh * TAIL_RATIO / spacing));
    this.spriteH = (rows - 1) * spacing + this.fontSize;
    for (const col of this.rainColumns) {
      const sprite = document.createElement("canvas");
      sprite.width = Math.max(1, Math.ceil(col.w * this.dpr));
      sprite.height = Math.max(1, Math.ceil(this.spriteH * this.dpr));
      const g = sprite.getContext("2d");
      if (g === null) {
        this.rainSprites.push(void 0);
        continue;
      }
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      g.font = `${this.fontSize}px ${MONO}`;
      g.textBaseline = "top";
      const cx = col.w / 2;
      const headCy = this.spriteH - this.fontSize / 2;
      const glowR = this.fontSize * 1.4;
      const glow = g.createRadialGradient(cx, headCy, 0, cx, headCy, glowR);
      glow.addColorStop(0, "rgba(0,255,65,0.35)");
      glow.addColorStop(1, "rgba(0,255,65,0)");
      g.fillStyle = glow;
      g.fillRect(cx - glowR, headCy - glowR, glowR * 2, glowR * 2);
      for (let k = 0; k < rows; k++) {
        const roll = this.rand01(col.seed, k);
        if (roll < 0.08) continue;
        if (k === 0) {
          g.globalAlpha = 1;
          g.fillStyle = GREEN_HI;
        } else if (k < 3) {
          g.globalAlpha = 1;
          g.fillStyle = GREEN;
        } else {
          g.globalAlpha = Math.max(0.12, 1 - k / rows) * 0.8;
          g.fillStyle = GREEN_DIM;
        }
        g.fillText(this.rainChar(col.seed, k), cx - this.charW / 2, this.spriteH - this.fontSize - k * spacing);
      }
      this.rainSprites.push(sprite);
    }
  }
  frame = (now) => {
    if (this.destroyed || this.completed) return;
    const elapsed = now - this.startTime;
    if (elapsed >= this.total) {
      this.renderFinal();
      this.markCompleted();
      return;
    }
    this.renderFrame(elapsed);
    this.rafId = requestAnimationFrame(this.frame);
  };
  renderFrame(t) {
    const ctx = this.ctx;
    if (ctx === null || this.imgLayer === null) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(this.imgLayer, 0, 0, this.canvas.width, this.canvas.height, 0, 0, this.vw, this.vh);
    this.drawRain(t);
  }
  /* The rain: one sprite per column, translated as a whole. The travel adds
   * one extra glyph row past the tail so the stream is fully off-screen at
   * p = 1; columns that have not entered or already left draw nothing. */
  drawRain(t) {
    const ctx = this.ctx;
    if (ctx === null) return;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    const tailPx = this.vh * TAIL_RATIO;
    const travel = this.vh + 2 * tailPx + this.fontSize;
    for (let i = 0; i < this.rainColumns.length; i++) {
      const sprite = this.rainSprites[i];
      const col = this.rainColumns[i];
      if (sprite === void 0 || col === void 0) continue;
      const p = (t - col.start) / (col.end - col.start);
      if (p <= 0 || p >= 1) continue;
      const head = -tailPx + p * travel;
      ctx.drawImage(sprite, col.x, head - (this.spriteH - this.fontSize), col.w, this.spriteH);
    }
    ctx.restore();
  }
  /* Final frame: the clean picture. */
  renderFinal() {
    const ctx = this.ctx;
    if (ctx === null || !this.imageReady()) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, this.vw, this.vh);
    const dw = this.img.naturalWidth * this.scale;
    const dh = this.img.naturalHeight * this.scale;
    ctx.drawImage(this.img, 0, 0, this.img.naturalWidth, this.img.naturalHeight, this.ox, this.oy, dw, dh);
  }
  /* Deterministic per-(seed, slot) glyph; slots never change while falling. */
  rainChar(seed, slot) {
    const r = this.rand01(seed ^ 40503, slot * 31);
    return RAIN_CHARS[Math.floor(r * RAIN_CHARS.length)] ?? "0";
  }
  rand01(seed, n) {
    let a = (seed ^ Math.imul(n + 1, 2654435769)) >>> 0;
    a |= 0;
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
};
var codeRainAnimation = {
  id: "code-rain",
  kind: "image",
  labelKey: "anim.code-rain.label",
  descriptionKey: "anim.code-rain.desc",
  paramsSchema: {
    durationMs: { type: "number", default: 6e3, min: 1e3, max: 3e4, step: 500 },
    columns: { type: "number", default: 40, min: 8, max: 96, step: 4 }
  },
  create: (runtime) => new CodeRainEngine(runtime)
};

// src/client/dominant-color.ts
var SAMPLE_SIZE = 32;
var QUANT_BITS = 4;
var FALLBACK = "#04050e";
var DARK_CUTOFF = 40;
var BRIGHT_FLAT_V = 232;
var BRIGHT_FLAT_SAT = 0.12;
function extractDominantColor(img) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (ctx === null) return FALLBACK;
    ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    const counts = /* @__PURE__ */ new Map();
    const sums = /* @__PURE__ */ new Map();
    let allR = 0;
    let allG = 0;
    let allB = 0;
    let allCount = 0;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha < 128) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      allR += r;
      allG += g;
      allB += b;
      allCount++;
      const v = Math.max(r, g, b);
      const sat = v > 0 ? (v - Math.min(r, g, b)) / v : 0;
      if (v < DARK_CUTOFF || v > BRIGHT_FLAT_V && sat < BRIGHT_FLAT_SAT) continue;
      const key = r >> QUANT_BITS << 8 | g >> QUANT_BITS << 4 | b >> QUANT_BITS;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      const sum = sums.get(key) ?? [0, 0, 0];
      sum[0] += r;
      sum[1] += g;
      sum[2] += b;
      sums.set(key, sum);
    }
    let bestKey = -1;
    let bestCount = 0;
    for (const [key, count] of counts) {
      if (count > bestCount) {
        bestCount = count;
        bestKey = key;
      }
    }
    if (bestKey >= 0 && bestCount > 0) {
      const [rSum, gSum, bSum] = sums.get(bestKey);
      return `rgb(${Math.round(rSum / bestCount)}, ${Math.round(gSum / bestCount)}, ${Math.round(bSum / bestCount)})`;
    }
    if (allCount > 0) {
      return `rgb(${Math.round(allR / allCount)}, ${Math.round(allG / allCount)}, ${Math.round(allB / allCount)})`;
    }
    return FALLBACK;
  } catch {
    return FALLBACK;
  }
}
function whenDecoded(img, next) {
  if (typeof img.decode === "function") {
    img.decode().then(next, next);
    return;
  }
  next();
}

// src/client/animations/grid-reveal-spread.ts
var clamp01 = (v) => Math.min(Math.max(v, 0), 1);
var GridRevealSpreadEngine = class _GridRevealSpreadEngine {
  runtime;
  canvas;
  ctx;
  img = new Image();
  cellSize;
  spreadSpeed;
  feather;
  autoStartDelayMs;
  fixedBg;
  vw = 0;
  vh = 0;
  dpr = 1;
  scaleCache = 1;
  ox = 0;
  oy = 0;
  cells = [];
  imgLayer;
  mask;
  maskCtx;
  tmp;
  tmpCtx;
  lit;
  litCtx;
  hint = null;
  state = "idle";
  pointer = null;
  spread = null;
  rafId = 0;
  resizeTimer = 0;
  autoStartTimer = 0;
  completed = false;
  destroyed = false;
  onImgLoad = () => {
    if (this.destroyed) return;
    this.runtime.markLoaded?.();
    whenDecoded(this.img, () => {
      if (this.destroyed) return;
      if (this.fixedBg === "") this.fixedBg = extractDominantColor(this.img);
      this.buildLayout();
      if (this.runtime.reducedMotion) {
        this.finishAll();
        this.markCompleted();
        return;
      }
      this.drawBackdrop();
      this.showHint();
      this.autoStartTimer = window.setTimeout(() => {
        if (!this.destroyed && this.state === "idle") {
          this.startSpread(this.pointer ?? { x: this.vw / 2, y: this.vh / 2 });
        }
      }, this.autoStartDelayMs);
    });
  };
  onImgError = () => {
    if (!this.destroyed && !this.completed) this.runtime.fail(new Error("opening image failed to load"));
  };
  onMouseMove = (event) => {
    if (this.destroyed) return;
    this.pointer = { x: event.clientX, y: event.clientY };
  };
  onClick = (event) => {
    if (this.state !== "idle" || this.destroyed || this.completed) return;
    event.stopPropagation();
    this.pointer = { x: event.clientX, y: event.clientY };
    this.startSpread(this.pointer);
  };
  onResize = () => {
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => {
      if (this.destroyed) return;
      const wasIdle = this.state === "idle";
      if (this.img.complete && this.img.naturalWidth > 0) this.buildLayout();
      if (wasIdle) this.drawBackdrop();
      else this.finishAll();
    }, 200);
  };
  constructor(runtime) {
    this.runtime = runtime;
    const p = runtime.params;
    this.cellSize = _GridRevealSpreadEngine.number(p.cellSize, 36);
    this.spreadSpeed = _GridRevealSpreadEngine.number(p.spreadSpeed, 450);
    this.feather = _GridRevealSpreadEngine.number(p.feather, 0.6);
    this.autoStartDelayMs = _GridRevealSpreadEngine.number(p.autoStartDelayMs, 5e3);
    this.fixedBg = typeof p.bg === "string" && p.bg.length > 0 && p.bg !== "auto" ? p.bg : "";
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
    runtime.container.append(this.canvas);
    const crt = document.createElement("div");
    crt.className = "dsh-opening-crt";
    const vignette = document.createElement("div");
    vignette.className = "dsh-opening-vignette";
    runtime.container.append(crt, vignette);
    this.hint = document.createElement("div");
    this.hint.className = "dsh-opening-hint";
    this.hint.textContent = runtime.t("hint.spread");
    runtime.container.append(this.hint);
    this.img.addEventListener("load", this.onImgLoad);
    this.img.addEventListener("error", this.onImgError);
    runtime.container.addEventListener("mousemove", this.onMouseMove);
    runtime.container.addEventListener("click", this.onClick);
    window.addEventListener("resize", this.onResize);
  }
  start() {
    this.img.src = this.runtime.media.url;
  }
  skip() {
    if (this.destroyed || this.completed) return;
    window.clearTimeout(this.autoStartTimer);
    this.cancelRaf();
    if (this.imageReady()) this.finishAll();
    this.markCompleted();
  }
  destroy() {
    this.destroyed = true;
    window.clearTimeout(this.autoStartTimer);
    window.clearTimeout(this.resizeTimer);
    this.cancelRaf();
    this.img.removeEventListener("load", this.onImgLoad);
    this.img.removeEventListener("error", this.onImgError);
    this.runtime.container.removeEventListener("mousemove", this.onMouseMove);
    this.runtime.container.removeEventListener("click", this.onClick);
    this.canvas.remove();
    this.hint?.remove();
    this.hint = null;
    this.runtime.container.querySelectorAll(".dsh-opening-crt, .dsh-opening-vignette").forEach((el) => el.remove());
  }
  markCompleted() {
    if (this.completed) return;
    this.completed = true;
    this.runtime.complete();
  }
  imageReady() {
    return this.img.complete && this.img.naturalWidth > 0;
  }
  cancelRaf() {
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }
  showHint() {
    this.hint?.classList.add("dsh-opening-hint-show");
  }
  hideHint() {
    this.hint?.classList.remove("dsh-opening-hint-show");
    this.hint?.classList.add("dsh-opening-hint-hide");
  }
  mkLayer() {
    const c = document.createElement("canvas");
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    return c;
  }
  /* Picture cover-fitted to the viewport; grid cells in picture coordinates. */
  buildLayout() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.vw = this.runtime.container.clientWidth || window.innerWidth;
    this.vh = this.runtime.container.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(this.vw * this.dpr);
    this.canvas.height = Math.round(this.vh * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.scaleCache = Math.max(this.vw / this.img.naturalWidth, this.vh / this.img.naturalHeight);
    const scale = this.scaleCache;
    const dw = this.img.naturalWidth * scale;
    const dh = this.img.naturalHeight * scale;
    this.ox = (this.vw - dw) / 2;
    this.oy = (this.vh - dh) / 2;
    const cells = [];
    const cols = Math.ceil(dw / this.cellSize);
    const rows = Math.ceil(dh / this.cellSize);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const dx = this.ox + c * this.cellSize;
        const dy = this.oy + r * this.cellSize;
        if (dx >= this.vw || dy >= this.vh) continue;
        const sx = (dx - this.ox) / scale;
        const sy = (dy - this.oy) / scale;
        const sw = Math.min(this.cellSize / scale, this.img.naturalWidth - sx);
        const sh = Math.min(this.cellSize / scale, this.img.naturalHeight - sy);
        if (sw <= 0 || sh <= 0) continue;
        cells.push({ dx, dy, sx, sy, sw, sh });
      }
    }
    this.cells = cells;
    this.imgLayer = this.mkLayer();
    this.imgLayer.getContext("2d")?.drawImage(
      this.img,
      0,
      0,
      this.img.naturalWidth,
      this.img.naturalHeight,
      this.ox * this.dpr,
      this.oy * this.dpr,
      dw * this.dpr,
      dh * this.dpr
    );
    this.mask = this.mkLayer();
    this.maskCtx = this.mask.getContext("2d");
    this.tmp = this.mkLayer();
    this.tmpCtx = this.tmp.getContext("2d");
    this.lit = this.mkLayer();
    this.litCtx = this.lit.getContext("2d");
  }
  /* Backdrop + fully revealed cache; the idle state is just this frame. */
  drawBackdrop() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.globalCompositeOperation = "source-over";
    this.ctx.fillStyle = this.fixedBg !== "" ? this.fixedBg : "#04050e";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.lit, 0, 0);
  }
  /* Spread from the given point at constant wavefront speed. */
  startSpread(xy) {
    window.clearTimeout(this.autoStartTimer);
    const cx = Math.min(Math.max(xy.x, 0), this.vw);
    const cy = Math.min(Math.max(xy.y, 0), this.vh);
    const hw = this.cellSize / 2;
    const items = this.cells.map((c) => {
      const ccx = c.dx + hw;
      const ccy = c.dy + hw;
      const vx = ccx - cx;
      const vy = ccy - cy;
      const dist = Math.hypot(vx, vy);
      const iux = dist < 1e-6 ? 1 : vx / dist;
      const iuy = dist < 1e-6 ? 0 : vy / dist;
      const proj = Math.abs(iux) * hw + Math.abs(iuy) * hw;
      return {
        cell: c,
        minD: dist - proj,
        maxD: dist + proj,
        proj,
        sx: ccx - iux * proj,
        sy: ccy - iuy * proj,
        ex: ccx + iux * proj,
        ey: ccy + iuy * proj
      };
    });
    items.sort((a, b) => a.minD - b.minD);
    this.spread = { t0: performance.now(), items, ptr: 0, active: [] };
    this.hideHint();
    this.state = "spreading";
    this.cancelRaf();
    this.rafId = requestAnimationFrame(this.frameSpread);
  }
  /* In-cell linear gradient: wavefront at xn∈[0,1+], alpha from center side (1) to far side (0). */
  cellGradient(it, xn) {
    const tail = this.feather;
    const a0 = clamp01(xn / tail);
    const xA = Math.max(0, xn - tail);
    const xB = Math.min(1, xn);
    const g = this.maskCtx.createLinearGradient(it.sx * this.dpr, it.sy * this.dpr, it.ex * this.dpr, it.ey * this.dpr);
    if (xB > xA + 1e-6) {
      g.addColorStop(0, `rgba(255,255,255,${a0.toFixed(3)})`);
      if (xA > 1e-6) g.addColorStop(xA, "rgba(255,255,255,1)");
      g.addColorStop(xB, "rgba(255,255,255,0)");
      if (xB < 1 - 1e-6) g.addColorStop(1, "rgba(255,255,255,0)");
    } else {
      g.addColorStop(0, `rgba(255,255,255,${a0.toFixed(3)})`);
      g.addColorStop(1, `rgba(255,255,255,${a0.toFixed(3)})`);
    }
    return g;
  }
  frameSpread = (now) => {
    if (this.destroyed || this.completed) return;
    const spread = this.spread;
    if (spread === null) return;
    const r = this.spreadSpeed * (now - spread.t0) / 1e3;
    const items = spread.items;
    while (spread.ptr < items.length && items[spread.ptr].minD <= r) {
      spread.active.push(items[spread.ptr++]);
    }
    this.maskCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.maskCtx.clearRect(0, 0, this.mask.width, this.mask.height);
    const still = [];
    for (const it of spread.active) {
      if (r >= it.maxD) {
        this.drawLit(it.cell);
        continue;
      }
      const span = it.proj * 2;
      const xn = span > 0 ? (r - it.minD) / span : 1;
      this.maskCtx.fillStyle = this.cellGradient(it, xn);
      this.maskCtx.fillRect(it.cell.dx * this.dpr, it.cell.dy * this.dpr, this.cellSize * this.dpr, this.cellSize * this.dpr);
      still.push(it);
    }
    spread.active = still;
    this.tmpCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.tmpCtx.globalCompositeOperation = "source-over";
    this.tmpCtx.clearRect(0, 0, this.tmp.width, this.tmp.height);
    this.tmpCtx.drawImage(this.imgLayer, 0, 0);
    this.tmpCtx.globalCompositeOperation = "destination-in";
    this.tmpCtx.drawImage(this.mask, 0, 0);
    this.tmpCtx.globalCompositeOperation = "source-over";
    this.drawBackdrop();
    this.ctx.drawImage(this.tmp, 0, 0);
    if (spread.active.length === 0 && spread.ptr >= items.length) {
      this.state = "done";
      this.spread = null;
      this.cancelRaf();
      this.markCompleted();
      return;
    }
    this.rafId = requestAnimationFrame(this.frameSpread);
  };
  /* Light every cell immediately (skip / reduced motion / resize mid-spread). */
  finishAll() {
    this.cancelRaf();
    this.state = "done";
    this.spread = null;
    if (this.litCtx !== void 0) {
      for (const c of this.cells) this.drawLit(c);
      this.maskCtx.setTransform(1, 0, 0, 1, 0, 0);
      this.maskCtx.clearRect(0, 0, this.mask.width, this.mask.height);
      this.drawBackdrop();
    }
  }
  drawLit(cell) {
    this.litCtx.drawImage(
      this.img,
      cell.sx,
      cell.sy,
      cell.sw,
      cell.sh,
      cell.dx * this.dpr,
      cell.dy * this.dpr,
      cell.sw * this.scaleCache * this.dpr,
      cell.sh * this.scaleCache * this.dpr
    );
  }
  static number(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }
};
var gridRevealSpreadAnimation = {
  id: "grid-reveal-spread",
  kind: "image",
  labelKey: "anim.grid-reveal-spread.label",
  descriptionKey: "anim.grid-reveal-spread.desc",
  paramsSchema: {
    cellSize: { type: "number", default: 36, min: 12, max: 120, step: 2 },
    spreadSpeed: { type: "number", default: 450, min: 60, max: 3e3, step: 10 },
    feather: { type: "number", default: 0.6, min: 0.1, max: 1, step: 0.05 },
    autoStartDelayMs: { type: "number", default: 5e3, min: 0, max: 3e4, step: 500 },
    bg: { type: "enum", default: "auto", options: ["auto", "#04050e", "#000000", "#101020"] }
  },
  create: (runtime) => new GridRevealSpreadEngine(runtime)
};

// src/client/animations/retro-boot-assets.ts
var RETRO_BOOT_LOGO1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABLAAAAKjCAYAAAANs/bAAAEAAElEQVR42uz9e3BbZ34neH+fcyFBghJEiQTVEk1RV7tl0ZJbluJLt9pUHLc8o3W20+vuN+2J5H5HUzWjyWwyu3ZK1b3bu5u32qtNlJqpeTPe933LSWynklSmZ7JVXZ2023FLGtlWeuXYutCyrRtvomQRJAWCJAiA5+A87x8HD3BwCPB+AcDvp4pFipIp+RAgzvme30V843cPg4iIiIiIiIiIqFRpPARERERERERERAQGWERERERERERERGCARUREREREREREYIBFREREREREREQEBlhERERERERERERggEVERERERERERGCARUREREREREREBAZYREREREREREQEBlhERERERERERERggEVERERERERERAQGWEREREREREREBAZYREREREREREREYIBFRERERERERERggEVERERERERERAQGWERERERERERERGCARUREREREREREYIBFREREREREREQEBlhERERERERERAQGWERERERERERERGCARUREREREREREBAZYREREREREREQEBlhERERERERERERggEVERERERERERCuHwUNARERERFR5jj17KmxZ9v5odPShgYFoa2NjfXd9/arPBdBnmMbd1995OcKjREREYAUWERERERERERHR/Ilv/O5hHgUiIiIiogry/J4fvDwwEG290TX0QjKFxuoaQzgiCE3GIRw7EqozPnp4Z+vpcLj+LVZiERFROdC3Pb6DR4GIiIiICJXRNlid3PZ/XL5651/c7U88rVcZdYapibQMQkgTDnQILR2Mjdjbvui/vydtpRqfeexbdy91v3uPR4+IiMAAi4iIiIiIFlt1ctv/caNr6AWpGWHNWCskApAIQECHhAUA0IQFw9QEhBa8H423pixr57P7vhW73P3udR5BIiICAywiIiIiIsIitg1evnrnX0jNCKdlEAK67084AACJKkCrgiOrMJFK1cbjiRAca4KVWEREBA5xJyIiIiKixXK0/eThq592H0ym0LgxHIQu4tmKKwDZj3URd3/tZFaSB0IimULjja6hF+5HR5/hkSQiIjDAIiIiIiIiLMLcq/c/6DjeP2Qfqq4xxJ1IPC+sUnQRR1oGs58XMCFgwgw0iGQKjRcvdx052n6SG56IiAgMsIiIiIiI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ERERERhgERERtuzsLADovzbxsDKsTDHvqWi7IRhg0W1uBlwNU8qzrHRbYKZt+6Cusjry0H0Ttm2dYWBFRERExACLiIhQf+2GY2PZztkS7tUth8qwMvr3llRqydBio4VeDLDuzmD1WtsBKxYLzG0IBIKwCgCKeU/p6ioAqA6sBBhkWyARERERAywiIiIAlS2HDcnksWigBQDVrYeLhVaGcuBLCgyw7nywZCinZuiISJXTYr++nNBKf31rfZ2VXzlnTbcARudYWSo3Gg2s2BJIRERExACLiIgIq63QUsCe8xc+agWCUGvwxtQJAMgXS22FInbGk5YACMMM/TlYgbWh2/iqw8fF/pwOxaKBld4AqP+srqbSom2A4nujtaqrgGDoOgMrIiIiIgZYREREWI9QK5ud/sTYWLYzGmjp3+dJOqPbxYCgZaxWCAIGWBuqBXChY2ZK+eu2UOWWKQ7E90YBYKFWQADg/CoiIiIiBlhERES4G6GW63rHz1/4qLUhmTymf7462FKGlRHfG9WztaIBVrSaB7cRVEX/jnoMsOYdQ98OwsPI7CmBHc6gqv6z0Xlm+nM9VF1XUumvI1AOqvbs2n56dCx3b2ZnmnOriIiIiBhgERERYVMOiY8GW6NjuXtzt7yHAaBkpjNAUJlVzHvKSqRlySDLtwHDDT9WB1VruRFvM7UNLnbcljoWei6V/jvMUq6iQioZN0f27Np+Wv94587mvubmxg8FGGT7HxEREREDLCIiImzVii3dgggEoRYA6GALCMIts5Qb1SGXHgweT1oSbWNbySynrVZlVR1c6Rlk0flTFX+2qoJKS2+zzgJAZme6FwypiIiIiMAAi4iIiLDcGVsAMDaW7dQBF1AOuXSwBVS2vtVDkBWtmNKh1ULh1L6O1rMxExXBFADocAoA2OpHREREBAZYREREhDUPuACgVhXXrKv21MOxiNkyqCumoqFU+EZkLpxi9RQRERERgQEWERERERERERFtVgYPARERERERERERgQEWERERERERERERGGAREREREREREREYYBEREREREREREYEBFhERERERERERERhgERERERERERERGGARERERERERERGBARYREREREREREYEBFhERERERERERERhgERERERERERERgQEWERERERERERGBARYREREREREREREYYBERERERERERERhgERERERERERERgQEWERERERERERERGGAREREREREREREYYBEREREREREREYEBFhERERERERERgQEWERERERERERERGGARERERERERERGBARYREREREREREYEBFhERERERERERERhgERERERERERERGGARERERERERERGBARYREREREREREREYYBERERERERER0eb1/wfhsCA5Y3MmLQAAAABJRU5ErkJggg==";
var RETRO_BOOT_LOGO2 = "data:image/png;base64,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";

// src/client/animations/retro-boot.ts
var DESIGN_W = 1920;
var DESIGN_H = 1080;
var TIMELINE = {
  logoIn: 1500,
  devourStart: 1500,
  devourEnd: 4e3,
  tunnelStart: 2500,
  solidStart: 4900,
  swapStart: 4950,
  swapEnd: 5500,
  logo1End: 7800,
  ditherStart: 7e3,
  shrinkStart: 8400,
  finalStart: 9e3,
  total: 1e4
};
function buildRetroTimeline(totalMs) {
  const k = Math.max(0.1, totalMs / TIMELINE.total);
  const scale = (value) => Math.round(value * k);
  return {
    logoIn: scale(TIMELINE.logoIn),
    devourStart: scale(TIMELINE.devourStart),
    devourEnd: scale(TIMELINE.devourEnd),
    tunnelStart: scale(TIMELINE.tunnelStart),
    solidStart: scale(TIMELINE.solidStart),
    swapStart: scale(TIMELINE.swapStart),
    swapEnd: scale(TIMELINE.swapEnd),
    logo1End: scale(TIMELINE.logo1End),
    ditherStart: scale(TIMELINE.ditherStart),
    shrinkStart: scale(TIMELINE.shrinkStart),
    finalStart: scale(TIMELINE.finalStart),
    total: Math.round(totalMs)
  };
}
var VIOLET = [91, 110, 232];
var PALETTE = [[226, 58, 46], [214, 51, 156], [139, 47, 201]];
var DARK_CROSS = [122, 21, 24];
var DARK_BOX = [94, 15, 18];
var TUNNEL_GREEN = "#45FF85";
function clamp012(value) {
  return Math.min(1, Math.max(0, value));
}
function lerp3(a, b, k) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k)
  ];
}
function mulberry322(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
var CELL = 40;
var COLS = DESIGN_W / CELL;
var ROWS = DESIGN_H / CELL;
function buildDevourCells(seed, tl = TIMELINE) {
  const rnd = mulberry322(seed);
  const phase = rnd() * Math.PI * 2;
  const cells = [];
  const cx = (COLS - 1) / 2;
  const cy = (ROWS - 1) / 2;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const base = clamp012(1 - Math.hypot((col - cx) / cx, (row - cy) / cy) / 1.05);
      const wave = Math.sin(col * 0.55 + row * 1.15 + phase) * 0.18;
      const noise = (rnd() * 2 - 1) * 0.35;
      const birth = tl.devourStart + clamp012(base + wave * 0.5 + noise * 0.55) * (tl.devourEnd - tl.devourStart);
      cells.push({
        x: col * CELL,
        y: row * CELL,
        w: CELL + Math.floor(rnd() * 21),
        h: CELL + Math.floor(rnd() * 21),
        birth,
        v: 0.82 + rnd() * 0.36
      });
    }
  }
  return cells;
}
function buildTunnelLayers(seed, count, tl = TIMELINE) {
  const rnd = mulberry322((seed ^ 2654435769) >>> 0);
  const layers = [];
  for (let k = 0; k < count; k++) {
    layers.push({
      start: tl.tunnelStart + k * 300,
      dur: 1800,
      ox: (rnd() - 0.5) * 90,
      oy: (rnd() - 0.5) * 60
    });
  }
  return layers;
}
var DCELL = 32;
var DCOLS = 60;
var DROWS = 34;
var KEEP_SHEETS = [
  { x0: 130, y0: 320, x1: 640, y1: 760 },
  // left sheet: crosses only
  { x0: 920, y0: 300, x1: 1540, y1: 800 }
  // center-right sheet: boxes only
];
function buildDitherGrid(seed, tl = TIMELINE) {
  const rnd = mulberry322((seed ^ 1597334677) >>> 0);
  const cells = [];
  let maxD = 1;
  for (let row = 0; row < DROWS; row++) {
    for (let col = 0; col < DCOLS; col++) {
      const cx = col * DCELL + DCELL / 2;
      const cy = row * DCELL + DCELL / 2;
      const dTR = Math.hypot((col - (DCOLS - 1)) / (DCOLS - 1), row / (DROWS - 1));
      const keep = KEEP_SHEETS.findIndex((k) => cx >= k.x0 && cx <= k.x1 && cy >= k.y0 && cy <= k.y1);
      let dKeep = Number.POSITIVE_INFINITY;
      for (const k of KEEP_SHEETS) {
        const dx = Math.max(k.x0 - cx, 0, cx - k.x1);
        const dy = Math.max(k.y0 - cy, 0, cy - k.y1);
        dKeep = Math.min(dKeep, Math.hypot(dx, dy));
      }
      if (dKeep < Number.POSITIVE_INFINITY) maxD = Math.max(maxD, dKeep);
      cells.push({
        x: col * DCELL,
        y: row * DCELL,
        pattern: keep >= 0 ? keep : rnd() < 0.5 ? 0 : 1,
        color: PALETTE[Math.floor(rnd() * PALETTE.length)] ?? PALETTE[0],
        birth: tl.ditherStart + clamp012(dTR + (rnd() - 0.5) * 0.25) * (tl.shrinkStart - 200 - tl.ditherStart),
        dKeep,
        keep,
        death: 0
      });
    }
  }
  for (const cell of cells) {
    cell.death = tl.shrinkStart + cell.dKeep / maxD * (tl.finalStart - 80 - tl.shrinkStart) + rnd() * 80;
  }
  return cells;
}
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", () => reject(new Error("retro-boot image failed to load")));
    img.src = src;
  });
}
var RetroBootEngine = class _RetroBootEngine {
  runtime;
  canvas;
  ctx;
  seed;
  tunnelCount;
  finalMask;
  tl;
  k;
  devourCells;
  ditherCells;
  tunnelLayers = [];
  whale;
  word;
  backdrop;
  scale = 1;
  offsetX = 0;
  offsetY = 0;
  startTime = 0;
  completed = false;
  destroyed = false;
  rafId = 0;
  resizeTimer = 0;
  onResize = () => {
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => {
      if (this.destroyed || this.completed) return;
      this.measure();
    }, 200);
  };
  constructor(runtime) {
    this.runtime = runtime;
    const p = runtime.params;
    const layers = _RetroBootEngine.number(p.tunnelLayers, 5);
    this.tunnelCount = Math.round(Math.min(6, Math.max(0, layers)));
    this.finalMask = Math.min(1, Math.max(0, _RetroBootEngine.number(p.finalMask, 0.65)));
    const seed = _RetroBootEngine.number(p.seed, 20261009);
    this.seed = Math.round(Math.min(999999, Math.max(1, seed)));
    const duration = _RetroBootEngine.number(p.durationMs, TIMELINE.total);
    this.tl = buildRetroTimeline(Math.min(12e4, Math.max(5e3, duration)));
    this.k = this.tl.total / TIMELINE.total;
    this.devourCells = buildDevourCells(this.seed, this.tl);
    this.ditherCells = buildDitherGrid(this.seed, this.tl);
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
    runtime.container.append(this.canvas);
    window.addEventListener("resize", this.onResize);
  }
  start() {
    void this.loadAssets();
  }
  skip() {
    if (this.destroyed || this.completed) return;
    this.cancelRaf();
    this.renderFrame(this.tl.total);
    this.markCompleted();
  }
  destroy() {
    this.destroyed = true;
    this.cancelRaf();
    window.clearTimeout(this.resizeTimer);
    window.removeEventListener("resize", this.onResize);
    this.canvas.remove();
  }
  markCompleted() {
    if (this.completed) return;
    this.completed = true;
    this.runtime.complete();
  }
  cancelRaf() {
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }
  async loadAssets() {
    try {
      const [whale, word] = await Promise.all([loadImage(RETRO_BOOT_LOGO1), loadImage(RETRO_BOOT_LOGO2)]);
      if (this.destroyed) return;
      this.whale = whale;
      this.word = word;
      this.runtime.markLoaded?.();
      this.backdrop = await loadImage(this.runtime.media.url).catch(() => void 0);
      if (this.destroyed) return;
      if (this.runtime.reducedMotion) {
        this.renderFrame(this.tl.total);
        this.markCompleted();
        return;
      }
      this.tunnelLayers = buildTunnelLayers(this.seed, this.tunnelCount);
      this.measure();
      this.startTime = performance.now();
      this.rafId = requestAnimationFrame(this.frame);
    } catch (err) {
      if (!this.destroyed && !this.completed) this.runtime.fail(err);
    }
  }
  measure() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vw = this.runtime.container.clientWidth || window.innerWidth;
    const vh = this.runtime.container.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(vw * dpr);
    this.canvas.height = Math.round(vh * dpr);
    this.scale = Math.min(this.canvas.width / DESIGN_W, this.canvas.height / DESIGN_H);
    this.offsetX = (this.canvas.width - DESIGN_W * this.scale) / 2;
    this.offsetY = (this.canvas.height - DESIGN_H * this.scale) / 2;
  }
  frame = (now) => {
    if (this.destroyed || this.completed) return;
    const elapsed = now - this.startTime;
    if (elapsed >= this.tl.total) {
      this.renderFrame(this.tl.total);
      this.markCompleted();
      return;
    }
    this.renderFrame(elapsed);
    this.rafId = requestAnimationFrame(this.frame);
  };
  /* One composed frame at design coordinates; pure in `t` for a fixed seed. */
  renderFrame(t) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);
    ctx.beginPath();
    ctx.rect(0, 0, DESIGN_W, DESIGN_H);
    ctx.clip();
    this.drawBackdrop(t);
    this.drawDevour(t);
    this.drawTunnel(t);
    if (t >= this.tl.solidStart) {
      ctx.globalAlpha = Math.min(1, (t - this.tl.solidStart) / (300 * this.k));
      ctx.fillStyle = `rgb(${VIOLET.join(",")})`;
      ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
      ctx.globalAlpha = 1;
    }
    this.drawWhale(t);
    this.drawWordmark(t);
    const curtain = clamp012((t - this.tl.shrinkStart) / (400 * this.k));
    if (curtain > 0) {
      ctx.globalAlpha = curtain;
      this.drawBackdropSheet();
      ctx.globalAlpha = 1;
    }
    this.drawDither(t);
    ctx.restore();
  }
  drawBackdrop(t) {
    if (this.backdrop === void 0 || t >= this.tl.solidStart + 300 * this.k) return;
    const img = this.backdrop;
    const cover = Math.max(DESIGN_W / img.naturalWidth, DESIGN_H / img.naturalHeight);
    const w = img.naturalWidth * cover;
    const h = img.naturalHeight * cover;
    this.ctx.save();
    this.ctx.globalAlpha = Math.min(t / 1200, 1) * 0.55;
    this.ctx.drawImage(img, DESIGN_W / 2 - w / 2, DESIGN_H / 2 - h / 2, w, h);
    this.ctx.restore();
  }
  drawDevour(t) {
    if (t < this.tl.devourStart) return;
    const ctx = this.ctx;
    for (const cell of this.devourCells) {
      if (t < cell.birth) continue;
      ctx.fillStyle = `rgb(${Math.round(91 * cell.v)},${Math.round(110 * cell.v)},${Math.round(232 * cell.v)})`;
      ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
      const age = t - cell.birth;
      if (age < 90) {
        ctx.fillStyle = `rgba(215,224,255,${(1 - age / 90) * 0.8})`;
        ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
      }
    }
  }
  drawTunnel(t) {
    if (t < this.tl.tunnelStart) return;
    const fade = 1 - clamp012((t - this.tl.solidStart) / (400 * this.k));
    if (fade <= 0) return;
    const ctx = this.ctx;
    ctx.strokeStyle = TUNNEL_GREEN;
    for (const layer of this.tunnelLayers) {
      const p = (t - layer.start) / layer.dur;
      if (p <= 0 || p >= 1) continue;
      const scale = 0.06 + p * p * 3.3;
      const w = DESIGN_W * scale;
      const h = DESIGN_H * scale;
      ctx.globalAlpha = Math.min(1, p * 9) * (1 - p * 0.45) * fade;
      ctx.lineWidth = 2;
      ctx.strokeRect(DESIGN_W / 2 - w / 2 + layer.ox * p, DESIGN_H / 2 - h / 2 + layer.oy * p, w, h);
    }
    ctx.globalAlpha = 1;
  }
  /** Opening whale (embedded bare-whale asset): awake, breathing, white-glow. */
  drawWhale(t) {
    if (this.whale === void 0 || t >= this.tl.swapEnd) return;
    const p = clamp012(t / this.tl.logoIn);
    const ease = 1 - Math.pow(1 - p, 3);
    let alpha = ease;
    let scale = 0.95 + 0.05 * ease;
    let glow = 18 * ease;
    if (t > this.tl.logoIn) {
      const ph = (t - this.tl.logoIn) / (2400 * this.k) * Math.PI * 2;
      alpha = 0.9 + 0.1 * Math.sin(ph);
      scale = 1;
      glow = 16 + 10 * (0.5 + 0.5 * Math.sin(ph));
    }
    if (t > this.tl.swapStart) alpha *= 1 - (t - this.tl.swapStart) / (this.tl.swapEnd - this.tl.swapStart);
    const w = 640 * scale;
    const h = w * 675 / 1200;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;
    ctx.shadowColor = t < this.tl.devourStart ? "rgba(90,140,255,0.9)" : "rgba(255,255,255,0.85)";
    ctx.shadowBlur = glow * this.scale;
    ctx.drawImage(this.whale, DESIGN_W / 2 - w / 2, DESIGN_H / 2 - h / 2, w, h);
    ctx.drawImage(this.whale, DESIGN_W / 2 - w / 2, DESIGN_H / 2 - h / 2, w, h);
    ctx.restore();
  }
  /** Mid-run wordmark (embedded whale+word asset) under a breathing white glow. */
  drawWordmark(t) {
    if (this.word === void 0 || t < this.tl.swapStart || t > this.tl.logo1End) return;
    let alpha = clamp012((t - this.tl.swapStart) / (this.tl.swapEnd - this.tl.swapStart));
    if (t > this.tl.ditherStart) alpha *= 1 - clamp012((t - this.tl.ditherStart) / (600 * this.k));
    const ph = t / (2400 * this.k) * Math.PI * 2;
    alpha *= 0.9 + 0.1 * Math.sin(ph);
    const size = 880;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;
    ctx.shadowColor = "rgba(255,255,255,0.85)";
    ctx.shadowBlur = (22 + 10 * (0.5 + 0.5 * Math.sin(ph))) * this.scale;
    ctx.drawImage(this.word, DESIGN_W / 2 - size / 2, DESIGN_H / 2 - size / 2, size, size);
    ctx.drawImage(this.word, DESIGN_W / 2 - size / 2, DESIGN_H / 2 - size / 2, size, size);
    ctx.restore();
  }
  /* End-of-run backdrop: the user picture under an adjustable dark veil
   * (falls back to plain black when the picture is unavailable). */
  drawBackdropSheet() {
    const ctx = this.ctx;
    if (this.backdrop !== void 0) {
      const img = this.backdrop;
      const cover = Math.max(DESIGN_W / img.naturalWidth, DESIGN_H / img.naturalHeight);
      const w = img.naturalWidth * cover;
      const h = img.naturalHeight * cover;
      ctx.drawImage(img, (DESIGN_W - w) / 2, (DESIGN_H - h) / 2, w, h);
    }
    if (this.finalMask > 0) {
      ctx.fillStyle = `rgba(0,0,0,${this.finalMask})`;
      ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
    }
    if (this.backdrop === void 0 && this.finalMask < 1) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
    }
  }
  drawDither(t) {
    if (t < this.tl.ditherStart) return;
    const ctx = this.ctx;
    const finalK = clamp012((t - (this.tl.finalStart - 200 * this.k)) / (600 * this.k));
    for (const cell of this.ditherCells) {
      if (t < cell.birth) continue;
      if (cell.keep < 0 && t >= cell.death) continue;
      let rgb = lerp3(VIOLET, cell.color, clamp012((t - cell.birth) / (450 * this.k)));
      if (cell.keep >= 0 && finalK > 0) rgb = lerp3(rgb, cell.pattern === 0 ? DARK_CROSS : DARK_BOX, finalK);
      const color = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      if (cell.pattern === 0) {
        ctx.fillRect(cell.x + 1, cell.y + 11, 30, 10);
        ctx.fillRect(cell.x + 11, cell.y + 1, 10, 30);
      } else {
        ctx.lineWidth = 3;
        ctx.strokeRect(cell.x + 3.5, cell.y + 3.5, 25, 25);
        ctx.lineWidth = 2;
        ctx.strokeRect(cell.x + 11.5, cell.y + 11.5, 9, 9);
      }
    }
  }
  static number(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }
};
var retroBootAnimation = {
  id: "retro-boot",
  kind: "image",
  labelKey: "anim.retro-boot.label",
  descriptionKey: "anim.retro-boot.desc",
  paramsSchema: {
    durationMs: { type: "number", default: 1e4, min: 5e3, max: 12e4, step: 500 },
    finalMask: { type: "number", default: 0.65, min: 0, max: 1, step: 0.05 },
    tunnelLayers: { type: "number", default: 5, min: 0, max: 6, step: 1 },
    seed: { type: "number", default: 20261009, min: 1, max: 999999, step: 1 },
    bg: { type: "enum", default: "#000000", options: ["#000000", "#04050e", "#0a0a14"] }
  },
  create: (runtime) => new RetroBootEngine(runtime)
};

// src/client/animations/tap-reveal.ts
var RADIUS_PAD = 8;
var TRANSITION_BACKSTOP_MS = 150;
var TapRevealEngine = class _TapRevealEngine {
  runtime;
  root;
  img;
  hint;
  revealMs;
  completed = false;
  destroyed = false;
  revealStarted = false;
  backstopTimer = 0;
  onImgLoad = () => {
    if (this.destroyed) return;
    this.runtime.markLoaded?.();
    whenDecoded(this.img, () => {
      if (this.destroyed) return;
      this.root.style.background = extractDominantColor(this.img);
      if (this.runtime.reducedMotion) {
        this.showFull();
        this.markCompleted();
        return;
      }
      this.hint.classList.add("dsh-opening-hint-show");
    });
  };
  onImgError = () => {
    if (!this.destroyed && !this.completed) this.runtime.fail(new Error("opening image failed to load"));
  };
  onClick = (event) => {
    event.stopPropagation();
    if (this.destroyed || this.completed || this.revealStarted) return;
    if (!(this.img.complete && this.img.naturalWidth > 0)) return;
    this.startReveal(event.clientX, event.clientY);
  };
  constructor(runtime) {
    this.runtime = runtime;
    const p = runtime.params;
    this.revealMs = _TapRevealEngine.number(p.revealMs, 900);
    this.root = document.createElement("div");
    this.root.className = "dsh-opening-tap";
    this.img = document.createElement("img");
    this.img.className = "dsh-opening-tap-img";
    this.img.alt = "";
    this.hint = document.createElement("div");
    this.hint.className = "dsh-opening-hint";
    this.hint.textContent = runtime.t("tap.hint");
    this.root.append(this.img, this.hint);
    runtime.container.append(this.root);
    this.img.addEventListener("load", this.onImgLoad);
    this.img.addEventListener("error", this.onImgError);
    this.root.addEventListener("click", this.onClick);
  }
  start() {
    this.img.src = this.runtime.media.url;
  }
  skip() {
    if (this.destroyed || this.completed) return;
    window.clearTimeout(this.backstopTimer);
    if (this.img.complete && this.img.naturalWidth > 0) this.showFull();
    this.markCompleted();
  }
  destroy() {
    this.destroyed = true;
    window.clearTimeout(this.backstopTimer);
    this.img.removeEventListener("load", this.onImgLoad);
    this.img.removeEventListener("error", this.onImgError);
    this.root.removeEventListener("click", this.onClick);
    this.root.remove();
  }
  markCompleted() {
    if (this.completed) return;
    this.completed = true;
    this.runtime.complete();
  }
  /* material-vcard reveal: clip-path circle from the click point + slight zoom-out. */
  startReveal(clientX, clientY) {
    this.revealStarted = true;
    this.dismissHint();
    const rect = this.root.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(clientY - rect.top, rect.height));
    const radius = Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y)) + RADIUS_PAD;
    const from = `circle(0px at ${x.toFixed(1)}px ${y.toFixed(1)}px)`;
    const to = `circle(${radius.toFixed(1)}px at ${x.toFixed(1)}px ${y.toFixed(1)}px)`;
    this.root.style.setProperty("--dsh-tap-reveal-ms", `${Math.round(this.revealMs)}ms`);
    this.img.style.clipPath = from;
    this.img.style.transform = "scale(1.08)";
    void this.img.offsetWidth;
    this.img.classList.add("dsh-opening-tap-run");
    this.img.style.clipPath = to;
    this.img.style.transform = "scale(1)";
    this.backstopTimer = window.setTimeout(() => {
      this.showFull();
      this.markCompleted();
    }, Math.round(this.revealMs) + TRANSITION_BACKSTOP_MS);
  }
  /* Fast fade of the center hint; the base transition (600ms) is too slow
     once the reveal has started. */
  dismissHint() {
    this.hint.classList.remove("dsh-opening-hint-show");
    this.hint.classList.add("dsh-opening-hint-hide");
  }
  /* Freeze on the full picture (skip / reduced motion / reveal settled). */
  showFull() {
    if (!(this.img.complete && this.img.naturalWidth > 0)) return;
    this.img.classList.remove("dsh-opening-tap-run");
    this.img.style.clipPath = "none";
    this.img.style.transform = "none";
    this.dismissHint();
  }
  static number(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }
};
var tapRevealAnimation = {
  id: "tap-reveal",
  kind: "image",
  labelKey: "anim.tap-reveal.label",
  descriptionKey: "anim.tap-reveal.desc",
  paramsSchema: {
    revealMs: { type: "number", default: 900, min: 400, max: 3e3, step: 100 }
  },
  create: (runtime) => new TapRevealEngine(runtime)
};

// src/client/animations/video-player.ts
var VideoPlayerEngine = class _VideoPlayerEngine {
  runtime;
  video;
  completed = false;
  destroyed = false;
  onEnded = () => {
    if (this.destroyed || this.completed) return;
    this.markCompleted();
  };
  onError = () => {
    if (this.destroyed || this.completed) return;
    this.runtime.fail(new Error("video element raised an error"));
  };
  constructor(runtime) {
    this.runtime = runtime;
    const p = runtime.params;
    const fit = p.fit === "contain" ? "contain" : "cover";
    const scale = _VideoPlayerEngine.number(p.scale, 1);
    const offsetX = _VideoPlayerEngine.number(p.offsetX, 0);
    const offsetY = _VideoPlayerEngine.number(p.offsetY, 0);
    this.video = document.createElement("video");
    this.video.src = runtime.media.url;
    this.video.autoplay = true;
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.style.objectFit = fit;
    this.video.style.transform = `translate(${offsetX}%, ${offsetY}%) scale(${scale})`;
    runtime.container.append(this.video);
    this.video.addEventListener("ended", this.onEnded);
    this.video.addEventListener("error", this.onError);
  }
  start() {
    this.playWithRetry(1);
  }
  skip() {
    if (this.destroyed || this.completed) return;
    try {
      this.video.pause();
    } catch {
    }
    this.markCompleted();
  }
  destroy() {
    this.destroyed = true;
    this.video.removeEventListener("ended", this.onEnded);
    this.video.removeEventListener("error", this.onError);
    try {
      this.video.pause();
      this.video.removeAttribute("src");
      this.video.load();
    } catch {
    }
    this.video.remove();
  }
  playWithRetry(retries) {
    if (this.destroyed || this.completed) return;
    void this.video.play().catch(() => {
      if (this.destroyed || this.completed) return;
      if (retries <= 0) {
        this.runtime.fail(new Error("video play() rejected repeatedly"));
        return;
      }
      window.setTimeout(() => {
        this.playWithRetry(retries - 1);
      }, 150);
    });
  }
  markCompleted() {
    if (this.completed) return;
    this.completed = true;
    this.runtime.complete();
  }
  static number(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }
};
var videoPlayerAnimation = {
  id: "video-player",
  kind: "video",
  labelKey: "anim.video-player.label",
  descriptionKey: "anim.video-player.desc",
  paramsSchema: {
    fit: { type: "enum", default: "cover", options: ["cover", "contain"] },
    scale: { type: "number", default: 1, min: 0.1, max: 3, step: 0.05 },
    offsetX: { type: "number", default: 0, min: -100, max: 100, step: 1 },
    offsetY: { type: "number", default: 0, min: -100, max: 100, step: 1 }
  },
  create: (runtime) => new VideoPlayerEngine(runtime)
};

// src/client/animations/wipe-reveal.ts
var easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
var easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
var WipeRevealEngine = class _WipeRevealEngine {
  runtime;
  root;
  reveal;
  img;
  wipeInMs;
  expandMs;
  imgScale;
  /** Picture left edge in % of the viewport: |1-s| ratio rule (see header). */
  baseLeft;
  startTime = 0;
  completed = false;
  destroyed = false;
  rafId = 0;
  onImgLoad = () => {
    if (this.destroyed) return;
    this.runtime.markLoaded?.();
    whenDecoded(this.img, () => {
      if (this.destroyed) return;
      this.root.style.background = extractDominantColor(this.img);
      if (this.runtime.reducedMotion) {
        this.showFinal();
        this.markCompleted();
        return;
      }
      this.beginRun();
    });
  };
  onImgError = () => {
    if (!this.destroyed && !this.completed) this.runtime.fail(new Error("opening image failed to load"));
  };
  constructor(runtime) {
    this.runtime = runtime;
    const p = runtime.params;
    this.wipeInMs = _WipeRevealEngine.number(p.wipeInMs, 1400);
    this.expandMs = _WipeRevealEngine.number(p.expandMs, 1100);
    this.imgScale = _WipeRevealEngine.clamp(_WipeRevealEngine.number(p.imgScale, 1.3), 0, 2);
    const k = Math.abs(1 - this.imgScale);
    this.baseLeft = k / (1 + k) * 100;
    this.root = document.createElement("div");
    this.root.className = "dsh-opening-wipe";
    this.reveal = document.createElement("div");
    this.reveal.className = "dsh-opening-wipe-reveal";
    this.img = document.createElement("img");
    this.img.className = "dsh-opening-wipe-img";
    this.img.alt = "";
    this.reveal.append(this.img);
    this.root.append(this.reveal);
    this.reveal.style.left = `${this.baseLeft}%`;
    this.reveal.style.width = "0%";
    this.img.style.transform = `scale(${this.imgScale})`;
    runtime.container.append(this.root);
    this.img.addEventListener("load", this.onImgLoad);
    this.img.addEventListener("error", this.onImgError);
  }
  start() {
    this.img.src = this.runtime.media.url;
  }
  skip() {
    if (this.destroyed || this.completed) return;
    this.cancelRaf();
    if (this.img.complete && this.img.naturalWidth > 0) this.showFinal();
    this.markCompleted();
  }
  destroy() {
    this.destroyed = true;
    this.cancelRaf();
    this.img.removeEventListener("load", this.onImgLoad);
    this.img.removeEventListener("error", this.onImgError);
    this.root.remove();
  }
  markCompleted() {
    if (this.completed) return;
    this.completed = true;
    this.runtime.complete();
  }
  cancelRaf() {
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }
  frame = (now) => {
    if (this.destroyed || this.completed) return;
    const t = now - this.startTime;
    if (t < this.wipeInMs) {
      const e = easeOutCubic(Math.min(1, t / this.wipeInMs));
      this.reveal.style.width = `${this.imgScale * 100 * e}%`;
    } else if (t < this.wipeInMs + this.expandMs) {
      const e = easeInOutCubic((t - this.wipeInMs) / this.expandMs);
      this.reveal.style.left = `${this.baseLeft * (1 - e)}%`;
      this.reveal.style.width = `${(this.imgScale + (1 - this.imgScale) * e) * 100}%`;
      this.img.style.transform = `scale(${this.imgScale + (1 - this.imgScale) * e})`;
    } else {
      this.showFinal();
      this.markCompleted();
      return;
    }
    this.rafId = requestAnimationFrame(this.frame);
  };
  beginRun() {
    this.cancelRaf();
    this.startTime = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }
  /* Freeze on the full-screen backdrop picture (skip / reduced motion / end). */
  showFinal() {
    if (!(this.img.complete && this.img.naturalWidth > 0)) return;
    this.cancelRaf();
    this.reveal.style.left = "0%";
    this.reveal.style.width = "100%";
    this.img.style.transform = "scale(1)";
  }
  static number(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }
  static clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
};
var wipeRevealAnimation = {
  id: "wipe-reveal",
  kind: "image",
  labelKey: "anim.wipe-reveal.label",
  descriptionKey: "anim.wipe-reveal.desc",
  paramsSchema: {
    wipeInMs: { type: "number", default: 1400, min: 400, max: 5e3, step: 100 },
    expandMs: { type: "number", default: 1100, min: 300, max: 5e3, step: 100 },
    imgScale: { type: "number", default: 1.3, min: 0, max: 2, step: 0.05 }
  },
  create: (runtime) => new WipeRevealEngine(runtime)
};

// src/client/registry.ts
var animations = /* @__PURE__ */ new Map();
function registerAnimation(def) {
  animations.set(def.id, def);
  return () => {
    animations.delete(def.id);
  };
}
function resolveAnimation(kind, id) {
  const def = animations.get(id);
  return def !== void 0 && def.kind === kind ? def : void 0;
}
function listAnimations(kind) {
  const all = [...animations.values()];
  return kind === void 0 ? all : all.filter((def) => def.kind === kind);
}
function resolveAnimationParams(animation, overrides) {
  const merged = {};
  for (const [key, spec] of Object.entries(animation.paramsSchema ?? {})) {
    const override = overrides?.[key];
    if (spec.type === "number" && typeof override === "number" && Number.isFinite(override)) {
      merged[key] = clampToSpec(override, spec);
    } else if (spec.type === "enum" && typeof override === "string" && spec.options?.includes(override) === true) {
      merged[key] = override;
    } else if (spec.type === "string" && typeof override === "string") {
      merged[key] = override;
    } else {
      merged[key] = spec.default;
    }
  }
  return merged;
}
function clampToSpec(value, spec) {
  const min = spec.min ?? value;
  const max = spec.max ?? value;
  return Math.min(max, Math.max(min, value));
}
registerAnimation(poolAnimation);
registerAnimation(codeRainAnimation);
registerAnimation(gridRevealSpreadAnimation);
registerAnimation(retroBootAnimation);
registerAnimation(tapRevealAnimation);
registerAnimation(videoPlayerAnimation);
registerAnimation(wipeRevealAnimation);

// src/client/transitions.ts
var presets = /* @__PURE__ */ new Map();
function registerTransition(preset) {
  presets.set(preset.id, preset);
  return () => {
    presets.delete(preset.id);
  };
}
function listTransitions() {
  return [...presets.values()];
}
function getTransition(id) {
  const preset = presets.get(id);
  if (preset !== void 0) return preset;
  console.warn(`[dsh-opening-animation] unknown transition "${id}", falling back to cross-fade`);
  return presets.get("cross-fade");
}
registerTransition({
  id: "cross-fade",
  labelKey: "trans.cross-fade.label",
  exitMs: 700,
  enterDelayMs: 0,
  enterMs: 700,
  exitClass: "dsh-opening-exit-cross-fade"
});
registerTransition({
  id: "dip-to-bg",
  labelKey: "trans.dip-to-bg.label",
  exitMs: 450,
  enterDelayMs: 250,
  enterMs: 600,
  exitClass: "dsh-opening-exit-dip-to-bg"
});
registerTransition({
  id: "zoom-fade",
  labelKey: "trans.zoom-fade.label",
  exitMs: 650,
  enterDelayMs: 0,
  enterMs: 650,
  exitClass: "dsh-opening-exit-zoom-fade",
  enterTransform: "translateY(8px)"
});

// src/client/controller.ts
var MAX_MEDIA = 8;
var MAX_IMAGE_BYTES = 20 * 1024 * 1024;
var MAX_VIDEO_BYTES = 256 * 1024 * 1024;
var IMAGE_TYPES = /* @__PURE__ */ new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
var VIDEO_TYPES = /* @__PURE__ */ new Set(["video/mp4", "video/webm", "video/x-matroska"]);
var SKIN_DB_NAME = "dsh-custom-skin";
var SKIN_STORE = "wallpapers";
var SKIN_MAX_IMAGES = 24;
var clamp2 = (value, min, max) => Math.min(max, Math.max(min, value));
var kindOfType = (type) => VIDEO_TYPES.has(type) ? "video" : "image";
function videoSupported(type) {
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
var playedThisDocument = false;
var OpeningController = class {
  snapshot;
  listeners = /* @__PURE__ */ new Set();
  objectUrls = /* @__PURE__ */ new Map();
  records = /* @__PURE__ */ new Map();
  database;
  initialization;
  queue = Promise.resolve();
  disposed = false;
  activeRunner;
  t = (key) => key;
  constructor(earlyPrefs2) {
    this.snapshot = {
      ready: false,
      enabled: earlyPrefs2.enabled,
      media: [],
      activeId: earlyPrefs2.activeId,
      animationByKind: { ...earlyPrefs2.animationByKind },
      transitionId: earlyPrefs2.transitionId,
      transitionScale: earlyPrefs2.transitionScale,
      maxDurationMs: earlyPrefs2.maxDurationMs,
      showSkipHint: earlyPrefs2.showSkipHint,
      skinHandoff: earlyPrefs2.skinHandoff,
      paramOverrides: earlyPrefs2.paramOverrides,
      playing: false
    };
  }
  /** Inject the locale-bound translate function (called once from apply). */
  attachLocale(t) {
    this.t = t;
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  initialize() {
    this.initialization ??= this.load();
    return this.initialization;
  }
  async load() {
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
          url: this.createUrl(record.id, record.blob)
        };
      });
      const activeId = this.snapshot.activeId !== void 0 && media.some((item) => item.id === this.snapshot.activeId) ? this.snapshot.activeId : void 0;
      this.publish({ ...this.snapshot, ready: true, media, activeId });
      this.persist();
      if (!playedThisDocument && this.snapshot.enabled && this.snapshot.activeId !== void 0) {
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
  async addFiles(files) {
    const accepted = [];
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
      if (this.database === void 0) {
        this.publish({ ...this.snapshot, error: "storage" });
        return;
      }
      const capacity = Math.max(0, MAX_MEDIA - this.snapshot.media.length);
      const batch = accepted.slice(0, capacity);
      if (batch.length === 0) {
        this.publish({ ...this.snapshot, error: "invalid-file" });
        return;
      }
      const records = batch.map(({ file }, index) => ({
        id: makeId(),
        name: file.name,
        type: file.type,
        blob: file,
        createdAt: Date.now() + index
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
          url: this.createUrl(record.id, record.blob)
        };
      }).reverse();
      const first = added[0];
      this.publish({
        ...this.snapshot,
        media: [...added, ...this.snapshot.media],
        activeId: this.snapshot.activeId ?? first?.id,
        error: skipped ? codecError ? "unsupported-codec" : "invalid-file" : void 0
      });
      this.persist();
      if (this.snapshot.skinHandoff) {
        void this.handOffToSkin(records.filter((record) => kindOfType(record.type) === "image"));
      }
    }, "mutation");
  }
  async remove(id) {
    return this.enqueue(async () => {
      if (this.disposed || this.database === void 0) return;
      const transaction = this.database.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).delete(id);
      await transactionDone(transaction);
      this.records.delete(id);
      const url = this.objectUrls.get(id);
      if (url !== void 0) URL.revokeObjectURL(url);
      this.objectUrls.delete(id);
      this.publish({
        ...this.snapshot,
        media: this.snapshot.media.filter((item) => item.id !== id),
        activeId: this.snapshot.activeId === id ? void 0 : this.snapshot.activeId,
        error: void 0
      });
      this.persist();
    }, "mutation");
  }
  async clear() {
    return this.enqueue(async () => {
      if (this.disposed || this.database === void 0) return;
      const transaction = this.database.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).clear();
      await transactionDone(transaction);
      this.records.clear();
      for (const url of this.objectUrls.values()) URL.revokeObjectURL(url);
      this.objectUrls.clear();
      this.publish({ ...this.snapshot, media: [], activeId: void 0, error: void 0 });
      this.persist();
    }, "mutation");
  }
  select(id) {
    if (!this.snapshot.media.some((item) => item.id === id)) return;
    this.update({ activeId: id, error: void 0 });
  }
  setEnabled(enabled) {
    this.update({ enabled });
  }
  setAnimation(kind, animId) {
    if (resolveAnimation(kind, animId) === void 0) return;
    this.update({ animationByKind: { ...this.snapshot.animationByKind, [kind]: animId } });
  }
  setTransition(id) {
    this.update({ transitionId: getTransition(id).id });
  }
  setTransitionScale(scale) {
    if (!Number.isFinite(scale)) return;
    this.update({ transitionScale: clamp2(scale, 0.5, 2) });
  }
  setMaxDuration(maxDurationMs) {
    if (!Number.isFinite(maxDurationMs)) return;
    this.update({ maxDurationMs: clamp2(maxDurationMs, 3e3, 12e4) });
  }
  setSkipHint(showSkipHint) {
    this.update({ showSkipHint });
  }
  setSkinHandoff(skinHandoff) {
    this.update({ skinHandoff });
  }
  setParam(animId, key, value) {
    const overrides = { ...this.snapshot.paramOverrides };
    const entries = { ...overrides[animId], [key]: value };
    overrides[animId] = entries;
    this.update({ paramOverrides: overrides });
  }
  /** Restore behavior defaults; the media library and the active selection survive. */
  reset() {
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
      error: void 0
    });
    this.persist();
  }
  /** Replay the current configuration immediately (independent of the once-per-document guard).
   * A preview is an explicit request to watch the animation, so it plays even under
   * prefers-reduced-motion; only the unattended startup playback honors the setting. */
  preview() {
    if (this.disposed || this.activeRunner !== void 0) return;
    if (this.snapshot.activeId === void 0) return;
    this.playOnce(true);
  }
  dispose() {
    this.disposed = true;
    this.activeRunner?.abort();
    this.activeRunner = void 0;
    this.database?.close();
    this.database = void 0;
    for (const url of this.objectUrls.values()) URL.revokeObjectURL(url);
    this.objectUrls.clear();
    this.records.clear();
    this.listeners.clear();
  }
  playOnce(forceMotion = false) {
    if (this.disposed || this.activeRunner !== void 0) return;
    const snapshot = this.snapshot;
    const activeId = snapshot.activeId;
    if (activeId === void 0) {
      this.teardownPending();
      return;
    }
    const record = this.records.get(activeId);
    if (record === void 0) {
      this.teardownPending();
      return;
    }
    const kind = kindOfType(record.type);
    const animation = resolveAnimation(kind, snapshot.animationByKind[kind]);
    if (animation === void 0) {
      this.teardownPending();
      return;
    }
    let url;
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
        this.activeRunner = void 0;
        if (!this.disposed) this.publish({ ...this.snapshot, playing: false });
      }
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
  teardownPending() {
    delete document.documentElement.dataset.dshOpeningPending;
    removeCriticalStyles();
  }
  mergeParams(animation) {
    return resolveAnimationParams(animation, this.snapshot.paramOverrides[animation.id]);
  }
  /** ADR-006: one-way copy of images into the wallpaper plugin's library. Best-effort, silent on failure. */
  async handOffToSkin(records) {
    if (records.length === 0) return;
    let database = null;
    try {
      const opened = await new Promise((resolve, reject) => {
        const request = indexedDB.open(SKIN_DB_NAME);
        request.onupgradeneeded = () => {
          try {
            request.transaction?.abort();
          } catch {
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("skin database unavailable"));
      });
      database = opened;
      const count = await new Promise((resolve, reject) => {
        const transaction = opened.transaction(SKIN_STORE, "readonly");
        const request = transaction.objectStore(SKIN_STORE).count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("skin count failed"));
      });
      const capacity = Math.max(0, SKIN_MAX_IMAGES - count);
      const batch = records.slice(0, capacity);
      if (batch.length === 0) return;
      await new Promise((resolve, reject) => {
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
  update(patch) {
    this.publish({ ...this.snapshot, ...patch });
    this.persist();
  }
  enqueue(operation, error) {
    this.queue = this.queue.catch(() => {
    }).then(async () => {
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
  publish(snapshot) {
    if (this.disposed) return;
    const activeKind = snapshot.activeId !== void 0 ? snapshot.media.find((item) => item.id === snapshot.activeId)?.kind : void 0;
    this.snapshot = Object.freeze({ ...snapshot, media: Object.freeze([...snapshot.media]), activeKind });
    for (const listener of this.listeners) listener();
  }
  persist() {
    const s = this.snapshot;
    const prefs = {
      enabled: s.enabled,
      activeId: s.activeId,
      animationByKind: { ...s.animationByKind },
      transitionId: s.transitionId,
      transitionScale: s.transitionScale,
      maxDurationMs: s.maxDurationMs,
      showSkipHint: s.showSkipHint,
      paramOverrides: Object.fromEntries(Object.entries(s.paramOverrides).map(([key, value]) => [key, { ...value }])),
      skinHandoff: s.skinHandoff
    };
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
    }
  }
  createUrl(id, blob) {
    const url = URL.createObjectURL(blob);
    this.objectUrls.set(id, url);
    return url;
  }
};

// src/client/locales.ts
var NS = "dsh.opening-animation";
var en = {
  nav: "Opening animation",
  title: "Opening animation",
  intro: "Play your own image animation or video each time DSH Web loads, then hand the screen back to the interface with a transition. Media stays in this browser and is never uploaded.",
  upload: "Add media",
  uploadHint: "Choose or drop JPG, PNG, WebP, GIF, or AVIF images (up to 20 MB) and MP4, WebM, or MKV videos (up to 256 MB).",
  empty: "No media yet. Add an image or video to get started.",
  active: "Active",
  use: "Use",
  remove: "Remove",
  removeConfirm: "Delete this media from local storage?",
  clear: "Delete all media",
  clearConfirm: "Delete every saved media file from this browser?",
  loading: "Loading local media\u2026",
  storageError: "This browser could not open local media storage.",
  invalidFile: "Some files were skipped: unsupported format or over the size limit.",
  codecError: "Some videos were skipped: this browser cannot decode their encoding.",
  mutationError: "The local media library could not be updated.",
  preview: "Preview opening",
  reset: "Reset behavior",
  enabled: "Play on startup",
  enabledHint: "Play the opening animation each time DSH Web loads.",
  skipHint: "Show skip hint",
  skipHintHint: "Display the \u201Cclick anywhere to skip\u201D note during playback.",
  maxDuration: "Image time limit",
  maxDurationHint: "A safety cut-off only: actual playback length comes from the selected animation's Duration (ms) parameter; an animation is cut only if it runs past this. Videos always play to the end.",
  transition: "Hand-off transition",
  transitionSpeed: "Transition speed",
  animationLabel: "Image animation",
  animationHint: "Applies when the active media is an image.",
  advanced: "Advanced parameters",
  videoFit: "Video fit",
  cover: "Fill screen",
  contain: "Show full frame",
  kindImage: "Image",
  kindVideo: "Video",
  skinHandoff: "Also add uploaded images to the wallpaper library",
  skinHandoffHint: "When the wallpaper plugin is installed, uploaded images are copied into its library. It never changes your active wallpaper.",
  "anim.pool.label": "Pool",
  "anim.pool.desc": "Your picture rests still like the surface of a pool; sweeping the pointer across it leaves refracting ripples with a soft glint, while drifting dust, film grain and edge pulses play on top and caption lines light up word by word below.",
  "anim.code-rain.label": "Code rain",
  "anim.code-rain.desc": "The picture covers the screen at once while green code rain falls over it and rolls out through the bottom.",
  "anim.grid-reveal-spread.label": "Grid reveal \xB7 spread",
  "anim.grid-reveal-spread.desc": "Waits on the backdrop; click (or wait) and the picture spreads out from your pointer.",
  "anim.retro-boot.label": "Retro boot",
  "anim.retro-boot.desc": "A ten-second retro boot sequence: the whale logo glows awake over your dimmed picture, pixel blocks devour the screen, a green tunnel expands, then a halftone sweep freezes on dark-red grids.",
  "anim.tap-reveal.label": "Tap reveal",
  "anim.tap-reveal.desc": "Waits on the picture's dominant color; click anywhere and the picture blooms out of the click point.",
  "anim.wipe-reveal.label": "Wipe reveal",
  "anim.wipe-reveal.desc": "Dominant-color backdrop; a wipe shows the picture's left part, then expands until the picture covers the page.",
  "anim.video-player.label": "Video",
  "anim.video-player.desc": "Play the selected video muted; the interface returns when it finishes.",
  "trans.cross-fade.label": "Cross fade",
  "trans.dip-to-bg.label": "Dip to background",
  "trans.zoom-fade.label": "Zoom fade",
  "skip.hint": "CLICK ANYWHERE TO SKIP \xB7 \u70B9\u51FB\u4EFB\u610F\u5904\u8DF3\u8FC7",
  "tap.hint": "CLICK TO REVEAL",
  "hint.spread": "CLICK TO SPREAD",
  "param.cellSize": "Cell size (px)",
  "param.bg": "Backdrop color",
  "param.durationMs": "Duration (ms)",
  "param.tunnelLayers": "Tunnel rectangle layers",
  "param.finalMask": "Final mask strength (0-1)",
  "param.seed": "Pixel seed",
  "param.mask": "Mask strength (0-1)",
  "param.columns": "Rain columns",
  "param.rippleStrength": "Ripple strength",
  "param.wipeInMs": "Wipe-in duration (ms)",
  "param.expandMs": "Expand duration (ms)",
  "param.imgScale": "Initial scale (0-2, sets reveal start)",
  "param.revealMs": "Reveal duration (ms)",
  "param.spreadSpeed": "Spread speed (px/s)",
  "param.feather": "Edge feather",
  "param.autoStartDelayMs": "Auto spread delay (ms)",
  "param.fit": "Video fit",
  "param.scale": "Video scale",
  "param.offsetX": "Offset X (% of screen)",
  "param.offsetY": "Offset Y (% of screen)",
  "param.caption": "Caption text \u2014 [word] marks a highlight",
  "param.captionFont": "Caption font stack"
};
var zh = {
  nav: "\u5F00\u573A\u52A8\u753B",
  title: "\u5F00\u573A\u52A8\u753B",
  intro: "\u6BCF\u6B21 DSH Web \u52A0\u8F7D\u65F6\u64AD\u653E\u81EA\u5DF1\u7684\u56FE\u7247\u52A8\u753B\u6216\u89C6\u9891\uFF0C\u7ED3\u675F\u540E\u4EE5\u8FC7\u6E21\u6548\u679C\u628A\u753B\u9762\u4EA4\u8FD8\u4E3B\u754C\u9762\u3002\u5A92\u4F53\u53EA\u4FDD\u5B58\u5728\u5F53\u524D\u6D4F\u89C8\u5668\uFF0C\u4E0D\u4F1A\u4E0A\u4F20\u3002",
  upload: "\u6DFB\u52A0\u5A92\u4F53",
  uploadHint: "\u9009\u62E9\u6216\u62D6\u5165 JPG\u3001PNG\u3001WebP\u3001GIF\u3001AVIF \u56FE\u7247\uFF08\u6700\u5927 20 MB\uFF09\u4E0E MP4\u3001WebM\u3001MKV \u89C6\u9891\uFF08\u6700\u5927 256 MB\uFF09\u3002",
  empty: "\u8FD8\u6CA1\u6709\u5A92\u4F53\uFF0C\u5148\u6DFB\u52A0\u4E00\u5F20\u56FE\u7247\u6216\u4E00\u6BB5\u89C6\u9891\u5427\u3002",
  active: "\u4F7F\u7528\u4E2D",
  use: "\u4F7F\u7528",
  remove: "\u5220\u9664",
  removeConfirm: "\u786E\u5B9A\u4ECE\u672C\u5730\u5B58\u50A8\u4E2D\u5220\u9664\u8FD9\u4E2A\u5A92\u4F53\u5417\uFF1F",
  clear: "\u5220\u9664\u5168\u90E8\u5A92\u4F53",
  clearConfirm: "\u786E\u5B9A\u5220\u9664\u5F53\u524D\u6D4F\u89C8\u5668\u4E2D\u4FDD\u5B58\u7684\u5168\u90E8\u5A92\u4F53\u5417\uFF1F",
  loading: "\u6B63\u5728\u8BFB\u53D6\u672C\u5730\u5A92\u4F53\u2026",
  storageError: "\u5F53\u524D\u6D4F\u89C8\u5668\u65E0\u6CD5\u6253\u5F00\u672C\u5730\u5A92\u4F53\u5B58\u50A8\u3002",
  invalidFile: "\u90E8\u5206\u6587\u4EF6\u88AB\u8DF3\u8FC7\uFF1A\u683C\u5F0F\u4E0D\u652F\u6301\u6216\u8D85\u8FC7\u5927\u5C0F\u9650\u5236\u3002",
  codecError: "\u90E8\u5206\u89C6\u9891\u88AB\u8DF3\u8FC7\uFF1A\u5F53\u524D\u6D4F\u89C8\u5668\u65E0\u6CD5\u89E3\u7801\u8BE5\u7F16\u7801\u3002",
  mutationError: "\u672C\u5730\u5A92\u4F53\u5E93\u66F4\u65B0\u5931\u8D25\u3002",
  preview: "\u9884\u89C8\u5F00\u573A",
  reset: "\u6062\u590D\u9ED8\u8BA4\u884C\u4E3A",
  enabled: "\u542F\u52A8\u65F6\u64AD\u653E",
  enabledHint: "\u6BCF\u6B21 DSH Web \u52A0\u8F7D\u65F6\u64AD\u653E\u5F00\u573A\u52A8\u753B\u3002",
  skipHint: "\u663E\u793A\u8DF3\u8FC7\u63D0\u793A",
  skipHintHint: "\u64AD\u653E\u671F\u95F4\u663E\u793A\u201C\u70B9\u51FB\u4EFB\u610F\u5904\u8DF3\u8FC7\u201D\u63D0\u793A\u3002",
  maxDuration: "\u56FE\u7247\u65F6\u957F\u4E0A\u9650",
  maxDurationHint: "\u4EC5\u662F\u5F3A\u5236\u6536\u573A\u4FDD\u9669\uFF1A\u5B9E\u9645\u64AD\u653E\u65F6\u957F\u7531\u6240\u9009\u52A8\u753B\u9AD8\u7EA7\u53C2\u6570\u4E2D\u7684\u300C\u65F6\u957F\uFF08ms\uFF09\u300D\u51B3\u5B9A\uFF0C\u53EA\u6709\u52A8\u753B\u8D85\u8FC7\u6B64\u79D2\u6570\u624D\u4F1A\u88AB\u622A\u65AD\u3002\u89C6\u9891\u59CB\u7EC8\u5B8C\u6574\u64AD\u5B8C\u3002",
  transition: "\u6536\u573A\u8FC7\u6E21",
  transitionSpeed: "\u8FC7\u6E21\u901F\u5EA6",
  animationLabel: "\u56FE\u7247\u52A8\u753B",
  animationHint: "\u5F53\u4F7F\u7528\u4E2D\u7684\u5A92\u4F53\u662F\u56FE\u7247\u65F6\u751F\u6548\u3002",
  advanced: "\u9AD8\u7EA7\u53C2\u6570",
  videoFit: "\u89C6\u9891\u586B\u5145",
  cover: "\u94FA\u6EE1\u5C4F\u5E55",
  contain: "\u5B8C\u6574\u663E\u793A",
  kindImage: "\u56FE\u7247",
  kindVideo: "\u89C6\u9891",
  skinHandoff: "\u540C\u65F6\u5C06\u4E0A\u4F20\u7684\u56FE\u7247\u52A0\u5165\u58C1\u7EB8\u5E93",
  skinHandoffHint: "\u5DF2\u5B89\u88C5\u58C1\u7EB8\u63D2\u4EF6\u65F6\uFF0C\u4E0A\u4F20\u7684\u56FE\u7247\u4F1A\u540C\u6B65\u8FDB\u5165\u58C1\u7EB8\u5E93\uFF0C\u4F46\u4E0D\u4F1A\u6539\u53D8\u5F53\u524D\u6FC0\u6D3B\u7684\u58C1\u7EB8\u3002",
  "anim.pool.label": "\u6C34\u6CE2",
  "anim.pool.desc": "\u56FE\u7247\u5982\u6C60\u9762\u822C\u9759\u6B62\uFF0C\u6307\u9488\u5212\u8FC7\u7559\u4E0B\u6298\u5C04\u6C34\u6CE2\u4E0E\u7CBC\u5149\uFF1B\u5176\u4E0A\u5C18\u57C3\u6F02\u6D6E\u3001\u80F6\u7247\u9897\u7C92\u4E0E\u8FB9\u7F18\u8272\u6563\u8109\u51B2\u95EA\u70C1\uFF0C\u4E0B\u65B9\u5B57\u5E55\u9010\u8BCD\u70B9\u4EAE\u3002",
  "anim.code-rain.label": "\u5B57\u7B26\u96E8",
  "anim.code-rain.desc": "\u56FE\u7247\u77AC\u95F4\u94FA\u6EE1\u5C4F\u5E55\uFF0C\u7EFF\u8272\u5B57\u7B26\u96E8\u9010\u5217\u843D\u4E0B\u3001\u7ECF\u5C4F\u5E55\u5E95\u90E8\u6EDA\u51FA\u540E\u5E72\u51C0\u5B9A\u683C\u3002",
  "anim.tap-reveal.label": "\u70B9\u51FB\u63ED\u793A",
  "anim.tap-reveal.desc": "\u4EE5\u56FE\u7247\u4E3B\u8272\u4E3A\u5E95\u7B49\u5F85\u70B9\u51FB\uFF1B\u70B9\u51FB\u540E\u56FE\u7247\u4ECE\u70B9\u51FB\u5904\u5706\u5F62\u6269\u6563\u6D6E\u73B0\u3002",
  "anim.wipe-reveal.label": "\u6A2A\u5411\u63ED\u793A",
  "anim.wipe-reveal.desc": "\u4EE5\u56FE\u7247\u4E3B\u8272\u4E3A\u5E95\uFF0C\u64E6\u5165\u5C55\u793A\u56FE\u7247\u5DE6\u534A\u90E8\u5206\uFF0C\u518D\u5411\u53F3\u62D3\u5C55\u81F3\u56FE\u7247\u653E\u5927\u94FA\u6EE1\u5168\u5C4F\u6210\u4E3A\u80CC\u666F\u3002",
  "anim.grid-reveal-spread.label": "\u7F51\u683C\u63ED\u793A \xB7 \u6269\u6563",
  "anim.grid-reveal-spread.desc": "\u4EE5\u5E95\u8272\u7B49\u5F85\uFF1B\u70B9\u51FB\u540E\u753B\u9762\u4ECE\u9F20\u6807\u4F4D\u7F6E\u5411\u56DB\u5468\u6269\u6563\u5C55\u5F00\uFF0C\u8D85\u65F6\u81EA\u52A8\u4ECE\u539F\u4F4D\u5F00\u59CB\u3002",
  "anim.retro-boot.label": "\u590D\u53E4\u5F00\u673A",
  "anim.retro-boot.desc": "\u5341\u79D2\u590D\u53E4\u5F00\u673A\u5E8F\u5217\uFF1A\u9CB8\u9C7C Logo \u5728\u6697\u5316\u7684\u56FE\u7247\u4E0A\u4EAE\u8D77\uFF0C\u84DD\u7D2B\u50CF\u7D20\u5757\u541E\u566C\u5168\u5C4F\uFF0C\u7EFF\u8272\u77E9\u5F62\u96A7\u9053\u6269\u5F20\uFF0C\u534A\u8C03\u6296\u52A8\u8F6C\u7EA2\u540E\u4EE5\u6697\u7EA2\u7F51\u683C\u5B9A\u683C\u3002",
  "anim.video-player.label": "\u89C6\u9891",
  "anim.video-player.desc": "\u9759\u97F3\u64AD\u653E\u9009\u5B9A\u7684\u89C6\u9891\uFF0C\u64AD\u5B8C\u540E\u4EA4\u8FD8\u4E3B\u754C\u9762\u3002",
  "trans.cross-fade.label": "\u4EA4\u53C9\u6DE1\u5165",
  "trans.dip-to-bg.label": "\u5148\u9690\u540E\u73B0",
  "trans.zoom-fade.label": "\u7F29\u653E\u6DE1\u5165",
  "skip.hint": "CLICK ANYWHERE TO SKIP \xB7 \u70B9\u51FB\u4EFB\u610F\u5904\u8DF3\u8FC7",
  "tap.hint": "CLICK TO REVEAL",
  "hint.spread": "CLICK TO SPREAD",
  "param.cellSize": "\u683C\u5B50\u8FB9\u957F\uFF08px\uFF09",
  "param.bg": "\u5E95\u8272",
  "param.durationMs": "\u65F6\u957F\uFF08ms\uFF09",
  "param.columns": "\u5B57\u7B26\u96E8\u5217\u6570",
  "param.rippleStrength": "\u6C34\u6CE2\u5F3A\u5EA6",
  "param.wipeInMs": "\u64E6\u5165\u65F6\u957F\uFF08ms\uFF09",
  "param.expandMs": "\u62D3\u5C55\u65F6\u957F\uFF08ms\uFF09",
  "param.imgScale": "\u56FE\u7247\u521D\u59CB\u7F29\u653E\uFF080-2\uFF0C\u51B3\u5B9A\u63ED\u793A\u8D77\u59CB\uFF09",
  "param.revealMs": "\u63ED\u793A\u65F6\u957F\uFF08ms\uFF09",
  "param.spreadSpeed": "\u6269\u6563\u901F\u5EA6\uFF08px/\u79D2\uFF09",
  "param.feather": "\u8FB9\u7F18\u6E10\u53D8",
  "param.autoStartDelayMs": "\u81EA\u52A8\u6269\u6563\u5EF6\u8FDF\uFF08ms\uFF09",
  "param.tunnelLayers": "\u96A7\u9053\u77E9\u5F62\u5C42\u6570",
  "param.finalMask": "\u7ED3\u5C3E\u906E\u7F69\u5F3A\u5EA6\uFF080-1\uFF09",
  "param.seed": "\u50CF\u7D20\u968F\u673A\u79CD\u5B50",
  "param.mask": "\u906E\u7F69\u5F3A\u5EA6\uFF080-1\uFF09",
  "param.fit": "\u89C6\u9891\u586B\u5145",
  "param.scale": "\u89C6\u9891\u7F29\u653E",
  "param.offsetX": "\u6C34\u5E73\u504F\u79FB\uFF08\u5C4F\u5E55\u5BBD %\uFF09",
  "param.offsetY": "\u5782\u76F4\u504F\u79FB\uFF08\u5C4F\u5E55\u9AD8 %\uFF09",
  "param.caption": "\u5B57\u5E55\u6587\u672C\uFF08[\u8BCD] = \u5F3A\u8C03\uFF09",
  "param.captionFont": "\u5B57\u5E55\u5B57\u4F53\u6808"
};

// src/client/ui/AnimationPicker.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
function AnimationPicker({ t, kind, value, paramOverrides, onChange, onParam }) {
  const animations2 = listAnimations(kind);
  const active = animations2.find((animation) => animation.id === value) ?? animations2[0];
  const [drafts, setDrafts] = (0, import_react.useState)({});
  if (active === void 0) return null;
  const params = resolveAnimationParams(active, paramOverrides);
  const schema = active.paramsSchema ?? {};
  const hasAdvanced = Object.keys(schema).length > 0;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-opening-radios", role: "radiogroup", "aria-label": t("animationLabel"), children: [
    animations2.map((animation) => {
      const checked = animation.id === active.id;
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "dsh-opening-radio", "data-checked": checked || void 0, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "radio",
            name: `dsh-opening-animation-${kind}`,
            value: animation.id,
            checked,
            onChange: () => {
              setDrafts({});
              onChange(animation.id);
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dsh-opening-radio-copy", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t(animation.labelKey) }),
          animation.descriptionKey !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { children: t(animation.descriptionKey) })
        ] })
      ] }, animation.id);
    }),
    hasAdvanced && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { className: "dsh-opening-params", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { children: t("advanced") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "dsh-opening-params-body", children: Object.entries(schema).map(([key, spec]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { className: "dsh-opening-control", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh-opening-control-head", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t(`param.${key}`) }) }),
        spec.type === "number" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "number",
            value: drafts[key] ?? String(params[key] ?? spec.default),
            min: spec.min !== void 0 ? String(spec.min) : void 0,
            max: spec.max !== void 0 ? String(spec.max) : void 0,
            step: spec.step !== void 0 ? String(spec.step) : void 0,
            onChange: (event) => {
              setDrafts((current) => ({ ...current, [key]: event.target.value }));
              const next = event.target.valueAsNumber;
              if (active !== void 0 && Number.isFinite(next)) onParam(active.id, key, next);
            },
            onBlur: () => setDrafts((current) => {
              const next = { ...current };
              delete next[key];
              return next;
            })
          }
        ) : spec.type === "string" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "text",
            value: String(params[key] ?? spec.default),
            onChange: (event) => {
              if (active !== void 0) onParam(active.id, key, event.target.value);
            }
          }
        ) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "select",
          {
            value: String(params[key] ?? spec.default),
            onChange: (event) => {
              if (active !== void 0) onParam(active.id, key, event.target.value);
            },
            children: (spec.options ?? []).map((option) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: option, children: option }, option))
          }
        )
      ] }, key)) })
    ] })
  ] });
}

// src/client/ui/BehaviorControls.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function BehaviorControls({ t, snap, controller }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dsh-opening-controls", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { className: "dsh-opening-control", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dsh-opening-control-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("maxDuration") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("output", { children: [
          String(Math.round(snap.maxDurationMs / 1e3)),
          "s"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "input",
        {
          type: "number",
          min: "3",
          max: "120",
          step: "1",
          value: String(Math.round(snap.maxDurationMs / 1e3)),
          onChange: (event) => controller.setMaxDuration(event.target.valueAsNumber * 1e3)
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("small", { className: "dsh-opening-note", children: t("maxDurationHint") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { className: "dsh-opening-control", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dsh-opening-control-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("transitionSpeed") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("output", { children: [
          snap.transitionScale.toFixed(1),
          "\xD7"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "input",
        {
          type: "number",
          min: "0.5",
          max: "2",
          step: "0.1",
          value: String(snap.transitionScale),
          onChange: (event) => controller.setTransitionScale(event.target.valueAsNumber)
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { className: "dsh-opening-toggle", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "input",
        {
          type: "checkbox",
          checked: snap.showSkipHint,
          onChange: (event) => controller.setSkipHint(event.target.checked)
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dsh-opening-toggle-copy", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("skipHint") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("small", { className: "dsh-opening-note", children: t("skipHintHint") })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { className: "dsh-opening-toggle", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "input",
        {
          type: "checkbox",
          checked: snap.skinHandoff,
          onChange: (event) => controller.setSkinHandoff(event.target.checked)
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dsh-opening-toggle-copy", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("skinHandoff") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("small", { className: "dsh-opening-note", children: t("skinHandoffHint") })
      ] })
    ] })
  ] });
}

// src/client/ui/MediaDropZone.tsx
var import_react2 = require("react");
var import_jsx_runtime3 = require("react/jsx-runtime");
var ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/x-matroska";
function MediaDropZone({ t, disabled, onAdd }) {
  const [dragging, setDragging] = (0, import_react2.useState)(false);
  const onInput = (event) => {
    if (event.target.files !== null) onAdd([...event.target.files]);
    event.target.value = "";
  };
  const onDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files !== null) onAdd([...event.dataTransfer.files]);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
    "label",
    {
      className: "dsh-opening-drop",
      "aria-disabled": !disabled ? void 0 : "true",
      "data-dragging": dragging || void 0,
      "data-disabled": !disabled || void 0,
      onDragEnter: () => setDragging(true),
      onDragLeave: () => setDragging(false),
      onDragOver: (event) => event.preventDefault(),
      onDrop,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: t("upload") }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-opening-note", children: t("uploadHint") }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "input",
          {
            type: "file",
            accept: ACCEPT,
            "aria-label": t("upload"),
            disabled,
            multiple: true,
            onChange: onInput
          }
        )
      ]
    }
  );
}

// src/client/ui/MediaGrid.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
function MediaGrid({ t, media, activeId, onSelect, onRemove }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dsh-opening-grid", children: media.map((item) => {
    const active = item.id === activeId;
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("article", { className: "dsh-opening-card", "data-active": active || void 0, children: [
      item.kind === "video" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("video", { className: "dsh-opening-thumb", src: item.url, muted: true, preload: "metadata" }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "img",
        {
          className: "dsh-opening-thumb",
          src: item.url,
          alt: item.name,
          decoding: "async",
          loading: active ? "eager" : "lazy"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dsh-opening-kind-badge", children: t(item.kind === "video" ? "kindVideo" : "kindImage") }),
      active && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dsh-opening-active-badge", children: t("active") }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dsh-opening-card-body", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dsh-opening-name", title: item.name, children: item.name }),
        !active && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "button",
          {
            className: "dsh-opening-button",
            type: "button",
            onClick: () => onSelect(item.id),
            children: t("use")
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "button",
          {
            className: "dsh-opening-button dsh-opening-button-danger",
            type: "button",
            onClick: () => onRemove(item.id),
            children: t("remove")
          }
        )
      ] })
    ] }, item.id);
  }) });
}

// src/client/ui/TransitionPicker.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
function TransitionPicker({ t, value, onChange }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "dsh-opening-control", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "dsh-opening-control-head", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: t("transition") }) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("select", { value, onChange: (event) => onChange(event.target.value), children: listTransitions().map((preset) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("option", { value: preset.id, children: t(preset.labelKey) }, preset.id)) })
  ] });
}

// src/client/ui/OpeningSection.tsx
var import_jsx_runtime6 = require("react/jsx-runtime");
function errorKey(error) {
  switch (error) {
    case "storage":
      return "storageError";
    case "invalid-file":
      return "invalidFile";
    case "unsupported-codec":
      return "codecError";
    case "mutation":
      return "mutationError";
  }
}
function OpeningSection({ t, useOpening, controller }) {
  const state = useOpening((snapshot) => snapshot);
  const kind = state.activeKind ?? "image";
  const remove = (id) => {
    if (window.confirm(t("removeConfirm"))) void controller.remove(id);
  };
  const clear = () => {
    if (window.confirm(t("clearConfirm"))) void controller.clear();
  };
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("section", { className: "dsh-opening-section", "aria-busy": !state.ready, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h2", { children: t("title") }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "dsh-opening-intro", children: t("intro") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(MediaDropZone, { t, disabled: !state.ready, onAdd: (files) => void controller.addFiles(files) }),
    state.error !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "dsh-opening-error", role: "alert", children: t(errorKey(state.error)) }),
    !state.ready ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "dsh-opening-note", children: t("loading") }) : state.media.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "dsh-opening-note", children: t("empty") }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      MediaGrid,
      {
        t,
        media: state.media,
        activeId: state.activeId,
        onSelect: (id) => controller.select(id),
        onRemove: remove
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("label", { className: "dsh-opening-toggle", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "input",
        {
          type: "checkbox",
          checked: state.enabled,
          onChange: (event) => controller.setEnabled(event.target.checked)
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "dsh-opening-toggle-copy", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: t("enabled") }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("small", { className: "dsh-opening-note", children: t("enabledHint") })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dsh-opening-control", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "dsh-opening-control-head", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: t("animationLabel") }) }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("small", { className: "dsh-opening-note", children: t("animationHint") }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        AnimationPicker,
        {
          t,
          kind,
          value: state.animationByKind[kind],
          paramOverrides: state.paramOverrides[state.animationByKind[kind]] ?? {},
          onChange: (animId) => controller.setAnimation(kind, animId),
          onParam: (animId, key, value) => controller.setParam(animId, key, value)
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(TransitionPicker, { t, value: state.transitionId, onChange: (id) => controller.setTransition(id) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(BehaviorControls, { t, snap: state, controller }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "dsh-opening-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "button",
        {
          className: "dsh-opening-button",
          type: "button",
          disabled: !state.ready || state.activeId === void 0 || state.playing,
          onClick: () => controller.preview(),
          children: t("preview")
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { className: "dsh-opening-button", type: "button", onClick: () => controller.reset(), children: t("reset") }),
      state.media.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { className: "dsh-opening-button dsh-opening-button-danger", type: "button", onClick: clear, children: t("clear") })
    ] })
  ] });
}

// src/client/index.ts
var inject = ["slots", "locale"];
var earlyPrefs;
try {
  const parsed = parsePreferences();
  if (parsed.enabled && parsed.activeId !== void 0) {
    earlyPrefs = parsed;
    document.documentElement.dataset.dshOpeningPending = "1";
    installCriticalStyles();
  }
} catch (err) {
  console.warn("[dsh-opening-animation] pre-boot preference check failed", err);
  delete document.documentElement.dataset.dshOpeningPending;
  removeCriticalStyles();
}
function apply(ctx) {
  const controller = new OpeningController(earlyPrefs ?? parsePreferences());
  const t = ctx.locale.bind(NS);
  controller.attachLocale(t);
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-opening-animation: dictionaries");
  ctx.effect(() => installStyles(), "dsh-opening-animation: global styles");
  ctx.effect(() => {
    void controller.initialize();
    return () => {
      controller.dispose();
    };
  }, "dsh-opening-animation: opening runtime");
  ctx.slots.inject(
    "settings.section",
    () => ctx.slots.register(
      {
        name: "settings.section",
        id: "opening-animation",
        order: 13,
        label: () => t("nav"),
        locale: NS,
        inject: () => ({ controller, hooks: { opening: controller } })
      },
      OpeningSection
    )
  );
}
return module.exports; } });
//# sourceMappingURL=client.js.map
