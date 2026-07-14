import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea, WorkflowStrip } from "../../components/ui";

export default function InspectionsPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [drawings, setDrawings] = useState<any[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [title, setTitle] = useState("Quality action plan");
  const [drawingId, setDrawingId] = useState("");
  const [inspectionType, setInspectionType] = useState("Quality Action Plan");
  const [itemText, setItemText] = useState("");
  const [itemDue, setItemDue] = useState("");
  const [msg, setMsg] = useState("");

  const canManage =
    user?.role === "admin" || user?.role === "office" || user?.role === "site_employee" || user?.role === "employee";

  const load = async () => {
    const [insp, d] = await Promise.all([
      api<{
        inspections: any[];
        canInspect: boolean;
        publishedDrawings: number;
      }>(`/api/inspections/project/${id}`, { token }),
      api<any[]>(`/api/drawings/project/${id}`, { token }),
    ]);
    setData(insp);
    setDrawings(d.filter((x) => x.isPublished));
    if (!active && insp.inspections?.[0]) setActive(insp.inspections[0].id);
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  const selected = data?.inspections?.find((i: any) => i.id === active);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Quality assurance"
        title="Quality action plan"
        subtitle="Maintain action plans linked to published drawings. Track item status and due dates; unresolved items can spawn RFIs."
        actions={
          <Badge tone={data?.canInspect ? "ok" : "warn"}>
            {data?.canInspect ? "Drawings gate open" : "Publish drawings first"}
          </Badge>
        }
      />

      <WorkflowStrip
        active={data?.canInspect ? 1 : 0}
        steps={[
          { label: "Drawing published", hint: "Required gate" },
          { label: "Create action plan", hint: "Link to sheet" },
          { label: "Track items", hint: "Pass / Fail / Unresolved" },
          { label: "Close / RFI", hint: "Unresolved can spawn RFI" },
        ]}
      />

      {canManage && (
        <Card>
          <form
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 items-end"
            onSubmit={async (e) => {
              e.preventDefault();
              setMsg("");
              try {
                await api(`/api/inspections/project/${id}`, {
                  method: "POST",
                  token,
                  body: JSON.stringify({
                    title,
                    linkedDrawingId: drawingId || null,
                    inspectionType,
                  }),
                });
                await load();
              } catch (err) {
                setMsg(err instanceof Error ? err.message : "Failed");
              }
            }}
          >
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Action plan title" required />
            <Select value={inspectionType} onChange={(e) => setInspectionType(e.target.value)}>
              {["Quality Action Plan", "Quality", "Safety", "Handover"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
            <Select value={drawingId} onChange={(e) => setDrawingId(e.target.value)}>
              <option value="">Link published drawing</option>
              {drawings.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.drawingNumber} — {d.title}
                </option>
              ))}
            </Select>
            <Button type="submit" disabled={!data?.canInspect}>
              Create plan
            </Button>
          </form>
          {msg && <p className="text-sm text-danger mt-2">{msg}</p>}
        </Card>
      )}

      <div className="grid lg:grid-cols-[320px_1fr] gap-4">
        <Card padding={false}>
          <div className="px-4 py-3 border-b font-semibold bg-sand/40">Action plans</div>
          <ul className="divide-y max-h-[55vh] overflow-y-auto">
            {data?.inspections?.map((i: any) => (
              <button
                key={i.id}
                type="button"
                className={`w-full text-left px-4 py-3 ${active === i.id ? "bg-brand-soft" : ""}`}
                onClick={() => setActive(i.id)}
              >
                <div className="font-medium text-sm">{i.title}</div>
                <div className="text-[11px] text-steel-muted mt-1 flex gap-2 flex-wrap">
                  <Badge tone={i.status === "Completed" ? "ok" : "warn"}>{i.status}</Badge>
                  <span>{i.inspectionType}</span>
                  {i.drawing?.drawingNumber}
                </div>
              </button>
            ))}
          </ul>
        </Card>

        <Card>
          {!selected && <p className="text-sm text-steel-muted">Select an action plan</p>}
          {selected && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">{selected.title}</h2>
                <p className="text-sm text-steel-muted mt-1">
                  {selected.drawing ? `${selected.drawing.drawingNumber} — ${selected.drawing.title}` : "No drawing linked"} ·{" "}
                  {selected.createdBy?.fullName}
                </p>
              </div>
              <div className="space-y-2">
                {selected.items.map((item: any) => (
                  <div key={item.id} className="rounded-xl border border-line p-3">
                    <div className="text-sm font-medium">{item.description}</div>
                    {item.dueDate && (
                      <div className="text-[11px] text-steel-muted mt-1">Due {new Date(item.dueDate).toLocaleDateString()}</div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {["Pending", "Passed", "Failed", "Unresolved"].map((st) => (
                        <button
                          key={st}
                          type="button"
                          className={`rounded px-3 py-1 text-xs border ${
                            item.status === st ? "bg-procore-navy text-white border-procore-navy" : "border-line"
                          }`}
                          onClick={async () => {
                            const res = await api<any>(`/api/inspections/items/${item.id}`, {
                              method: "PATCH",
                              token,
                              body: JSON.stringify({ status: st }),
                            });
                            if (res.generatedRfi) setMsg(`RFI ${res.generatedRfi.number} created from unresolved item`);
                            await load();
                          }}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                    {item.linkedRfiId && <p className="text-xs text-brand mt-2">Linked RFI created</p>}
                  </div>
                ))}
              </div>
              {canManage && selected.status !== "Completed" && (
                <div className="flex flex-wrap gap-2 items-end">
                  <TextArea
                    className="flex-1 min-w-[200px]"
                    rows={2}
                    placeholder="Add action item"
                    value={itemText}
                    onChange={(e) => setItemText(e.target.value)}
                  />
                  <Input type="date" value={itemDue} onChange={(e) => setItemDue(e.target.value)} />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={async () => {
                      if (!itemText.trim()) return;
                      await api(`/api/inspections/${selected.id}/items`, {
                        method: "POST",
                        token,
                        body: JSON.stringify({ description: itemText, dueDate: itemDue || null }),
                      });
                      setItemText("");
                      setItemDue("");
                      await load();
                    }}
                  >
                    Add item
                  </Button>
                  <Button
                    onClick={async () => {
                      await api(`/api/inspections/${selected.id}/complete`, { method: "POST", token });
                      await load();
                    }}
                  >
                    Complete plan
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
