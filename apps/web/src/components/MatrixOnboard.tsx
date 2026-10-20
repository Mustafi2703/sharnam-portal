import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Badge, Card } from "./ui";
import { formatUiText } from "../lib/formatUiText";
import type { MatrixContact } from "./CommsMatrixPanel";

const SPDC_PMC = "Sharnam Project Development Consultants & Co.";

/** Project · client · PMC, without repeating a name when the project is called after its client. */
export function matrixSubtitle(project?: { name?: string | null; clientName?: string | null; pmcName?: string | null } | null): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const raw of [project?.name, project?.clientName ? `Client: ${project.clientName}` : "", `PMC: ${project?.pmcName || SPDC_PMC}`]) {
    const text = String(raw || "").trim();
    const key = text.replace(/^(client|pmc):\s*/i, "").toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    parts.push(text);
  }
  return parts.join(" · ") || "—";
}

type PortalState = "on_project" | "has_login" | "inactive" | "none";
type StatusMap = Record<string, { state: PortalState; role?: string }>;
type OpenResult = {
  opened: { email: string; name: string; role: string; company: string; created: boolean; password?: string }[];
  skipped: { email: string; reason: string }[];
  contacts: number;
};

const emailKey = (c: MatrixContact) => String(c.email || "").trim().toLowerCase();

export function useMatrixOnboard(opts: { projectId: string; token: string; enabled: boolean; onMsg: (m: string) => void }) {
  const { projectId, token, enabled, onMsg } = opts;
  const [status, setStatus] = useState<StatusMap>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<OpenResult | null>(null);
  const [busy, setBusy] = useState(false);

  const reloadStatus = useCallback(async () => {
    if (!enabled) return;
    setStatus(await api<StatusMap>(`/api/comms/contacts/${projectId}/portal-status`, { token }).catch(() => ({})));
  }, [enabled, projectId, token]);

  useEffect(() => {
    void reloadStatus();
  }, [reloadStatus]);

  const stateOf = (c: MatrixContact): PortalState | "no_email" => {
    const key = emailKey(c);
    if (!key) return "no_email";
    return status[key]?.state || "none";
  };

  const canSelect = (c: MatrixContact) => {
    const s = stateOf(c);
    return s !== "no_email" && s !== "on_project";
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectPending = (rows: MatrixContact[]) => setSelected(new Set(rows.filter((r) => !r.isSectionHeader && canSelect(r)).map((r) => r.id)));

  async function onboard(all: boolean) {
    const ids = [...selected];
    if (!all && !ids.length) {
      onMsg("Tick the people to onboard first.");
      return;
    }
    const prompt = all
      ? "Onboard everyone in this matrix? Each person with an e-mail gets a portal login (role by company type) and a seat on this project. No e-mail is sent."
      : `Onboard ${ids.length} selected ${ids.length === 1 ? "person" : "people"}? They get a portal login and a seat on this project. No e-mail is sent.`;
    if (!window.confirm(prompt)) return;
    setBusy(true);
    try {
      const r = await api<OpenResult>(`/api/comms/contacts/${projectId}/open-portal`, {
        method: "POST",
        token,
        timeoutMs: 120_000,
        body: JSON.stringify(all ? {} : { contactIds: ids }),
      });
      setResult(r);
      setSelected(new Set());
      onMsg(`Portal opened for ${r.opened.length} of ${r.contacts} people${r.skipped.length ? ` — ${r.skipped.length} skipped` : ""}.`);
      await reloadStatus();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Could not onboard");
    } finally {
      setBusy(false);
    }
  }

  return { status, reloadStatus, stateOf, canSelect, selected, toggle, selectPending, clearSelection: () => setSelected(new Set()), onboard, result, clearResult: () => setResult(null), busy };
}

export type MatrixOnboard = ReturnType<typeof useMatrixOnboard>;

export function PortalStateBadge({ state }: { state: PortalState | "no_email" }) {
  if (state === "on_project") return <Badge tone="ok">{formatUiText("on portal")}</Badge>;
  if (state === "has_login") return <Badge tone="warn">{formatUiText("login · not on project")}</Badge>;
  if (state === "inactive") return <Badge tone="danger">{formatUiText("login switched off")}</Badge>;
  if (state === "no_email") return <span className="text-[11px] text-steel-muted">{formatUiText("no e-mail")}</span>;
  return <Badge tone="neutral">{formatUiText("not onboarded")}</Badge>;
}

export function MatrixOnboardBar({ onboard, rows }: { onboard: MatrixOnboard; rows: MatrixContact[] }) {
  const people = rows.filter((r) => !r.isSectionHeader);
  const pending = people.filter((r) => onboard.canSelect(r)).length;
  const onPortal = people.filter((r) => onboard.stateOf(r) === "on_project").length;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-sand/40 px-3 py-2 text-xs">
      <span className="font-semibold text-ink">{formatUiText("portal onboarding")}</span>
      <span className="text-steel-muted">
        {onPortal} {formatUiText("on portal")} · {pending} {formatUiText("to onboard")}
      </span>
      <div className="ml-auto flex flex-wrap gap-2">
        <button type="button" className="rounded-lg border border-line bg-paper px-2.5 py-1 hover:bg-sand disabled:opacity-50" disabled={onboard.busy || !pending} onClick={() => onboard.selectPending(rows)}>
          {formatUiText("select all not onboarded")}
        </button>
        {onboard.selected.size ? (
          <button type="button" className="rounded-lg border border-line bg-paper px-2.5 py-1 hover:bg-sand" onClick={onboard.clearSelection}>
            {formatUiText("clear")}
          </button>
        ) : null}
        <button type="button" className="rounded-lg bg-procore-navy px-2.5 py-1 font-semibold text-white disabled:opacity-50" disabled={onboard.busy || !onboard.selected.size} onClick={() => void onboard.onboard(false)}>
          {formatUiText(`onboard selected (${onboard.selected.size})`)}
        </button>
      </div>
    </div>
  );
}

export function MatrixOnboardResult({ onboard }: { onboard: MatrixOnboard }) {
  const r = onboard.result;
  if (!r) return null;
  return (
    <Card className="!p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-semibold text-sm">
          {formatUiText("portal access")} — {r.opened.length} {formatUiText("open")} · {r.skipped.length} {formatUiText("skipped")}
        </h4>
        <button type="button" className="text-xs text-steel-muted" onClick={onboard.clearResult}>
          {formatUiText("close")}
        </button>
      </div>
      <p className="text-xs text-steel-muted">
        {formatUiText("new logins show their one-time password here once. nothing was e-mailed. everyone listed is now on the project team.")}
      </p>
      <div className="max-h-56 overflow-y-auto divide-y divide-line border border-line rounded-lg text-xs">
        {r.opened.map((o) => (
          <div key={o.email} className="flex flex-wrap gap-x-3 px-3 py-1.5">
            <strong data-preserve-case>{o.name}</strong>
            <span className="font-mono text-steel-muted" data-preserve-case>{o.email}</span>
            <span>{o.role}</span>
            <span className="text-steel-muted" data-preserve-case>{o.company}</span>
            <span className="ml-auto">{o.created ? <>new · password <code data-preserve-case>{o.password}</code></> : formatUiText("already had a login")}</span>
          </div>
        ))}
        {r.skipped.map((o) => (
          <div key={o.email} className="flex flex-wrap gap-x-3 px-3 py-1.5 text-amber-800">
            <span className="font-mono" data-preserve-case>{o.email}</span>
            <span>{o.reason}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
