import { listTransitions } from "../transitions";

interface TransitionPickerProps {
  t: (key: string) => string;
  value: string;
  onChange: (id: string) => void;
}

export function TransitionPicker({ t, value, onChange }: TransitionPickerProps) {
  return (
    <label className="dsh-opening-control">
      <span className="dsh-opening-control-head">
        <span>{t("transition")}</span>
      </span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {listTransitions().map((preset) => (
          <option key={preset.id} value={preset.id}>
            {t(preset.labelKey)}
          </option>
        ))}
      </select>
    </label>
  );
}
