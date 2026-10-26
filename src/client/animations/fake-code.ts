// fake-code engine — a faithful DOM remake of the "Fake Code!" piece
// (CodePen by Harry Parton, MIT, https://codepen.io/hparton/pen/abXKmG): a
// fake source snippet types itself out line by line, character by character
// — each line appears lineMs (default 100 ms) after the previous one, its
// characters land one typeMs (default 5 ms) apart, and the view keeps
// scrolled to the bottom like a live terminal — in the reference's white
// letter-spaced sans over a near-black ground. The user's picture or video
// sits behind the text as the backdrop (cover or contain), dimmed by the
// dim param so the white text stays readable; the reference's plain #111
// ground is what shows before the backdrop arrives and with dim = 1. The
// text param (split on /n exactly like the reference's data-text attribute)
// overrides the built-in snippet; blank falls back to it — the built-in one
// is the reference's Linux-kernel groups_alloc snippet (first of its three
// repeated passes) plus its echo('Hello World') sign-off. durationMs owns
// the hand-over: typing may still be running when the screen freezes on
// whatever has been typed; skip() freezes the same way. The video backdrop
// is a pure backdrop with the constructivism1 semantics: muted autoplay
// (playsInline, loop per param), ended never completes the engine, volume >
// 0 probes an unmute on the first playing event and falls back to silent
// playback; a failing backdrop fails the run.

import type {
  AnimationController,
  AnimationRuntime,
  OpeningAnimation,
} from "../registry";

/** The reference's data-text, first pass + sign-off, one array entry per /n
 * line (verbatim content, indentation included). */
export const TEXT_LINES: ReadonlyArray<string> = [
  "struct group_info init_groups = { .usage = ATOMIC_INIT(2) };",
  " ",
  "struct group_info *groups_alloc(int gidsetsize){",
  "    struct group_info *group_info;",
  "    int nblocks;",
  "    int i;",
  " ",
  "    nblocks = (gidsetsize + NGROUPS_PER_BLOCK - 1) / NGROUPS_PER_BLOCK;",
  "    /* Make sure we always allocate at least one indirect block pointer */",
  "    nblocks = nblocks ? : 1;",
  "    group_info = kmalloc(sizeof(*group_info) + nblocks*sizeof(gid_t *), GFP_USER);",
  "    if (!group_info)",
  "        return NULL;",
  " ",
  "    group_info->ngroups = gidsetsize;",
  "    group_info->nblocks = nblocks;",
  "    atomic_set(&group_info->usage, 1);",
  " ",
  "    if (gidsetsize <= NGROUPS_SMALL)",
  "        group_info->blocks[0] = group_info->small_block;",
  "    else {",
  "        for (i = 0; i < nblocks; i++) {",
  "            gid_t *b;",
  "            b = (void *)__get_free_page(GFP_USER);",
  "            if (!b)",
  "                goto out_undo_partial_alloc;",
  "            group_info->blocks[i] = b;",
  "        }",
  "    }",
  "    return group_info;",
  " ",
  "out_undo_partial_alloc:",
  "    while (--i >= 0) {",
  "        free_page((unsigned long)group_info->blocks[i]);",
  "    }",
  "    kfree(group_info);",
  "    return NULL;",
  "}",
  " ",
  " ",
  "EXPORT_SYMBOL(groups_alloc);",
  " ",
  " ",
  "echo('Hello World');",
];

const STYLE = `
.dsh-opening-fc{position:absolute;inset:0;overflow:hidden;background:#111}
.dsh-opening-fc *{box-sizing:border-box}
.dsh-opening-fc-media{position:absolute;inset:0;width:100%;height:100%}
.dsh-opening-fc-dim{position:absolute;inset:0;background:rgba(0,0,0,0.45)}
.dsh-opening-fc-scroll{position:absolute;inset:0;overflow:hidden}
.dsh-opening-fc-text{margin:0;padding:20px 24px 45vh;font-family:'Source Sans Pro','Segoe UI',system-ui,sans-serif;
  font-size:14px;letter-spacing:1.5px;color:#fff;white-space:pre-wrap;word-break:break-all}
.dsh-opening-fc-line{display:block;min-height:1.5em}
`;

