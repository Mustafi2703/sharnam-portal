import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../../components/ui";
import { StandaloneFormHeader } from "../../components/StandaloneFormHeader";
import { UploadModal } from "../../components/UploadModal";
import { downloadAuthFile } from "../../lib/downloadReport";
import { useStandaloneFormPage } from "../../lib/useStandaloneFormPage";
import {
  parseFormData,
  qualityNcrCloseMissingFields,
  qualityNcrMissingFields,
  safetyNcrMissingFields,
  openNcrPrintPdf,
  type QualityNcrFormData,
} from "../../lib/ncrFormFields";

type NcrActivityEvent = {
  at: string;
  action: string;
  by?: string;
  note?: string;
  source?: string;
};

const SAFETY_CATEGORIES = [
  "Working at Heights",
  "PPE Non-Compliance",
  "Housekeeping",
  "Electrical",
  "Scaffolding",
  "Excavation",
  "Other",
];

/** Standalone NCR / CAR form — SPDC NCR 01 · Safety NCR.xlsx */
export default function NcrFormPage() {
  const { id, scope, recordId } = useParams();
  const { token, user } = useAuth();
  const isQuality = scope === "quality";
  const [row, setRow] = useState<any>(null);
  const [formData, setFormData] = useState<QualityNcrFormData>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [followNote, setFollowNote] = useState("");
  const [activity, setActivity] = useState<NcrActivityEvent[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadErr, setUploadErr] = useState("");

  const isOfficeAdmin = user?.role === "admin" || user?.role === "office";
  const isVendor = user?.role === "vendor";
  const canFill = isOfficeAdmin || isVendor || user?.role === "employee" || user?.role === "site_employee";

  const loadActivity = async () => {
    if (!id || !recordId || !isQuality) return;
    try {
      const res = await api<{ events: NcrActivityEvent[] }>(
        `/api/checklist/project/${id}/ncr/${recordId}/activity`,
        { token }
      );
      setActivity(Array.isArray(res.events) ? res.events : []);
    } catch {
      setActivity([]);
    }
  };

  const load = async () => {
    if (!id || !recordId) return;
    if (isQuality) {
      const found = await api<any>(`/api/checklist/project/${id}/ncr/${recordId}`, { token });
      setRow(found);
      const parsed = parseFormData<QualityNcrFormData>(found?.formDataJson);
      setFormData({
        projectName: parsed.projectName || "",
        toParty: parsed.toParty || found?.contractor || "",
        fromParty: parsed.fromParty || "Sharnam Project Development Consultants & Co.",
        actionRequired: parsed.actionRequired || "",
        workCarriedOutNote: parsed.workCarriedOutNote || "",
        signedContractor: parsed.signedContractor || "",
        positionContractor: parsed.positionContractor || "",
        followUpEffective: parsed.followUpEffective || "",
        signedReviewer: parsed.signedReviewer || "",
        positionReviewer: parsed.positionReviewer || "",
        environmentalIssues: parsed.environmentalIssues || "",
        otherCause: parsed.otherCause || "",
        actionResultOf: parsed.actionResultOf || "",
        furtherAction: parsed.furtherAction || "",
        pursueFurtherCosts: parsed.pursueFurtherCosts || "",
        siteSetupModification: parsed.siteSetupModification || "",
        correctiveActionDetail: parsed.correctiveActionDetail || "",
        actionByWhom: parsed.actionByWhom || "",
        actionCompleted: parsed.actionCompleted || "",
        contractorEmail: parsed.contractorEmail || "",
        contractorActed: parsed.contractorActed || "",
        contractorActedAt: parsed.contractorActedAt || "",
        contractorActedNote: parsed.contractorActedNote || "",
        followUpCount: parsed.followUpCount != null ? String(parsed.followUpCount) : "0",
        lastFollowUpAt: parsed.lastFollowUpAt || "",
      });
      await loadActivity();
    } else {
      const found = await api<any>(`/api/safety/${recordId}`, { token });
      setRow(found || null);
    }
  };

  useEffect(() => {
    void load();
  }, [id, recordId, token, isQuality]);

  useStandaloneFormPage();

  const missing = useMemo(() => {
    if (!row) return [];
    if (isQuality) {
      return qualityNcrMissingFields({
        description: row.description,
        contractor: row.contractor,
        location: row.location,
        ncrType: row.ncrType,
        plannedClosure: row.plannedClosure ? String(row.plannedClosure).slice(0, 10) : "",
        formDataJson: JSON.stringify(formData),
      });
    }
    return safetyNcrMissingFields(row);
  }, [row, formData, isQuality]);

  const closeMissing = useMemo(() => {
    if (!row || !isQuality) return missing;
    return qualityNcrCloseMissingFields({
      description: row.description,
      contractor: row.contractor,
      location: row.location,
      ncrType: row.ncrType,
      plannedClosure: row.plannedClosure ? String(row.plannedClosure).slice(0, 10) : "",
      actualClosure: row.actualClosure ? String(row.actualClosure).slice(0, 10) : "",
      formDataJson: JSON.stringify(formData),
    });
  }, [row, formData, isQuality, missing]);

  async function sendFollowUp() {
    if (!id || !recordId || !isOfficeAdmin) return;
    setBusy(true);
    setMsg("");
    try {
      const result = await api<any>(
        isQuality
          ? `/api/checklist/project/${id}/ncr/${recordId}/follow-up`
          : `/api/safety/${recordId}/follow-up`,
        {
          method: "POST",
          token,
          body: JSON.stringify({ note: followNote || null }),
        }
      );
      setFormData((f) => ({
        ...f,
        followUpCount:
          result.followUpCount != null
            ? String(result.followUpCount)
            : result.followUpNumber != null
              ? String(result.followUpNumber)
              : f.followUpCount,
        lastFollowUpAt: result.lastFollowUpAt || f.lastFollowUpAt,
      }));
      const followNum = Number(result.followUpCount ?? result.followUpNumber ?? 0);
      const to = formData.contractorEmail ? ` · emailed ${formData.contractorEmail}` : "";
      const kind = /^CAR/i.test(row.number || "") ? "CAR" : "NCR";
      setMsg(`${kind} follow-up ${followNum} sent${to}`);
      setFollowNote("");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Follow-up failed");
    } finally {
      setBusy(false);
    }
  }

  function markContractorActed(value: "Yes" | "No") {
    setFormData((f) => ({
      ...f,
      contractorActed: value,
      contractorActedAt: f.contractorActedAt || new Date().toISOString().slice(0, 10),
    }));
  }

  async function saveDraft() {
    if (!id || !recordId) return;
    setBusy(true);
    setMsg("");
    try {
      if (isQuality) {
        const updated = await api<any>(`/api/checklist/project/${id}/ncr/${recordId}/draft`, {
          method: "POST",
          token,
          body: JSON.stringify({
            description: row.description,
            contractor: row.contractor,
            location: row.location,
            ncrType: row.ncrType,
            issueDate: row.issueDate || null,
            plannedClosure: row.plannedClosure || null,
            formDataJson: formData,
          }),
        });
        setRow(updated);
        const phase = updated.fillPhase || updated.progress?.phase || "Draft";
        const sp =
          updated.sharePointExports?.length > 0
            ? ` Synced to SharePoint ${phase}/ + register updated.`
            : "";
        setMsg(`Draft saved — logged on fill log.${sp}`);
        try {
          window.opener?.postMessage({ type: "ncr-form-saved", projectId: id, recordId }, window.location.origin);
        } catch {
          /* ignore */
        }
        await loadActivity();
      } else {
        const updated = await api<any>(`/api/safety/${recordId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify({ ...row }),
        });
        setRow(updated);
        const sp =
          updated.sharePointExports?.length > 0
            ? " Branded XLSX + HTML saved to SharePoint."
            : "";
        setMsg(`Saved${sp} — contractor notified if email is on file.`);
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function syncSharePoint() {
    if (!id || !recordId || !isQuality) return;
    setBusy(true);
    setMsg("");
    try {
      // Persist current fields first, then push
      await api(`/api/checklist/project/${id}/ncr/${recordId}/draft`, {
        method: "POST",
        token,
        body: JSON.stringify({
          description: row.description,
          contractor: row.contractor,
          location: row.location,
          ncrType: row.ncrType,
          issueDate: row.issueDate || null,
          plannedClosure: row.plannedClosure || null,
          formDataJson: formData,
        }),
      });
      const out = await api<{ phase: string; folder: string; sharePointExports?: { path: string }[] }>(
        `/api/checklist/project/${id}/ncr/${recordId}/sync-sharepoint`,
        { method: "POST", token }
      );
      setMsg(`SharePoint synced · ${out.phase} → ${out.folder}${out.sharePointExports?.length ? ` (${out.sharePointExports.length} files)` : ""}`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "SharePoint sync failed");
    } finally {
      setBusy(false);
    }
  }

  async function downloadXlsx() {
    if (!recordId) return;
    const path = isQuality
      ? `/api/checklist/project/${id}/ncr/${recordId}/export.xlsx`
      : `/api/safety/${recordId}/export.xlsx`;
    const name = `${row?.number || row?.ncrNumber || "NCR"}.xlsx`;
    await downloadAuthFile(path, token, name);
    setMsg("Downloaded NCR 01 Excel format — fill, then upload or save in the portal.");
    if (isQuality) await loadActivity();
  }

  async function downloadPdf() {
    if (!recordId) return;
    const path = isQuality
      ? `/api/checklist/project/${id}/ncr/${recordId}/export.pdf`
      : `/api/safety/${recordId}/export.pdf`;
    const name = `${row?.number || row?.ncrNumber || "NCR"}.pdf`;
    await downloadAuthFile(path, token, name);
    if (isQuality) await loadActivity();
  }

  async function uploadFilledExcel(e: FormEvent) {
    e.preventDefault();
    if (!id || !recordId || !uploadFile || !isQuality) return;
    setUploadBusy(true);
    setUploadErr("");
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      const updated = await api<any>(`/api/checklist/project/${id}/ncr/${recordId}/upload`, {
        method: "POST",
        token,
        body: fd,
      });
      setRow(updated);
      setUploadOpen(false);
      setUploadFile(null);
      setMsg("Filled Excel uploaded — register updated from NCR 01 fields.");
      await load();
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadBusy(false);
    }
  }

  function openPrintPdf() {
    const path = isQuality
      ? `/api/checklist/project/${id}/ncr/${recordId}/export.html`
      : `/api/safety/${recordId}/export.html`;
    void openNcrPrintPdf(path, token, `${row?.number || row?.ncrNumber || "NCR"}.html`).catch((err) =>
      setMsg(err instanceof Error ? err.message : "Print failed")
    );
  }

  async function closeRecord() {
    if (!id || !recordId || !canClose) return;
    setBusy(true);
    setMsg("");
    try {
      if (isQuality) {
        await api(`/api/checklist/project/${id}/ncr/${recordId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify({
            status: "Closed",
            description: row.description,
            contractor: row.contractor,
            location: row.location,
            ncrType: row.ncrType,
            plannedClosure: row.plannedClosure || null,
            actualClosure: row.actualClosure || new Date().toISOString().slice(0, 10),
            formDataJson: formData,
          }),
        });
      } else {
        await api(`/api/safety/${recordId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify({ ...row, status: "Closed" }),
        });
      }
      setMsg("Closed — register updated · branded forms synced · notification sent");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Cannot close — complete required fields first");
    } finally {
      setBusy(false);
    }
  }

  if (!row) {
    return (
      <div className="standalone-form-page standalone-form-page--paper">
        <StandaloneFormHeader eyebrow="Loading…" title="NCR / CAR form" />
        <main className="standalone-form-page__main standalone-form-page__main--narrow">
          <p className="text-steel-muted">Loading form…</p>
        </main>
      </div>
    );
  }

  const canClose = isQuality ? closeMissing.length === 0 : missing.length === 0;
  const templateName = isQuality ? "NCR 01 .xlsx · Quality Dashboard" : "Safety NCR.xlsx";
  const closeBlockers = isQuality ? closeMissing : missing;
  const isCar = isQuality && /^CAR/i.test(row.number || "");
  const recordLabel = isQuality ? (isCar ? "CAR" : "NCR") : "Safety NCR";

  return (
    <div className="standalone-form-page standalone-form-page--paper">
      <StandaloneFormHeader
        variant="navy"
        eyebrow={isQuality ? (isCar ? "Quality · Corrective Action Request" : "Quality · Non-conformance") : "Safety · NCR"}
        title={row.number || row.ncrNumber || recordLabel}
        subtitle={templateName}
        metaRight={<Badge tone={row.status === "Open" ? "warn" : "ok"}>{row.status}</Badge>}
      />

      <main className="standalone-form-page__main standalone-form-page__main--narrow space-y-4">
        <PageHeader
          eyebrow={templateName}
          title={isQuality ? (isCar ? "CAR — Corrective Action Request" : "NCR — Non-Conformance Report") : row.description?.slice(0, 100) || "Safety NCR"}
          subtitle={
            isQuality
              ? "NCR = Non-Conformance Report · CAR = Corrective Action Request. Fill from the NCR fill log (like drawings). Save draft → SharePoint Drafts. Sync SharePoint anytime; nightly job re-syncs all."
              : "1) Fill fields · 2) Save · 3) Download branded XLSX/PDF · 4) Close when complete."
          }
        />

        {msg && <p className="text-sm rounded-lg px-3 py-2 bg-brand-soft text-brand-dark">{msg}</p>}

        {isQuality && id && (
          <Card className="!p-3 bg-slate-50 border-slate-200">
            <p className="text-xs font-semibold text-ink mb-1">Fill tool workflow</p>
            <ol className="text-xs text-steel-muted list-decimal pl-4 space-y-0.5">
              <li>
                Open from{" "}
                <a className="text-brand font-semibold underline" href={`/projects/${id}/quality/ncr-fill-log`} target="_blank" rel="noreferrer">
                  NCR / CAR fill log
                </a>{" "}
                (same pattern as drawing checklist fill log)
              </li>
              <li>Save draft anytime — branded Excel/PDF go to SharePoint Drafts/ and the register updates</li>
              <li>Use Sync SharePoint to push now; nightly day-close re-syncs every project after hours</li>
              <li>Office closes when compliance is verified — form moves to Closed/</li>
            </ol>
          </Card>
        )}

        {row.status === "Open" && closeBlockers.length > 0 && (
          <Card className="!p-3 bg-amber-50 border-amber-200">
            <p className="text-xs font-semibold text-amber-900 mb-1">
              Required before close ({closeBlockers.length})
            </p>
            <ul className="text-xs text-amber-800 list-disc pl-4">
              {closeBlockers.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </Card>
        )}

        {isQuality ? (
          <div className="ncr01-sheet">
            <div className="ncr01-sheet__title">
              Non-Conformance Report / Corrective Action Request
              <span className="ncr01-sheet__doc">SPDC NCR 01 · {isCar ? "CAR — Corrective Action Request" : "NCR — Non-Conformance Report"}</span>
            </div>

            <div className="ncr01-sheet__grid">
              <label className="ncr01-row">
                <span>Project:</span>
                <Input value={formData.projectName || ""} onChange={(e) => setFormData({ ...formData, projectName: e.target.value })} />
              </label>
              <label className="ncr01-row">
                <span>NCR / CAR No:</span>
                <Input value={row.number || ""} readOnly className="bg-sand/40" />
              </label>
              <label className="ncr01-row">
                <span>Date:</span>
                <Input
                  type="date"
                  value={row.issueDate ? String(row.issueDate).slice(0, 10) : ""}
                  onChange={(e) => setRow({ ...row, issueDate: e.target.value })}
                />
              </label>
              <label className="ncr01-row">
                <span>To:</span>
                <Input
                  value={formData.toParty || row.contractor || ""}
                  onChange={(e) => {
                    setFormData({ ...formData, toParty: e.target.value });
                    setRow({ ...row, contractor: e.target.value });
                  }}
                />
              </label>
              <label className="ncr01-row">
                <span>From:</span>
                <Input value={formData.fromParty || ""} onChange={(e) => setFormData({ ...formData, fromParty: e.target.value })} />
              </label>
              <label className="ncr01-row">
                <span>Location:</span>
                <Input value={row.location || ""} onChange={(e) => setRow({ ...row, location: e.target.value })} />
              </label>
            </div>

            <div className="ncr01-section">
              <p className="ncr01-section__h">Action Required as a Result of:</p>
              <div className="ncr01-sheet__grid">
                <label className="ncr01-row">
                  <span>Environmental Issues</span>
                  <Input
                    value={formData.environmentalIssues || ""}
                    onChange={(e) => setFormData({ ...formData, environmentalIssues: e.target.value })}
                    placeholder="—"
                  />
                </label>
                <label className="ncr01-row">
                  <span>Type (register)</span>
                  <Select value={row.ncrType || ""} onChange={(e) => setRow({ ...row, ncrType: e.target.value })}>
                    <option value="">Select…</option>
                    <option value="General">General</option>
                    <option value="Workmanship">Workmanship</option>
                    <option value="Material">Material</option>
                    <option value="Documentation">Documentation</option>
                    <option value="Dimensional">Dimensional</option>
                    <option value="Schedule">Schedule</option>
                    <option value="Safety">Safety</option>
                    <option value="Corrective Action">Corrective Action</option>
                    <option value="Other">Other</option>
                  </Select>
                </label>
                <label className="ncr01-row ncr01-row--full">
                  <span>Other</span>
                  <Input
                    value={formData.otherCause || ""}
                    onChange={(e) => setFormData({ ...formData, otherCause: e.target.value })}
                    placeholder="e.g. General — Project Schedule & Mix Design"
                  />
                </label>
              </div>
            </div>

            <label className="ncr01-block">
              <span>Description of the problem which requires rectification:</span>
              <TextArea rows={4} value={row.description || ""} onChange={(e) => setRow({ ...row, description: e.target.value })} />
            </label>

            <label className="ncr01-block">
              <span>Action Required to rectify the problem (and prevent recurrence):</span>
              <TextArea
                rows={3}
                value={formData.actionRequired || ""}
                onChange={(e) => setFormData({ ...formData, actionRequired: e.target.value })}
              />
            </label>

            <label className="ncr01-row ncr01-row--full">
              <span>Date by which action must be completed:</span>
              <Input
                type="date"
                value={row.plannedClosure ? String(row.plannedClosure).slice(0, 10) : ""}
                onChange={(e) => setRow({ ...row, plannedClosure: e.target.value })}
              />
            </label>
            <p className="ncr01-legal" style={{ marginTop: "0.35rem" }}>
              Note: If rectification is after Practical Completion, additional HSE considerations apply for occupied /
              client-managed premises.
            </p>

            <label className="ncr01-block">
              <span>The work should be carried out in accordance with… (contractor response)</span>
              <TextArea
                rows={2}
                value={formData.workCarriedOutNote || ""}
                onChange={(e) => setFormData({ ...formData, workCarriedOutNote: e.target.value })}
              />
            </label>

            <div className="ncr01-sheet__grid">
              <label className="ncr01-row">
                <span>Signed:</span>
                <Input
                  value={formData.signedContractor || ""}
                  onChange={(e) => setFormData({ ...formData, signedContractor: e.target.value })}
                  placeholder="Contractor representative"
                />
              </label>
              <label className="ncr01-row">
                <span>Position:</span>
                <Input
                  value={formData.positionContractor || ""}
                  onChange={(e) => setFormData({ ...formData, positionContractor: e.target.value })}
                />
              </label>
              <label className="ncr01-row">
                <span>Date:</span>
                <Input
                  type="date"
                  value={row.issueDate ? String(row.issueDate).slice(0, 10) : ""}
                  readOnly
                  className="bg-sand/40"
                />
              </label>
            </div>

            <div className="ncr01-section">
              <p className="ncr01-section__h">Follow-up review / report:</p>
              <label className="ncr01-row ncr01-row--full">
                <span>Has the Action taken been effective?</span>
                <Select
                  value={formData.followUpEffective || ""}
                  onChange={(e) => setFormData({ ...formData, followUpEffective: e.target.value })}
                >
                  <option value="">Select…</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No (If No, a new Notice may be required)</option>
                </Select>
              </label>
              <div className="ncr01-sheet__grid">
                <label className="ncr01-row">
                  <span>Signed (reviewer):</span>
                  <Input
                    value={formData.signedReviewer || ""}
                    onChange={(e) => setFormData({ ...formData, signedReviewer: e.target.value })}
                  />
                </label>
                <label className="ncr01-row">
                  <span>Position:</span>
                  <Input
                    value={formData.positionReviewer || ""}
                    onChange={(e) => setFormData({ ...formData, positionReviewer: e.target.value })}
                  />
                </label>
              </div>
            </div>

            <p className="ncr01-legal">
              The company on which this NCR is served is required to take action in order to rectify the substandard
              conditions. Failure to act within the specified time may result in further action — costs payable by that company.
            </p>

            <label className="ncr01-row ncr01-row--full">
              <span>Should further action and/or costs be pursued against the company on which this notice is served?</span>
              <Select
                value={formData.pursueFurtherCosts || ""}
                onChange={(e) => setFormData({ ...formData, pursueFurtherCosts: e.target.value })}
              >
                <option value="">Select…</option>
                <option value="Yes">Yes — send copy to Project Manager</option>
                <option value="No">No</option>
              </Select>
            </label>

            <label className="ncr01-row ncr01-row--full">
              <span>Does the Project Site Set Up System require modification to prevent a recurrence?</span>
              <Select
                value={formData.siteSetupModification || ""}
                onChange={(e) => setFormData({ ...formData, siteSetupModification: e.target.value })}
              >
                <option value="">Select…</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </Select>
            </label>

            <label className="ncr01-block">
              <span>Action required:</span>
              <TextArea
                rows={3}
                value={formData.correctiveActionDetail || formData.furtherAction || ""}
                onChange={(e) => setFormData({ ...formData, correctiveActionDetail: e.target.value })}
              />
            </label>

            <div className="ncr01-sheet__grid">
              <label className="ncr01-row">
                <span>By Whom:</span>
                <Input
                  value={formData.actionByWhom || row.contractor || ""}
                  onChange={(e) => setFormData({ ...formData, actionByWhom: e.target.value })}
                />
              </label>
              <label className="ncr01-row">
                <span>Completed:</span>
                <Input
                  value={formData.actionCompleted || ""}
                  onChange={(e) => setFormData({ ...formData, actionCompleted: e.target.value })}
                  placeholder="Date or note"
                />
              </label>
              <label className="ncr01-row">
                <span>Actual closure date:</span>
                <Input
                  type="date"
                  value={row.actualClosure ? String(row.actualClosure).slice(0, 10) : ""}
                  onChange={(e) => setRow({ ...row, actualClosure: e.target.value })}
                />
              </label>
            </div>

            {isOfficeAdmin && (
              <div className="ncr01-office">
                <p className="ncr01-section__h">SPDC office — compliance &amp; follow-up</p>
                <div className="ncr01-sheet__grid">
                  <label className="ncr01-row">
                    <span>Contractor complied?</span>
                    <Select
                      value={formData.contractorActed || ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "Yes" || v === "No") markContractorActed(v);
                        else setFormData({ ...formData, contractorActed: v });
                      }}
                    >
                      <option value="">Select…</option>
                      <option value="Yes">Yes — complied</option>
                      <option value="No">No — did not comply</option>
                    </Select>
                  </label>
                  <label className="ncr01-row">
                    <span>Verified on</span>
                    <Input
                      type="date"
                      value={formData.contractorActedAt ? String(formData.contractorActedAt).slice(0, 10) : ""}
                      onChange={(e) => setFormData({ ...formData, contractorActedAt: e.target.value })}
                    />
                  </label>
                </div>
                {formData.contractorActed === "No" && (
                  <label className="ncr01-block">
                    <span>Why contractor did not comply</span>
                    <TextArea
                      rows={2}
                      value={formData.contractorActedNote || ""}
                      onChange={(e) => setFormData({ ...formData, contractorActedNote: e.target.value })}
                    />
                  </label>
                )}
                {row.status === "Open" && (
                  <div className="space-y-2 mt-2">
                    <TextArea
                      rows={2}
                      placeholder="Optional follow-up note"
                      value={followNote}
                      onChange={(e) => setFollowNote(e.target.value)}
                    />
                    <Button type="button" variant="secondary" className="!text-xs" disabled={busy} onClick={() => void sendFollowUp()}>
                      {busy
                        ? "Sending…"
                        : `Send ${isCar ? "CAR" : "NCR"} follow-up${Number(formData.followUpCount || 0) > 0 ? ` (${formData.followUpCount} sent)` : ""}`}
                    </Button>
                  </div>
                )}
                {formData.contractorEmail && (
                  <p className="text-[11px] text-steel-muted font-mono mt-2">
                    Contractor email: {formData.contractorEmail}
                    {formData.lastFollowUpAt ? ` · last follow-up ${String(formData.lastFollowUpAt).slice(0, 10)}` : ""}
                  </p>
                )}
              </div>
            )}

            {!isOfficeAdmin && row.status === "Open" && (
              <p className="text-xs text-steel-muted border border-line rounded-lg px-3 py-2 bg-sand/20">
                Fill contractor response (work carried out + signed), or download Excel / upload the filled
                sheet. SPDC office verifies and closes this {isCar ? "CAR" : "NCR"}.
              </p>
            )}

            <div className="ncr01-section">
              <p className="ncr01-section__h">Activity log — raise / fill / upload / close</p>
              {activity.length === 0 ? (
                <p className="text-xs text-steel-muted">No events yet.</p>
              ) : (
                <ul className="ncr01-activity">
                  {activity.slice(0, 24).map((ev, i) => (
                    <li key={`${ev.at}-${ev.action}-${i}`}>
                      <span className="ncr01-activity__when">{ev.at ? String(ev.at).replace("T", " ").slice(0, 16) : "—"}</span>
                      <span className="ncr01-activity__action">{ev.action}</span>
                      <span className="ncr01-activity__by">{ev.by || "—"}</span>
                      {ev.note ? <span className="ncr01-activity__note">{ev.note}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <Card className="space-y-3">
            <h3 className="font-semibold text-sm">Safety NCR — Site Safety Non Conformity Report</h3>
            <div className="grid sm:grid-cols-2 gap-2">
              <Input
                placeholder="NCR number"
                value={row.ncrNumber || ""}
                onChange={(e) => setRow({ ...row, ncrNumber: e.target.value })}
              />
              <Input
                placeholder="Activity / task"
                value={row.activityTask || ""}
                onChange={(e) => setRow({ ...row, activityTask: e.target.value })}
              />
              <Select value={row.category || ""} onChange={(e) => setRow({ ...row, category: e.target.value })}>
                <option value="">Category</option>
                {SAFETY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <Select value={row.severity || ""} onChange={(e) => setRow({ ...row, severity: e.target.value })}>
                <option value="">Risk level</option>
                {["Low", "Medium", "High"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <Input placeholder="Location" value={row.location || ""} onChange={(e) => setRow({ ...row, location: e.target.value })} />
              <Input
                placeholder="Responsible party"
                value={row.responsibleParty || ""}
                onChange={(e) => setRow({ ...row, responsibleParty: e.target.value })}
              />
              <Input
                type="date"
                value={row.targetCompletion ? String(row.targetCompletion).slice(0, 10) : ""}
                onChange={(e) => setRow({ ...row, targetCompletion: e.target.value })}
              />
              <Input
                type="date"
                value={row.followUpDate ? String(row.followUpDate).slice(0, 10) : ""}
                onChange={(e) => setRow({ ...row, followUpDate: e.target.value })}
              />
            </div>
            <TextArea rows={3} placeholder="Non-conformity description" value={row.description || ""} onChange={(e) => setRow({ ...row, description: e.target.value })} />
            <TextArea rows={2} placeholder="Root cause" value={row.rootCause || ""} onChange={(e) => setRow({ ...row, rootCause: e.target.value })} />
            <TextArea rows={2} placeholder="Contributing factors" value={row.contributingFactors || ""} onChange={(e) => setRow({ ...row, contributingFactors: e.target.value })} />
            <TextArea rows={2} placeholder="Immediate action taken" value={row.immediateAction || ""} onChange={(e) => setRow({ ...row, immediateAction: e.target.value })} />
            <TextArea rows={2} placeholder="Long-term corrective action" value={row.longTermAction || ""} onChange={(e) => setRow({ ...row, longTermAction: e.target.value })} />
          </Card>
        )}
      </main>

      <footer className="standalone-form-footer">
        <div className="standalone-form-page__main standalone-form-page__main--narrow py-3 flex flex-wrap items-center gap-2">
          {canFill && row.status === "Open" && (
            <Button type="button" disabled={busy} onClick={() => void saveDraft()}>
              {busy ? "Saving…" : "Save draft"}
            </Button>
          )}
          {isQuality && canFill && row.status === "Open" && !isVendor && (
            <Button type="button" variant="secondary" className="!text-xs" disabled={busy} onClick={() => void syncSharePoint()}>
              Sync SharePoint
            </Button>
          )}
          <Button type="button" variant="secondary" className="!text-xs" onClick={() => void downloadXlsx()}>
            Download Excel
          </Button>
          <Button type="button" variant="secondary" className="!text-xs" onClick={() => void downloadPdf()}>
            Download PDF
          </Button>
          {isQuality && row.status === "Open" && canFill && (
            <Button type="button" variant="secondary" className="!text-xs" onClick={() => setUploadOpen(true)}>
              Upload filled Excel
            </Button>
          )}
          <Button type="button" variant="secondary" className="!text-xs" onClick={openPrintPdf}>
            Print preview
          </Button>
          {row.status === "Open" && isOfficeAdmin && (
            <Button
              type="button"
              disabled={!canClose || busy || !user}
              onClick={() => void closeRecord()}
              title={!canClose ? `Complete: ${closeBlockers.join(", ")}` : undefined}
            >
              Close {recordLabel}
            </Button>
          )}
          {row.status === "Open" && !isOfficeAdmin && (
            <span className="text-xs text-steel-muted">Only SPDC office can close after verifying compliance</span>
          )}
          <Button type="button" variant="ghost" className="!text-xs ml-auto" onClick={() => window.close()}>
            Close window
          </Button>
        </div>
      </footer>

      {isQuality && (
        <UploadModal
          open={uploadOpen}
          title="Upload filled NCR 01 Excel"
          context="Upload the completed NCR CAR sheet (.xlsx). Fields merge into this form and the register updates."
          file={uploadFile}
          onFile={setUploadFile}
          accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          fields={[]}
          primaryLabel={uploadBusy ? "Uploading…" : "Upload & update register"}
          busy={uploadBusy}
          error={uploadErr || undefined}
          onClose={() => {
            if (!uploadBusy) {
              setUploadOpen(false);
              setUploadFile(null);
              setUploadErr("");
            }
          }}
          onSubmit={(e) => void uploadFilledExcel(e)}
        />
      )}
    </div>
  );
}
