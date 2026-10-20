import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Badge } from "./ui";
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

/** Read-only portal state per matrix row. Logins are opened on the CRM directory lists, not from the matrix. */
export function useMatrixPortalStatus(projectId: string, token: string, enabled: boolean) {
  const [status, setStatus] = useState<StatusMap>({});

  const reloadStatus = useCallback(async () => {
    if (!enabled) return;
    setStatus(await api<StatusMap>(`/api/comms/contacts/${projectId}/portal-status`, { token }).catch(() => ({})));
  }, [enabled, projectId, token]);

  useEffect(() => {
    void reloadStatus();
  }, [reloadStatus]);

  const stateOf = (c: MatrixContact): PortalState | "no_email" => {
    const key = String(c.email || "").trim().toLowerCase();
    if (!key) return "no_email";
    return status[key]?.state || "none";
  };

  return { reloadStatus, stateOf };
}

function directoryFor(section?: string | null) {
  const s = String(section || "").toLowerCase();
  if (/sharnam|spdc/.test(s)) return { href: "/hrm/users", label: "HRMS" };
  if (/client|owner|employer/.test(s)) return { href: "/crm/directory/clients", label: "client list" };
  if (/contract|vendor|supplier/.test(s)) return { href: "/crm/directory/vendors", label: "vendor list" };
  return { href: "/crm/directory/stakeholders", label: "consultant list" };
}

export function PortalStateCell({ row, state }: { row: MatrixContact; state: PortalState | "no_email" }) {
  if (state === "on_project") return <Badge tone="ok">{formatUiText("on portal")}</Badge>;
  if (state === "no_email") return <span className="text-[11px] text-steel-muted">{formatUiText("no e-mail")}</span>;
  const dir = directoryFor(`${row.orgSection || ""} ${row.orgName || ""}`);
  const company = String(row.company || row.orgName || "").trim();
  const href = dir.href.startsWith("/crm/") && company ? `${dir.href}?q=${encodeURIComponent(company)}` : dir.href;
  return (
    <div className="flex flex-col items-start gap-1">
      {state === "has_login" ? (
        <Badge tone="warn">{formatUiText("login · not on project")}</Badge>
      ) : state === "inactive" ? (
        <Badge tone="danger">{formatUiText("login switched off")}</Badge>
      ) : (
        <Badge tone="neutral">{formatUiText("not onboarded")}</Badge>
      )}
      <Link to={href} className="text-[11px] font-semibold text-brand hover:underline">
        {formatUiText(`onboard in ${dir.label}`)} →
      </Link>
    </div>
  );
}
