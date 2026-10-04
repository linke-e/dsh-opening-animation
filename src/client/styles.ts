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

/** Remove the critical rule together with the pending attribute (zero-trace teardown). */
export function removeCriticalStyles(): void {
  criticalTag?.remove();
  criticalTag = undefined;
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
