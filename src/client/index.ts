// Client assembly point. The factory body below runs when the dsh boot
// manifest evaluates this bundle — the earliest execution point this plugin
// gets. Step 1 of the startup flow happens here synchronously: read prefs and,
// if this load will play, hold #root down BEFORE the app can flash a frame.
// Everything else is wired in apply(ctx) with inject = ["slots", "locale"]
// only (red line: no other host services).

import { OpeningController } from "./controller";
import { NS, en, zh } from "./locales";
import { parsePreferences, type OpeningPreferences } from "./preferences";
import "./registry";
import { installCriticalStyles, installStyles, removeCriticalStyles } from "./styles";
import { OpeningSection } from "./ui/OpeningSection";

export const inject = ["slots", "locale"];

interface ClientContext {
  locale: {
    bind: (ns: string) => (key: string) => string;
    register: (ns: string, dictionaries: Record<string, Record<string, string>>) => unknown;
  };
  slots: {
    inject: (slot: string, register: () => unknown) => unknown;
    register: (meta: {
      name: string;
      id: string;
      order: number;
      label: () => string;
      locale: string;
      inject: () => unknown;
    }, component: unknown) => unknown;
  };
  effect: (fn: () => unknown, name: string) => unknown;
}

let earlyPrefs: OpeningPreferences | undefined;
try {
  const parsed = parsePreferences();
  if (parsed.enabled && parsed.activeId !== undefined) {
    earlyPrefs = parsed;
    document.documentElement.dataset.dshOpeningPending = "1";
    installCriticalStyles();
  }
} catch (err) {
  console.warn("[dsh-opening-animation] pre-boot preference check failed", err);
  delete document.documentElement.dataset.dshOpeningPending;
  removeCriticalStyles();
}

export function apply(ctx: ClientContext): void {
  const controller = new OpeningController(earlyPrefs ?? parsePreferences());
  const t = ctx.locale.bind(NS);
  controller.attachLocale(t);
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-opening-animation: dictionaries");
  ctx.effect(() => installStyles(), "dsh-opening-animation: global styles");
  ctx.effect(() => {
    void controller.initialize();
    return () => {
      controller.dispose();
    };
  }, "dsh-opening-animation: opening runtime");
  ctx.slots.inject("settings.section", () =>
    ctx.slots.register(
      {
        name: "settings.section",
        id: "opening-animation",
        order: 13,
        label: () => t("nav"),
        locale: NS,
        inject: () => ({ controller, hooks: { opening: controller } }),
      },
      OpeningSection,
    ),
  );
}
