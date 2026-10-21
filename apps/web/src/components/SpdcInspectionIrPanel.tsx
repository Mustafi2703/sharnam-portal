import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { QUALITY_DECLARATIONS, QUALITY_ENCLOSURE_OPTIONS, QUALITY_RESULTS, requiredEnclosures, truthyFlag } from "@sharnam/shared";
import { Badge, Button, Input, Select, TextArea } from "./ui";
import { api, mediaUrl } from "../api";
import { useAuth } from "../auth";
import { downloadAuthFile } from "../lib/downloadReport";
import { openNcrFormWindow } from "../lib/ncrFormFields";
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
  recordKey?: string | null;
  recordLabel?: string | null;
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
    qapLineId?: string | null;
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
  const navigate = useNavigate();
  const [qualityMsg, setQualityMsg] = useState("");
  const [secBusy, setSecBusy] = useState(false);
  const [resultBusy, setResultBusy] = useState(false);
  const [ncrBusy, setNcrBusy] = useState(false);
  const [qapLine, setQapLine] = useState<{ id: string; records?: string | null } | null>(null);
  const [siteInstructions, setSiteInstructions] = useState<
    { id: string; title?: string; status?: string; closedAt?: string | null }[] | null
  >(null);
  const [sec3, setSec3] = useState({
    decls: {} as Record<string, boolean>,
    enclosures: [] as string[],
    enclosuresOther: "",
    raisedBy: "",
    verifiedBy: "",
    elementOrLot: "",
    source: "",
    actionTaken: "",
    shortNoticeReason: "",
  });
  const [sec4, setSec4] = useState({ inspectedOn: "", observations: "", reinspectionBy: "", thirdPartyBy: "" });
  const [closedBy, setClosedBy] = useState("");
  const ref = inspectionFormForKind(rfi.rfiKind);
  const form = useMemo(() => resolveInspectionFormData(rfi, project || undefined), [rfi, project]);
  const sections = useMemo(() => (ref ? sectionsFromRef(ref) : []), [ref]);
  const linkedName =
    checklistName ||
    rfi.linkedAssignment?.template?.name ||
    checklistAssignments.find((a) => a.id === (rfi.linkedAssignmentId || linkId))?.template?.name;
  const home = canonicalRfiKind(rfi.rfiKind);
  const isQuality = home === "QualityIR";
  const onBehalf = truthyFlag(form.onBehalf);
  const spdc = ["admin", "office", "employee", "site_employee"].includes(user?.role || "");
  const canSection3 = user?.role === "admin" || user?.role === "vendor" || (spdc && onBehalf);
  const canSection4 = spdc;
  const canWitness = user?.role === "client";
  const savedResult = String(form.result || "").trim().charAt(0).toUpperCase();
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

  useEffect(() => {
    let raw: Record<string, unknown> = {};
    try {
      raw = rfi.formDataJson ? JSON.parse(rfi.formDataJson) : {};
    } catch {
      raw = {};
    }
    const enc = raw.enclosures;
    const enclosures = Array.isArray(enc)
      ? enc.map(String)
      : typeof enc === "string"
        ? enc.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
    const decls: Record<string, boolean> = {};
    for (const d of QUALITY_DECLARATIONS) decls[d.key] = truthyFlag(raw[d.key]);
    setSec3({
      decls,
      enclosures,
      enclosuresOther: String(raw.enclosuresOther || ""),
      raisedBy: String(raw.raisedBy || ""),
      verifiedBy: String(raw.verifiedBy || ""),
      elementOrLot: String(raw.elementOrLot || form.elementOrLot || ""),
      source: String(raw.source || form.source || ""),
      actionTaken: String(raw.actionTaken || ""),
      shortNoticeReason: String(raw.shortNoticeReason || ""),
    });
    setSec4({
      inspectedOn: String(raw.inspectedOn || "").slice(0, 10),
      observations: String(raw.observations || ""),
      reinspectionBy: String(raw.reinspectionBy || "").slice(0, 10),
      thirdPartyBy: String(raw.thirdPartyBy || ""),
    });
    setClosedBy(String(raw.closedBy || ""));
  }, [rfi.id, rfi.formDataJson, form.elementOrLot, form.source]);

  useEffect(() => {
    if (!isQuality || !rfi.qapLineId) {
      setQapLine(null);
      return;
    }
    let cancelled = false;
    void api<{ line?: { id: string; records?: string | null } }>(
      `/api/checklist/project/${projectId}/qap/line/${rfi.qapLineId}/irs`,
      { token },
    )
      .then((out) => {
        if (!cancelled) setQapLine(out.line || null);
      })
      .catch(() => {
        if (!cancelled) setQapLine(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isQuality, rfi.qapLineId, projectId, token]);

  useEffect(() => {
    if (!isQuality) return;
    let cancelled = false;
    void api<{ id: string; title?: string; description?: string | null; status?: string; source?: string | null; closedAt?: string | null }[]>(
      `/api/checklist/project/${projectId}/quality-site-records?type=${encodeURIComponent("Site Instruction")}`,
      { token },
    )
      .then((rows) => {
        if (cancelled) return;
        const act = String(form.activityDescription || "").trim().toLowerCase();
        const num = String(rfi.irNumber || rfi.number || "").toLowerCase();
        const list = Array.isArray(rows) ? rows : [];
        setSiteInstructions(
          list.filter((row) => {
            const blob = `${row.title || ""} ${row.description || ""} ${row.source || ""}`.toLowerCase();
            if (num && blob.includes(num)) return true;
            return act.length > 12 && blob.includes(act.slice(0, 48));
          }),
        );
      })
      .catch(() => {
        if (!cancelled) setSiteInstructions(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isQuality, projectId, token, rfi.id, rfi.number, rfi.irNumber, form.activityDescription]);

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

  function contractorPatch() {
    const decls: Record<string, string> = {};
    for (const d of QUALITY_DECLARATIONS) decls[d.key] = sec3.decls[d.key] ? "true" : "";
    return {
      ...decls,
      enclosures: sec3.enclosures,
      enclosuresOther: sec3.enclosuresOther,
      raisedBy: sec3.raisedBy,
      verifiedBy: sec3.verifiedBy,
      elementOrLot: sec3.elementOrLot,
      source: sec3.source,
      actionTaken: sec3.actionTaken,
      shortNoticeReason: sec3.shortNoticeReason,
    };
  }

  async function uploadFiles(
    files: FileList | File[],
    kind: "photo" | "doc" | "site_instruction",
    record?: { recordKey: string; recordLabel: string },
  ) {
    const list = Array.from(files).slice(0, 8);
    if (!list.length) return;
    setAttachBusy(true);
    setEvidenceMsg("");
    try {
      const fd = new FormData();
      fd.append("kind", kind);
      if (record?.recordKey) fd.append("recordKey", record.recordKey);
      if (record?.recordLabel) fd.append("recordLabel", record.recordLabel);
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

      {isQuality && (
        <div className="space-y-3">
          <div className="rounded-lg border border-line bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-ink">3. Contractor declaration</h4>
              {!canSection3 ? <Badge tone="neutral">Read only</Badge> : null}
            </div>
            <div className="space-y-1.5">
              {QUALITY_DECLARATIONS.map((d) => (
                <label key={d.key} className="flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    disabled={!canSection3}
                    checked={!!sec3.decls[d.key]}
                    onChange={(e) => setSec3({ ...sec3, decls: { ...sec3.decls, [d.key]: e.target.checked } })}
                  />
                  <span>{d.text}</span>
                </label>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <Input label="Element or lot" value={sec3.elementOrLot} disabled={!canSection3} onChange={(e) => setSec3({ ...sec3, elementOrLot: e.target.value })} />
              <Input label="Source" value={sec3.source} disabled={!canSection3} onChange={(e) => setSec3({ ...sec3, source: e.target.value })} />
              <Input label="Raised by" value={sec3.raisedBy} disabled={!canSection3} onChange={(e) => setSec3({ ...sec3, raisedBy: e.target.value })} />
              <Input label="Verified by" value={sec3.verifiedBy} disabled={!canSection3} onChange={(e) => setSec3({ ...sec3, verifiedBy: e.target.value })} />
            </div>
            <div>
              <div className="text-[10px] uppercase text-steel-muted font-semibold mb-1">Enclosures</div>
              <div className="flex flex-wrap gap-2">
                {QUALITY_ENCLOSURE_OPTIONS.map((opt) => (
                  <label key={opt} className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      disabled={!canSection3}
                      checked={sec3.enclosures.includes(opt)}
                      onChange={(e) => {
                        const next = e.target.checked ? [...sec3.enclosures, opt] : sec3.enclosures.filter((x) => x !== opt);
                        setSec3({ ...sec3, enclosures: next });
                      }}
                    />
                    {opt}
                  </label>
                ))}
              </div>
              {sec3.enclosures.includes("Other") ? (
                <Input className="mt-2" label="Other enclosure" value={sec3.enclosuresOther} disabled={!canSection3} onChange={(e) => setSec3({ ...sec3, enclosuresOther: e.target.value })} />
              ) : null}
            </div>
            <Input label="Short notice reason" value={sec3.shortNoticeReason} disabled={!canSection3} onChange={(e) => setSec3({ ...sec3, shortNoticeReason: e.target.value })} />
            <div>
              <div className="text-[10px] uppercase text-steel-muted font-semibold mb-1">Records named on the QAP line</div>
              <ul className="space-y-2">
                {requiredEnclosures(qapLine?.records).map((item) => {
                  const files = attachments.filter((a) => a.recordKey === item.key);
                  const checklistOk = item.kind === "checklist" && !!activeAssignmentId;
                  return (
                    <li key={item.key} className="rounded-md border border-line px-2 py-2 text-xs flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{item.label}</span>
                      {item.kind === "checklist" ? (
                        <Badge tone={checklistOk ? "ok" : "warn"}>{checklistOk ? "Checklist linked" : "Link the work check list below"}</Badge>
                      ) : (
                        <Badge tone={files.length ? "ok" : "neutral"}>{files.length ? `${files.length} file(s)` : "No file"}</Badge>
                      )}
                      {files.map((f) => (
                        <span key={f.url} className="text-steel-muted truncate max-w-[12rem]">{f.name}</span>
                      ))}
                      {item.kind === "file" && canAttach ? (
                        <FilePickButton
                          accept={item.key === "photographs" ? "image/*" : ".pdf,.doc,.docx,.xlsx,.xls,image/*"}
                          multiple
                          disabled={attachBusy}
                          onPick={(files) => void uploadFiles(files, item.key === "photographs" ? "photo" : "doc", { recordKey: item.key, recordLabel: item.label })}
                        >
                          {attachBusy ? "Uploading..." : item.key === "photographs" ? "Upload photographs" : "Upload"}
                        </FilePickButton>
                      ) : null}
                    </li>
                  );
                })}
                {!requiredEnclosures(qapLine?.records).length ? (
                  <li className="text-steel-muted">This line does not name extra records.</li>
                ) : null}
              </ul>
              <p className="text-[11px] text-steel-muted mt-1">Photographs uploaded here are added to the day photo schedule. Work Check List is satisfied when a checklist is linked.</p>
            </div>
            {canSection3 ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="!text-xs"
                  disabled={secBusy}
                  onClick={async () => {
                    setSecBusy(true);
                    setQualityMsg("");
                    try {
                      await api(`/api/rfis/${rfi.id}`, { method: "PATCH", token, body: JSON.stringify({ formPatch: contractorPatch() }) });
                      setQualityMsg("Declaration saved.");
                      await onUpdated?.();
                    } catch (err) {
                      setQualityMsg(err instanceof Error ? err.message : "Could not save the declaration");
                    } finally {
                      setSecBusy(false);
                    }
                  }}
                >
                  {secBusy ? "Saving..." : "Save declaration"}
                </Button>
                {String(rfi.status || "") === "Draft" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="!text-xs"
                    disabled={secBusy}
                    onClick={async () => {
                      setSecBusy(true);
                      setQualityMsg("");
                      try {
                        await api(`/api/rfis/${rfi.id}`, {
                          method: "PATCH",
                          token,
                          body: JSON.stringify({ submit: true, formPatch: contractorPatch() }),
                        });
                        setQualityMsg("IR submitted.");
                        await onUpdated?.();
                      } catch (err) {
                        setQualityMsg(err instanceof Error ? err.message : "Could not submit");
                      } finally {
                        setSecBusy(false);
                      }
                    }}
                  >
                    Submit
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-line bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-ink">4. SPDC inspection</h4>
              {!canSection4 ? <Badge tone="neutral">Read only</Badge> : null}
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <Input label="Inspected on" type="date" value={sec4.inspectedOn} disabled={!canSection4} onChange={(e) => setSec4({ ...sec4, inspectedOn: e.target.value })} />
              <Input label="Reinspection by" type="date" value={sec4.reinspectionBy} disabled={!canSection4} onChange={(e) => setSec4({ ...sec4, reinspectionBy: e.target.value })} />
              <Input label="Third party" value={sec4.thirdPartyBy} disabled={!canSection4} onChange={(e) => setSec4({ ...sec4, thirdPartyBy: e.target.value })} />
            </div>
            <TextArea label="Observations" rows={3} value={sec4.observations} disabled={!canSection4} onChange={(e) => setSec4({ ...sec4, observations: e.target.value })} />
            <div className="text-xs text-steel-muted">
              Inspected: {form.inspectedBy || "-"} {form.inspectedAt ? `· ${String(form.inspectedAt).slice(0, 16).replace("T", " ")}` : ""}
              {" · "}Witnessed: {form.witnessedBy || "-"} {form.witnessedAt ? `· ${String(form.witnessedAt).slice(0, 16).replace("T", " ")}` : ""}
            </div>
            {canSection4 ? (
              <div className="flex flex-wrap gap-2">
                {QUALITY_RESULTS.map((r) => (
                  <Button
                    key={r.code}
                    type="button"
                    variant={savedResult === r.code ? "primary" : "secondary"}
                    className="!text-xs"
                    disabled={resultBusy}
                    title={r.label}
                    onClick={async () => {
                      if (r.code === "D" && !sec4.observations.trim()) {
                        setQualityMsg("Result D needs the reason in observations.");
                        return;
                      }
                      setResultBusy(true);
                      setQualityMsg("");
                      try {
                        await api(`/api/rfis/${rfi.id}`, {
                          method: "PATCH",
                          token,
                          body: JSON.stringify({
                            formPatch: {
                              result: r.code,
                              observations: sec4.observations,
                              inspectedOn: sec4.inspectedOn,
                              reinspectionBy: sec4.reinspectionBy,
                              thirdPartyBy: sec4.thirdPartyBy,
                            },
                          }),
                        });
                        setQualityMsg(`Result ${r.code} saved.`);
                        await onUpdated?.();
                      } catch (err) {
                        setQualityMsg(err instanceof Error ? err.message : "Could not save the result");
                      } finally {
                        setResultBusy(false);
                      }
                    }}
                  >
                    {r.code}
                  </Button>
                ))}
              </div>
            ) : (
              <Badge tone={savedResult === "A" ? "ok" : savedResult === "C" ? "danger" : "neutral"}>{form.result || "Pending"}</Badge>
            )}
            {savedResult === "C" && (canSection3 || canSection4) ? (
              <Button
                type="button"
                variant="secondary"
                className="!text-xs"
                disabled={resultBusy}
                onClick={async () => {
                  setResultBusy(true);
                  setQualityMsg("");
                  try {
                    const created = await api<{ id: string }>(`/api/checklist/project/${projectId}/qap/reoffer`, {
                      method: "POST",
                      token,
                      body: JSON.stringify({ rfiId: rfi.id }),
                    });
                    await onUpdated?.();
                    if (created?.id) {
                      navigate(`/projects/${projectId}/inspection-register?tab=quality-ir&lock=quality&rfi=${created.id}`);
                    }
                  } catch (err) {
                    setQualityMsg(err instanceof Error ? err.message : "Could not re-offer");
                  } finally {
                    setResultBusy(false);
                  }
                }}
              >
                Re-offer
              </Button>
            ) : null}
            {(savedResult === "B" || savedResult === "C") && (form.ncrId || form.ncrNo) ? (
              <div className="text-xs">
                Linked NCR: <span className="font-mono font-semibold">{form.ncrNo || form.ncrId}</span>
                {form.ncrId ? (
                  <button type="button" className="ml-2 text-brand font-semibold underline" onClick={() => openNcrFormWindow(projectId, "quality", String(form.ncrId))}>
                    Open NCR form
                  </button>
                ) : (
                  <Link className="ml-2 text-brand font-semibold underline" to={`/projects/${projectId}/inspections?sheet=car-register`}>
                    Open NCR register
                  </Link>
                )}
              </div>
            ) : null}
            {(savedResult === "B" || savedResult === "C") && !form.ncrNo && !form.ncrId && canSection4 ? (
              <Button
                type="button"
                variant="secondary"
                className="!text-xs"
                disabled={ncrBusy}
                onClick={async () => {
                  setNcrBusy(true);
                  setQualityMsg("");
                  try {
                    const created = await api<{ id: string; number?: string | null }>(`/api/checklist/project/${projectId}/ncr`, {
                      method: "POST",
                      token,
                      body: JSON.stringify({
                        kind: "NCR",
                        description: sec4.observations || form.observations || "Non-conformance from quality inspection",
                        location: form.location || undefined,
                        contractor: project?.contractorName || undefined,
                        rfiId: rfi.id,
                        qapLineId: rfi.qapLineId || qapLine?.id || undefined,
                      }),
                    });
                    setQualityMsg(created.number ? `NCR ${created.number} linked.` : "NCR raised.");
                    if (created.id) openNcrFormWindow(projectId, "quality", created.id);
                    await onUpdated?.();
                  } catch (err) {
                    setQualityMsg(err instanceof Error ? err.message : "Could not raise NCR");
                  } finally {
                    setNcrBusy(false);
                  }
                }}
              >
                {ncrBusy ? "Raising..." : "Raise NCR"}
              </Button>
            ) : null}
            {canWitness ? (
              <Button
                type="button"
                className="!text-xs"
                disabled={secBusy}
                onClick={async () => {
                  setSecBusy(true);
                  setQualityMsg("");
                  try {
                    await api(`/api/rfis/${rfi.id}`, {
                      method: "PATCH",
                      token,
                      body: JSON.stringify({ formPatch: { witnessedBy: user?.fullName || "Client", witnessedAt: new Date().toISOString() } }),
                    });
                    setQualityMsg("Witness recorded.");
                    await onUpdated?.();
                  } catch (err) {
                    setQualityMsg(err instanceof Error ? err.message : "Could not record the witness");
                  } finally {
                    setSecBusy(false);
                  }
                }}
              >
                Witness
              </Button>
            ) : null}
          </div>

          <div className="rounded-lg border border-line bg-white p-4 space-y-3">
            <h4 className="text-sm font-semibold text-ink">5. Close-out</h4>
            <TextArea label="Action taken" rows={3} value={sec3.actionTaken} disabled={!canSection3} onChange={(e) => setSec3({ ...sec3, actionTaken: e.target.value })} />
            <Input label="Closed by" value={closedBy} disabled={!canSection4} onChange={(e) => setClosedBy(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              {canSection3 ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="!text-xs"
                  disabled={secBusy}
                  onClick={async () => {
                    setSecBusy(true);
                    setQualityMsg("");
                    try {
                      await api(`/api/rfis/${rfi.id}`, { method: "PATCH", token, body: JSON.stringify({ formPatch: { actionTaken: sec3.actionTaken } }) });
                      setQualityMsg("Action taken saved.");
                      await onUpdated?.();
                    } catch (err) {
                      setQualityMsg(err instanceof Error ? err.message : "Could not save action taken");
                    } finally {
                      setSecBusy(false);
                    }
                  }}
                >
                  Save action taken
                </Button>
              ) : null}
              {canSection4 ? (
                <Button
                  type="button"
                  className="!text-xs"
                  disabled={secBusy || !closedBy.trim()}
                  onClick={async () => {
                    setSecBusy(true);
                    setQualityMsg("");
                    try {
                      await api(`/api/rfis/${rfi.id}`, {
                        method: "PATCH",
                        token,
                        body: JSON.stringify({ formPatch: { closedBy: closedBy.trim(), closedAt: new Date().toISOString() } }),
                      });
                      setQualityMsg("Close-out saved.");
                      await onUpdated?.();
                    } catch (err) {
                      setQualityMsg(err instanceof Error ? err.message : "Could not save close-out");
                    } finally {
                      setSecBusy(false);
                    }
                  }}
                >
                  Save close-out
                </Button>
              ) : null}
            </div>
            <div className="text-xs text-steel">
              <div className="font-semibold mb-1">Site instructions for this activity</div>
              {siteInstructions && siteInstructions.length ? (
                <ul className="space-y-1">
                  {siteInstructions.map((row) => {
                    const closed = !!(row.closedAt || /clos/i.test(row.status || ""));
                    return (
                      <li key={row.id}>
                        {closed ? "Closed" : "Open"}: {row.title || "Site instruction"} ({row.status || (closed ? "Closed" : "Open")})
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p>
                  No site instruction log is linked to this activity.
                  {activeAssignmentId ? (
                    <>
                      {" "}
                      <button type="button" className="text-brand font-semibold underline" onClick={() => openChecklistFillWindow(projectId, activeAssignmentId, checklistFamily)}>
                        Open the activity checklist fill
                      </button>
                    </>
                  ) : null}
                </p>
              )}
              <Link to={siHref} className="text-brand font-semibold underline">Site instruction register</Link>
            </div>
          </div>
          {qualityMsg ? <p className="text-xs text-steel-muted">{qualityMsg}</p> : null}
        </div>
      )}

      {sections.filter((sec) => !(isQuality && /^[345]\./.test(sec.title))).map((sec) => (
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
