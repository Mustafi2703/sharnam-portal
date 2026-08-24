import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../../components/ui";
import { ReferenceSheetToolbar } from "../../components/ReferenceSheetToolbar";
import { RegisterEntryModal } from "../../components/RegisterEntryModal";
import { RegisterEmptyRow, RegisterSheetFrame } from "../../components/RegisterSheetFrame";
import { PieChart } from "../../components/PieChart";
import { downloadAuthFile } from "../../lib/downloadReport";

type Tab =
  | "dashboard"
  | "findings"
  | "site-walk"
  | "dc-interview"
  | "folder-sample"
  | "kpi-dashboard"
  | "subjects"
  | "role-kra";

const TABS: { key: Tab; label: string; sheet?: string }[] = [
  { key: "dashboard", label: "Audit dashboard", sheet: "DASHBOARD" },
  { key: "findings", label: "Findings", sheet: "FINDINGS" },
  { key: "site-walk", label: "Site walk", sheet: "SITE_WALK" },
  { key: "dc-interview", label: "DC interview", sheet: "DC_INTERVIEW" },
  { key: "folder-sample", label: "Folder sample", sheet: "FOLDER_SAMPLE" },
  { key: "kpi-dashboard", label: "KPI dashboard", sheet: "00_KPI_DASHBOARD" },
  { key: "subjects", label: "Subject data", sheet: "03_SUBJECT_DATA" },
  { key: "role-kra", label: "Role KRA", sheet: "06_ROLE_KRA" },
];

function sectionForTab(tab: Tab) {
  if (tab === "site-walk") return "SiteWalk";
  if (tab === "dc-interview") return "DcInterview";
  if (tab === "folder-sample") return "FolderSample";
  return "";
}

