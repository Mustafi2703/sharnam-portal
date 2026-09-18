import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { PieChart } from "../../components/PieChart";
import { Badge, Button, Card, Stat } from "../../components/ui";
import { DailySheetWorkflow } from "../../components/DailySheetWorkflow";
import { WorkPackagesPanel } from "../../components/WorkPackagesPanel";
import { ToolLink } from "../../components/ToolLink";
import { DirectoryMySignaturePanel } from "../../components/DirectoryMySignaturePanel";
import { ProjectManageActions, type ManageableProject } from "../../components/ProjectManageActions";
import { canBulkProvisionSheets } from "../../lib/productionUi";

export default function ProjectHomePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [overview, setOverview] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [safety, setSafety] = useState<any>(null);
  const [pack, setPack] = useState<any>(null);
  const [packBusy, setPackBusy] = useState(false);
  const [packMsg, setPackMsg] = useState("");
  const [projectCard, setProjectCard] = useState<ManageableProject | null>(null);
  const isClient = user?.role === "client";
  const isVendor = user?.role === "vendor";
  const canUpload = user && user.role !== "client" && user.role !== "vendor";
  const canManageProject = user?.role === "admin" || user?.role === "office";

  useEffect(() => {
    api(`/api/directory/project/${id}/overview`, { token }).then(setOverview).catch(console.error);
    api(`/api/progress/${id}/summary`, { token }).then(setProgress).catch(() => setProgress(null));
    api(`/api/checklist/project/${id}/safety-dashboard`, { token }).then(setSafety).catch(() => setSafety(null));
    api(`/api/projects/${id}/sheet-pack`, { token }).then(setPack).catch(() => setPack(null));
    api<ManageableProject>(`/api/projects/${id}`, { token }).then(setProjectCard).catch(() => setProjectCard(null));
  }, [id, token]);

  async function provisionSheets() {
    if (!id) return;
    setPackBusy(true);
    setPackMsg("");
    try {
      const out = await api<{ pack: unknown; steps: { key: string; ok: boolean; error?: string }[] }>(
        `/api/projects/${id}/provision-sheets`,
        { method: "POST", token, body: JSON.stringify({}) }
      );
      setPack(out.pack);
      const failed = out.steps.filter((s) => !s.ok);
      setPackMsg(failed.length ? `Gaps: ${failed.map((s) => s.key).join(", ")}` : "Sheets loaded.");
      api(`/api/progress/${id}/summary`, { token }).then(setProgress).catch(() => null);
    } catch (err) {
      setPackMsg(err instanceof Error ? err.message : "Sheet load failed");
    } finally {
      setPackBusy(false);
    }
  }

  const s = overview?.stats || {};
  const pt = progress?.totals || {};
  const hasProgressData =
    (pt.milestones ?? 0) > 0 ||
    (pt.openHindrance ?? 0) > 0 ||
    (pt.openRisk ?? 0) > 0 ||
    (safety?.totals?.records ?? 0) > 0 ||
    (progress?.charts?.milestoneByStatus || []).some((x: { value?: number }) => Number(x.value) > 0);

  const tools = isVendor
    ? [
        ["checklist", "Checklist fills", "Fill assigned quality / drawing-check sheets", "QA", "#2F6F4E"],
        ["quality-inspections", "Quality inspections", "QI forms assigned to your company", "QI", "#2F6F4E"],
        ["rfis", "RFIs + checklist requests", "Respond and fill linked checklists", "RFI", "#0B6A78"],
        ["drawings/precheck", "Drawing check", "Fill the drawing-check gate", "DWG", "#E4632A"],
        ["safety", "Safety fills", "Observations assigned to you", "SAF", "#1C4A5A"],
        ["comms", "Meetings", "Agenda and MoM visibility", "MTG", "#C24D1A"],
        ["photos", "Photos", "Upload field images for fills", "PIC", "#1C4A5A"],
      ]
    : isClient
    ? [
        ["drawings", "Drawings", "Published GFC sheets — view only", "DWG", "#E4632A"],
        ["drawings/coordination", "Design coordination", "View clash / design issues", "DC", "#2563EB"],
        ["rfis", "Concerns / RFIs", "Raise questions without upload control", "RFI", "#0B6A78"],
        ["reports", "Reports", "Weekly packs & DPR visibility", "RPT", "#3D4450"],
        ["checklist", "Checklist catalog", "See assigned types (fills are site-side)", "QA", "#2F6F4E"],
        ["comms", "Meetings", "Schedule visibility", "MTG", "#C24D1A"],
        ["safety", "Safety", "Observations shared with client", "SAF", "#1C4A5A"],
      ]
    : [
        ["dpr-maker", "DPR maker", "Fill INPUT → publish SPDC template XLSX", "DPR", "#E4632A"],
        ["wpr-maker", "WPR maker", "24-section weekly pack with photos", "WPR", "#C45C26"],
        ["drawings", "Drawings", "Upload, revise, publish sheets", "DWG", "#E4632A"],
        ["drawings/coordination", "Design coordination", "Clash register · escalate to Ask RFI", "DC", "#2563EB"],
        ["dms", "Documents", "OneDrive-style project docs", "DOC", "#3D4450"],
        ["checklist", "Final Index", "Assign types · fill vs drawing", "FI", "#0B6A78"],
        ["quality-inspections", "Quality Inspections", "QI forms vs published sheets", "QI", "#2F6F4E"],
        ["inspections", "Quality Action Plan", "Track open QI actions", "QAP", "#3D4450"],
        ["comms", "Matrix · Agenda · MoM", "Agenda before MoM · follow-up", "MTG", "#C24D1A"],
        ["reports", "DPR / WPR log", "Published packs · registers · downloads", "RPT", "#3D4450"],
        ["diary", "Day log", "Manpower & field notes", "FLD", "#0B6A78"],
        ["rfis", "RFIs + checklist", "Anyone raises · matrix responds", "RFI", "#0B6A78"],
        ["submittals", "Submittals", "Draft → review → approve", "SUB", "#C24D1A"],
        ["photos", "Photos", "Albums · upload field images", "PIC", "#1C4A5A"],
        ["safety", "Safety", "Observations & incidents", "SAF", "#1C4A5A"],
        ["cost", "Cost / COP / bills", "Measurement + vendor bill tracker", "₹", "#2F6F4E"],
        ...(canManageProject
          ? ([["setup", "Project setup", "People, vendors, matrix, Complete setup, invites", "SET", "#0B6A78"]] as const)
          : []),
        ["directory", "Directory", "Assign people to project", "DIR", "#3D4450"],
        ["vendors", "Vendors", "Trade partners on project", "VEN", "#C24D1A"],
        ["email", "Email settings", "Notification recipients", "EML", "#1C4A5A"],
      ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brand mb-1">
            {isVendor ? "Contractor project desk" : isClient ? "Client project desk" : "Project overview"}
          </p>
          <h2 className="font-display text-2xl">{isClient || isVendor ? "Project desk" : projectCard?.name || "Project overview"}</h2>
          {projectCard?.code ? <p className="font-mono text-xs text-steel-muted mt-1">{projectCard.code}</p> : null}
        </div>
      </div>

      {isVendor && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="!text-xs" onClick={() => navigate("/crm/vendor-bids")}>
            Bid management
          </Button>
          <Button type="button" variant="secondary" className="!text-xs" onClick={() => navigate(`/projects/${id}/checklist`)}>
            Checklists
          </Button>
          <Button type="button" variant="secondary" className="!text-xs" onClick={() => navigate(`/projects/${id}/rfis`)}>
            RFIs
          </Button>
          <Button type="button" variant="secondary" className="!text-xs" onClick={() => navigate(`/projects/${id}/hub/quality`)}>
            Quality
          </Button>
        </div>
      )}

      {id && token && <DirectoryMySignaturePanel projectId={id} token={token} compact />}

      {canManageProject && id && (
        <div className="grid lg:grid-cols-[1fr_auto] gap-4 items-start">
          <WorkPackagesPanel token={token} projectId={id} />
          {projectCard && token ? (
            <Card className="!p-4 shrink-0">
              <h3 className="font-semibold text-sm mb-2">Project admin</h3>
              <ProjectManageActions
                project={projectCard}
                token={token}
                onChanged={async () => {
                  try {
                    setProjectCard(await api<ManageableProject>(`/api/projects/${id}`, { token }));
                  } catch {
                    /* keep current card */
                  }
                }}
              />
            </Card>
          ) : null}
        </div>
      )}

      {!isClient && !isVendor && (
        <div className="space-y-2">
          <DailySheetWorkflow
            projectId={id!}
            pack={pack?.summary}
            checks={pack?.checks}
            canProvision={canBulkProvisionSheets(user?.role)}
            busy={packBusy}
            onProvision={() => void provisionSheets()}
          />
          {packMsg && <p className="text-sm text-brand bg-brand-soft px-3 py-2 rounded-sm">{packMsg}</p>}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Published drawings" value={s.publishedDrawings ?? "—"} hint={`${s.drawings ?? 0} total`} />
        <Stat label="Open RFIs" value={s.openRfis ?? "—"} />
        <Stat label="Open hindrances" value={pt.openHindrance ?? "—"} />
        <Stat
          label="Project progress"
          value={pt.projectProgressPct != null ? `${Math.round(pt.projectProgressPct * 100)}%` : "—"}
        />
      </div>

      {(progress || safety) && hasProgressData && (
        <div className="rounded-sm border border-line bg-gradient-to-br from-[#F7F8FA] via-white to-[#F0F4F3] p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-steel-muted">Workday-style project dashboard</p>
              <h3 className="font-display text-xl text-ink">Progress · Safety · Hindrance</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <ToolLink to={`/projects/${id}/progress`} newWindow windowLabel="Progress" className="text-xs font-semibold text-brand">
                Progress →
              </ToolLink>
              <ToolLink to={`/projects/${id}/safety`} newWindow windowLabel="Safety" className="text-xs font-semibold text-brand">
                Safety →
              </ToolLink>
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

      {!isClient && !isVendor && !hasProgressData && (
        <Card className="border-dashed border-line bg-sand/30 !p-6 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-steel-muted mb-2">Empty canvas</p>
          <h3 className="font-display text-lg text-ink">No progress or safety data yet</h3>
          <p className="text-sm text-steel-muted mt-2 max-w-lg mx-auto">
            New projects start blank. Add milestones, hindrances, or safety records from the module hubs when you begin tracking.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            <Button type="button" variant="secondary" className="!text-xs" onClick={() => navigate(`/projects/${id}/hub/progress`)}>
              Progress hub
            </Button>
            <Button type="button" variant="secondary" className="!text-xs" onClick={() => navigate(`/projects/${id}/hub/safety`)}>
              Safety hub
            </Button>
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {tools.map(([to, title, , icon, accent]) => (
          <ToolLink key={to} to={`/projects/${id}/${to}`} newWindow windowLabel={String(title)}>
            <Card className="h-full hover:border-brand/40 transition !p-3">
              <div className="flex items-center gap-3">
                <span
                  className="h-9 w-9 rounded-lg grid place-items-center text-white text-[10px] font-display shrink-0"
                  style={{ background: accent }}
                >
                  {icon}
                </span>
                <div className="font-semibold text-sm">{title}</div>
              </div>
            </Card>
          </ToolLink>
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
