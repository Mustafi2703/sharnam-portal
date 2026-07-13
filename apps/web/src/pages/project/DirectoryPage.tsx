import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, PageHeader, Select } from "../../components/ui";

export default function DirectoryPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [overview, setOverview] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("member");
  const canEdit = user?.role === "admin" || user?.role === "office";

  const load = async () => {
    const [o, u] = await Promise.all([
      api(`/api/directory/project/${id}/overview`, { token }),
      api<any[]>("/api/users", { token }).catch(() => []),
    ]);
    setOverview(o);
    setUsers(u);
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Project directory"
        title="People"
        subtitle="Assign employees to this project — Procore-style project directory."
      />

      {canEdit && (
        <Card>
          <form
            className="flex flex-wrap gap-2 items-end"
            onSubmit={async (e) => {
              e.preventDefault();
              await api(`/api/projects/${id}/members`, {
                method: "POST",
                token,
                body: JSON.stringify({ userId, role }),
              });
              await load();
            }}
          >
            <Select className="min-w-[220px]" value={userId} onChange={(e) => setUserId(e.target.value)} required>
              <option value="">Select employee</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.fullName} · {u.role}</option>
              ))}
            </Select>
            <Select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="member">Member</option>
              <option value="project_manager">Project Manager</option>
              <option value="site_engineer">Site Engineer</option>
              <option value="viewer">Viewer</option>
            </Select>
            <Button type="submit">Assign to project</Button>
          </form>
        </Card>
      )}

      <Card padding={false}>
        <div className="px-4 py-3 border-b bg-sand/40 font-semibold">Assigned team</div>
        <ul className="divide-y">
          {overview?.members?.map((m: any) => (
            <li key={m.id} className="px-4 py-3 flex justify-between text-sm">
              <div>
                <div className="font-medium">{m.user.fullName}</div>
                <div className="text-xs text-steel-muted">{m.user.email}</div>
              </div>
              <div className="text-right">
                <Badge>{m.role}</Badge>
                <div className="text-[11px] text-steel-muted mt-1 capitalize">{m.user.role.replace("_", " ")}</div>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
