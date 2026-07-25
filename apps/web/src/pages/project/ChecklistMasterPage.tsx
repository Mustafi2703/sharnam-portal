import { FormEvent, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../../components/ui";

const FAMILIES = [
  { value: "DrawingCheck", label: "Drawing check (pre-upload)" },
  { value: "SiteExecution", label: "Site / drawings fill" },
  { value: "QualityInspection", label: "Quality" },
  { value: "Safety", label: "Safety" },
] as const;

type Family = (typeof FAMILIES)[number]["value"];

/** Create / edit checklist types, line items, QA instructions — per module family */
export default function ChecklistMasterPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const family = (searchParams.get("family") as Family) || "QualityInspection";
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

  const load = async () => {
    const list = await api<any[]>(`/api/checklist/templates?type=${family}`, { token });
    setTemplates(list);
    if (activeId && !list.some((t) => t.id === activeId)) setActiveId(list[0]?.id || null);
    else if (!activeId && list[0]) setActiveId(list[0].id);
  };

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

  async function createTemplate(e: FormEvent) {
    e.preventDefault();
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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Checklist master"
        title="Create, upload & choose checklists"
        subtitle="Create manually or upload an Excel checklist (description / instruction / section). Choose a template, assign to the project, then request fill. Quality and Safety support Client create/upload."
      />

      <div className="flex flex-wrap gap-2">
        {FAMILIES.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setSearchParams({ family: f.value })}
            className={`px-3 py-1.5 text-sm font-semibold border rounded-sm ${
              family === f.value ? "bg-brand text-white border-brand" : "bg-white border-line"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {msg && <p className="text-sm text-steel-muted">{msg}</p>}

      {canEdit && (family === "QualityInspection" || family === "Safety") && (
        <Card className="space-y-3">
          <h3 className="font-display text-base">Upload Excel checklist</h3>
          <p className="text-sm text-steel-muted">
            Columns: <span className="font-mono text-xs">description</span>, optional{" "}
            <span className="font-mono text-xs">instruction</span>, <span className="font-mono text-xs">section</span>,{" "}
            <span className="font-mono text-xs">requirePhoto</span>. Then choose the new template below.
          </p>
          <form
            className="flex flex-wrap items-end gap-3"
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
                fd.append("category", "Excel import");
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
                setMsg(err instanceof Error ? err.message : "Excel import failed");
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
              {excelBusy ? "Importing…" : "Upload & create checklist"}
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
              <Button type="submit">Create checklist</Button>
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
