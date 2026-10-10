// tap-reveal engine — the redone "grid reveal": the grid is gone. The backdrop
// is the picture's dominant color while a hint invites the click; the first
// click (anywhere) renders the picture with the vendored material-vcard
// animation: a clip-path circle expanding from the click point, with the
// picture easing from a slight zoom like the card's columns sliding in.
// The engine swallows that first click (stopPropagation) so the OverlayRunner's
// click-to-skip never fires for it; Esc still skips. transitionend (with a
// timeout backstop) calls runtime.complete() and the transition fades the UI in.
// Reduced motion renders the full picture immediately.

import type {
  AnimationController,
  AnimationRuntime,
  OpeningAnimation,
} from "../registry";
import { extractDominantColor, whenDecoded } from "../dominant-color";

/** Guard margin beyond the farthest corner so the circle always clears the screen. */
const RADIUS_PAD = 8;
const TRANSITION_BACKSTOP_MS = 150;

export class TapRevealEngine implements AnimationController {
  private readonly runtime: AnimationRuntime;
  private readonly root: HTMLDivElement;
  private readonly img: HTMLImageElement;
  private readonly hint: HTMLDivElement;
  private readonly revealMs: number;

  private completed = false;
  private destroyed = false;
  private revealStarted = false;
  private backstopTimer = 0;

  private readonly onImgLoad = (): void => {
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

  private readonly onImgError = (): void => {
    if (!this.destroyed && !this.completed) this.runtime.fail(new Error("opening image failed to load"));
  };

  private readonly onClick = (event: MouseEvent): void => {
    // The first click reveals the picture instead of skipping the opening.
    event.stopPropagation();
    if (this.destroyed || this.completed || this.revealStarted) return;
    if (!(this.img.complete && this.img.naturalWidth > 0)) return;
    this.startReveal(event.clientX, event.clientY);
  };

  constructor(runtime: AnimationRuntime) {
    this.runtime = runtime;
    const p = runtime.params;
    this.revealMs = TapRevealEngine.number(p.revealMs, 900);

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

  start(): void {
    this.img.src = this.runtime.media.url;
  }

  skip(): void {
    if (this.destroyed || this.completed) return;
    window.clearTimeout(this.backstopTimer);
    if (this.img.complete && this.img.naturalWidth > 0) this.showFull();
    this.markCompleted();
  }

  destroy(): void {
    this.destroyed = true;
    window.clearTimeout(this.backstopTimer);
    this.img.removeEventListener("load", this.onImgLoad);
    this.img.removeEventListener("error", this.onImgError);
    this.root.removeEventListener("click", this.onClick);
    this.root.remove();
  }

  private markCompleted(): void {
    if (this.completed) return;
    this.completed = true;
    this.runtime.complete();
  }

  /* material-vcard reveal: clip-path circle from the click point + slight zoom-out. */
  private startReveal(clientX: number, clientY: number): void {
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
    void this.img.offsetWidth; // force reflow so the transition starts from the zero circle
    this.img.classList.add("dsh-opening-tap-run");
    this.img.style.clipPath = to;
    this.img.style.transform = "scale(1)";

    // transitionend can be lost (tab hidden, interrupted style); a backstop
    // timer guarantees the completion path fires exactly once.
    this.backstopTimer = window.setTimeout(() => {
      this.showFull();
      this.markCompleted();
    }, Math.round(this.revealMs) + TRANSITION_BACKSTOP_MS);
  }

  /* Fast fade of the center hint; the base transition (600ms) is too slow
     once the reveal has started. */
  private dismissHint(): void {
    this.hint.classList.remove("dsh-opening-hint-show");
    this.hint.classList.add("dsh-opening-hint-hide");
  }

  /* Freeze on the full picture (skip / reduced motion / reveal settled). */
  private showFull(): void {
    if (!(this.img.complete && this.img.naturalWidth > 0)) return;
    this.img.classList.remove("dsh-opening-tap-run");
    this.img.style.clipPath = "none";
    this.img.style.transform = "none";
    this.dismissHint();
  }

  private static number(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }
}

export const tapRevealAnimation: OpeningAnimation = {
  id: "tap-reveal",
  kind: "image",
  labelKey: "anim.tap-reveal.label",
  descriptionKey: "anim.tap-reveal.desc",
  paramsSchema: {
    revealMs: { type: "number", default: 900, min: 400, max: 3000, step: 100 },
  },
  create: (runtime) => new TapRevealEngine(runtime),
};
