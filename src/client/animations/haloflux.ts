// haloflux engine — a faithful remake of the HALOFLUX beat-driven sci-fi data
// visualization (github.com/Ryder191/haloflux, MIT; the wallpaper build), locked
// to its baked-in "MINE" default look: a woven light-field core with a rotating
// ring of pre-rendered dot-matrix data cards, stacked beam layers bursting
// outward, the KPI header and the eight instrument panels below the stage.
// The wallMedia param decides what happens at the hook:
// - "off" (default): no user media at all, no panel transition — the page
//   and its BGM play for durationMs (default 5 s, up to the host watchdog's
//   120 s ceiling — a bottom line the engine never crosses), then hand over;
// - "all": the media library (runtime.library, falling back to [media]) fills
//   the eight slots in order and wraps around;
// - "single": every slot shows the currently selected item (runtime.media).
// With "all"/"single" the run has three phases: (A) for hookMs (default 5 s)
// the full page animation plays on its uneven beat clock; (B) a ~0.9 s glitch
// transition where the eight slots cut to chroma green #00B140 (the reference
// mock) and each runs its OWN transition layer — eight distinct glitch styles
// (band slips, a sweeping line, an RGB wash, jumping blocks, pixel dissolve,
// wave shear, interference noise, sliding slabs) shuffled across the slots per
// run with per-layer random parameters — while the halo stage keeps playing
// untouched; (C) the wall: one item per slot, videos decoded once per unique
// URL and distributed as cover-fit draws (an eight-way wall costs one decode,
// not eight; past four unique videos the engine warns on the console). Only
// the first video source (the program monitor) carries the volume param and
// its video-player-style unmute probe, the rest stay muted. The video variant
// completes when every video source has ended, the image variant holds and
// completes; the halo keeps playing through both. skip() freezes on the wall;
// without a 2d context (jsdom) the run fails open straight to completion.
// The engine ships its stylesheet inside its own root node (a self-contained
// unit — styles.ts stays untouched) and never mounts anything outside
// runtime.container except the shared unmute-hint pill, like video-player.
// Deviations from the source page, all forced by the embedding or by the baked
// config: no BGM and no tuning console (the MINE preset values below are the
// page's baked default), effects that preset disables (bokeh, atmosphere,
// vignette, ring shadow, web/depth blur, parallax) are removed outright, and
// the ring's Path2D strands stroke in three brightness passes via beginPath.

import type {
  AnimationController,
  AnimationRuntime,
  OpeningAnimation,
} from "../registry";
import { HALOFLUX_BGM_BASE64 } from "./haloflux-bgm-assets";

/** Time until the glitch transition takes over (all/single modes only). */
const DEFAULT_HOOK_MS = 5000;
const MIN_HOOK_MS = 2000;
const MAX_HOOK_MS = 15000;

/** wallMedia "off": the run's total length. The hard ceiling is the host's
 * max-duration watchdog at its longest setting (120 s) — a bottom line the
 * engine never crosses. */
const DEFAULT_RUN_MS = 5000;
const MIN_RUN_MS = 2000;
const MAX_RUN_MS = 120_000;

/** The wallMedia param: what the eight panels do at the hook. */
type WallMedia = "off" | "all" | "single";
const WALL_MEDIA_OPTIONS: ReadonlyArray<WallMedia> = ["off", "all", "single"];

/** Length of the glitch phase itself; hookMs + this lands on the wall cut.
 * The first half glitches the panels' own content (the instruments stay
 * readable, shaken and torn); only the second half cuts to the green slots
 * and their transition layers — a full-length green screen read as "the
 * panels turn green" instead of a transition. */
const GLITCH_MS = 900;
const GLITCH_CONTENT_MS = 450;
/** The instrument panels' own background — the glitch layers' base color, so
 * the second half reads as failing panels, not as a green page. */
const PANEL_BG = "#0e0f12";
/** The reference mock's chroma green: the wall flashes this before each slot
 * draws its item (and keeps it while a video source is still loading). */
const CHROMA_GREEN = "#00B140";
/** After the cut the wall shake decays for this long. */
const JITTER_MS = 520;
/** Image variant (or a video run whose library has no video at all): hold on
 * the finished wall before completing. */
const IMAGE_HOLD_MS = 2600;
/** The program source's linear volume ramp after a successful unmute. */
const VIDEO_FADE_IN_MS = 900;
/** The audio fade tick (video-player's constant). */
const FADE_TICK_MS = 50;
/** Decode-guard threshold: past this many unique video sources the engine
 * warns on the console (one muted <video> per unique URL). */
const MAX_DECODE_SOURCES = 4;

/** Default BGM (wallMedia "off" only): loudness (the source wallpaper's 55/100)
 * and the hand-over fade length. Audible when the browser allows autoplay,
 * silently absent when it does not — a muted background track is pointless. */
const DEFAULT_BGM_VOLUME = 0.55;
const BGM_FADE_MS = 350;

/* ------------------------------------------------------------------ */
/* Baked scene configuration — the HALOFLUX "MINE" preset (2026-10-21), */
/* inlined verbatim. Not a user parameter surface: hookMs is the only  */
/* knob this engine exposes (the source page's console is gone).       */
/* ------------------------------------------------------------------ */
const C = {
  tempo: 2.5, camera: 1, camZoom: 1, glow: 1.1, scan: 1,
  ringSpeed: 3, ringPause: 1.2, ringWidth: 1.3, rimBright: 1.8, rimWidth: 1.3, dataFlicker: 1,
  webBright: 0.9, webPulseBase: 0.1, webPulseAmp: 0.8, webSpin: 1,
  runnerCount: 788, runnerBright: 0.5, runnerWidth: 1, runnerSpeed: 0.6, runnerVariety: 0.4,
  cometPerBeat: 2.3, cometBurst: 9, cometTrickle: 1.5, cometLines: 1, cometWidth: 1,
  cometBright: 1, cometGlow: 1.1, cometSpeed: 0.8, cometFollow: 1,
  beamBright: 1.8, beamLen: 1.8, beamWidth: 0.7, beamBounce: 2, beamGlow: 3.5,
  dashBright: 1.9, hazeCount: 22, hazeBright: 1.5,
  flyerCount: 3, flyerBright: 3, flyerWidth: 1.4, flyerSpeed: 2.2,
  burstRate: 3.5, burstSize: 3, burstBright: 2.5, flareRate: 3.5, flareBright: 2,
  rimDensity: 1.2,
} as const;

const FONT = 'ui-monospace,"Cascadia Mono","SF Mono",Consolas,"Liberation Mono",monospace';

/* ---------- ring card content tokens (the source page's, verbatim) ---------- */
const TINTS: ReadonlyArray<readonly [number, number, number]> = [
  [232, 234, 240], [232, 234, 240], [232, 234, 240], [232, 234, 240], [232, 234, 240],
  [232, 234, 240], [196, 184, 246], [196, 184, 246], [168, 222, 214], [206, 212, 150],
];
const HEAD = ["SOLVER/02", "EXTRACT", "REF.SCENE 07", "METHOD M04", "CHECK", "RESIDUAL", "PAPER 37", "AGENT 09", "BUFFER A",
  "DIFF FIELD", "STEP 1284", "MESH 64x64", "PROJECT", "ADVECT", "BC / WALL", "LBM D2Q9", "QUEUE", "TRACE", "EQ.(4)", "FIG.3", "VALIDATE", "SCENE 12"];
const KEYS = ["dt", "CFL", "nu", "Re", "tol", "iter", "L2", "mass", "div", "u_max", "rho", "err", "grid", "seed"];
const CODE_T = ["load()", "step(u)", "proj(p)", "bc.apply", "solve()", "grad p", "div u", "assert", "f_eq", "stream", "collide", "ok", "PASS",
  "ref#12", "diff", "L2<tol", "u*", "->", "==", "dt/2", "emit", "push", "read", "fig3", "eq4"];
const CHECKS: ReadonlyArray<readonly [string, string]> = [
  ["STABILITY CHECK", "CFL = |u| Δt / Δx"], ["MASS CONSERVATION", "Σ ρ dV = const"], ["RESIDUAL NORM", "r = ‖b − A·u‖₂"],
  ["BOUNDARY", "u · n = 0  on ∂Ω"], ["PROJECTION", "∇²p = ∇ · u* / Δt"],
];

/* ---------- panel content tokens ---------- */
const ACTS = ["extract governing equation", "prepare clean checkout", "load shared reference scene", "implement independent method",
  "review numerical stability", "check mass conservation", "record boundary conditions", "attach source page links",
  "compare reference outputs", "retain missing details", "package clean checkout", "validate sample buffer",
  "diff against reference scene", "resolve ambiguous notation", "reproduce figure 3", "sweep timestep sensitivity"];
const VERBS = ["build", "check", "read", "qa", "build", "check"];
const CODE: ReadonlyArray<readonly [string, string, string]> = [
  ["papers", "load_collection", "()"], ["eqs", "extract_equations", "(papers)"], ["inputs", "shared_scene", "()"],
  ["state", "method.step", "(inputs)"], ["", "check_mass", "(state, reference)"], ["", "check_stability", "(state)"],
  ["", "compare_reference", "(state)"], ["", "attach_page_refs", "(eqs)"], ["", "retain_missing_details", "()"],
  ["", "package_clean_checkout", "()"],
];
const ROUTES = ["navier-st", "settings", "lbm-d2q9", "stam-fluid", "page refs", "missing"];
const COLSR = ["extract", "attach", "inspect"];
const ROLES = ["read", "build", "review", "qa"];
const ROLE_COL: Record<string, string> = { read: "#98e0cf", build: "#f0a6c6", review: "#d7dae0", qa: "#f0a6c6" };

/* ---------- small math helpers (the source page's, verbatim) ---------- */
const TAU = Math.PI * 2;
const rnd = Math.random;
const rr = (a: number, b: number): number => a + rnd() * (b - a);
const pick = <T,>(a: ReadonlyArray<T>): T => a[(rnd() * a.length) | 0]!;
const gauss = (): number => (rnd() + rnd() + rnd() - 1.5) / 1.5;
const easeIO = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOX = (t: number): number => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const normA = (a: number): number => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
const hash = (x: number): number => { const s = Math.sin(x * 12.9898) * 43758.5453; return s - Math.floor(s); };
const rgba = (t: readonly [number, number, number], a: number): string => `rgba(${t[0]},${t[1]},${t[2]},${a})`;
const fmtNum = (): string => {
  const k = rnd();
  return k < 0.3 ? rr(0, 1).toFixed(3)
    : k < 0.55 ? `${rr(1, 9).toFixed(1)}e-${2 + ((rnd() * 5) | 0)}`
      : k < 0.8 ? String((rnd() * 9999) | 0)
        : rr(0, 100).toFixed(1);
};

/* ---------- ring card renderers (ctx, x0, x1, y0, y1, tint) — x radial, y tangential ---------- */
function glyphStrips(x: CanvasRenderingContext2D, x1: number, y0: number, y1: number, pitch: number,
  opt: { tint: readonly [number, number, number]; ragged?: boolean; colGap?: boolean; solid?: boolean; th: number }): void {
  const tint = opt.tint;
  for (let lx = 0; lx < x1 - 1; lx += pitch) {
    if (opt.colGap && rnd() < 0.18) { lx += pitch * 0.8; continue; }
    const len = (y1 - y0) * (opt.ragged ? rr(0.35, 1) : rr(0.85, 1));
    const start = opt.ragged && rnd() < 0.3 ? y0 + rr(0, (y1 - y0) * 0.3) : y0;
    let y = start;
    const lb = rr(0.55, 1);
    while (y < Math.min(y1, start + len)) {
      const cl = opt.solid ? rr(2, 6) : rr(0.9, 2.2);
      if (rnd() < 0.9) { x.fillStyle = rgba(tint, lb * rr(0.6, 1)); x.fillRect(lx, y, opt.th, Math.min(cl, y1 - y)); }
      y += cl + (rnd() < 0.12 ? rr(1.5, 3) : rr(0.5, 0.9));
    }
  }
}
function cardHeader(x: CanvasRenderingContext2D, x0: number, x1: number, y: number, t: readonly [number, number, number]): number {
  x.font = `700 4.3px ${FONT}`; x.fillStyle = rgba(t, 0.95); x.fillText(pick(HEAD), x0, y);
  x.fillStyle = rgba(t, 0.55); x.fillText(String((rnd() * 99) | 0).padStart(2, "0"), x1 - 6, y);
  x.fillStyle = rgba(t, 0.3); x.fillRect(x0, y + 5.6, x1 - x0, 0.45);
  return y + 7.5;
}
const BLOCKS: Record<string, (c: CanvasRenderingContext2D, x0: number, x1: number, y0: number, y1: number, t: readonly [number, number, number]) => void> = {
  code(c, x0, x1, y0, y1, t) {
    let y = cardHeader(c, x0, x1, y0, t);
    c.font = `500 3.5px ${FONT}`;
    let n = 1 + ((rnd() * 40) | 0);
    while (y < y1 - 3.5) {
      c.fillStyle = rgba(t, 0.3); c.fillText(String(n++).padStart(3, "0"), x0, y);
      let xx = x0 + 9;
      const words = 1 + ((rnd() * 4) | 0);
      for (let i = 0; i < words && xx < x1 - 4; i++) {
        const w = pick(CODE_T); c.fillStyle = rgba(t, rnd() < 0.25 ? 1 : rr(0.5, 0.8)); c.fillText(w, xx, y); xx += w.length * 2.15 + 2;
      }
      y += 4.6;
    }
  },
  kv(c, x0, x1, y0, y1, t) {
    let y = y1 - y0 > 18 ? cardHeader(c, x0, x1, y0, t) : y0 + 1;
    c.font = `500 3.6px ${FONT}`;
    while (y < y1 - 4) {
      c.fillStyle = rgba(t, 0.5); c.fillText(pick(KEYS), x0, y);
      const v = fmtNum(); c.fillStyle = rgba(t, 0.95); c.textAlign = "right"; c.fillText(v, x1, y); c.textAlign = "left";
      const bx = x0 + 14, bw = Math.max(0, x1 - x0 - 14 - v.length * 2.2 - 4);
      c.fillStyle = rgba(t, 0.15); c.fillRect(bx, y + 1.2, bw, 1.2);
      c.fillStyle = rgba(t, 0.7); c.fillRect(bx, y + 1.2, bw * rnd(), 1.2);
      y += 5.2;
    }
  },
  spark(c, x0, x1, y0, y1, t) {
    const y = cardHeader(c, x0, x1, y0, t), top = y + 1, bot = y1 - 2, n = 40;
    c.fillStyle = rgba(t, 0.18); c.fillRect(x0, bot, x1 - x0, 0.4); c.fillRect(x0, (top + bot) / 2, x1 - x0, 0.25);
    c.strokeStyle = rgba(t, 0.95); c.lineWidth = 0.55; c.beginPath();
    let v = rnd(), lx = 0, ly = 0;
    for (let i = 0; i <= n; i++) {
      v = clamp(v + gauss() * 0.22, 0, 1);
      lx = x0 + ((x1 - x0) * i) / n; ly = bot - v * (bot - top);
      if (i) c.lineTo(lx, ly); else c.moveTo(lx, ly);
    }
    c.stroke(); c.fillStyle = "#fff"; c.fillRect(lx - 0.9, ly - 0.9, 1.8, 1.8);
  },
  bars(c, x0, x1, y0, y1, t) {
    const y = cardHeader(c, x0, x1, y0, t), n = 6 + ((rnd() * 10) | 0), bh = (y1 - y - 1) / n;
    c.font = `500 3px ${FONT}`;
    for (let i = 0; i < n; i++) {
      const v = rr(0.1, 1), yy = y + i * bh;
      c.fillStyle = rgba(t, 0.35); c.fillText(String(i).padStart(2, "0"), x0, yy);
      c.fillStyle = rgba(t, v > 0.85 ? 1 : 0.65); c.fillRect(x0 + 7, yy + 0.4, (x1 - x0 - 7) * v, Math.max(0.8, bh - 1.2));
    }
  },
  prog(c, x0, x1, y0, y1, t) {
    let y = y1 - y0 > 18 ? cardHeader(c, x0, x1, y0, t) : y0 + 1;
    c.font = `500 3.4px ${FONT}`;
    while (y < y1 - 5) {
      const p = rnd();
      c.fillStyle = rgba(t, 0.55); c.fillText(pick(["read", "build", "review", "qa", "sync", "diff"]), x0, y);
      c.fillStyle = rgba(t, 0.9); c.textAlign = "right"; c.fillText(`${(p * 100) | 0}%`, x1, y); c.textAlign = "left";
      const bx = x0 + 15, bw = x1 - x0 - 26, segs = 12;
      for (let i = 0; i < segs; i++) { c.fillStyle = rgba(t, i / segs < p ? 0.85 : 0.14); c.fillRect(bx + (i * bw) / segs, y + 0.6, bw / segs - 0.6, 2); }
      y += 5.4;
    }
  },
  grid(c, x0, x1, y0, y1, t) {
    const y = y1 - y0 > 20 ? cardHeader(c, x0, x1, y0, t) : y0 + 1, p = rr(2.4, 3.2);
    for (let yy = y; yy < y1 - p + 0.5; yy += p) for (let xx = x0; xx < x1 - p + 0.5; xx += p) {
      const v = rnd();
      c.fillStyle = v > 0.93 ? "rgba(240,166,198,.95)" : rgba(t, 0.08 + v * v * 0.8);
      c.fillRect(xx, yy, p - 0.6, p - 0.6);
    }
  },
  gauge(c, x0, x1, y0, y1, t) {
    const r = Math.min((y1 - y0) / 2 - 1.5, 9), gx = x0 + r + 1, gy = (y0 + y1) / 2, v = rnd();
    c.lineWidth = 1.2; c.strokeStyle = rgba(t, 0.15); c.beginPath(); c.arc(gx, gy, r, 0, TAU); c.stroke();
    c.strokeStyle = rgba(t, 0.95); c.beginPath(); c.arc(gx, gy, r, -Math.PI / 2, -Math.PI / 2 + TAU * v); c.stroke();
    c.font = `700 ${Math.max(3.2, r * 0.55)}px ${FONT}`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillStyle = rgba(t, 1); c.fillText(`${(v * 100) | 0}`, gx, gy); c.textAlign = "left"; c.textBaseline = "top";
    if (x1 - (gx + r) > 20) BLOCKS.kv!(c, gx + r + 4, x1, y0, y1, t);
  },
  wave(c, x0, x1, y0, y1, t) {
    const y = cardHeader(c, x0, x1, y0, t), mid = (y + y1) / 2, amp = (y1 - y) * 0.38, f1 = rr(0.15, 0.4), f2 = rr(0.5, 1.2), ph = rnd() * 6;
    ([[0.95, 1], [0.4, -0.6]] as ReadonlyArray<readonly [number, number]>).forEach(([a, k]) => {
      c.strokeStyle = rgba(t, a); c.lineWidth = 0.5; c.beginPath();
      for (let xx = x0; xx <= x1; xx += 0.8) { const yy = mid + amp * k * (Math.sin(xx * f1 + ph) * 0.7 + Math.sin(xx * f2) * 0.3); if (xx === x0) c.moveTo(xx, yy); else c.lineTo(xx, yy); }
      c.stroke();
    });
  },
  para(c, x0, x1, y0, y1, t) { glyphStrips(c, x1, y0, y1, rr(2.6, 3.4), { tint: t, ragged: true, th: 1.3 }); },
  cols(c, x0, x1, y0, y1, t) { glyphStrips(c, x1, y0, y1, rr(3.6, 4.6), { tint: t, colGap: true, th: 1.5 }); },
  barcode(c, x0, x1, y0, y1, t) { glyphStrips(c, x1, y0, y1, rr(3.2, 4.2), { tint: t, solid: true, th: 1.8 }); },
  matrix(c, x0, x1, y0, y1, t) {
    const p = rr(2.1, 2.6), dens = rr(0.35, 0.65);
    for (let yy = y0; yy < y1 - 1; yy += p) for (let xx = x0; xx < x1; xx += p)
      if (rnd() < dens) { c.fillStyle = rgba(t, rr(0.5, 1)); c.fillRect(xx, yy, 1.4, 1.4); }
  },
};
const BLOCK_W: ReadonlyArray<readonly [string, number]> = [["code", 16], ["kv", 11], ["spark", 9], ["bars", 8], ["prog", 7], ["grid", 7], ["gauge", 3], ["wave", 4],
  ["para", 12], ["cols", 7], ["barcode", 6], ["matrix", 8]];
