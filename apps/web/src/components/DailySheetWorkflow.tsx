import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Button } from "./ui";
import { formatUiText } from "../lib/formatUiText";

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

const FLOW: { to: string; label: string; keys: string[] }[] = [
  { to: "cost?tab=monitoring", label: "Cost", keys: ["boq", "mb", "bbs"] },
  { to: "inspections", label: "Quality", keys: ["qap", "cube", "ncr"] },
  { to: "safety", label: "Safety", keys: ["safety"] },
  { to: "progress?tab=planned", label: "Progress", keys: ["pva-activity", "manpower", "milestones"] },
  { to: "dpr-maker", label: "DPR", keys: ["dpr-today"] },
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
        { method: "POST", token, body: JSON.stringify({}) },
      );
      setLocalPack(out.pack);
      const failed = (out.steps || []).filter((s) => !s.ok);
      setLocalMsg(failed.length ? `Gaps: ${failed.map((s) => s.key).join(", ")}` : "Sheets loaded.");
    } catch (err) {
      setLocalMsg(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLocalBusy(false);
    }
  }

  const isBusy = busy || localBusy;
  const byKey = new Map(list.map((c) => [c.key, c]));

  return (
    <div className="rounded-lg border border-line bg-paper overflow-hidden shrink-0">
      <div className={`px-3 ${compact ? "py-1.5" : "py-2"} border-b border-line flex flex-wrap items-center justify-between gap-2 bg-sand/30`}>
        <span className="font-semibold text-sm text-ink">{formatUiText("Daily sheets")}</span>
        <div className="flex flex-wrap gap-2 items-center">
          {summary && (
            <span className="text-xs text-steel-muted font-mono">
              {summary.requiredOk}/{summary.required}
              {summary.readyForDpr ? " · DPR ready" : ""}
            </span>
          )}
          {allowProvision && (
            <Button type="button" className="!text-xs" disabled={isBusy} onClick={() => void provision()}>
              {isBusy ? "Loading…" : "Load sheets"}
            </Button>
          )}
        </div>
      </div>
      {localMsg && <p className="text-xs text-brand px-3 py-1 bg-brand-soft">{localMsg}</p>}
      <div className={`grid sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-line ${compact ? "text-xs" : "text-sm"}`}>
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
              className={`${compact ? "px-2 py-1.5" : "px-3 py-2"} hover:bg-brand-soft/30 ${ok && list.length ? "bg-ok/5" : ""}`}
            >
              <div className="flex items-center gap-1.5">
                <span className="h-5 w-5 rounded-full grid place-items-center text-[10px] font-bold bg-ink text-white shrink-0">
                  {i + 1}
                </span>
                <span className="font-semibold text-ink">{step.label}</span>
              </div>
              {list.length ? (
                <p className="text-[10px] text-steel-muted pl-6 mt-0.5 font-mono">{count} rows</p>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
