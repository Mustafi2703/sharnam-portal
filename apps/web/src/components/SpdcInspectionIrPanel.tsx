import { useMemo, useState } from "react";
import { Badge, Button } from "./ui";
import { downloadAuthFile } from "../lib/downloadReport";
import {
  inspectionFormForKind,
  resolveInspectionFormData,
  type InspectionFormRef,
} from "../lib/inspectionRequestForms";
import { openChecklistFillWindow } from "../lib/checklistFillWindow";

type ProjectLite = {
  code?: string;
  name?: string;
  clientName?: string | null;
  contractorName?: string | null;
  location?: string | null;
};

type Props = {
  rfi: {
    id: string;
    number: string;
    irNumber?: string | null;
    subject: string;
    question?: string | null;
    status: string;
    rfiKind: string;
    formDataJson?: string | null;
    linkedAssignmentId?: string | null;
    linkedAssignment?: { template?: { name?: string } | null } | null;
  };
  project?: ProjectLite | null;
  projectId: string;
  checklistFamily: string;
  checklistName?: string;
  token: string | null;
};

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0 border border-line bg-white rounded-md overflow-hidden">
      <div className="text-[10px] uppercase tracking-wide text-steel-muted px-2.5 pt-2 font-semibold">{label}</div>
      <div className="px-2.5 pb-2 text-sm whitespace-pre-wrap break-words">{value?.trim() ? value : "—"}</div>
    </div>
  );
}

function sectionsFromRef(ref: InspectionFormRef) {
  const sections: { title: string; fields: InspectionFormRef["fields"] }[] = [];
  let current = "";
  for (const f of ref.fields) {
    const sec = f.section || "Details";
    if (sec !== current) {
      sections.push({ title: sec, fields: [] });
      current = sec;
    }
    sections[sections.length - 1].fields.push(f);
  }
  return sections;
}

/** Structured SPDC inspection IR view — quality / safety / activity register detail. */
export function SpdcInspectionIrPanel({
  rfi,
  project,
  projectId,
  checklistFamily,
  checklistName,
  token,
}: Props) {
  const [busy, setBusy] = useState<"xlsx" | "html" | null>(null);
  const ref = inspectionFormForKind(rfi.rfiKind);
  const form = useMemo(() => resolveInspectionFormData(rfi, project || undefined), [rfi, project]);
  const sections = useMemo(() => (ref ? sectionsFromRef(ref) : []), [ref]);
  const linkedName = checklistName || rfi.linkedAssignment?.template?.name;

  if (!ref) return null;

  const fileBase = String(rfi.irNumber || rfi.number).replace(/[^\w.-]+/g, "_");

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line overflow-hidden bg-white">
        <div className="bg-[#0b6a78] text-white px-4 py-3">
          <p className="text-[10px] font-mono uppercase tracking-wider opacity-90">{ref.docNo}</p>
          <h3 className="font-display text-lg mt-0.5">{ref.title}</h3>
          <p className="text-xs mt-1 opacity-90">{ref.subtitle}</p>
        </div>
        <div className="px-4 py-2 flex flex-wrap gap-2 border-b border-line bg-sand/30">
          <Badge tone="brand">{rfi.rfiKind}</Badge>
          <Badge tone={rfi.status === "Open" ? "warn" : "ok"}>{rfi.status}</Badge>
          <span className="font-mono text-xs text-steel-muted">{rfi.number}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={!!busy}
          className="!text-xs"
          onClick={() => {
            setBusy("xlsx");
            void downloadAuthFile(`/api/rfis/${rfi.id}/inspection.xlsx`, token, `${fileBase}-IR.xlsx`).finally(() =>
              setBusy(null)
            );
          }}
        >
          {busy === "xlsx" ? "Preparing…" : "Download Excel (SPDC form)"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={!!busy}
          className="!text-xs"
          onClick={() => {
            setBusy("html");
            void downloadAuthFile(`/api/rfis/${rfi.id}/inspection.html`, token, `${fileBase}-IR.html`).finally(() =>
              setBusy(null)
            );
          }}
        >
          {busy === "html" ? "Preparing…" : "Print / PDF"}
        </Button>
      </div>

      {sections.map((sec) => (
        <div key={sec.title} className="overflow-hidden rounded-lg border border-line">
          <h4 className="bg-sand/60 text-[11px] font-semibold uppercase tracking-wide text-brand px-3 py-2">{sec.title}</h4>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3">
            {sec.fields.map((f) => (
              <div key={f.key} className={f.wide ? "sm:col-span-2 lg:col-span-3" : ""}>
                <Field label={f.label} value={form[f.key]} />
              </div>
            ))}
          </div>
        </div>
      ))}

      <Field label="Subject" value={rfi.subject} />

      {linkedName && (
        <div className="rounded-lg border-2 border-brand bg-brand-soft/30 p-4 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-brand">Linked checklist (master)</div>
          <p className="text-sm font-medium text-ink">{linkedName}</p>
          {rfi.linkedAssignmentId && (
            <Button
              type="button"
              className="!text-sm"
              onClick={() => openChecklistFillWindow(projectId, rfi.linkedAssignmentId!, checklistFamily)}
            >
              Fill linked checklist →
            </Button>
          )}
          <p className="text-[11px] text-steel-muted">
            On submit, branded Excel + print HTML sync to SharePoint under{" "}
            <code className="font-mono text-[10px]">08.02…/Safety/Submitted</code>.
          </p>
        </div>
      )}

      <details className="rounded-lg border border-line bg-sand/20">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-steel-muted">Full request body</summary>
        <pre className="text-xs whitespace-pre-wrap px-3 pb-3 text-steel-muted max-h-48 overflow-y-auto">{rfi.question}</pre>
      </details>
    </div>
  );
}