const NEEDS_H: Record<string, number> = { code: 18, spark: 18, bars: 20, wave: 18, gauge: 16 };
function pickBlock(h: number): string {
  for (let tries = 0; tries < 8; tries++) {
    let r = rnd() * 100, name = "para";
    for (const [n, w] of BLOCK_W) { r -= w; if (r <= 0) { name = n; break; } }
    if (!(name in NEEDS_H) || h >= NEEDS_H[name]!) return name;
  }
  return pick(["para", "kv", "matrix", "barcode"]);
}

/* ---------- stylesheet: the source page's layout reworked under the hx-
   prefix, plus the glitch/jitter phases and the media layer. Shipped as a
   <style> node inside the engine root so the unit stays self-contained;
   the panel-canvas rule out-specifies the host's blanket
   `.dsh-opening-stage canvas { position:absolute }`. ---------- */
const STYLE = `
.dsh-opening-hx{position:absolute;inset:0;overflow:hidden;background:#08090b;color:#cfd2d8;
  font:13px ${FONT}}
.dsh-opening-hx *{box-sizing:border-box}
.dsh-opening-hx canvas{display:block}
.dsh-opening-hx .hx-p canvas{position:static;width:100%;flex:1;min-height:0}
.dsh-opening-hx .hx-app{display:grid;grid-template-rows:auto minmax(0,1fr) auto;height:100%}
.dsh-opening-hx header{display:grid;grid-template-columns:minmax(240px,1.7fr) repeat(5,minmax(0,1fr));align-items:end;
  border-bottom:1px solid #25282e;padding:10px 18px 0;background:#0a0b0d}
.dsh-opening-hx .hx-brand h1{white-space:nowrap;margin:0;font-size:21px;font-weight:800;letter-spacing:1.5px;color:#f4f5f7}
.dsh-opening-hx .hx-brand p{margin:3px 0 9px;font-size:9px;color:#6b6f78;letter-spacing:1.2px}
.dsh-opening-hx .hx-kpi{padding:0 10px 9px;position:relative}
.dsh-opening-hx .hx-kpi .k{font-size:9px;color:#6b6f78;letter-spacing:1.2px}
.dsh-opening-hx .hx-kpi .v{font-size:14px;font-weight:800;color:#f4f5f7;font-variant-numeric:tabular-nums}
.dsh-opening-hx .hx-kpi .v.pink{color:#f0a6c6}
.dsh-opening-hx .hx-kpi .seg{position:absolute;left:10px;right:0;bottom:-1px;height:2px;background:#25282e}
.dsh-opening-hx .hx-kpi .seg i{display:block;height:100%;background:#cfd2d8;width:0;transition:width 1.2s ease}
.dsh-opening-hx .hx-stage-wrap{position:relative;min-height:0;overflow:hidden}
.dsh-opening-hx .hx-stage{position:absolute;inset:0;width:100%;height:100%}
.dsh-opening-hx .hx-stage-wrap::after{content:"";position:absolute;inset:0;pointer-events:none;
  background:repeating-linear-gradient(0deg,rgba(0,0,0,.18) 0 1px,transparent 1px 3px),
             radial-gradient(ellipse at 40% 50%,transparent 55%,rgba(0,0,0,.55) 100%)}
.dsh-opening-hx .hx-ov{position:absolute;font-size:9px;letter-spacing:1px;color:#cfd2d8;pointer-events:none;z-index:2}
.dsh-opening-hx .hx-chk{left:0;top:0;will-change:transform;background:rgba(8,9,11,.85);border:1px solid #3a3e46;padding:5px 8px;transition:opacity .4s}
.dsh-opening-hx .hx-chk b{display:block;font-size:8px;color:#6b6f78;font-weight:600;margin-bottom:3px}
.dsh-opening-hx .hx-chk span{font-size:12px;color:#f4f5f7;font-weight:600;white-space:nowrap}
.dsh-opening-hx .hx-status{right:16px;bottom:12px;text-align:right}
.dsh-opening-hx .hx-status .big{font-size:11px;color:#f4f5f7;font-weight:800}
.dsh-opening-hx .hx-status .sm{color:#6b6f78;font-size:8px;margin-top:2px}
.dsh-opening-hx .hx-panels{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:8px 12px 12px;
  border-top:1px solid #25282e;background:#0a0b0d}
.dsh-opening-hx .hx-p{position:relative;border:1px solid #25282e;background:#0e0f12;padding:7px 10px 6px;height:clamp(118px,17vh,168px);
  display:flex;flex-direction:column;overflow:hidden;min-width:0}
.dsh-opening-hx .hx-p h3{margin:0 0 5px;font-size:9px;font-weight:800;letter-spacing:1.3px;color:#f4f5f7;white-space:nowrap}
.dsh-opening-hx .hx-p .cap{margin-top:auto;font-size:8px;color:#6b6f78;padding-top:3px;white-space:nowrap;overflow:hidden}
.dsh-opening-hx .hx-feed{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:flex-end;font-size:9px;line-height:1.4;overflow:hidden}
.dsh-opening-hx .hx-feed div{white-space:nowrap;color:#6b6f78}
.dsh-opening-hx .hx-feed div:last-child{color:#f4f5f7;font-weight:600}
.dsh-opening-hx .hx-feed .n{color:#3f434a;margin-right:8px}
.dsh-opening-hx .hx-feed .vb{display:inline-block;width:42px;font-weight:800}
.dsh-opening-hx .hx-feed .vb.build{color:#f0a6c6}.dsh-opening-hx .hx-feed .vb.check{color:#cfd2d8}
.dsh-opening-hx .hx-feed .vb.read{color:#98e0cf}.dsh-opening-hx .hx-feed .vb.qa{color:#f4f5f7}
.dsh-opening-hx .hx-btns{display:flex;gap:4px;margin-top:4px}
.dsh-opening-hx .hx-btns span{flex:1;font-size:8px;border:1px solid #3a3e46;padding:1px 5px;color:#6b6f78;transition:all .3s}
.dsh-opening-hx .hx-btns span.on{background:#cfd2d8;color:#000;border-color:#cfd2d8}
.dsh-opening-hx .hx-code{flex:1;min-height:0;font-size:9px;line-height:1.45;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end}
.dsh-opening-hx .hx-code div{white-space:nowrap}
.dsh-opening-hx .hx-code .ln{color:#3f434a;margin-right:10px}
.dsh-opening-hx .hx-code .fn{color:#f4f5f7;font-weight:800}
.dsh-opening-hx .hx-code .op{color:#6b6f78}
.dsh-opening-hx .hx-caret{display:inline-block;width:6px;height:10px;background:#f4f5f7;vertical-align:-1px;animation:hx-bl 1s steps(1) infinite}
@keyframes hx-bl{50%{opacity:0}}
.dsh-opening-hx .hx-routes{display:grid;grid-template-columns:1.2fr repeat(3,1fr);gap:3px 6px;font-size:8px;align-content:start}
.dsh-opening-hx .hx-routes .h{color:#6b6f78;font-weight:800;letter-spacing:1px}
.dsh-opening-hx .hx-routes .nm{color:#cfd2d8;white-space:nowrap;overflow:hidden}
.dsh-opening-hx .hx-chip{display:inline-block;padding:0 4px;border:1px solid #3a3e46;border-radius:2px;color:#3f434a;line-height:11px;transition:all .3s}
.dsh-opening-hx .hx-chip.on{background:#d6d8dd;color:#000;border-color:#d6d8dd}
.dsh-opening-hx .hx-chip.done{background:#2b2e34;color:#cfd2d8;border-color:#2b2e34}
.dsh-opening-hx .hx-chip.pk{background:rgba(240,166,198,.25);color:#f0a6c6;border-color:rgba(240,166,198,.5)}
.dsh-opening-hx .hx-agents{display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;font-size:8px;align-content:start}
.dsh-opening-hx .hx-ag{display:flex;align-items:center;gap:5px;white-space:nowrap}
.dsh-opening-hx .hx-ag .id{color:#3f434a}.dsh-opening-hx .hx-ag .rl{width:36px;color:#cfd2d8;font-weight:600}
.dsh-opening-hx .hx-ag .cells{display:flex;gap:1px}
.dsh-opening-hx .hx-ag .cells i{width:7px;height:7px;background:#1d1f24}
.dsh-opening-hx .hx-ag .st{color:#6b6f78;overflow:hidden}
.dsh-opening-hx .hx-ag .st.w{color:#f4f5f7}
/* ---- phase B, first half — the panels' own content glitches: the four
   working canvases tear via snapshot passes while the DOM panels shake; the
   wall slots stay hidden. ---- */
.dsh-opening-hx.hx-glitch{filter:hue-rotate(8deg) contrast(1.1)}
.dsh-opening-hx.hx-glitch header,.dsh-opening-hx.hx-glitch .hx-panels{animation:hx-shake 120ms steps(2,end) infinite}
.dsh-opening-hx.hx-glitch .hx-p{animation:hx-slice 180ms steps(3,end) infinite}
.dsh-opening-hx.hx-glitch .hx-brand h1,.dsh-opening-hx.hx-glitch .hx-p h3{
  text-shadow:2px 0 rgba(255,0,80,.6),-2px 0 rgba(0,255,240,.6)}
@keyframes hx-shake{0%{transform:translate(0)}25%{transform:translate(-4px,2px)}
  50%{transform:translate(3px,-2px)}75%{transform:translate(-2px,-1px)}100%{transform:translate(0)}}
@keyframes hx-slice{0%{transform:translate(0);clip-path:inset(0)}
  33%{transform:translate(3px,-1px);clip-path:inset(8% 0 4% 0)}
  66%{transform:translate(-3px,2px);clip-path:inset(2% 0 12% 0)}100%{transform:translate(0);clip-path:inset(0)}}
/* ---- phase B, second half — the eight slots cut in: dark panel base + one
   shuffled green glitch layer each (GLITCH_LAYERS); the chroma green itself
   only flashes where an item is still loading. ---- */
/* ---- phase C: the eight-slot monitor wall ----
   One canvas per panel, covering the whole card (title included) once the
   wall cuts in; until an item is drawn the slot shows the reference mock's
   chroma green. The higher-specificity absolute rule beats the generic
   working-canvas position:static rule above. */
.dsh-opening-hx .hx-p canvas.hx-mcv{position:absolute;inset:0;z-index:3;width:100%;height:100%;flex:none;visibility:hidden}
.dsh-opening-hx .hx-p canvas.hx-mcv.hx-mcv-show{visibility:visible}
.dsh-opening-hx .hx-panels.hx-jitter{animation:hx-jitter ${JITTER_MS}ms steps(2,end) 2}
@keyframes hx-jitter{0%{transform:translate(0)}20%{transform:translate(-6px,3px)}
  40%{transform:translate(5px,-4px) skewX(2deg)}60%{transform:translate(-4px,-2px)}
  80%{transform:translate(3px,4px) skewX(-1.5deg)}100%{transform:translate(0)}}
@media (max-width:1000px){
  .dsh-opening-hx header{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px 0}
  .dsh-opening-hx .hx-brand{grid-column:1/-1}
  .dsh-opening-hx .hx-panels{grid-template-columns:repeat(2,minmax(0,1fr))}
}
`;

/* A panel canvas plus its fitted 2d context (w/h in CSS pixels). */
interface Panel {
  cv: HTMLCanvasElement;
  x: CanvasRenderingContext2D | null;
  w: number;
  h: number;
}

/* One decode source behind the wall: a unique library item. Videos are a
 * single muted <video> per URL whose frames are distributed to every slot
 * showing that item; `primary` marks the program source that carries the
 * volume param and the unmute probe. `ready` gates the slot's green screen. */
type WallSource =
  | { kind: "image"; img: HTMLImageElement; ready: boolean; url: string }
  | { kind: "video"; video: HTMLVideoElement; ready: boolean; primary: boolean; ended: boolean; url: string };

/* One panel transition layer: a per-frame draw over the chroma green. */
type GlitchLayer = { draw: (x: CanvasRenderingContext2D, w: number, h: number) => void };

/** The eight panel transition layers — eight distinct glitch styles. At the
 * cut they are shuffled across the slots (one style per slot, every style
 * used exactly once) and each instance carries its own random speed/seed, so
 * every run fails eight ways, differently. */
