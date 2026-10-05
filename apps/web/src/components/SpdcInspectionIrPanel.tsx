import { useMemo, useState } from "react";
import { Badge, Button, Input, Select } from "./ui";
import { api } from "../api";
import { useAuth } from "../auth";
import { downloadAuthFile } from "../lib/downloadReport";
import {
  SAFETY_CLEARANCE_CODES,
  clearanceExpired,
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
  onUpdated?: () => void | Promise<void>;
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
  onUpdated,
}: Props) {
  const [busy, setBusy] = useState<"xlsx" | "html" | null>(null);
  const { user } = useAuth();
  const canClear = ["admin", "office", "employee", "site_employee"].includes(user?.role || "");
  const [clr, setClr] = useState({ clearanceResult: "", validUpTo: "", actionRequired: "" });
  const [clrBusy, setClrBusy] = useState(false);
  const [clrMsg, setClrMsg] = useState("");
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

      {rfi.rfiKind === "SafetyIR" && (
        <div className={`rounded-lg border p-3 space-y-2 ${clearanceExpired(form, rfi.status) ? "border-red-300 bg-red-50" : "border-line bg-sand/30"}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-steel-muted">Clearance (PMC at the work front)</span>
            {form.clearanceResult ? (
              <Badge tone={/^S[12]/.test(form.clearanceResult) ? (clearanceExpired(form, rfi.status) ? "danger" : "ok") : "danger"}>
                {form.clearanceResult}
                {clearanceExpired(form, rfi.status) ? " · EXPIRED — re-offer before continuing" : ""}
              </Badge>
            ) : (
              <Badge tone="warn">Awaiting inspection</Badge>
            )}
          </div>
          {form.validUpTo ? <p className="text-[11px] text-steel-muted">Valid up to {new Date(form.validUpTo).toLocaleString("en-GB")}{form.inspectedBy ? ` · inspected by ${form.inspectedBy}` : ""}</p> : null}
          {canClear && (
            <div className="grid sm:grid-cols-3 gap-2 items-end">
              <Select label="Result" value={clr.clearanceResult} onChange={(e) => setClr({ ...clr, clearanceResult: e.target.value })}>
                <option value="">Select S1–S4</option>
                {SAFETY_CLEARANCE_CODES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
              <Input label="Valid up to" type="datetime-local" value={clr.validUpTo} onChange={(e) => setClr({ ...clr, validUpTo: e.target.value })} />
              <Input label="Conditions / action required" value={clr.actionRequired} onChange={(e) => setClr({ ...clr, actionRequired: e.target.value })} />
              <div className="sm:col-span-3 flex items-center gap-2">
                <Button
                  type="button"
                  className="!text-xs"
                  disabled={clrBusy || !clr.clearanceResult || (/^S[12]/.test(clr.clearanceResult) && !clr.validUpTo)}
                  onClick={async () => {
                    setClrBusy(true);
                    setClrMsg("");
                    try {
                      await api(`/api/rfis/${rfi.id}`, { method: "PATCH", token, body: JSON.stringify({ formPatch: { ...clr, inspectedBy: user?.fullName || "" } }) });
                      setClrMsg(`Recorded ${clr.clearanceResult.slice(0, 2)}.`);
                      setClr({ clearanceResult: "", validUpTo: "", actionRequired: "" });
                      await onUpdated?.();
                    } catch (err) {
                      setClrMsg(err instanceof Error ? err.message : "Could not record the result");
                    } finally {
                      setClrBusy(false);
                    }
                  }}
                >
                  {clrBusy ? "Saving…" : "Record clearance"}
                </Button>
                <span className="text-[11px] text-steel-muted">{clrMsg || "S1/S2 need a validity time; clearance lapses after it, on scope change, weather, PTW expiry or any incident."}</span>
              </div>
            </div>
          )}
        </div>
      )}

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
