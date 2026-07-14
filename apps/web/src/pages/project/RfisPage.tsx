import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../../components/ui";

export default function RfisPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [rfis, setRfis] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [drawings, setDrawings] = useState<any[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [form, setForm] = useState({
    subject: "",
    question: "",
    assignedToId: "",
    linkedDrawingId: "",
    scheduleImpact: "None",
    costImpact: "None",
  });
  const [answer, setAnswer] = useState("");

  const isClient = user?.role === "client";
  const canCreate =
    user?.role === "admin" ||
    user?.role === "office" ||
    user?.role === "site_employee" ||
    user?.role === "employee" ||
    user?.role === "client";
  const canRespond =
    user?.role === "admin" ||
    user?.role === "office" ||
    user?.role === "site_employee" ||
    user?.role === "employee" ||
    user?.role === "vendor";

  const load = async () => {
    const [r, u, d] = await Promise.all([
      api<any[]>(`/api/rfis/project/${id}`, { token }),
      api<any[]>("/api/users", { token }).catch(() => []),
      api<any[]>(`/api/drawings/project/${id}`, { token }),
    ]);
    setRfis(r);
    setUsers(u);
    setDrawings(d);
    if (!active && r[0]) setActive(r[0].id);
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  const filtered = rfis.filter((r) => statusFilter === "All" || r.status === statusFilter);
  const selected = rfis.find((r) => r.id === active);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Issues & ball in court"
        title={isClient ? "Concerns & RFIs" : "RFIs"}
        subtitle={
          isClient
            ? "Raise project concerns for Sharnam office. You can view open / closed status — drawing control stays with the office."
            : "Raise questions against drawings. Inspection failures can auto-create RFIs. Status: Open → Answered → Closed."
        }
      />

      {canCreate && (
        <Card>
          <h3 className="font-semibold mb-3">{isClient ? "Raise concern" : "Create RFI"}</h3>
          <form
            className="space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              await api(`/api/rfis/project/${id}`, { method: "POST", token, body: JSON.stringify(form) });
              setForm({ ...form, subject: "", question: "" });
              await load();
            }}
          >
            <Input required placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            <TextArea required rows={3} placeholder={isClient ? "Describe your concern" : "Question"} value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} />
            {!isClient && (
              <div className="grid sm:grid-cols-3 gap-2">
                <Select value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}>
                  <option value="">Assignee</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName}
                    </option>
                  ))}
                </Select>
                <Select value={form.linkedDrawingId} onChange={(e) => setForm({ ...form, linkedDrawingId: e.target.value })}>
                  <option value="">Linked drawing</option>
                  {drawings.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.drawingNumber} — {d.title}
                    </option>
                  ))}
                </Select>
                <Select value={form.scheduleImpact} onChange={(e) => setForm({ ...form, scheduleImpact: e.target.value })}>
                  {["None", "Low", "Medium", "High"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </Select>
              </div>
            )}
            <Button type="submit">{isClient ? "Submit concern" : "Open RFI"}</Button>
          </form>
        </Card>
      )}

      <div className="flex flex-wrap gap-1">
        {["All", "Open", "Answered", "Closed"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs ${statusFilter === s ? "bg-brand text-white" : "bg-white border border-line"}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[340px_1fr] gap-4">
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-line font-semibold bg-sand/40">Log</div>
          <ul className="divide-y divide-line max-h-[60vh] overflow-y-auto">
            {filtered.map((r) => (
              <button
                key={r.id}
                className={`w-full text-left px-4 py-3 ${active === r.id ? "bg-brand-soft" : "hover:bg-sand/30"}`}
                onClick={() => setActive(r.id)}
              >
                <div className="flex justify-between gap-2">
                  <span className="font-mono text-[11px] text-brand">{r.number}</span>
                  <Badge tone={r.status === "Open" ? "warn" : r.status === "Closed" ? "ok" : "neutral"}>{r.status}</Badge>
                </div>
                <div className="font-medium text-sm mt-1">{r.subject}</div>
                <div className="text-[11px] text-steel-muted mt-1">
                  BIC: {r.ballInCourt} · {r.assignedTo?.fullName || "Unassigned"}
                </div>
              </button>
            ))}
            {!filtered.length && <li className="p-4 text-sm text-steel-muted">No items.</li>}
          </ul>
        </Card>

        <Card>
          {!selected && <p className="text-steel-muted text-sm">Select an item</p>}
          {selected && (
            <div className="space-y-4">
              <div>
                <div className="font-mono text-xs text-brand">{selected.number}</div>
                <h2 className="font-display text-2xl mt-1">{selected.subject}</h2>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge tone="brand">Ball: {selected.ballInCourt}</Badge>
                  <Badge>{selected.status}</Badge>
                  {selected.drawing && <Badge tone="neutral">{selected.drawing.drawingNumber}</Badge>}
                  {selected.questionReceivedFrom && <Badge tone="neutral">{selected.questionReceivedFrom}</Badge>}
                </div>
              </div>
              <div className="rounded-xl bg-sand/40 p-4 text-sm whitespace-pre-wrap">{selected.question}</div>
              <div>
                <h3 className="font-semibold text-sm mb-2">Responses</h3>
                <ul className="space-y-2">
                  {selected.responses?.map((resp: any) => (
                    <li key={resp.id} className="rounded-xl border border-line p-3 text-sm">
                      <div className="text-xs text-steel-muted">
                        {resp.respondedBy.fullName} · {new Date(resp.createdAt).toLocaleString()}
                      </div>
                      <div className="mt-1">{resp.responseText}</div>
                    </li>
                  ))}
                </ul>
              </div>
              {canRespond && selected.status !== "Closed" && (
                <form
                  className="space-y-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await api(`/api/rfis/${selected.id}/respond`, {
                      method: "POST",
                      token,
                      body: JSON.stringify({ responseText: answer, isOfficialResponse: true }),
                    });
                    setAnswer("");
                    await load();
                  }}
                >
                  <TextArea rows={3} placeholder="Response" value={answer} onChange={(e) => setAnswer(e.target.value)} required />
                  <div className="flex gap-2">
                    <Button type="submit">Submit response</Button>
                    {(user?.role === "admin" || user?.role === "office") && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={async () => {
                          await api(`/api/rfis/${selected.id}`, {
                            method: "PATCH",
                            token,
                            body: JSON.stringify({ status: "Closed", ballInCourt: "Creator" }),
                          });
                          await load();
                        }}
                      >
                        Close
                      </Button>
                    )}
                  </div>
                </form>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