/** Split the text param the reference's way: real newlines (from the
 * multi-line editor) or the reference's literal /n separators; blank lines in
 * the reference data are single spaces, so a blank result means "unset". */
export function fakeCodeLines(text: string): string[] {
  const lines = text.split(/\n|\/n/);
  return lines.some((line) => line.trim().length > 0) ? lines : [...TEXT_LINES];
}

function div(className: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = className;
  return el;
}

export class FakeCodeEngine implements AnimationController {
  private readonly runtime: AnimationRuntime;
  private readonly root: HTMLDivElement;
  private readonly style: HTMLStyleElement;
  private readonly scroll: HTMLDivElement;
  private readonly textEl: HTMLDivElement;
  private readonly lineEls: HTMLSpanElement[] = [];
  private readonly media: HTMLImageElement | HTMLVideoElement;
  private readonly lines: string[];
  private readonly durationMs: number;
  private readonly typeMs: number;
  private readonly lineMs: number;
  private readonly dim: number;
  private readonly fit: "cover" | "contain";
  /** Video backdrop only: the loop param, "once" keeps the final frame. */
  private readonly videoLoop: boolean;
  /** Video backdrop only: configured loudness 0-1; 0 keeps the plain silent behavior. */
  private readonly targetVolume: number;

  /** One timer id per pending line start, plus one per in-flight character
   * step; destroy/skip clear every id so no span appears afterwards. */
  private timers: number[] = [];
  private completeTimer = 0;
  private completed = false;
  private destroyed = false;
  /** Video backdrop only: the unmute probe has run (silent fallback is final). */
  private unmuted = false;

  private readonly onImgLoad = (): void => {
    if (this.destroyed || this.completed) return;
    this.runtime.markLoaded?.();
  };

  private readonly onVideoReady = (): void => {
    if (this.destroyed || this.completed) return;
    this.runtime.markLoaded?.();
  };

  private readonly onMediaError = (): void => {
    if (this.destroyed || this.completed) return;
    window.clearTimeout(this.completeTimer);
    this.runtime.fail(new Error("opening media failed to load"));
  };

  private readonly onPlaying = (): void => {
    if (!(this.media instanceof HTMLVideoElement)) return;
    if (this.destroyed || this.completed || this.unmuted) return;
    if (this.targetVolume <= 0) return; // volume 0 keeps the plain silent behavior
    // Behavior probe (video-player's, simplified — no pill here): always try
    // to unmute. A browser that allows audible autoplay leaves it audible;
    // one that does not pauses the video — synchronously or via the pause
    // listener — and we fall back to muted playback so the backdrop never
    // freezes.
    this.unmuted = true;
    this.media.muted = false;
    this.media.volume = this.targetVolume;
    if (this.media.paused) this.fallBackToSilent();
  };

  private readonly onPause = (): void => {
    if (!(this.media instanceof HTMLVideoElement)) return;
    // A pause arriving after the unmute attempt is the autoplay policy
    // rejecting audible playback. A natural end also pauses first, but the
    // video is a backdrop here: ended leaves it frozen on its final frame
    // and never completes this engine (durationMs owns the hand-over).
    if (this.destroyed || this.completed || !this.unmuted || this.media.ended) return;
    this.fallBackToSilent();
  };

