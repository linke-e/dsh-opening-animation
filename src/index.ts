// Host entry: deliberately dependency-free — no host-package imports (not even
// type-only ones) and no npm dependencies — because a broken dsh core boot
// must never take this plugin down with it. All behavior lives in the web
// client bundle (lib/client.js) except one thing only this side can do early
// enough: contributing an inline head script to the served boot HTML, which
// covers the official splash ("HARNESS / Loading plugins...") from the HTML
// parsing stage instead of from bundle evaluation time. The storage key
// constant is imported from the shared pure-constants client module so the
// host script and the client bundle can never drift apart on the key.

import { PREFS_KEY } from "./client/preferences";

export const name = "dsh-opening-animation";

/** Structural view of the host's script-variant index-injection row (the
 * `kind: 'script'` member of webserver's IndexInjection union). Matched
 * structurally on purpose: importing the host package, even type-only, would
 * break the zero-dependency red line. */
export interface EarlyInjectionRow {
  kind: "script";
  placement: "head";
  text: string;
}

/** Minimal structural view of the patch-plugin host context: only the event
 * subscription surface this plugin needs. */
export interface HostContext {
  on(event: string, listener: (table: EarlyInjectionRow[]) => unknown): unknown;
}

/** Inline head script rendered into every served index.html, ahead of every
 * document script (head rows render right after the opening <head> tag):
 * while the HTML parser runs it reads the persisted preferences and, when an
 * opening will play, sets the pending attribute and installs the same two
 * rules the client's critical styles carry — the official BootPage splash and
 * the white document background are invisible from the first painted frame.
 * Contract: the whole body is one try/catch (fail-open — any storage or
 * parser problem leaves the official splash untouched), style creation is
 * idempotent (tagged style[data-dsh-opening-early='1']), and the text never
 * contains "</script" (a webserver row constraint). Teardown stays owned by
 * the client side: removeCriticalStyles() removes these tags together with
 * the pending state on every controller/overlay teardown endpoint. */
export const EARLY_SCRIPT = `
try {
  var prefs = JSON.parse(localStorage.getItem(${JSON.stringify(PREFS_KEY)}) || "{}");
  if (prefs.enabled === true && typeof prefs.activeId === "string" && prefs.activeId !== "") {
    document.documentElement.dataset.dshOpeningPending = "1";
    var head = document.head;
    if (head !== null && head.querySelector("style[data-dsh-opening-early='1']") === null) {
      var style = document.createElement("style");
      style.setAttribute("data-dsh-opening-early", "1");
      style.textContent = "html[data-dsh-opening-pending='1'] #root{opacity:0}html[data-dsh-opening-pending='1']{background:#04050e}";
      head.appendChild(style);
    }
  }
} catch (error) {
  // fail-open: never block or break the host boot
}
`;

export function apply(ctx: HostContext): void {
  // One emit per index render with a fresh table; rows are read at emit time,
  // so the constant row is simply pushed on every emit.
  ctx.on("webserver/index-inject", (table) => {
    table.push({ kind: "script", placement: "head", text: EARLY_SCRIPT });
  });
}
