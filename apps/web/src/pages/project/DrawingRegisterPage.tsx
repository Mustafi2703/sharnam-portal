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

function DrawingRegisterDashboard({ data }: { data: any }) {
  const now = isoWeekNumber();
  const [week, setWeek] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const lines = (data.lines || []) as RegisterDashLine[];
  const range = useMemo(() => {
    if (from || to) {
      const start = from ? new Date(`${from}T00:00:00`) : new Date("2000-01-01");
      const end = to ? new Date(`${to}T23:59:59`) : new Date("2100-01-01");
      return { start, end, label: `${from || "…"} to ${to || "…"}` };
    }
    if (week !== "all") {
      const span = isoWeekRange(now.year, Number(week));
      return { ...span, label: `Week ${week}` };
    }
    return { start: null as Date | null, end: null as Date | null, label: `Week ${now.week}` };
  }, [from, to, week, now.year, now.week]);
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
        <label className="text-xs text-steel-muted">
          Week
          <select
            className="mt-1 block rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-ink"
            value={week}
            onChange={(e) => {
              setWeek(e.target.value);
              setFrom("");
              setTo("");
            }}
          >
            <option value="all">All dates · Week {now.week}</option>
            {Array.from({ length: now.week }, (_, i) => now.week - i).map((n) => (
              <option key={n} value={String(n)}>
                Week {n}
              </option>
            ))}
          </select>
        </label>
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
            ? "Master Drawing Register from the Excel. Revision date follows the GFC upload. PMC edits planned submission date and criticality here; delay days feed the dashboard."
            : "DRAWING REGISTER - 01.xlsx Dashboard. Charts fill from GFC uploads and the master register. Pick a week or dates. Each week is filed for the WPR and DPR."
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
                    setMsg("Syncing the database into the SharePoint sheets…");
                    void api(`/api/drawings/project/${id}/publish-registers`, { method: "POST", token, timeoutMs: 180_000 })
                      .then(() => setMsg("SharePoint synced — live sheets plus this week’s folder for the WPR and DPR."))
                      .catch((err) => setMsg(err instanceof Error ? err.message : "Publish failed"))
                      .finally(() => setPublishBusy(false));
                  }}
                >
                  {publishBusy ? "Syncing…" : "Sync now"}
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
