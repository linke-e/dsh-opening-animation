import { useSyncExternalStore } from "react";
import { MAX_MEDIA, type OpeningController, type OpeningError, type OpeningSnapshot } from "../controller";
import { MAX_IMAGE_PIXELS } from "../media-probe";
import type { MediaKind } from "../registry";
import { AnimationPicker } from "./AnimationPicker";
import { BehaviorControls } from "./BehaviorControls";
import { MediaDropZone } from "./MediaDropZone";
import { MediaGrid } from "./MediaGrid";
import { TransitionPicker } from "./TransitionPicker";

/** Shape of the host locale service (subset this page consumes; the full
 * object arrives as a prop via slots.register's inject, same as dsh-custom-skin). */
interface LocaleController {
  getSnapshot: () => { active: string; locales: ReadonlyArray<{ id: string; label: string }> };
  subscribe: (listener: () => void) => () => void;
  setLocale: (id: string) => void;
}

interface OpeningSectionProps {
  t: (key: string) => string;
  useOpening: (selector: (snapshot: OpeningSnapshot) => unknown) => unknown;
  controller: OpeningController;
  /** Absent only if the host locale service ever stops being injected. */
  locale?: LocaleController;
}

/** Language picker for the whole DSH Web interface; this page's dictionary is
 * plugin-registered, so every string here follows the host language. */
function LanguagePicker({ t, locale }: { t: (key: string) => string; locale: LocaleController }) {
  // Arrow wrappers keep the host object bound as `this` (same as dsh-custom-skin).
  const snapshot = useSyncExternalStore(
    (listener) => locale.subscribe(listener),
    () => locale.getSnapshot(),
    () => locale.getSnapshot(),
  );
  return (
    <label className="dsh-opening-language">
      <span className="dsh-opening-toggle-copy">
        <span>{t("language")}</span>
        <small className="dsh-opening-note">{t("languageHint")}</small>
      </span>
      <select
        aria-label={t("language")}
        value={snapshot.active}
        onChange={(event) => locale.setLocale(event.target.value)}
      >
        {snapshot.locales.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Substitute {name} placeholders in a locale template. */
function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in values ? String(values[key]) : match));
}

function errorKey(error: OpeningError): string {
  switch (error) {
    case "storage":
      return "storageError";
    case "invalid-file":
      return "invalidFile";
    case "unsupported-codec":
      return "codecError";
    case "mutation":
      return "mutationError";
    case "capacity":
      return "capacityError";
    case "quota":
      return "quotaError";
  }
}

export function OpeningSection({ t, useOpening, controller, locale }: OpeningSectionProps) {
  const state = useOpening((snapshot) => snapshot) as OpeningSnapshot;
  const kind: MediaKind = state.activeKind ?? "image";
  const remove = (id: string): void => {
    if (window.confirm(t("removeConfirm"))) void controller.remove(id);
  };
  const clear = (): void => {
    if (window.confirm(t("clearConfirm"))) void controller.clear();
  };
  return (
    <section className="dsh-opening-section" aria-busy={!state.ready}>
      <div>
        <h2>{t("title")}</h2>
        <p className="dsh-opening-intro">{t("intro")}</p>
      </div>
      {locale !== undefined && <LanguagePicker t={t} locale={locale} />}
      <MediaDropZone t={t} disabled={!state.ready} onAdd={(files) => void controller.addFiles(files)} />
      {state.error !== undefined && (
        <p className="dsh-opening-error" role="alert">
          {fill(t(errorKey(state.error)), { max: MAX_MEDIA, maxPixels: MAX_IMAGE_PIXELS })}
        </p>
      )}
      {state.importSummary !== undefined && (
        <p className="dsh-opening-note" role="status">
          {fill(t("importPartial"), {
            imported: state.importSummary.imported,
            skipped: state.importSummary.skipped,
            max: MAX_MEDIA,
          })}
        </p>
      )}
      {!state.ready ? (
        <p className="dsh-opening-note">{t("loading")}</p>
      ) : state.media.length === 0 ? (
        <p className="dsh-opening-note">{t("empty")}</p>
      ) : (
        <MediaGrid
          t={t}
          media={state.media}
          activeId={state.activeId}
          onSelect={(id) => controller.select(id)}
          onRemove={remove}
        />
      )}
      <label className="dsh-opening-toggle">
        <input
          type="checkbox"
          checked={state.enabled}
          onChange={(event) => controller.setEnabled(event.target.checked)}
        />
        <span className="dsh-opening-toggle-copy">
          <span>{t("enabled")}</span>
          <small className="dsh-opening-note">{t("enabledHint")}</small>
        </span>
      </label>
      <div className="dsh-opening-control">
        <span className="dsh-opening-control-head">
          <span>{t("animationLabel")}</span>
        </span>
        <small className="dsh-opening-note">{t("animationHint")}</small>
        <AnimationPicker
          t={t}
          kind={kind}
          value={state.animationByKind[kind]}
          paramOverrides={state.paramOverrides[state.animationByKind[kind]] ?? {}}
          onChange={(animId) => controller.setAnimation(kind, animId)}
          onParam={(animId, key, value) => controller.setParam(animId, key, value)}
        />
      </div>
      <TransitionPicker t={t} value={state.transitionId} onChange={(id) => controller.setTransition(id)} />
      <BehaviorControls t={t} snap={state} controller={controller} />
      <div className="dsh-opening-actions">
        <button
          className="dsh-opening-button"
          type="button"
          disabled={!state.ready || state.activeId === undefined || state.playing}
          onClick={() => controller.preview()}
        >
          {t("preview")}
        </button>
        <button className="dsh-opening-button" type="button" onClick={() => controller.reset()}>
          {t("reset")}
        </button>
        {state.media.length > 0 && (
          <button className="dsh-opening-button dsh-opening-button-danger" type="button" onClick={clear}>
            {t("clear")}
          </button>
        )}
      </div>
    </section>
  );
}
