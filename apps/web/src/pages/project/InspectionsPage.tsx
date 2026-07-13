import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader, Select, WorkflowStrip } from "../../components/ui";

export default function InspectionsPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [drawings, setDrawings] = useState<any[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [title, setTitle] = useState("Pre-pour inspection");
  const [drawingId, setDrawingId] = useState("");
  const [msg, setMsg] = useState("");

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
        title="QA / Inspections"
        subtitle="Separate from checklists — inspection forms stored under Mock OneDrive by drawing discipline."
        actions={
          <Badge tone={data?.canInspect ? "ok" : "warn"}>
            {data?.canInspect ? "Gate open" : "Publish drawings first"}
          </Badge>
        }
      />

      <WorkflowStrip
        active={data?.canInspect ? 1 : 0}
        steps={[
          { label: "Drawing published", hint: "Required gate" },
          { label: "Create inspection", hint: "Linked to sheet" },
          { label: "Mark items", hint: "Pass / Fail / Unresolved" },
          { label: "Auto RFI", hint: "Unresolved can spawn RFI" },
        ]}
      />

      {(user?.role === "admin" || user?.role === "office" || user?.role === "site_employee") && (
        <Card>
          <form
            className="grid sm:grid-cols-3 gap-2 items-end"
            onSubmit={async (e) => {
              e.preventDefault();
              setMsg("");
              try {
                await api(`/api/inspections/project/${id}`, {
                  method: "POST",
                  token,
                  body: JSON.stringify({ title, linkedDrawingId: drawingId || null, inspectionType: "Quality" }),
                });
                await load();
              } catch (err) {
                setMsg(err instanceof Error ? err.message : "Failed");
              }
            }}
          >
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Inspection title" required />
            <Select value={drawingId} onChange={(e) => setDrawingId(e.target.value)}>
              <option value="">Link published drawing</option>
              {drawings.map((d) => (
                <option key={d.id} value={d.id}>{d.drawingNumber} — {d.title}</option>
              ))}
            </Select>
            <Button type="submit" disabled={!data?.canInspect}>Create inspection</Button>
          </form>
          {msg && <p className="text-sm text-danger mt-2">{msg}</p>}
        </Card>
      )}

      <div className="grid lg:grid-cols-[320px_1fr] gap-4">
        <Card padding={false}>
          <div className="px-4 py-3 border-b font-semibold bg-sand/40">Inspections</div>
          <ul className="divide-y max-h-[55vh] overflow-y-auto">
            {data?.inspections?.map((i: any) => (
              <button key={i.id} className={`w-full text-left px-4 py-3 ${active === i.id ? "bg-brand-soft" : ""}`} onClick={() => setActive(i.id)}>
                <div className="font-medium text-sm">{i.title}</div>
                <div className="text-[11px] text-steel-muted mt-1 flex gap-2">
                  <Badge tone={i.status === "Completed" ? "ok" : "warn"}>{i.status}</Badge>
                  {i.drawing?.drawingNumber}
                </div>
              </button>
            ))}
          </ul>
        </Card>

        <Card>
          {!selected && <p className="text-sm text-steel-muted">Select an inspection</p>}
          {selected && (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-2xl">{selected.title}</h2>
                <p className="text-sm text-steel-muted mt-1">
                  {selected.drawing ? `${selected.drawing.drawingNumber} — ${selected.drawing.title}` : "No drawing linked"} · {selected.createdBy?.fullName}
                </p>
              </div>
              <div className="space-y-2">
                {selected.items.map((item: any) => (
                  <div key={item.id} className="rounded-xl border border-line p-3">
                    <div className="text-sm font-medium">{item.description}</div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {["Pending", "Passed", "Failed", "Unresolved"].map((st) => (
                        <button
                          key={st}
                          type="button"
                          className={`rounded-full px-3 py-1 text-xs border ${item.status === st ? "bg-brand text-white border-brand" : "border-line"}`}
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
              {selected.status !== "Completed" && (
                <Button
                  onClick={async () => {
                    await api(`/api/inspections/${selected.id}/complete`, { method: "POST", token });
                    await load();
                  }}
                >
                  Complete inspection
                </Button>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
