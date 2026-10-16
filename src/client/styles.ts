// All plugin CSS. Everything is namespaced under .dsh-opening-*; the settings
// panel follows the host theme through --dsw-alias-* tokens only (never writes
// them — dsh-custom-skin owns a capture/restore mechanism around those, and
// clobbering it would break the skin, see ADR-006).

export const CRITICAL_STYLES = String.raw`
html[data-dsh-opening-pending='1'] #root { opacity: 0; }
`;

export const GLOBAL_STYLES = String.raw`
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
/* Waiting-phase hint pill used by the tap-reveal engine */
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
/* ---- video-player engine: "click for sound" pill shown when the autoplay
   policy forced a silent fallback. Own keyframes (hint-pulse would override
   the static translateX with its -50%,-50% pair and shove the pill up by
   half its height); bottom 18% + centered keeps it clear of the skip note
   (.dsh-opening-skip at right 18px / bottom 14px) ---- */
@keyframes dsh-opening-unmute-hint-pulse {
  0%, 100% { transform: translateX(-50%) scale(1); }
  50% { transform: translateX(-50%) scale(1.06); }
}
.dsh-opening-unmute-hint {
  position: absolute;
  left: 50%;
  bottom: 18%;
  transform: translateX(-50%);
  padding: 10px 22px;
  border: 1px solid rgb(255 255 255 / 0.35);
  border-radius: 999px;
  background: rgb(0 0 0 / 0.55);
  color: #fff;
  font: 14px/1.4 system-ui, sans-serif;
  letter-spacing: 0.08em;
  cursor: pointer;
  z-index: 6;
  animation: dsh-opening-unmute-hint-pulse 2.2s ease-in-out infinite;
}
.dsh-opening-unmute-hint:hover { background: rgb(0 0 0 / 0.75); }

/* ---- glitch-404 engine: a faithful remake of the "404glitched-out" piece —
   the user's picture stands in for the black backdrop, everything else
   follows the reference: the code block container and the info line warp on
   the noise-3 beat, and each strobe line flickers as a ghost pair through
   noise-1/noise-2. The finale sinks the screen into black. ---- */
.dsh-opening-g404 {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--dsh-opening-bg, #04050e);
  color: #fff;
  user-select: none;
}
.dsh-opening-g404-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
/* Dark veil over the picture so the strobe lines stay readable on colorful
   pictures; 0 = the reference's look (text directly on the backdrop). */
.dsh-opening-g404-mask {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: #000;
}
/* .error: code block container, warped by noise-3 like the reference */
.dsh-opening-g404-error {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -60px;
  right: 0;
  width: 100%;
  height: 120px;
  margin: auto;
  text-align: center;
  pointer-events: none;
}
.dsh-opening-g404.dsh-opening-g404-run .dsh-opening-g404-error {
  animation: dsh-opening-g404-noise-3 1s linear infinite;
}
.dsh-opening-g404-wrap {
  position: absolute;
  top: 30%;
  left: 25%;
  height: 200px;
  margin-top: -100px;
}
.dsh-opening-g404-code {
  color: var(--dsh-g404-text, #fff);
  font-family: ui-monospace, "Cascadia Mono", Consolas, "JetBrains Mono", monospace;
  font-size: 14px;
  line-height: 1.5;
  text-align: left;
}
.dsh-opening-g404-code pre {
  margin: 0;
}
.dsh-opening-g404-code .dsh-orange { color: #f39c12; }
.dsh-opening-g404-code .dsh-green { color: #33cc33; }
.dsh-opening-g404-code .dsh-blue { color: #48beef; }
.dsh-opening-g404-code .dsh-comment { color: #7f8c8d; }
/* .info: the second strobe line's positioning box, warped as well */
.dsh-opening-g404-info {
  position: absolute;
  top: 280px;
  bottom: 0;
  left: 20px;
  right: 0;
  width: 200px;
  height: 60px;
  margin: auto;
  text-align: center;
  display: block;
}
.dsh-opening-g404.dsh-opening-g404-run .dsh-opening-g404-info {
  animation: dsh-opening-g404-noise-3 1s linear infinite;
}
/* body:before/after counterpart: the main line's positioning box */
.dsh-opening-g404-main {
  position: absolute;
  top: 25%;
  bottom: 0;
  left: 0;
  right: 35%;
  width: 550px;
  margin: auto;
  text-align: center;
  pointer-events: none;
}
.dsh-opening-g404-ghost {
  position: absolute;
  color: var(--dsh-g404-text, #fff);
  font-family: ui-monospace, "Cascadia Mono", Consolas, "JetBrains Mono", monospace;
  font-size: 100px;
  line-height: 1.15;
  white-space: nowrap;
  opacity: 0;
  will-change: opacity, left;
}
.dsh-opening-g404-main .dsh-opening-g404-ghost {
  top: 0;
  left: 0;
  width: 100%;
}
/* The reference's info pair sits apart (right:100px vs right:0) — a static
   50px offset on top of the strobe jumps. */
.dsh-opening-g404-sub-ghost-a {
  top: 20px;
  left: 40px;
  right: 100px;
  width: 800px;
  margin: auto;
}
.dsh-opening-g404-sub-ghost-b {
  top: 20px;
  left: 40px;
  right: 0;
  width: 800px;
  margin: auto;
}
.dsh-opening-g404.dsh-opening-g404-run .dsh-opening-g404-ghost-a {
  animation: dsh-opening-g404-noise-1 0.2s linear infinite;
}
.dsh-opening-g404.dsh-opening-g404-run .dsh-opening-g404-ghost-b {
  animation: dsh-opening-g404-noise-2 0.2s linear infinite;
}
/* The reference's strobe keyframes: mostly invisible, briefly bright while
   jumping sideways — pair a and b offset in opposite directions. */
@keyframes dsh-opening-g404-noise-1 {
  0%, 20%, 40%, 60%, 70%, 90% { opacity: 0; }
  10% { opacity: 0.1; }
  50% { opacity: 0.5; left: -6px; }
  80% { opacity: 0.3; }
  100% { opacity: 0.6; left: 2px; }
}
@keyframes dsh-opening-g404-noise-2 {
  0%, 20%, 40%, 60%, 70%, 90% { opacity: 0; }
  10% { opacity: 0.1; }
  50% { opacity: 0.5; left: 6px; }
  80% { opacity: 0.3; }
  100% { opacity: 0.6; left: -2px; }
}
/* The reference's noise-3 warp on the error block and the info line. */
@keyframes dsh-opening-g404-noise-3 {
  0%, 3%, 5%, 42%, 44%, 100% { opacity: 1; transform: scaleY(1); }
  4.3% { opacity: 1; transform: scaleY(4); }
  43% { opacity: 1; transform: scaleX(10) rotate(60deg); }
}
/* Black-out finale veil; the outro class also stops every reference
   animation so the black frame is truly still. */
.dsh-opening-g404-fade {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: #000;
  opacity: 0;
  transition: opacity 900ms ease;
}
.dsh-opening-g404.dsh-opening-g404-outro .dsh-opening-g404-error,
.dsh-opening-g404.dsh-opening-g404-outro .dsh-opening-g404-info,
.dsh-opening-g404.dsh-opening-g404-outro .dsh-opening-g404-ghost {
  animation: none;
}

/* ---- glass engine: a frosted lock screen (its own background image, or the
   active picture) over the user's picture — dark tint plus backdrop blur,
   big clock and local date at center, pulsing hint at the bottom. The
   unlocked class slides the whole lock screen up, revealing the picture
   beneath. ---- */
.dsh-opening-glass {
  position: absolute;
  inset: 0;
  overflow: hidden;
  cursor: pointer;
  background: var(--dsh-opening-bg, #04050e);
}
.dsh-opening-glass-under {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.dsh-opening-glass-screen {
  position: absolute;
  inset: 0;
  transition: transform 600ms cubic-bezier(0.85, 0, 0.15, 1);
}
.dsh-opening-glass-screen.dsh-opening-glass-unlocked { transform: translateY(-100%); }
.dsh-opening-glass-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.dsh-opening-glass-veil {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.25);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
}
.dsh-opening-glass-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #fff;
  text-align: center;
}
.dsh-opening-glass-clock {
  font-size: clamp(64px, 13vh, 160px);
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 4px 15px rgba(0, 0, 0, 0.6);
}
.dsh-opening-glass-date {
  margin-top: 10px;
  font-size: clamp(18px, 3vh, 30px);
  font-weight: 300;
  opacity: 0.9;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
}
.dsh-opening-glass-hint {
  position: absolute;
  bottom: 60px;
  left: 0;
  right: 0;
  color: #fff;
  font-size: 15px;
  letter-spacing: 2px;
  text-align: center;
  text-shadow: 0 2px 5px rgba(0, 0, 0, 0.5);
  animation: dsh-opening-glass-pulse 2s ease-in-out infinite;
}
@keyframes dsh-opening-glass-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.9; }
}

/* ---- constructivism1 engine: a constructivist poster collage over the
   user's media — warm-paper ground, ink-black band, halftone screens and
   thin ink rules, constructivist-blue bars, one blue wedge and an ink disc;
   the media sits in the big sharply clipped polygon right of center over an
   ink plate (heavy stroke) plus misregistered blue/deep-navy under-layers
   (print offset); a diagonal solid-ink collage block presses
   over the window's bottom-right and an irregular ink triangle over its
   top-right; a skewed ink DEEPSEEK brand plate top-left; caption blocks slam
   down the left column on alternating ink/paper plates with a ±1° collage
   tilt. Every element runs on the shared --cst-total (durationMs) and stages
   its own entrance in percentage windows, no negative delays: 0-6% paper
   hard-cut + top band sweep; 3-18% geometry cut-ins on
   cubic-bezier(0.85, 0, 0.15, 1); 15-32% blue wedge sweep + the media
   polygon unfolding from a diagonal slit; 18-24% the solid-ink collage block
   and 21-27% the ink triangle hard-cut over the window's corners; 30-58%
   caption blocks slam in (scale 1.6 → 1); 58-90% breathing hold; 90-100%
   settle. The resting styles below ARE the final frame:
   .dsh-opening-cst-final (skip) switches the animations off and every
   element lands on its static final state. Params: --cst-total from
   durationMs, --cst-accent from accentColor, the media object-fit from
   mediaFit (set inline by the engine). ---- */
.dsh-opening-cst {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--dsh-opening-bg, #04050e);
  font-family: system-ui, sans-serif;
  user-select: none;
  --cst-paper: #e3d1bd;
  --cst-ink: #141414;
  --cst-blue: #173f9e;
  --cst-deep: #001333;
  --cst-cream: #efe0c9;
  --cst-accent: #173f9e;
  animation: dsh-opening-cst-settle var(--cst-total, 6500ms) linear both;
}
.dsh-opening-cst.dsh-opening-cst-final,
.dsh-opening-cst.dsh-opening-cst-final * {
  animation: none !important;
}
.dsh-opening-cst-paper {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: var(--cst-paper);
  animation: dsh-opening-cst-paper-in var(--cst-total, 6500ms) linear both;
}
.dsh-opening-cst-band {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4.5vh;
  z-index: 6;
  background: var(--cst-ink);
  transform-origin: left center;
  animation: dsh-opening-cst-band-in var(--cst-total, 6500ms) linear both;
}
.dsh-opening-cst-lines {
  position: absolute;
  top: 8%;
  right: 5%;
  width: 30vw;
  height: 16vh;
  z-index: 1;
  background: repeating-linear-gradient(58deg, var(--cst-ink) 0 2px, transparent 2px 20px);
  animation: dsh-opening-cst-lines-in var(--cst-total, 6500ms) linear both;
}
.dsh-opening-cst-halftone-a {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 30vw;
  height: 34vh;
  z-index: 4;
  background-color: var(--cst-ink);
  clip-path: polygon(100% 0, 100% 100%, 0 100%);
  animation: dsh-opening-cst-halftone-a-in var(--cst-total, 6500ms) linear both;
}
.dsh-opening-cst-halftone-b {
  position: absolute;
  left: 1%;
  top: 56%;
  width: 15vw;
  height: 13vh;
  z-index: 1;
  background-image: radial-gradient(circle, rgb(20 20 20 / 0.9) 0 1.6px, transparent 1.7px);
  background-size: 8px 8px;
  animation: dsh-opening-cst-halftone-b-in var(--cst-total, 6500ms) linear both;
}
.dsh-opening-cst-stripe-a {
  position: absolute;
  left: 22%;
  top: -25vh;
  width: 2vw;
  height: 150vh;
  z-index: 2;
  background: var(--cst-blue);
  transform: rotate(-28deg);
  animation: dsh-opening-cst-stripe-a-in var(--cst-total, 6500ms) linear both;
}
.dsh-opening-cst-stripe-b {
  position: absolute;
  left: 74%;
  top: 30%;
  width: 1.5vw;
  height: 130vh;
  z-index: 2;
  background: var(--cst-blue);
  transform: rotate(24deg) translateX(1.2vw);
  animation: dsh-opening-cst-stripe-b-in var(--cst-total, 6500ms) linear both;
}
.dsh-opening-cst-wedge {
  position: absolute;
  left: 20%;
  top: 5%;
  width: 26vw;
  height: 30vh;
  z-index: 4;
  background: var(--cst-accent);
  clip-path: polygon(0 0, 100% 38%, 24% 100%);
  animation: dsh-opening-cst-wedge-in var(--cst-total, 6500ms) linear both;
}
.dsh-opening-cst-disc {
  position: absolute;
  left: 4%;
  bottom: 7%;
  width: 11vh;
  height: 11vh;
  z-index: 4;
  border-radius: 50%;
  background: var(--cst-accent);
  animation: dsh-opening-cst-disc-in var(--cst-total, 6500ms) linear both;
}
.dsh-opening-cst-frame {
  position: absolute;
  left: 30%;
  top: 7%;
  right: 2%;
  bottom: 12%;
  z-index: 3;
  transform: scale(1.02);
  animation: dsh-opening-cst-frame-in var(--cst-total, 6500ms) linear both;
}
.dsh-opening-cst-layer {
  position: absolute;
  inset: 0;
  clip-path: polygon(7% 0%, 100% 0%, 100% 74%, 93% 100%, 0% 100%, 0% 26%);
  animation: dsh-opening-cst-clip-open var(--cst-total, 6500ms) linear both;
}
.dsh-opening-cst-frame-ink {
  background: var(--cst-ink);
  transform: scale(1.015);
}
.dsh-opening-cst-frame-blue {
  background: var(--cst-blue);
  transform: translate(1.1%, -1.5%);
}
.dsh-opening-cst-frame-deep {
  background: var(--cst-deep);
  transform: translate(-1.3%, 1.1%);
}
.dsh-opening-cst-frame-clip { overflow: hidden; }
.dsh-opening-cst-media {
  display: block;
  width: 100%;
  height: 100%;
}
/* The two collage pieces pressed over the media window's corners: a big
   diagonal solid-ink block over the bottom-right — flat opaque ink, cut in
   by an irregular polygon edge — and a small irregular ink triangle over the
   top-right. Both sit above the media frame (z 4 over 3) and below the
   caption column (z 5); halftone-a adds a flat solid-ink right triangle that
   fuses with the corner into one solid black area. */
.dsh-opening-cst-corner {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 32vw;
  height: 44vh;
  z-index: 4;
  background-color: var(--cst-ink);
  clip-path: polygon(100% 30%, 100% 100%, 0% 100%, 26% 78%, 60% 52%);
  animation: dsh-opening-cst-corner-in var(--cst-total, 6500ms) linear both;
}
.dsh-opening-cst-tri {
  position: absolute;
  right: 4%;
  top: 6%;
  width: 13vw;
  height: 18vh;
  z-index: 4;
  background: var(--cst-ink);
  clip-path: polygon(18% 0%, 100% 30%, 42% 100%);
  animation: dsh-opening-cst-tri-in var(--cst-total, 6500ms) linear both;
}
.dsh-opening-cst-brand {
  position: absolute;
  left: 3.5%;
  top: 7%;
  z-index: 6;
  padding: 1.4vh 1.2vw;
  background: var(--cst-ink);
  color: var(--cst-cream);
  font-size: clamp(14px, 1.9vw, 30px);
  font-weight: 900;
  letter-spacing: 0.38em;
  text-transform: uppercase;
  transform: skewX(-8deg);
  animation: dsh-opening-cst-brand-in var(--cst-total, 6500ms) linear both;
}
.dsh-opening-cst-col {
  position: absolute;
  left: 3.5%;
  top: 20%;
  width: 28%;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1.6vh;
}
.dsh-opening-cst-block {
  max-width: 100%;
  padding: 1vh 1.1vw;
  font-size: clamp(34px, 6.2vw, 128px);
  font-weight: 900;
  line-height: 0.98;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  white-space: nowrap;
  transform: translateX(var(--cst-shift, 0vw)) rotate(var(--cst-rot, 0deg));
}
.dsh-opening-cst-block-ink {
  background: var(--cst-ink);
  color: var(--cst-cream);
}
.dsh-opening-cst-block-paper {
  background: var(--cst-paper);
  color: var(--cst-ink);
  box-shadow: 0 0 0 2px var(--cst-ink);
}
.dsh-opening-cst-block-0 { animation: dsh-opening-cst-drop-0 var(--cst-total, 6500ms) linear both; }
.dsh-opening-cst-block-1 { animation: dsh-opening-cst-drop-1 var(--cst-total, 6500ms) linear both; }
.dsh-opening-cst-block-2 { animation: dsh-opening-cst-drop-2 var(--cst-total, 6500ms) linear both; }

@keyframes dsh-opening-cst-paper-in {
  0%, 5% { opacity: 0; }
  5.8%, 100% { opacity: 1; }
}
@keyframes dsh-opening-cst-band-in {
  0% { transform: scaleX(0); }
  1% { transform: scaleX(0); animation-timing-function: cubic-bezier(0.85, 0, 0.15, 1); }
  6%, 100% { transform: scaleX(1); }
}
@keyframes dsh-opening-cst-brand-in {
  0%, 3% { opacity: 0; transform: skewX(-8deg) translateX(-2vw); }
  3.5% { opacity: 1; animation-timing-function: cubic-bezier(0.85, 0, 0.15, 1); }
  8%, 100% { opacity: 1; transform: skewX(-8deg) translateX(0); }
}
@keyframes dsh-opening-cst-stripe-a-in {
  0%, 5% { opacity: 0; transform: rotate(-28deg) translateX(-7vw); }
  5.5% { opacity: 1; animation-timing-function: cubic-bezier(0.85, 0, 0.15, 1); }
  10%, 100% { opacity: 1; transform: rotate(-28deg) translateX(0); }
}
@keyframes dsh-opening-cst-stripe-b-in {
  0%, 8% { opacity: 0; transform: rotate(24deg) translateX(-6vw); }
  8.5% { opacity: 1; animation-timing-function: cubic-bezier(0.85, 0, 0.15, 1); }
  13%, 58% { opacity: 1; transform: rotate(24deg) translateX(0); }
  90%, 100% { opacity: 1; transform: rotate(24deg) translateX(1.2vw); }
}
@keyframes dsh-opening-cst-disc-in {
  0%, 11% { opacity: 0; transform: scale(0.2); }
  11.5% { opacity: 1; transform: scale(0.2); animation-timing-function: cubic-bezier(0.85, 0, 0.15, 1); }
  16%, 100% { opacity: 1; transform: scale(1); }
}
@keyframes dsh-opening-cst-halftone-a-in {
  0%, 9% { opacity: 0; }
  9.5% { opacity: 1; }
  58% { opacity: 1; }
  68% { opacity: 0.82; }
  78% { opacity: 1; }
  86% { opacity: 0.88; }
  100% { opacity: 1; }
}
@keyframes dsh-opening-cst-halftone-b-in {
  0%, 12% { opacity: 0; }
  12.5%, 100% { opacity: 1; }
}
@keyframes dsh-opening-cst-lines-in {
  0%, 13% { opacity: 0; }
  13.5%, 100% { opacity: 1; }
}
/* The media polygon unfolds from the diagonal slit to the full hexagon; the
   ink/blue/deep under-layers share this exact animation so the heavy stroke
   and the print-offset plates track the window at every moment. */
@keyframes dsh-opening-cst-clip-open {
  0%, 16% {
    clip-path: polygon(52% 40%, 85% 10%, 89% 17%, 56% 47%, 10% 95%, 6% 88%);
    animation-timing-function: cubic-bezier(0.85, 0, 0.15, 1);
  }
  32%, 100% {
    clip-path: polygon(7% 0%, 100% 0%, 100% 74%, 93% 100%, 0% 100%, 0% 26%);
  }
}
@keyframes dsh-opening-cst-wedge-in {
  0%, 15% { opacity: 0; transform: translate(-70vw, -45vh) rotate(-24deg); }
  16% { opacity: 1; animation-timing-function: cubic-bezier(0.85, 0, 0.15, 1); }
  32%, 100% { opacity: 1; transform: translate(0, 0) rotate(0deg); }
}
/* The collage pieces hard-cut over the media window while it unfolds: the
   bottom-right solid-ink block slams in first (18-24%), the top-right ink
   triangle follows (21-27%); both keep the steep easing and freeze on their
   static final state (opacity 1, transform none). */
@keyframes dsh-opening-cst-corner-in {
  0%, 18% { opacity: 0; transform: translate(2.5vw, 2.5vh); }
  18.5% { opacity: 1; animation-timing-function: cubic-bezier(0.85, 0, 0.15, 1); }
  24%, 100% { opacity: 1; transform: translate(0, 0); }
}
@keyframes dsh-opening-cst-tri-in {
  0%, 21% { opacity: 0; transform: rotate(-12deg) scale(0.4); }
  21.5% { opacity: 1; animation-timing-function: cubic-bezier(0.85, 0, 0.15, 1); }
  27%, 100% { opacity: 1; transform: rotate(0deg) scale(1); }
}
@keyframes dsh-opening-cst-frame-in {
  0%, 15% { opacity: 0; transform: scale(1); }
  15.5% { opacity: 1; }
  58% { opacity: 1; transform: scale(1); }
  74% { transform: scale(1.045); }
  90%, 100% { opacity: 1; transform: scale(1.02); }
}
/* Caption blocks slam in one by one: scale 1.6 → 1 with opacity, staggered
   windows per block (0: 30-40%, 1: 38-48%, 2: 46-56%). */
@keyframes dsh-opening-cst-drop-0 {
  0%, 30% { opacity: 0; transform: translateX(var(--cst-shift, 0vw)) rotate(var(--cst-rot, 0deg)) scale(1.6); animation-timing-function: cubic-bezier(0.2, 0.9, 0.27, 1); }
  40%, 100% { opacity: 1; transform: translateX(var(--cst-shift, 0vw)) rotate(var(--cst-rot, 0deg)) scale(1); }
}
@keyframes dsh-opening-cst-drop-1 {
  0%, 38% { opacity: 0; transform: translateX(var(--cst-shift, 0vw)) rotate(var(--cst-rot, 0deg)) scale(1.6); animation-timing-function: cubic-bezier(0.2, 0.9, 0.27, 1); }
  48%, 100% { opacity: 1; transform: translateX(var(--cst-shift, 0vw)) rotate(var(--cst-rot, 0deg)) scale(1); }
}
@keyframes dsh-opening-cst-drop-2 {
  0%, 46% { opacity: 0; transform: translateX(var(--cst-shift, 0vw)) rotate(var(--cst-rot, 0deg)) scale(1.6); animation-timing-function: cubic-bezier(0.2, 0.9, 0.27, 1); }
  56%, 100% { opacity: 1; transform: translateX(var(--cst-shift, 0vw)) rotate(var(--cst-rot, 0deg)) scale(1); }
}
/* The gentle settle: a last breath in, then the whole poster freezes. */
@keyframes dsh-opening-cst-settle {
  0%, 90% { transform: scale(1); }
  94% { transform: scale(1.012); }
  100% { transform: scale(1); }
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

.dsh-opening-language {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 12px 14px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 75%, transparent);
}
.dsh-opening-language select {
  min-width: 132px;
  height: 34px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  padding: 0 10px;
  background: var(--dsw-alias-bg-layer-3);
  color: var(--dsw-alias-label-primary);
  font: inherit;
}

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
/* Text, number and select inputs share one token-driven rule: the skin plugin
   rewrites these --dsw-alias-* tokens around the wallpaper, so parameter text
   fields (caption, captionFont, textColor, hintText, lockBg) follow the skin
   and the surrounding panel instead of the browser's native white input. */
.dsh-opening-control select,
.dsh-opening-control input[type='number'],
.dsh-opening-control input[type='text'] {
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
  .dsh-opening-language { align-items: stretch; flex-direction: column; gap: 10px; }
  .dsh-opening-language select { width: 100%; }
  .dsh-opening-controls { grid-template-columns: 1fr; }
  .dsh-opening-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`;

