import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Badge, Button } from "./ui";

export type MakerRecentItem = {
  id: string;
  title: string;
  subtitle?: string;
  href?: string;
  badge?: { label: string; tone?: "ok" | "warn" | "neutral" };
};

type Props = {
  title: string;
  items: MakerRecentItem[];
  /** Rows shown on the page before opening the modal. */
  previewCount?: number;
  emptyMessage?: string;
};

function basename(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

export function fileNameFromPublishedPath(path?: string | null): string | undefined {
  if (!path) return undefined;
  return basename(path);
}

export function MakerRecentPanel({ title, items, previewCount = 5, emptyMessage }: Props) {
  const [open, setOpen] = useState(false);
  const preview = useMemo(() => items.slice(0, previewCount), [items, previewCount]);

  if (!items.length) {
    if (!emptyMessage) return null;
    return (
      <div className="maker-section maker-section--flush">
        <div className="maker-section__head">{title}</div>
        <p className="maker-list__empty">{emptyMessage}</p>
      </div>
    );
  }

  const listBody = (rows: MakerRecentItem[]) => (
    <ul className="maker-recent-list">
      {rows.map((r) => (
        <li key={r.id} className="maker-recent-list__row">
          <div className="maker-recent-list__main min-w-0">
            <div className="maker-recent-list__title">{r.title}</div>
            {r.href ? (
              <a href={r.href} target="_blank" rel="noopener noreferrer" className="maker-recent-list__sub truncate underline text-brand">
                {r.subtitle || "Open file"}
              </a>
            ) : r.subtitle ? (
              <div className="maker-recent-list__sub truncate font-mono">{r.subtitle}</div>
            ) : null}
          </div>
          {r.badge ? <Badge tone={r.badge.tone || "neutral"}>{r.badge.label}</Badge> : null}
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <div className="maker-section maker-section--flush">
        <div className="maker-section__head maker-recent-panel__head">
          <span>{title}</span>
          {items.length > previewCount ? (
            <Button type="button" variant="secondary" className="!py-1 !px-2.5 !text-xs" onClick={() => setOpen(true)}>
              View all ({items.length})
            </Button>
          ) : null}
        </div>
        <div className="maker-recent-panel__preview">{listBody(preview)}</div>
      </div>

      {open
        ? createPortal(
            <div className="register-modal" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
              <div className="register-modal__panel register-modal__panel--2xl" onClick={(e) => e.stopPropagation()}>
                <div className="register-modal__head register-modal__head--brand">
                  <h3 className="font-semibold text-ink text-base sm:text-lg">{title}</h3>
                  <button
                    type="button"
                    className="text-steel-muted hover:text-ink text-2xl leading-none px-2"
                    onClick={() => setOpen(false)}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
                <div className="register-modal__body maker-recent-modal__body">{listBody(items)}</div>
                <div className="register-modal__foot">
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
