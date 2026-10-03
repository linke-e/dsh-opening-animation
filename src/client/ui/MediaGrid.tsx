import type { MediaSummary } from "../controller";

interface MediaGridProps {
  t: (key: string) => string;
  media: ReadonlyArray<MediaSummary>;
  activeId?: string;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

export function MediaGrid({ t, media, activeId, onSelect, onRemove }: MediaGridProps) {
  return (
    <div className="dsh-opening-grid">
      {media.map((item) => {
        const active = item.id === activeId;
        return (
          <article key={item.id} className="dsh-opening-card" data-active={active || undefined}>
            {item.kind === "video" ? (
              <video className="dsh-opening-thumb" src={item.url} muted preload="metadata" />
            ) : (
              <img
                className="dsh-opening-thumb"
                src={item.url}
                alt={item.name}
                decoding="async"
                loading={active ? "eager" : "lazy"}
              />
            )}
            <span className="dsh-opening-kind-badge">{t(item.kind === "video" ? "kindVideo" : "kindImage")}</span>
            {active && <span className="dsh-opening-active-badge">{t("active")}</span>}
            <div className="dsh-opening-card-body">
              <span className="dsh-opening-name" title={item.name}>
                {item.name}
              </span>
              {!active && (
                <button
                  className="dsh-opening-button"
                  type="button"
                  onClick={() => onSelect(item.id)}
                >
                  {t("use")}
                </button>
              )}
              <button
                className="dsh-opening-button dsh-opening-button-danger"
                type="button"
                onClick={() => onRemove(item.id)}
              >
                {t("remove")}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