  constructor(runtime: AnimationRuntime) {
    this.runtime = runtime;
    const p = runtime.params;
    this.durationMs = FakeCodeEngine.clamp(
      FakeCodeEngine.number(p.durationMs, 8000),
      3000,
      30_000,
    );
    this.typeMs = FakeCodeEngine.clamp(FakeCodeEngine.number(p.typeMs, 5), 1, 50);
    this.lineMs = FakeCodeEngine.clamp(FakeCodeEngine.number(p.lineMs, 100), 0, 500);
    this.dim = FakeCodeEngine.clamp(FakeCodeEngine.number(p.dim, 0.45), 0, 1);
    this.fit = p.mediaFit === "contain" ? "contain" : "cover";
    this.videoLoop = p.loop !== "once";
    // HTMLMediaElement.volume lives in 0-1; the param is 0-100.
    this.targetVolume = FakeCodeEngine.clamp(FakeCodeEngine.number(p.volume, 0), 0, 100) / 100;
    const text = typeof p.text === "string" ? p.text : "";
    this.lines = fakeCodeLines(text);

    this.root = div("dsh-opening-fc");
    this.style = document.createElement("style");
    this.style.textContent = STYLE;
    this.root.append(this.style);

    if (runtime.media.kind === "video") {
      const video = document.createElement("video");
      video.className = "dsh-opening-fc-media";
      video.autoplay = true;
      video.muted = true; // playback always starts muted; the probe may unmute
      video.playsInline = true;
      video.loop = this.videoLoop;
      this.media = video;
    } else {
      const img = document.createElement("img");
      img.className = "dsh-opening-fc-media";
      img.alt = "";
      this.media = img;
    }
    this.media.style.objectFit = this.fit;
    const dimEl = div("dsh-opening-fc-dim");
    dimEl.style.background = `rgba(0,0,0,${this.dim})`;
    this.scroll = div("dsh-opening-fc-scroll");
    this.textEl = div("dsh-opening-fc-text");
    this.scroll.append(this.textEl);
    this.root.append(this.media, dimEl, this.scroll);
    runtime.container.append(this.root);

    // The line spans exist from the start (empty, block-level — the blank
    // lines keep their height); typing only fills their textContent, so the
    // freeze states need no style switch.
    for (const line of this.lines) {
      const el = document.createElement("span");
      el.className = "dsh-opening-fc-line";
      this.lineEls.push(el);
      this.textEl.append(el);
    }
  }

  start(): void {
    if (this.destroyed || this.completed) return;
    if (this.media instanceof HTMLImageElement) {
      this.media.addEventListener("load", this.onImgLoad);
      this.media.addEventListener("error", this.onMediaError);
    } else {
      this.media.addEventListener("canplay", this.onVideoReady);
      this.media.addEventListener("error", this.onMediaError);
      this.media.addEventListener("playing", this.onPlaying);
      this.media.addEventListener("pause", this.onPause);
    }
    this.media.src = this.runtime.media.url;
    if (this.media instanceof HTMLVideoElement) this.playWithRetry(1);

    // The reference's timing: line index * 100 ms, character index * 5 ms.
    this.lines.forEach((_, index) => {
      this.timers.push(window.setTimeout(() => this.typeLine(index), index * this.lineMs));
    });
    this.completeTimer = window.setTimeout(() => this.markCompleted(), this.durationMs);
  }

  skip(): void {
    if (this.destroyed || this.completed) return;
    this.clearTimers();
    // Freeze on the typed-so-far frame: pause the video backdrop so it does
    // not keep playing (or sounding) through the hand-off transition.
    if (this.media instanceof HTMLVideoElement) {
      try {
        this.media.pause();
      } catch {
        // pausing an unstarted video is harmless
      }
    }
    this.markCompleted();
  }

  destroy(): void {
    this.destroyed = true;
    this.clearTimers();
    window.clearTimeout(this.completeTimer);
    if (this.media instanceof HTMLImageElement) {
      this.media.removeEventListener("load", this.onImgLoad);
      this.media.removeEventListener("error", this.onMediaError);
    } else {
      this.media.removeEventListener("canplay", this.onVideoReady);
      this.media.removeEventListener("error", this.onMediaError);
      this.media.removeEventListener("playing", this.onPlaying);
      this.media.removeEventListener("pause", this.onPause);
      try {
        this.media.pause();
        this.media.removeAttribute("src");
        this.media.load();
      } catch {
        // teardown best-effort
      }
    }
    this.root.remove();
  }

