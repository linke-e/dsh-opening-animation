import type { OpeningController, OpeningError, OpeningSnapshot } from "../controller";
import type { MediaKind } from "../registry";
import { AnimationPicker } from "./AnimationPicker";
import { BehaviorControls } from "./BehaviorControls";
import { MediaDropZone } from "./MediaDropZone";
import { MediaGrid } from "./MediaGrid";
import { TransitionPicker } from "./TransitionPicker";

interface OpeningSectionProps {
  t: (key: string) => string;
  useOpening: (selector: (snapshot: OpeningSnapshot) => unknown) => unknown;
  controller: OpeningController;
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
  }
}

export function OpeningSection({ t, useOpening, controller }: OpeningSectionProps) {
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
      <MediaDropZone t={t} disabled={!state.ready} onAdd={(files) => void controller.addFiles(files)} />
      {state.error !== undefined && (
        <p className="dsh-opening-error" role="alert">
          {t(errorKey(state.error))}
        </p>
      )}
      {!state.ready ? (
        <p className="dsh-opening-hint">{t("loading")}</p>
      ) : state.media.length === 0 ? (
        <p className="dsh-opening-hint">{t("empty")}</p>
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
          <small className="dsh-opening-hint">{t("enabledHint")}</small>
        </span>
      </label>
      <div className="dsh-opening-control">
        <span className="dsh-opening-control-head">
          <span>{t("animationLabel")}</span>
        </span>
        <small className="dsh-opening-hint">{t("animationHint")}</small>
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
