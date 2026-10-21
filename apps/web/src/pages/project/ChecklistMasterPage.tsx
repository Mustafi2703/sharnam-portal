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
import { openFamilyChecklistFill } from "../../lib/checklistFillWindow";
import { projectRouteTail } from "../../lib/projectWorkspace";
import { FilePickButton } from "../../components/FilePickButton";
import { StatusNote } from "../../components/StatusNote";
import { QualitySiteRegister } from "../../components/QualitySiteRegister";
import { SafetySiteRegister } from "../../components/SafetySiteRegister";
import { useDrawingPicklists, withCurrent } from "../../lib/drawingPicklists";
import { formatUiText } from "../../lib/formatUiText";

function lineHasInstruction(i: { instruction?: string | null; instructionFileUrl?: string | null }) {
  return Boolean(String(i.instruction || "").trim() || i.instructionFileUrl);
}

function DrawingCheckDisciplineWarnings({
  disciplines,
  templates,
  onOpen,
}: {
  disciplines: string[];
  templates: { id: string; name: string; discipline?: string | null; isActive?: boolean }[];
  onOpen: (id: string) => void;
}) {
  const active = templates.filter((t) => t.isActive !== false);
  const missing = disciplines.filter((d) => !active.some((t) => (t.discipline || "").toLowerCase() === d.toLowerCase()));
  const stray = active.filter((t) => t.discipline && !disciplines.some((d) => d.toLowerCase() === String(t.discipline).toLowerCase()));
  if (!missing.length && !stray.length) return null;
  return (
    <Card className="!p-3 space-y-1 text-sm">
      {missing.map((d) => (
        <p key={d}>No checklist for {d} - uploads in {d} will be blocked.</p>
      ))}
      {stray.map((t) => (
        <p key={t.id}>
          {t.name} is set to {t.discipline}, which is not in this project's discipline list.{" "}
          <button type="button" className="text-brand font-semibold" onClick={() => onOpen(t.id)}>
            {formatUiText("Edit template discipline")}
          </button>
        </p>
      ))}
    </Card>
  );
}

const FAMILIES = [
  { value: "DrawingCheck", label: "Drawing check · RFI (SPDC RFI form)" },
  { value: "QualityInspection", label: "Quality IR (SPDC F-01)" },
  { value: "SiteExecution", label: "Site execution (SPDC Activity F-02)" },
  { value: "Safety", label: "Safety (SPDC Safety IR)" },
  { value: "ActivityInspection", label: "Activity inspection" },
] as const;

const MODULE_MASTER_ROUTES: Record<string, string> = {
  DrawingCheck: "drawings/checklist-master",
  QualityInspection: "quality/checklist-master",
  Safety: "safety/checklist-master",
  ActivityInspection: "inspection/checklist-master",
  SiteExecution: "quality/site-checklist-master",
};

