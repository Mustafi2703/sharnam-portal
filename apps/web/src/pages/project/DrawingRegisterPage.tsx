import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { PieChart } from "../../components/PieChart";
import { MasterDrawingRegisterForm } from "../../components/MasterDrawingRegisterForm";
import { MasterDrawingRegisterTable } from "../../components/MasterDrawingRegisterTable";
import { Badge, Card, PageHeader } from "../../components/ui";
import { drawingRegisterSheetFromParams } from "../../lib/drawingRegisterViews";
import {
  emptyMasterRegisterForm,
  masterRegisterPayload,
  type MasterRegisterForm,
} from "../../lib/masterDrawingRegister";

const API_BASE = import.meta.env.VITE_API_URL || "";

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
    if (filterDiscipline !== "All") {
      setForm((f) => ({ ...f, discipline: filterDiscipline, drawingType: "Good For Construction (GFC)" }));
    }
  }, [filterDiscipline]);

  async function addLine(e: FormEvent) {
    e.preventDefault();
    try {
      await api(`/api/drawings/project/${id}/register-lines`, {
        method: "POST",
        token,
        body: JSON.stringify(masterRegisterPayload(form)),
      });
      setMsg(`Master line ${form.drawingNumber} saved`);
      setForm({ ...emptyMasterRegisterForm(), projectPackage: form.projectPackage, building: form.building });
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
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
            ? "Master Drawing Register — full DCI schedule from DRAWING REGISTER - 01.xlsx. Add/edit lines here; upload PDF/DWG on GFC register only."
            : `${sheetView.sheet} — KPIs and charts from client workbook.`
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge tone="brand">{data?.totals?.lines ?? 0} lines</Badge>
            <Badge tone="ok">{data?.totals?.gfc ?? 0} GFC</Badge>
            <Link to={`/projects/${id}/drawings`} className="text-sm font-semibold text-brand">
              GFC register (upload) →
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
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              ["Week", data.dashboard?.weekLabel ?? "Week #"],
              ["Total drawings", data.dashboard?.totalDrawings || data.totals?.lines || 0],
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
          <div className="rounded-sm border border-line bg-gradient-to-br from-[#F7F8FA] to-white p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-steel-muted mb-3">
              DRAWING REGISTER - 01.xlsx — breakdown
            </p>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              <PieChart title="By discipline" items={data.charts?.byDiscipline || []} />
              <PieChart title="By drawing type" items={data.charts?.byDrawingType || []} />
              <PieChart title="Critical drawings" items={data.charts?.byCritical || []} />
            </div>
          </div>
        </div>
      )}

      {sheetKey === "master" && canEdit && (
        <div className="shrink-0">
        <MasterDrawingRegisterForm projectId={id!} form={form} onChange={setForm} onSubmit={addLine} />
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
            Use <strong>Master register</strong> for full DCI columns from{" "}
            <code className="text-xs">DRAWING REGISTER - 01.xlsx</code>. Upload PDF/DWG via{" "}
            <Link to={`/projects/${id}/drawings`} className="text-brand font-semibold">
              GFC register
            </Link>{" "}
            after Drawing Check Master unlocks.
          </p>
          <a
            href={`${API_BASE}/api/drawings/project/${id}/export.csv`}
            className="inline-block mt-3 text-brand font-semibold text-sm"
            onClick={(e) => {
              e.preventDefault();
              void fetch(`${API_BASE}/api/drawings/project/${id}/export.csv`, {
                headers: { Authorization: `Bearer ${token}` },
              })
                .then((r) => r.blob())
                .then((b) => {
                  const u = URL.createObjectURL(b);
                  const a = document.createElement("a");
                  a.href = u;
                  a.download = "gfc-register.csv";
                  a.click();
                });
            }}
          >
            Export GFC CSV →
          </a>
        </Card>
      )}
    </div>
  );
}
