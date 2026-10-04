import { useState } from "react";

interface MediaDropZoneProps {
  t: (key: string) => string;
  disabled: boolean;
  onAdd: (files: File[]) => void;
}

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/x-matroska";

export function MediaDropZone({ t, disabled, onAdd }: MediaDropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const onInput = (event: React.ChangeEvent<HTMLInputElement>): void => {
    if (event.target.files !== null) onAdd([...event.target.files]);
    event.target.value = "";
  };
  const onDrop = (event: React.DragEvent<HTMLLabelElement>): void => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files !== null) onAdd([...event.dataTransfer.files]);
  };
  return (
    <label
      className="dsh-opening-drop"
      aria-disabled={!disabled ? undefined : "true"}
      data-dragging={dragging || undefined}
      data-disabled={!disabled || undefined}
      onDragEnter={() => setDragging(true)}
      onDragLeave={() => setDragging(false)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <strong>{t("upload")}</strong>
      <span className="dsh-opening-note">{t("uploadHint")}</span>
      <input
        type="file"
        accept={ACCEPT}
        aria-label={t("upload")}
        disabled={disabled}
        multiple
        onChange={onInput}
      />
    </label>
  );
}