const GLITCH_LAYERS: ReadonlyArray<() => GlitchLayer> = [
  // 1 slipping horizontal bands
  () => ({
    draw(x, w, h) {
      const n = 2 + ((rnd() * 2) | 0);
      for (let i = 0; i < n; i++) {
        const bh = rr(4, h * 0.14), by = rnd() * (h - bh), dx = rr(-60, 60);
        x.fillStyle = rnd() < 0.5 ? "rgba(0,70,35,.6)" : "rgba(150,255,180,.45)";
        x.fillRect(dx, by, w, bh);
      }
    },
  }),
  // 2 sweeping bright line with a tail
  () => {
    const sp = rr(1.2, 2.6), seed = rnd() * 10;
    return {
      draw(x, w, h) {
        const sy = ((((performance.now() / 1000) * sp + seed) % 1.3) - 0.15) * h;
        x.fillStyle = "rgba(255,255,255,.5)";
        x.fillRect(0, sy, w, rr(5, 14));
        x.fillStyle = "rgba(255,255,255,.16)";
        x.fillRect(0, sy - 20, w, 20);
      },
    };
  },
  // 3 RGB split wash
  () => {
    const sp = rr(4, 12);
    return {
      draw(x, w, h) {
        const dx = Math.sin((performance.now() / 1000) * sp) * 12;
        x.fillStyle = "rgba(255,0,110,.22)";
        x.fillRect(-dx, 0, w, h);
        x.fillStyle = "rgba(0,255,230,.22)";
        x.fillRect(dx, 0, w, h);
      },
    };
  },
  // 4 jumping blocks
  () => ({
    draw(x, w, h) {
      const n = 3 + ((rnd() * 3) | 0);
      for (let i = 0; i < n; i++) {
        x.fillStyle = rnd() < 0.5 ? "rgba(0,60,30,.5)" : "rgba(120,255,160,.4)";
        x.fillRect(rnd() * w * 0.85, rnd() * h * 0.9, rr(24, w * 0.3), rr(8, h * 0.25));
      }
    },
  }),
  // 5 pixel dissolve
  () => ({
    draw(x, w, h) {
      const cell = 14;
      for (let yy = 0; yy < h; yy += cell) {
        for (let xx = 0; xx < w; xx += cell) {
          if (rnd() > 0.12) continue;
          x.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,.5)" : "rgba(0,50,25,.55)";
          x.fillRect(xx, yy, cell - 1, cell - 1);
        }
      }
    },
  }),
  // 6 wave-sheared columns
  () => {
    const sp = rr(2.2, 4.5), amp = rr(5, 15), seed = rnd() * 10;
    return {
      draw(x, w, h) {
        const t = performance.now() / 1000;
        x.fillStyle = "rgba(0,55,28,.5)";
        for (let xx = 0; xx < w; xx += 10) {
          const dy = Math.sin(xx * 0.045 + t * sp + seed) * amp;
          x.fillRect(xx, dy, 4, h);
        }
      },
    };
  },
  // 7 interference noise lines + the rare full flash
  () => ({
    draw(x, w, h) {
      const n = 40 + ((rnd() * 40) | 0);
      for (let i = 0; i < n; i++) {
        x.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,.35)" : "rgba(0,20,10,.5)";
        x.fillRect(rnd() * w, rnd() * h, rr(6, w * 0.35), rr(1, 2.5));
      }
      if (rnd() < 0.06) {
        x.fillStyle = "rgba(255,255,255,.16)";
        x.fillRect(0, 0, w, h);
      }
    },
  }),
  // 8 sliding vertical slabs
  () => {
    const sp = rr(1.5, 3.5), seed = rnd() * 10;
    return {
      draw(x, w, h) {
        const t = performance.now() / 1000;
        for (let i = 0; i < 3; i++) {
          const bx = (((seed * 97 + i * 211) % 100) / 100) * w * 0.8;
          const dy = Math.sin(t * sp + i * 2.1 + seed) * h * 0.35;
          x.fillStyle = "rgba(0,45,22,.55)";
          x.fillRect(bx, dy, rr(22, 70), h);
        }
      },
    };
  },
];

interface Slot { a: number; da: number; hpx: number; c: HTMLCanvasElement | null; flash: number }
interface Wedge {
  i0: number; n: number; base: number; len: number; kick: number; ph: number; ph2: number;
  f1: number; f2: number; lum: number; tint: number; lwK: number; lenS: number;
  prof: number[]; pf: number[]; pp: number[]; ds: number[]; dsp: number; flow: number;
  vis?: boolean;
}
interface StrandLayer { step: number; rotK: number; lumK: number; lw: number; lenK: number; solidK: number; wedges: Wedge[]; off: number; dyn: string }
interface Haze { a: number; w: number; len: number; cur: number; age: number; life: number; alpha: number; tint: number; drift: number; seed?: number }
interface Flare { a: number; w: number; len: number; age: number; life: number; alpha: number; seed?: number }
interface Flyer { a: number; len: number; r: number; sp: number; lw: number; lv: number; tint: number; burst: boolean }
interface FlyBand { a: number; w: number; life: number }
interface Comet {
  lines: Array<{ arc?: boolean; r?: number; a0?: number; span?: number; p0?: { x: number; y: number }; c?: { x: number; y: number }; p1?: { x: number; y: number } }>;
  life: number; hit: boolean; rot0: number; dur: number; win: number; glow: boolean; tint: boolean;
}
interface Pulse { c: number; v: number; w: number; amp: number; life: number; L: number }
interface Runner { cv: Curve; t: number; sp: number; mode: number; px: number; py: number; b: boolean }
interface Curve { p0: { x: number; y: number }; c: { x: number; y: number }; p1: { x: number; y: number } }
interface Ag { id: string; role: string; p: number; sp: number; st: string }

export class HalofluxEngine implements AnimationController {
  private readonly runtime: AnimationRuntime;
  private readonly root: HTMLDivElement;
  private readonly app: HTMLDivElement;
  /** The eight wall slots, one per instrument panel, in grid order. */
  private readonly wall: Panel[] = [];
  /** Unique decode sources (one per distinct library item). */
  private readonly sources: WallSource[] = [];
  /** Slot i draws sources[i % sources.length]. */
  private readonly slotSource: WallSource[] = [];
  /** The program source: the first video (volume param + unmute probe). */
  private primary: WallSource | null = null;
  /** The wallMedia param: "off" | "all" | "single". */
  private readonly wallMedia: WallMedia;
  /** One transition layer per slot, shuffled at the glitch cut. */
  private glitchLayers: GlitchLayer[] = [];
  /** Glitch sub-phase: the panels' own content first, the green slots after. */
  private glitchStage: "content" | "wall" = "content";
  /** Content-glitch snapshots: [live working canvas, frozen snapshot]. */
  private glitchSnaps: Array<{ cv: HTMLCanvasElement; snap: HTMLCanvasElement }> = [];
  private readonly stage: HTMLCanvasElement;
  private readonly chkEl: HTMLDivElement;
  private readonly segEls: NodeListOf<HTMLElement>;
  private readonly stBig: HTMLElement;
  /** Video variant only: program loudness 0-1; 0 keeps the silent behavior. */
  private readonly targetVolume: number;
  private readonly hookMs: number;
  /** wallMedia "off": the total run length (up to the BGM's full length). */
  private readonly runMs: number;

  private sx: CanvasRenderingContext2D | null = null;
  private readonly pAdv: Panel;
  private readonly pDiff: Panel;
  private readonly pVal: Panel;
  private readonly pIdx: Panel;

  private phase: "halo" | "glitch" | "media" = "halo";
  private completed = false;
  private destroyed = false;
  private ready = false;
  private raf = 0;
  private last = 0;
  private readonly timers: number[] = [];
  private hookTimer = 0;
  private glitchTimer = 0;
  private mediaTimer = 0;
  private jitterTimer = 0;
  private fadeTimer: number | null = null;
  private resizeTimer = 0;
  /** Default BGM, wallMedia "off" only (see startBgm). */
  private bgm: HTMLAudioElement | null = null;
  private bgmFadeTimer: number | null = null;
  /** The Blob object URL backing the BGM; revoked on teardown. */
  private bgmUrl: string | null = null;
  private unmuted = false;
  private pill: HTMLElement | null = null;
  private observer: ResizeObserver | null = null;

  /* ---- scene state (the source page's module variables) ---- */
  private DPR = 1;
  private W = 0; private H = 0; private cx = 0; private cy = 0;
  private R = 0; private RO = 0; private RMAX = 0; private thV = 0; private thS = 0;
  private webBase: HTMLCanvasElement | null = null;
  private webLayers: HTMLCanvasElement[] = [];
  private trailC: HTMLCanvasElement | null = null;
  private glowC: HTMLCanvasElement | null = null;
  private laneC: HTMLCanvasElement | null = null;
  private curves: Curve[] = [];
  private runners: Runner[] = [];
  private comets: Comet[] = [];
  private wedges: Wedge[] = [];
  private pulses: Pulse[] = [];
  private webRot = 0; private ringRot = 0;
  private readonly OSTEP = 0.0038;
  private readonly GS = 3;
  private readonly HAS_FILTER: boolean;
  private T = 0;
  private beatT = 0.4; private beatI = 0; private sinceBeat = 9; private beatN = 0; private env = 0;
  private readonly PATTERN = [0.5, 0.25, 0.25, 0.5, 0.5, 0.75, 0.25, 0.25, 0.25, 1.0];
  private layerEnv = [0, 0, 0];
  private cam = { x: 0, y: 0, z: 1 };
  private shots: Array<{ x: number; y: number; z: number; hold: number }> = [];
  private shotI = 0; private shotT = 0; private camPhase: "hold" | "move" = "hold";
  private camFrom: { x: number; y: number; z: number } | null = null;
  private GR: Record<string, CanvasGradient> = {};
  private strandLayers: StrandLayer[] = [];
  private hazes: Haze[] = [];
  private flares: Flare[] = [];
  private flyBands: FlyBand[] = [];
  private flyers: Flyer[] = [];
  private slots: Slot[] = [];
  private rot = { from: 0, to: 0, t: 1, dur: 1, hold: 0, ease: easeIO as (t: number) => number };
  private advP: Array<{ x: number; y: number; l: number }> = [];
  private valBuf: number[][] = [[], [], []];
  private valSpike = 0;
  private idxData: number[][] = Array.from({ length: 11 }, () => Array.from({ length: 28 }, () => rnd()));
  private feedN = 37;
  private feedEl: HTMLElement | null = null;
  private codeEl: HTMLElement | null = null;
  private cLine = 0; private cChar = 0; private cNum = 7; private typed: string[] = [];
  private rState = ROUTES.map(() => (rnd() * 4) | 0);
  private agRows: HTMLElement[] = [];
  private agData: Ag[] = Array.from({ length: 12 }, (_, i) => ({
    id: String(i + 1).padStart(2, "0"), role: ROLES[i % 4]!, p: rnd() * 8, sp: rr(0.6, 2), st: "working",
  }));
  private chkI = 0;

  private readonly onResize = (): void => {
    this.scheduleResize();
  };

  constructor(runtime: AnimationRuntime) {
    this.runtime = runtime;
    const p = runtime.params;
    this.hookMs = HalofluxEngine.clamp(HalofluxEngine.number(p.hookMs, DEFAULT_HOOK_MS), MIN_HOOK_MS, MAX_HOOK_MS);
    this.runMs = HalofluxEngine.clamp(HalofluxEngine.number(p.durationMs, DEFAULT_RUN_MS), MIN_RUN_MS, MAX_RUN_MS);
    this.targetVolume = HalofluxEngine.clamp(HalofluxEngine.number(p.volume, 100), 0, 100) / 100;
    this.wallMedia = WALL_MEDIA_OPTIONS.includes(p.wallMedia as WallMedia) ? (p.wallMedia as WallMedia) : "off";
    this.HAS_FILTER = typeof document === "undefined"
      ? false
      : (() => { try { const c = document.createElement("canvas"); return "filter" in (c.getContext("2d") ?? {}); } catch { return false; } })();

    this.root = document.createElement("div");
    this.root.className = "dsh-opening-hx";
    const style = document.createElement("style");
    style.textContent = STYLE;
    this.app = document.createElement("div");
    this.app.className = "hx-app";
    this.app.innerHTML = `
<header>
  <div class="hx-brand"><h1>RYDER CODE / Ms MAIKEBAIs CAT</h1><p>RESEARCH PAPERS → REPRODUCIBLE EXPERIMENTS</p></div>
  <div class="hx-kpi"><div class="k">PAPERS</div><div class="v">64</div><div class="seg"><i></i></div></div>
  <div class="hx-kpi"><div class="k">AGENTS</div><div class="v pink">12</div><div class="seg"><i></i></div></div>
  <div class="hx-kpi"><div class="k">METHODS</div><div class="v">11</div><div class="seg"><i></i></div></div>
  <div class="hx-kpi"><div class="k">REF. SCENES</div><div class="v">28</div><div class="seg"><i></i></div></div>
  <div class="hx-kpi"><div class="k">FURTHER REVIEW</div><div class="v">4</div><div class="seg"><i></i></div></div>
</header>
<div class="hx-stage-wrap">
  <canvas class="hx-stage"></canvas>
  <div class="hx-ov hx-chk"><b>STABILITY CHECK</b><span>CFL = |u| Δt / Δx</span></div>
  <div class="hx-ov hx-status"><div class="big">7 / 11 METHODS · 4 PENDING</div><div class="sm">independent runs · shared event bus</div></div>
</div>
<div class="hx-panels">
  <div class="hx-p"><h3>INVESTIGATION FEED</h3><div class="hx-feed"></div></div>
  <div class="hx-p"><h3>ADVECTION / PARTICLE SOLVER</h3><canvas></canvas>
    <div class="hx-btns"><span class="on">ADVECT</span><span>PROJECT</span><span>RENDER</span></div></div>
  <div class="hx-p"><h3>METHOD WORKSPACE</h3><div class="hx-code"></div></div>
  <div class="hx-p"><h3>SHARED SCENE / DIFFERENCE FIELD</h3><canvas></canvas><div class="cap">same input · local difference · inspect source</div></div>
  <div class="hx-p"><h3>SOURCE / EXTRACTION ROUTES</h3><div class="hx-routes"></div><div class="cap">pages → equations → runnable source</div></div>
  <div class="hx-p"><h3>VALIDATION / SAMPLE BUFFER</h3><canvas></canvas><div class="cap">illustrative / source check required</div></div>
  <div class="hx-p"><h3>12 AGENTS / DISPATCH</h3><div class="hx-agents"></div><div class="cap">independent jobs / shared event bus</div></div>
  <div class="hx-p"><h3>METHOD / REFERENCE INDEX</h3><canvas></canvas><div class="cap">28 scenes / 7 matched / 4 further review</div></div>
</div>`.trim();
    this.chkEl = this.app.querySelector(".hx-chk") as HTMLDivElement;
    this.segEls = this.app.querySelectorAll(".hx-kpi .seg i");
    this.stBig = this.app.querySelector(".hx-status .big") as HTMLElement;
    this.stage = this.app.querySelector(".hx-stage") as HTMLCanvasElement;
    this.feedEl = this.app.querySelector(".hx-feed");
    this.codeEl = this.app.querySelector(".hx-code");

    const panelCvs = this.app.querySelectorAll<HTMLCanvasElement>(".hx-p canvas");
    this.pAdv = { cv: panelCvs[0]!, x: null, w: 0, h: 0 };
    this.pDiff = { cv: panelCvs[1]!, x: null, w: 0, h: 0 };
    this.pVal = { cv: panelCvs[2]!, x: null, w: 0, h: 0 };
    this.pIdx = { cv: panelCvs[3]!, x: null, w: 0, h: 0 };

    // The agents panel is built once; rows are ticked from the frame loop.
    const agEl = this.app.querySelector(".hx-agents") as HTMLElement;
    agEl.innerHTML = this.agData.map((a) =>
      `<div class="hx-ag"><span class="id">${a.id}</span><span class="rl">${a.role}</span><span class="cells">${"<i></i>".repeat(6)}</span><span class="st"></span></div>`).join("");
    this.agRows = [...agEl.children] as HTMLElement[];

    // ---- the monitor wall: eight slots, unique-decode sources ----
    // "off": no user media at all — no sources are created or preloaded.
    if (this.wallMedia !== "off") {
      const library = this.wallMedia === "single"
        ? [runtime.media]
        : runtime.library?.length ? runtime.library : [runtime.media];
      const byUrl = new Map<string, WallSource>();
      for (const item of library) {
        if (byUrl.has(item.url)) continue;
        if (item.kind === "video") {
          const video = document.createElement("video");
          video.muted = true; // wall slots are silent; only the program source probes
          video.playsInline = true;
          video.preload = "auto";
          const source: WallSource = { kind: "video", video, ready: false, primary: false, ended: false, url: item.url };
          video.addEventListener("loadeddata", () => { source.ready = true; });
          video.addEventListener("error", this.onMediaError);
          video.addEventListener("ended", () => this.onSourceEnded(source));
          byUrl.set(item.url, source);
        } else {
          const img = document.createElement("img");
          img.alt = "";
          const source: WallSource = { kind: "image", img, ready: false, url: item.url };
          img.addEventListener("load", () => { source.ready = true; });
          img.addEventListener("error", this.onMediaError);
          byUrl.set(item.url, source);
        }
      }
      this.sources = [...byUrl.values()];
      // Program source = the first video; it alone may go audible.
      this.primary = this.sources.find((s): s is Extract<WallSource, { kind: "video" }> => s.kind === "video") ?? null;
      if (this.primary) this.primary.primary = true;
      const videoCount = this.sources.reduce((n, s) => n + (s.kind === "video" ? 1 : 0), 0);
      if (videoCount > MAX_DECODE_SOURCES) {
        console.warn(`[dsh-opening-animation] haloflux: ${videoCount} unique video sources decode at once — ` +
          "expect a heavy wall; consider fewer/shorter clips (4 or fewer keeps it light)");
      }
      // Slot i draws source i mod n — the library wraps around the eight slots.
      if (this.sources.length > 0) {
        for (let i = 0; i < 8; i++) this.slotSource.push(this.sources[i % this.sources.length]!);
      }
    }
    // One wall canvas per instrument panel, over the whole card.
    const cards = this.app.querySelectorAll<HTMLElement>(".hx-p");
    cards.forEach((card) => {
      const cv = document.createElement("canvas");
      cv.className = "hx-mcv";
      card.append(cv);
      this.wall.push({ cv, x: null, w: 0, h: 0 });
    });

    this.root.append(style, this.app);
    runtime.container.append(this.root);
    // Watch the stage wrapper from the start: the first layout pass (and any
    // later viewport change) re-fits the canvases while phase A is running.
    if (typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver(this.onResize);
      this.observer.observe(this.stage.parentElement ?? this.stage);
    }
  }

