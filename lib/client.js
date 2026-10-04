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
    this.setTimer(() => this.fireLoadTimeout(), LOAD_TIMEOUT_MS);
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

// src/client/animations/glitch.ts
var PROFILES = {
  subtle: { shiftLineCount: 3, shiftLineRange: 20, scatCount: 2, rgbRange: 8, throughChance: 0.35 },
  strong: { shiftLineCount: 8, shiftLineRange: 60, scatCount: 4, rgbRange: 24, throughChance: 0.18 },
  extreme: { shiftLineCount: 14, shiftLineRange: 140, scatCount: 7, rgbRange: 48, throughChance: 0.12 }
};
var rand = (a, b) => a + Math.random() * (b - a);
var randInt = (a, b) => Math.floor(rand(a, b));
var GlitchEngine = class _GlitchEngine {
  runtime;
  canvas;
  ctx;
  img = new Image();
  durationMs;
  profile;
  bg;
  vw = 0;
  vh = 0;
  dpr = 1;
  fit;
  channels = [];
  shiftLines = [];
  scatBlocks = [];
  rgbOffsets = null;
  flowT1 = randInt(0, 1e3);
  flowSpeed = randInt(4, 24);
  flowRandX = randInt(24, 80);
  throughUntil = 0;
  startTime = 0;
  completed = false;
  destroyed = false;
  rafId = 0;
  resizeTimer = 0;
  onImgLoad = () => {
    if (this.destroyed) return;
    if (this.runtime.reducedMotion) {
      this.showClean();
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
  constructor(runtime) {
    this.runtime = runtime;
    const p = runtime.params;
    this.durationMs = _GlitchEngine.number(p.durationMs, 6e3);
    const intensity = p.intensity === "subtle" || p.intensity === "extreme" ? p.intensity : "strong";
    this.profile = PROFILES[intensity];
    this.bg = typeof p.bg === "string" && p.bg.length > 0 ? p.bg : "#04050e";
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
    if (this.imageReady()) this.showClean();
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
  /* Picture cover-fitted to the viewport in physical pixels; channel layers pre-split once. */
  buildLayout() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.vw = this.runtime.container.clientWidth || window.innerWidth;
    this.vh = this.runtime.container.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(this.vw * this.dpr);
    this.canvas.height = Math.round(this.vh * this.dpr);
    this.fit = document.createElement("canvas");
    this.fit.width = this.canvas.width;
    this.fit.height = this.canvas.height;
    const fitCtx = this.fit.getContext("2d");
    const scale = Math.max(this.canvas.width / this.img.naturalWidth, this.canvas.height / this.img.naturalHeight);
    const dw = this.img.naturalWidth * scale;
    const dh = this.img.naturalHeight * scale;
    fitCtx.drawImage(
      this.img,
      0,
      0,
      this.img.naturalWidth,
      this.img.naturalHeight,
      (this.canvas.width - dw) / 2,
      (this.canvas.height - dh) / 2,
      dw,
      dh
    );
    this.channels = [16711680, 65280, 255].map((mask) => {
      const layer = document.createElement("canvas");
      layer.width = this.canvas.width;
      layer.height = this.canvas.height;
      const lctx = layer.getContext("2d");
      lctx.drawImage(this.fit, 0, 0);
      lctx.globalCompositeOperation = "multiply";
      lctx.fillStyle = `#${mask.toString(16).padStart(6, "0")}`;
      lctx.fillRect(0, 0, layer.width, layer.height);
      return layer;
    });
    this.shiftLines = Array.from({ length: this.profile.shiftLineCount }, () => null);
    this.scatBlocks = Array.from({ length: this.profile.scatCount }, () => null);
    this.rgbOffsets = null;
  }
  rollShiftLine() {
    const range = this.profile.shiftLineRange * this.dpr;
    const y = randInt(0, this.canvas.height);
    const h = Math.max(2, randInt(1, Math.floor(this.canvas.height * 0.12)));
    return { y, h, dx: Math.round(rand(-range, range)) };
  }
  rollScatBlock() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const sx = randInt(0, Math.max(1, w - Math.round(w * 0.1)));
    const sy = randInt(0, Math.max(1, h - 60));
    const bw = randInt(Math.round(w * 0.06), Math.max(Math.round(w * 0.06) + 1, w - sx));
    const bh = randInt(4, 60);
    return {
      sx,
      sy,
      w: bw,
      h: bh,
      px: randInt(-Math.round(w * 0.3), Math.round(w * 0.7)),
      py: randInt(-Math.round(h * 0.1), Math.max(0, h - bh))
    };
  }
  frame = (now) => {
    if (this.destroyed || this.completed) return;
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const elapsed = now - this.startTime;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = this.bg;
    ctx.fillRect(0, 0, W, H);
    if (elapsed >= this.durationMs) {
      this.showClean();
      this.markCompleted();
      return;
    }
    if (now < this.throughUntil) {
      ctx.drawImage(this.fit, 0, 0);
    } else {
      if (Math.random() < this.profile.throughChance) {
        this.throughUntil = now + rand(40, 400);
      }
      if (Math.random() < 0.35) {
        const range = this.profile.rgbRange * this.dpr;
        const [dr, dg, db] = this.rgbOffsets = [
          Math.round(rand(-range, range)),
          Math.round(rand(-range, range)),
          Math.round(rand(-range, range))
        ];
        ctx.globalCompositeOperation = "lighter";
        ctx.drawImage(this.channels[0], dr, 0);
        ctx.drawImage(this.channels[1], 0, dg);
        ctx.drawImage(this.channels[2], 0, db);
        ctx.globalCompositeOperation = "source-over";
      } else {
        ctx.drawImage(this.fit, 0, 0);
      }
      for (let i = 0; i < this.shiftLines.length; i++) {
        if (Math.random() > 0.5 || this.shiftLines[i] === null) {
          this.shiftLines[i] = this.rollShiftLine();
        }
        const line = this.shiftLines[i];
        ctx.drawImage(this.fit, 0, line.y, W, line.h, line.dx, line.y, W, line.h);
      }
      this.flowT1 = (this.flowT1 + this.flowSpeed) % H;
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = `rgba(255,255,255,${(this.flowRandX / 255).toFixed(3)})`;
      ctx.fillRect(0, this.flowT1, W, Math.max(2, Math.round(2 * this.dpr)));
      ctx.globalCompositeOperation = "source-over";
      for (let i = 0; i < this.scatBlocks.length; i++) {
        if (Math.random() > 0.8 || this.scatBlocks[i] === null) {
          this.scatBlocks[i] = this.rollScatBlock();
        }
        const block = this.scatBlocks[i];
        ctx.drawImage(this.fit, block.sx, block.sy, block.w, block.h, block.px, block.py, block.w, block.h);
      }
    }
    this.rafId = requestAnimationFrame(this.frame);
  };
  beginRun() {
    this.cancelRaf();
    this.buildLayout();
    this.flowT1 = randInt(0, 1e3);
    this.flowSpeed = randInt(4, 24);
    this.flowRandX = randInt(24, 80);
    this.throughUntil = 0;
    this.startTime = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }
  /* Freeze on the clean picture (skip / reduced motion / end of the run). */
  showClean() {
    if (!this.imageReady()) return;
    this.cancelRaf();
    if (this.fit === void 0) this.buildLayout();
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = this.bg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.fit, 0, 0);
  }
  static number(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }
};
var glitchAnimation = {
  id: "glitch",
  kind: "image",
  labelKey: "anim.glitch.label",
  descriptionKey: "anim.glitch.desc",
  paramsSchema: {
    durationMs: { type: "number", default: 6e3, min: 1e3, max: 3e4, step: 500 },
    intensity: { type: "enum", default: "strong", options: ["subtle", "strong", "extreme"] },
    bg: { type: "enum", default: "#04050e", options: ["#04050e", "#000000", "#101020"] }
  },
  create: (runtime) => new GlitchEngine(runtime)
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
registerAnimation(glitchAnimation);
registerAnimation(gridRevealSpreadAnimation);
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
  /** Replay the current configuration immediately (independent of the once-per-document guard). */
  preview() {
    if (this.disposed || this.activeRunner !== void 0) return;
    if (this.snapshot.activeId === void 0) return;
    this.playOnce();
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
  playOnce() {
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
  maxDurationHint: "Force image animations to end after this many seconds. Videos always play to the end.",
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
  "anim.glitch.label": "Glitch",
  "anim.glitch.desc": "The picture fills the screen while corruption bursts at random spots, then settles clean when time is up.",
  "anim.grid-reveal-spread.label": "Grid reveal \xB7 spread",
  "anim.grid-reveal-spread.desc": "Waits on the backdrop; click (or wait) and the picture spreads out from your pointer.",
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
  "param.durationMs": "Glitch duration (ms)",
  "param.intensity": "Glitch intensity",
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
  "param.offsetY": "Offset Y (% of screen)"
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
  maxDurationHint: "\u56FE\u7247\u52A8\u753B\u8D85\u8FC7\u8BE5\u79D2\u6570\u540E\u5F3A\u5236\u6536\u573A\u3002\u89C6\u9891\u59CB\u7EC8\u5B8C\u6574\u64AD\u5B8C\u3002",
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
  "anim.glitch.label": "\u6545\u969C\u827A\u672F",
  "anim.glitch.desc": "\u56FE\u7247\u94FA\u6EE1\u5C4F\u5E55\u5E76\u5728\u968F\u673A\u4F4D\u7F6E\u7206\u53D1\u6545\u969C\u6548\u679C\uFF0C\u65F6\u95F4\u5230\u540E\u5B9A\u683C\u6E05\u6670\u753B\u9762\u3002",
  "anim.tap-reveal.label": "\u70B9\u51FB\u63ED\u793A",
  "anim.tap-reveal.desc": "\u4EE5\u56FE\u7247\u4E3B\u8272\u4E3A\u5E95\u7B49\u5F85\u70B9\u51FB\uFF1B\u70B9\u51FB\u540E\u56FE\u7247\u4ECE\u70B9\u51FB\u5904\u5706\u5F62\u6269\u6563\u6D6E\u73B0\u3002",
  "anim.wipe-reveal.label": "\u6A2A\u5411\u63ED\u793A",
  "anim.wipe-reveal.desc": "\u4EE5\u56FE\u7247\u4E3B\u8272\u4E3A\u5E95\uFF0C\u64E6\u5165\u5C55\u793A\u56FE\u7247\u5DE6\u534A\u90E8\u5206\uFF0C\u518D\u5411\u53F3\u62D3\u5C55\u81F3\u56FE\u7247\u653E\u5927\u94FA\u6EE1\u5168\u5C4F\u6210\u4E3A\u80CC\u666F\u3002",
  "anim.grid-reveal-spread.label": "\u7F51\u683C\u63ED\u793A \xB7 \u6269\u6563",
  "anim.grid-reveal-spread.desc": "\u4EE5\u5E95\u8272\u7B49\u5F85\uFF1B\u70B9\u51FB\u540E\u753B\u9762\u4ECE\u9F20\u6807\u4F4D\u7F6E\u5411\u56DB\u5468\u6269\u6563\u5C55\u5F00\uFF0C\u8D85\u65F6\u81EA\u52A8\u4ECE\u539F\u4F4D\u5F00\u59CB\u3002",
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
  "param.durationMs": "\u6545\u969C\u6301\u7EED\u65F6\u95F4\uFF08ms\uFF09",
  "param.intensity": "\u6545\u969C\u5F3A\u5EA6",
  "param.wipeInMs": "\u64E6\u5165\u65F6\u957F\uFF08ms\uFF09",
  "param.expandMs": "\u62D3\u5C55\u65F6\u957F\uFF08ms\uFF09",
  "param.imgScale": "\u56FE\u7247\u521D\u59CB\u7F29\u653E\uFF080-2\uFF0C\u51B3\u5B9A\u63ED\u793A\u8D77\u59CB\uFF09",
  "param.revealMs": "\u63ED\u793A\u65F6\u957F\uFF08ms\uFF09",
  "param.spreadSpeed": "\u6269\u6563\u901F\u5EA6\uFF08px/\u79D2\uFF09",
  "param.feather": "\u8FB9\u7F18\u6E10\u53D8",
  "param.autoStartDelayMs": "\u81EA\u52A8\u6269\u6563\u5EF6\u8FDF\uFF08ms\uFF09",
  "param.fit": "\u89C6\u9891\u586B\u5145",
  "param.scale": "\u89C6\u9891\u7F29\u653E",
  "param.offsetX": "\u6C34\u5E73\u504F\u79FB\uFF08\u5C4F\u5E55\u5BBD %\uFF09",
  "param.offsetY": "\u5782\u76F4\u504F\u79FB\uFF08\u5C4F\u5E55\u9AD8 %\uFF09"
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
