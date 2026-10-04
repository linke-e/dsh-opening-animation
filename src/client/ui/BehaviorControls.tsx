import type { OpeningController, OpeningSnapshot } from "../controller";

interface BehaviorControlsProps {
  t: (key: string) => string;
  snap: OpeningSnapshot;
  controller: OpeningController;
}

export function BehaviorControls({ t, snap, controller }: BehaviorControlsProps) {
  return (
    <div className="dsh-opening-controls">
      <label className="dsh-opening-control">
        <span className="dsh-opening-control-head">
          <span>{t("maxDuration")}</span>
          <output>{String(Math.round(snap.maxDurationMs / 1000))}s</output>
        </span>
        <input
          type="number"
          min="3"
          max="120"
          step="1"
          value={String(Math.round(snap.maxDurationMs / 1000))}
          onChange={(event) => controller.setMaxDuration(event.target.valueAsNumber * 1000)}
        />
        <small className="dsh-opening-note">{t("maxDurationHint")}</small>
      </label>
      <label className="dsh-opening-control">
        <span className="dsh-opening-control-head">
          <span>{t("transitionSpeed")}</span>
          <output>{snap.transitionScale.toFixed(1)}×</output>
        </span>
        <input
          type="number"
          min="0.5"
          max="2"
          step="0.1"
          value={String(snap.transitionScale)}
          onChange={(event) => controller.setTransitionScale(event.target.valueAsNumber)}
        />
      </label>
      <label className="dsh-opening-toggle">
        <input
          type="checkbox"
          checked={snap.showSkipHint}
          onChange={(event) => controller.setSkipHint(event.target.checked)}
        />
        <span className="dsh-opening-toggle-copy">
          <span>{t("skipHint")}</span>
          <small className="dsh-opening-note">{t("skipHintHint")}</small>
        </span>
      </label>
      <label className="dsh-opening-toggle">
        <input
          type="checkbox"
          checked={snap.skinHandoff}
          onChange={(event) => controller.setSkinHandoff(event.target.checked)}
        />
        <span className="dsh-opening-toggle-copy">
          <span>{t("skinHandoff")}</span>
          <small className="dsh-opening-note">{t("skinHandoffHint")}</small>
        </span>
      </label>
    </div>
  );
}
