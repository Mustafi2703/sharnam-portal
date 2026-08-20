import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../../components/ui";
import {
  CHECKLIST_CSV_DETAILED_SAMPLE,
  CHECKLIST_CSV_HEADERS,
  downloadCsv,
} from "../../lib/csvTemplates";
import { projectRouteTail } from "../../lib/projectWorkspace";

const FAMILIES = [
  { value: "DrawingCheck", label: "Drawing check (pre-upload)" },
  { value: "SiteExecution", label: "Site / field" },
  { value: "QualityInspection", label: "Quality" },
  { value: "Safety", label: "Safety" },
  { value: "ActivityInspection", label: "Activity inspection" },
] as const;

const MODULE_MASTER_ROUTES: Record<string, string> = {
  DrawingCheck: "drawings/checklist-master",
  QualityInspection: "quality/checklist-master",
  Safety: "safety/checklist-master",
  ActivityInspection: "inspection/checklist-master",
  SiteExecution: "field/checklist-master",
};

function familyLockFromPath(pathname: string): Family | undefined {
  const tail = projectRouteTail(pathname);
  if (tail === "drawings/checklist-master") return "DrawingCheck";
  if (tail === "quality/checklist-master") return "QualityInspection";
  if (tail === "safety/checklist-master") return "Safety";
  if (tail === "inspection/checklist-master") return "ActivityInspection";
  if (tail === "field/checklist-master") return "SiteExecution";
  return undefined;
}

type Family = (typeof FAMILIES)[number]["value"];

