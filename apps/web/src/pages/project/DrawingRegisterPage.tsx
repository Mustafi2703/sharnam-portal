import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { DrawingRegisterCharts } from "../../components/DrawingRegisterCharts";
import { MasterDrawingRegisterForm } from "../../components/MasterDrawingRegisterForm";
import { MasterDrawingRegisterTable } from "../../components/MasterDrawingRegisterTable";
import { Badge, Button, Card, PageHeader } from "../../components/ui";
import { downloadAuthFile } from "../../lib/downloadReport";
import { drawingRegisterSheetFromParams } from "../../lib/drawingRegisterViews";
import {
  emptyMasterRegisterForm,
  lineToMasterRegisterForm,
  masterRegisterPayload,
  type MasterRegisterForm,
} from "../../lib/masterDrawingRegister";

function PivotTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <Card className="!p-0 overflow-hidden">
      <div className="px-3 py-2 border-b border-line bg-sand/40 text-[10px] font-mono uppercase tracking-wider text-steel-muted">
        {title}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase text-steel-muted">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-3 py-3 text-steel-muted">
                No lines yet
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="border-t border-line">
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-1.5">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Card>
  );
}

function DrawingRegisterDashboard({ data }: { data: any }) {
  const buildingRows = (data.pivots?.byBuildingDiscipline || []).map((r: any) => [r.building, r.discipline, r.count]);
  const disciplineRows = (data.pivots?.byDiscipline || []).map((r: any) => [r.label, r.value]);
  const criticalRows = (data.pivots?.byCritical || []).map((r: any) => [r.label, r.value]);
  const delayRows = (data.pivots?.delayByResponsibility || []).map((r: any) => [r.label, r.days]);
  const consultantRows = (data.pivots?.byConsultant || []).map((r: any) => [r.label, r.value]);

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          ["Week", data.dashboard?.weekLabel ?? "Week #"],
          ["Total drawings", data.totals?.lines || 0],
          ["GFC type", data.totals?.gfc ?? 0],
          ["Critical", data.totals?.critical ?? 0],
          ["Linked to GFC upload", data.totals?.linkedGfc ?? 0],
        ].map(([l, v]) => (
          <Card key={l as string} className="!p-4">
            <div className="text-[10px] uppercase text-steel-muted font-mono">{l}</div>
            <div className="text-2xl font-display mt-1">{v as string | number}</div>
          </Card>
        ))}
      </div>
      <DrawingRegisterCharts
        byDiscipline={data.pivots?.byDiscipline || []}
        byCritical={data.pivots?.byCritical || []}
        delayByResponsibility={data.pivots?.delayByResponsibility || []}
        byConsultant={data.pivots?.byConsultant || []}
        byPackage={data.pivots?.byPackage || []}
        byBuilding={data.pivots?.byBuilding || []}
        byDrawingType={data.pivots?.byDrawingType || data.charts?.byDrawingType || []}
        byBuildingDiscipline={data.pivots?.byBuildingDiscipline || []}
      />
      <p className="text-xs text-steel-muted">
        Same pivots as DRAWING REGISTER - 01.xlsx Dashboard. Excel and PDF exports match the workbook layout and file to SharePoint when you publish.
      </p>
      <div className="grid lg:grid-cols-2 gap-4">
        <PivotTable title="Building × discipline" headers={["Building", "Discipline", "Count"]} rows={buildingRows} />
        <PivotTable title="Discipline" headers={["Discipline", "Count"]} rows={disciplineRows} />
        <PivotTable title="Critical drawing" headers={["Critical", "Count"]} rows={criticalRows} />
        <PivotTable title="Delay responsibility" headers={["Responsibility", "Sum of delay (days)"]} rows={delayRows} />
        <PivotTable title="Consultant" headers={["Consultant name", "Count"]} rows={consultantRows} />
      </div>
    </div>
  );
}

