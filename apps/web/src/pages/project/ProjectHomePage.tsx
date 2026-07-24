import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { PieChart } from "../../components/PieChart";
import { Badge, Button, Card, Stat, WorkflowStrip } from "../../components/ui";

export default function ProjectHomePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [overview, setOverview] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [safety, setSafety] = useState<any>(null);
  const isClient = user?.role === "client";
  const canUpload = user && user.role !== "client";

  useEffect(() => {
    api(`/api/directory/project/${id}/overview`, { token }).then(setOverview).catch(console.error);
    api(`/api/progress/${id}/summary`, { token }).then(setProgress).catch(() => setProgress(null));
    api(`/api/checklist/project/${id}/safety-dashboard`, { token }).then(setSafety).catch(() => setSafety(null));
  }, [id, token]);

  const s = overview?.stats || {};
  const pt = progress?.totals || {};

  const tools = isClient
    ? [
        ["drawings", "Drawings", "Published GFC sheets — view only", "DWG", "#E4632A"],
        ["rfis", "Concerns / RFIs", "Raise questions without upload control", "RFI", "#0B6A78"],
        ["reports", "Reports", "Weekly packs & DPR visibility", "RPT", "#3D4450"],
        ["checklist", "Checklist catalog", "See assigned types (fills are site-side)", "QA", "#2F6F4E"],
        ["comms", "Meetings", "Schedule visibility", "MTG", "#C24D1A"],
        ["safety", "Safety", "Observations shared with client", "SAF", "#1C4A5A"],
      ]
    : [
        ["drawings", "Drawings", "Upload, revise, publish sheets", "DWG", "#E4632A"],
        ["dms", "Documents", "OneDrive-style project docs", "DOC", "#3D4450"],
        ["checklist", "Final Index", "Assign types · fill vs drawing", "FI", "#0B6A78"],
        ["quality-inspections", "Quality Inspections", "QI forms vs published sheets", "QI", "#2F6F4E"],
        ["inspections", "Quality Action Plan", "Track open QI actions", "QAP", "#3D4450"],
        ["comms", "Matrix · Agenda · MoM", "Agenda before MoM · follow-up", "MTG", "#C24D1A"],
        ["reports", "DPR / WPR", "Dashboard + downloadable packs", "DPR", "#E4632A"],
        ["diary", "Day log", "Manpower & field notes", "FLD", "#0B6A78"],
        ["rfis", "RFIs + checklist", "Anyone raises · matrix responds", "RFI", "#0B6A78"],
        ["submittals", "Submittals", "Draft → review → approve", "SUB", "#C24D1A"],
        ["photos", "Photos", "Albums · upload field images", "PIC", "#1C4A5A"],
        ["safety", "Safety", "Observations & incidents", "SAF", "#1C4A5A"],
        ["cost", "Cost / COP / bills", "Measurement + vendor bill tracker", "₹", "#2F6F4E"],
        ["directory", "Directory", "Assign people to project", "DIR", "#3D4450"],
        ["vendors", "Vendors", "Trade partners on project", "VEN", "#C24D1A"],
        ["email", "Email settings", "Notification recipients", "EML", "#1C4A5A"],
      ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brand mb-1">
            {isClient ? "Client project desk" : "Project overview"}
          </p>
          <h2 className="font-display text-2xl">Designed module grid</h2>
          <p className="text-sm text-steel-muted mt-1 max-w-xl">
            Open one module at a time. Upload drawings only inside Drawings. Quality Inspections are the Procore QI form.
            Comms is Matrix → meeting → MoM.
          </p>
        </div>
        {canUpload && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="!text-xs" onClick={() => navigate(`/projects/${id}/drawings`)}>
              Open Drawings
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="!text-xs"
              onClick={() => navigate(`/projects/${id}/inspections`)}
            >
              Open Quality
            </Button>
            <Button type="button" variant="secondary" className="!text-xs" onClick={() => navigate(`/projects/${id}/comms`)}>
              Open Comms
            </Button>
          </div>
        )}
      </div>

      <WorkflowStrip
        active={1}
        steps={
          isClient
            ? [
                { label: "Access project", hint: "Your assigned work" },
                { label: "View drawings", hint: "Published only" },
                { label: "Raise concerns", hint: "RFIs" },
                { label: "Read packs", hint: "Reports" },
              ]
            : [
                { label: "Drawings", hint: "Upload + publish" },
                { label: "Quality / Site", hint: "QI form or checklist" },
                { label: "Request fill", hint: "Matrix / vendor" },
                { label: "Comms / MoM", hint: "Meetings + Ask" },
              ]
        }
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Published drawings" value={s.publishedDrawings ?? "—"} hint={`${s.drawings ?? 0} total`} />
        <Stat label="Open RFIs" value={s.openRfis ?? "—"} />
        <Stat label="Open hindrances" value={pt.openHindrance ?? "—"} />
        <Stat
          label="Project progress"
          value={pt.projectProgressPct != null ? `${Math.round(pt.projectProgressPct * 100)}%` : "—"}
        />
      </div>

      {(progress || safety) && (
        <div className="rounded-sm border border-line bg-gradient-to-br from-[#F7F8FA] via-white to-[#F0F4F3] p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-steel-muted">Workday-style project dashboard</p>
              <h3 className="font-display text-xl text-ink">Progress · Safety · Hindrance</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to={`/projects/${id}/progress`} className="text-xs font-semibold text-brand">
                Progress →
              </Link>
              <Link to={`/projects/${id}/safety`} className="text-xs font-semibold text-brand">
                Safety →
              </Link>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <PieChart title="Milestones" items={progress?.charts?.milestoneByStatus || []} />
            <PieChart title="Hindrances" items={progress?.charts?.hindranceByStatus || []} />
            <PieChart title="Risks" items={progress?.charts?.riskByStatus || []} />
            <PieChart title="Safety status" items={safety?.charts?.byStatus || []} />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <Card className="!p-3">
              <div className="text-[10px] uppercase text-steel-muted">Milestones</div>
              <div className="font-display text-xl">{pt.milestones ?? 0}</div>
              <div className="text-xs text-steel-muted">{pt.delayed ?? 0} delayed</div>
            </Card>
            <Card className="!p-3">
              <div className="text-[10px] uppercase text-steel-muted">Hindrance open</div>
              <div className="font-display text-xl">{pt.openHindrance ?? 0}</div>
              <div className="text-xs text-steel-muted">from sheet register</div>
            </Card>
            <Card className="!p-3">
              <div className="text-[10px] uppercase text-steel-muted">Open risks</div>
              <div className="font-display text-xl">{pt.openRisk ?? 0}</div>
            </Card>
            <Card className="!p-3">
              <div className="text-[10px] uppercase text-steel-muted">Safety open</div>
              <div className="font-display text-xl">{safety?.totals?.open ?? 0}</div>
              <div className="text-xs text-steel-muted">{safety?.totals?.records ?? 0} records</div>
            </Card>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {tools.map(([to, title, desc, icon, accent]) => (
          <Link key={to} to={`/projects/${id}/${to}`}>
            <Card className="h-full hover:border-brand/40 transition">
              <div className="flex items-start gap-3">
                <span
                  className="h-10 w-10 rounded-lg grid place-items-center text-white text-[10px] font-display shrink-0"
                  style={{ background: accent }}
                >
                  {icon}
                </span>
                <div>
                  <div className="font-semibold">{title}</div>
                  <p className="text-sm text-steel-muted mt-1 leading-relaxed">{desc}</p>
                  <div className="mt-3 text-sm text-brand font-medium">Open →</div>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {s.publishedDrawings === 0 && !isClient && (
        <Card className="border-line bg-sand/50">
          <div className="font-semibold">No drawings yet</div>
          <p className="text-sm text-steel-muted mt-1">
            Upload in the Drawings module when you have sheets. Checklists and Quality Inspections can still run without a drawing.
          </p>
          <Button className="mt-3" onClick={() => navigate(`/projects/${id}/drawings`)}>
            Go to Drawings
          </Button>
        </Card>
      )}

      {isClient && (
        <Card className="bg-brand-soft/40 border-brand/20">
          <div className="flex items-center gap-2">
            <Badge tone="brand">Client</Badge>
            <span className="font-semibold">View-only drawings</span>
          </div>
          <p className="text-sm text-steel-muted mt-2">
            Uploads, cost, and checklist fills stay with Sharnam office / site. Use Concerns for questions.
          </p>
        </Card>
      )}
    </div>
  );
}
