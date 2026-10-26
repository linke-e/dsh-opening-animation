"use strict";
var GlassWipeDemo = (() => {
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

  // src/client/glass-wipe.ts
  var glass_wipe_exports = {};
  __export(glass_wipe_exports, {
    isBlobLike: () => isBlobLike,
    sampleBrushPath: () => sampleBrushPath,
    setupGlassWipe: () => setupGlassWipe
  });
  var BLUR_IN_MS = 900;
  var WIPE_MS = 1400;
  var BRUSH_MS = 1e3;
  var SETTLE_MS = 450;
  var BLUR_PX = 28;
  var SKIN_PREFS_KEY = "dsh-custom-skin.preferences.v1";
  var SKIN_DB_NAME = "dsh-custom-skin";
  var SKIN_STORE = "wallpapers";
  var SKIN_TIMEOUT_MS = 250;
  var SKIN_FITS = ["cover", "contain", "fill"];
  var SKIN_POSITIONS = ["center", "top", "bottom"];
  var GW_EXIT_CLASS = "dsh-opening-gw-exit";
  var BRUSH_STROKES = [
    [{ x: 0.18, y: 0.42 }, { x: 0.82, y: 0.22 }, 0.85],
    [{ x: 0.15, y: 0.6 }, { x: 0.88, y: 0.48 }, 1],
    [{ x: 0.2, y: 0.8 }, { x: 0.9, y: 0.72 }, 1.1]
  ];
  var STAMP_W = 0.5;
  var STAMP_H = 0.32;
  var STAMPS_PER_STROKE = 26;
  var MAX_DPR = 2;
  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function sampleBrushPath(progress) {
    const clamped = Math.min(0.999999, Math.max(0, progress));
    const strokeIndex = Math.min(BRUSH_STROKES.length - 1, Math.floor(clamped * BRUSH_STROKES.length));
    const [from, to, widthGain] = BRUSH_STROKES[strokeIndex];
    const local = clamped * BRUSH_STROKES.length - strokeIndex;
    const eased = easeInOut(local);
    let envelope = 1;
    if (local < 0.15) envelope = 0.55 + local / 0.15 * 0.45;
    else if (local > 0.9) envelope = 1 - (local - 0.9) / 0.1 * 0.15;
    return {
      x: from.x + (to.x - from.x) * eased,
      y: from.y + (to.y - from.y) * eased,
      scale: envelope * widthGain
    };
  }
  function buildBrushStamp(widthPx, heightPx) {
    const stamp = document.createElement("canvas");
    stamp.width = Math.max(2, Math.round(widthPx));
    stamp.height = Math.max(2, Math.round(heightPx));
    const g = stamp.getContext("2d");
    if (g === null) return null;
    const w = stamp.width;
    const h = stamp.height;
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
  function isBlobLike(value) {
    if (value instanceof Blob) return true;
    if (typeof value !== "object" || value === null) return false;
    const candidate = value;
    return typeof candidate.size === "number" && typeof candidate.type === "string";
  }
  function setupGlassWipe(context) {
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
    const pane = document.createElement("div");
    pane.className = "dsh-opening-gw-pane";
    const clear = document.createElement("canvas");
    clear.className = "dsh-opening-gw-clear";
    clear.width = Math.max(2, Math.round(vw * dpr));
    clear.height = Math.max(2, Math.round(vh * dpr));
    clear.dataset.gwSource = "media";
    stack.append(pane, clear);
    root.style.setProperty("--gw-blur-ms", `${blurMs}ms`);
    root.style.setProperty("--gw-wipe-ms", `${wipeMs}ms`);
    root.style.setProperty("--gw-settle-ms", `${settleMs}ms`);
    root.style.setProperty("--gw-blur", `${BLUR_PX}px`);
    root.append(stack);
    let destroyed = false;
    let wallpaperUrl;
    const timers = /* @__PURE__ */ new Set();
    const later = (fn, ms) => {
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
    const stamp = clearCtx !== null && maskCtx !== null ? buildBrushStamp(STAMP_W * vw * dpr, STAMP_H * vw * dpr) : null;
    const choreographed = clearCtx !== null && maskCtx !== null && stamp !== null;
    let source = { fit: "cover", pos: "center" };
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
            }
          },
          { once: true }
        );
      }
      const playing = video.play();
      if (playing !== void 0) {
        playing.catch(() => {
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
    const stampBrush = (through, progress) => {
      if (maskCtx === null || stamp === null) return;
      const w = clear.width;
      const h = clear.height;
      const stampW = STAMP_W * w;
      const stampH = STAMP_H * w;
      const steps = Math.max(1, Math.round((progress - through) * BRUSH_STROKES.length * STAMPS_PER_STROKE));
      for (let i = 1; i <= steps; i += 1) {
        const sample = sampleBrushPath(through + (progress - through) * i / steps);
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
    const stampSpread = (progress) => {
      if (maskCtx === null) return;
      const w = clear.width;
      const h = clear.height;
      const last = BRUSH_STROKES[BRUSH_STROKES.length - 1];
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
    const composite = () => {
      if (clearCtx === null) return;
      const w = clear.width;
      const h = clear.height;
      clearCtx.clearRect(0, 0, w, h);
      const mediaSource = source.video ?? source.image;
      if (mediaSource !== void 0) {
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
    const wipeFrame = (now) => {
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
    const startWipe = () => {
      if (!choreographed) return;
      wipeStart = performance.now();
      rafId = requestAnimationFrame(wipeFrame);
    };
    void stack.offsetHeight;
    stack.classList.add("dsh-opening-gw-run");
    later(() => {
      stack.classList.add("dsh-opening-gw-wipe");
      startWipe();
    }, blurMs);
    later(() => {
      root.style.background = "transparent";
      root.classList.add(GW_EXIT_CLASS);
    }, blurMs + wipeMs);
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
        if (source.video !== void 0) {
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
        if (wallpaperUrl !== void 0) URL.revokeObjectURL(wallpaperUrl);
      }
    };
  }
  function revokeWallpaper(wallpaper) {
    if (wallpaper !== null) URL.revokeObjectURL(wallpaper.url);
  }
  function openingVideo(root) {
    const stage = root.querySelector(".dsh-opening-stage");
    if (stage === null) return null;
    for (const child of stage.children) {
      if (child instanceof HTMLVideoElement) return child;
    }
    return null;
  }
  function preload(url) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
      image.src = url;
    });
  }
  async function resolveSkinWallpaper() {
    const lookup = readSkinWallpaper().catch(() => null);
    const result = await Promise.race([
      lookup,
      new Promise((resolve) => {
        window.setTimeout(() => resolve(null), SKIN_TIMEOUT_MS);
      })
    ]);
    if (result !== null) return result;
    void lookup.then(revokeWallpaper);
    return null;
  }
  async function readSkinWallpaper() {
    const prefs = readSkinPreferences();
    if (prefs === null) return null;
    const blob = await readSkinBlob(prefs.activeId);
    if (blob === null) return null;
    return { url: URL.createObjectURL(blob), fit: prefs.fit, pos: prefs.pos };
  }
  function readSkinPreferences() {
    try {
      const raw = localStorage.getItem(SKIN_PREFS_KEY);
      if (raw === null) return null;
      const value = JSON.parse(raw);
      if (typeof value !== "object" || value === null) return null;
      const v = value;
      if (v.enabled !== true) return null;
      if (typeof v.activeId !== "string" || v.activeId === "") return null;
      const fit = typeof v.fit === "string" && SKIN_FITS.includes(v.fit) ? v.fit : "cover";
      const pos = typeof v.position === "string" && SKIN_POSITIONS.includes(v.position) ? v.position : "center";
      return { activeId: v.activeId, fit, pos };
    } catch {
      return null;
    }
  }
  function readSkinBlob(id) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(SKIN_DB_NAME);
      request.onupgradeneeded = () => {
        try {
          request.transaction?.abort();
        } catch {
        }
      };
      request.onerror = () => reject(request.error ?? new Error("skin database unavailable"));
      request.onsuccess = () => {
        const database = request.result;
        const finish = (blob, error) => {
          database.close();
          if (error !== void 0) reject(error);
          else resolve(blob);
        };
        try {
          const store = database.transaction(SKIN_STORE, "readonly").objectStore(SKIN_STORE);
          const get = store.get(id);
          get.onsuccess = () => {
            const record = get.result;
            if (record === void 0) {
              finish(null);
              return;
            }
            const blob = record.blob;
            finish(
              isBlobLike(blob) && typeof record.type === "string" && record.type.startsWith("image/") ? blob : null
            );
          };
          get.onerror = () => finish(null, get.error ?? new Error("skin read failed"));
        } catch (err) {
          finish(null, err);
        }
      };
    });
  }
  return __toCommonJS(glass_wipe_exports);
})();
