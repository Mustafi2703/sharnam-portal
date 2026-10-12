import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import {
  DrawingRegisterCharts,
  filterRegisterLines,
  isoWeekNumber,
  isoWeekRange,
  type RegisterDashLine,
} from "../../components/DrawingRegisterCharts";
import { MasterDrawingRegisterForm } from "../../components/MasterDrawingRegisterForm";
import { ProjectWeekPicker, addDaysKey, mondayKey, useProjectStart } from "../../components/ProjectWeekPicker";
import { projectWeekNumber } from "@sharnam/shared";
import { useDrawingPicklists } from "../../lib/drawingPicklists";
import { DrawingPackMenu } from "../../components/DrawingPackMenu";
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
import { StatusNote } from "../../components/StatusNote";
import { RegisterEntryModal } from "../../components/RegisterEntryModal";

function DrawingRegisterDashboard({ data, projectId, token }: { data: any; projectId?: string; token?: string | null }) {
  const { start: projectStart } = useProjectStart(projectId, token);
  // null = all dates; otherwise the Monday of the picked project week.
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const lines = (data.lines || []) as RegisterDashLine[];
  const range = useMemo(() => {
    if (from || to) {
      const start = from ? new Date(`${from}T00:00:00`) : new Date("2000-01-01");
      const end = to ? new Date(`${to}T23:59:59`) : new Date("2100-01-01");
      return { start, end, label: `${from || "…"} to ${to || "…"}` };
    }
    if (weekStart) {
      const n = projectWeekNumber(weekStart, projectStart);
      return { start: new Date(`${weekStart}T00:00:00`), end: new Date(`${addDaysKey(weekStart, 6)}T23:59:59`), label: `Week ${n ?? "—"}` };
    }
    return { start: null as Date | null, end: null as Date | null, label: "All dates" };
  }, [from, to, weekStart, projectStart]);
  const shown = useMemo(
    () => filterRegisterLines(lines, range.start, range.end),
    [lines, range.start, range.end],
  );
  const submitted = shown.filter((l) => l.actualSubmissionDate).length;
  const critical = shown.filter((l) => /yes/i.test(l.criticalDrawing || "")).length;
  const delayed = shown.filter((l) => (l.submissionDelayDays ?? 0) > 0).length;

  return (
    <div className="space-y-4">
      <Card className="!p-4 flex flex-wrap gap-3 items-end">
        <ProjectWeekPicker
          weekStart={weekStart || mondayKey()}
          onChange={(k) => {
            setWeekStart(k);
            setFrom("");
            setTo("");
          }}
          projectStart={projectStart}
          extra={
            <Button type="button" variant={weekStart ? "secondary" : "primary"} className="!text-xs !py-1.5" onClick={() => setWeekStart(null)}>
              All dates
            </Button>
          }
        />
        <label className="text-xs text-steel-muted">
          From
          <input
            type="date"
            className="mt-1 block rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-ink"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="text-xs text-steel-muted">
          To
          <input
            type="date"
            className="mt-1 block rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-ink"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <p className="text-xs text-steel-muted max-w-xl">
          {range.label}. Counts come from GFC uploads and the master register. A new week folder is filed on SharePoint for the WPR and DPR.
        </p>
      </Card>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          ["Week", range.label],
          ["Total drawings", shown.length],
          ["Submitted", submitted],
          ["Critical", critical],
          ["Delayed", delayed],
        ].map(([l, v]) => (
          <Card key={l as string} className="!p-4">
            <div className="text-[10px] uppercase text-steel-muted font-mono">{l}</div>
            <div className="text-2xl font-display mt-1">{v as string | number}</div>
          </Card>
        ))}
      </div>
      <DrawingRegisterCharts lines={shown} />
    </div>
  );
}

