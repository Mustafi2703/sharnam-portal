import { Link, useNavigate } from "react-router-dom";
import type { RoleKey } from "@sharnam/shared";
import { Badge, Button } from "./ui";

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

type Action = { label: string; to?: string; onClick?: () => void; primary?: boolean; secondary?: boolean; disabled?: boolean };

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
  const isClient = ctx.role === "client";
  const canUpload = ctx.role && ctx.role !== "client";
  const canFill = ctx.role && ["admin", "office", "site_employee", "employee", "vendor"].includes(ctx.role);
  const tool = ctx.tool || "";

  const actions: Action[] = [];

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
        if (canUpload) actions.push({ label: "Upload to current folder", to: "dms", primary: true });
        break;
      case "checklist":
      case "quality-inspections":
        if (canFill) {
          actions.push(
            { label: "Open Final Index", to: "checklist", primary: true, disabled: ctx.publishedCount === 0 },
            { label: "Assign checklist", onClick: () => navigate(`/projects/${ctx.projectId}/checklist/assign`), secondary: true }
          );
        }
        if (canUpload) actions.push({ label: "Upload drawing first", to: "drawings", secondary: true });
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
      case "safety":
        if (canFill) actions.push({ label: "Log observation", to: "safety", primary: true });
        break;
      case "directory":
      case "vendors":
        if (canUpload) actions.push({ label: "Assign employee", to: "directory", primary: true }, { label: "Assign vendor", to: "vendors", secondary: true }, { label: "Open HRM master", onClick: () => navigate("/hrm"), secondary: true });
        break;
      case "coordination":
        if (canUpload) actions.push({ label: "Log coordination issue", to: "coordination", primary: true }, { label: "Escalate to RFI", to: "rfis", secondary: true });
        break;
      case "inspections":
        if (canFill) actions.push({ label: "Open action plan", to: "inspections", primary: true });
        break;
      default:
        // Overview / home — essentials only
        if (canUpload) {
          actions.push(
            { label: "Upload drawing", onClick: () => navigate(`/projects/${ctx.projectId}/drawings?upload=1`), primary: true },
            { label: "Create RFI", to: "rfis", secondary: true },
            { label: "Day log", to: "diary", secondary: true },
            { label: "Comms matrix", to: "comms", secondary: true }
          );
        }
        break;
    }
  }

  function go(a: Action) {
    if (a.disabled) return;
    if (a.onClick) a.onClick();
    else if (a.to) navigate(`/projects/${ctx.projectId}/${a.to}`);
  }

  return (
    <aside className="border-t xl:border-t-0 xl:border-l border-line bg-paper flex flex-col min-h-full">
      <div className="px-4 py-4 border-b border-line">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-steel-muted">Actions</div>
        <div className="font-display text-base mt-1.5 text-ink leading-snug">{ctx.moduleLabel}</div>
        <div className="text-xs text-steel-muted mt-1 capitalize">{tool || "overview"}</div>
      </div>

      <div className="p-4 space-y-4 flex-1">
        {(tool === "checklist" || tool === "quality-inspections" || tool === "drawings" || !tool) && (
          <div className="rounded-[var(--ui-radius,10px)] border border-line bg-sand/60 p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-steel-muted">Drawing gate</div>
            <div className="mt-2">
              <Badge tone={ctx.publishedCount > 0 ? "ok" : "warn"}>
                {ctx.publishedCount > 0 ? `${ctx.publishedCount} published` : "Locked"}
              </Badge>
            </div>
            <p className="text-xs text-steel-muted mt-2 leading-relaxed">
              {ctx.publishedCount > 0
                ? "Checklist fills unlock against published GFC sheets."
                : "Publish a drawing to unlock checklist / QI fills."}
            </p>
          </div>
        )}

        <div className="space-y-2.5">
          {actions.map((a) => (
            <Button
              key={a.label}
              type="button"
              variant={a.primary ? "primary" : "secondary"}
              className="w-full !justify-start !text-sm !py-2.5"
              disabled={a.disabled}
              onClick={() => go(a)}
            >
              {a.label}
            </Button>
          ))}
          {!actions.length && <p className="text-sm text-steel-muted">No actions for this view.</p>}
        </div>

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
                  : [
                      ["drawings", "Drawings"],
                      ["rfis", "RFIs"],
                      ["diary", "Day log"],
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
