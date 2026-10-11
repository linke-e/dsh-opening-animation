// glitch-404 engine — a faithful remake of the "404glitched-out" CodePen
// piece (never its code, fonts, or assets), with three deviations: the black
// backdrop is the user's picture, an adjustable dark mask (mask) keeps the
// strobe lines readable over colorful pictures, and the run ends in a
// black-out. Everything else follows the reference: the colored source-code
// error block sits center-left, its container AND the info line snap through
// the noise-3 warp (momentary scaleY(4) / scaleX(10) with a 60° turn) on a
// 1 s beat, and two big strobe lines — "error 404" top-right-of-center,
// "file not found" lower-left — each flicker as a ghost PAIR through the
// noise-1 / noise-2 keyframes (mostly invisible; while visible the two
// copies offset in opposite directions, and the info pair additionally sits
// 50 px apart like the reference's right:100px vs right:0). Text color
// defaults to the inverse of the picture's dominant color (extracted after
// decode; falls back to white when the picture reads near-black — the
// reference's own ground); textColor pins an explicit color. The black veil
// then covers the screen and runtime.complete() hands over to the
// transition. Reduced motion goes straight to the black final frame.
// The reference's texts are fixed content here (engine constants), not
// parameters; its OCR-A/Gilda Display fonts are approximated with the
// system monospace stack.

import type {
  AnimationController,
  AnimationRuntime,
  OpeningAnimation,
} from "../registry";
import { extractDominantColor, whenDecoded } from "../dominant-color";

const MAIN_TEXT = "error 404";
const SUB_TEXT = "file not found";

/** Black-out length plus the completion backstop margin. */
const FADE_MS = 900;
const FADE_BACKSTOP_MS = 250;

/** The reference's source-code error block, verbatim (its line breaks,
 * indentation and spacing included); colored via the span classes styled in
 * styles.ts. Written with innerHTML once — a static engine constant. */
const CODE_BLOCK = String.raw`<pre><code><span class="dsh-green">&lt;!</span><span>DOCTYPE html</span><span class="dsh-green">&gt;</span>
<span class="dsh-orange">&lt;html&gt;</span>
    <span class="dsh-orange">&lt;style&gt;</span>
   * {
		        <span class="dsh-green">everything</span>:<span class="dsh-blue">awesome</span>;
}
     <span class="dsh-orange">&lt;/style&gt;</span>
 <span class="dsh-orange">&lt;body&gt;</span>
              ERROR 404!
				FILE NOT FOUND!
				<span class="dsh-comment">&lt;!--The file you are looking for,
					is not where you think it is.--&gt;
		</span>
 <span class="dsh-orange"></span>
</code></pre><span class="dsh-orange">&nbsp;&lt;/body&gt;</span><br><span class="dsh-orange">&lt;/html&gt;</span>`;

/** Invert an `rgb(r, g, b)` or `#rrggbb` color; unparseable input yields
 * white (the reference's original text color).
 *
 * @param color - Color as produced by extractDominantColor or a CSS color.
 * @returns The inverted color as an `rgb()` string.
 */
export function invertColor(color: string): string {
  const rgb = /^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$/.exec(color);
  if (rgb !== null) {
    const r = Number(rgb[1]);
    const g = Number(rgb[2]);
    const b = Number(rgb[3]);
    return `rgb(${255 - r}, ${255 - g}, ${255 - b})`;
  }
  const hex = /^#([0-9a-fA-F]{6})$/.exec(color);
  if (hex !== null) {
    const value = Number.parseInt(hex[1]!, 16);
    return `rgb(${255 - ((value >> 16) & 0xff)}, ${255 - ((value >> 8) & 0xff)}, ${255 - (value & 0xff)})`;
  }
  return "#ffffff";
}

export class Glitch404Engine implements AnimationController {
  private readonly root: HTMLDivElement;
  private readonly img: HTMLImageElement;
  private readonly fade: HTMLDivElement;
  private readonly durationMs: number;
  private readonly textColor: string;

  private outroTimer = 0;
  private completeTimer = 0;
  private completed = false;
  private destroyed = false;

  private readonly onImgLoad = (): void => {
    if (this.destroyed) return;
    this.runtime.markLoaded?.();
    whenDecoded(this.img, () => {
      if (this.destroyed || this.completed) return;
      if (this.textColor === "") {
        // The strobe lines and the code block's plain text read the text
        // color through this variable; the four colored spans stay as-is.
        this.root.style.setProperty("--dsh-g404-text", invertColor(extractDominantColor(this.img)));
      }
      if (this.runtime.reducedMotion) {
        this.renderFinal();
        this.markCompleted();
        return;
      }
      // The run class starts every reference animation at once: the strobe
      // pairs, and the noise-3 warp on the error block and the info line.
      this.root.classList.add("dsh-opening-g404-run");
      this.outroTimer = window.setTimeout(() => this.startOutro(), Math.max(0, this.durationMs - FADE_MS));
    });
  };

