import type { ReactNode } from "react";

/** Compact tool header for DPR / WPR makers — no title-case transform, no enter animation. */
export function MakerToolHeader({
  eyebrow,
  title,
  meta,
  description,
  actions,
  busy,
}: {
  eyebrow?: string;
  title: string;
  /** Secondary line — project name, discipline, etc. */
  meta?: string;
  description?: string;
  actions?: ReactNode;
  busy?: boolean;
}) {
  return (
    <header className="maker-tool-header px-1">
      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-3">
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-brand mb-1">{eyebrow}</p>
          ) : null}
          <h1 className="font-display text-lg sm:text-xl font-semibold text-ink leading-snug tracking-tight">{title}</h1>
          {meta ? <p className="text-sm text-steel-muted mt-0.5 leading-snug break-words">{meta}</p> : null}
          {description ? (
            <p className="text-xs sm:text-sm text-steel-muted mt-1.5 leading-relaxed max-w-3xl">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap gap-2 shrink-0 xl:justify-end xl:max-w-[48%]">{actions}</div>
        ) : null}
      </div>
      {busy ? (
        <div className="mt-2 h-0.5 rounded-full bg-brand/15 overflow-hidden" aria-hidden>
          <div className="h-full w-1/3 bg-brand/70 animate-pulse rounded-full" />
        </div>
      ) : null}
    </header>
  );
}
