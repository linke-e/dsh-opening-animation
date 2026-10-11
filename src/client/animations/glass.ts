// glass engine, effect-referenced from the "untitled" CodePen lockscreen
// (never its code or assets): the user's picture sits UNDERNEATH as the
// revealed layer; on top, the lock screen — its own background image
// (lockBg, an image URL; empty falls back to the user's picture) behind a
// frosted veil (dark tint + backdrop blur), a large clock and the date
// rendered once from the local clock at center, and a hint line pulsing at
// the bottom. The first click anywhere is consumed (stopPropagation, so the
// OverlayRunner's click-to-skip never sees it; Esc still skips) and slides
// the whole lock screen up — the reference's translateY(-100%) unlock
// gesture — revealing the user's picture, then runtime.complete() hands over
// to the transition. No self timeout: the overlay's image max-duration
// watchdog is the wait bound, exactly like tap-reveal. Reduced motion
// renders the still frame and completes at once. All visuals are plain CSS —
// the reference's icon/font CDNs are not used.

import type {
  AnimationController,
  AnimationRuntime,
  OpeningAnimation,
} from "../registry";
import { whenDecoded } from "../dominant-color";

const UNLOCK_MS = 600;
const TRANSITION_BACKSTOP_MS = 250;

/** "HH:MM" in 24-hour local time, zero-padded.
 * @param date - Local clock reading to format.
 * @returns Clock face text, e.g. "09:05".
 */
export function formatLockClock(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** Long local date for the lock screen, e.g. "Saturday, October 11".
 * @param date - Local clock reading to format.
 * @param locale - BCP 47 locale tag; undefined = the host's locale.
 * @returns Capitalized-per-locale date line.
 */
export function formatLockDate(date: Date, locale?: string): string {
  return date.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" });
}

export class GlassEngine implements AnimationController {
  private readonly runtime: AnimationRuntime;
  private readonly root: HTMLDivElement;
  private readonly screen: HTMLDivElement;
  private readonly under: HTMLImageElement;
  private readonly lockBg: HTMLImageElement;
  private lockBgFellBack = false;

  private backstopTimer = 0;
  private unlocking = false;
  private completed = false;
  private destroyed = false;

  private readonly onUnderLoad = (): void => {
    if (this.destroyed) return;
    this.runtime.markLoaded?.();
    whenDecoded(this.under, () => {
      if (this.destroyed || this.completed) return;
      if (this.runtime.reducedMotion) this.markCompleted();
    });
  };

  private readonly onUnderError = (): void => {
    if (!this.destroyed && !this.completed) this.runtime.fail(new Error("opening image failed to load"));
  };

  /* A broken lockBg URL is decoration, not media: fall back to the user's
     picture once instead of failing the opening. */
  private readonly onLockBgError = (): void => {
    if (this.destroyed || this.lockBgFellBack) return;
    this.lockBgFellBack = true;
    this.lockBg.src = this.runtime.media.url;
  };

  private readonly onClick = (event: MouseEvent): void => {
    // The first click unlocks instead of skipping the opening.
    event.stopPropagation();
    if (this.destroyed || this.completed || this.unlocking) return;
    this.unlock();
  };

  private readonly onTransitionEnd = (event: TransitionEvent): void => {
    if (event.propertyName !== "transform") return;
    this.markCompleted();
  };

  constructor(runtime: AnimationRuntime) {
    this.runtime = runtime;
    const p = runtime.params;
    const hintText = typeof p.hintText === "string" && p.hintText.length > 0
      ? p.hintText
      : runtime.t("anim.glass.hintDefault");
    const now = new Date();

    this.root = document.createElement("div");
    this.root.className = "dsh-opening-glass";
    if (runtime.reducedMotion) this.root.classList.add("dsh-opening-glass-reduced");

    this.under = document.createElement("img");
    this.under.className = "dsh-opening-glass-under";
    this.under.alt = "";

    this.screen = document.createElement("div");
    this.screen.className = "dsh-opening-glass-screen";
    this.lockBg = document.createElement("img");
    this.lockBg.className = "dsh-opening-glass-bg";
    this.lockBg.alt = "";
    const veil = document.createElement("div");
    veil.className = "dsh-opening-glass-veil";
    const content = document.createElement("div");
    content.className = "dsh-opening-glass-content";
    const clock = document.createElement("div");
    clock.className = "dsh-opening-glass-clock";
    clock.textContent = formatLockClock(now);
    const date = document.createElement("div");
    date.className = "dsh-opening-glass-date";
    date.textContent = formatLockDate(now);
    content.append(clock, date);
    const hint = document.createElement("div");
    hint.className = "dsh-opening-glass-hint";
    hint.textContent = hintText;
    this.screen.append(this.lockBg, veil, content, hint);
    this.root.append(this.under, this.screen);
    runtime.container.append(this.root);

    this.under.addEventListener("load", this.onUnderLoad);
    this.under.addEventListener("error", this.onUnderError);
    this.lockBg.addEventListener("error", this.onLockBgError);
    this.root.addEventListener("click", this.onClick);
    this.screen.addEventListener("transitionend", this.onTransitionEnd);
  }

  start(): void {
    this.under.src = this.runtime.media.url;
    this.lockBg.src = lockBgSource(this.runtime);
  }

  skip(): void {
    if (this.destroyed || this.completed) return;
    window.clearTimeout(this.backstopTimer);
    this.markCompleted();
  }

  destroy(): void {
    this.destroyed = true;
    window.clearTimeout(this.backstopTimer);
    this.under.removeEventListener("load", this.onUnderLoad);
    this.under.removeEventListener("error", this.onUnderError);
    this.lockBg.removeEventListener("error", this.onLockBgError);
    this.root.removeEventListener("click", this.onClick);
    this.screen.removeEventListener("transitionend", this.onTransitionEnd);
    this.root.remove();
  }

  /* Slide the lock screen up (the reference's unlock) and complete when the
     slide ends; the backstop guarantees completion if transitionend is lost. */
  private unlock(): void {
    this.unlocking = true;
    this.screen.classList.add("dsh-opening-glass-unlocked");
    this.backstopTimer = window.setTimeout(() => this.markCompleted(), UNLOCK_MS + TRANSITION_BACKSTOP_MS);
  }

  private markCompleted(): void {
    if (this.completed) return;
    this.completed = true;
    window.clearTimeout(this.backstopTimer);
    this.runtime.complete();
  }
}

/** The lock screen's background: the configured lockBg until it errors, then
 * the user's picture (start() has already applied the initial choice). */
function lockBgSource(runtime: AnimationRuntime): string {
  const p = runtime.params;
  return typeof p.lockBg === "string" && p.lockBg.length > 0 ? p.lockBg : runtime.media.url;
}

export const glassAnimation: OpeningAnimation = {
  id: "glass",
  kind: "image",
  labelKey: "anim.glass.label",
  descriptionKey: "anim.glass.desc",
  paramsSchema: {
    hintText: { type: "string", default: "" },
    lockBg: { type: "string", default: "" },
  },
  create: (runtime) => new GlassEngine(runtime),
};
