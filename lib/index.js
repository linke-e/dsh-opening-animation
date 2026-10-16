// src/client/preferences.ts
var PREFS_KEY = "dsh.opening-animation.preferences.v1";
var DEFAULT_ANIMATION_BY_KIND = { image: "tap-reveal", video: "video-player" };
var DEFAULT_PREFERENCES = Object.freeze({
  enabled: false,
  activeId: void 0,
  animationByKind: { ...DEFAULT_ANIMATION_BY_KIND },
  imageOrder: "single",
  transitionId: "cross-fade",
  transitionScale: 1,
  maxDurationMs: 15e3,
  showSkipHint: true,
  paramOverrides: {},
  skinHandoff: false
});

// src/index.ts
var name = "dsh-opening-animation";
var EARLY_SCRIPT = `
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
function apply(ctx) {
  ctx.on("webserver/index-inject", (table) => {
    table.push({ kind: "script", placement: "head", text: EARLY_SCRIPT });
  });
}
export {
  EARLY_SCRIPT,
  apply,
  name
};
