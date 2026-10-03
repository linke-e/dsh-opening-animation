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
              onChange={() => onChange(animation.id)}
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
                    type="range"
                    min={String(spec.min ?? 0)}
                    max={String(spec.max ?? 100)}
                    step={String(spec.step ?? 1)}
                    value={String(params[key] ?? spec.default)}
                    onChange={(event) => {
                      if (active !== undefined) onParam(active.id, key, event.target.valueAsNumber);
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
