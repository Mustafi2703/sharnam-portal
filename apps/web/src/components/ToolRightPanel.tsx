import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { RoleKey } from "@sharnam/shared";
import { Button, Input, TextArea } from "./ui";
import { api } from "../api";
import { useAuth } from "../auth";

export type RightPanelContext = {
  projectId: string;
  projectCode?: string;
  projectName?: string;
  publishedCount: number;
  /** Active tool path segment e.g. drawings, rfis, diary */
  tool: string;
  moduleLabel: string;
  role?: RoleKey;
};

type Action = { label: string; to?: string; onClick?: () => void; primary?: boolean; secondary?: boolean; disabled?: boolean; danger?: boolean };

type DeleteOption = { id: string; label: string; endpoint: string };

/** Only actions for the selected tool — Procore-style contextual panel */
export function ToolRightPanel({
  ctx,
  onUploadDrawing,
  onAssignChecklist,
}: {
  ctx: RightPanelContext;
  onUploadDrawing?: () => void;
  onAssignChecklist?: () => void;
}) {
  const navigate = useNavigate();
  const { token } = useAuth();
  const isClient = ctx.role === "client";
  const canUpload = ctx.role && ctx.role !== "client";
  const canFill = ctx.role && ["admin", "office", "site_employee", "employee", "vendor"].includes(ctx.role);
  const canEmail = ctx.role && ["admin", "office", "employee", "site_employee"].includes(ctx.role);
  const canDelete = ctx.role && ["admin", "office"].includes(ctx.role);
  const tool = ctx.tool || "";

  const [composeOpen, setComposeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailMsg, setEmailMsg] = useState("");
  const [deleteOptions, setDeleteOptions] = useState<DeleteOption[]>([]);
  const [deleteId, setDeleteId] = useState("");
  const [deleteMsg, setDeleteMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const toolEmailSubject = useMemo(() => {
    const label = ctx.moduleLabel || tool || "project";
    return `${label} — ${ctx.projectCode || "project"}`;
  }, [ctx.moduleLabel, ctx.projectCode, tool]);

  const actions: Action[] = [];

  function openCompose(prefill?: string) {
    setEmailSubject(prefill || toolEmailSubject);
    setEmailBody("");
    setEmailMsg("");
    setComposeOpen(true);
    setDeleteOpen(false);
  }

  async function loadDeleteOptions() {
    setDeleteMsg("");
    setDeleteId("");
    setDeleteOptions([]);
    try {
      let opts: DeleteOption[] = [];
      if (tool === "rfis") {
        const data = await api<{ rfis: any[] }>(`/api/rfis/project/${ctx.projectId}`, { token });
        opts = (data.rfis || []).slice(0, 40).map((r) => ({
          id: r.id,
          label: `${r.number} — ${r.subject}`,
          endpoint: `/api/rfis/${r.id}`,
        }));
      } else if (tool === "photos") {
        const data = await api<{ photos: any[] }>(`/api/directory/project/${ctx.projectId}/photos`, { token });
        opts = (data.photos || []).slice(0, 40).map((p) => ({
          id: p.id,
          label: `${p.album || "Photo"} — ${p.description || p.fileUrl?.split("/").pop() || p.id}`,
          endpoint: `/api/directory/photos/${p.id}`,
        }));
      } else if (tool === "inspections") {
        const data = await api<{ inspections: any[] }>(`/api/inspections/project/${ctx.projectId}`, { token });
        opts = (data.inspections || []).slice(0, 40).map((i) => ({
          id: i.id,
          label: `${i.title} (${i.status})`,
          endpoint: `/api/inspections/${i.id}`,
        }));
      } else if (tool === "checklist" || tool === "quality-inspections") {
        const type = tool === "quality-inspections" ? "QualityInspection" : "SiteExecution";
        const data = await api<{ assignments: any[] }>(
          `/api/checklist/project/${ctx.projectId}?type=${encodeURIComponent(type)}`,
          { token }
        );
        opts = (data.assignments || []).slice(0, 40).map((a: any) => ({
          id: a.id,
          label: a.template?.name || a.id,
          endpoint: `/api/checklist/assignments/${a.id}`,
        }));
      } else if (tool === "comms") {
        const data = await api<any[]>(`/api/comms/contacts/${ctx.projectId}`, { token }).catch(() => []);
        opts = (Array.isArray(data) ? data : []).slice(0, 40).map((c: any) => ({
          id: c.id,
          label: `${c.name} · ${c.company || c.designation || "contact"}`,
          endpoint: `/api/comms/contacts/${c.id}`,
        }));
      } else if (tool === "submittals") {
        const data = await api<any[]>(`/api/directory/project/${ctx.projectId}/submittals`, { token });
        opts = data.slice(0, 40).map((s) => ({
          id: s.id,
          label: `${s.number} — ${s.title}`,
          endpoint: `/api/directory/submittals/${s.id}`,
        }));
      } else if (tool === "coordination") {
        const ov = await api<any>(`/api/directory/project/${ctx.projectId}/overview`, { token });
        opts = (ov.coordination || []).slice(0, 40).map((c: any) => ({
          id: c.id,
          label: c.title || c.id,
          endpoint: `/api/directory/coordination/${c.id}`,
        }));
      }
      setDeleteOptions(opts);
      if (!opts.length) setDeleteMsg("Nothing to delete for this tool yet.");
    } catch (err) {
      setDeleteMsg(err instanceof Error ? err.message : "Could not load records");
    }
  }

  function openDelete() {
    setComposeOpen(false);
    setDeleteOpen(true);
    void loadDeleteOptions();
  }

  if (isClient) {
    if (!tool || tool === "") {
      actions.push(
        { label: "View drawings", to: "drawings", primary: true },
        { label: "Raise concern / RFI", to: "rfis", secondary: true },
        { label: "DPR / WPR packs", to: "reports", secondary: true }
      );
    } else if (tool === "drawings") {
      actions.push({ label: "View published sheets", to: "drawings", primary: true });
    } else if (tool === "rfis") {
      actions.push({ label: "Raise concern", to: "rfis", primary: true });
    } else if (tool === "reports" || tool === "comms") {
      actions.push({ label: "Open reports", to: "reports", primary: true });
    }
  } else {
    switch (tool) {
      case "drawings":
        if (canUpload) {
          actions.push(
            { label: "Upload drawing", onClick: () => (onUploadDrawing ? onUploadDrawing() : navigate(`/projects/${ctx.projectId}/drawings?upload=1`)), primary: true },
            { label: "Upload revision", to: "drawings/upload-revision", secondary: true },
            { label: "Assign checklist type", onClick: () => (onAssignChecklist ? onAssignChecklist() : navigate(`/projects/${ctx.projectId}/checklist/assign`)), secondary: true }
          );
        }
        break;
      case "dms":
        if (canUpload) {
          actions.push(
            { label: "Upload to current folder", to: "dms", primary: true },
            { label: "Assign checklist types", onClick: () => navigate(`/projects/${ctx.projectId}/checklist/assign`), secondary: true },
            {
              label: "Raise drawing fill RFI",
              onClick: () => navigate(`/projects/${ctx.projectId}/rfis?kind=DrawingChecklist`),
              secondary: true,
            }
          );
        }
        break;
      case "quality-inspections":
      case "checklist":
        if (canFill) {
          actions.push(
            {
              label: tool === "quality-inspections" ? "QI templates (legacy)" : "Site checklists",
              to: tool === "quality-inspections" ? "quality-inspections" : "checklist",
              primary: true,
            },
            { label: "Assign checklist type", onClick: () => navigate(`/projects/${ctx.projectId}/checklist/assign`), secondary: true },
            {
              label: "Request checklist fill",
              onClick: () =>
                navigate(
                  `/projects/${ctx.projectId}/rfis?kind=${tool === "quality-inspections" ? "QualityInspection" : "DrawingChecklist"}`
                ),
              secondary: true,
            },
            { label: "Quality Inspections (Procore)", to: "inspections", secondary: true }
          );
        }
        break;
      case "inspections":
        if (canFill) {
          actions.push(
            { label: "New Quality Inspection", to: "inspections", primary: true },
            { label: "Open Safety", to: "safety", secondary: true },
            {
              label: "Request QI fill",
              onClick: () => navigate(`/projects/${ctx.projectId}/rfis?kind=QualityInspection`),
              secondary: true,
            }
          );
        }
        break;
      case "safety":
        if (canFill) {
          actions.push(
            { label: "Log safety observation", to: "safety", primary: true },
            { label: "Quality Inspections", to: "inspections", secondary: true }
          );
        }
        break;
      case "rfis":
        actions.push(
          { label: "Create RFI", to: "rfis", primary: true },
          { label: "Link drawing / checklist", to: "rfis", secondary: true },
          { label: "Open Final Index", to: "checklist", secondary: true }
        );
        break;
      case "diary":
        if (canFill) actions.push({ label: "Add manpower / notes", to: "diary", primary: true }, { label: "Attach photos", to: "photos", secondary: true });
        break;
      case "photos":
        if (canUpload || canFill) actions.push({ label: "Upload photo", to: "photos", primary: true });
        break;
      case "submittals":
        if (canUpload) actions.push({ label: "Create submittal", to: "submittals", primary: true }, { label: "Open register", to: "submittals", secondary: true });
        break;
      case "comms":
        if (canUpload) {
          actions.push(
            { label: "Edit communication matrix", to: "comms", primary: true },
            { label: "Generate agenda", to: "comms", secondary: true },
            { label: "Start MoM", to: "comms", secondary: true }
          );
        }
        break;
      case "reports":
        actions.push({ label: "Download DPR", to: "reports", primary: true }, { label: "Download WPR", to: "reports", secondary: true }, { label: "Open day log", to: "diary", secondary: true });
        break;
      case "cost":
        if (canUpload) actions.push({ label: "COP / vendor bills", to: "cost", primary: true }, { label: "Measurement sheet", to: "cost", secondary: true });
        break;
      case "directory":
      case "vendors":
        if (canUpload) actions.push({ label: "Assign employee", to: "directory", primary: true }, { label: "Assign vendor", to: "vendors", secondary: true }, { label: "Open HRM master", onClick: () => navigate("/hrm"), secondary: true });
        break;
      case "coordination":
        if (canUpload) actions.push({ label: "Log coordination issue", to: "coordination", primary: true }, { label: "Escalate to RFI", to: "rfis", secondary: true });
        break;
      case "email":
        if (canEmail) actions.push({ label: "Compose email", onClick: () => openCompose(), primary: true }, { label: "Email settings", to: "email", secondary: true });
        break;
      default:
        actions.push(
          { label: "Open Drawings", to: "drawings", primary: true },
          { label: "Open Quality", to: "inspections", secondary: true },
          { label: "Meetings / MoM", to: "comms", secondary: true }
        );
        break;
    }
  }

  if (canEmail && (tool === "email" || tool === "comms")) {
    actions.push({ label: "Send email", onClick: () => openCompose(), secondary: true });
  }
  if (canDelete && ["rfis", "photos", "inspections", "checklist", "quality-inspections", "comms", "submittals", "coordination"].includes(tool)) {
    actions.push({ label: "Delete…", onClick: () => openDelete(), secondary: true, danger: true });
  }

  function go(a: Action) {
    if (a.disabled) return;
    if (a.onClick) a.onClick();
    else if (a.to) navigate(`/projects/${ctx.projectId}/${a.to}`);
  }

  async function sendEmail(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setEmailMsg("");
    try {
      await api(`/api/projects/${ctx.projectId}/emails/send`, {
        method: "POST",
        token,
        body: JSON.stringify({
          subject: emailSubject || toolEmailSubject,
          body: emailBody || `Notice from ${ctx.moduleLabel} on ${ctx.projectName || ctx.projectCode}.`,
          context: `tool.${tool || "overview"}`,
        }),
      });
      setEmailMsg("Queued to project outbox.");
      setEmailBody("");
    } catch (err) {
      setEmailMsg(err instanceof Error ? err.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    const opt = deleteOptions.find((o) => o.id === deleteId);
    if (!opt) {
      setDeleteMsg("Select a record to delete.");
      return;
    }
    if (!window.confirm(`Delete “${opt.label}”? This cannot be undone.`)) return;
    setBusy(true);
    setDeleteMsg("");
    try {
      await api(opt.endpoint, { method: "DELETE", token });
      setDeleteMsg("Deleted.");
      await loadDeleteOptions();
    } catch (err) {
      setDeleteMsg(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="border-t xl:border-t-0 xl:border-l border-line bg-paper flex flex-col min-h-full">
      <div className="px-4 py-4 border-b border-line">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-steel-muted">Actions</div>
        <div className="font-display text-base mt-1.5 text-ink leading-snug">{ctx.moduleLabel}</div>
        <div className="text-xs text-steel-muted mt-1 capitalize">{tool || "overview"}</div>
      </div>

      <div className="p-4 space-y-4 flex-1">
        {(tool === "checklist" || tool === "quality-inspections" || tool === "inspections" || tool === "safety" || tool === "rfis") && (
          <div className="rounded-[var(--ui-radius,10px)] border border-line bg-sand/60 p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-steel-muted">Quality module</div>
            <p className="text-xs text-steel-muted mt-2 leading-relaxed">
              Quality Inspections and Safety are separate tools. QI checklist forms and QI fill RFIs are also under Quality — not mixed with Drawings.
            </p>
          </div>
        )}

        <div className="space-y-2.5">
          {actions.map((a) => (
            <Button
              key={a.label}
              type="button"
              variant={a.danger ? "ghost" : a.primary ? "primary" : "secondary"}
              className={`w-full !justify-start !text-sm !py-2.5 ${a.danger ? "!text-danger border border-danger/30" : ""}`}
              disabled={a.disabled}
              onClick={() => go(a)}
            >
              {a.label}
            </Button>
          ))}
          {!actions.length && <p className="text-sm text-steel-muted">No actions for this view.</p>}
        </div>

        {composeOpen && canEmail && (
          <form onSubmit={sendEmail} className="rounded-[var(--ui-radius,10px)] border border-line bg-sand/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-mono uppercase tracking-wider text-steel-muted">Send email</div>
              <button type="button" className="text-xs text-steel-muted" onClick={() => setComposeOpen(false)}>
                Close
              </button>
            </div>
            <Input
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="Subject"
              required
            />
            <TextArea
              rows={4}
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              placeholder="Message body"
              required
            />
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Sending…" : "Send to project list"}
            </Button>
            {emailMsg && <p className="text-xs text-steel-muted">{emailMsg}</p>}
            <Link to={`/projects/${ctx.projectId}/email`} className="text-xs text-brand font-semibold block">
              Open email settings / outbox →
            </Link>
          </form>
        )}

        {deleteOpen && canDelete && (
          <div className="rounded-[var(--ui-radius,10px)] border border-danger/25 bg-white p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-mono uppercase tracking-wider text-danger">Delete</div>
              <button type="button" className="text-xs text-steel-muted" onClick={() => setDeleteOpen(false)}>
                Close
              </button>
            </div>
            <select
              className="w-full border border-line rounded-md px-2 py-2 text-sm bg-white"
              value={deleteId}
              onChange={(e) => setDeleteId(e.target.value)}
            >
              <option value="">Select record…</option>
              {deleteOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <Button type="button" variant="ghost" className="w-full !text-danger border border-danger/30" disabled={busy} onClick={() => void confirmDelete()}>
              Confirm delete
            </Button>
            {deleteMsg && <p className="text-xs text-steel-muted">{deleteMsg}</p>}
          </div>
        )}

        <div className="pt-3 border-t border-line">
          <p className="text-[10px] font-mono uppercase tracking-wider text-steel-muted mb-2">Related</p>
          <div className="flex flex-col gap-1">
            {(tool === "rfis"
              ? [
                  ["drawings", "GFC register"],
                  ["checklist", "Final Index"],
                  ["comms", "Matrix"],
                ]
              : tool === "diary"
                ? [
                    ["photos", "Photos"],
                    ["reports", "DPR / WPR"],
                    ["rfis", "RFIs"],
                  ]
                : tool === "comms"
                  ? [
                      ["directory", "Directory"],
                      ["rfis", "RFIs"],
                      ["reports", "DPR"],
                    ]
                  : tool === "inspections" || tool === "safety"
                    ? [
                        ["inspections", "Quality Inspections"],
                        ["safety", "Safety"],
                        ["rfis", "QI fill RFIs"],
                      ]
                    : tool === "checklist" || tool === "quality-inspections"
                      ? [
                          ["inspections", "Quality Inspections"],
                          ["safety", "Safety"],
                          ["email", "Email"],
                        ]
                      : [
                          ["drawings", "Drawings"],
                          ["rfis", "RFIs"],
                          ["email", "Email"],
                        ]
            ).map(([path, label]) => (
              <Link
                key={path}
                to={`/projects/${ctx.projectId}/${path}`}
                className="text-sm text-ink/80 hover:text-brand px-1 py-1.5 rounded hover:bg-brand-soft/60"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-line text-xs text-steel-muted">
        <div className="font-mono truncate">{ctx.projectCode || "—"}</div>
        <div className="truncate mt-0.5">{ctx.projectName || "Project"}</div>
      </div>
    </aside>
  );
}
