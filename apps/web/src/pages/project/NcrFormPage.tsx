import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../../components/ui";
import { downloadAuthFile } from "../../lib/downloadReport";
import {
  parseFormData,
  qualityNcrCloseMissingFields,
  qualityNcrMissingFields,
  safetyNcrMissingFields,
  openNcrPrintPdf,
  type QualityNcrFormData,
} from "../../lib/ncrFormFields";

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

  const isOfficeAdmin = user?.role === "admin" || user?.role === "office";

  const load = async () => {
    if (!id || !recordId) return;
    if (isQuality) {
      const found = await api<any>(`/api/checklist/project/${id}/ncr/${recordId}`, { token });
      setRow(found);
      const parsed = parseFormData<QualityNcrFormData>(found?.formDataJson);
      setFormData({
        projectName: parsed.projectName || "",
        toParty: parsed.toParty || found?.contractor || "",
        fromParty: parsed.fromParty || "Sharnam Project Development Consultant",
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
    } else {
      const found = await api<any>(`/api/safety/${recordId}`, { token });
      setRow(found || null);
    }
  };

  useEffect(() => {
    void load();
  }, [id, recordId, token, isQuality]);

  useEffect(() => {
    document.documentElement.classList.add("is-standalone-form");
    document.body.classList.add("is-standalone-form");
    return () => {
      document.documentElement.classList.remove("is-standalone-form");
      document.body.classList.remove("is-standalone-form");
    };
  }, []);

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
      const result = await api<any>(`/api/checklist/project/${id}/ncr/${recordId}/follow-up`, {
        method: "POST",
        token,
        body: JSON.stringify({ note: followNote || null }),
      });
      setFormData((f) => ({
        ...f,
        followUpCount: result.followUpCount != null ? String(result.followUpCount) : f.followUpCount,
        lastFollowUpAt: result.lastFollowUpAt || f.lastFollowUpAt,
      }));
      const followNum = Number(result.followUpCount || 0);
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
        const updated = await api<any>(`/api/checklist/project/${id}/ncr/${recordId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify({
            description: row.description,
            contractor: row.contractor,
            location: row.location,
            ncrType: row.ncrType,
            plannedClosure: row.plannedClosure || null,
            actualClosure: row.actualClosure || null,
            formDataJson: formData,
          }),
        });
        setRow(updated);
        const sp =
          updated.sharePointExports?.length > 0
            ? " Branded XLSX + HTML saved to SharePoint."
            : "";
        setMsg(`Saved${sp}`);
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
        setMsg(`Saved${sp}`);
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
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
      <div className="ncr-form-standalone min-h-screen bg-paper p-6">
        <p className="text-steel-muted">Loading NCR form…</p>
      </div>
    );
  }

  const canClose = isQuality ? closeMissing.length === 0 : missing.length === 0;
  const templateName = isQuality ? "NCR 01 .xlsx · Quality Dashboard" : "Safety NCR.xlsx";
  const closeBlockers = isQuality ? closeMissing : missing;
  const isCar = isQuality && /^CAR/i.test(row.number || "");
  const recordLabel = isQuality ? (isCar ? "CAR" : "NCR") : "Safety NCR";

  return (
    <div className="ncr-form-standalone">
      <header className="z-20 bg-procore-navy text-white border-b border-white/10 shadow-sm shrink-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-wider text-white/70">
              {isQuality ? (isCar ? "Quality · Corrective Action Request" : "Quality · Non-conformance") : "Safety · NCR"}
            </div>
            <div className="font-mono text-sm truncate">{row.number || row.ncrNumber || recordLabel}</div>
          </div>
          <Badge tone={row.status === "Open" ? "warn" : "ok"}>{row.status}</Badge>
        </div>
      </header>

      <main className="ncr-form-standalone__scroll">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4 w-full pb-6">
        <PageHeader
          eyebrow={templateName}
          title={row.description?.slice(0, 100) || "Non-conformance report"}
          subtitle="1) Fill all fields from the register row · 2) Save form · 3) Download branded XLSX/PDF · 4) Close when complete."
        />

        {msg && <p className="text-sm rounded-lg px-3 py-2 bg-brand-soft text-brand-dark">{msg}</p>}

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
          <Card className="space-y-3">
            <h3 className="font-semibold text-sm">{isCar ? "NCR 01 — Corrective Action Request (CAR)" : "NCR 01 — Non-Conformance Report"}</h3>
            <div className="grid sm:grid-cols-2 gap-2">
              <Input
                placeholder="Project name"
                value={formData.projectName || ""}
                onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
              />
              <Input
                placeholder="NCR / CAR number"
                value={row.number || ""}
                readOnly
                className="bg-sand/40"
              />
              <Input
                placeholder="To (party / contractor)"
                value={formData.toParty || ""}
                onChange={(e) => setFormData({ ...formData, toParty: e.target.value })}
              />
              <Input
                placeholder="From (PMC)"
                value={formData.fromParty || ""}
                onChange={(e) => setFormData({ ...formData, fromParty: e.target.value })}
              />
              <Input
                placeholder="Type"
                value={row.ncrType || ""}
                onChange={(e) => setRow({ ...row, ncrType: e.target.value })}
              />
              <Input
                placeholder="Contractor"
                value={row.contractor || ""}
                onChange={(e) => setRow({ ...row, contractor: e.target.value })}
              />
              <Input
                placeholder="Location"
                value={row.location || ""}
                onChange={(e) => setRow({ ...row, location: e.target.value })}
              />
              <Input
                type="date"
                placeholder="Planned closure"
                value={row.plannedClosure ? String(row.plannedClosure).slice(0, 10) : ""}
                onChange={(e) => setRow({ ...row, plannedClosure: e.target.value })}
              />
              <Input
                type="date"
                placeholder="Actual closure"
                value={row.actualClosure ? String(row.actualClosure).slice(0, 10) : ""}
                onChange={(e) => setRow({ ...row, actualClosure: e.target.value })}
              />
            </div>
            <TextArea
              rows={4}
              placeholder="Description of the problem which requires rectification"
              value={row.description || ""}
              onChange={(e) => setRow({ ...row, description: e.target.value })}
            />
            <TextArea
              rows={3}
              placeholder="Action required to rectify the problem (and prevent recurrence)"
              value={formData.actionRequired || ""}
              onChange={(e) => setFormData({ ...formData, actionRequired: e.target.value })}
            />

            <Card className="!p-4 bg-blue-50/60 border-blue-200 space-y-3">
              <h4 className="font-semibold text-sm">Contractor compliance — action required</h4>
              <p className="text-xs text-steel-muted leading-relaxed">
                The company on which this notice is served must rectify the substandard conditions and record their
                response below. SPDC office will verify compliance before closing the NCR/CAR.
              </p>
              <TextArea
                rows={2}
                placeholder="Work carried out in accordance with requirements (contractor response)"
                value={formData.workCarriedOutNote || ""}
                onChange={(e) => setFormData({ ...formData, workCarriedOutNote: e.target.value })}
              />
              <div className="grid sm:grid-cols-2 gap-2">
                <Input
                  placeholder="Signed — contractor representative"
                  value={formData.signedContractor || ""}
                  onChange={(e) => setFormData({ ...formData, signedContractor: e.target.value })}
                />
                <Input
                  placeholder="Position — contractor"
                  value={formData.positionContractor || ""}
                  onChange={(e) => setFormData({ ...formData, positionContractor: e.target.value })}
                />
              </div>
              {formData.contractorEmail && (
                <p className="text-[11px] text-steel-muted font-mono">
                  Notified at raise: {formData.contractorEmail}
                  {formData.followUpCount && Number(formData.followUpCount) > 0
                    ? ` · ${formData.followUpCount} follow-up(s) sent`
                    : ""}
                  {formData.lastFollowUpAt
                    ? ` · last ${String(formData.lastFollowUpAt).slice(0, 10)}`
                    : ""}
                </p>
              )}
            </Card>

            {isOfficeAdmin && (
              <Card className="!p-4 bg-sand/30 border-brand/20 space-y-3">
                <h4 className="font-semibold text-sm">SPDC office — {isCar ? "CAR" : "NCR"} follow-up &amp; close-out</h4>
                <p className="text-xs text-steel-muted leading-relaxed">
                  Send {isCar ? "CAR" : "NCR"} reminders to the contractor, record whether they acted, then complete
                  close-out and close the register row when verified.
                </p>

                {row.status === "Open" && (
                  <div className="rounded-lg border border-line bg-white p-3 space-y-2">
                    <p className="text-xs font-semibold text-ink">Send {isCar ? "CAR" : "NCR"} follow-up to contractor</p>
                    <TextArea
                      rows={2}
                      placeholder="Optional note (e.g. planned closure date approaching)"
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

                <div className="grid sm:grid-cols-2 gap-2">
                  <Select
                    value={formData.contractorActed || ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "Yes" || v === "No") markContractorActed(v);
                      else setFormData({ ...formData, contractorActed: v });
                    }}
                  >
                    <option value="">Contractor acted / complied?</option>
                    <option value="Yes">Yes — contractor complied</option>
                    <option value="No">No — did not comply</option>
                  </Select>
                  <Input
                    type="date"
                    placeholder="Verified on"
                    value={formData.contractorActedAt ? String(formData.contractorActedAt).slice(0, 10) : ""}
                    onChange={(e) => setFormData({ ...formData, contractorActedAt: e.target.value })}
                  />
                </div>
                {formData.contractorActed === "No" && (
                  <TextArea
                    rows={2}
                    placeholder="Why contractor did not comply (required if Not acted)"
                    value={formData.contractorActedNote || ""}
                    onChange={(e) => setFormData({ ...formData, contractorActedNote: e.target.value })}
                  />
                )}

                <p className="text-xs text-steel-muted leading-relaxed">
                  Failure to act within the specified time may result in SPDC taking further action — costs payable by
                  the company on which this notice is served.
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  <Select
                    value={formData.pursueFurtherCosts || ""}
                    onChange={(e) => setFormData({ ...formData, pursueFurtherCosts: e.target.value })}
                  >
                    <option value="">Pursue further action/costs?</option>
                    <option value="Yes">Yes — notify Project Manager</option>
                    <option value="No">No</option>
                  </Select>
                  <Select
                    value={formData.siteSetupModification || ""}
                    onChange={(e) => setFormData({ ...formData, siteSetupModification: e.target.value })}
                  >
                    <option value="">Site set-up modification required?</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </Select>
                  <Select
                    value={formData.followUpEffective || ""}
                    onChange={(e) => setFormData({ ...formData, followUpEffective: e.target.value })}
                  >
                    <option value="">Follow-up: action effective?</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </Select>
                  <Input
                    placeholder="Signed — SPDC reviewer"
                    value={formData.signedReviewer || ""}
                    onChange={(e) => setFormData({ ...formData, signedReviewer: e.target.value })}
                  />
                </div>
                <TextArea
                  rows={3}
                  placeholder="Action required (close-out)"
                  value={formData.correctiveActionDetail || formData.furtherAction || ""}
                  onChange={(e) => setFormData({ ...formData, correctiveActionDetail: e.target.value })}
                />
                <div className="grid sm:grid-cols-2 gap-2">
                  <Input
                    placeholder="By whom (responsible party)"
                    value={formData.actionByWhom || row.contractor || ""}
                    onChange={(e) => setFormData({ ...formData, actionByWhom: e.target.value })}
                  />
                  <Input
                    placeholder="Completed (date or note)"
                    value={formData.actionCompleted || ""}
                    onChange={(e) => setFormData({ ...formData, actionCompleted: e.target.value })}
                  />
                </div>
              </Card>
            )}

            {!isOfficeAdmin && row.status === "Open" && (
              <Card className="!p-3 bg-sand/20 border-line text-xs text-steel-muted">
                SPDC office will send follow-ups, verify your compliance, and close this NCR/CAR. Save your contractor
                response above.
              </Card>
            )}
          </Card>
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
      </div>
      </main>

      <footer className="z-20 border-t border-line bg-paper shadow-[0_-4px_20px_rgba(0,0,0,0.06)] shrink-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-2">
          <Button type="button" disabled={busy} onClick={() => void saveDraft()}>
            {busy ? "Saving…" : "Save form"}
          </Button>
          <Button type="button" variant="secondary" className="!text-xs" onClick={() => void downloadXlsx()}>
            Download XLSX
          </Button>
          <Button type="button" variant="secondary" className="!text-xs" onClick={openPrintPdf}>
            Print / PDF
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
    </div>
  );
}