  start(): void {
    if (this.destroyed || this.completed) return;
    // Preload every source during phase A so the wall cut-in is instant;
    // errors fail the run from any phase (a missing media must never end in a
    // black hang). Playback events wire here (constructor binds load/error).
    for (const s of this.sources) {
      if (s.kind === "video") {
        s.video.addEventListener("playing", this.onPlaying);
        s.video.addEventListener("pause", this.onPause);
      }
      if (s.kind === "video") s.video.src = s.url;
      else s.img.src = s.url;
    }

    this.sx = this.stage.getContext("2d");
    // jsdom (and exotic browsers without a 2d context): fail open — report
    // readiness and hand over instead of freezing on a black first frame for
    // hookMs (grid-mouse's no-context behavior).
    if (!this.sx) {
      this.runtime.markLoaded?.();
      this.markCompleted();
      return;
    }
    this.resizeAll();
    this.startIntervals();
    this.runtime.markLoaded?.(); // self-drawn: nothing to wait for (8s watchdog lifts)
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    this.hookTimer = window.setTimeout(() => {
      if (this.wallMedia === "off") {
        // No media, no panel transition: durationMs is the whole run — the
        // halo page and its BGM play for as long as the user set them to.
        this.markCompleted();
        return;
      }
      this.enterGlitch();
    }, this.wallMedia === "off" ? this.runMs : this.hookMs);
    if (this.wallMedia === "off") this.startBgm();
  }

  /** wallMedia "off": the run is the pure halo page, so it carries the
   * source project's BGM ("Synthwave 421k", CC0 — see haloflux-bgm-assets).
   * Streaming assembly: the base64 constant is fetched as a data URL, turned
   * into a Blob and played through a Blob object URL — the bundle carries
   * text, the media element streams from an object URL, and the URL is
   * revoked on teardown. Playback starts audible when the browser allows
   * autoplay (a preview click, media engagement), silently absent on a cold
   * reload where it does not — a muted background track is pointless, and no
   * pill is offered for decoration. */
  private startBgm(): void {
    if (this.destroyed || this.completed || this.bgm !== null) return;
    try {
      const audio = new Audio();
      audio.volume = DEFAULT_BGM_VOLUME;
      audio.loop = true;
      this.bgm = audio;
      void fetch(`data:audio/mpeg;base64,${HALOFLUX_BGM_BASE64}`)
        .then((response) => response.blob())
        .then((blob) => {
          if (this.destroyed || this.completed || this.bgm !== audio) {
            return; // torn down or handed over while the blob was assembling
          }
          this.bgmUrl = URL.createObjectURL(blob);
          audio.src = this.bgmUrl;
          const p = audio.play();
          if (p && typeof p.catch === "function") {
            p.catch(() => { /* autoplay policy rejected audible playback — quiet page */ });
          }
        })
        .catch(() => { /* assembly failed — quiet page, never a broken run */ });
    } catch { /* jsdom and friends */ }
  }

  /** Fade the BGM out over BGM_FADE_MS, then pause it (the hand-over
   * transition runs underneath). Idempotent; safe on a never-started track. */
  private stopBgm(): void {
    const audio = this.bgm;
    if (audio === null) return;
    this.bgm = null;
    const startVolume = audio.volume;
    let ticks = 0;
    this.bgmFadeTimer = window.setInterval(() => {
      ticks += 1;
      const elapsed = ticks * FADE_TICK_MS;
      if (elapsed >= BGM_FADE_MS) {
        if (this.bgmFadeTimer !== null) { window.clearInterval(this.bgmFadeTimer); this.bgmFadeTimer = null; }
        audio.volume = 0;
        try { audio.pause(); } catch { /* teardown best-effort */ }
        if (this.bgmUrl !== null) { URL.revokeObjectURL(this.bgmUrl); this.bgmUrl = null; }
        return;
      }
      audio.volume = startVolume * (1 - elapsed / BGM_FADE_MS);
    }, FADE_TICK_MS);
  }

  skip(): void {
    if (this.destroyed || this.completed) return;
    // Final frame = the wall. Not-yet-playing videos freeze where they are
    // (constructivism1's skip pauses the backdrop the same way).
    this.stopPhaseA();
    this.stopLoop();
    if (this.wallMedia !== "off") {
      this.showWall();
      this.pauseVideos();
    }
    this.markCompleted();
  }

  destroy(): void {
    this.destroyed = true;
    this.stopPhaseA();
    this.stopLoop();
    window.clearTimeout(this.hookTimer);
    window.clearTimeout(this.glitchTimer);
    window.clearTimeout(this.mediaTimer);
    window.clearTimeout(this.jitterTimer);
    window.clearTimeout(this.resizeTimer);
    this.stopFadeIn();
    if (this.bgmFadeTimer !== null) { window.clearInterval(this.bgmFadeTimer); this.bgmFadeTimer = null; }
    try { this.bgm?.pause(); } catch { /* teardown best-effort */ }
    this.bgm = null;
    if (this.bgmUrl !== null) { URL.revokeObjectURL(this.bgmUrl); this.bgmUrl = null; }
    for (const s of this.sources) {
      if (s.kind === "video") {
        s.video.removeEventListener("playing", this.onPlaying);
        s.video.removeEventListener("pause", this.onPause);
        try {
          s.video.pause();
          s.video.removeAttribute("src");
          s.video.load();
        } catch { /* teardown best-effort */ }
      }
    }
    this.pill?.remove();
    this.pill = null;
    this.observer?.disconnect();
    this.observer = null;
    this.root.remove();
  }

  /* ================= phase A: the HALOFLUX page ================= */

