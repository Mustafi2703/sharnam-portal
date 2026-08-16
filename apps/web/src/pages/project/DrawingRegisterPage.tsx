import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { PieChart } from "../../components/PieChart";
import { SiteDrawingRegisterTable } from "../../components/SiteDrawingRegisterTable";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../../components/ui";
import { drawingRegisterSheetFromParams } from "../../lib/drawingRegisterViews";
import {
  emptyMasterRegisterForm,
  MASTER_REGISTER_DISCIPLINES,
  MASTER_REGISTER_DRAWING_TYPES,
  MASTER_REGISTER_ISSUED_TO,
  MASTER_REGISTER_PACKAGES,
  masterRegisterPayload,
  uniqSorted,
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
  const [gfcDrawings, setGfcDrawings] = useState<any[]>([]);
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
    if (sheetKey === "site") {
      const gfc = await api<any[]>(`/api/drawings/project/${id}`, { token });
      setGfcDrawings(Array.isArray(gfc) ? gfc : []);
    }
  };

  useEffect(() => {
    if (searchParams.get("sheet") === "client" && id) {
      navigate(`/projects/${id}/drawings/register?sheet=master`, { replace: true });
    }
  }, [id, searchParams, navigate]);

  useEffect(() => {
    void load();
  }, [id, token, sheetKey]);

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

  const packageOptions = useMemo(
    () => ["All", ...uniqSorted([...MASTER_REGISTER_PACKAGES, ...lines.map((l: any) => l.projectPackage)])],
    [lines]
  );
  const buildingOptions = useMemo(
    () => ["All", ...uniqSorted(lines.map((l: any) => l.building))],
    [lines]
  );
  const disciplineOptions = useMemo(
    () => ["All", ...uniqSorted([...MASTER_REGISTER_DISCIPLINES, ...lines.map((l: any) => l.discipline)])],
    [lines]
  );

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
    <div className="space-y-5">
      <PageHeader
        eyebrow="Drawings module"
        title={sheetView.label}
        subtitle={
          sheetKey === "master"
            ? "Master Drawing Register — full DCI schedule from DRAWING REGISTER - 01.xlsx. Add/edit lines here; upload PDF/DWG on GFC register only."
            : sheetKey === "site"
              ? "Site Drawing Register — receive & issue matrix R0–R6 with signatures from GFC uploads."
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

      {msg && <p className="text-sm bg-brand-soft text-brand-dark rounded-lg px-3 py-2">{msg}</p>}

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
        <Card>
          <h3 className="font-semibold mb-1">Add master register line</h3>
          <p className="text-xs text-steel-muted mb-4">
            Full DCI row — separate from GFC file upload. After saving, upload PDF/DWG on{" "}
            <Link to={`/projects/${id}/drawings`} className="text-brand font-semibold">
              GFC register
            </Link>{" "}
            using the same drawing number to link files.
          </p>
          <form className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3" onSubmit={addLine}>
            <Input placeholder="Sr #" value={form.srNo} onChange={(e) => setForm({ ...form, srNo: e.target.value })} />
            <Select value={form.projectPackage} onChange={(e) => setForm({ ...form, projectPackage: e.target.value })}>
              {MASTER_REGISTER_PACKAGES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
            <Input placeholder="Building" value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} />
            <Select value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })}>
              {MASTER_REGISTER_DISCIPLINES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
            <Input placeholder="Drawing number" value={form.drawingNumber} onChange={(e) => setForm({ ...form, drawingNumber: e.target.value })} required />
            <Input className="lg:col-span-2" placeholder="Drawing title" value={form.drawingTitle} onChange={(e) => setForm({ ...form, drawingTitle: e.target.value })} required />
            <Select value={form.drawingType} onChange={(e) => setForm({ ...form, drawingType: e.target.value })}>
              {MASTER_REGISTER_DRAWING_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
            <Input placeholder="Consultant" value={form.consultantName} onChange={(e) => setForm({ ...form, consultantName: e.target.value })} />
            <Input placeholder="Revision" value={form.revisionNumber} onChange={(e) => setForm({ ...form, revisionNumber: e.target.value })} />
            <Input type="date" placeholder="Rev date" value={form.revisionDate} onChange={(e) => setForm({ ...form, revisionDate: e.target.value })} />
            <Input className="lg:col-span-2" placeholder="Revision description" value={form.revisionDescription} onChange={(e) => setForm({ ...form, revisionDescription: e.target.value })} />
            <Select value={form.latestRevision} onChange={(e) => setForm({ ...form, latestRevision: e.target.value })}>
              <option>Yes</option>
              <option>No</option>
            </Select>
            <Input type="date" value={form.plannedSubmissionDate} onChange={(e) => setForm({ ...form, plannedSubmissionDate: e.target.value })} title="Planned submission" />
            <Input type="date" value={form.actualSubmissionDate} onChange={(e) => setForm({ ...form, actualSubmissionDate: e.target.value })} title="Actual submission" />
            <Input placeholder="Delay (days)" value={form.submissionDelayDays} onChange={(e) => setForm({ ...form, submissionDelayDays: e.target.value })} />
            <Input placeholder="Delay responsibility" value={form.delayResponsibility} onChange={(e) => setForm({ ...form, delayResponsibility: e.target.value })} />
            <Select value={form.issuedTo} onChange={(e) => setForm({ ...form, issuedTo: e.target.value })}>
              <option value="">Issued to…</option>
              {MASTER_REGISTER_ISSUED_TO.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
            <Input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} title="Issue date" />
            <Input type="number" min={0} placeholder="Copies" value={form.copiesCount} onChange={(e) => setForm({ ...form, copiesCount: e.target.value })} />
            <Select value={form.criticalDrawing} onChange={(e) => setForm({ ...form, criticalDrawing: e.target.value })}>
              <option>No</option>
              <option>Yes</option>
            </Select>
            <TextArea className="lg:col-span-4" rows={2} placeholder="Remarks" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
            <Button type="submit">Save master line</Button>
          </form>
        </Card>
      )}

      {sheetKey === "master" && (
        <Card>
          <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-semibold">Master Drawing Register</h3>
            <Badge tone="neutral">{filteredLines.length} / {lines.length} lines</Badge>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <Select className="!w-auto min-w-[8rem]" value={filterPackage} onChange={(e) => setFilterPackage(e.target.value)} aria-label="Filter by package">
              {packageOptions.map((p) => (
                <option key={p} value={p}>
                  {p === "All" ? "All packages" : p}
                </option>
              ))}
            </Select>
            <Select className="!w-auto min-w-[8rem]" value={filterBuilding} onChange={(e) => setFilterBuilding(e.target.value)} aria-label="Filter by building">
              {buildingOptions.map((b) => (
                <option key={b} value={b}>
                  {b === "All" ? "All buildings" : b}
                </option>
              ))}
            </Select>
            <Select className="!w-auto min-w-[8rem]" value={filterDiscipline} onChange={(e) => setFilterDiscipline(e.target.value)} aria-label="Filter by discipline">
              {disciplineOptions.map((d) => (
                <option key={d} value={d}>
                  {d === "All" ? "All disciplines" : d}
                </option>
              ))}
            </Select>
            <Select className="!w-auto min-w-[8rem]" value={filterCritical} onChange={(e) => setFilterCritical(e.target.value)} aria-label="Filter by critical">
              <option value="All">All critical</option>
              <option value="Yes">Critical only</option>
              <option value="No">Non-critical</option>
            </Select>
            {(filterPackage !== "All" || filterBuilding !== "All" || filterDiscipline !== "All" || filterCritical !== "All") && (
              <Button
                type="button"
                variant="ghost"
                className="!text-xs"
                onClick={() => {
                  setFilterPackage("All");
                  setFilterBuilding("All");
                  setFilterDiscipline("All");
                  setFilterCritical("All");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>

          <div className="overflow-x-auto max-h-[32rem]">
            <table className="w-full text-sm min-w-[1600px]">
              <thead>
                <tr className="text-left text-[10px] uppercase text-steel-muted font-mono border-b border-line">
                  <th className="py-2 pr-2">Sr</th>
                  <th className="py-2 pr-2">Package</th>
                  <th className="py-2 pr-2">Building</th>
                  <th className="py-2 pr-2">Discipline</th>
                  <th className="py-2 pr-2">No.</th>
                  <th className="py-2 pr-2">Title</th>
                  <th className="py-2 pr-2">Type</th>
                  <th className="py-2 pr-2">Consultant</th>
                  <th className="py-2 pr-2">Rev</th>
                  <th className="py-2 pr-2">Rev date</th>
                  <th className="py-2 pr-2">Rev desc.</th>
                  <th className="py-2 pr-2">Latest</th>
                  <th className="py-2 pr-2">Planned</th>
                  <th className="py-2 pr-2">Actual</th>
                  <th className="py-2 pr-2">Delay</th>
                  <th className="py-2 pr-2">Delay resp.</th>
                  <th className="py-2 pr-2">Issued to</th>
                  <th className="py-2 pr-2">Issue date</th>
                  <th className="py-2 pr-2">Copies</th>
                  <th className="py-2 pr-2">Critical</th>
                  <th className="py-2 pr-2">Remarks</th>
                  <th className="py-2">GFC link</th>
                </tr>
              </thead>
              <tbody>
                {filteredLines.map((r: any) => (
                  <tr key={r.id} className="border-b border-line/60">
                    <td className="py-2 pr-2 font-mono text-xs">{r.srNo ?? "—"}</td>
                    <td className="py-2 pr-2 text-xs">{r.projectPackage || "—"}</td>
                    <td className="py-2 pr-2 text-xs">{r.building || "—"}</td>
                    <td className="py-2 pr-2">{r.discipline || "—"}</td>
                    <td className="py-2 pr-2 font-mono text-xs">{String(r.drawingNumber || "").replace(/\s·\s*\d+$/, "")}</td>
                    <td className="py-2 pr-2 max-w-xs truncate">{r.drawingTitle}</td>
                    <td className="py-2 pr-2 max-w-[8rem] truncate text-xs">{r.drawingType || "—"}</td>
                    <td className="py-2 pr-2 max-w-[8rem] truncate text-xs">{r.consultantName || "—"}</td>
                    <td className="py-2 pr-2 font-mono">{r.revisionNumber || "—"}</td>
                    <td className="py-2 pr-2 text-xs whitespace-nowrap">
                      {r.revisionDate ? new Date(r.revisionDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-2 pr-2 max-w-[10rem] truncate text-xs">{r.revisionDescription || "—"}</td>
                    <td className="py-2 pr-2">{r.latestRevision || "—"}</td>
                    <td className="py-2 pr-2 text-xs whitespace-nowrap">
                      {r.plannedSubmissionDate ? new Date(r.plannedSubmissionDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-2 pr-2 text-xs whitespace-nowrap">
                      {r.actualSubmissionDate ? new Date(r.actualSubmissionDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-2 pr-2 font-mono text-xs">
                      {r.submissionDelayDays != null ? r.submissionDelayDays : "—"}
                    </td>
                    <td className="py-2 pr-2 text-xs max-w-[8rem] truncate">{r.delayResponsibility || "—"}</td>
                    <td className="py-2 pr-2 text-xs max-w-[8rem] truncate">{r.issuedTo || "—"}</td>
                    <td className="py-2 pr-2 text-xs whitespace-nowrap">
                      {r.issueDate ? new Date(r.issueDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-2 pr-2 font-mono">{r.copiesCount ?? "—"}</td>
                    <td className="py-2 pr-2">{r.criticalDrawing || "—"}</td>
                    <td className="py-2 pr-2 max-w-[10rem] truncate text-xs">{r.remarks || "—"}</td>
                    <td className="py-2">
                      {r.drawing?.id ? (
                        <Badge tone="ok">Linked</Badge>
                      ) : (
                        <Link to={`/projects/${id}/drawings?upload=1`} className="text-xs font-semibold text-brand">
                          Upload GFC
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
                {!filteredLines.length && (
                  <tr>
                    <td colSpan={22} className="py-8 text-steel-muted text-center">
                      {lines.length ? "No lines match filters." : "No lines — run seed or add above."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {sheetKey === "site" && (
        <Card padding={false} className="overflow-hidden">
          <div className="px-4 py-3 border-b border-line">
            <h3 className="font-semibold">Site Drawing Register</h3>
            <p className="text-xs text-steel-muted mt-1">
              Receive &amp; issue matrix R0–R6 — dates, copies, contractor/client signatures per revision (from GFC uploads).
            </p>
          </div>
          <SiteDrawingRegisterTable drawings={gfcDrawings} projectId={id!} />
        </Card>
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
