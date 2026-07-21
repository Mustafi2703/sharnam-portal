import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth";
import { Badge, Button, Card, PageHeader, Stat } from "../components/ui";

const API_BASE = import.meta.env.VITE_API_URL || "";

async function downloadReport(path: string, token: string | null, filename: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Procore-style DPR / WPR dashboard with professional HTML pack downloads */
export default function ReportsPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [tab, setTab] = useState<"dpr" | "wpr">("dpr");
  const [dpr, setDpr] = useState<any>(null);
  const [wpr, setWpr] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    void Promise.all([
      fetch(`${API_BASE}/api/reports/dpr/${id}/pack`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
        .then((r) => r.json())
        .then(setDpr),
      fetch(`${API_BASE}/api/reports/wpr/${id}/pack`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
        .then((r) => r.json())
        .then(setWpr),
    ]);
  }, [id, token]);

  const project = (tab === "dpr" ? dpr : wpr)?.project;

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/projects/${id}`} className="text-sm text-brand font-medium">
          ← Project
        </Link>
        <PageHeader
          eyebrow="Client packs · Sharnam PMC"
          title="DPR / WPR dashboard"
          subtitle="Live field data in a Procore-style pack. Download a filled HTML report (open in browser / Print → PDF) matching your DPR and WPR formats."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setMsg("");
                  try {
                    await downloadReport(
                      `/api/reports/dpr/${id}/download.html`,
                      token,
                      `DPR-${project?.code || "pack"}.html`
                    );
                    setMsg("DPR downloaded — open the file and Print → Save as PDF for the client.");
                  } catch (e) {
                    setMsg(e instanceof Error ? e.message : "Failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Download DPR
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setMsg("");
                  try {
                    await downloadReport(
                      `/api/reports/wpr/${id}/download.html`,
                      token,
                      `WPR-${project?.code || "pack"}.html`
                    );
                    setMsg("WPR downloaded — open and Print → PDF for the weekly client pack.");
                  } catch (e) {
                    setMsg(e instanceof Error ? e.message : "Failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Download WPR
              </Button>
            </div>
          }
        />
      </div>

      {msg && <p className="text-sm text-brand bg-brand-soft/50 px-3 py-2 rounded-lg">{msg}</p>}

      {project && (
        <Card className="!bg-procore-navy !text-white !border-0">
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-white/60">Project header</div>
              <div className="font-display text-xl mt-1">{project.name}</div>
              <div className="text-sm text-white/80 mt-1 font-mono">{project.code}</div>
            </div>
            <div className="text-sm text-white/80 space-y-0.5 text-right">
              <div>Client: {project.clientName || "—"}</div>
              <div>Consultant: {project.designConsultant || "—"}</div>
              <div>Contractor: {project.contractorName || "—"}</div>
              <div className="text-white/60 text-xs mt-1">{project.pmc}</div>
            </div>
          </div>
        </Card>
      )}

      <div className="flex gap-1 border-b border-line">
        {(
          [
            ["dpr", "Daily (DPR)"],
            ["wpr", "Weekly (WPR)"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${
              tab === k ? "border-brand text-brand" : "border-transparent text-steel-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "dpr" && dpr && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Manpower" value={String(dpr.kpis.manpowerTotal)} />
            <Stat label="Equipment" value={String(dpr.kpis.equipmentCount)} />
            <Stat label="Checklists today" value={String(dpr.kpis.checklistsToday)} />
            <Stat label="Open RFIs" value={String(dpr.kpis.openRfis)} />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <h3 className="font-semibold text-sm mb-2">Diary · {dpr.kpis.diaryStatus}</h3>
              <p className="text-xs text-steel-muted mb-3">Weather: {dpr.kpis.weather}</p>
              <ul className="text-sm space-y-1 max-h-48 overflow-y-auto">
                {(dpr.diary?.manpower || []).map((m: any) => (
                  <li key={m.id} className="flex justify-between border-b border-line py-1">
                    <span>{m.companyName}</span>
                    <span className="font-mono">{m.workerCount}</span>
                  </li>
                ))}
                {!dpr.diary?.manpower?.length && <li className="text-steel-muted">No manpower — fill Day log</li>}
              </ul>
              <Link to={`/projects/${id}/diary`} className="text-xs font-semibold text-brand mt-3 inline-block">
                Open day log →
              </Link>
            </Card>
            <Card>
              <h3 className="font-semibold text-sm mb-2">Concern / RFI register</h3>
              <ul className="text-sm space-y-2 max-h-48 overflow-y-auto">
                {(dpr.rfis || []).slice(0, 8).map((r: any) => (
                  <li key={r.id} className="flex justify-between gap-2">
                    <span>
                      <span className="font-mono text-[11px] text-brand mr-1">{r.number}</span>
                      {r.subject}
                    </span>
                    <Badge tone={r.status === "Open" ? "warn" : "ok"}>{r.status}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}

      {tab === "wpr" && wpr && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Diary days" value={String(wpr.kpis.diaryDays)} />
            <Stat label="Manpower (week)" value={String(wpr.kpis.manpowerWeek)} />
            <Stat label="Drawings pub." value={`${wpr.kpis.publishedDrawings}/${wpr.kpis.drawings}`} />
            <Stat label="Open submittals" value={String(wpr.kpis.openSubmittals)} />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <Card padding={false}>
              <div className="px-4 py-3 border-b bg-sand/40 font-semibold text-sm">Drawing register snapshot</div>
              <ul className="divide-y max-h-64 overflow-y-auto text-sm">
                {(wpr.drawings || []).slice(0, 12).map((d: any) => (
                  <li key={d.id} className="px-4 py-2 flex justify-between gap-2">
                    <span>
                      <span className="font-mono text-[11px] text-brand mr-1">{d.drawingNumber}</span>
                      {d.title}
                    </span>
                    <Badge tone={d.isPublished ? "ok" : "neutral"}>{d.currentRev}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
            <Card padding={false}>
              <div className="px-4 py-3 border-b bg-sand/40 font-semibold text-sm">Submittals · Safety · Meetings</div>
              <div className="p-4 text-sm space-y-2">
                <div className="flex justify-between">
                  <span>Meetings this week</span>
                  <strong>{wpr.kpis.meetings}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Open MoM actions</span>
                  <strong>{wpr.kpis.openMeetingItems}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Safety events</span>
                  <strong>{wpr.kpis.safetyEvents}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Checklists approved</span>
                  <strong>
                    {wpr.kpis.checklistsApproved}/{wpr.kpis.checklistsSubmitted}
                  </strong>
                </div>
                <p className="text-xs text-steel-muted pt-2">
                  Download WPR for the full drawing register, submittals, and safety tables (client pack).
                </p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {(!dpr || !wpr) && <p className="text-sm text-steel-muted">Loading dashboard…</p>}
    </div>
  );
}
