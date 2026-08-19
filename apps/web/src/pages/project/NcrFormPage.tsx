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

/** Standalone NCR / CAR form window — Safety NCR.xlsx · NCR 01 .xlsx layout. */
export default function NcrFormPage() {
  const { id, scope, recordId } = useParams();
  const { token, user } = useAuth();
  const isQuality = scope === "quality";
  const [row, setRow] = useState<any>(null);
  const [formData, setFormData] = useState<QualityNcrFormData>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!id || !recordId) return;
    if (isQuality) {
      const dash = await api<any>(`/api/checklist/project/${id}/quality-dashboard`, { token });
      const found = (dash.ncrs || []).find((n: any) => n.id === recordId);
      setRow(found || null);
      setFormData(parseFormData(found?.formDataJson));
    } else {
      const payload = await api<any>(`/api/safety/project/${id}`, { token });
      const found = (payload.records || []).find((r: any) => r.id === recordId);
      setRow(found || null);
    }
  };

  useEffect(() => {
    void load();
  }, [id, recordId, token, isQuality]);

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

  async function save(patch: Record<string, unknown>) {
    if (!id || !recordId) return;
    setBusy(true);
    setMsg("");
    try {
      if (isQuality) {
        const updated = await api<any>(`/api/checklist/project/${id}/ncr/${recordId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify({
            ...patch,
            formDataJson: formData,
          }),
        });
        setRow(updated);
      } else {
        const updated = await api<any>(`/api/safety/${recordId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(patch),
        });
        setRow(updated);
      }
      setMsg("Saved");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    if (!recordId) return;
    const path = isQuality
      ? `/api/checklist/project/${id}/ncr/${recordId}/export.xlsx`
      : `/api/safety/${recordId}/export.xlsx`;
    const name = `${row?.number || row?.ncrNumber || "NCR"}.xlsx`;
    await downloadAuthFile(path, token, name);
  }

  if (!row) {
    return (
      <div className="p-6">
        <p className="text-steel-muted">Loading NCR form…</p>
      </div>
    );
  }

  const canClose = isQuality ? closeMissing.length === 0 : missing.length === 0;
  const templateName = isQuality ? "NCR 01 .xlsx" : "Safety NCR.xlsx";

  return (
    <div className="min-h-screen bg-paper p-4 sm:p-6 space-y-4 max-w-4xl mx-auto">
      <PageHeader
        eyebrow={isQuality ? "Quality NCR / CAR" : "Safety NCR"}
        title={row.number || row.ncrNumber || row.title}
        subtitle={`Complete all fields per ${templateName} before closing. Download filled form when ready.`}
      />

      <div className="flex flex-wrap gap-2 items-center">
        <Badge tone={row.status === "Open" ? "warn" : "ok"}>{row.status}</Badge>
        {missing.length > 0 && (
          <span className="text-xs text-amber-800 bg-amber-50 px-2 py-1 rounded">
            {missing.length} required field{missing.length === 1 ? "" : "s"} incomplete
          </span>
        )}
        <Button type="button" variant="secondary" className="!text-xs ml-auto" onClick={() => void download()}>
          Download {templateName}
        </Button>
      </div>

      {isQuality ? (
        <Card className="space-y-3">
          <h3 className="font-semibold text-sm">NCR 01 — Non-Conformance / CAR</h3>
          <div className="grid sm:grid-cols-2 gap-2">
            <Input
              placeholder="Project name"
              value={formData.projectName || ""}
              onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
            />
            <Input
              placeholder="To (party)"
              value={formData.toParty || ""}
              onChange={(e) => setFormData({ ...formData, toParty: e.target.value })}
            />
            <Input
              placeholder="From (party)"
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
            rows={3}
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
          <TextArea
            rows={2}
            placeholder="Work carried out in accordance with requirements"
            value={formData.workCarriedOutNote || ""}
            onChange={(e) => setFormData({ ...formData, workCarriedOutNote: e.target.value })}
          />
          <div className="grid sm:grid-cols-2 gap-2">
            <Input
              placeholder="Signed — contractor rep"
              value={formData.signedContractor || ""}
              onChange={(e) => setFormData({ ...formData, signedContractor: e.target.value })}
            />
            <Input
              placeholder="Position — contractor"
              value={formData.positionContractor || ""}
              onChange={(e) => setFormData({ ...formData, positionContractor: e.target.value })}
            />
            <Select
              value={formData.followUpEffective || ""}
              onChange={(e) => setFormData({ ...formData, followUpEffective: e.target.value })}
            >
              <option value="">Follow-up: action effective?</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </Select>
            <Input
              placeholder="Signed — reviewer"
              value={formData.signedReviewer || ""}
              onChange={(e) => setFormData({ ...formData, signedReviewer: e.target.value })}
            />
          </div>
          <Button
            type="button"
            disabled={busy}
            onClick={() =>
              void save({
                description: row.description,
                contractor: row.contractor,
                location: row.location,
                ncrType: row.ncrType,
                plannedClosure: row.plannedClosure || null,
                actualClosure: row.actualClosure || null,
              })
            }
          >
            Save form
          </Button>
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
          <Button type="button" disabled={busy} onClick={() => void save({ ...row })}>
            Save form
          </Button>
        </Card>
      )}

      {missing.length > 0 && (
        <Card className="!p-3 bg-amber-50 border-amber-200">
          <p className="text-xs font-semibold text-amber-900 mb-1">Required before close:</p>
          <ul className="text-xs text-amber-800 list-disc pl-4">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {row.status === "Open" && (
          <Button
            type="button"
            disabled={!canClose || busy || !user}
            onClick={async () => {
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
                setMsg("Closed — email notification sent to project recipients");
                await load();
              } catch (err) {
                setMsg(err instanceof Error ? err.message : "Cannot close — complete form first");
              } finally {
                setBusy(false);
              }
            }}
          >
            Close NCR
          </Button>
        )}
      </div>

      {msg && <p className="text-sm text-brand-dark">{msg}</p>}
    </div>
  );
}
