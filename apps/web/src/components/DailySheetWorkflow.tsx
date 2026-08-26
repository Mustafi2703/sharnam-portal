import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Button } from "./ui";

type PackCheck = {
  key: string;
  layer: string;
  label: string;
  ok: boolean;
  count: number;
  min: number;
  sheet: string;
  feeds: string;
};

type PackSummary = {
  readyForDpr?: boolean;
  requiredOk?: number;
  required?: number;
};

type PackReport = {
  summary?: PackSummary;
  checks?: PackCheck[];
};

const FLOW: { to: string; label: string; hint: string; keys: string[] }[] = [
  { to: "cost?tab=monitoring", label: "Cost", hint: "BOQ · MB · BBS", keys: ["boq", "mb", "bbs"] },
  { to: "inspections", label: "Quality", hint: "QAP · Cube · NCR", keys: ["qap", "cube", "ncr"] },
  { to: "safety", label: "Safety", hint: "HIRA · observations", keys: ["safety"] },
  { to: "progress?tab=planned", label: "Progress", hint: "PvsA · hindrance", keys: ["pva-activity", "manpower", "milestones"] },
  { to: "dpr-maker", label: "DPR", hint: "Auto-fill from sheets", keys: ["dpr-today"] },
];

export function DailySheetWorkflow({
  projectId,
  pack,
  checks,
  canProvision,
  busy,
  onProvision,
  compact,
}: {
  projectId: string;
  pack?: PackSummary | null;
  checks?: PackCheck[];
  canProvision?: boolean;
  busy?: boolean;
  onProvision?: () => void;
  compact?: boolean;
}) {
  const { token, user } = useAuth();
  const [localPack, setLocalPack] = useState<PackReport | null>(null);
  const [localBusy, setLocalBusy] = useState(false);
  const [localMsg, setLocalMsg] = useState("");

  const roleCanProvision = ["admin", "office", "employee", "site_employee"].includes(user?.role || "");
  const allowProvision = canProvision ?? roleCanProvision;

  useEffect(() => {
    if (pack || checks?.length) return;
    api<PackReport>(`/api/projects/${projectId}/sheet-pack`, { token })
      .then(setLocalPack)
      .catch(() => setLocalPack(null));
  }, [projectId, token, pack, checks?.length]);

  const summary = pack ?? localPack?.summary;
  const list = checks?.length ? checks : localPack?.checks || [];

  async function provision() {
    if (onProvision) {
      onProvision();
      return;
    }
    setLocalBusy(true);
    setLocalMsg("");
    try {
      const out = await api<{ pack: PackReport; steps: { key: string; ok: boolean; error?: string }[] }>(
        `/api/projects/${projectId}/provision-sheets`,
        { method: "POST", token, body: JSON.stringify({}) }
      );
      setLocalPack(out.pack);
      const failed = (out.steps || []).filter((s) => !s.ok);
      setLocalMsg(
        failed.length
          ? `Loaded with gaps: ${failed.map((s) => s.key).join(", ")}`
          : "SPDC Cost, Quality, Safety, and Progress formats loaded."
      );
    } catch (err) {
      setLocalMsg(err instanceof Error ? err.message : "Sheet load failed");
    } finally {
      setLocalBusy(false);
    }
  }

  const isBusy = busy || localBusy;
  const byKey = new Map(list.map((c) => [c.key, c]));

  return (
    <div className="rounded-lg border border-line bg-paper overflow-hidden shrink-0">
      <div className={`px-3 ${compact ? "py-1.5" : "px-4 py-2.5"} border-b border-line flex flex-wrap items-center justify-between gap-2 bg-sand/40`}>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-steel-muted">Daily sheet workflow</div>
          {!compact && (
            <p className="text-sm text-ink mt-0.5">
              Excel formats load per project. Site updates Cost, Quality, Safety, Progress each day — DPR Maker pulls them automatically.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {summary && (
            <span className="text-xs text-steel-muted">
              {summary.requiredOk}/{summary.required} required sheets
              {summary.readyForDpr ? " · ready for DPR" : ""}
            </span>
          )}
          {allowProvision && (
            <Button type="button" className="!text-xs" disabled={isBusy} onClick={() => void provision()}>
              {isBusy ? "Loading formats…" : "Load SPDC sheets"}
            </Button>
          )}
        </div>
      </div>
      {localMsg && <p className="text-xs text-brand px-3 py-1.5 bg-brand-soft">{localMsg}</p>}
      <div className={`grid sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-line ${compact ? "text-[11px]" : ""}`}>
        {FLOW.map((step, i) => {
          const ok = step.keys.every((k) => {
            const c = byKey.get(k);
            return !c || c.min === 0 || c.ok;
          });
          const count = step.keys.map((k) => byKey.get(k)?.count ?? 0).reduce((a, b) => a + b, 0);
          return (
            <Link
              key={step.to}
              to={`/projects/${projectId}/${step.to}`}
              className={`${compact ? "p-2" : "p-3"} hover:bg-brand-soft/40 ${ok && list.length ? "bg-ok/5" : ""}`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`${compact ? "h-5 w-5 text-[10px]" : "h-6 w-6 text-[11px]"} rounded-full grid place-items-center font-bold bg-ink text-white`}>
                  {i + 1}
                </span>
                <span className={`font-semibold text-ink ${compact ? "text-xs" : "text-sm"}`}>{step.label}</span>
              </div>
              <p className={`text-steel-muted ${compact ? "pl-7 text-[10px]" : "text-xs pl-8"}`}>{step.hint}</p>
              {list.length ? (
                <p className={`font-mono text-steel-muted ${compact ? "pl-7 text-[10px]" : "text-[11px] pl-8 mt-1"}`}>
                  {count} rows{ok ? " · loaded" : " · needs template"}
                </p>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
