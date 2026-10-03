// Transition presets: how the overlay hands the screen back to #root.
// Unknown ids fail loud (console.warn) then explicitly fall back to cross-fade.

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
  exitClass: "dsh-opening-exit-cross-fade",
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