export default function DrawingRegisterPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sheetView = drawingRegisterSheetFromParams(searchParams);
  const sheetKey = sheetView.key;
  const { token, user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState<MasterRegisterForm>(emptyMasterRegisterForm);
  const [filterPackage, setFilterPackage] = useState("All");
  const [filterBuilding, setFilterBuilding] = useState("All");
  const [filterDiscipline, setFilterDiscipline] = useState("All");
  const [filterCritical, setFilterCritical] = useState("All");
  const [publishBusy, setPublishBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const canEdit = ["admin", "office", "employee", "site_employee"].includes(user?.role || "");

  const load = async () => {
    const res = await api(`/api/drawings/project/${id}/register-dashboard`, { token });
    setData(res);
  };

  useEffect(() => {
    const sheet = searchParams.get("sheet");
    if ((sheet === "client" || sheet === "site") && id) {
      navigate(`/projects/${id}/drawings/register?sheet=master`, { replace: true });
    }
  }, [id, searchParams, navigate]);

  useEffect(() => {
    void load();
  }, [id, token, sheetKey]);

  useEffect(() => {
    if (filterDiscipline !== "All" && !editingId) {
      setForm((f) => ({ ...f, discipline: filterDiscipline, drawingType: "Good For Construction (GFC)" }));
    }
  }, [filterDiscipline, editingId]);

  async function saveLine(e: FormEvent) {
    e.preventDefault();
    try {
      if (editingId) {
        await api(`/api/drawings/register-lines/${editingId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(masterRegisterPayload(form)),
        });
        setMsg(`Updated ${form.drawingNumber}`);
        setEditingId(null);
      } else {
        await api(`/api/drawings/project/${id}/register-lines`, {
          method: "POST",
          token,
          body: JSON.stringify(masterRegisterPayload(form)),
        });
        setMsg(`Master line ${form.drawingNumber} saved`);
      }
      setForm({ ...emptyMasterRegisterForm(), projectPackage: form.projectPackage, building: form.building });
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  async function importRegisterFile(file: File | null) {
    if (!file || !id) return;
    setImportBusy(true);
    setMsg("Importing master register from Excel…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const out = await api<{ lines: number; source: string }>(`/api/drawings/project/${id}/register/import`, {
        method: "POST",
        token,
        body: fd,
        timeoutMs: 180_000,
      });
      setMsg(`Imported ${out.lines} master lines from ${out.source}. Charts refresh below.`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportBusy(false);
    }
  }

  const lines = data?.lines || [];

  const filteredLines = useMemo(() => {
    return lines.filter((r: any) => {
      if (filterPackage !== "All" && (r.projectPackage || "") !== filterPackage) return false;
      if (filterBuilding !== "All" && (r.building || "") !== filterBuilding) return false;
      if (filterDiscipline !== "All" && (r.discipline || "") !== filterDiscipline) return false;
      if (filterCritical === "Yes" && !/yes/i.test(r.criticalDrawing || "")) return false;
      if (filterCritical === "No" && /yes/i.test(r.criticalDrawing || "")) return false;
      return true;
    });
  }, [lines, filterPackage, filterBuilding, filterDiscipline, filterCritical]);

  return (
    <div
      className={`min-w-0 ${
        sheetKey === "master"
          ? "page-stack--register flex flex-col flex-1 min-h-0 overflow-hidden gap-2 pb-2"
          : "space-y-5"
      }`}
    >
      <div className="shrink-0">
      <PageHeader
        eyebrow="Drawings module"
        title={sheetView.label}
        subtitle={
          sheetKey === "master"
            ? "Master Drawing Register — DCI schedule from DRAWING REGISTER - 01.xlsx. Upload PDF/DWG on Approval & GFC log only."
            : "Drawing Register Dashboard — DRAWING REGISTER - 01.xlsx layout. Site register tab is not used."
        }
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <Badge tone="brand">{data?.totals?.lines ?? 0} lines</Badge>
            <Badge tone="ok">{data?.totals?.gfc ?? 0} GFC</Badge>
            {sheetKey === "" && id && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  className="!text-xs"
                  onClick={() =>
                    void downloadAuthFile(
                      `/api/drawings/project/${id}/register/export.xlsx`,
                      token,
                      "DRAWING-REGISTER-01.xlsx",
                    )
                  }
                >
                  Excel (01)
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="!text-xs"
                  onClick={() =>
                    void downloadAuthFile(
                      `/api/drawings/project/${id}/register/dashboard.pdf`,
                      token,
                      "DRAWING-REGISTER-Dashboard.pdf",
                    )
                  }
                >
                  Dashboard PDF
                </Button>
              </>
            )}
            {canEdit && id && (
              <>
                <label className="inline-flex items-center rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-ink hover:bg-sand/60 cursor-pointer">
                  {importBusy ? "Importing…" : "Upload Excel"}
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="sr-only"
                    disabled={importBusy}
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      e.target.value = "";
                      void importRegisterFile(f);
                    }}
                  />
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  className="!text-xs"
                  disabled={publishBusy}
                  onClick={() => {
                    setPublishBusy(true);
                    setMsg("Publishing registers to SharePoint…");
                    void api(`/api/drawings/project/${id}/publish-registers`, { method: "POST", token, timeoutMs: 180_000 })
                      .then(() => setMsg("SharePoint updated — DRAWING-REGISTER-01.xlsx, Dashboard PDF, Approval-GFC log."))
                      .catch((err) => setMsg(err instanceof Error ? err.message : "Publish failed"))
                      .finally(() => setPublishBusy(false));
                  }}
                >
                  {publishBusy ? "Publishing…" : "Publish → SharePoint"}
                </Button>
              </>
            )}
            <Link to={`/projects/${id}/drawings`} className="text-sm font-semibold text-brand">
              Approval & GFC log →
            </Link>
            <Link to={`/projects/${id}/hub/drawings`} className="text-sm font-semibold text-brand">
              Drawings hub →
            </Link>
          </div>
        }
      />
      </div>

      {msg && <p className="text-sm bg-brand-soft text-brand-dark rounded-lg px-3 py-2 shrink-0">{msg}</p>}

      {sheetKey === "" && data && (
        <DrawingRegisterDashboard data={data} />
      )}

      {sheetKey === "master" && canEdit && (
        <div className="shrink-0">
        <MasterDrawingRegisterForm
          projectId={id!}
          form={form}
          onChange={setForm}
          onSubmit={saveLine}
          editingId={editingId}
          onCancelEdit={() => {
            setEditingId(null);
            setForm(emptyMasterRegisterForm());
          }}
        />
        </div>
      )}

      {sheetKey === "master" && (
        <div className="register-page-fill flex flex-col flex-1 min-h-0 overflow-hidden">
        <MasterDrawingRegisterTable
          lines={lines}
          filteredLines={filteredLines}
          projectId={id!}
          canEdit={canEdit}
          token={token}
          onLinePatched={load}
          onEditLine={(row) => {
            setEditingId(row.id);
            setForm(lineToMasterRegisterForm(row));
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          filterPackage={filterPackage}
          filterBuilding={filterBuilding}
          filterDiscipline={filterDiscipline}
          filterCritical={filterCritical}
          onFilterPackage={setFilterPackage}
          onFilterBuilding={setFilterBuilding}
          onFilterDiscipline={setFilterDiscipline}
          onFilterCritical={setFilterCritical}
          onClearFilters={() => {
            setFilterPackage("All");
            setFilterBuilding("All");
            setFilterDiscipline("All");
            setFilterCritical("All");
          }}
        />
        </div>
      )}

      {sheetKey === "" && (
        <Card className="text-sm text-steel-muted">
          <p>
            Counts and charts above come from master register lines on this project. Use <strong>Master register</strong> for DCI columns, then upload on{" "}
            <Link to={`/projects/${id}/drawings`} className="text-brand font-semibold">
              Approval & GFC log
            </Link>{" "}
            after Drawing Check Master unlocks. Publish writes the formatted Excel and PDF to the project drawings folder on SharePoint.
          </p>
        </Card>
      )}
    </div>
  );
}