export default function AuditKpiPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, user } = useAuth();
  const tab = (searchParams.get("tab") as Tab) || "dashboard";
  const [data, setData] = useState<any>(null);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [kras, setKras] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const canEdit = user?.role === "admin" || user?.role === "office" || user?.role === "employee";

  const [findingForm, setFindingForm] = useState({
    description: "",
    severity: "Minor",
    source: "Site walk",
    folderLocation: "",
  });
  const [findingModalOpen, setFindingModalOpen] = useState(false);
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [checklistModalOpen, setChecklistModalOpen] = useState(false);
  const [checklistForm, setChecklistForm] = useState({ prompt: "", locationChecked: "" });
  const [subjectForm, setSubjectForm] = useState({
    isoArea: "",
    name: "",
    custodian: "HO",
    folder: "",
  });

  const load = async () => {
    const dash = await api(`/api/audit-kpi/project/${id}/dashboard`, { token });
    setData(dash);
    if (tab === "subjects" || tab === "kpi-dashboard") {
      const s = await api<{ subjects: any[] }>(`/api/audit-kpi/project/${id}/subjects`, { token });
      setSubjects(s.subjects || []);
    }
    if (tab === "role-kra") {
      const k = await api<{ kras: any[] }>(`/api/audit-kpi/project/${id}/role-kra`, { token });
      setKras(k.kras || []);
    }
    const sec = sectionForTab(tab);
    if (sec) {
      const c = await api<{ items: any[] }>(`/api/audit-kpi/project/${id}/checklist?section=${sec}`, { token });
      setChecklist(c.items || []);
    }
  };

  useEffect(() => {
    if (!id || !token) return;
    void load().catch((e) => setMsg(String(e.message || e)));
  }, [id, token, tab]);

  const ragPie = useMemo(() => {
    const c = data?.totals?.ragCounts || {};
    return [
      { label: "Red", value: c.Red || 0, color: "#DC2626" },
      { label: "Amber", value: c.Amber || 0, color: "#D97706" },
      { label: "Green", value: c.Green || 0, color: "#16A34A" },
      { label: "Unused", value: c.UNUSED || 0, color: "#94A3B8" },
    ].filter((x) => x.value > 0);
  }, [data]);

  const findingPie = useMemo(() => {
    if (!data?.totals) return [];
    return [
      { label: "Open", value: data.totals.openFindings || 0, color: "#DC2626" },
      { label: "Closed", value: data.totals.closedFindings || 0, color: "#16A34A" },
    ].filter((x) => x.value > 0);
  }, [data]);

  const setTab = (t: Tab) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", t);
    setSearchParams(next, { replace: true });
  };

  const dl = (ext: "csv" | "xlsx", sheet: string) => {
    if (!id || !token) return;
    void downloadAuthFile(`/api/audit-kpi/project/${id}/download/${sheet}.${ext}`, token, `Sharnam-${sheet}.${ext}`);
  };

  const uploadPack =
    tab === "subjects" || tab === "role-kra" || tab === "kpi-dashboard" ? "kpi" : "site-audit";

  const uploadSheet = async (file: File) => {
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("pack", uploadPack);
      const out = await api<{ stats: Record<string, number> }>(`/api/audit-kpi/project/${id}/upload`, {
        token,
        method: "POST",
        body: fd,
      });
      setMsg(
        `Imported — ${out.stats.findings ?? 0} findings · ${out.stats.subjects ?? 0} subjects · ${out.stats.checklist ?? 0} checklist rows`
      );
      await load();
    } catch (e: any) {
      setMsg(e.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const saveFinding = async () => {
    setBusy(true);
    try {
      await api(`/api/audit-kpi/project/${id}/findings`, { token, method: "POST", body: JSON.stringify(findingForm) });
      setFindingForm({ description: "", severity: "Minor", source: "Site walk", folderLocation: "" });
      setFindingModalOpen(false);
      await load();
      setMsg("Finding added.");
    } catch (err: any) {
      setMsg(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const saveSubject = async () => {
    setBusy(true);
    try {
      await api(`/api/audit-kpi/project/${id}/subjects`, { token, method: "POST", body: JSON.stringify(subjectForm) });
      setSubjectForm({ isoArea: "", name: "", custodian: "HO", folder: "" });
      setSubjectModalOpen(false);
      await load();
      setMsg("Subject row added.");
    } catch (err: any) {
      setMsg(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const addFinding = async (e: FormEvent) => {
    e.preventDefault();
    await saveFinding();
  };

  const addSubject = async (e: FormEvent) => {
    e.preventDefault();
    await saveSubject();
  };

  const saveChecklist = async (itemId: string, patch: Record<string, unknown>) => {
    await api(`/api/audit-kpi/checklist/${itemId}`, { token, method: "PATCH", body: JSON.stringify(patch) });
    await load();
  };

  const saveChecklistRow = async () => {
    const sec = sectionForTab(tab);
    if (!sec || !id) return;
    setBusy(true);
    try {
      await api(`/api/audit-kpi/project/${id}/checklist`, {
        token,
        method: "POST",
        body: JSON.stringify({
          section: sec,
          prompt: checklistForm.prompt,
          locationChecked: checklistForm.locationChecked || null,
        }),
      });
      setChecklistForm({ prompt: "", locationChecked: "" });
      setChecklistModalOpen(false);
      await load();
      setMsg("Checklist line added.");
    } catch (err: any) {
      setMsg(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const checklistTab = ["site-walk", "dc-interview", "folder-sample"].includes(tab);
  const checklistSection = sectionForTab(tab as Tab);

  const currentSheet = TABS.find((t) => t.key === tab)?.sheet || "";

  return (
    <div className={tab !== "dashboard" && tab !== "kpi-dashboard" ? "page-stack--register flex flex-col min-h-0" : "page-stack"}>
      <PageHeader
        title="Audit & KPI"
        subtitle="Upload client Excel packs, add rows in modal or inline form, download in SPDC column format."
      />

      {(tab === "dashboard" || tab === "kpi-dashboard") && canEdit && (
        <ReferenceSheetToolbar
          sheetLabel={tab === "kpi-dashboard" ? "MASTER_KPI_DASHBOARD.xlsx" : "SITE_AUDIT_Pack.xlsx"}
          canEdit
          onUpload={uploadSheet}
          uploadHint="Use the exact column layout from docs/SITE_AUDIT_Pack.xlsx or MASTER_KPI_DASHBOARD.xlsx."
          busy={busy}
          message={msg}
        />
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`chip ${tab === t.key ? "chip--active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(tab === "dashboard" || tab === "kpi-dashboard") && data && (
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <p className="text-xs text-steel-muted">Findings</p>
            <p className="text-2xl font-semibold">{data.totals.findings}</p>
            <p className="text-xs">{data.totals.openFindings} open</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-steel-muted">KPI subjects</p>
            <p className="text-2xl font-semibold">{data.totals.subjects}</p>
            <p className="text-xs">{data.totals.overdueSubjects} with overdue</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-steel-muted">Avg closure</p>
            <p className="text-2xl font-semibold">{data.totals.avgClosurePct}%</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-steel-muted">Checklist items</p>
            <p className="text-2xl font-semibold">{data.totals.checklistItems}</p>
          </Card>
        </div>
      )}

      {(tab === "dashboard" || tab === "kpi-dashboard") && (
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {findingPie.length > 0 && (
            <Card className="p-4">
              <h3 className="font-medium mb-2">Findings status</h3>
              <PieChart title="Findings status" items={findingPie} size={180} />
            </Card>
          )}
          {ragPie.length > 0 && (
            <Card className="p-4">
              <h3 className="font-medium mb-2">Subject RAG</h3>
              <PieChart title="Subject RAG" items={ragPie} size={180} />
            </Card>
          )}
        </div>
      )}

      {tab !== "dashboard" && tab !== "kpi-dashboard" && (
        <ReferenceSheetToolbar
          sheetLabel={currentSheet}
          rowCount={
            tab === "findings"
              ? data?.findings?.length
              : tab === "subjects"
                ? subjects.length
                : tab === "role-kra"
                  ? kras.length
                  : checklist.length
          }
          canEdit={canEdit}
          onAddRow={
            tab === "findings"
              ? () => setFindingModalOpen(true)
              : tab === "subjects"
                ? () => setSubjectModalOpen(true)
                : checklistTab && canEdit
                  ? () => setChecklistModalOpen(true)
                  : undefined
          }
          onUpload={canEdit ? uploadSheet : undefined}
          uploadHint={
            tab === "role-kra" || tab === "subjects"
              ? "Upload MASTER_KPI_DASHBOARD.xlsx (03_SUBJECT_DATA / 06_ROLE_KRA sheets)."
              : "Workbook must match client template columns (FINDINGS / SITE_WALK / DC_INTERVIEW / FOLDER_SAMPLE)."
          }
          onDownloadCsv={() => {
            if (tab === "findings") dl("csv", "findings");
            else if (tab === "subjects") dl("csv", "subjects");
            else if (sectionForTab(tab)) dl("csv", tab);
          }}
          onDownloadXlsx={() => {
            if (tab === "findings") dl("xlsx", "findings");
            else if (tab === "subjects") dl("xlsx", "subjects");
          }}
          busy={busy}
          message={msg}
        />
      )}

      {tab === "findings" && (
        <RegisterSheetFrame
          title="Audit findings register"
          sheetLabel={currentSheet}
          rowCount={data?.findings?.length ?? 0}
          className="flex-1 min-h-0"
        >
          <table className="sheet-register__table min-w-[56rem]">
            <thead>
              <tr>
                {["#", "Ref", "Source", "Location", "Finding", "Severity", "Status"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.findings || []).map((f: any) => (
                <tr key={f.id}>
                  <td>{f.srNo}</td>
                  <td>{f.findingNo}</td>
                  <td>{f.source}</td>
                  <td className="wrap">{f.folderLocation}</td>
                  <td className="wrap">{f.description}</td>
                  <td>
                    <Badge tone={f.severity === "Critical" ? "danger" : "neutral"}>{f.severity}</Badge>
                  </td>
                  <td>{f.status}</td>
                </tr>
              ))}
              {!(data?.findings || []).length && <RegisterEmptyRow colSpan={7} />}
            </tbody>
          </table>
        </RegisterSheetFrame>
      )}

      {checklistTab && (
        <RegisterSheetFrame
          title={TABS.find((t) => t.key === tab)?.label || "Checklist"}
          sheetLabel={currentSheet}
          rowCount={checklist.length}
          className="flex-1 min-h-0"
        >
          <table className="sheet-register__table min-w-[48rem]">
            <thead>
              <tr>
                {["#", "Prompt", "Location", "Observed", "Score", "Response"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {checklist.map((row) => (
                <tr key={row.id}>
                  <td>{row.itemNo}</td>
                  <td className="wrap">{row.prompt}</td>
                  <td>
                    {canEdit ? (
                      <input
                        className="register-sheet-cell w-full"
                        defaultValue={row.locationChecked || ""}
                        onBlur={(e) => void saveChecklist(row.id, { locationChecked: e.target.value })}
                      />
                    ) : (
                      row.locationChecked || "—"
                    )}
                  </td>
                  <td>
                    {canEdit ? (
                      <input
                        className="register-sheet-cell w-full"
                        defaultValue={row.observed || ""}
                        onBlur={(e) => void saveChecklist(row.id, { observed: e.target.value })}
                      />
                    ) : (
                      row.observed || "—"
                    )}
                  </td>
                  <td>
                    {canEdit ? (
                      <input
                        className="register-sheet-cell w-16"
                        type="number"
                        min={0}
                        max={2}
                        defaultValue={row.score ?? ""}
                        onBlur={(e) => void saveChecklist(row.id, { score: e.target.value })}
                      />
                    ) : (
                      row.score ?? "—"
                    )}
                  </td>
                  <td>
                    {canEdit ? (
                      <input
                        className="register-sheet-cell w-full"
                        defaultValue={row.response || ""}
                        onBlur={(e) => void saveChecklist(row.id, { response: e.target.value })}
                      />
                    ) : (
                      row.response || "—"
                    )}
                  </td>
                </tr>
              ))}
              {!checklist.length && <RegisterEmptyRow colSpan={6} />}
            </tbody>
          </table>
        </RegisterSheetFrame>
      )}

      {tab === "subjects" && (
        <RegisterSheetFrame
          title="KPI subject data"
          sheetLabel={currentSheet}
          rowCount={subjects.length}
          className="flex-1 min-h-0"
        >
          <table className="sheet-register__table min-w-[44rem]">
            <thead>
              <tr>
                {["#", "ISO area", "Subject", "Custodian", "RAG", "Open", "Closed"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.id}>
                  <td>{s.srNo}</td>
                  <td className="wrap">{s.isoArea}</td>
                  <td className="wrap">{s.name}</td>
                  <td>{s.custodian}</td>
                  <td>
                    <Badge tone={s.rag === "Red" ? "danger" : s.rag === "Green" ? "ok" : "neutral"}>{s.rag}</Badge>
                  </td>
                  <td>{s.openCount}</td>
                  <td>{s.closedCount}</td>
                </tr>
              ))}
              {!subjects.length && <RegisterEmptyRow colSpan={7} />}
            </tbody>
          </table>
        </RegisterSheetFrame>
      )}

      {tab === "role-kra" && (
        <RegisterSheetFrame
          title="Role KRA matrix"
          sheetLabel={currentSheet}
          rowCount={kras.length}
          className="flex-1 min-h-0"
        >
          <table className="sheet-register__table min-w-[40rem]">
            <thead>
              <tr>
                {["Role", "KRA", "Description", "Subjects", "Red", "Amber", "Green"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {kras.map((k) => (
                <tr key={k.id}>
                  <td>{k.roleKey}</td>
                  <td>{k.kraNo}</td>
                  <td className="wrap">{k.description}</td>
                  <td>{k.subjectCount}</td>
                  <td>{k.redCount}</td>
                  <td>{k.amberCount}</td>
                  <td>{k.greenCount}</td>
                </tr>
              ))}
              {!kras.length && <RegisterEmptyRow colSpan={7} />}
            </tbody>
          </table>
        </RegisterSheetFrame>
      )}

      <RegisterEntryModal
        open={findingModalOpen}
        title="Add finding — FINDINGS sheet"
        onClose={() => setFindingModalOpen(false)}
        onSave={saveFinding}
        saving={busy}
        size="lg"
      >
        <label className="block">
          <span className="text-xs text-steel-muted">Finding description</span>
          <TextArea
            value={findingForm.description}
            onChange={(e) => setFindingForm({ ...findingForm, description: e.target.value })}
            required
          />
        </label>
        <label className="block">
          <span className="text-xs text-steel-muted">Folder / location</span>
          <Input
            value={findingForm.folderLocation}
            onChange={(e) => setFindingForm({ ...findingForm, folderLocation: e.target.value })}
          />
        </label>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-steel-muted">Severity</span>
            <Select value={findingForm.severity} onChange={(e) => setFindingForm({ ...findingForm, severity: e.target.value })}>
              {["Critical", "Major", "Minor", "Observation"].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="text-xs text-steel-muted">Source</span>
            <Select value={findingForm.source} onChange={(e) => setFindingForm({ ...findingForm, source: e.target.value })}>
              {["Site walk", "Folder sample", "DC interview"].map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </Select>
          </label>
        </div>
      </RegisterEntryModal>

      <RegisterEntryModal
        open={subjectModalOpen}
        title="Add subject — 03_SUBJECT_DATA"
        onClose={() => setSubjectModalOpen(false)}
        onSave={saveSubject}
        saving={busy}
        size="lg"
      >
        <label className="block">
          <span className="text-xs text-steel-muted">ISO area</span>
          <Input value={subjectForm.isoArea} onChange={(e) => setSubjectForm({ ...subjectForm, isoArea: e.target.value })} required />
        </label>
        <label className="block">
          <span className="text-xs text-steel-muted">Subject name</span>
          <Input value={subjectForm.name} onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })} required />
        </label>
        <label className="block">
          <span className="text-xs text-steel-muted">Folder</span>
          <Input value={subjectForm.folder} onChange={(e) => setSubjectForm({ ...subjectForm, folder: e.target.value })} />
        </label>
        <label className="block">
          <span className="text-xs text-steel-muted">Custodian (HO / SITE / BOTH)</span>
          <Select value={subjectForm.custodian} onChange={(e) => setSubjectForm({ ...subjectForm, custodian: e.target.value })}>
            {["HO", "SITE", "BOTH"].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </Select>
        </label>
      </RegisterEntryModal>

      <RegisterEntryModal
        open={checklistModalOpen}
        title={`Add line — ${checklistSection || currentSheet}`}
        onClose={() => setChecklistModalOpen(false)}
        onSave={saveChecklistRow}
        saving={busy}
        size="lg"
      >
        <label className="block">
          <span className="text-xs text-steel-muted">Prompt / checklist question</span>
          <TextArea
            value={checklistForm.prompt}
            onChange={(e) => setChecklistForm({ ...checklistForm, prompt: e.target.value })}
            required
          />
        </label>
        <label className="block">
          <span className="text-xs text-steel-muted">Location (optional)</span>
          <Input
            value={checklistForm.locationChecked}
            onChange={(e) => setChecklistForm({ ...checklistForm, locationChecked: e.target.value })}
          />
        </label>
      </RegisterEntryModal>
    </div>
  );
}
