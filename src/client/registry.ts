// Animation registry: the single extension point. Adding a new animation is
// one engine module + one registration line here; the playback path and the
// settings UI are driven entirely by the registry (ADR-003).
// Engines never import React or anything under ui/; ui/ only sees these types.

import { glitchAnimation } from "./animations/glitch";
import { codeRainAnimation } from "./animations/code-rain";
import { gridRevealSpreadAnimation } from "./animations/grid-reveal-spread";
import { retroBootAnimation } from "./animations/retro-boot";
import { tapRevealAnimation } from "./animations/tap-reveal";
import { videoPlayerAnimation } from "./animations/video-player";
import { wipeRevealAnimation } from "./animations/wipe-reveal";

export type MediaKind = "image" | "video";

export interface ResolvedMedia {
  /** Object URL; lifecycle owned by the OverlayRunner (revoked after the transition). */
  url: string;
  kind: MediaKind;
  mime: string;
  name: string;
}

export interface AnimationRuntime {
  /** The engine's only canvas: the .dsh-opening-stage node. Engines must not touch anything outside it. */
  container: HTMLElement;
  media: ResolvedMedia;
  reducedMotion: boolean;
  /** Defaults merged with user paramOverrides; read-only. */
  params: Readonly<Record<string, unknown>>;
  /** Locale function bound to this plugin's namespace. */
  t: (key: string) => string;
  /** Engine calls this once its media is ready, lifting the load-timeout
   * watchdog — an engine with its own timeline must not be cut off at 8s.
   * The max-duration watchdog and the fail-open path stay in force. */
  markLoaded?: () => void;
  /** Natural completion. Idempotent; the host guards re-entry. */
  complete(): void;
  /** Fatal engine error → host runs the fail-open path. */
  fail(err: unknown): void;
}

export interface AnimationController {
  /** Start playing (includes waiting for image decode; failures go to runtime.fail). */
  start(): void;
  /** Jump synchronously to the final frame. Idempotent. Skip = freeze on the final frame; the host then runs the transition. */
  skip(): void;
  /** Optional viewport-change hook; engines may also observe resize themselves. */
  resize?(): void;
  /** Stop rafs, unbind listeners, release everything except DOM nodes and the object URL. */
  destroy(): void;
}

export interface ParamSpec {
  type: "number" | "enum" | "string";
  default: number | string;
  min?: number;
  max?: number;
  step?: number;
  options?: readonly string[];
}

export interface OpeningAnimation {
  /** "glitch" | "grid-reveal-spread" | "tap-reveal" | "video-player" | "wipe-reveal" | ... */
  id: string;
  /** Which media kind this animation consumes. */
  kind: MediaKind;
  /** Locale key inside this plugin's namespace, e.g. "anim.glitch.label". */
  labelKey: string;
  descriptionKey?: string;
  /** Advanced parameters; the settings AnimationPicker renders them from this schema. */
  paramsSchema?: Readonly<Record<string, ParamSpec>>;
  create(runtime: AnimationRuntime): AnimationController;
}

const animations = new Map<string, OpeningAnimation>();

/** Register an animation. Returns the unregister function (module self-registration only). */
export function registerAnimation(def: OpeningAnimation): () => void {
  animations.set(def.id, def);
  return () => {
    animations.delete(def.id);
  };
}

export function resolveAnimation(kind: MediaKind, id: string): OpeningAnimation | undefined {
  const def = animations.get(id);
  return def !== undefined && def.kind === kind ? def : undefined;
}

export function listAnimations(kind?: MediaKind): readonly OpeningAnimation[] {
  const all = [...animations.values()];
  return kind === undefined ? all : all.filter((def) => def.kind === kind);
}

/** Defaults merged with one animation's user overrides; numbers are clamped
 * to the schema range (free-form numeric inputs can exceed it). */
export function resolveAnimationParams(
  animation: OpeningAnimation,
  overrides?: Readonly<Record<string, number | string>>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
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

function clampToSpec(value: number, spec: ParamSpec): number {
  const min = spec.min ?? value;
  const max = spec.max ?? value;
  return Math.min(max, Math.max(min, value));
}

registerAnimation(glitchAnimation);
registerAnimation(codeRainAnimation);
registerAnimation(gridRevealSpreadAnimation);
registerAnimation(retroBootAnimation);
registerAnimation(tapRevealAnimation);
registerAnimation(videoPlayerAnimation);
registerAnimation(wipeRevealAnimation);
