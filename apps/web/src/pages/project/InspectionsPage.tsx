import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea, WorkflowStrip } from "../../components/ui";

/** Raise QA inspection with checklist → becomes fillable form when Ready; drawing + assignee */
export default function InspectionsPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [drawings, setDrawings] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "Site quality inspection",
    drawingId: "",
    inspectionType: "Quality Inspection",
    checklistTemplateId: "",
    assignedToId: "",
    dueDate: "",
    location: "",
  });
  const [itemText, setItemText] = useState("");
  const [msg, setMsg] = useState("");

  const canManage =
    user?.role === "admin" || user?.role === "office" || user?.role === "site_employee" || user?.role === "employee";

  const load = async () => {
    const [insp, d, u, t] = await Promise.all([
      api<{ inspections: any[]; canInspect: boolean; publishedDrawings: number }>(`/api/inspections/project/${id}`, {
        token,
      }),
      api<any[]>(`/api/drawings/project/${id}`, { token }),
      api<any[]>("/api/users", { token }).catch(() => []),
      api<any[]>("/api/checklist/templates", { token }).catch(() => []),
    ]);
    setData(insp);
    setDrawings(d.filter((x) => x.isPublished));
    setUsers(u);
    const list = Array.isArray(t) ? t : [];
    const qi = list.filter((x: any) => /quality|qi|inspection/i.test(`${x.checklistType || ""} ${x.category || ""} ${x.name || ""}`));
    setTemplates(qi.length ? qi : list.slice(0, 25));
    if (!active && insp.inspections?.[0]) setActive(insp.inspections[0].id);
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  const selected = data?.inspections?.find((i: any) => i.id === active);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Quality module · inspections"
        title="Quality Inspections"
        subtitle="Separate Quality Inspection tool — raise inspections, assign, mark Ready. Unresolved lines can spawn a QI fill RFI. Safety is a separate tool in this same Quality module."
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <Badge tone="ok">QI flow</Badge>
            <Link to={`/projects/${id}/safety`} className="text-sm font-semibold text-brand">
              Safety →
            </Link>
          </div>
        }
      />

      <WorkflowStrip
        active={1}
        steps={[
          { label: "Raise inspection", hint: "Checklist → form" },
          { label: "Mark Ready", hint: "Assignee fills" },
          { label: "QI fill RFI", hint: "Matrix / vendor" },
          { label: "Close", hint: "Unresolved → RFI" },
        ]}
      />

      {canManage && (
        <Card>
          <h3 className="font-semibold mb-3">Raise inspection</h3>
          <form
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setMsg("");
              try {
                const created = await api<any>(`/api/inspections/project/${id}`, {
                  method: "POST",
                  token,
                  body: JSON.stringify({
                    title: form.title,
                    linkedDrawingId: form.drawingId || null,
                    inspectionType: form.inspectionType,
                    checklistTemplateId: form.checklistTemplateId || null,
                    assignedToId: form.assignedToId || null,
                    dueDate: form.dueDate || null,
                    location: form.location,
                    status: "Draft",
                  }),
                });
                setActive(created.id);
                setMsg("Inspection created as Draft — mark Ready when the checklist form should be filled.");
                await load();
              } catch (err) {
                setMsg(err instanceof Error ? err.message : "Failed");
              }
            }}
          >
            <Input
              className="sm:col-span-2"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Inspection title"
              required
            />
            <Select value={form.inspectionType} onChange={(e) => setForm({ ...form, inspectionType: e.target.value })}>
              {["Quality Inspection", "Quality Action Plan", "Safety", "Handover"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
            <Select
              value={form.checklistTemplateId}
              onChange={(e) => setForm({ ...form, checklistTemplateId: e.target.value })}
            >
              <option value="">Checklist template (optional → form lines)</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <Select value={form.drawingId} onChange={(e) => setForm({ ...form, drawingId: e.target.value })}>
              <option value="">Published drawing</option>
              {drawings.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.drawingNumber} — {d.title}
                </option>
              ))}
            </Select>
            <Select value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}>
              <option value="">Assignee</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} · {u.role}
                </option>
              ))}
            </Select>
            <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            <Input placeholder="Location / grid" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <Button type="submit" className="sm:col-span-2 lg:col-span-3">
              Create draft inspection
            </Button>
          </form>
          {msg && <p className="text-sm mt-2 text-steel-muted">{msg}</p>}
        </Card>
      )}

      <div className="grid lg:grid-cols-[300px_1fr] gap-4">
        <Card padding={false}>
          <div className="px-4 py-3 border-b font-semibold bg-sand/40">Inspections</div>
          <ul className="divide-y max-h-[55vh] overflow-y-auto">
            {data?.inspections?.map((i: any) => (
              <button
                key={i.id}
                type="button"
                className={`w-full text-left px-4 py-3 ${active === i.id ? "bg-brand-soft" : ""}`}
                onClick={() => setActive(i.id)}
              >
                <div className="flex justify-between gap-2">
                  <span className="font-medium text-sm">{i.title}</span>
                  <Badge tone={i.status === "Ready" || i.status === "Closed" ? "ok" : "warn"}>{i.status}</Badge>
                </div>
                <div className="text-[11px] text-steel-muted mt-1">
                  {i.drawing?.drawingNumber || "No drawing"} · {i.assignedTo?.fullName || "Unassigned"} · {i.items?.length || 0} lines
                </div>
              </button>
            ))}
            {!data?.inspections?.length && <li className="p-4 text-sm text-steel-muted">No inspections yet.</li>}
          </ul>
        </Card>

        <Card>
          {!selected && <p className="text-sm text-steel-muted">Select an inspection</p>}
          {selected && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-2xl">{selected.title}</h2>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge>{selected.status}</Badge>
                  <Badge tone="neutral">{selected.inspectionType}</Badge>
                  {selected.drawing && <Badge tone="brand">{selected.drawing.drawingNumber}</Badge>}
                </div>
                <p className="text-sm text-steel-muted mt-2">
                  Assignee: {selected.assignedTo?.fullName || "—"} · By {selected.createdBy?.fullName}
                </p>
              </div>

              {canManage && (
                <div className="flex flex-wrap gap-2">
                  {selected.status === "Draft" && (
                    <Button
                      type="button"
                      onClick={async () => {
                        await api(`/api/inspections/${selected.id}`, {
                          method: "PATCH",
                          token,
                          body: JSON.stringify({ status: "Ready" }),
                        });
                        await load();
                      }}
                    >
                      Mark Ready (form open)
                    </Button>
                  )}
                  {selected.status === "Ready" && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={async () => {
                        await api(`/api/inspections/${selected.id}`, {
                          method: "PATCH",
                          token,
                          body: JSON.stringify({ status: "In Progress" }),
                        });
                        await load();
                      }}
                    >
                      Start fill
                    </Button>
                  )}
                  {selected.status !== "Closed" && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={async () => {
                        await api(`/api/inspections/${selected.id}`, {
                          method: "PATCH",
                          token,
                          body: JSON.stringify({ status: "Closed" }),
                        });
                        await load();
                      }}
                    >
                      Close
                    </Button>
                  )}
                  <Link to={`/projects/${id}/dms`} className="text-sm font-semibold text-brand self-center">
                    Open Inspections folder →
                  </Link>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-sm mb-2">Checklist form lines</h3>
                <ul className="space-y-3">
                  {selected.items?.map((it: any) => {
                    let attachments: { url: string; name: string; kind: string; comment?: string }[] = [];
                    try {
                      attachments = JSON.parse(it.attachmentsJson || "[]");
                    } catch {
                      attachments = [];
                    }
                    return (
                      <li key={it.id} className="border border-line rounded-lg p-3 text-sm space-y-2">
                        <div className="flex flex-wrap justify-between gap-2">
                          <span className="font-medium">{it.description}</span>
                          <div className="flex gap-1">
                            {["Pass", "Fail", "N/A", "Open"].map((st) => (
                              <button
                                key={st}
                                type="button"
                                className={`text-[11px] px-2 py-1 border rounded ${it.status === st ? "bg-brand text-white border-brand" : "border-line"}`}
                                onClick={async () => {
                                  await api(`/api/inspections/items/${it.id}`, {
                                    method: "PATCH",
                                    token,
                                    body: JSON.stringify({ status: st }),
                                  });
                                  await load();
                                }}
                              >
                                {st}
                              </button>
                            ))}
                          </div>
                        </div>
                        <TextArea
                          rows={2}
                          placeholder="Comment for this line"
                          defaultValue={it.remarks || ""}
                          onBlur={async (e) => {
                            const remarks = e.target.value;
                            if (remarks === (it.remarks || "")) return;
                            await api(`/api/inspections/items/${it.id}`, {
                              method: "PATCH",
                              token,
                              body: JSON.stringify({ remarks }),
                            });
                            await load();
                          }}
                        />
                        <div className="grid sm:grid-cols-2 gap-2">
                          <label className="text-[11px] text-steel-muted block">
                            Photos / docs
                            <input
                              type="file"
                              multiple
                              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                              className="block mt-1 text-xs w-full"
                              onChange={async (e) => {
                                const files = e.target.files;
                                if (!files?.length) return;
                                const fd = new FormData();
                                Array.from(files).forEach((f) => fd.append("files", f));
                                if (it.remarks) fd.append("remarks", it.remarks);
                                await api(`/api/inspections/items/${it.id}/attachments`, {
                                  method: "POST",
                                  token,
                                  body: fd,
                                });
                                e.target.value = "";
                                await load();
                              }}
                            />
                          </label>
                          <div className="text-[11px] text-steel-muted">
                            {attachments.length ? (
                              <ul className="space-y-1">
                                {attachments.map((a, idx) => (
                                  <li key={`${a.url}-${idx}`}>
                                    <a href={a.url} target="_blank" rel="noreferrer" className="text-brand font-medium">
                                      {a.kind === "photo" ? "Photo" : "Doc"}: {a.name}
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              "No attachments yet"
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {canManage && (
                <form
                  className="flex gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await api(`/api/inspections/${selected.id}/items`, {
                      method: "POST",
                      token,
                      body: JSON.stringify({ description: itemText }),
                    });
                    setItemText("");
                    await load();
                  }}
                >
                  <Input className="flex-1" placeholder="Add form line" value={itemText} onChange={(e) => setItemText(e.target.value)} required />
                  <Button type="submit">Add</Button>
                </form>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
