import { FormEvent, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { PieChart } from "../../components/PieChart";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../../components/ui";
import { drawingRegisterSheetFromParams } from "../../lib/drawingRegisterViews";

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function DrawingRegisterPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const sheetView = drawingRegisterSheetFromParams(searchParams);
  const sheetKey = sheetView.key;
  const { token, user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    drawingNumber: "",
    drawingTitle: "",
    discipline: "Architecture",
    projectPackage: "Package A",
    building: "Tower 1",
    drawingType: "Good For Construction (GFC)",
    consultantName: "",
    revisionNumber: "R0",
    criticalDrawing: "No",
    remarks: "",
  });
  const canEdit = ["admin", "office", "employee", "site_employee"].includes(user?.role || "");

  const load = async () => {
    const res = await api(`/api/drawings/project/${id}/register-dashboard`, { token });
    setData(res);
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  async function addLine(e: FormEvent) {
    e.preventDefault();
    try {
      await api(`/api/drawings/project/${id}/register-lines`, {
        method: "POST",
        token,
        body: JSON.stringify(form),
      });
      setMsg(`Register line ${form.drawingNumber} saved`);
      setForm({ ...form, drawingNumber: "", drawingTitle: "", remarks: "" });
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  const lines = data?.lines || [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Drawings module"
        title={sheetView.label}
        subtitle={`${sheetView.sheet} — DCI master register from client workbook. Link to GFC upload for file issue.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge tone="brand">{data?.totals?.lines ?? 0} lines</Badge>
            <Badge tone="ok">{data?.totals?.gfc ?? 0} GFC</Badge>
            <Link to={`/projects/${id}/drawings`} className="text-sm font-semibold text-brand">
              GFC register →
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

      {(sheetKey === "master" || sheetKey === "client") && canEdit && (
        <Card>
          <h3 className="font-semibold mb-3">Add master register line</h3>
          <form className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" onSubmit={addLine}>
            <Input placeholder="Drawing number" value={form.drawingNumber} onChange={(e) => setForm({ ...form, drawingNumber: e.target.value })} required />
            <Input className="lg:col-span-2" placeholder="Drawing title" value={form.drawingTitle} onChange={(e) => setForm({ ...form, drawingTitle: e.target.value })} required />
            <Select value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })}>
              {["Architecture", "Structural", "MEPF", "Facade", "Interior"].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
            <Input placeholder="Package" value={form.projectPackage} onChange={(e) => setForm({ ...form, projectPackage: e.target.value })} />
            <Input placeholder="Building" value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} />
            <Input placeholder="Drawing type" value={form.drawingType} onChange={(e) => setForm({ ...form, drawingType: e.target.value })} />
            <Input placeholder="Consultant" value={form.consultantName} onChange={(e) => setForm({ ...form, consultantName: e.target.value })} />
            <Input placeholder="Revision" value={form.revisionNumber} onChange={(e) => setForm({ ...form, revisionNumber: e.target.value })} />
            <Select value={form.criticalDrawing} onChange={(e) => setForm({ ...form, criticalDrawing: e.target.value })}>
              <option>No</option>
              <option>Yes</option>
            </Select>
            <TextArea className="lg:col-span-3" rows={2} placeholder="Remarks" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
            <Button type="submit">Save line</Button>
          </form>
        </Card>
      )}

      {(sheetKey === "master" || sheetKey === "client") && (
        <Card>
          <h3 className="font-semibold mb-3">
            {sheetKey === "master" ? "Master Drawing Register" : "Client drawing register view"}
          </h3>
          <div className="overflow-x-auto max-h-[32rem]">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase text-steel-muted font-mono border-b border-line">
                  <th className="py-2 pr-2">Sr</th>
                  <th className="py-2 pr-2">No.</th>
                  <th className="py-2 pr-2">Title</th>
                  {sheetKey === "master" && (
                    <>
                      <th className="py-2 pr-2">Discipline</th>
                      <th className="py-2 pr-2">Type</th>
                      <th className="py-2 pr-2">Rev</th>
                      <th className="py-2 pr-2">Planned</th>
                      <th className="py-2 pr-2">Delay</th>
                      <th className="py-2 pr-2">Critical</th>
                      <th className="py-2 pr-2">Remarks</th>
                    </>
                  )}
                  {sheetKey === "client" && (
                    <>
                      <th className="py-2 pr-2">Discipline</th>
                      <th className="py-2 pr-2">Issued to</th>
                    </>
                  )}
                  <th className="py-2">GFC link</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((r: any) => (
                  <tr key={r.id} className="border-b border-line/60">
                    <td className="py-2 pr-2 font-mono text-xs">{r.srNo ?? "—"}</td>
                    <td className="py-2 pr-2 font-mono text-xs">{String(r.drawingNumber || "").replace(/\s·\s*\d+$/, "")}</td>
                    <td className="py-2 pr-2 max-w-xs truncate">{r.drawingTitle}</td>
                    {sheetKey === "master" && (
                      <>
                        <td className="py-2 pr-2">{r.discipline || "—"}</td>
                        <td className="py-2 pr-2 max-w-[8rem] truncate">{r.drawingType || "—"}</td>
                        <td className="py-2 pr-2">{r.revisionNumber || "—"}</td>
                        <td className="py-2 pr-2 text-xs">
                          {r.plannedSubmissionDate
                            ? new Date(r.plannedSubmissionDate).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="py-2 pr-2 font-mono text-xs">
                          {r.submissionDelayDays != null ? r.submissionDelayDays : "—"}
                        </td>
                        <td className="py-2 pr-2">{r.criticalDrawing || "—"}</td>
                        <td className="py-2 pr-2 max-w-[10rem] truncate">{r.remarks || "—"}</td>
                      </>
                    )}
                    {sheetKey === "client" && (
                      <>
                        <td className="py-2 pr-2">{r.discipline || "—"}</td>
                        <td className="py-2 pr-2">{r.issuedTo || "—"}</td>
                      </>
                    )}
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
                {!lines.length && (
                  <tr>
                    <td colSpan={sheetKey === "master" ? 11 : 8} className="py-8 text-steel-muted text-center">
                      No lines — run seed or add above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
