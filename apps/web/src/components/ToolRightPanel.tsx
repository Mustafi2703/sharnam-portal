import { Link, useNavigate } from "react-router-dom";
import type { RoleKey } from "@sharnam/shared";
import { Badge, Button } from "./ui";

export type RightPanelContext = {
  projectId: string;
  projectCode?: string;
  projectName?: string;
  publishedCount: number;
  moduleLabel: string;
  role?: RoleKey;
};

/** Procore-style right action / context panel — module-aware */
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
  const mod = (ctx.moduleLabel || "").toLowerCase();

  return (
    <aside className="border-t lg:border-t-0 lg:border-l border-line bg-white flex flex-col min-h-full">
      <div className="px-3 py-2.5 border-b border-line">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-steel-muted">Actions</div>
        <div className="font-display text-sm mt-1 text-ink truncate">{ctx.moduleLabel}</div>
      </div>

      <div className="p-3 space-y-3 flex-1">
        <div className="rounded-lg border border-line bg-sand/50 p-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-steel-muted">Drawing gate</div>
          <div className="mt-1.5">
            <Badge tone={ctx.publishedCount > 0 ? "ok" : "warn"}>
              {ctx.publishedCount > 0 ? `${ctx.publishedCount} published` : "Locked"}
            </Badge>
          </div>
          <p className="text-[11px] text-steel-muted mt-2 leading-relaxed">
            {ctx.publishedCount > 0
              ? "Engineers can fill checklists against published sheets."
              : "Publish at least one GFC sheet to unlock fills."}
          </p>
        </div>

        {canUpload && (
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-wider text-steel-muted">Uploads</p>
            <Button
              type="button"
              className="w-full !justify-start !text-xs"
              onClick={() => (onUploadDrawing ? onUploadDrawing() : navigate(`/projects/${ctx.projectId}/drawings?upload=1`))}
            >
              Upload drawing
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full !justify-start !text-xs"
              onClick={() => navigate(`/projects/${ctx.projectId}/drawings/upload-revision`)}
            >
              Upload revision
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full !justify-start !text-xs"
              onClick={() => navigate(`/projects/${ctx.projectId}/dms`)}
            >
              Upload docs (OneDrive)
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full !justify-start !text-xs"
              onClick={() =>
                onAssignChecklist ? onAssignChecklist() : navigate(`/projects/${ctx.projectId}/checklist/assign`)
              }
            >
              Assign checklist type
            </Button>
          </div>
        )}

        {(mod.includes("comm") || mod.includes("home")) && canUpload && (
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-wider text-steel-muted">Communications</p>
            <Button
              type="button"
              variant="secondary"
              className="w-full !justify-start !text-xs"
              onClick={() => navigate(`/projects/${ctx.projectId}/comms`)}
            >
              Matrix · Agenda · MoM
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full !justify-start !text-xs"
              onClick={() => navigate(`/projects/${ctx.projectId}/reports`)}
            >
              DPR / daily pack
            </Button>
          </div>
        )}

        {(mod.includes("cost") || mod.includes("home")) && canUpload && !isClient && (
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-wider text-steel-muted">Cost</p>
            <Button
              type="button"
              variant="secondary"
              className="w-full !justify-start !text-xs"
              onClick={() => navigate(`/projects/${ctx.projectId}/cost?tab=bills`)}
            >
              COP / vendor bills
            </Button>
          </div>
        )}

        {(mod.includes("quality") || mod.includes("field") || mod.includes("home")) && canFill && (
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-wider text-steel-muted">Quality & field</p>
            <Button
              type="button"
              variant="secondary"
              className="w-full !justify-start !text-xs"
              disabled={ctx.publishedCount === 0}
              onClick={() => navigate(`/projects/${ctx.projectId}/checklist`)}
            >
              Final Index forms
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full !justify-start !text-xs"
              onClick={() => navigate(`/projects/${ctx.projectId}/rfis`)}
            >
              RFIs + checklist attach
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full !justify-start !text-xs"
              onClick={() => navigate(`/projects/${ctx.projectId}/safety`)}
            >
              Safety records
            </Button>
          </div>
        )}

        {isClient && (
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-wider text-steel-muted">Client view</p>
            <Button
              type="button"
              className="w-full !justify-start !text-xs"
              onClick={() => navigate(`/projects/${ctx.projectId}/drawings`)}
            >
              View published drawings
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full !justify-start !text-xs"
              onClick={() => navigate(`/projects/${ctx.projectId}/rfis`)}
            >
              Raise a concern
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full !justify-start !text-xs"
              onClick={() => navigate(`/projects/${ctx.projectId}/reports`)}
            >
              Weekly packs / DPR
            </Button>
          </div>
        )}

        <div className="space-y-1.5 pt-2 border-t border-line">
          <p className="text-[10px] font-mono uppercase tracking-wider text-steel-muted">Jump</p>
          {[
            ["drawings", "GFC / revisions"],
            ["dms", "Documents"],
            ["checklist", "Final Index"],
            ["rfis", "RFIs"],
            ["comms", "Comms (MoM)"],
            ["reports", "DPR"],
            ["safety", "Safety"],
            ["cost", "Cost / COP"],
            ["directory", "Directory"],
            ["vendors", "Vendors"],
            ["diary", "Day log"],
          ].map(([path, label]) => (
            <Link
              key={path}
              to={`/projects/${ctx.projectId}/${path}`}
              className="block text-[13px] text-ink/80 hover:text-brand px-1 py-1 rounded hover:bg-brand-soft/50"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="px-3 py-3 border-t border-line text-[10px] text-steel-muted">
        <div className="font-mono truncate">{ctx.projectCode || "—"}</div>
        <div className="truncate">{ctx.projectName || "Project"}</div>
      </div>
    </aside>
  );
}
