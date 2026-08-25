import { Button } from "./ui";

type FlowTab = "mb" | "bbs" | "monitoring";

type Props = {
  active: FlowTab;
  packageName: string;
  counts?: { mb?: number; bbs?: number; monitoring?: number };
  onNavigate: (tab: FlowTab, pkg?: string) => void;
  onSyncMbToMonitoring?: () => void;
  syncBusy?: boolean;
  canEdit?: boolean;
};

const STEPS: { key: FlowTab; label: string; hint: string; tone: string; activeTone: string }[] = [
  { key: "mb", label: "1 · MB", hint: "Measurement book — Nos × L × W × H → Qty", tone: "cost-flow-btn--mb", activeTone: "cost-flow-btn--mb-active" },
  { key: "bbs", label: "2 · BBS", hint: "Bar bending — marks, shapes, weight kg", tone: "cost-flow-btn--bbs", activeTone: "cost-flow-btn--bbs-active" },
  { key: "monitoring", label: "3 · Monitoring", hint: "BOQ · GFC · Achieved · Certified", tone: "cost-flow-btn--mon", activeTone: "cost-flow-btn--mon-active" },
];

/** SPDC cost chain — MB feeds BBS feeds Monitoring achieved qty. */
export function CostSheetFlowBar({
  active,
  packageName,
  counts,
  onNavigate,
  onSyncMbToMonitoring,
  syncBusy,
  canEdit,
}: Props) {
  const pkg = packageName && packageName !== "All" ? packageName : null;

  return (
    <div className="shrink-0 rounded-lg border border-line bg-paper px-3 py-2.5 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-left min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-steel-muted font-semibold">Sheet flow</div>
          <div className="text-sm font-semibold text-ink truncate">
            {pkg ? pkg : "All packages"} — MB → BBS → Monitoring
          </div>
        </div>
        {canEdit && onSyncMbToMonitoring && pkg && (
          <Button type="button" variant="secondary" className="!text-xs shrink-0" disabled={syncBusy} onClick={onSyncMbToMonitoring}>
            {syncBusy ? "Syncing…" : "Sync MB qty → Monitoring"}
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {STEPS.map((s, i) => {
          const n = counts?.[s.key];
          const isActive = active === s.key;
          return (
            <button
              key={s.key}
              type="button"
              title={s.hint}
              onClick={() => onNavigate(s.key, pkg || undefined)}
              className={`cost-flow-btn rounded-md px-3 py-2 text-left border min-w-[8.5rem] transition ${isActive ? s.activeTone : s.tone}`}
            >
              <span className="block text-xs font-bold">{s.label}</span>
              <span className={`block text-[10px] mt-0.5 ${isActive ? "opacity-90" : "text-steel-muted"}`}>
                {n != null ? `${n} rows` : s.hint.split("—")[0]?.trim()}
              </span>
              {i < STEPS.length - 1 && (
                <span className={`hidden sm:inline absolute`} aria-hidden />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
