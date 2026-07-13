import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

type Project = {
  id: string;
  code: string;
  name: string;
  status: string;
  clientName?: string;
  location?: string;
};

export default function ProjectsPage() {
  const { token, user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState({ code: "", name: "", clientName: "", location: "" });
  const canCreate = user?.role === "admin" || user?.role === "office";

  const load = () => api<Project[]>("/api/projects", { token }).then(setProjects);
  useEffect(() => {
    void load();
  }, [token]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl">Projects</h1>
        <p className="text-steel-muted">Site delivery units — drawings, checklists, diary & cost live here.</p>
      </header>

      {canCreate && (
        <form
          className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2 bg-white rounded-2xl border border-black/5 p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await api("/api/projects", { method: "POST", token, body: JSON.stringify(form) });
            setForm({ code: "", name: "", clientName: "", location: "" });
            await load();
          }}
        >
          <input className="rounded-xl border px-3 py-2 text-sm" placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <input className="rounded-xl border px-3 py-2 text-sm" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="rounded-xl border px-3 py-2 text-sm" placeholder="Client" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
          <input className="rounded-xl border px-3 py-2 text-sm" placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <button className="rounded-xl bg-brand text-white text-sm font-medium">Create</button>
        </form>
      )}

      <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-sand/60 text-left">
            <tr>
              <th className="p-3">Code</th>
              <th className="p-3">Name</th>
              <th className="p-3">Client</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} className="border-t border-black/5">
                <td className="p-3 font-medium text-brand">{p.code}</td>
                <td className="p-3">{p.name}</td>
                <td className="p-3 text-steel-muted">{p.clientName || "—"}</td>
                <td className="p-3">{p.status}</td>
                <td className="p-3 text-right">
                  <Link className="text-brand" to={`/projects/${p.id}`}>
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
