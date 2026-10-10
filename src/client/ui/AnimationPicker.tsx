import { useState } from "react";
import { listAnimations, resolveAnimationParams, type MediaKind } from "../registry";

interface AnimationPickerProps {
  t: (key: string) => string;
  kind: MediaKind;
  value: string;
  paramOverrides: Readonly<Record<string, number | string>>;
  onChange: (animId: string) => void;
  onParam: (animId: string, key: string, value: number | string) => void;
}

export function AnimationPicker({ t, kind, value, paramOverrides, onChange, onParam }: AnimationPickerProps) {
  const animations = listAnimations(kind);
  const active = animations.find((animation) => animation.id === value) ?? animations[0];
  // In-progress text for number inputs; cleared on blur so the clamped
  // resolved value shows again (typing "1500" must not bounce per keystroke).
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  if (active === undefined) return null;
  const params = resolveAnimationParams(active, paramOverrides);
  const schema = active.paramsSchema ?? {};
  const hasAdvanced = Object.keys(schema).length > 0;
  return (
    <div className="dsh-opening-radios" role="radiogroup" aria-label={t("animationLabel")}>
      {animations.map((animation) => {
        const checked = animation.id === active.id;
        return (
          <label key={animation.id} className="dsh-opening-radio" data-checked={checked || undefined}>
            <input
              type="radio"
              name={`dsh-opening-animation-${kind}`}
              value={animation.id}
              checked={checked}
              onChange={() => {
                setDrafts({});
                onChange(animation.id);
              }}
            />
            <span className="dsh-opening-radio-copy">
              <span>{t(animation.labelKey)}</span>
              {animation.descriptionKey !== undefined && <small>{t(animation.descriptionKey)}</small>}
            </span>
          </label>
        );
      })}
      {hasAdvanced && (
        <details className="dsh-opening-params">
          <summary>{t("advanced")}</summary>
          <div className="dsh-opening-params-body">
            {Object.entries(schema).map(([key, spec]) => (
              <label key={key} className="dsh-opening-control">
                <span className="dsh-opening-control-head">
                  <span>{t(`param.${key}`)}</span>
                </span>
                {spec.type === "number" ? (
                  <input
                    type="number"
                    value={drafts[key] ?? String(params[key] ?? spec.default)}
                    min={spec.min !== undefined ? String(spec.min) : undefined}
                    max={spec.max !== undefined ? String(spec.max) : undefined}
                    step={spec.step !== undefined ? String(spec.step) : undefined}
                    onChange={(event) => {
                      setDrafts((current) => ({ ...current, [key]: event.target.value }));
                      const next = event.target.valueAsNumber;
                      if (active !== undefined && Number.isFinite(next)) onParam(active.id, key, next);
                    }}
                    onBlur={() =>
                      setDrafts((current) => {
                        const next = { ...current };
                        delete next[key];
                        return next;
                      })
                    }
                  />
                ) : spec.type === "string" ? (
                  <input
                    type="text"
                    value={String(params[key] ?? spec.default)}
                    onChange={(event) => {
                      if (active !== undefined) onParam(active.id, key, event.target.value);
                    }}
                  />
                ) : (
                  <select
                    value={String(params[key] ?? spec.default)}
                    onChange={(event) => {
                      if (active !== undefined) onParam(active.id, key, event.target.value);
                    }}
                  >
                    {(spec.options ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
