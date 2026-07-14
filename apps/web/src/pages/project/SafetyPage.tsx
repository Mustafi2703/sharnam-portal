import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../../components/ui";

const TYPES = ["Observation", "Near Miss", "Incident", "Toolbox Talk", "JHA"];
const SEVERITIES = ["Low", "Medium", "High", "Critical"];

export default function SafetyPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [data, setData] = useState<{ records: any[]; stats: any } | null>(null);
  const [filter, setFilter] = useState("All");
  const [active, setActive] = useState<string | null>(null);
  const [form, setForm] = useState({
    recordType: "Observation",
    title: "",
    description: "",
    severity: "Low",
    location: "",
    correctiveAction: "",
  });
  const [msg, setMsg] = useState("");
  const canCreate = ["admin", "office", "site_employee", "employee", "vendor"].includes(user?.role || "");
  const canClose = user?.role === "admin" || user?.role === "office" || user?.role === "site_employee";

  const load = async () => {
    const res = await api<{ records: any[]; stats: any }>(`/api/safety/project/${id}`, { token });
    setData(res);
    if (!active && res.records[0]) setActive(res.records[0].id);
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  const filtered = useMemo(() => {
    const rows = data?.records || [];
    if (filter === "All") return rows;
    if (filter === "Open" || filter === "Closed") return rows.filter((r) => r.status === filter);
    return rows.filter((r) => r.recordType === filter);
  }, [data, filter]);

  const selected = data?.records.find((r) => r.id === active);

  async function createRecord(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      const row = await api<any>(`/api/safety/project/${id}`, {
        method: "POST",
        token,
        body: JSON.stringify(form),
      });
      setForm({ recordType: "Observation", title: "", description: "", severity: "Low", location: "", correctiveAction: "" });
      setActive(row.id);
      setMsg("Safety record logged.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Site compliance"
        title="Safety"
        subtitle="Observations, near misses, incidents, toolbox talks, and JHAs — open/close with corrective actions."
        actions={
          <div className="flex gap-2">
            <Badge tone="warn">{data?.stats.open ?? 0} open</Badge>
            <Badge tone="danger">{data?.stats.incidents ?? 0} incidents</Badge>
          </div>
        }
      />

      {msg && <p className="text-sm text-brand-dark bg-brand-soft rounded-lg px-3 py-2">{msg}</p>}

      {canCreate && (
        <Card>
          <h3 className="font-semibold mb-3">Log safety record</h3>
          <form className="grid sm:grid-cols-2 gap-3" onSubmit={createRecord}>
            <Select value={form.recordType} onChange={(e) => setForm({ ...form, recordType: e.target.value })}>
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
            <Select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
              {SEVERITIES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
            <Input
              className="sm:col-span-2"
              required
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <Input placeholder="Location / grid" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <Input
              placeholder="Corrective action"
              value={form.correctiveAction}
              onChange={(e) => setForm({ ...form, correctiveAction: e.target.value })}
            />
            <TextArea
              className="sm:col-span-2"
              rows={3}
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <Button type="submit" className="sm:col-span-2">
              Save safety record
            </Button>
          </form>
        </Card>
      )}

      <div className="flex flex-wrap gap-1">
        {["All", "Open", "Closed", ...TYPES].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded px-3 py-1 text-xs font-medium border ${
              filter === f ? "bg-procore-navy text-white border-procore-navy" : "bg-white border-line"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[340px_1fr] gap-4">
        <Card padding={false}>
          <div className="px-4 py-3 border-b bg-sand/50 font-semibold text-sm">Safety log</div>
          <ul className="divide-y max-h-[60vh] overflow-y-auto">
            {filtered.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`w-full text-left px-4 py-3 ${active === r.id ? "bg-brand-soft" : "hover:bg-sand/40"}`}
                onClick={() => setActive(r.id)}
              >
                <div className="flex justify-between gap-2">
                  <span className="text-[11px] font-mono text-brand">{r.recordType}</span>
                  <Badge tone={r.status === "Open" ? "warn" : "ok"}>{r.status}</Badge>
                </div>
                <div className="font-medium text-sm mt-1">{r.title}</div>
                <div className="text-[11px] text-steel-muted mt-1">
                  {r.severity} · {new Date(r.occurredAt).toLocaleDateString()}
                </div>
              </button>
            ))}
            {!filtered.length && <li className="p-4 text-sm text-steel-muted">No records.</li>}
          </ul>
        </Card>

        <Card>
          {!selected && <p className="text-sm text-steel-muted">Select a safety record</p>}
          {selected && (
            <div className="space-y-4">
              <div>
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge tone="brand">{selected.recordType}</Badge>
                  <Badge tone={selected.status === "Open" ? "warn" : "ok"}>{selected.status}</Badge>
                  <Badge
                    tone={
                      selected.severity === "Critical" || selected.severity === "High" ? "danger" : "neutral"
                    }
                  >
                    {selected.severity}
                  </Badge>
                </div>
                <h2 className="text-xl font-semibold">{selected.title}</h2>
                <p className="text-sm text-steel-muted mt-1">
                  Reported by {selected.reportedBy?.fullName} · {new Date(selected.occurredAt).toLocaleString()}
                  {selected.location ? ` · ${selected.location}` : ""}
                </p>
              </div>
              {selected.description && (
                <div className="rounded-lg bg-sand/50 p-3 text-sm whitespace-pre-wrap">{selected.description}</div>
              )}
              {selected.correctiveAction && (
                <div>
                  <div className="text-xs font-mono uppercase text-steel-muted mb-1">Corrective action</div>
                  <p className="text-sm">{selected.correctiveAction}</p>
                </div>
              )}
              {canClose && selected.status === "Open" && (
                <Button
                  type="button"
                  variant="dark"
                  onClick={async () => {
                    await api(`/api/safety/${selected.id}`, {
                      method: "PATCH",
                      token,
                      body: JSON.stringify({ status: "Closed" }),
                    });
                    await load();
                  }}
                >
                  Close record
                </Button>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
