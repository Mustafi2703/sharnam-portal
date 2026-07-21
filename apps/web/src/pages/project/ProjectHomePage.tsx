import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Stat, WorkflowStrip } from "../../components/ui";

export default function ProjectHomePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [overview, setOverview] = useState<any>(null);
  const isClient = user?.role === "client";
  const canUpload = user && user.role !== "client";

  useEffect(() => {
    api(`/api/directory/project/${id}/overview`, { token }).then(setOverview).catch(console.error);
  }, [id, token]);

  const s = overview?.stats || {};

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
        ["reports", "DPR / reports", "Daily & weekly packs", "DPR", "#E4632A"],
        ["diary", "Day log", "Manpower & field notes", "FLD", "#0B6A78"],
        ["rfis", "RFIs + checklist", "Attach checklist · office resolve", "RFI", "#0B6A78"],
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
            Procore-style tools — use the right Actions panel for upload drawing, assign checklist, and engineer fills.
          </p>
        </div>
        {canUpload && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="!text-xs" onClick={() => navigate(`/projects/${id}/drawings?upload=1`)}>
              Upload drawing
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="!text-xs"
              onClick={() => navigate(`/projects/${id}/checklist?assign=1`)}
            >
              Assign checklist
            </Button>
          </div>
        )}
      </div>

      <WorkflowStrip
        active={s.publishedDrawings > 0 ? 2 : 0}
        steps={
          isClient
            ? [
                { label: "Access project", hint: "Your assigned work" },
                { label: "View drawings", hint: "Published only" },
                { label: "Raise concerns", hint: "RFIs" },
                { label: "Read packs", hint: "Reports" },
              ]
            : [
                { label: "Upload drawings", hint: "GFC register" },
                { label: "Publish gate", hint: "Unlocks QA fills" },
                { label: "Assign + fill", hint: "Checklist vs drawing" },
                { label: "RFI & close-out", hint: "Ball-in-court" },
              ]
        }
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Published drawings" value={s.publishedDrawings ?? "—"} hint={`${s.drawings ?? 0} total`} />
        <Stat label="Open RFIs" value={s.openRfis ?? "—"} />
        <Stat label="Inspections" value={s.inspections ?? "—"} />
        <Stat label="Team + vendors" value={`${overview?.members?.length ?? 0} / ${overview?.vendors?.length ?? 0}`} />
      </div>

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
        <Card className="border-amber-200 bg-amber-50/50">
          <div className="font-semibold text-warn">Gate locked</div>
          <p className="text-sm text-steel-muted mt-1">
            Publish at least one drawing before engineers can fill checklists against a sheet.
          </p>
          <Button className="mt-3" onClick={() => navigate(`/projects/${id}/drawings?upload=1`)}>
            Upload drawing
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
