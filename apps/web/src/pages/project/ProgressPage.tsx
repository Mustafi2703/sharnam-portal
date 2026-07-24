import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader, Select } from "../../components/ui";

type Tab = "overview" | "milestones" | "planned" | "hindrance" | "risk";

export default function ProgressPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, user } = useAuth();
  const [data, setData] = useState<any>(null);
  const tab = (searchParams.get("tab") as Tab) || "overview";
  const canEdit = user?.role === "admin" || user?.role === "office" || user?.role === "employee" || user?.role === "site_employee";

  const [hindranceForm, setHindranceForm] = useState({
    description: "",
    location: "",
    activity: "",
    category: "Design & Technical",
    type: "",
  });

  const load = () => api(`/api/progress/${id}/summary`, { token }).then(setData);

  useEffect(() => {
    void load();
  }, [id, token]);

  const setTab = (t: Tab) => {
    if (t === "overview") setSearchParams({});
    else setSearchParams({ tab: t });
  };

  const tabs: { key: Tab; label: string }[] = useMemo(
    () => [
      { key: "overview", label: "Dashboard" },
      { key: "milestones", label: "Milestones" },
      { key: "planned", label: "Planned vs Actual" },
      { key: "hindrance", label: "Hindrance" },
      { key: "risk", label: "Risk" },
    ],
    []
  );

  if (!data) return <div className="text-steel-muted py-10">Loading progress…</div>;

  async function addHindrance(e: React.FormEvent) {
    e.preventDefault();
    if (!hindranceForm.description.trim()) return;
    await api(`/api/progress/${id}/hindrances`, {
      method: "POST",
      token,
      body: JSON.stringify(hindranceForm),
    });
    setHindranceForm({ description: "", location: "", activity: "", category: "Design & Technical", type: "" });
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/projects/${id}`} className="text-sm text-brand font-medium">
          ← Project
        </Link>
        <PageHeader
          eyebrow="Progress"
          title="Progress overview"
          subtitle="Milestones, planned vs actual, hindrance and risk — from your Progress / Milestone / Hindrance packs."
        />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ["Milestones", data.totals.milestones],
          ["Delayed", data.totals.delayed],
          ["Open hindrance", data.totals.openHindrance],
          ["Open risks", data.totals.openRisk],
        ].map(([label, val]) => (
          <Card key={label as string} className="!p-4">
            <div className="text-[10px] uppercase tracking-wider text-steel-muted font-mono">{label}</div>
            <div className="text-2xl font-display mt-1">{val as number}</div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-sm px-4 py-2 text-sm font-medium border transition ${
              tab === t.key ? "bg-brand text-white border-brand" : "bg-white border-line text-ink hover:border-brand/40"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <h3 className="font-display text-base mb-3">Recent hindrances</h3>
            <div className="scroll-panel space-y-2 text-sm">
              {data.hindrances.slice(0, 6).map((h: any) => (
                <div key={h.id} className="flex justify-between gap-2 border-b border-line py-2">
                  <span className="truncate">{h.description}</span>
                  <Badge tone={h.status === "Open" ? "danger" : "ok"}>{h.status}</Badge>
                </div>
              ))}
              {!data.hindrances.length && <p className="text-steel-muted">No hindrances yet.</p>}
            </div>
          </Card>
          <Card>
            <h3 className="font-display text-base mb-3">Top risks</h3>
            <div className="scroll-panel space-y-2 text-sm">
              {data.risks.slice(0, 6).map((r: any) => (
                <div key={r.id} className="flex justify-between gap-2 border-b border-line py-2">
                  <span className="truncate">
                    {r.code ? `${r.code} · ` : ""}
                    {r.name}
                  </span>
                  <span className="font-mono text-xs">Sev {r.severity}</span>
                </div>
              ))}
              {!data.risks.length && <p className="text-steel-muted">No risks logged.</p>}
            </div>
          </Card>
        </div>
      )}

      {tab === "milestones" && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-steel-muted border-b border-line">
                <th className="py-2 pr-3">Code</th>
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3">Activity</th>
                <th className="py-2 pr-3">Plan days</th>
                <th className="py-2 pr-3">Actual days</th>
                <th className="py-2 pr-3">Variance</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.milestones.map((m: any) => (
                <tr key={m.id} className="border-b border-line/70">
                  <td className="py-2 pr-3 font-mono text-xs">{m.code || "—"}</td>
                  <td className="py-2 pr-3">{m.category || "—"}</td>
                  <td className="py-2 pr-3">{m.activity}</td>
                  <td className="py-2 pr-3">{m.plannedDays}</td>
                  <td className="py-2 pr-3">{m.actualDays}</td>
                  <td className="py-2 pr-3">{m.varianceDays}</td>
                  <td className="py-2">
                    <Badge tone={(m.varianceDays || 0) > 0 ? "danger" : "ok"}>{m.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.milestones.length && <p className="text-steel-muted text-sm py-4">No milestones seeded.</p>}
        </Card>
      )}

      {tab === "planned" && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-steel-muted border-b border-line">
                <th className="py-2 pr-3">Period</th>
                <th className="py-2 pr-3">Package</th>
                <th className="py-2 pr-3">Planned %</th>
                <th className="py-2 pr-3">Actual %</th>
                <th className="py-2 pr-3">Planned ₹</th>
                <th className="py-2">Actual ₹</th>
              </tr>
            </thead>
            <tbody>
              {data.plannedActual.map((p: any) => (
                <tr key={p.id} className="border-b border-line/70">
                  <td className="py-2 pr-3 font-mono text-xs">{p.periodLabel}</td>
                  <td className="py-2 pr-3">{p.packageName}</td>
                  <td className="py-2 pr-3">{(p.plannedPct * 100).toFixed(0)}%</td>
                  <td className="py-2 pr-3">{(p.actualPct * 100).toFixed(0)}%</td>
                  <td className="py-2 pr-3">{Math.round(p.plannedAmount).toLocaleString("en-IN")}</td>
                  <td className="py-2">{Math.round(p.actualAmount).toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.plannedActual.length && <p className="text-steel-muted text-sm py-4">No planned vs actual rows.</p>}
        </Card>
      )}

      {tab === "hindrance" && (
        <div className="space-y-4">
          {canEdit && (
            <Card>
              <form className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" onSubmit={addHindrance}>
                <label className="text-sm space-y-1">
                  <span className="text-steel-muted text-xs uppercase tracking-wide">Description</span>
                  <Input
                    value={hindranceForm.description}
                    onChange={(e) => setHindranceForm({ ...hindranceForm, description: e.target.value })}
                    required
                  />
                </label>
                <label className="text-sm space-y-1">
                  <span className="text-steel-muted text-xs uppercase tracking-wide">Location</span>
                  <Input
                    value={hindranceForm.location}
                    onChange={(e) => setHindranceForm({ ...hindranceForm, location: e.target.value })}
                  />
                </label>
                <label className="text-sm space-y-1">
                  <span className="text-steel-muted text-xs uppercase tracking-wide">Activity affected</span>
                  <Input
                    value={hindranceForm.activity}
                    onChange={(e) => setHindranceForm({ ...hindranceForm, activity: e.target.value })}
                  />
                </label>
                <label className="text-sm space-y-1">
                  <span className="text-steel-muted text-xs uppercase tracking-wide">Category</span>
                  <Select
                    value={hindranceForm.category}
                    onChange={(e) => setHindranceForm({ ...hindranceForm, category: e.target.value })}
                  >
                    {["Design & Technical", "Approval", "Execution", "Material Procurement", "Client"].map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="text-sm space-y-1">
                  <span className="text-steel-muted text-xs uppercase tracking-wide">Type</span>
                  <Input
                    value={hindranceForm.type}
                    onChange={(e) => setHindranceForm({ ...hindranceForm, type: e.target.value })}
                  />
                </label>
                <div className="flex items-end">
                  <Button type="submit">Add hindrance</Button>
                </div>
              </form>
            </Card>
          )}
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-steel-muted border-b border-line">
                  <th className="py-2 pr-3">Description</th>
                  <th className="py-2 pr-3">Location</th>
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3">Days</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.hindrances.map((h: any) => (
                  <tr key={h.id} className="border-b border-line/70">
                    <td className="py-2 pr-3 max-w-xs truncate">{h.description}</td>
                    <td className="py-2 pr-3">{h.location || "—"}</td>
                    <td className="py-2 pr-3">{h.category || "—"}</td>
                    <td className="py-2 pr-3">{h.daysImpacted}</td>
                    <td className="py-2">
                      <Badge tone={h.status === "Open" ? "danger" : "ok"}>{h.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === "risk" && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-steel-muted border-b border-line">
                <th className="py-2 pr-3">Code</th>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3">P×C</th>
                <th className="py-2 pr-3">Cost impact</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.risks.map((r: any) => (
                <tr key={r.id} className="border-b border-line/70">
                  <td className="py-2 pr-3 font-mono text-xs">{r.code || "—"}</td>
                  <td className="py-2 pr-3">{r.name}</td>
                  <td className="py-2 pr-3">{r.category || "—"}</td>
                  <td className="py-2 pr-3">{r.severity}</td>
                  <td className="py-2 pr-3">₹{Math.round(r.costImpact).toLocaleString("en-IN")}</td>
                  <td className="py-2">
                    <Badge tone={r.status === "Open" ? "danger" : "ok"}>{r.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
