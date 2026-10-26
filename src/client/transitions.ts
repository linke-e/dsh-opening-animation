// Transition presets: how the overlay hands the screen back to #root.
// Unknown ids fail loud (console.warn) then explicitly fall back to cross-fade.

import { setupGlassWipe } from "./glass-wipe";
import type { ResolvedMedia } from "./registry";

/** The cross-fade preset's exit class, also the teardown fallback for a
 * custom transition whose setup failed or whose stack broke mid-transition. */
export const CROSS_FADE_EXIT_CLASS = "dsh-opening-exit-cross-fade";

/** Handed to a preset's setup hook once, when the transition begins. */
export interface TransitionSetupContext {
  /** The overlay root (.dsh-opening-root); a custom transition appends its
   * nodes here and may restyle the root itself (e.g. clear its backdrop). */
  root: HTMLDivElement;
  /** The media the opening just played; a custom transition's fallback
   * content (the object URL stays owned by the OverlayRunner). */
  media: ResolvedMedia;
  /** The user's transition speed multiplier (0.5–2). */
  scale: number;
}

export interface TransitionSetupResult {
  /** Base (scale = 1) durations overriding the preset's static fields; the
   * overlay multiplies them by scale, so a setup styles its CSS with scaled
   * values while returning the same unscaled bases here. */
  exitMs?: number;
  enterDelayMs?: number;
  enterMs?: number;
  totalMs?: number;
  /** Removes custom nodes, revokes self-created object URLs and clears
   * timers; called exactly once from the overlay's destroy. */
  dispose?: () => void;
}

export interface TransitionPreset {
  id: string;
  labelKey: string;
  /** Overlay exit duration in ms. */
  exitMs: number;
  /** Wait before un-pending #root (dip-to-bg sequences the two phases). */
  enterDelayMs: number;
  /** #root enter duration in ms. */
  enterMs: number;
  /** Class added to .dsh-opening-root; CSS performs the exit animation. */
  exitClass: string;
  /** Initial #root transform during the enter animation (restored afterwards). */
  enterTransform?: string;
  /** Base (scale = 1) duration from the transition's start to its very last
   * visual change — the budget the image max-duration watchdog reserves for
   * the transition (it fires at maxDurationMs − budget), and when the overlay
   * tears itself down. For the CSS presets the phases run back to back, so
   * the exitMs + enterDelayMs + enterMs sum is the budget; a preset whose
   * setup already folds the enter window into its exitMs (glass-wipe) must
   * declare the shorter totalMs explicitly. */
  totalMs?: number;
  /** Video openings only: fire the transition while the stage's main video
   * still has this much (base ms) left to play, instead of waiting for its
   * ended event. The video keeps playing underneath the transition, so its
   * final frame lands right as the transition's reveal finishes (glass-wipe:
   * the wipe completes on the video's last frame). Main video = a direct
   * video child of the stage (the video-player engine's element); engines
   * whose completion is driven by their own duration parameter keep their
   * timing. 0/absent = the transition waits for the video to end. */
  videoHandoffMs?: number;
  /** Optional custom-transition hook: build the transition's DOM and return
   * duration overrides plus a disposer. A thrown setup degrades the preset
   * to a cross-fade exit (fail-open); CSS presets leave it unset. */
  setup?: (context: TransitionSetupContext) => TransitionSetupResult | void;
}

const presets = new Map<string, TransitionPreset>();

export function registerTransition(preset: TransitionPreset): () => void {
  presets.set(preset.id, preset);
  return () => {
    presets.delete(preset.id);
  };
}

export function listTransitions(): readonly TransitionPreset[] {
  return [...presets.values()];
}

export function getTransition(id: string): TransitionPreset {
  const preset = presets.get(id);
  if (preset !== undefined) return preset;
  console.warn(`[dsh-opening-animation] unknown transition "${id}", falling back to cross-fade`);
  return presets.get("cross-fade") as TransitionPreset;
}

registerTransition({
  id: "cross-fade",
  labelKey: "trans.cross-fade.label",
  exitMs: 700,
  enterDelayMs: 0,
  enterMs: 700,
  exitClass: CROSS_FADE_EXIT_CLASS,
});

registerTransition({
  id: "dip-to-bg",
  labelKey: "trans.dip-to-bg.label",
  exitMs: 450,
  enterDelayMs: 250,
  enterMs: 600,
  exitClass: "dsh-opening-exit-dip-to-bg",
});

registerTransition({
  id: "zoom-fade",
  labelKey: "trans.zoom-fade.label",
  exitMs: 650,
  enterDelayMs: 0,
  enterMs: 650,
  exitClass: "dsh-opening-exit-zoom-fade",
  enterTransform: "translateY(8px)",
});

registerTransition({
  id: "glass-wipe",
  labelKey: "trans.glass-wipe.label",
  // Three phases: blur-in covers the last opening frame with a rising frost,
  // the wipe erases it from the viewport center, the settle fades the stack
  // over the revealed UI. The setup builds that stack; the reveal window
  // (enterDelayMs/enterMs) runs inside these phases, so the total equals
  // exitMs — that total is the budget the max-duration watchdog reserves and
  // the moment the overlay tears itself down.
  exitMs: 2750,
  enterDelayMs: 900,
  enterMs: 1850,
  totalMs: 2750,
  // The wipe must complete on the video's final frame: hand off one
  // blur+wipe window before the end (plus a small margin so the video lands
  // on its last frame at, not after, the wipe's end), while the video keeps
  // playing under the frost.
  videoHandoffMs: 2400,
  exitClass: "dsh-opening-exit-glass-wipe",
  setup: setupGlassWipe,
});