export default function DrawingRegisterPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const masterPath = location.pathname.endsWith("/drawings/register/master");
  const sheetView = masterPath
    ? { key: "master" as const, label: "Master register" }
    : drawingRegisterSheetFromParams(searchParams);
  const sheetKey = sheetView.key;
  const { token, user } = useAuth();
  const picklists = useDrawingPicklists(id, token);
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
  const [lineModal, setLineModal] = useState(false);
  const [savingLine, setSavingLine] = useState(false);
  const canEdit = ["admin", "office", "employee", "site_employee"].includes(user?.role || "");
  /** Import (bulk overwrite from Excel) is an office task; everyone who can view can export. */
  const isOffice = user?.role === "admin" || user?.role === "office";

  const load = async () => {
    const res = await api(`/api/drawings/project/${id}/register-dashboard`, { token });
    setData(res);
  };

  useEffect(() => {
    const sheet = searchParams.get("sheet");
    if ((sheet === "client" || sheet === "site" || sheet === "master") && id && !masterPath) {
      navigate(`/projects/${id}/drawings/register/master`, { replace: true });
    }
  }, [id, searchParams, navigate, masterPath]);

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
    setSavingLine(true);
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
      setLineModal(false);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setSavingLine(false);
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
          ? "flex flex-col gap-3 pb-8"
          : "space-y-5"
      }`}
    >
      <div className="shrink-0">
      <PageHeader
        eyebrow="Drawings module"
        title={sheetView.label}
        subtitle={
          sheetKey === "master"
            ? "Every GFC upload updates its line here. Set the planned submission date and criticality — delay counts from the planned date until the drawing is submitted (red = late). Download as Sharnam-branded Excel or PDF; the same files are kept on SharePoint."
            : "DRAWING REGISTER - 01.xlsx Dashboard. Charts fill from GFC uploads and the master register. Pick a week or dates. Each week is filed for the WPR and DPR."
        }
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <Badge tone="brand">{data?.totals?.lines ?? 0} lines</Badge>
            <Badge tone="ok">{data?.totals?.gfc ?? 0} GFC</Badge>
            {sheetKey === "master" && id && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  className="!text-xs"
                  onClick={() =>
                    downloadAuthFile(`/api/drawings/project/${id}/register/export.xlsx`, token, "Master-Drawing-Register.xlsx").catch(
                      (err) => setMsg(err instanceof Error ? err.message : "Could not download the Excel"),
                    )
                  }
                >
                  Download Excel
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="!text-xs"
                  onClick={() =>
                    downloadAuthFile(`/api/drawings/project/${id}/register/master.pdf`, token, "Master-Drawing-Register.pdf").catch(
                      (err) => setMsg(err instanceof Error ? err.message : "Could not download the PDF"),
                    )
                  }
                >
                  Download PDF
                </Button>
              </>
            )}
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
            {id && <DrawingPackMenu projectId={id} token={token} onMsg={setMsg} canPublish={canEdit} />}
            {canEdit && id && (
              <>
                {isOffice ? (
                <label className="inline-flex items-center rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-ink hover:bg-sand/60 cursor-pointer">
                  {importBusy ? "Importing…" : "Import Excel"}
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
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  className="!text-xs"
                  disabled={publishBusy}
                  onClick={() => {
                    setPublishBusy(true);
                    setMsg("Syncing the database into the SharePoint sheets…");
                    void api(`/api/drawings/project/${id}/publish-registers`, { method: "POST", token, timeoutMs: 180_000 })
                      .then(() => setMsg("SharePoint synced — live sheets plus this week’s folder for the WPR and DPR."))
                      .catch((err) => setMsg(err instanceof Error ? err.message : "Publish failed"))
                      .finally(() => setPublishBusy(false));
                  }}
                >
                  {publishBusy ? "Syncing…" : "Sync to SharePoint"}
                </Button>
              </>
            )}
            {sheetKey === "" && (
              <Link to={`/projects/${id}/drawings/register/master`} className="text-sm font-semibold text-brand">
                Master register →
              </Link>
            )}
            {sheetKey === "master" && (
              <Link to={`/projects/${id}/drawings/register`} className="text-sm font-semibold text-brand">
                Dashboard →
              </Link>
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

      <StatusNote msg={msg} className="shrink-0" />

      {sheetKey === "" && data && (
        <DrawingRegisterDashboard data={data} projectId={id} token={token} />
      )}


      {sheetKey === "master" && canEdit && (
        <div className="shrink-0 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm((f) => ({ ...emptyMasterRegisterForm(), projectPackage: f.projectPackage, building: f.building }));
              setLineModal(true);
            }}
          >
            + Add master register line
          </Button>
          <span className="text-xs text-steel-muted">Opens a form with every register column; required fields are marked *.</span>
        </div>
      )}

      <RegisterEntryModal
        open={lineModal}
        title={editingId ? `Edit master line · ${form.drawingNumber || "…"}` : "Add master register line"}
        size="3xl"
        saving={savingLine}
        saveLabel={editingId ? "Save changes" : "Save master line"}
        onClose={() => {
          setLineModal(false);
          setEditingId(null);
        }}
        onSave={() => (document.getElementById("master-line-form") as HTMLFormElement | null)?.requestSubmit()}
      >
        <MasterDrawingRegisterForm
          picklists={picklists.lists}
          projectId={id!}
          form={form}
          onChange={setForm}
          onSubmit={saveLine}
          editingId={editingId}
          formId="master-line-form"
          inModal
          packageOptions={[...new Set<string>(lines.map((l: any) => l.projectPackage).filter(Boolean))]}
          buildingOptions={[...new Set<string>(lines.map((l: any) => l.building).filter(Boolean))]}
        />
      </RegisterEntryModal>

      {sheetKey === "master" && (
        <div className="flex flex-col min-w-0">
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
            setLineModal(true);
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
