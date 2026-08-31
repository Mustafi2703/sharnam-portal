import type { ReactNode } from "react";

export type CrmDetailLine = {
  label: string;
  value: ReactNode;
  mono?: boolean;
};

type PanelProps = {
  title: string;
  emptyMessage?: string;
  children?: ReactNode;
  className?: string;
};

/** Side panel shell for CRM register + detail layouts. */
export function CrmDetailPanel({
  title,
  emptyMessage = "Select a row to view details.",
  children,
  className = "",
}: PanelProps) {
  return (
    <div
      className={`rounded-xl border border-line bg-white dark:bg-graphite-900 flex flex-col min-h-[420px] overflow-hidden ${className}`}
    >
      <div className="px-4 py-3 border-b bg-sand/40 font-semibold text-sm shrink-0">{title}</div>
      {!children ? (
        <div className="p-4 text-sm text-steel-muted flex-1">{emptyMessage}</div>
      ) : (
        <div className="p-4 overflow-y-auto flex-1 space-y-3 text-sm">{children}</div>
      )}
    </div>
  );
}

/** Label / value rows in a bordered list — one field per line. */
export function CrmDetailLines({ lines }: { lines: CrmDetailLine[] }) {
  return (
    <dl className="border border-line rounded-lg overflow-hidden divide-y divide-line">
      {lines.map(({ label, value, mono }) => (
        <div
          key={label}
          className="grid grid-cols-[minmax(6.5rem,36%)_1fr] gap-x-3 px-3 py-2 text-xs even:bg-sand/15 dark:even:bg-white/[0.03]"
        >
          <dt className="text-steel-muted font-mono uppercase tracking-wide text-[10px] pt-0.5">{label}</dt>
          <dd className={`text-ink leading-snug break-words ${mono ? "font-mono text-[11px]" : ""}`}>
            {value ?? "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Multi-line text (description, scope) as numbered list items. */
export function CrmTextLineList({ title, items }: { title?: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="border-t border-line pt-3">
      {title && <div className="text-[10px] font-mono uppercase text-steel-muted mb-2">{title}</div>}
      <ol className="space-y-1.5 text-xs text-steel leading-relaxed list-none counter-reset-none">
        {items.map((item, i) => (
          <li key={`${i}-${item.slice(0, 24)}`} className="flex gap-2.5">
            <span className="text-steel-muted font-mono shrink-0 w-5 text-right tabular-nums">{i + 1}.</span>
            <span className="flex-1">{item}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Vertical timeline for status / audit log entries. */
export function CrmStatusTimeline({
  entries,
}: {
  entries: { at: string; label: string; by?: string | null }[];
}) {
  if (!entries.length) return null;
  return (
    <div className="border-t border-line pt-3">
      <div className="text-[10px] font-mono uppercase text-steel-muted mb-2">Status log</div>
      <ul className="space-y-2">
        {entries.map((e, i) => (
          <li key={`${e.at}-${i}`} className="flex gap-2 text-xs">
            <span className="font-mono text-[10px] text-steel-muted whitespace-nowrap pt-0.5">{e.at}</span>
            <div>
              <div className="font-medium">{e.label}</div>
              {e.by && <div className="text-[10px] text-steel-muted">{e.by}</div>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