  /** The reference's typeLine: append one character per typeMs tick and keep
   * the view scrolled to the bottom like a live terminal. */
  private typeLine(index: number): void {
    if (this.destroyed || this.completed) return;
    const line = this.lines[index];
    const el = this.lineEls[index];
    if (line === undefined || el === undefined) return;
    let chunk = 0;
    const step = (): void => {
      if (this.destroyed || this.completed) return;
      if (chunk >= line.length) return;
      chunk += 1;
      el.textContent = line.slice(0, chunk);
      this.scroll.scrollTop = this.scroll.scrollHeight;
      this.timers.push(window.setTimeout(step, this.typeMs));
    };
    step();
  }

  private clearTimers(): void {
    for (const id of this.timers) window.clearTimeout(id);
    this.timers = [];
  }

  private markCompleted(): void {
    if (this.completed) return;
    this.completed = true;
    this.clearTimers();
    window.clearTimeout(this.completeTimer);
    this.runtime.complete();
  }

  private fallBackToSilent(): void {
    if (!(this.media instanceof HTMLVideoElement)) return;
    // Back to muted playback (always policy-allowed); unmuted stays true so
    // a later playing event never re-probes and the states cannot loop.
    this.media.muted = true;
    void this.media.play().catch((err: unknown) => {
      console.debug("[dsh-opening-animation] fake-code silent-fallback play rejected", err);
    });
  }

  private playWithRetry(retries: number): void {
    if (this.destroyed || this.completed) return;
    if (!(this.media instanceof HTMLVideoElement)) return;
    void this.media.play().catch(() => {
      if (this.destroyed || this.completed) return;
      if (retries <= 0) {
        this.runtime.fail(new Error("video play() rejected repeatedly"));
        return;
      }
      window.setTimeout(() => {
        this.playWithRetry(retries - 1);
      }, 150);
    });
  }

  private static number(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }

  private static clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}

export const fakeCodeAnimation: OpeningAnimation = {
  id: "fake-code",
  kind: "image",
  labelKey: "anim.fake-code.label",
  descriptionKey: "anim.fake-code.desc",
  paramsSchema: {
    durationMs: { type: "number", default: 8000, min: 3000, max: 30000, step: 500 },
    typeMs: { type: "number", default: 5, min: 1, max: 50, step: 1 },
    lineMs: { type: "number", default: 100, min: 0, max: 500, step: 10 },
    dim: { type: "number", default: 0.45, min: 0, max: 1, step: 0.05 },
    mediaFit: { type: "enum", default: "cover", options: ["cover", "contain"] },
    text: { type: "string", default: "", multiline: true },
  },
  create: (runtime) => new FakeCodeEngine(runtime),
};

export const fakeCodeVideoAnimation: OpeningAnimation = {
  id: "fake-code-video",
  kind: "video",
  labelKey: "anim.fake-code.label",
  descriptionKey: "anim.fake-code.desc",
  paramsSchema: {
    durationMs: { type: "number", default: 8000, min: 3000, max: 30000, step: 500 },
    typeMs: { type: "number", default: 5, min: 1, max: 50, step: 1 },
    lineMs: { type: "number", default: 100, min: 0, max: 500, step: 10 },
    dim: { type: "number", default: 0.45, min: 0, max: 1, step: 0.05 },
    mediaFit: { type: "enum", default: "cover", options: ["cover", "contain"] },
    text: { type: "string", default: "", multiline: true },
    loop: { type: "enum", default: "loop", options: ["loop", "once"] },
    volume: { type: "number", default: 0, min: 0, max: 100, step: 5 },
  },
  create: (runtime) => new FakeCodeEngine(runtime),
};
