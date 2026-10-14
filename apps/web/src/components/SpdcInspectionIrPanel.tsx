import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Input, Select } from "./ui";
import { api, mediaUrl } from "../api";
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
import { canonicalRfiKind } from "../lib/rfiModuleScope";
import { FilePickButton } from "./FilePickButton";

type ProjectLite = {
  code?: string;
  name?: string;
  clientName?: string | null;
  contractorName?: string | null;
  location?: string | null;
};

type IrAttachment = {
  url: string;
  sharePointUrl?: string | null;
  name: string;
  kind?: string;
  uploadedAt?: string;
};

type ChecklistAssignmentOpt = {
  id: string;
  templateId?: string;
  template?: { id?: string; name?: string } | null;
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
    attachmentsJson?: string | null;
    linkedAssignmentId?: string | null;
    linkedAssignment?: { template?: { name?: string } | null } | null;
  };
  project?: ProjectLite | null;
  projectId: string;
  checklistFamily: string;
  checklistName?: string;
  checklistAssignments?: ChecklistAssignmentOpt[];
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

function parseAttachments(raw?: string | null): IrAttachment[] {
  if (!raw?.trim()) return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p.filter((x) => x && (x.url || x.sharePointUrl)) : [];
  } catch {
    return [];
  }
}

/** Structured SPDC inspection IR view — quality / safety / activity register detail. */
export function SpdcInspectionIrPanel({
  rfi,
  project,
  projectId,
  checklistFamily,
  checklistName,
  checklistAssignments = [],
  token,
  onUpdated,
}: Props) {
  const [busy, setBusy] = useState<"xlsx" | "html" | null>(null);
  const { user } = useAuth();
  const canClear = ["admin", "office", "employee", "site_employee"].includes(user?.role || "");
  const canAttach = canClear || user?.role === "vendor";
  const [clr, setClr] = useState({ clearanceResult: "", validUpTo: "", actionRequired: "" });
  const [clrBusy, setClrBusy] = useState(false);
  const [clrMsg, setClrMsg] = useState("");
  const [attachBusy, setAttachBusy] = useState(false);
  const [logBusy, setLogBusy] = useState(false);
  const [evidenceMsg, setEvidenceMsg] = useState("");
  const [localAtt, setLocalAtt] = useState<IrAttachment[] | null>(null);
  const [linkId, setLinkId] = useState(rfi.linkedAssignmentId || "");
  const [linkBusy, setLinkBusy] = useState(false);
  const [fillStatus, setFillStatus] = useState<string | null>(null);
  const ref = inspectionFormForKind(rfi.rfiKind);
  const form = useMemo(() => resolveInspectionFormData(rfi, project || undefined), [rfi, project]);
  const sections = useMemo(() => (ref ? sectionsFromRef(ref) : []), [ref]);
  const linkedName =
    checklistName ||
    rfi.linkedAssignment?.template?.name ||
    checklistAssignments.find((a) => a.id === (rfi.linkedAssignmentId || linkId))?.template?.name;
  const home = canonicalRfiKind(rfi.rfiKind);
  const isSafety = home === "SafetyIR";
  const failLike =
    /reject|fail|not.?cleared|s3|s4|closed.?reject/i.test(String(rfi.status || "")) ||
    /^S[34]/.test(String(form.clearanceResult || ""));
  const ncrHref = isSafety
    ? `/projects/${projectId}/safety?sheet=ncr-form&fromIr=${encodeURIComponent(rfi.number || rfi.id)}`
    : `/projects/${projectId}/inspections?sheet=car-register&fromIr=${encodeURIComponent(rfi.number || rfi.id)}`;
  const siHref = isSafety
    ? `/projects/${projectId}/safety?sheet=site-instruction`
    : `/projects/${projectId}/inspections?sheet=site-instruction`;
  const soHref = isSafety
    ? `/projects/${projectId}/safety?sheet=observation`
    : `/projects/${projectId}/inspections?sheet=site-observation`;

  const attachments = localAtt ?? parseAttachments(rfi.attachmentsJson);
  const activeAssignmentId = rfi.linkedAssignmentId || linkId || "";

  useEffect(() => {
    setLinkId(rfi.linkedAssignmentId || "");
  }, [rfi.id, rfi.linkedAssignmentId]);

  useEffect(() => {
    if (!activeAssignmentId || !token) {
      setFillStatus(null);
      return;
    }
    let cancelled = false;
    void api<{ status: string; assignmentId?: string; assignment?: { id?: string }; createdAt?: string }[]>(
      `/api/checklist/project/${projectId}/submissions`,
      { token },
    )
      .then((out) => {
        if (cancelled) return;
        const list = Array.isArray(out) ? out : [];
        const rows = list.filter(
          (s) => s.assignmentId === activeAssignmentId || s.assignment?.id === activeAssignmentId,
        );
        const latest = rows[0];
        setFillStatus(latest?.status || "Not started");
      })
      .catch(() => {
        if (!cancelled) setFillStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeAssignmentId, projectId, token, rfi.id]);

  if (!ref) return null;

  const fileBase = String(rfi.irNumber || rfi.number).replace(/[^\w.-]+/g, "_");

  async function saveChecklistLink() {
    setLinkBusy(true);
    setEvidenceMsg("");
    try {
      const picked = checklistAssignments.find((a) => a.id === linkId);
      await api(`/api/rfis/${rfi.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          linkedAssignmentId: linkId || null,
          linkedChecklistItemId: picked?.templateId || picked?.template?.id || null,
        }),
      });
      setEvidenceMsg(linkId ? "Checklist linked — open Fill to complete." : "Checklist link cleared.");
      await onUpdated?.();
    } catch (err) {
      setEvidenceMsg(err instanceof Error ? err.message : "Could not update checklist link");
    } finally {
      setLinkBusy(false);
    }
  }

  async function uploadFiles(files: FileList | File[], kind: "photo" | "doc" | "site_instruction") {
    const list = Array.from(files).slice(0, 8);
    if (!list.length) return;
    setAttachBusy(true);
    setEvidenceMsg("");
    try {
      const fd = new FormData();
      fd.append("kind", kind);
      for (const f of list) {
        fd.append(kind === "photo" ? "photos" : kind === "site_instruction" ? "site_instruction" : "docs", f);
      }
      const out = await api<{ attachments: IrAttachment[]; added: IrAttachment[]; folder?: string }>(
        `/api/rfis/${rfi.id}/attachments`,
        { method: "POST", token, body: fd, timeoutMs: 120_000 },
      );
      setLocalAtt(out.attachments || []);
      setEvidenceMsg(
        `Uploaded ${out.added?.length || list.length} file(s) to SharePoint${out.folder ? ` (${out.folder})` : ""}.`,
      );
      await onUpdated?.();
    } catch (err) {
      setEvidenceMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setAttachBusy(false);
    }
  }

  async function logToRegister(recordType: "Site Observation" | "Site Instruction") {
    setLogBusy(true);
    setEvidenceMsg("");
    try {
      const out = await api<{ register: string; record: { id: string } }>(`/api/rfis/${rfi.id}/log-site-record`, {
        method: "POST",
        token,
        body: JSON.stringify({ recordType, includeAttachments: true }),
      });
      setEvidenceMsg(`${recordType} logged on the ${out.register} register — open the sheet to review.`);
      await onUpdated?.();
    } catch (err) {
      setEvidenceMsg(err instanceof Error ? err.message : "Could not log to register");
    } finally {
      setLogBusy(false);
    }
  }

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
          {form.validUpTo ? (
            <p className="text-[11px] text-steel-muted">
              Valid up to {new Date(form.validUpTo).toLocaleString("en-GB")}
              {form.inspectedBy ? ` · inspected by ${form.inspectedBy}` : ""}
            </p>
          ) : null}
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
                      await api(`/api/rfis/${rfi.id}`, {
                        method: "PATCH",
                        token,
                        body: JSON.stringify({ formPatch: { ...clr, inspectedBy: user?.fullName || "" } }),
                      });
                      setClrMsg(
                        /^S[34]/.test(clr.clearanceResult)
                          ? `Recorded ${clr.clearanceResult.slice(0, 2)} — Site Instruction will be logged on the Safety register.`
                          : `Recorded ${clr.clearanceResult.slice(0, 2)}.`,
                      );
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
                <span className="text-[11px] text-steel-muted">
                  {clrMsg || "S1/S2 need a validity time; S3/S4 also logs a Site Instruction for follow-up."}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Evidence — photos + site instruction docs → SharePoint */}
      <div className="rounded-xl border border-line bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h4 className="font-semibold text-sm text-ink">Evidence & site instructions</h4>
            <p className="text-[11px] text-steel-muted mt-0.5">
              Photos and SI documents upload to SharePoint under this IR’s Evidence folder. Log them into the{" "}
              {isSafety ? "Safety" : "Quality"} Site Instruction / Observation register for the weekly pack.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <Link to={siHref} className="text-brand font-semibold underline">
              SI register →
            </Link>
            <Link to={soHref} className="text-brand font-semibold underline">
              Observation register →
            </Link>
          </div>
        </div>

        {attachments.length > 0 && (
          <ul className="grid sm:grid-cols-2 gap-2">
            {attachments.map((a, i) => {
              const href = a.sharePointUrl || mediaUrl(a.url);
              const isPhoto = a.kind === "photo" || /\.(jpe?g|png|gif|webp)$/i.test(a.name || "");
              return (
                <li key={`${a.name}-${i}`} className="flex gap-2 items-center rounded-lg border border-line p-2 text-xs">
                  {isPhoto && a.url ? (
                    <img src={mediaUrl(a.url)} alt="" className="h-12 w-12 object-cover rounded shrink-0 bg-sand" />
                  ) : (
                    <span className="h-12 w-12 grid place-items-center rounded bg-sand text-[10px] font-mono shrink-0">
                      {a.kind === "site_instruction" ? "SI" : "DOC"}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{a.name}</div>
                    <div className="text-[10px] text-steel-muted capitalize">{a.kind || "file"}</div>
                    {href ? (
                      <a href={href} target="_blank" rel="noreferrer" className="text-brand font-semibold underline">
                        Open / review →
                      </a>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {canAttach && (
          <div className="flex flex-wrap gap-2 items-center">
            <FilePickButton
              accept="image/*"
              multiple
              disabled={attachBusy}
              onPick={(files) => void uploadFiles(files, "photo")}
            >
              {attachBusy ? "Uploading…" : "Attach photos"}
            </FilePickButton>
            <FilePickButton
              accept=".pdf,.doc,.docx,.xlsx,.xls,image/*"
              multiple
              disabled={attachBusy}
              onPick={(files) => void uploadFiles(files, "site_instruction")}
            >
              {attachBusy ? "Uploading…" : "Attach site instruction / doc"}
            </FilePickButton>
          </div>
        )}

        {canClear && (
          <div className="flex flex-wrap gap-2 pt-1 border-t border-line">
            <Button type="button" className="!text-xs" disabled={logBusy} onClick={() => void logToRegister("Site Instruction")}>
              {logBusy ? "Logging…" : "Log as Site Instruction"}
            </Button>
            <Button type="button" variant="secondary" className="!text-xs" disabled={logBusy} onClick={() => void logToRegister("Site Observation")}>
              Log as Site Observation
            </Button>
          </div>
        )}
        {evidenceMsg ? <p className="text-[11px] text-steel-muted">{evidenceMsg}</p> : null}
      </div>

      {(failLike || canClear) && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-steel">
            {failLike
              ? "Result needs a non-conformance. Raise it on the owning module’s NCR register — not here."
              : "If inspection fails / is not cleared, raise NCR on Quality or Safety (module that owns this IR)."}
          </span>
          <Link to={ncrHref} className="text-xs font-semibold text-brand underline shrink-0">
            {isSafety ? "Open Safety NCR form →" : "Open Quality NCR / CAR register →"}
          </Link>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={!!busy}
          className="!text-xs"
          onClick={() => {
            setBusy("xlsx");
            void downloadAuthFile(`/api/rfis/${rfi.id}/inspection.xlsx`, token, `${fileBase}-IR.xlsx`).finally(() => setBusy(null));
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
            void downloadAuthFile(`/api/rfis/${rfi.id}/inspection.html`, token, `${fileBase}-IR.html`).finally(() => setBusy(null));
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

      <div className="rounded-lg border-2 border-brand bg-brand-soft/30 p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-brand">Linked checklist</div>
            <p className="text-sm font-medium text-ink mt-0.5">{linkedName || "None linked yet"}</p>
            {fillStatus ? (
              <p className="text-[11px] text-steel-muted mt-0.5">
                Fill status: <span className="font-semibold text-ink">{fillStatus}</span>
              </p>
            ) : null}
          </div>
          {activeAssignmentId ? (
            <Button type="button" className="!text-sm" onClick={() => openChecklistFillWindow(projectId, activeAssignmentId, checklistFamily)}>
              Fill linked checklist →
            </Button>
          ) : null}
        </div>
        {canClear && checklistAssignments.length > 0 && (
          <div className="flex flex-wrap gap-2 items-end border-t border-brand/20 pt-3">
            <div className="min-w-[12rem] flex-1">
              <Select label="Link / change checklist" value={linkId} onChange={(e) => setLinkId(e.target.value)}>
                <option value="">None</option>
                {checklistAssignments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.template?.name || a.id}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="button" className="!text-xs" disabled={linkBusy || linkId === (rfi.linkedAssignmentId || "")} onClick={() => void saveChecklistLink()}>
              {linkBusy ? "Saving…" : "Save link"}
            </Button>
          </div>
        )}
      </div>

      <details className="rounded-lg border border-line bg-sand/20">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-steel-muted">Full request body</summary>
        <pre className="text-xs whitespace-pre-wrap px-3 pb-3 text-steel-muted max-h-48 overflow-y-auto">{rfi.question}</pre>
      </details>
    </div>
  );
}