/** Create / edit checklist types, line items, QA instructions — per module family */
export default function ChecklistMasterPage({ lockedFamily }: { lockedFamily?: Family } = {}) {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const pathLock = familyLockFromPath(location.pathname);
  const effectiveLock = lockedFamily || pathLock;
  const family = effectiveLock || ((searchParams.get("family") as Family) || "QualityInspection");
  const showFamilyPicker = !effectiveLock && projectRouteTail(location.pathname) === "checklist-master";
  const { token, user } = useAuth();
  const [templates, setTemplates] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    name: "",
    category: "General",
    checklistType: family,
    instructions: "",
    requirePhotosMin: family === "QualityInspection" || family === "Safety" ? 3 : 0,
  });
  const [itemForm, setItemForm] = useState({ description: "", instruction: "", section: "General", requirePhoto: false });
  const canEdit =
    user?.role === "admin" ||
    user?.role === "office" ||
    user?.role === "employee" ||
    ((family === "QualityInspection" || family === "Safety") && user?.role === "client");
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelBusy, setExcelBusy] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [catalog, setCatalog] = useState<{ srNo: number; name: string; category: string }[]>([]);

  const load = async () => {
    const list = await api<any[]>(`/api/checklist/templates?type=${family}`, { token });
    setTemplates(list);
    if (activeId && !list.some((t) => t.id === activeId)) setActiveId(list[0]?.id || null);
    else if (!activeId && list[0]) setActiveId(list[0].id);
  };

  useEffect(() => {
    if (!id || projectRouteTail(location.pathname) !== "checklist-master") return;
    const f = searchParams.get("family");
    if (f && MODULE_MASTER_ROUTES[f]) {
      navigate(`/projects/${id}/${MODULE_MASTER_ROUTES[f]}`, { replace: true });
    }
  }, [id, location.pathname, searchParams, navigate]);

  useEffect(() => {
    setForm((f) => ({
      ...f,
      checklistType: family,
      requirePhotosMin: family === "QualityInspection" || family === "Safety" ? 3 : 0,
    }));
    setActiveId(null);
    void load();
  }, [family, token]);

  useEffect(() => {
    if (!activeId) {
      setDetail(null);
      return;
    }
    api(`/api/checklist/templates/${activeId}`, { token }).then(setDetail).catch(console.error);
  }, [activeId, token]);

  useEffect(() => {
    if (family !== "QualityInspection" || !id) {
      setCatalog([]);
      return;
    }
    api<any>(`/api/checklist/project/${id}/quality-dashboard`, { token })
      .then((d) => setCatalog(d?.workbook?.checklistCatalog || []))
      .catch(() => setCatalog([]));
  }, [family, id, token]);

  async function createTemplate(e: FormEvent) {
    e.preventDefault();
    if (createBusy || !form.name.trim()) return;
    setCreateBusy(true);
    setMsg("");
    try {
      const t = await api<any>("/api/checklist/templates", {
        method: "POST",
        token,
        body: JSON.stringify({ ...form, checklistType: family }),
      });
      setMsg(`Created ${t.name}`);
      setForm({ name: "", category: "General", checklistType: family, instructions: "", requirePhotosMin: form.requirePhotosMin });
      setActiveId(t.id);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setCreateBusy(false);
    }
  }

  async function saveMeta(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    const updated = await api<any>(`/api/checklist/templates/${detail.id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({
        name: detail.name,
        category: detail.category,
        instructions: detail.instructions,
        requirePhotosMin: detail.requirePhotosMin,
      }),
    });
    setDetail(updated);
    setMsg("Checklist updated");
    await load();
  }

  async function addItem(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    await api(`/api/checklist/templates/${detail.id}/items`, {
      method: "POST",
      token,
      body: JSON.stringify(itemForm),
    });
    setItemForm({ description: "", instruction: "", section: "General", requirePhoto: false });
    const fresh = await api(`/api/checklist/templates/${detail.id}`, { token });
    setDetail(fresh);
    setMsg("Line item added");
  }

  return (
    <div className="space-y-6 min-w-0 portal-fill-layout">
      <PageHeader
        eyebrow={
          effectiveLock === "DrawingCheck"
            ? "Drawings · checklist master"
            : effectiveLock === "Safety"
            ? id
              ? "Safety · checklist master"
              : "Global · Safety checklists"
            : effectiveLock === "QualityInspection"
              ? id
                ? "Quality · checklist master"
                : "Global · Quality checklists"
              : id
                ? "Project checklist master"
                : "Global master · all projects"
        }
        title={
          effectiveLock === "DrawingCheck"
            ? "Drawing checklist master"
            : effectiveLock === "Safety"
            ? "Safety checklist master"
            : effectiveLock === "QualityInspection"
              ? "Quality checklist master"
              : "Create, upload & choose checklists"
        }
        subtitle={
          effectiveLock === "DrawingCheck"
            ? "Pre-upload drawing review checklists only — complete before GFC upload. Quality and Safety templates live in their own modules."
            : effectiveLock === "Safety"
            ? "Safety-only templates — separate from Quality QI checklists. Upload Excel, assign to project, raise Safety checklist RFIs."
            : effectiveLock === "QualityInspection"
              ? "Quality inspection (QI) templates only — separate from Safety. Client can create/upload QI checklists."
              : id
                ? "Templates are org-wide — assign to this project after editing. Pick Quality or Safety family below."
                : "Org-wide checklist line items — reused package- and discipline-wise on every project. Assign from each project's checklist master."
        }
        actions={
          !id ? (
            <Link to="/master" className="text-sm font-semibold text-brand">
              ← Master setup
            </Link>
          ) : undefined
        }
      />

      {!showFamilyPicker && effectiveLock && (
        <div className="flex flex-wrap gap-2">
          {FAMILIES.filter((f) => f.value === effectiveLock).map((f) => (
            <span
              key={f.value}
              className="px-3 py-1.5 text-sm font-semibold border rounded-sm text-white border-transparent"
              style={{ background: "var(--mod-accent, var(--color-brand))" }}
            >
              {f.label}
            </span>
          ))}
        </div>
      )}

      {showFamilyPicker && (
        <div className="flex flex-wrap gap-2">
          {FAMILIES.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setSearchParams({ family: f.value })}
              className={`px-3 py-1.5 text-sm font-semibold border rounded-sm ${
                family === f.value ? "text-white border-transparent" : "bg-white border-line"
              }`}
              style={family === f.value ? { background: "var(--mod-accent, var(--color-brand))" } : undefined}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {family === "QualityInspection" && catalog.length > 0 && (
        <Card className="!p-4 border-brand/20 bg-brand-soft/30">
          <p className="text-sm">
            <span className="font-semibold text-ink">{catalog.length}</span> checklist types from{" "}
            <span className="font-semibold">Quality Dashboard · Sheet1</span> —{" "}
            <span className="font-semibold text-ink">{templates.length}</span> templates in master. This page is the
            type library (line items & min. photos). Fill history lives in the{" "}
            <Link to={`/projects/${id}/quality/checklist-logs`} className="text-brand font-semibold">
              QI fill log
            </Link>
            .
          </p>
          <div className="flex flex-wrap gap-3 mt-2">
            <Link to={`/projects/${id}/inspections?sheet=checklist-summary`} className="text-sm font-semibold text-brand">
              Catalog + fill graphs →
            </Link>
            {id && canEdit && (
              <button
                type="button"
                className="text-sm font-semibold text-brand underline"
                onClick={async () => {
                  setMsg("");
                  try {
                    const out = await api<{ catalog: number; created: number }>(
                      `/api/checklist/project/${id}/quality-catalog/sync`,
                      { method: "POST", token }
                    );
                    setMsg(`Onboarded ${out.catalog} Sheet1 types (${out.created} new).`);
                    await load();
                  } catch (err) {
                    setMsg(err instanceof Error ? err.message : "Onboard failed");
                  }
                }}
              >
                Onboard all Sheet1 types
              </button>
            )}
          </div>
        </Card>
      )}

      {effectiveLock && id && (
        <p className="text-sm text-steel-muted">
          {effectiveLock === "DrawingCheck" ? (
            <>
              Quality checklists:{" "}
              <Link to={`/projects/${id}/quality/checklist-master`} className="text-brand font-semibold">
                Quality checklist master →
              </Link>
              {" · "}
              Safety checklists:{" "}
              <Link to={`/projects/${id}/safety/checklist-master`} className="text-brand font-semibold">
                Safety checklist master →
              </Link>
            </>
          ) : effectiveLock === "Safety" ? (
            <>
              Quality checklists live under{" "}
              <Link to={`/projects/${id}/quality/checklist-master`} className="text-brand font-semibold">
                Quality checklist master →
              </Link>
            </>
          ) : (
            <>
              Safety checklists live under{" "}
              <Link to={`/projects/${id}/safety/checklist-master`} className="text-brand font-semibold">
                Safety checklist master →
              </Link>
            </>
          )}
        </p>
      )}

      {msg && <p className="text-sm text-steel-muted">{msg}</p>}

      {canEdit && (
        <Card className="space-y-3">
          <h3 className="font-display text-base">CSV / Excel templates</h3>
          <p className="text-sm text-steel-muted">
            Download an empty or detailed CSV, fill rows, then upload. Columns:{" "}
            <span className="font-mono text-xs">description, instruction, section, requirePhoto</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                downloadCsv(`checklist-${family}-empty.csv`, [...CHECKLIST_CSV_HEADERS], [])
              }
            >
              Empty CSV template
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                downloadCsv(
                  `checklist-${family}-detailed.csv`,
                  [...CHECKLIST_CSV_HEADERS],
                  CHECKLIST_CSV_DETAILED_SAMPLE
                )
              }
            >
              Detailed sample CSV
            </Button>
            {detail?.items?.length > 0 && (
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  downloadCsv(
                    `${detail.name || "checklist"}-export.csv`,
                    [...CHECKLIST_CSV_HEADERS],
                    (detail.items as any[]).map((i) => [
                      i.description || "",
                      i.instruction || "",
                      i.section || "General",
                      i.requirePhoto ? "true" : "false",
                    ])
                  )
                }
              >
                Export current as CSV
              </Button>
            )}
          </div>
          <form
            className="flex flex-wrap items-end gap-3 border-t border-line pt-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!excelFile) return;
              setExcelBusy(true);
              setMsg("");
              try {
                const fd = new FormData();
                fd.append("file", excelFile);
                fd.append("checklistType", family);
                fd.append("name", excelFile.name.replace(/\.(xlsx|xls|csv)$/i, ""));
                fd.append("category", "CSV/Excel import");
                const t = await api<any>("/api/checklist/templates/import-excel", {
                  method: "POST",
                  token,
                  body: fd,
                });
                setMsg(`Imported ${t.name} · ${t._count?.items ?? t.items?.length ?? 0} lines — select it to edit or assign.`);
                setExcelFile(null);
                setActiveId(t.id);
                await load();
              } catch (err) {
                setMsg(err instanceof Error ? err.message : "Import failed");
              } finally {
                setExcelBusy(false);
              }
            }}
          >
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
              className="text-sm"
            />
            <Button type="submit" disabled={!excelFile || excelBusy}>
              {excelBusy ? "Importing…" : "Upload CSV / Excel"}
            </Button>
          </form>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="space-y-3">
          <h3 className="font-display text-base">Templates · {family}</h3>
          <ul className="max-h-64 overflow-y-auto divide-y divide-line text-sm">
            {templates.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={`w-full text-left py-2 px-1 ${activeId === t.id ? "text-brand font-semibold" : ""}`}
                  onClick={() => setActiveId(t.id)}
                >
                  {t.name}{" "}
                  <span className="text-xs text-steel-muted">
                    · {t._count?.items ?? "?"} lines · photos≥{t.requirePhotosMin ?? 0}
                  </span>
                </button>
              </li>
            ))}
            {!templates.length && <li className="py-4 text-steel-muted">No templates yet — create one.</li>}
          </ul>

          {canEdit && (
            <form className="space-y-2 border-t border-line pt-3" onSubmit={createTemplate}>
              <Input placeholder="Checklist name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <Input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <TextArea
                placeholder="QA / fill instructions for the whole checklist"
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                rows={2}
              />
              <label className="text-xs text-steel-muted flex items-center gap-2">
                Min photos
                <Input
                  type="number"
                  className="!w-20"
                  value={form.requirePhotosMin}
                  onChange={(e) => setForm({ ...form, requirePhotosMin: Number(e.target.value) || 0 })}
                />
              </label>
              <Button type="submit" disabled={createBusy || !form.name.trim()}>
                {createBusy ? "Creating…" : "Create checklist"}
              </Button>
            </form>
          )}
        </Card>

        <Card className="space-y-3">
          {!detail ? (
            <p className="text-sm text-steel-muted">Select a checklist to edit line items.</p>
          ) : (
            <>
              <form className="space-y-2" onSubmit={saveMeta}>
                <Input value={detail.name} onChange={(e) => setDetail({ ...detail, name: e.target.value })} disabled={!canEdit} />
                <Input value={detail.category} onChange={(e) => setDetail({ ...detail, category: e.target.value })} disabled={!canEdit} />
                <TextArea
                  value={detail.instructions || ""}
                  onChange={(e) => setDetail({ ...detail, instructions: e.target.value })}
                  placeholder="Instructions"
                  rows={2}
                  disabled={!canEdit}
                />
                {canEdit && <Button type="submit" variant="secondary">Save header</Button>}
              </form>

              <div className="border-t border-line pt-3">
                <h4 className="text-sm font-semibold mb-2">Line items</h4>
                <ul className="space-y-2 max-h-56 overflow-y-auto text-sm">
                  {(detail.items || []).map((i: any) => (
                    <li key={i.id} className="border border-line p-2 rounded-sm">
                      <div className="font-medium">
                        {i.itemCode}. {i.description}
                      </div>
                      {i.instruction && <div className="text-xs text-steel-muted mt-1">QI: {i.instruction}</div>}
                      {i.requirePhoto && <Badge tone="warn">photo required</Badge>}
                    </li>
                  ))}
                </ul>
              </div>

              {canEdit && (
                <form className="space-y-2 border-t border-line pt-3" onSubmit={addItem}>
                  <Input
                    placeholder="Line description"
                    value={itemForm.description}
                    onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                    required
                  />
                  <TextArea
                    placeholder="Quality / safety instruction for this line"
                    value={itemForm.instruction}
                    onChange={(e) => setItemForm({ ...itemForm, instruction: e.target.value })}
                    rows={2}
                  />
                  <label className="text-xs flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={itemForm.requirePhoto}
                      onChange={(e) => setItemForm({ ...itemForm, requirePhoto: e.target.checked })}
                    />
                    Require photo on this line
                  </label>
                  <Button type="submit">Add line item</Button>
                </form>
              )}

              {id && canEdit && (
                <div className="flex flex-wrap gap-3 items-center border-t border-line pt-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={async () => {
                      try {
                        await api(`/api/checklist/project/${id}/assign`, {
                          method: "POST",
                          token,
                          body: JSON.stringify({ templateId: detail.id }),
                        });
                        setMsg("Assigned to this project — raise fill RFI or open assign page.");
                      } catch (err) {
                        setMsg(err instanceof Error ? err.message : "Assign failed");
                      }
                    }}
                  >
                    Assign to this project
                  </Button>
                  <Link to={`/projects/${id}/checklist/assign`} className="text-sm font-semibold text-brand">
                    Assign catalog →
                  </Link>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
