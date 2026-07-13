import { useEffect, useState } from "react";
import { api, formatINR } from "../api";
import { useAuth } from "../auth";

export default function CrmPage() {
  const { token, user } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [form, setForm] = useState({ title: "", contactName: "", email: "", stage: "New", value: "" });
  const canEdit = user?.role === "admin" || user?.role === "office";

  const load = async () => {
    const [l, d] = await Promise.all([
      api<any[]>("/api/crm/leads", { token }),
      api<any[]>("/api/crm/deals", { token }),
    ]);
    setLeads(l);
    setDeals(d);
  };

  useEffect(() => {
    void load();
  }, [token]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl">CRM</h1>
        <p className="text-steel-muted">Leads & deals shell — expand after client clarification.</p>
      </header>

      {canEdit && (
        <form
          className="grid sm:grid-cols-5 gap-2 bg-white rounded-2xl border p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await api("/api/crm/leads", {
              method: "POST",
              token,
              body: JSON.stringify({ ...form, value: form.value ? Number(form.value) : null }),
            });
            setForm({ title: "", contactName: "", email: "", stage: "New", value: "" });
            await load();
          }}
        >
          <input className="rounded-xl border px-3 py-2 text-sm" placeholder="Lead title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <input className="rounded-xl border px-3 py-2 text-sm" placeholder="Contact" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
          <input className="rounded-xl border px-3 py-2 text-sm" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="rounded-xl border px-3 py-2 text-sm" placeholder="Value" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
          <button className="rounded-xl bg-brand text-white text-sm">Add lead</button>
        </form>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="rounded-2xl bg-white border p-4">
          <h2 className="font-semibold mb-3">Leads</h2>
          <ul className="text-sm space-y-2">
            {leads.map((l) => (
              <li key={l.id} className="border-b border-black/5 pb-2">
                <div className="font-medium">{l.title}</div>
                <div className="text-steel-muted">
                  {l.contactName} · {l.stage} · {l.value != null ? formatINR(l.value) : "—"}
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl bg-white border p-4">
          <h2 className="font-semibold mb-3">Deals</h2>
          <ul className="text-sm space-y-2">
            {deals.map((d) => (
              <li key={d.id} className="border-b border-black/5 pb-2">
                <div className="font-medium">{d.name}</div>
                <div className="text-steel-muted">
                  {d.stage} · {formatINR(d.value)}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