let criticalTag: HTMLStyleElement | undefined;

/** Inject the pre-flash critical rule (factory evaluation time, synchronous). */
export function installCriticalStyles(): void {
  if (criticalTag !== undefined) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-opening-animation";
  tag.textContent = CRITICAL_STYLES;
  document.head.append(tag);
  criticalTag = tag;
}

/** Remove the critical rule together with the pending attribute, plus every
 * host-injected early style tag (style[data-dsh-opening-early='1'], rendered
 * into the head by the webserver index-inject row) — zero-trace teardown:
 * every endpoint that un-pends must lift the host-side cover rules too.
 * Idempotent by contract. */
export function removeCriticalStyles(): void {
  criticalTag?.remove();
  criticalTag = undefined;
  for (const tag of document.querySelectorAll("style[data-dsh-opening-early='1']")) {
    tag.remove();
  }
}

// Early cover: between this bundle's synchronous evaluation and the opening
// overlay's mount, the host splash ("HARNESS / Loading plugins...") and the
// app's first frame would flash through. The factory body installs this
// fullscreen element in the same synchronous step as the critical styles and
// the controller lifts it right after the overlay's first frame. Hard
// capability limit: nothing a plugin runs can cover the host loading time
// before its own bundle is evaluated.
let earlyCover: HTMLDivElement | undefined;
let earlyCoverFallbackTimer: number | undefined;
/** Fail-safe: no code path may leave a permanent black screen behind. */
const EARLY_COVER_FALLBACK_MS = 4000;