  private readonly onImgError = (): void => {
    if (!this.destroyed && !this.completed) this.runtime.fail(new Error("opening image failed to load"));
  };

  private readonly runtime: AnimationRuntime;

  constructor(runtime: AnimationRuntime) {
    this.runtime = runtime;
    const p = runtime.params;
    this.durationMs = Glitch404Engine.number(p.durationMs, 6000);
    this.textColor = typeof p.textColor === "string" && p.textColor.length > 0 ? p.textColor : "";

    this.root = document.createElement("div");
    this.root.className = "dsh-opening-g404";
    if (this.textColor !== "") this.root.style.setProperty("--dsh-g404-text", this.textColor);
    this.img = document.createElement("img");
    this.img.className = "dsh-opening-g404-bg";
    this.img.alt = "";
    const mask = document.createElement("div");
    mask.className = "dsh-opening-g404-mask";
    mask.style.opacity = String(Glitch404Engine.clamp01(Glitch404Engine.number(p.mask, 0.5)));

    // .error: the code block container — the reference warps it with noise-3.
    const error = document.createElement("div");
    error.className = "dsh-opening-g404-error";
    const wrap = document.createElement("div");
    wrap.className = "dsh-opening-g404-wrap";
    const code = document.createElement("div");
    code.className = "dsh-opening-g404-code";
    code.innerHTML = CODE_BLOCK;
    wrap.append(code);

    // .info: the second strobe line's positioning box (warped as well).
    const info = document.createElement("span");
    info.className = "dsh-opening-g404-info";
    info.append(
      Glitch404Engine.ghost(SUB_TEXT, "dsh-opening-g404-sub-ghost-a", "dsh-opening-g404-ghost-a"),
      Glitch404Engine.ghost(SUB_TEXT, "dsh-opening-g404-sub-ghost-b", "dsh-opening-g404-ghost-b"),
    );
    error.append(wrap, info);

    // body:before/after counterpart: the main strobe line's ghost pair.
    const main = document.createElement("div");
    main.className = "dsh-opening-g404-main";
    main.append(
      Glitch404Engine.ghost(MAIN_TEXT, "dsh-opening-g404-ghost-a"),
      Glitch404Engine.ghost(MAIN_TEXT, "dsh-opening-g404-ghost-b"),
    );

    this.fade = document.createElement("div");
    this.fade.className = "dsh-opening-g404-fade";
    this.root.append(this.img, mask, error, main, this.fade);
    runtime.container.append(this.root);

    this.img.addEventListener("load", this.onImgLoad);
    this.img.addEventListener("error", this.onImgError);
  }

  /* One strobe copy; the pair is animated by noise-1/noise-2 respectively. */
  private static ghost(text: string, ...classes: string[]): HTMLSpanElement {
    const el = document.createElement("span");
    el.className = ["dsh-opening-g404-ghost", ...classes].join(" ");
    el.textContent = text;
    return el;
  }

  start(): void {
    this.img.src = this.runtime.media.url;
  }

  skip(): void {
    if (this.destroyed || this.completed) return;
    this.stopTimers();
    this.renderFinal();
    this.markCompleted();
  }

  destroy(): void {
    this.destroyed = true;
    this.stopTimers();
    this.img.removeEventListener("load", this.onImgLoad);
    this.img.removeEventListener("error", this.onImgError);
    this.root.remove();
  }

  private markCompleted(): void {
    if (this.completed) return;
    this.completed = true;
    this.runtime.complete();
  }

  private stopTimers(): void {
    window.clearTimeout(this.outroTimer);
    window.clearTimeout(this.completeTimer);
  }

  /* Finale: the black veil covers the screen (CSS transition), then completion. */
  private startOutro(): void {
    if (this.destroyed || this.completed) return;
    this.renderFinal();
    this.completeTimer = window.setTimeout(() => this.markCompleted(), FADE_MS + FADE_BACKSTOP_MS);
  }

  /* Freeze on the black final frame (skip / reduced motion / natural end). */
  private renderFinal(): void {
    this.root.classList.add("dsh-opening-g404-outro");
    this.fade.style.opacity = "1";
  }

  private static number(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }

  private static clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
  }
}

export const glitch404Animation: OpeningAnimation = {
  id: "glitch-404",
  kind: "image",
  labelKey: "anim.glitch-404.label",
  descriptionKey: "anim.glitch-404.desc",
  paramsSchema: {
    durationMs: { type: "number", default: 6000, min: 3000, max: 60_000, step: 500 },
    mask: { type: "number", default: 0.5, min: 0, max: 1, step: 0.05 },
    textColor: { type: "string", default: "" },
  },
  create: (runtime) => new Glitch404Engine(runtime),
};