function familyLockFromPath(pathname: string): Family | undefined {
  const tail = projectRouteTail(pathname);
  if (tail === "drawings/checklist-master") return "DrawingCheck";
  if (tail === "quality/checklist-master") return "QualityInspection";
  if (tail === "quality/site-checklist-master") return "SiteExecution";
  if (tail === "safety/checklist-master") return "Safety";
  if (tail === "inspection/checklist-master") return "ActivityInspection";
  if (tail === "progress/checklist-master") return "SiteExecution";
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
  const [excelMode, setExcelMode] = useState<"create" | "merge">("create");
  const [onlyMissingInstruction, setOnlyMissingInstruction] = useState(false);
  const picklists = useDrawingPicklists(id, token);
  const [createBusy, setCreateBusy] = useState(false);
  const [catalog, setCatalog] = useState<{ srNo: number; name: string; category: string }[]>([]);
  const [masterTab, setMasterTab] = useState<"templates" | "site-observation" | "site-instruction">("templates");
  const showRegisterTabs = Boolean(id && (family === "QualityInspection" || family === "Safety"));
  const canManageRegisters =
    user?.role === "admin" || user?.role === "office" || user?.role === "employee" || user?.role === "site_employee";

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
    setForm({
      name: "",
      category: "General",
      checklistType: family,
      instructions: "",
      requirePhotosMin: family === "QualityInspection" || family === "Safety" ? 3 : 0,
    });
    setActiveId(null);
    setDetail(null);
    setMsg("");
    setMasterTab("templates");
    setItemForm({ description: "", instruction: "", section: "General", requirePhoto: false });
    setExcelFile(null);
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
        requireInstructions: !!detail.requireInstructions,
        ...(family === "DrawingCheck" ? { discipline: detail.discipline || null } : {}),
      }),
    });
    setDetail(updated);
    setMsg("Checklist updated");
    await load();
  }

  async function addItem(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    if (detail.requireInstructions && !itemForm.instruction.trim()) {
      setMsg("This checklist requires an instruction on every line. Add one before saving.");
      return;
    }
    try {
      await api(`/api/checklist/templates/${detail.id}/items`, {
        method: "POST",
        token,
        body: JSON.stringify(itemForm),
      });
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not add line");
      return;
    }
    setItemForm({ description: "", instruction: "", section: "General", requirePhoto: false });
    const fresh = await api(`/api/checklist/templates/${detail.id}`, { token });
    setDetail(fresh);
    setMsg("Line item added");
    await load();
  }

  const detailItems: any[] = detail?.items || [];
  const instructedCount = detailItems.filter(lineHasInstruction).length;
  const missingInstructionCount = detailItems.length - instructedCount;
  const assignBlocked = !!detail?.requireInstructions && missingInstructionCount > 0;
  const disciplineOptions = withCurrent(picklists.lists.disciplines, detail?.discipline);

  const pageShell = id
    ? "quality-module page-scroll-full flex flex-col gap-6 pb-8 min-w-0 w-full"
    : "master-module page-scroll-full space-y-6 min-w-0 pb-8 w-full";

  return (
    <div className={pageShell}>
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
                : effectiveLock === "SiteExecution" || effectiveLock === "ActivityInspection"
                  ? "Quality · site checklist master"
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
                : effectiveLock === "SiteExecution" || effectiveLock === "ActivityInspection"
                  ? "Site checklist master"
                  : "Create, upload & choose checklists"
        }
        subtitle={
          effectiveLock === "DrawingCheck"
            ? "Yes/No/N.A. items only — no photos or links. Edit lines here; fills unlock GFC upload. Quality and Safety templates live in their own modules."
            : effectiveLock === "Safety"
              ? "Safety checklist types (HIRA, HSE pack, custom). Create a new type here; demo pack load is on Admin → UAT Data. Fill from the Safety IR register — the fill log is information only."
              : effectiveLock === "QualityInspection"
                ? "Quality checklist types (Civil, HVAC, Electrical, ELV, Fire, interiors…). Create a new type here; demo pack load is on Admin → UAT Data. Fill from the Quality IR register."
                : effectiveLock === "SiteExecution" || effectiveLock === "ActivityInspection"
                  ? "Site / field checklist types (SPDC Activity format). Create or edit here; fill from the Quality register — not mixed with Safety masters."
                  : id
                    ? "Templates are org-wide — assign to this project after editing. Pick Quality or Safety family below."
                    : "Org-wide checklist line items — reused package- and discipline-wise on every project. Assign from each project's checklist master."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {id && (family === "QualityInspection" || family === "Safety" || family === "SiteExecution") && (
              <Link
                to={
                  family === "Safety"
                    ? `/projects/${id}/inspection-register?tab=safety-ir&lock=safety`
                    : `/projects/${id}/inspection-register?tab=quality-ir&lock=quality`
                }
              >
                <Button type="button" className="!bg-amber-400 !text-ink !font-medium">
                  Open register to fill →
                </Button>
              </Link>
            )}
            {id && family === "DrawingCheck" && (
              <Button
                type="button"
                className="!bg-amber-400 !text-ink !font-medium"
                onClick={() => void openFamilyChecklistFill(id, family, token, { templateId: activeId })}
              >
                Fill drawing check
              </Button>
            )}

            {!id ? (
              <Link to="/crm" className="text-sm font-semibold text-brand">
                ← Directory
              </Link>
            ) : (
              <Link to={`/projects/${id}`} className="text-sm font-semibold text-brand">
                ← Project home
              </Link>
            )}
          </div>
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
              className={`rounded-full px-4 py-2 text-sm font-semibold border transition ${
                family === f.value
                  ? "bg-brand text-white border-brand"
                  : "bg-paper border-line text-steel-muted hover:border-brand"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {showRegisterTabs && (
        <div className="flex flex-wrap gap-2 border-b border-line pb-2">
          {(
            [
              { key: "templates" as const, label: "Checklist templates" },
              {
                key: "site-observation" as const,
                label: family === "Safety" ? "Observations" : "Site observations",
              },
              { key: "site-instruction" as const, label: "Site instructions" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setMasterTab(t.key)}
              className={`px-3 py-1.5 text-sm font-semibold rounded-md border transition ${
                masterTab === t.key
                  ? "bg-brand text-white border-brand"
                  : "bg-paper border-line text-steel-muted hover:border-brand"
              }`}
            >
              {t.label}
            </button>
          ))}
          <Link
            to={
              family === "Safety"
                ? `/projects/${id}/safety?sheet=site-instruction`
                : `/projects/${id}/inspections?sheet=site-observation`
            }
            className="ml-auto text-xs font-semibold text-brand self-center underline"
          >
            Open full register →
          </Link>
        </div>
      )}

      {showRegisterTabs && masterTab === "site-observation" && id && (
        <div className="min-h-[28rem]">
          {family === "Safety" ? (
            <SafetySiteRegister projectId={id} token={token} recordType="Observation" canEdit={!!canManageRegisters} />
          ) : (
            <QualitySiteRegister
              projectId={id}
              token={token}
              recordType="Site Observation"
              canEdit={!!canManageRegisters}
              source="ChecklistMaster"
            />
          )}
        </div>
      )}

      {showRegisterTabs && masterTab === "site-instruction" && id && (
        <div className="min-h-[28rem]">
          {family === "Safety" ? (
            <SafetySiteRegister
              projectId={id}
              token={token}
              recordType="Site Instruction"
              canEdit={!!canManageRegisters}
            />
          ) : (
            <QualitySiteRegister
              projectId={id}
              token={token}
              recordType="Site Instruction"
              canEdit={!!canManageRegisters}
              source="ChecklistMaster"
            />
          )}
        </div>
      )}

      {(!showRegisterTabs || masterTab === "templates") && (
        <>


      {effectiveLock === "DrawingCheck" && id && canEdit && (
        <Card className="!p-4 border-brand/20 bg-brand-soft/30">
          <p className="text-sm">
            Line items come from the drawing-check master workbook. Edit or add lines here. Demo reload of the reference XLS is on Admin → UAT Data.
          </p>
          <div className="flex flex-wrap gap-3 mt-2">
            <Link to={`/projects/${id}/rfis?kind=DrawingChecklist&compose=1`} className="rounded-full bg-violet-100 px-4 py-2 text-sm font-medium text-violet-900 hover:bg-violet-200">
              Request checklist fill
            </Link>
          </div>
        </Card>
      )}

      {(family === "QualityInspection" || family === "Safety" || family === "SiteExecution") && id && canEdit && (
        <Card className="!p-4 border-brand/20 bg-brand-soft/30 space-y-2">
          <p className="text-sm">
            <span className="font-semibold text-ink">{templates.length}</span> checklist type
            {templates.length === 1 ? "" : "s"} in this master. Create a new type below, or load demo packs from Admin → UAT Data. Fills happen on the{" "}
            <Link
              to={
                family === "Safety"
                  ? `/projects/${id}/inspection-register?tab=safety-ir&lock=safety`
                  : `/projects/${id}/inspection-register?tab=quality-ir&lock=quality`
              }
              className="text-brand font-semibold"
            >
              register
            </Link>
            ; the{" "}
            <Link
              to={
                family === "Safety"
                  ? `/projects/${id}/safety/checklist-logs`
                  : family === "SiteExecution"
                    ? `/projects/${id}/quality/site-checklist-logs`
                    : `/projects/${id}/quality/checklist-logs`
              }
              className="text-brand font-semibold"
            >
              fill log
            </Link>{" "}
            is information only.
          </p>
          {catalog.length > 0 && family === "QualityInspection" && (
            <Link to={`/projects/${id}/inspections?sheet=checklist-summary`} className="text-sm font-semibold text-brand">
              Catalog graphs ({catalog.length}) →
            </Link>
          )}
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

      <StatusNote msg={msg} />

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
              className="!bg-sky-600 !font-medium"
              onClick={() =>
                downloadCsv(`checklist-${family}-empty.csv`, [...CHECKLIST_CSV_HEADERS], [])
              }
            >
              Empty CSV template
            </Button>
            <Button
              type="button"
              className="!bg-indigo-600 !font-medium"
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
                className="!bg-emerald-600 !font-medium"
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
              if (excelMode === "merge") {
                if (!detail) {
                  setMsg("Select a template to update first.");
                  setExcelBusy(false);
                  return;
                }
                try {
                  const fd = new FormData();
                  fd.append("file", excelFile);
                  const out = await api<{ template: any; updated: number; created: number; unchanged: number; skipped: string[] }>(
                    `/api/checklist/templates/${detail.id}/import-excel`,
                    { method: "POST", token, body: fd }
                  );
                  setDetail(out.template);
                  setMsg(
                    `${detail.name}: ${out.updated} line(s) updated, ${out.created} added, ${out.unchanged} unchanged` +
                      (out.skipped.length ? `, ${out.skipped.length} skipped (no instruction).` : ".")
                  );
                  setExcelFile(null);
                  await load();
                } catch (err) {
                  setMsg(err instanceof Error ? err.message : "Import failed");
                } finally {
                  setExcelBusy(false);
                }
                return;
              }
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
            <Select
              label="Upload into"
              fieldClassName="min-w-[16rem]"
              value={excelMode}
              onChange={(e) => setExcelMode(e.target.value as "create" | "merge")}
            >
              <option value="create">{formatUiText("A new template")}</option>
              <option value="merge" disabled={!detail}>
                {detail ? `${formatUiText("Selected template")}: ${detail.name}` : formatUiText("Selected template (pick one first)")}
              </option>
            </Select>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
              className="text-sm"
            />
            <Button type="submit" disabled={!excelFile || excelBusy || (excelMode === "merge" && !detail)}>
              {excelBusy ? "Importing…" : "Upload CSV / Excel"}
            </Button>
            {excelMode === "merge" ? (
              <p className="basis-full text-[11px] text-steel-muted">
                Rows match existing lines by description. Filled instruction, section and photo cells update the line; new descriptions are added as new lines.
              </p>
            ) : null}
          </form>
        </Card>
      )}

      {id && family === "DrawingCheck" && picklists.loaded ? (
        <DrawingCheckDisciplineWarnings
          disciplines={picklists.lists.disciplines}
          templates={templates}
          onOpen={(templateId) => setActiveId(templateId)}
        />
      ) : null}

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
                  {family === "DrawingCheck" ? (
                    <Badge tone={t.discipline ? "brand" : "warn"} className="ml-1">
                      {t.discipline || "No discipline"}
                    </Badge>
                  ) : null}{" "}
                  <span className="text-xs text-steel-muted">
                    · {t._count?.items ?? "?"} lines
                    {` · ${formatUiText("Instructions")}: ${t.instructionCount ?? 0} / ${t._count?.items ?? 0}`}
                    {family === "DrawingCheck" ? "" : ` · photos≥${t.requirePhotosMin ?? 0}`}
                  </span>
                </button>
              </li>
            ))}
            {!templates.length && <li className="py-4 text-steel-muted">No templates yet — create one.</li>}
          </ul>

          {canEdit && (
            <form className="space-y-2 border-t border-line pt-3" onSubmit={createTemplate}>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-brand">Create new checklist type</h4>
              <p className="text-[11px] text-steel-muted">
                Add a custom type when the pack does not cover it — then add line items or upload Excel.
              </p>
              <Input placeholder="Checklist name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <Input placeholder="Category (e.g. Civil, HVAC, HSE)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <TextArea
                placeholder="QA / fill instructions for the whole checklist"
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                rows={2}
              />
              {family !== "DrawingCheck" && (
              <label className="text-xs text-steel-muted flex items-center gap-2">
                Min photos
                <Input
                  type="number"
                  className="!w-20"
                  value={form.requirePhotosMin}
                  onChange={(e) => setForm({ ...form, requirePhotosMin: Number(e.target.value) || 0 })}
                />
              </label>
              )}
              <Button type="submit" disabled={createBusy || !form.name.trim()} className="!bg-sky-600 !font-medium">
                {createBusy ? "Creating…" : "Create new type"}
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
                {family === "DrawingCheck" ? (
                  <Select
                    label="Discipline"
                    hint="The upload gate opens this checklist for drawings of this discipline."
                    value={detail.discipline || ""}
                    onChange={(e) => setDetail({ ...detail, discipline: e.target.value || null })}
                    disabled={!canEdit}
                  >
                    <option value="">{formatUiText("Select discipline")}</option>
                    {disciplineOptions.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </Select>
                ) : null}
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={!!detail.requireInstructions}
                    onChange={(e) => setDetail({ ...detail, requireInstructions: e.target.checked })}
                    disabled={!canEdit}
                  />
                  {formatUiText("Require an instruction on every line")}
                </label>
                {canEdit && <Button type="submit" className="!bg-sky-600 !font-medium">Save header</Button>}
              </form>

              <div className="border-t border-line pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <h4 className="text-sm font-semibold">Line items</h4>
                  <Badge tone={missingInstructionCount ? "warn" : "ok"}>
                    {`${formatUiText("Instructions")}: ${instructedCount} / ${detailItems.length}`}
                  </Badge>
                </div>
                <p className="text-xs text-steel-muted mb-2">
                  Add an instruction for each line so reviewers know what to check.{" "}
                  {detail.requireInstructions ? "This checklist requires one on every line." : "Lines without one are allowed."}
                </p>
                <label className="flex items-center gap-2 text-xs text-steel-muted mb-2">
                  <input
                    type="checkbox"
                    checked={onlyMissingInstruction}
                    onChange={(e) => setOnlyMissingInstruction(e.target.checked)}
                  />
                  {formatUiText("Show lines without instruction")} ({missingInstructionCount})
                </label>
                <ul className="space-y-3 max-h-[28rem] overflow-y-auto text-sm">
                  {onlyMissingInstruction && missingInstructionCount === 0 ? (
                    <li className="text-xs text-steel-muted">Every line has an instruction.</li>
                  ) : null}
                  {detailItems.filter((i) => !onlyMissingInstruction || !lineHasInstruction(i)).map((i: any) => (
                    <ChecklistLineEditor
                      key={i.id}
                      item={i}
                      canEdit={canEdit}
                      token={token}
                      requireInstruction={!!detail.requireInstructions}
                      showPhoto={family !== "DrawingCheck"}
                      onSaved={async (fresh) => {
                        if (fresh) {
                          setDetail((d: any) =>
                            d
                              ? { ...d, items: (d.items || []).map((row: any) => (row.id === fresh.id ? { ...row, ...fresh } : row)) }
                              : d
                          );
                        } else if (detail?.id) {
                          setDetail(await api(`/api/checklist/templates/${detail.id}`, { token }));
                        }
                        await load();
                      }}
                      onMsg={setMsg}
                    />
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
                    placeholder="Instruction for this line (what the site must check / attach)"
                    value={itemForm.instruction}
                    onChange={(e) => setItemForm({ ...itemForm, instruction: e.target.value })}
                    rows={2}
                  />
                  {family !== "DrawingCheck" && (
                  <label className="text-xs flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={itemForm.requirePhoto}
                      onChange={(e) => setItemForm({ ...itemForm, requirePhoto: e.target.checked })}
                    />
                    Require photo on this line
                  </label>
                  )}
                  <Button type="submit" className="!bg-emerald-500 !font-medium">Add line item</Button>
                </form>
              )}

              {id && (
                <div className="flex flex-wrap gap-3 items-center border-t border-line pt-3">
                  <Button
                    type="button"
                    className="!bg-amber-400 !text-ink !font-medium"
                    onClick={() => void openFamilyChecklistFill(id, family, token, { templateId: detail.id })}
                  >
                    Fill this checklist
                  </Button>
                  {canEdit && (
                    <Button
                      type="button"
                      className="!bg-sky-600 !font-medium"
                      disabled={assignBlocked}
                      title={
                        assignBlocked
                          ? `Add an instruction to every line first (${missingInstructionCount} missing).`
                          : undefined
                      }
                      onClick={async () => {
                        try {
                          await api(`/api/checklist/project/${id}/assign`, {
                            method: "POST",
                            token,
                            body: JSON.stringify({ templateId: detail.id }),
                          });
                          setMsg("Assigned to this project — use Fill to open the popup window.");
                        } catch (err) {
                          setMsg(err instanceof Error ? err.message : "Assign failed");
                        }
                      }}
                    >
                      Assign to this project
                    </Button>
                  )}
                  {canEdit && assignBlocked ? (
                    <span className="text-xs text-warn">
                      Add an instruction to every line before assigning ({missingInstructionCount} missing).
                    </span>
                  ) : null}
                  {canEdit && (
                    <Link to={`/projects/${id}/checklist/assign`} className="text-sm font-semibold text-brand">
                      Assign catalog →
                    </Link>
                  )}
                </div>
              )}
            </>
          )}
        </Card>
      </div>
        </>
      )}
    </div>
  );
}

function ChecklistLineEditor({
  item,
  canEdit,
  token,
  showPhoto,
  requireInstruction = false,
  onSaved,
  onMsg,
}: {
  item: {
    id: string;
    itemCode?: string;
    description: string;
    instruction?: string | null;
    instructionFileUrl?: string | null;
    instructionFileName?: string | null;
    requirePhoto?: boolean;
    section?: string | null;
  };
  canEdit: boolean;
  token: string | null;
  showPhoto: boolean;
  requireInstruction?: boolean;
  onSaved: (fresh?: any) => void | Promise<void>;
  onMsg: (text: string) => void;
}) {
  const [description, setDescription] = useState(item.description || "");
  const [instruction, setInstruction] = useState(item.instruction || "");
  const [requirePhoto, setRequirePhoto] = useState(!!item.requirePhoto);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDescription(item.description || "");
    setInstruction(item.instruction || "");
    setRequirePhoto(!!item.requirePhoto);
  }, [item.id, item.description, item.instruction, item.requirePhoto]);

  async function saveMeta() {
    if (requireInstruction && !instruction.trim() && !item.instructionFileUrl) {
      onMsg("This checklist requires an instruction on every line. Add one before saving.");
      return;
    }
    setBusy(true);
    try {
      const fresh = await api(`/api/checklist/items/${item.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ description, instruction, requirePhoto }),
      });
      onMsg("Line instruction saved.");
      await onSaved(fresh);
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Could not save line");
    } finally {
      setBusy(false);
    }
  }

  async function attachFile(files: File[]) {
    const file = files[0];
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const fresh = await api(`/api/checklist/items/${item.id}/instruction-file`, {
        method: "POST",
        token,
        body: fd,
      });
      onMsg(`Instruction file attached: ${file.name}`);
      await onSaved(fresh);
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Could not attach instruction file");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="border border-line p-3 rounded-sm space-y-2">
      <div className="font-medium">
        {item.itemCode ? `${item.itemCode}. ` : ""}
        {canEdit ? (
          <Input className="mt-1" value={description} onChange={(e) => setDescription(e.target.value)} />
        ) : (
          item.description
        )}
      </div>
      {canEdit ? (
        <TextArea
          placeholder="Instruction for this check (method / observation / what to attach)"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={2}
        />
      ) : (
        item.instruction && <div className="text-xs text-steel-muted">Instruction: {item.instruction}</div>
      )}
      {(item.instructionFileUrl || item.instructionFileName) && (
        <a
          href={item.instructionFileUrl || "#"}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold text-brand"
        >
          Instruction file: {item.instructionFileName || "Open"}
        </a>
      )}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          {showPhoto && (
            <label className="text-xs flex items-center gap-2">
              <input type="checkbox" checked={requirePhoto} onChange={(e) => setRequirePhoto(e.target.checked)} />
              Photo required
            </label>
          )}
          <FilePickButton
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
            disabled={busy}
            onPick={(files) => void attachFile(files)}
          >
            {item.instructionFileUrl ? "Replace instruction file" : "Attach instruction file"}
          </FilePickButton>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void saveMeta()}>
            {busy ? "Saving…" : "Save line"}
          </Button>
        </div>
      )}
    </li>
  );
}