/** Install the early fullscreen cover (factory evaluation time, synchronous,
 * idempotent). One z-level above .dsh-opening-root (2147483645) so the overlay
 * stays covered until the cover lifts deliberately. Inline styles on purpose:
 * no plugin stylesheet can be assumed evaluated yet. */
export function installEarlyCover(): void {
  if (earlyCover !== undefined) return;
  const cover = document.createElement("div");
  cover.className = "dsh-opening-early";
  cover.style.position = "fixed";
  cover.style.inset = "0";
  cover.style.zIndex = "2147483646";
  cover.style.backgroundColor = "#04050e";
  document.body.append(cover);
  earlyCover = cover;
  earlyCoverFallbackTimer = window.setTimeout(removeEarlyCover, EARLY_COVER_FALLBACK_MS);
}

/** Remove the early cover together with its fail-safe timer (idempotent; safe
 * to call from every load() endpoint). */
export function removeEarlyCover(): void {
  if (earlyCoverFallbackTimer !== undefined) {
    window.clearTimeout(earlyCoverFallbackTimer);
    earlyCoverFallbackTimer = undefined;
  }
  earlyCover?.remove();
  earlyCover = undefined;
}

/** Inject the full stylesheet; returns the disposer for ctx.effect. */
export function installStyles(): () => void {
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-opening-animation";
  tag.textContent = GLOBAL_STYLES;
  document.head.append(tag);
  return () => {
    tag.remove();
  };
}