  private readonly frame = (now: number): void => {
    // Phases stop by flipping the phase; the queued callback drains itself.
    if (this.destroyed || this.completed) { this.raf = 0; return; }
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.phase === "glitch") {
      // The halo stage keeps playing untouched; first the panels' own content
      // tears, then the slots run their shuffled layers.
      if (this.ready) { this.T += dt; this.drawStage(dt); }
      if (this.glitchStage === "content") this.contentGlitchTick();
      else this.renderGlitchLayers();
      return;
    }
    if (this.phase === "media") {
      // The halo keeps playing behind the wall.
      if (this.ready) { this.T += dt; this.drawStage(dt); }
      this.drawWall();
      return;
    }
    if (!this.ready) return;
    this.T += dt;
    this.drawStage(dt);
    this.drawAdv(dt); this.drawDiff(); this.drawVal(); this.drawIdx(); this.agentsTick(dt);
  };

  private startIntervals(): void {
    const every = (ms: number, fn: () => void): void => { this.timers.push(window.setInterval(fn, ms)); };
    this.seedFeed(12);
    every(650, () => this.feedPush());
    every(70, () => this.codeTick());
    this.renderRoutes();
    every(500, () => {
      const i = (rnd() * ROUTES.length) | 0;
      this.rState[i] = ((this.rState[i] ?? 0) + 1) % 4;
      this.renderRoutes();
    });
    every(1400, () => {
      const b = this.app.querySelectorAll(".hx-btns span");
      const i = [...b].findIndex((s) => s.classList.contains("on"));
      (b[i] as HTMLElement | undefined)?.classList.remove("on");
      (b[(i + 1) % 3] as HTMLElement | undefined)?.classList.add("on");
    });
    this.kpiTick();
    every(2600, () => this.kpiTick());
    every(3600, () => {
      this.chkEl.style.opacity = "0";
      window.setTimeout(() => {
        if (this.destroyed || this.phase !== "halo") return;
        this.chkI = (this.chkI + 1) % CHECKS.length;
        const pair = CHECKS[this.chkI]!;
        (this.chkEl.querySelector("b") as HTMLElement).textContent = pair[0];
        (this.chkEl.querySelector("span") as HTMLElement).textContent = pair[1];
        this.chkEl.style.opacity = "1";
      }, 400);
    });
  }

  private kpiTick(): void {
    if (this.destroyed) return;
    this.segEls.forEach((s) => { s.style.width = `${rr(25, 100)}%`; });
    const m = 5 + ((rnd() * 6) | 0);
    this.stBig.textContent = `${m} / 11 METHODS · ${11 - m} PENDING`;
  }

  /** Stop the phase-A page machinery (intervals, hook timer). The rAF loop
   * keeps running through glitch and media — the halo and the wall draw from
   * it; only skip/destroy/complete stop the loop itself (stopLoop). */
  private stopPhaseA(): void {
    for (const t of this.timers) window.clearInterval(t);
    this.timers.length = 0;
    window.clearTimeout(this.hookTimer);
    this.phase = this.phase === "halo" || this.phase === "glitch" ? "media" : this.phase;
  }

  private stopLoop(): void {
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
  }

  /* ================= phase B: the glitch transition ================= */

  private enterGlitch(): void {
    if (this.destroyed || this.completed || this.phase !== "halo") return;
    this.phase = "glitch";
    // First half: the panels' own content tears (snapshot passes + CSS shake)
    // — the instruments stay on screen instead of blinking to green at once.
    this.glitchStage = "content";
    this.root.classList.add("hx-glitch");
    this.glitchSnaps = [this.pAdv.cv, this.pDiff.cv, this.pVal.cv, this.pIdx.cv]
      .map((cv) => {
        const snap = document.createElement("canvas");
        snap.width = Math.max(1, cv.width); snap.height = Math.max(1, cv.height);
        snap.getContext("2d")?.drawImage(cv, 0, 0);
        return { cv, snap };
      });
    this.glitchTimer = window.setTimeout(() => this.revealGlitchWall(), GLITCH_CONTENT_MS);
  }

  /** Second half: the slots cut in — dark panel base, one shuffled transition
   * layer each; the halo stage keeps playing untouched. */
  private revealGlitchWall(): void {
    if (this.destroyed || this.completed || this.phase !== "glitch") return;
    this.glitchStage = "wall";
    this.root.classList.remove("hx-glitch");
    this.showWall();
    this.fitWall();
    this.buildGlitchLayers();
    this.glitchTimer = window.setTimeout(() => this.enterMedia(), GLITCH_MS - GLITCH_CONTENT_MS);
  }

  /** Content-glitch frame: the reference's four techniques over the frozen
   * panel snapshots (25% clean pass-through, slipped scanlines, scattered
   * blocks, an RGB-separation double exposure, the rare flash). */
  private contentGlitchTick(): void {
    for (const { cv, snap } of this.glitchSnaps) {
      const x = cv.getContext("2d");
      if (!x || snap.width < 2 || snap.height < 2) continue;
      x.clearRect(0, 0, cv.width, cv.height);
      x.drawImage(snap, 0, 0);
      if (rnd() < 0.25) continue;
      const w = snap.width, h = snap.height;
      for (let i = 0; i < 2; i++) {
        const bh = 2 + ((rnd() * (h * 0.12)) | 0);
        const by = (rnd() * (h - bh)) | 0;
        const dx = ((rnd() * 80 - 40) * (w / 1920)) | 0;
        if (dx !== 0) x.drawImage(snap, 0, by, w, bh, dx, by, w, bh);
      }
      if (rnd() < 0.7) {
        const bw = 40 + ((rnd() * (w * 0.3)) | 0), bh = 4 + ((rnd() * (h * 0.08)) | 0);
        const bx = (rnd() * Math.max(1, w - bw)) | 0, by = (rnd() * Math.max(1, h - bh)) | 0;
        x.drawImage(snap, bx, by, bw, bh, (rnd() * w * 0.7 - w * 0.3) | 0, (rnd() * h * 1.1 - h * 0.1) | 0, bw, bh);
      }
      if (this.HAS_FILTER && rnd() < 0.5) {
        const k = 6 + rnd() * 14;
        x.globalCompositeOperation = "lighter";
        x.globalAlpha = 0.35;
        x.filter = "hue-rotate(120deg) saturate(2)";
        x.drawImage(snap, -k, 0, w, h);
        x.filter = "hue-rotate(-120deg) saturate(2)";
        x.drawImage(snap, k, 0, w, h);
        x.filter = "none";
        x.globalAlpha = 1;
        x.globalCompositeOperation = "source-over";
      }
      if (rnd() < 0.12) {
        x.globalAlpha = 0.05 + rnd() * 0.15;
        x.fillStyle = rnd() < 0.3 ? "#f0a6c6" : "#ffffff";
        x.fillRect(0, 0, cv.width, cv.height);
        x.globalAlpha = 1;
      }
    }
  }

  /** Fisher–Yates the eight styles across the slots. */
  private buildGlitchLayers(): void {
    const order = GLITCH_LAYERS.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = (rnd() * (i + 1)) | 0;
      const tmp = order[i]!;
      order[i] = order[j]!;
      order[j] = tmp;
    }
    this.glitchLayers = order.map((k) => GLITCH_LAYERS[k]!());
  }

  /** Glitch wall frame: the panels' own dark base plus one shuffled
   * transition layer per slot (the green lives in the layers and in the
   * load flash of drawWall — never as a full-length green page). */
  private renderGlitchLayers(): void {
    for (let i = 0; i < this.wall.length; i++) {
      const p = this.wall[i]!;
      const x = p.x;
      if (!x) continue;
      const layer = this.glitchLayers[i % this.glitchLayers.length];
      if (!layer) continue;
      x.fillStyle = PANEL_BG;
      x.fillRect(0, 0, p.w, p.h);
      layer.draw(x, p.w, p.h);
    }
  }

  /* ================= phase C: the eight-slot monitor wall ================= */

  private enterMedia(): void {
    if (this.destroyed || this.completed) return;
    this.stopPhaseA(); // also flips the phase to "media"
    const panels = this.app.querySelector(".hx-panels");
    panels?.classList.add("hx-jitter");
    this.jitterTimer = window.setTimeout(() => panels?.classList.remove("hx-jitter"), JITTER_MS * 2);
    for (const s of this.sources) {
      if (s.kind === "video") this.playSource(s.video);
    }
    if (this.runtime.media.kind !== "video") {
      // Image variant (or no live video in the library): hold the finished wall.
      this.mediaTimer = window.setTimeout(() => this.markCompleted(), IMAGE_HOLD_MS);
    }
    // Video variant: onSourceEnded completes once every source has ended; the
    // host's 10s no-progress watchdog covers a wall that never starts.
  }

  /** Reveal the wall canvases over the instrument panels (glitch entry and
   * the skip final frame). */
  private showWall(): void {
    for (const p of this.wall) p.cv.classList.add("hx-mcv-show");
  }

  /** The glitch hand-off lands on chroma green per slot until that slot's
   * item has its first frame — the reference mock's eight green screens. */
  private drawWall(): void {
    for (let i = 0; i < this.wall.length; i++) {
      const p = this.wall[i]!;
      const x = p.x;
      if (!x) continue;
      const s = this.slotSource[i]!;
      if (!s.ready || (s.kind === "video" && s.video.readyState < 2)) {
        x.fillStyle = CHROMA_GREEN;
        x.fillRect(0, 0, p.w, p.h);
        continue;
      }
      if (s.kind === "image") {
        this.drawCoverTo(x, s.img, s.img.naturalWidth, s.img.naturalHeight, p.w, p.h);
      } else {
        this.drawCoverTo(x, s.video, s.video.videoWidth, s.video.videoHeight, p.w, p.h);
      }
    }
  }

  /** Cover-fit one source into a slot (the wall's object-fit: cover). */
  private drawCoverTo(x: CanvasRenderingContext2D, el: CanvasImageSource, sw: number, sh: number, w: number, h: number): void {
    if (sw <= 0 || sh <= 0) return;
    const scale = Math.max(w / sw, h / sh);
    const dw = sw * scale, dh = sh * scale;
    x.drawImage(el, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }

  /** Fit the wall canvases to their cards (usable while visibility:hidden —
   * the canvases are absolutely positioned and keep their boxes). */
  private fitWall(): void {
    for (const p of this.wall) {
      const r = p.cv.getBoundingClientRect();
      p.w = r.width; p.h = r.height;
      p.cv.width = Math.max(1, Math.round(r.width * this.DPR));
      p.cv.height = Math.max(1, Math.round(r.height * this.DPR));
      p.x = p.cv.getContext("2d");
      p.x?.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
    }
  }

  private readonly onMediaError = (): void => {
    if (this.destroyed || this.completed) return;
    window.clearTimeout(this.hookTimer);
    this.runtime.fail(new Error("opening media failed to load"));
  };

  /** One video source reached its end; the video variant completes when every
   * video source has (short slots freeze on their last frame and wait). */
  private onSourceEnded(source: WallSource): void {
    if (source.kind !== "video") return;
    source.ended = true;
    if (source === this.primary) this.stopFadeIn();
    if (this.destroyed || this.completed) return;
    if (this.runtime.media.kind !== "video") return;
    if (this.sources.every((s) => s.kind !== "video" || s.ended)) this.markCompleted();
  }

  /** The program source's <video>, or null when the wall has none. */
  private get primaryVideo(): HTMLVideoElement | null {
    return this.primary?.kind === "video" ? this.primary.video : null;
  }

  private readonly onPlaying = (event: Event): void => {
    const video = event.target as HTMLVideoElement;
    if (video !== this.primaryVideo) return; // only the program source probes
    if (this.destroyed || this.completed || this.unmuted) return;
    if (this.targetVolume <= 0) return;
    // video-player's behavior probe: always try to unmute on the first
    // playing event; a policy pause (sync or async) falls back to muted.
    this.unmuted = true;
    video.muted = false;
    video.volume = this.targetVolume;
    if (video.paused) this.fallBackToSilent();
    else this.startFadeIn();
  };

  private readonly onPause = (event: Event): void => {
    const video = event.target as HTMLVideoElement;
    if (video !== this.primaryVideo) return;
    if (this.destroyed || this.completed || !this.unmuted || video.ended) return;
    this.fallBackToSilent();
  };

  private fallBackToSilent(): void {
    const video = this.primaryVideo;
    if (video === null) return;
    this.stopFadeIn();
    video.muted = true;
    this.playSource(video);
    this.showPill();
  }

  /** The "click for sound" pill for the program source (video-player's, with
   * the same contract: the click never bubbles into click-to-skip). */
  private showPill(): void {
    if (this.primaryVideo === null) return;
    if (this.pill !== null || this.destroyed || this.completed || this.targetVolume <= 0) return;
    const video = this.primaryVideo;
    const hint = document.createElement("button");
    hint.type = "button";
    hint.className = "dsh-opening-unmute-hint";
    hint.textContent = this.runtime.t("video.unmuteHint");
    hint.addEventListener("click", (event: Event) => {
      event.stopPropagation(); // never bubble into the overlay's click-to-skip
      hint.remove();
      this.pill = null;
      if (this.destroyed || this.completed) return;
      video.muted = false;
      this.startFadeIn();
      if (video.paused) this.playSource(video);
    });
    this.runtime.container.append(hint);
    this.pill = hint;
  }

  private playSource(video: HTMLVideoElement): void {
    try {
      const p = video.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => { /* the error event path owns hard failures; the host's
                           stall watchdog owns a wall that never starts */ });
      }
    } catch { /* jsdom and friends */ }
  }

  /** Linear volume ramp from silence to the configured loudness on the
   * program source. */
  private startFadeIn(): void {
    if (this.primaryVideo === null) return;
    const video = this.primaryVideo;
    if (this.fadeTimer !== null) window.clearInterval(this.fadeTimer);
    video.volume = 0;
    let ticks = 0;
    this.fadeTimer = window.setInterval(() => {
      if (this.destroyed || this.completed) { this.stopFadeIn(); return; }
      ticks += 1;
      const elapsed = ticks * FADE_TICK_MS;
      if (elapsed >= VIDEO_FADE_IN_MS) {
        video.volume = this.targetVolume;
        this.stopFadeIn();
        return;
      }
      video.volume = this.targetVolume * (elapsed / VIDEO_FADE_IN_MS);
    }, FADE_TICK_MS);
  }

  private stopFadeIn(): void {
    if (this.fadeTimer !== null) {
      window.clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }
  }

  private pauseVideos(): void {
    for (const s of this.sources) {
      if (s.kind === "video") {
        try { s.video.pause(); } catch { /* pausing an unstarted video is harmless */ }
      }
    }
  }

  private markCompleted(): void {
    if (this.completed) return;
    this.completed = true;
    this.stopLoop();
    this.stopBgm();
    this.runtime.complete();
  }

  /* ================= layout ================= */

  private scheduleResize(): void {
    if (this.destroyed || !this.sx) return;
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => this.resizeAll(), 120);
  }

  private resizeAll(): void {
    if (this.destroyed || !this.sx) return;
    const r = this.stage.getBoundingClientRect();
    if (r.width < 20 || r.height < 20) { this.ready = false; return; }
    this.DPR = Math.min(window.devicePixelRatio || 1, 2);
    this.resizeStage();
    this.resizePanels();
    this.ready = true;
  }

  private fitPanel(p: Panel): void {
    const r = p.cv.getBoundingClientRect();
    p.w = r.width; p.h = r.height;
    p.cv.width = Math.max(1, Math.round(r.width * this.DPR));
    p.cv.height = Math.max(1, Math.round(r.height * this.DPR));
    p.x = p.cv.getContext("2d");
    p.x?.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
  }

  private resizePanels(): void {
    for (const p of [this.pAdv, this.pDiff, this.pVal, this.pIdx]) this.fitPanel(p);
    for (const p of this.wall) this.fitPanel(p);
    this.advP = Array.from({ length: 320 }, () => ({ x: rnd() * this.pAdv.w, y: rnd() * this.pAdv.h, l: rnd() * 3 }));
    this.valBuf = [[], [], []];
  }

  private resizeStage(): void {
    const r = this.stage.getBoundingClientRect();
    const S = this.sx;
    if (!S) return;
    this.W = r.width; this.H = r.height;
    this.stage.width = this.W * this.DPR; this.stage.height = this.H * this.DPR;
    this.cx = this.W * 0.07; this.cy = this.H * 0.5;
    this.R = Math.max(this.H * 0.78, this.W * 0.30);
    this.RO = this.R + Math.max(90, Math.min(240, this.H * 0.3, this.W * 0.13)) * C.ringWidth;
    this.RMAX = Math.hypot(this.W - this.cx, this.H / 2) + 60;
    this.thV = Math.asin(Math.min(1, (this.H / 2 + 60) / this.R));
    this.thS = Math.asin(Math.min(1, (this.H / 2 + 40) / this.RO));
    this.buildWeb(); this.buildLanes(); this.buildCards(); this.buildOuter();
    this.trailC = this.mkd(2 * this.R + 4, 2 * this.R + 4, Math.min(this.DPR, 1.5));
    this.glowC = document.createElement("canvas");
    this.glowC.width = Math.ceil(this.W / this.GS); this.glowC.height = Math.ceil(this.H / this.GS);
    this.runners = [];
    for (let i = 0; i < C.runnerCount; i++) this.runners.push(this.newRunner(true));
    this.comets = []; this.pulses = [];
    this.buildShots();
  }

  private mkd(w: number, h: number, d: number): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w * d)); c.height = Math.max(1, Math.ceil(h * d));
    c.getContext("2d")?.setTransform(d, 0, 0, d, 0, 0);
    return c;
  }

  /* ================= inner web ================= */

  private buildWeb(): void {
    const S = this.sx;
    if (!S) return;
    const size = 2 * this.R + 4, d = Math.min(this.DPR, 1.5);
    const webBase = this.mkd(size, size, d);
    this.webBase = webBase;
    this.webLayers = [0, 1, 2].map(() => this.mkd(size, size, d));
    const all = [webBase, ...this.webLayers];
    all.forEach((c) => c.getContext("2d")?.translate(this.R + 2, this.R + 2));
    const b = webBase.getContext("2d");
    if (!b) return;
    b.beginPath(); b.arc(0, 0, this.R, 0, TAU);
    const g = b.createRadialGradient(0, 0, this.R * 0.2, 0, 0, this.R);
    g.addColorStop(0, "#111215"); g.addColorStop(1, "#0c0d0f");
    b.fillStyle = g; b.fill();
    all.forEach((c) => {
      const x = c.getContext("2d");
      if (!x) return;
      x.save(); x.beginPath(); x.arc(0, 0, this.R, 0, TAU); x.clip();
    });
    this.curves = [];
    const N = Math.min(2600, Math.round(1000 + (this.W * this.H) / 800));
    for (let i = 0; i < N; i++) {
      const a1 = rnd() * TAU, a2 = a1 + rr(0.6, Math.PI * 1.4);
      const p0 = { x: Math.cos(a1) * this.R, y: Math.sin(a1) * this.R };
      const p1 = { x: Math.cos(a2) * this.R, y: Math.sin(a2) * this.R };
      const cr = Math.sqrt(rnd()) * this.R * 0.9, ca = rnd() * TAU;
      const c = { x: Math.cos(ca) * cr, y: Math.sin(ca) * cr };
      this.curves.push({ p0, c, p1 });
      const layer = rnd() < 0.7 ? -1 : (rnd() * 3) | 0;
      const x = (layer < 0 ? b : this.webLayers[layer]?.getContext("2d")) ?? null;
      if (!x) continue;
      const al = Math.min(1, (layer < 0 ? 0.03 + Math.pow(rnd(), 3) * 0.28 : 0.08 + Math.pow(rnd(), 2) * 0.35) * C.webBright);
      const k = rnd();
      x.strokeStyle = k < 0.05 ? `rgba(240,166,198,${al})` : k < 0.1 ? `rgba(180,170,235,${al})` : `rgba(228,231,238,${al})`;
      x.lineWidth = rr(0.4, 1.1);
      x.beginPath(); x.moveTo(p0.x, p0.y); x.quadraticCurveTo(c.x, c.y, p1.x, p1.y); x.stroke();
    }
    b.font = `6px ${FONT}`; b.textBaseline = "middle";
    for (let i = 0; i < 70; i++) {
      const rr_ = Math.sqrt(rnd()) * this.R * 0.92, a = rnd() * TAU;
      const px = Math.cos(a) * rr_, py = Math.sin(a) * rr_, s = rr(2, 4.5);
      b.strokeStyle = `rgba(235,238,244,${rr(0.35, 0.8)})`; b.lineWidth = 0.8;
      b.beginPath(); b.arc(px, py, s, 0, TAU); b.stroke();
      if (rnd() < 0.4) { b.beginPath(); b.arc(px + s * 2.2, py, s * 0.8, 0, TAU); b.stroke(); }
      if (rnd() < 0.35) { b.fillStyle = "rgba(200,204,212,.5)"; b.fillText(`n${(rnd() * 99) | 0}`, px + 7, py); }
    }
    for (let k = 0; k < 3; k++) {
      const rad = this.R * rr(0.45, 0.85), a0 = rr(0, TAU), cnt = 22 + ((rnd() * 14) | 0);
      b.strokeStyle = "rgba(235,238,244,.55)"; b.lineWidth = 0.8;
      for (let i = 0; i < cnt; i++) { const a = a0 + i * 0.022; b.beginPath(); b.arc(Math.cos(a) * rad, Math.sin(a) * rad, 2.2, 0, TAU); b.stroke(); }
    }
    all.forEach((c) => c.getContext("2d")?.restore());
  }

  private qpt(cv: Curve, t: number): { x: number; y: number } {
    const u = 1 - t;
    return {
      x: u * u * cv.p0.x + 2 * u * t * cv.c.x + t * t * cv.p1.x,
      y: u * u * cv.p0.y + 2 * u * t * cv.c.y + t * t * cv.p1.y,
    };
  }

  private newRunner(init: boolean): Runner {
    const cv = pick(this.curves), t = init ? rnd() : 0, p = this.qpt(cv, t);
    const k = rnd();
    let mode: number, sp: number;
    if (rnd() > C.runnerVariety) { mode = 1; sp = rr(0.12, 0.38); }
    else if (k < 0.3) { mode = 0; sp = rr(0.15, 0.28); }
    else if (k < 0.65) { mode = 1; sp = rr(0.1, 0.3); }
    else if (k < 0.8) { mode = 0; sp = rr(0.04, 0.08); }
    else if (k < 0.92) { mode = 0; sp = rr(0.5, 0.85); }
    else { mode = 2; sp = rr(0.06, 0.12); }
    return { cv, t, sp, mode, px: p.x, py: p.y, b: rnd() < 0.1 };
  }

  /* ================= comets ================= */

  private spawnComet(): void {
    const lines: Comet["lines"] = [];
    const n = Math.max(2, Math.round((8 + ((rnd() * 12) | 0)) * C.cometLines));
    if (rnd() < 0.6) {
      const rad = this.R * rr(0.55, 0.9), a0 = rr(-this.thV, this.thV) * 0.85,
        span = rr(0.35, 0.9) * (rnd() < 0.5 ? -1 : 1), gap = rr(2.6, 4.4) * C.cometWidth;
      for (let k = 0; k < n; k++) lines.push({ arc: true, r: rad - k * gap + gauss() * 0.6, a0: a0 + gauss() * 0.01, span });
    } else {
      const ang = rr(-this.thV, this.thV) * 0.8, oa = ang + rr(-1.3, 1.3), orad = this.R * rr(0.25, 0.75);
      const o = { x: Math.cos(oa) * orad, y: Math.sin(oa) * orad };
      const spread = rr(0.08, 0.25) * C.cometWidth, bend = rr(0.2, 0.5) * (rnd() < 0.5 ? -1 : 1);
      for (let i = 0; i < n; i++) {
        const ta = ang + (i / n - 0.5) * spread;
        const p1 = { x: Math.cos(ta) * (this.R - 2), y: Math.sin(ta) * (this.R - 2) };
        const p0 = { x: o.x + gauss() * 10, y: o.y + gauss() * 10 };
        const mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2, dx = p1.x - p0.x, dy = p1.y - p0.y;
        lines.push({ p0, c: { x: mx - dy * bend + gauss() * 8, y: my + dx * bend + gauss() * 8 }, p1 });
      }
    }
    this.comets.push({ lines, life: 0, hit: false, rot0: this.ringRot, dur: rr(0.4, 0.85) / C.cometSpeed, win: rr(0.22, 0.4), glow: rnd() < 0.4, tint: rnd() < 0.15 });
  }

  private cpt(l: Comet["lines"][number], t: number): { x: number; y: number } {
    if (!l.arc || l.r === undefined || l.a0 === undefined || l.span === undefined) return this.qpt(l as Curve, t);
    const r = l.r + (this.R - 2 - l.r) * t * t, a = l.a0 + l.span * t;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  }

  private strokeComet(ctx: CanvasRenderingContext2D, c: Comet, t0: number, t1: number, steps: number): void {
    ctx.beginPath();
    for (const l of c.lines) for (let s = 0; s <= steps; s++) {
      const p = this.cpt(l, t0 + (t1 - t0) * (s / steps));
      if (s) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
    }
    ctx.stroke();
  }

  /* ================= beat clock ================= */

  private updateBeat(dt: number): void {
    this.beatT -= dt; this.sinceBeat += dt;
    if (this.beatT <= 0) {
      this.beatT += this.PATTERN[this.beatI++ % this.PATTERN.length]! * 0.92 / C.tempo;
      this.sinceBeat = 0; this.beatN++; this.onBeat();
    }
    this.env = Math.exp(-this.sinceBeat * 4.5);
  }

  private onBeat(): void {
    if (this.rot.t >= this.rot.dur && this.rot.hold <= 0) this.ringMove();
    const n = Math.round((this.beatN % 4 === 0 ? C.cometBurst : C.cometPerBeat) * rr(0.6, 1.4));
    for (let i = 0; i < n; i++) this.timers.push(window.setTimeout(() => { if (!this.destroyed) this.spawnComet(); }, i * rr(30, 90)));
    this.layerEnv[(rnd() * 3) | 0] = 1;
    if (this.beatN % 4 === 0) this.layerEnv = this.layerEnv.map(() => rr(0.6, 1));
    const dir = rnd() < 0.5 ? 1 : -1, big = this.beatN % 8 === 0;
    this.pulses.push({
      c: dir > 0 ? -this.thS - 0.15 : this.thS + 0.15, v: dir * rr(0.7, 1.6) * (big ? 0.7 : 1),
      w: big ? rr(0.25, 0.4) : rr(0.05, 0.16), amp: big ? 1 : rr(0.45, 0.9), life: rr(1.2, 2.0), L: 0,
    });
    this.pulses.forEach((p) => { if (!p.L) p.L = p.life; });
    this.onBeatOuter();
    for (let i = 0; i < Math.round(6 * C.dataFlicker); i++) pick(this.slots).c = null;
    for (let i = 0; i < Math.round(2 * C.dataFlicker); i++) pick(this.slots).flash = rr(0.35, 0.7);
  }

  /* ================= camera ================= */

  private buildShots(): void {
    const P = (a: number, r: number) => ({ x: this.cx + Math.cos(a) * r, y: this.cy + Math.sin(a) * r });
    const mid = (this.R + this.RO) / 2;
    this.shots = [
      { x: this.W / 2, y: this.H / 2, z: 1, hold: 4.5 },
      { ...P(-this.thS * 0.45, mid), z: 2.3, hold: 3.4 },
      { ...P(0.04, this.RO + (this.RMAX - this.RO) * 0.3), z: 1.6, hold: 3.2 },
      { x: this.W / 2, y: this.H / 2, z: 1, hold: 3.0 },
      { ...P(0.22, this.R * 0.8), z: 1.9, hold: 3.4 },
      { ...P(this.thS * 0.5, mid + 10), z: 2.8, hold: 3.0 },
      { ...P(-0.12, this.RO + 40), z: 1.35, hold: 3.2 },
    ];
    this.shotI = 0; this.shotT = 0; this.camPhase = "hold";
    Object.assign(this.cam, this.shots[0]);
  }

  private updateCam(dt: number): void {
    if (!C.camera) { this.cam.x = this.W / 2; this.cam.y = this.H / 2; this.cam.z = 1; return; }
    const cur = this.shots[this.shotI];
    const nxt = this.shots[(this.shotI + 1) % this.shots.length];
    if (!cur || !nxt) return;
    this.shotT += dt;
    const zf = (z: number) => 1 + (z - 1) * C.camZoom;
    if (this.camPhase === "hold") {
      const k = this.shotT / cur.hold;
      this.cam.x = cur.x; this.cam.y = cur.y + (cur.z > 1 ? Math.sin(k * Math.PI) * 6 : 0);
      this.cam.z = zf(cur.z) * (1 + 0.05 * k * C.camZoom);
      if (this.shotT >= cur.hold) { this.camPhase = "move"; this.shotT = 0; this.camFrom = { ...this.cam }; }
    } else {
      const dur = 2.2, e = easeIO(Math.min(1, this.shotT / dur));
      const fromZ = this.camFrom?.z ?? 1, fromX = this.camFrom?.x ?? this.W / 2, fromY = this.camFrom?.y ?? this.H / 2;
      const lz = Math.log(fromZ) + (Math.log(zf(nxt.z)) - Math.log(fromZ)) * e;
      let z = Math.exp(lz);
      if (fromZ > 1.2 && zf(nxt.z) > 1.2) z *= 1 - 0.4 * Math.sin(Math.PI * e);
      this.cam.z = Math.max(1, z);
      this.cam.x = fromX + (nxt.x - fromX) * e;
      this.cam.y = fromY + (nxt.y - fromY) * e;
      if (this.shotT >= dur) { this.shotI = (this.shotI + 1) % this.shots.length; this.camPhase = "hold"; this.shotT = 0; }
    }
    const hw = this.W / (2 * this.cam.z), hh = this.H / (2 * this.cam.z);
    this.cam.x = Math.max(hw, Math.min(this.W - hw, this.cam.x));
    this.cam.y = Math.max(hh, Math.min(this.H - hh, this.cam.y));
  }

  private camT(ctx: CanvasRenderingContext2D, d: number): void {
    ctx.setTransform(d * this.cam.z, 0, 0, d * this.cam.z,
      d * (this.W / 2 - this.cam.x * this.cam.z), d * (this.H / 2 - this.cam.y * this.cam.z));
  }

  private toScreen(x: number, y: number): { x: number; y: number } {
    return { x: (x - this.cam.x) * this.cam.z + this.W / 2, y: (y - this.cam.y) * this.cam.z + this.H / 2 };
  }

  /* ================= outer beam field ================= */

  private makeProfile(n: number): number[] {
    const prof: number[] = [];
    let v = rr(0.45, 1), run = 0;
    for (let k = 0; k < n; k++) {
      if (run-- <= 0) { v = clamp(v + gauss() * 0.4, 0.22, 1); run = 2 + ((rnd() * 5) | 0); }
      prof.push(clamp(v + gauss() * 0.07, 0.18, 1));
    }
    return prof;
  }

  private makeStrandLayer(stepDeg: number, rotK: number, lumK: number, lw: number, lenK: number, solidK: number,
    cover: number, nMin: number, nMax: number, brightP: number, dyn = "soft"): StrandLayer {
    const step = (stepDeg * Math.PI) / 180, nb = Math.floor(TAU / step), ws: Wedge[] = [];
    const count = Math.round((nb * cover) / ((nMin + nMax) / 2));
    for (let j = 0; j < count; j++) {
      const n = nMin + ((rnd() * (nMax - nMin)) | 0), bright = rnd() < brightP;
      ws.push({
        i0: (rnd() * nb) | 0, n, base: rr(0.35, 1), len: rr(0.1, 0.5), kick: 0,
        ph: rnd() * TAU, ph2: rnd() * TAU, f1: rr(0.22, 0.6), f2: rr(0.8, 1.7),
        lum: bright ? rr(0.75, 1) : rr(0.16, 0.55), tint: rnd() < 0.5 ? 1 : 0,
        lwK: rnd() < 0.2 ? rr(1.35, 2.1) : rr(0.6, 1.15), lenS: rr(0.6, 1.25),
        prof: this.makeProfile(n), pf: Array.from({ length: n }, () => rr(1, 4)),
        pp: Array.from({ length: n }, () => rnd() * TAU), ds: Array.from({ length: n }, () => rnd()),
        dsp: rr(0.7, 1.8), flow: 0,
      });
    }
    return { step, rotK, lumK, lw, lenK, solidK, wedges: ws, off: rnd() * TAU, dyn };
  }

  private buildOuter(): void {
    const S = this.sx;
    if (!S) return;
    this.strandLayers = [
      this.makeStrandLayer(0.22, 0.45, 0.30, 0.55, 1.15, 0.9, 1.1, 20, 90, 0.2),
      this.makeStrandLayer(0.16, 0.75, 0.58, 0.8, 1.05, 0.7, 0.9, 14, 70, 0.28),
      this.makeStrandLayer(0.12, 1.0, 1.0, 1.0, 1.0, 0.5, 0.75, 12, 60, 0.32),
      this.makeStrandLayer(0.45, 1.0, 0.5, 1.8, 0.8, 0.6, 0.35, 4, 16, 0.3),
      this.makeStrandLayer(0.12, 1.0, 0.85, 1.0, 1.0, 0.5, 0.55, 14, 70, 0.32, "bounce"),
    ];
    this.wedges = this.strandLayers[2]!.wedges.concat(this.strandLayers[4]!.wedges);
    this.hazes = []; this.flares = [];
    this.GR = {};
    const mkG = (stops: Array<[number, string]>, r1: number) => {
      const g = S.createRadialGradient(this.cx, this.cy, this.RO, this.cx, this.cy, r1);
      stops.forEach((s) => g.addColorStop(s[0], s[1]));
      return g;
    };
    this.GR.s0 = mkG([[0, "rgba(248,248,255,1)"], [0.35, "rgba(228,226,242,.8)"], [1, "rgba(190,190,214,.3)"]], this.RMAX * 0.95);
    this.GR.s2 = mkG([[0, "rgba(225,245,242,1)"], [0.3, "rgba(176,214,210,.8)"], [1, "rgba(140,180,186,.3)"]], this.RMAX * 0.95);
    this.GR.s1 = mkG([[0, "rgba(240,236,255,1)"], [0.3, "rgba(196,182,244,.82)"], [1, "rgba(160,140,228,.3)"]], this.RMAX * 0.95);
    for (let i = 0; i < 14; i++) this.spawnHaze(true);
    this.initFlyers();
  }

  private spawnHaze(init: boolean): void {
    const k = rnd();
    this.hazes.push({
      a: rr(-this.thS, this.thS) - this.ringRot, w: rnd() < 0.7 ? rr(0.015, 0.07) : rr(0.08, 0.18),
      len: rr(0.35, 1), cur: init ? rr(0.2, 0.8) : 0, age: init ? rr(0, 0.5) : 0,
      life: rr(0.35, 1.6), alpha: rr(0.12, 0.42), tint: k < 0.55 ? 0 : k < 0.85 ? 1 : 2, drift: rr(-0.04, 0.04),
    });
  }

  private spawnFlare(a?: number): void {
    this.flares.push({
      a: a == null ? rr(-this.thS, this.thS) * 0.95 - this.ringRot : a,
      w: rr(0.006, 0.04), len: rr(18, 110), age: 0, life: rr(0.2, 0.55), alpha: rr(0.6, 1),
    });
  }

  private buildLanes(): void {
    const laneC = this.mkd(this.W, this.H, this.DPR);
    this.laneC = laneC;
    const x = laneC.getContext("2d");
    if (!x) return;
    for (let i = 0; i < 700; i++) {
      const a = rr(-this.thS, this.thS);
      x.strokeStyle = `rgba(210,205,235,${rr(0.01, 0.035)})`; x.lineWidth = rr(0.5, 1);
      const r0 = this.RO + 4, r1 = rr(this.RO + 60, this.RMAX * 0.8);
      x.beginPath();
      x.moveTo(this.cx + Math.cos(a) * r0, this.cy + Math.sin(a) * r0);
      x.lineTo(this.cx + Math.cos(a) * r1, this.cy + Math.sin(a) * r1);
      x.stroke();
    }
  }

  private updateOuter(dt: number): void {
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i]!;
      p.c += p.v * dt; p.life -= dt;
      if (p.life <= 0) this.pulses.splice(i, 1);
    }
    for (const Lr of this.strandLayers) {
      const rot = this.ringRot * Lr.rotK + Lr.off;
      for (const w of Lr.wedges) {
        const am = normA((w.i0 + w.n / 2) * Lr.step + rot);
        w.vis = Math.abs(am) < this.thS + 0.2;
        w.flow += dt * w.dsp * (0.45 + 2.2 * this.env);
        if (!w.vis) { w.len *= 0.98; continue; }
        let p = 0;
        for (const pl of this.pulses) {
          const f = Math.min(1, pl.life / 0.5) * Math.min(1, (pl.L - pl.life) / 0.15 + 0.3);
          p += pl.amp * f * Math.exp(-(((am - pl.c) / pl.w) ** 2));
        }
        if (Lr.dyn === "bounce") {
          const idle = w.base * (0.36 + 0.14 * Math.sin(this.T * 0.9 + w.ph));
          const tgt = Math.min(1, idle + p * 0.75 + w.kick * 0.6);
          w.kick *= Math.exp(-dt * 2.4);
          w.len += (tgt - w.len) * Math.min(1, (tgt > w.len ? 15 : 2.2) * dt);
        } else {
          const n1 = 0.5 + 0.5 * Math.sin(this.T * w.f1 + w.ph), n2 = 0.5 + 0.5 * Math.sin(this.T * w.f2 + w.ph2);
          const idle = w.base * (0.4 + 0.34 * n1 + 0.14 * n2);
          const tgt = Math.min(1.05, (idle + p * 0.7 + w.kick * 0.55) * w.lenS);
          w.kick *= Math.exp(-dt * 1.8);
          w.len += (tgt - w.len) * Math.min(1, (tgt > w.len ? 5 : 1.3) * dt);
        }
      }
    }
    for (let i = this.hazes.length - 1; i >= 0; i--) {
      const h = this.hazes[i]!;
      h.age += dt;
      h.cur += (h.len - h.cur) * Math.min(1, 9 * dt);
      if (h.age > h.life + 0.6) this.hazes.splice(i, 1);
    }
    if (this.hazes.length < C.hazeCount && rnd() < 0.25) this.spawnHaze(false);
    for (let i = this.flares.length - 1; i >= 0; i--) { const f = this.flares[i]!; f.age += dt; if (f.age > f.life) this.flares.splice(i, 1); }
    if (rnd() < 0.06 * C.flareRate) this.spawnFlare();
    this.updateFlyers(dt);
  }

  private onBeatOuter(): void {
    this.onBeatFlyers();
    for (let i = 0; i < 2 + ((rnd() * 5) | 0); i++) {
      const w = pick(this.wedges);
      w.kick = rr(0.4, 1);
      if (rnd() < 0.5) w.prof = this.makeProfile(w.n);
    }
    for (let i = 0; i < 2; i++) { const w = pick(this.wedges); w.lum = rnd() < 0.4 ? rr(0.8, 1) : rr(0.25, 0.6); }
    const nh = this.beatN % 4 === 0 ? 5 + ((rnd() * 4) | 0) : 1 + ((rnd() * 3) | 0);
    for (let i = 0; i < Math.round((nh * C.hazeCount) / 8); i++) this.spawnHaze(false);
    const nf = Math.round((1 + ((rnd() * 4) | 0)) * C.flareRate);
    for (let i = 0; i < nf; i++) this.spawnFlare(this.hazes.length && rnd() < 0.6 ? pick(this.hazes).a : undefined);
  }

  private hazeEnv(h: Haze): number {
    const a = Math.min(1, h.age / 0.12);
    const o = h.age > h.life ? Math.max(0, 1 - (h.age - h.life) / 0.6) : 1;
    return a * o * (0.85 + 0.15 * Math.sin(h.age * 30));
  }

  private readonly EDGE_A = [0.28, 0.62, 1];

  private drawStrands(Lr: StrandLayer, collect: { dash: number[]; tip: number[] } | null): void {
    const S = this.sx;
    if (!S) return;
    const span = this.RMAX - this.RO - 20, r0 = this.RO + 3, rot = this.ringRot * Lr.rotK + Lr.off;
    S.lineCap = "butt";
    for (const w of Lr.wedges) {
      if (!w.vis) continue;
      const L = w.len * span * Lr.lenK * C.beamLen;
      if (L < 3) continue;
      const a0 = normA(w.i0 * Lr.step + rot), a1 = a0 + w.n * Lr.step;
      if (a1 < -this.thS - 0.03 || a0 > this.thS + 0.03) continue;
      const alpha = Math.min(1, w.lum * Lr.lumK * (0.3 + 0.7 * Math.min(1, w.len * 1.8)) * C.beamBright * (Lr.dyn === "bounce" ? C.beamBounce : 1));
      if (alpha < 0.005) continue;
      const lwW = Lr.lw * w.lwK * C.beamWidth;
      // three brightness bands (edge profile); rebuilt per band instead of
      // Path2D so the engine also runs where Path2D is unavailable
      const paths: Array<{ x0: number; y0: number; x1: number; y1: number }[]> = [[], [], []];
      for (let k = 0; k < w.n; k++) {
        const a = a0 + (k + 0.5) * Lr.step, ca = Math.cos(a), sa = Math.sin(a);
        const edge = Math.sin((Math.PI * (k + 0.5)) / w.n), b = edge < 0.38 ? 0 : edge < 0.72 ? 1 : 2;
        const pr = w.prof[k] ?? 0.5;
        const l = L * pr * (0.5 + 0.5 * Math.sqrt(edge)) * (0.92 + 0.08 * Math.sin(this.T * (w.pf[k] ?? 1) + (w.pp[k] ?? 0)));
        const solid = l * (Lr.solidK + 0.3 * pr * (1 - Lr.solidK));
        paths[b]!.push({ x0: this.cx + ca * r0, y0: this.cy + sa * r0, x1: this.cx + ca * (r0 + solid), y1: this.cy + sa * (r0 + solid) });
        if (!collect) continue;
        const tail = l - solid, da = alpha * this.EDGE_A[b]!;
        if (tail > 6) for (let d = 0; d < 2; d++) {
          const ph = (w.flow + (w.ds[k] ?? 0) + d * 0.5) % 1;
          const s0 = solid + tail * ph, s1 = Math.min(l, s0 + 3 + tail * 0.22 * (1 - ph * 0.5));
          if (s1 > s0) collect.dash.push(ca, sa, s0, s1, da);
        }
        if ((k + ((this.T * 12) | 0)) % 4 === 0) collect.tip.push(ca, sa, l, da);
      }
      S.strokeStyle = this.GR[`s${w.tint}`] ?? this.GR.s0!;
      S.lineWidth = lwW;
      for (let b = 0; b < 3; b++) {
        S.globalAlpha = alpha * this.EDGE_A[b]!;
        S.beginPath();
        for (const seg of paths[b]!) { S.moveTo(seg.x0, seg.y0); S.lineTo(seg.x1, seg.y1); }
        S.stroke();
      }
      if (w.lum > 0.85 && C.beamGlow > 0) {
        S.globalAlpha = Math.min(1, alpha * 0.06 * C.beamGlow); S.lineWidth = lwW * 2.5;
        S.beginPath();
        for (const seg of paths[2]!) { S.moveTo(seg.x0, seg.y0); S.lineTo(seg.x1, seg.y1); }
        S.stroke();
      }
    }
  }

  private radialLines(a0: number, a1: number, st: number, r0: number, L: number, seed: number, lo: number): void {
    const S = this.sx;
    if (!S) return;
    S.beginPath();
    let k = 0;
    for (let a = a0; a < a1; a += st, k++) {
      const l = L * (lo + (1 - lo) * hash(k + seed)), ca = Math.cos(a), sa = Math.sin(a);
      S.moveTo(this.cx + ca * r0, this.cy + sa * r0);
      S.lineTo(this.cx + ca * (r0 + l), this.cy + sa * (r0 + l));
    }
  }

  /* ---- fly-out streaks ---- */

  private newFlyBand(): FlyBand { return { a: rr(-this.thS, this.thS), w: rr(0.01, 0.05), life: rr(2, 6) }; }

  private newFlyer(init: boolean): Flyer {
    let a: number;
    if (rnd() < 0.5) { const b = pick(this.flyBands); a = b.a + gauss() * b.w; } else a = rr(-this.thS, this.thS);
    return {
      a: a - this.ringRot, len: 20 + Math.pow(rnd(), 2) * 320, r: init ? rr(this.RO, this.RMAX) : this.RO + rr(0, 25),
      sp: rr(260, 900), lw: rnd() < 0.08 ? rr(1.2, 1.7) : rr(0.5, 1), lv: rnd() < 0.12 ? 1 : 0,
      tint: rnd() < 0.22 ? 1 : 0, burst: false,
    };
  }

  private spawnFlyBurst(): void {
    const a = rr(-this.thS, this.thS) * 0.95, n = Math.max(1, Math.round((14 + ((rnd() * 30) | 0)) * C.burstSize));
    const sp = rr(450, 1150), len = rr(70, 320), r0 = this.RO + rr(0, 8), tint = rnd() < 0.3 ? 1 : 0, lv = rnd() < 0.45 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      this.flyers.push({
        a: a + (i / n - 0.5) * rr(0.01, 0.045) + gauss() * 0.0015 - this.ringRot, len: len * rr(0.7, 1.15),
        r: r0 - rr(0, len * 0.35), sp: sp * rr(0.92, 1.08), lw: rnd() < 0.2 ? 1.3 : rr(0.6, 1), lv, tint, burst: true,
      });
    }
  }

  private initFlyers(): void {
    this.flyBands = Array.from({ length: 7 }, () => this.newFlyBand());
    this.flyers = Array.from({ length: Math.round(Math.min(750, 320 + this.W * 0.25) * C.flyerCount) }, () => this.newFlyer(true));
  }

  private updateFlyers(dt: number): void {
    for (const b of this.flyBands) { b.life -= dt; if (b.life <= 0) Object.assign(b, this.newFlyBand()); }
    const k = (0.7 + 0.9 * this.env) * C.flyerSpeed;
    for (let i = this.flyers.length - 1; i >= 0; i--) {
      const f = this.flyers[i]!;
      f.r += f.sp * dt * k;
      if (f.r - f.len > this.RMAX) {
        if (f.burst) this.flyers.splice(i, 1);
        else this.flyers[i] = this.newFlyer(false);
      }
    }
  }

  private onBeatFlyers(): void {
    const n = Math.round((this.beatN % 4 === 0 ? 3 + ((rnd() * 2) | 0) : 1 + ((rnd() * 2) | 0)) * C.burstRate);
    for (let i = 0; i < n; i++) this.timers.push(window.setTimeout(() => { if (!this.destroyed) this.spawnFlyBurst(); }, i * rr(20, 120)));
  }

  private readonly FLY_A = [0.16, 0.36, 0.7];

  private drawFlyers(bursts: boolean): void {
    const S = this.sx;
    if (!S) return;
    const buckets: Record<string, { f: Flyer; a: number }[]> = {};
    for (const f of this.flyers) {
      if (f.burst !== bursts) continue;
      const a = normA(f.a + this.ringRot);
      if (a < -this.thS - 0.05 || a > this.thS + 0.05) continue;
      const key = String(f.tint * 10 + f.lv + (f.lw > 1.15 ? 100 : 0) + (f.burst ? 1000 : 0));
      (buckets[key] ??= []).push({ f, a });
    }
    for (const key in buckets) {
      const arr = buckets[key]!;
      const f0 = arr[0]!.f;
      S.strokeStyle = f0.tint ? this.GR.s1 ?? this.GR.s0! : this.GR.s0!;
      S.globalAlpha = Math.min(1, this.FLY_A[f0.lv]! * (f0.burst ? C.burstBright : C.flyerBright));
      S.lineWidth = ((Number(key) % 1000) >= 100 ? 1.5 : 0.8) * C.flyerWidth;
      S.beginPath();
      for (const { f, a } of arr) {
        const r0 = Math.max(this.RO + 3, f.r - f.len), r1 = f.r;
        if (r1 <= r0) continue;
        const ca = Math.cos(a), sa = Math.sin(a);
        S.moveTo(this.cx + ca * r0, this.cy + sa * r0);
        S.lineTo(this.cx + ca * r1, this.cy + sa * r1);
      }
      S.stroke();
    }
    S.globalAlpha = 1;
  }

  private drawOuterFar(): void {
    const S = this.sx;
    if (!S) return;
    const span = this.RMAX - this.RO - 20, r0 = this.RO + 3;
    for (const h of this.hazes) {
      const e = this.hazeEnv(h);
      if (e <= 0.01) continue;
      if (h.seed === undefined) h.seed = rnd() * 1000;
      const L = h.cur * span;
      this.radialLines(h.a + this.ringRot - h.w / 2, h.a + this.ringRot + h.w / 2, this.OSTEP * 0.55, r0, L, h.seed, 0.45);
      S.strokeStyle = this.GR[`s${h.tint === 1 ? 0 : h.tint === 2 ? 2 : 1}`] ?? this.GR.s0!;
      S.globalAlpha = Math.min(1, h.alpha * e * 0.05 * C.hazeBright); S.lineWidth = 2.2; S.stroke();
      S.globalAlpha = Math.min(1, h.alpha * e * 0.6 * C.hazeBright); S.lineWidth = 0.55; S.stroke();
    }
    this.drawStrands(this.strandLayers[0]!, null);
    this.drawStrands(this.strandLayers[1]!, null);
    this.drawFlyers(false);
    S.globalAlpha = 1;
  }

  private drawOuterNear(): void {
    const S = this.sx;
    if (!S) return;
    const r0 = this.RO + 3;
    const col = { dash: [] as number[], tip: [] as number[] };
    this.drawStrands(this.strandLayers[2]!, col);
    this.drawStrands(this.strandLayers[4]!, col);
    this.drawStrands(this.strandLayers[3]!, null);
    S.strokeStyle = "#fff"; S.lineWidth = 1.05;
    for (const lv of [0.35, 0.65, 1]) {
      S.globalAlpha = Math.min(1, lv * C.dashBright); S.beginPath();
      const dp = col.dash;
      for (let i = 0; i < dp.length; i += 5) {
        const a = dp[i + 4]!;
        if (a > lv || a <= lv - 0.35) continue;
        S.moveTo(this.cx + dp[i]! * (r0 + dp[i + 2]!), this.cy + dp[i + 1]! * (r0 + dp[i + 2]!));
        S.lineTo(this.cx + dp[i]! * (r0 + dp[i + 3]!), this.cy + dp[i + 1]! * (r0 + dp[i + 3]!));
      }
      S.stroke();
    }
    S.fillStyle = "#fff";
    for (let i = 0; i < col.tip.length; i += 4) {
      S.globalAlpha = Math.min(1, col.tip[i + 3]! * 1.2);
      const r = r0 + col.tip[i + 2]!;
      S.fillRect(this.cx + col.tip[i]! * r - 0.8, this.cy + col.tip[i + 1]! * r - 0.8, 1.6, 1.6);
    }
    this.drawFlyers(true);
    S.strokeStyle = this.GR.s0 ?? this.GR.s1!;
    for (const f of this.flares) {
      if (f.seed === undefined) f.seed = rnd() * 1000;
      const t = f.age / f.life, e = (t < 0.15 ? t / 0.15 : Math.pow(1 - (t - 0.15) / 0.85, 2)) * f.alpha;
      const L = f.len * (0.6 + 0.4 * easeIO(Math.min(1, t * 3)));
      this.radialLines(f.a + this.ringRot - f.w / 2, f.a + this.ringRot + f.w / 2, this.OSTEP * 0.45, r0, L, f.seed, 0.4);
      S.globalAlpha = Math.min(1, e * 0.06 * C.flareBright); S.lineWidth = 2.6; S.stroke();
      S.globalAlpha = Math.min(1, e * C.flareBright); S.lineWidth = 0.8; S.stroke();
    }
    S.globalAlpha = 1;
  }

  /* ================= ring ================= */

  private ringMove(): void {
    const r = rnd();
    let d: number, dur: number, ease: (t: number) => number;
    if (r < 0.22) { d = rr(1.1, 2.1); dur = rr(0.7, 1.05); ease = easeIO; }
    else if (r < 0.64) { d = rr(0.14, 0.48); dur = rr(0.18, 0.38); ease = easeOX; }
    else { d = rr(0.05, 0.18); dur = rr(0.3, 0.6); ease = easeIO; }
    if (rnd() < 0.08) d = -d * 0.5;
    d *= C.ringSpeed;
    Object.assign(this.rot, { from: this.ringRot, to: this.ringRot + d, t: 0, dur, ease, hold: rr(0.04, 0.4) * C.ringPause });
  }

  private flashSlotAt(ang: number): void {
    let best: Slot | null = null, bd = 9;
    for (const s of this.slots) {
      const d = Math.abs(normA(s.a + this.ringRot - ang));
      if (d < bd) { bd = d; best = s; }
    }
    if (best && bd < 0.08) best.flash = Math.max(best.flash, 0.8);
  }

  private updateRing(dt: number): void {
    if (this.rot.t < this.rot.dur) {
      this.rot.t += dt;
      this.ringRot = this.rot.from + (this.rot.to - this.rot.from) * this.rot.ease(Math.min(1, this.rot.t / this.rot.dur));
    } else { this.rot.hold -= dt; this.ringRot += 0.02 * dt; }
  }

  private buildCards(): void {
    this.slots = [];
    const band = this.RO - this.R, mid = this.R + band * 0.42;
    let a = 0;
    while (a < TAU - 0.03) {
      const hpx = rr(16, 62), da = hpx / mid, gap = rr(3, 9) / mid;
      this.slots.push({ a: a + da / 2, da, hpx, c: null, flash: 0 });
      a += da + gap;
    }
    Object.assign(this.rot, { from: 0, to: 0, t: 1, dur: 1, hold: 0 });
  }

  private rimW(): number { return Math.max(3, (this.RO - this.R) * 0.065 * C.rimWidth); }

  private renderSlot(s: Slot): void {
    const band = this.RO - this.R, h = s.hpx;
    const c = document.createElement("canvas");
    const RING_SC = 2.4;
    c.width = Math.ceil(band * RING_SC); c.height = Math.ceil((h + 2) * RING_SC);
    const x = c.getContext("2d");
    if (!x) { s.c = c; return; }
    x.scale(RING_SC, RING_SC); x.textBaseline = "top";
    const RB = this.rimW(), dz0 = RB + 6, dz1 = band * 0.72, oz0 = band * 0.78, oz1 = band - RB - 5;
    const split = rnd() < 0.45 && dz1 - dz0 > 60;
    const blocks: Array<[number, number]> = [];
    if (split) { const m = dz0 + (dz1 - dz0) * rr(0.42, 0.6); blocks.push([dz0, m], [m + rr(4, 8), dz1]); }
    else blocks.push([dz0, dz1 - rr(0, 18)]);
    for (const [b0, b1] of blocks) {
      const tint = pick(TINTS), y0 = 1 + rr(0, 2), y1 = h + 1 - rr(0, 2);
      x.save(); x.beginPath(); x.rect(b0, y0 - 0.5, b1 - b0, y1 - y0 + 1); x.clip();
      BLOCKS[pickBlock(y1 - y0)]!(x, b0, b1, y0, y1, tint);
      x.restore();
    }
    const pitch = rr(8, 12);
    x.font = `600 3.1px ${FONT}`;
    for (let yy = rr(1, pitch); yy < h - 2; yy += pitch) {
      if (rnd() < 0.15) continue;
      let xx = oz0 + rr(0, 3);
      if (rnd() < 0.45) { x.fillStyle = `rgba(225,228,236,${rr(0.55, 0.95)})`; x.fillText(String((rnd() * 999) | 0).padStart(3, "0"), xx, yy - 1); xx += 9; }
      const n = 1 + ((rnd() * 3) | 0);
      for (let i = 0; i < n && xx < oz1; i++) { x.fillStyle = `rgba(225,228,236,${rr(0.5, 0.95)})`; x.fillRect(xx, yy, rr(1.2, 2.4), 1.2); xx += rr(2.4, 3.6); }
    }
    if (rnd() < 0.45) {
      x.fillStyle = "rgba(220,224,232,.7)";
      for (let xx = dz0; xx < oz1; xx += rr(2.4, 4.5)) if (rnd() < 0.8) x.fillRect(xx, h + 0.4, 1.1, 1.1);
    }
    s.c = c;
  }

  private drawRing(dt: number): void {
    const S = this.sx;
    if (!S) return;
    const band = this.RO - this.R;
    S.globalCompositeOperation = "source-over";
    S.save(); S.translate(this.cx, this.cy);
    S.beginPath(); S.arc(0, 0, this.RO, 0, TAU); S.arc(0, 0, this.R, 0, TAU, true);
    S.fillStyle = "#040506"; S.fill("evenodd");
    let regen = 1;
    for (const s of this.slots) {
      const A = s.a + this.ringRot;
      if (s.flash > 0) s.flash = Math.max(0, s.flash - dt * 2.2);
      const mid = this.R + band * 0.42;
      const sp = this.toScreen(this.cx + Math.cos(A) * mid, this.cy + Math.sin(A) * mid);
      if (sp.x < -140 || sp.x > this.W + 140 || sp.y < -140 || sp.y > this.H + 140) continue;
      if (!s.c || (regen > 0 && rnd() < 0.02)) { this.renderSlot(s); regen--; }
      S.save(); S.rotate(A);
      const hh = s.hpx + 2;
      if (s.c) S.drawImage(s.c, this.R, -hh / 2, band, hh);
      if (s.flash > 0.02 && s.c) {
        S.globalCompositeOperation = "lighter"; S.globalAlpha = s.flash;
        S.drawImage(s.c, this.R, -hh / 2, band, hh);
        S.globalAlpha = 1; S.globalCompositeOperation = "source-over";
      }
      S.restore();
    }
    const tick = (step: number, fn: (ca: number, sa: number, n: number) => void) => {
      const n0 = Math.floor((-this.thV - 0.05 - this.ringRot) / step);
      const n1 = Math.ceil((this.thV + 0.05 - this.ringRot) / step);
      for (let n = n0; n <= n1; n++) { const a = n * step + this.ringRot; fn(Math.cos(a), Math.sin(a), n); }
    };
    const RB = this.rimW();
    S.beginPath();
    tick(((0.14 / C.rimDensity) * Math.PI) / 180, (ca, sa, n) => {
      const m = ((n % 6) + 6) % 6;
      const li = m === 0 ? RB : RB * (0.5 + 0.35 * hash(n));
      const lo = m === 0 ? RB : RB * (0.5 + 0.35 * hash(n + 77));
      S.moveTo(ca * (this.R + 1.5), sa * (this.R + 1.5)); S.lineTo(ca * (this.R + 1.5 + li), sa * (this.R + 1.5 + li));
      S.moveTo(ca * (this.RO - 1.5), sa * (this.RO - 1.5)); S.lineTo(ca * (this.RO - 1.5 - lo), sa * (this.RO - 1.5 - lo));
    });
    S.globalCompositeOperation = "lighter";
    S.strokeStyle = `rgba(232,235,242,${Math.min(1, 0.035 * C.rimBright * C.rimBright)})`; S.lineWidth = 1.2 + 2.4 * C.rimBright; S.stroke();
    S.strokeStyle = `rgba(232,235,242,${Math.min(1, 0.08 * C.rimBright)})`; S.lineWidth = 1.4; S.stroke();
    S.globalCompositeOperation = "source-over";
    S.strokeStyle = `rgba(240,242,248,${Math.min(1, 0.88 * C.rimBright)})`; S.lineWidth = 0.55; S.stroke();
    const arc = (r: number, lw: number, a: number) => {
      S.strokeStyle = `rgba(232,235,242,${a})`; S.lineWidth = lw;
      S.beginPath(); S.arc(0, 0, r, -this.thV, this.thV); S.stroke();
    };
    arc(this.R, 1.5, 1); arc(this.R + RB + 3, 0.6, 0.6); arc(this.RO - RB - 3, 0.6, 0.55);
    S.globalCompositeOperation = "lighter"; arc(this.RO, 3.5, 0.1); S.globalCompositeOperation = "source-over";
    arc(this.RO, 1.3, 0.95);
    S.beginPath();
    tick((1 * Math.PI) / 180, (ca, sa) => { S.moveTo(ca * (this.R - 2), sa * (this.R - 2)); S.lineTo(ca * (this.R - 5), sa * (this.R - 5)); });
    tick((0.25 * Math.PI) / 180, (ca, sa, n) => {
      const m = ((n % 20) + 20) % 20, L = m === 0 ? 9 : m % 5 === 0 ? 5 : 2.5;
      S.moveTo(ca * (this.RO + 2), sa * (this.RO + 2)); S.lineTo(ca * (this.RO + 2 + L), sa * (this.RO + 2 + L));
    });
    S.strokeStyle = "rgba(230,233,240,.5)"; S.lineWidth = 0.6; S.stroke();
    S.restore();
  }

  /* ================= stage frame ================= */

  private drawStage(dt: number): void {
    const S = this.sx;
    if (!S || !this.webBase || !this.trailC || !this.glowC || !this.laneC) return;
    this.updateBeat(dt); this.updateCam(dt); this.updateOuter(dt);
    if (rnd() < dt * C.cometTrickle) this.spawnComet();
    this.webRot += (dt * (0.03 + this.env * 0.12)) * C.webSpin;
    this.updateRing(dt);
    for (let k = 0; k < 3; k++) this.layerEnv[k] = (this.layerEnv[k] ?? 0) * Math.exp(-dt * 2.2);

    S.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
    S.globalCompositeOperation = "source-over"; S.globalAlpha = 1;
    S.fillStyle = "#08090b"; S.fillRect(0, 0, this.W, this.H);

    const G = this.glowC.getContext("2d");
    if (G) {
      G.setTransform(1, 0, 0, 1, 0, 0);
      G.clearRect(0, 0, this.glowC.width, this.glowC.height);
      this.camT(G, 1 / this.GS);
      G.globalCompositeOperation = "lighter";
    }

    this.camT(S, this.DPR);

    S.save(); S.translate(this.cx, this.cy); S.rotate(this.webRot);
    const ws = 2 * this.R + 4;
    S.drawImage(this.webBase, -this.R - 2, -this.R - 2, ws, ws);
    S.globalCompositeOperation = "lighter";
    this.webLayers.forEach((c, k) => {
      S.globalAlpha = Math.min(1, C.webPulseBase + C.webPulseAmp * (this.layerEnv[k] ?? 0));
      S.drawImage(c, -this.R - 2, -this.R - 2, ws, ws);
    });
    S.globalAlpha = 1;

    const tx = this.trailC.getContext("2d");
    if (tx) {
      const surge = 0.5 + 2.5 * this.env;
      while (this.runners.length < C.runnerCount) this.runners.push(this.newRunner(true));
      if (this.runners.length > C.runnerCount) this.runners.length = Math.max(0, Math.round(C.runnerCount));
      tx.globalCompositeOperation = "destination-out";
      tx.fillStyle = `rgba(0,0,0,${0.05 + this.env * 0.05})`; tx.fillRect(0, 0, ws, ws);
      tx.globalCompositeOperation = "source-over";
      tx.save(); tx.translate(this.R + 2, this.R + 2); tx.lineCap = "round";
      for (let i = 0; i < this.runners.length; i++) {
        const r = this.runners[i]!;
        r.t += dt * C.runnerSpeed * (r.mode === 1 ? r.sp * surge : r.mode === 2 ? r.sp + 1.3 * r.t * r.t : r.sp);
        if (r.t >= 1) { this.runners[i] = this.newRunner(false); continue; }
        const p = this.qpt(r.cv, r.t);
        tx.strokeStyle = r.b ? `rgba(240,166,198,${Math.min(1, 0.9 * C.runnerBright)})` : `rgba(250,251,255,${Math.min(1, 0.75 * C.runnerBright)})`;
        tx.lineWidth = (r.b ? 1.3 : 0.9) * C.runnerWidth;
        tx.beginPath(); tx.moveTo(r.px, r.py); tx.lineTo(p.x, p.y); tx.stroke();
        r.px = p.x; r.py = p.y;
      }
      tx.restore();
      S.drawImage(this.trailC, -this.R - 2, -this.R - 2, ws, ws);
    }
    S.restore();
    this.camT(S, this.DPR);

    S.save(); S.translate(this.cx, this.cy); S.globalCompositeOperation = "lighter"; S.lineCap = "round";
    if (G) {
      G.save();
      G.translate(this.cx, this.cy);
    }
    for (let i = this.comets.length - 1; i >= 0; i--) {
      const c = this.comets[i]!;
      c.life += dt;
      const p = easeIO(Math.min(1, c.life / c.dur));
      const head = Math.min(1, p * (1 + c.win)), tail = Math.max(0, p * (1 + c.win) - c.win);
      const fade = c.life > c.dur ? Math.max(0, 1 - (c.life - c.dur) / 0.25) : 1;
      if (fade <= 0) { this.comets.splice(i, 1); continue; }
      const cr = C.cometFollow ? this.ringRot - c.rot0 : 0;
      if (head >= 1 && !c.hit) {
        c.hit = true;
        const pe = this.cpt(c.lines[c.lines.length >> 1]!, 1);
        this.flashSlotAt(Math.atan2(pe.y, pe.x) + cr);
      }
      S.save(); S.rotate(cr);
      if (G) {
        G.save();
        G.rotate(cr);
      }
      const col = c.tint ? "200,190,250" : "255,255,255";
      S.strokeStyle = `rgba(${col},${Math.min(1, 0.5 * fade * C.cometBright)})`; S.lineWidth = 1;
      this.strokeComet(S, c, tail, head, 18);
      const hs = head - (head - tail) * 0.35;
      S.strokeStyle = `rgba(${col},${Math.min(1, fade * C.cometBright)})`; S.lineWidth = 1.7;
      this.strokeComet(S, c, hs, head, 8);
      if (G && c.glow && C.cometGlow > 0) {
        G.strokeStyle = `rgba(${col},${Math.min(1, 0.5 * fade * C.cometGlow)})`; G.lineWidth = 2.8;
        this.strokeComet(G, c, hs, head, 6);
      }
      if (G) G.restore();
      S.restore();
    }
    if (G) G.restore();
    S.restore();

    S.globalCompositeOperation = "lighter";
    S.drawImage(this.laneC, 0, 0, this.W, this.H);
    this.drawOuterFar();
    this.drawOuterNear();
    this.drawRing(dt);

    S.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
    S.globalCompositeOperation = "lighter";
    if (this.HAS_FILTER) S.filter = "blur(6px)";
    S.globalAlpha = Math.min(1, 0.9 * C.glow);
    S.drawImage(this.glowC, 0, 0, this.glowC.width * this.GS, this.glowC.height * this.GS);
    if (this.HAS_FILTER) S.filter = "none";
    S.globalAlpha = 1; S.globalCompositeOperation = "source-over";

    this.drawCallout();
  }

  private drawCallout(): void {
    const S = this.sx;
    if (!S) return;
    const a = -this.thS * 0.32;
    const anchor = this.toScreen(this.cx + Math.cos(a) * (this.RO + 30), this.cy + Math.sin(a) * (this.RO + 30));
    const box = this.toScreen(this.cx + Math.cos(a) * (this.RO + 30) + 120, this.cy + Math.sin(a) * (this.RO + 30) - 40);
    const bx = Math.min(this.W - 190, Math.max(8, box.x)), by = Math.min(this.H - 60, Math.max(40, box.y));
    this.chkEl.style.transform = `translate(${bx}px,${by}px)`;
    S.strokeStyle = "rgba(230,233,238,.55)"; S.lineWidth = 0.8;
    S.beginPath(); S.moveTo(anchor.x, anchor.y); S.lineTo(bx, by + 12); S.stroke();
    S.fillStyle = "#fff"; S.fillRect(anchor.x - 1.5, anchor.y - 1.5, 3, 3);
  }

  /* ================= panels ================= */

  private feedPush(): void {
    if (!this.feedEl || this.destroyed) return;
    const v = pick(VERBS);
    const d = document.createElement("div");
    d.innerHTML = `<span class="n">${String(this.feedN++).padStart(3, "0")}</span><span class="vb ${v}">${v}</span>${pick(ACTS)}`;
    this.feedEl.appendChild(d);
    while (this.feedEl.children.length > 14) this.feedEl.removeChild(this.feedEl.firstChild!);
  }

  private seedFeed(n: number): void { for (let i = 0; i < n; i++) this.feedPush(); }

  private codeTick(): void {
    if (!this.codeEl || this.destroyed || this.phase !== "halo") return;
    const l = CODE[this.cLine]!;
    const full = (l[0] ? `${l[0]} = ` : "") + l[1] + l[2];
    this.cChar += 2;
    if (this.cChar > full.length + 6) {
      this.typed.push(`<div><span class="ln">${String(this.cNum++).padStart(3, "0")}</span>${this.codeHtml(l, full.length)}</div>`);
      if (this.typed.length > 12) this.typed.shift();
      this.cLine = (this.cLine + 1) % CODE.length;
      this.cChar = 0;
    }
    const cur = CODE[this.cLine]!;
    this.codeEl.innerHTML = this.typed.join("") +
      `<div><span class="ln">${String(this.cNum).padStart(3, "0")}</span>${this.codeHtml(cur, undefined)}<span class="hx-caret"></span></div>`;
  }

  private codeHtml(l: readonly [string, string, string], n?: number): string {
    const pre = l[0] ? `${l[0]} = ` : "";
    const full = pre + l[1] + l[2];
    let budget = n ?? full.length;
    let out = "", i = 0;
    const seg = (s: string, cls: string) => {
      const take = Math.max(0, Math.min(s.length, budget - i));
      if (take) out += `<span class="${cls}">${s.slice(0, take)}</span>`;
      i += s.length;
    };
    seg(pre, "op"); seg(l[1], "fn"); seg(l[2], "op");
    return out;
  }

  private renderRoutes(): void {
    const el = this.app.querySelector<HTMLElement>(".hx-routes");
    if (!el) return;
    let h = '<span class="h">PAPER</span><span class="h">EXTRACT</span><span class="h">CODE</span><span class="h">CHECK</span>';
    ROUTES.forEach((n, i) => {
      h += `<span class="nm">${n}</span>`;
      COLSR.forEach((c, j) => {
        const st = this.rState[i] ?? 0;
        const cls = j < st ? "done" : j === st ? (i === 5 ? "pk" : "on") : "";
        h += `<span><span class="hx-chip ${cls}">${c}</span></span>`;
      });
    });
    el.innerHTML = h;
  }

  private agentsTick(dt: number): void {
    this.agData.forEach((a, i) => {
      const row = this.agRows[i];
      if (!row) return;
      a.p += a.sp * dt;
      if (a.p > 9) { a.p = 0; a.sp = rr(0.6, 2); }
      const done = Math.floor(a.p);
      const cells = (row.children[2] as HTMLElement).children;
      for (let k = 0; k < 6; k++) {
        (cells[k] as HTMLElement).style.background = k < done ? ROLE_COL[a.role] ?? "#1d1f24" : k === done ? "#5a5e66" : "#1d1f24";
      }
      const st = a.p < 0.6 ? "dispatch" : a.p > 6 ? "idle" : "working";
      const se = row.children[3] as HTMLElement;
      if (se.textContent !== st) { se.textContent = st; se.className = `st${st === "working" ? " w" : ""}`; }
    });
  }

  private readonly flow = (x: number, y: number): number =>
    Math.sin(x * 0.035 + this.T * 0.6) * Math.cos(y * 0.05 - this.T * 0.4) * Math.PI + Math.sin((x + y) * 0.01 + this.T * 0.2);

  private drawAdv(dt: number): void {
    const p = this.pAdv, x = p.x;
    if (!x) return;
    const w = p.w, h = p.h;
    x.fillStyle = "rgba(14,15,18,0.22)"; x.fillRect(0, 0, w, h);
    x.fillStyle = "rgba(120,125,135,.25)";
    for (let i = 6; i < w; i += 12) for (let j = 6; j < h; j += 12) x.fillRect(i, j, 1, 1);
    x.strokeStyle = "rgba(235,238,244,.7)"; x.lineWidth = 0.8; x.beginPath();
    for (const q of this.advP) {
      const a = this.flow(q.x, q.y), nx = q.x + Math.cos(a) * 22 * dt, ny = q.y + Math.sin(a) * 22 * dt;
      x.moveTo(q.x, q.y); x.lineTo(nx + Math.cos(a) * 2, ny + Math.sin(a) * 2);
      q.x = nx; q.y = ny; q.l -= dt;
      if (q.l < 0 || q.x < 0 || q.x > w || q.y < 0 || q.y > h) { q.x = rnd() * w; q.y = rnd() * h; q.l = rr(1, 4); }
    }
    x.stroke();
  }

  private drawDiff(): void {
    const p = this.pDiff, x = p.x;
    if (!x) return;
    const w = p.w, h = p.h;
    x.clearRect(0, 0, w, h);
    x.font = `600 7px ${FONT}`; x.textBaseline = "top";
    const gap = 8, mw = (w - gap) / 2, mh = h * 0.68, cols = 22, rows = 13, cw = mw / cols, ch = (mh - 10) / rows;
    const hist = new Array<number>(28).fill(0);
    for (let m = 0; m < 2; m++) {
      const ox = m * (mw + gap);
      x.fillStyle = "#6b6f78"; x.fillText(m ? "IMPLEMENTATION" : "REFERENCE", ox, 0);
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        let v = 0.5 + 0.25 * Math.sin(i * 0.45 + this.T * 0.8) * Math.cos(j * 0.5 - this.T * 0.5) + 0.2 * Math.sin((i + j) * 0.3 + this.T);
        let err = 0;
        if (m) {
          const dx = i - 15 - Math.sin(this.T * 0.7) * 3, dy = j - 6;
          err = Math.exp(-(dx * dx + dy * dy) / 6) * (0.5 + 0.5 * Math.sin(this.T * 2));
          v += err * 0.3;
          const hi = Math.min(27, (err * 27) | 0);
          hist[hi] = (hist[hi] ?? 0) + 1;
        }
        const g = Math.max(0, Math.min(255, v * 210 + 20)) | 0;
        x.fillStyle = err > 0.35 ? `rgba(240,166,198,${0.5 + err * 0.5})` : `rgb(${g},${g},${g + 4})`;
        x.fillRect(ox + i * cw, 10 + j * ch, cw - 0.6, ch - 0.6);
      }
    }
    const by = mh + 4, bh = h - by, bw = w / hist.length;
    const mx = Math.max(...hist.slice(1), 1);
    hist.forEach((v, i) => {
      const hh = i === 0 ? bh * 0.9 : (v / mx) * bh * 0.8 + 1;
      x.fillStyle = i > 9 ? "#f0a6c6" : "#8a8e97";
      x.fillRect(i * bw, by + bh - hh, bw - 1, hh);
    });
  }

  private drawVal(): void {
    const p = this.pVal, x = p.x;
    if (!x) return;
    const w = p.w, h = p.h;
    x.clearRect(0, 0, w, h);
    const lw = 58, n = Math.floor((w - lw) / 2);
    if (n <= 0) return;
    const names = ["MASS", "STABILITY", "RESIDUAL"];
    if (rnd() < 0.01) this.valSpike = 1;
    this.valSpike *= 0.9;
    const vals = [
      Math.sin(this.T * 3) * 0.35 + Math.sin(this.T * 7.3) * 0.15 + gauss() * 0.06,
      Math.sin(this.T * 5 + 1) * 0.3 + Math.sin(this.T * 1.3) * 0.25 + gauss() * 0.08,
      Math.sin(this.T * 2.2) * 0.2 + gauss() * 0.15 + (rnd() < 0.5 ? 1 : -1) * this.valSpike * 0.9,
    ];
    vals.forEach((v, k) => { this.valBuf[k]!.push(v); while (this.valBuf[k]!.length > n) this.valBuf[k]!.shift(); });
    x.font = `800 7px ${FONT}`; x.textBaseline = "middle";
    const rh = h / 3;
    for (let k = 0; k < 3; k++) {
      const yc = rh * k + rh / 2;
      x.fillStyle = "#9a9ea7"; x.fillText(names[k]!, 0, yc);
      x.strokeStyle = "#1f2227"; x.lineWidth = 1; x.beginPath(); x.moveTo(lw, yc); x.lineTo(w, yc); x.stroke();
      x.strokeStyle = k === 1 && this.valSpike > 0.2 ? "#f0a6c6" : "#e6e8ec"; x.lineWidth = 1.1;
      x.beginPath();
      this.valBuf[k]!.forEach((v, i) => { const px = lw + i * 2, py = yc - v * rh * 0.45; if (i) x.lineTo(px, py); else x.moveTo(px, py); });
      x.stroke();
    }
    const cxr = lw + this.valBuf[0]!.length * 2;
    x.strokeStyle = "rgba(240,166,198,.6)"; x.beginPath(); x.moveTo(cxr, 0); x.lineTo(cxr, h); x.stroke();
  }

  private drawIdx(): void {
    const p = this.pIdx, x = p.x;
    if (!x) return;
    const w = p.w, h = p.h;
    x.clearRect(0, 0, w, h);
    x.font = `600 6.5px ${FONT}`; x.textBaseline = "middle";
    const lx = 24, rx = 34, rows = 11, cols = 28, cw = (w - lx - rx) / cols, ch = h / rows;
    const scan = Math.floor((this.T * 6) % cols);
    if (rnd() < 0.3) {
      const r = (rnd() * rows) | 0, c = (rnd() * cols) | 0;
      this.idxData[r]![c] = rnd();
    }
    for (let j = 0; j < rows; j++) {
      x.fillStyle = "#6b6f78"; x.fillText(`M${String(j + 1).padStart(2, "0")}`, 0, j * ch + ch / 2);
      let match = 0;
      for (let i = 0; i < cols; i++) {
        const v = this.idxData[j]![i]!;
        x.fillStyle = v > 0.86 ? "#f0a6c6" : v > 0.7 ? "rgba(240,166,198,.45)" : v > 0.4 ? "#4a4e56" : "#1c1e23";
        if (i === scan) x.fillStyle = v > 0.4 ? "#ffffff" : "#3a3e46";
        x.fillRect(lx + i * cw, j * ch + 1, cw - 1, ch - 2);
        if (v > 0.7) match++;
      }
      x.fillStyle = match > 7 ? "#f0a6c6" : "#9a9ea7";
      x.fillText(match > 7 ? "review" : "match", w - rx + 4, j * ch + ch / 2);
    }
  }

  private static number(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }

  private static clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}

