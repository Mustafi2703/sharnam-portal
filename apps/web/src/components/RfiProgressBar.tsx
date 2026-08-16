import type { RfiProgress } from "../lib/rfiProgress";

export function RfiProgressBar({
  progress,
  compact = false,
  showLabel = true,
}: {
  progress: RfiProgress;
  compact?: boolean;
  showLabel?: boolean;
}) {
  const tone =
    progress.stage === "Closed"
      ? "bg-brand"
      : progress.stage === "Answered"
        ? "bg-brand/80"
        : progress.pct >= 66
          ? "bg-amber-500"
          : "bg-warn";

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      {showLabel && (
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-steel-muted">
            {progress.requiredDone}/{progress.requiredTotal} required fields
          </span>
          <span className="font-semibold text-ink">{progress.pct}%</span>
        </div>
      )}
      <div className={`w-full rounded-full bg-sand overflow-hidden ${compact ? "h-1.5" : "h-2"}`}>
        <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${progress.pct}%` }} />
      </div>
    </div>
  );
}

export function RfiStageStepper({ progress }: { progress: RfiProgress }) {
  const steps: RfiProgress["stage"][] = ["Open", "In review", "Answered", "Closed"];
  const activeIdx = steps.indexOf(progress.stage === "Draft" ? "Open" : progress.stage);

  return (
    <ol className="flex flex-wrap gap-1 text-[10px] font-semibold uppercase tracking-wide">
      {steps.map((s, i) => {
        const done = i < activeIdx || progress.stage === "Closed";
        const active = i === activeIdx;
        return (
          <li
            key={s}
            className={`rounded-full px-2 py-0.5 border ${
              active
                ? "bg-brand text-white border-brand"
                : done
                  ? "bg-brand-soft text-brand border-brand/30"
                  : "bg-paper text-steel-muted border-line"
            }`}
          >
            {s}
          </li>
        );
      })}
    </ol>
  );
}

export function RfiFieldChecklist({ progress }: { progress: RfiProgress }) {
  return (
    <ul className="grid sm:grid-cols-2 gap-1.5 text-xs">
      {progress.fields.map((f) => (
        <li
          key={f.key}
          className={`flex items-center gap-2 rounded-md px-2 py-1 border ${
            f.done ? "border-brand/25 bg-brand-soft/40" : "border-line bg-sand/30"
          }`}
        >
          <span className={f.done ? "text-brand" : "text-steel-muted"} aria-hidden>
            {f.done ? "✓" : "○"}
          </span>
          <span className={f.done ? "text-ink" : "text-steel-muted"}>
            {f.label}
            {f.optional ? " (optional)" : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