/** Image variant: with wallMedia "off" (default) the halo page and its BGM
 * play for durationMs (up to the watchdog's 120 s ceiling) and hand over;
 * "all"/"single" add the glitch transition and the media wall. */
export const halofluxAnimation: OpeningAnimation = {
  id: "haloflux",
  kind: "image",
  labelKey: "anim.haloflux.label",
  descriptionKey: "anim.haloflux.desc",
  paramsSchema: {
    hookMs: { type: "number", default: DEFAULT_HOOK_MS, min: MIN_HOOK_MS, max: MAX_HOOK_MS, step: 250 },
    wallMedia: { type: "enum", default: "off", options: WALL_MEDIA_OPTIONS },
    durationMs: { type: "number", default: DEFAULT_RUN_MS, min: MIN_RUN_MS, max: MAX_RUN_MS, step: 250 },
  },
  create: (runtime) => new HalofluxEngine(runtime),
};

/** Video variant: same chain; the wall's program source carries the volume. */
export const halofluxVideoAnimation: OpeningAnimation = {
  id: "haloflux-video",
  kind: "video",
  labelKey: "anim.haloflux.label",
  descriptionKey: "anim.haloflux.desc",
  paramsSchema: {
    hookMs: { type: "number", default: DEFAULT_HOOK_MS, min: MIN_HOOK_MS, max: MAX_HOOK_MS, step: 250 },
    wallMedia: { type: "enum", default: "off", options: WALL_MEDIA_OPTIONS },
    durationMs: { type: "number", default: DEFAULT_RUN_MS, min: MIN_RUN_MS, max: MAX_RUN_MS, step: 250 },
    volume: { type: "number", default: 100, min: 0, max: 100, step: 5 },
  },
  create: (runtime) => new HalofluxEngine(runtime),
};
