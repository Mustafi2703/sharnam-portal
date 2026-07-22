import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader, Select } from "../../components/ui";

/** Project directory — employees + vendors (Communication Matrix org list). Managed from HRM. */
export default function DirectoryPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [overview, setOverview] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("member");
  const [vendorId, setVendorId] = useState("");
  const [trade, setTrade] = useState("");
  const canEdit = user?.role === "admin" || user?.role === "office";

  const load = async () => {
    const [o, u, v] = await Promise.all([
      api(`/api/directory/project/${id}/overview`, { token }),
      api<any[]>("/api/users", { token }).catch(() => []),
      api<any[]>("/api/vendors", { token }).catch(() => []),
    ]);
    setOverview(o);
    setUsers(u);
    setVendors(v);
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Project directory"
        title="People & companies"
        subtitle="Project roster — assign from HRM master (all employees & vendors). Feed Communications matrix and RFI distribution. Manage company-wide pool in HR / Directory."
        actions={
          <div className="flex flex-wrap gap-3">
            <Link to="/hrm" className="text-sm font-semibold text-brand">
              HRM master →
            </Link>
            <Link to={`/projects/${id}/vendors`} className="text-sm font-semibold text-brand">
              Vendors →
            </Link>
          </div>
        }
      />

      {canEdit && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <h3 className="font-semibold mb-2 text-sm">Assign employee</h3>
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
              <Select className="min-w-[200px] flex-1" value={userId} onChange={(e) => setUserId(e.target.value)} required>
                <option value="">Select employee</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} · {u.role}
                  </option>
                ))}
              </Select>
              <Select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="member">Member</option>
                <option value="project_manager">Project Manager</option>
                <option value="site_engineer">Site Engineer</option>
                <option value="viewer">Viewer</option>
              </Select>
              <Button type="submit">Assign</Button>
            </form>
          </Card>
          <Card>
            <h3 className="font-semibold mb-2 text-sm">Assign vendor company</h3>
            <form
              className="flex flex-wrap gap-2 items-end"
              onSubmit={async (e) => {
                e.preventDefault();
                await api(`/api/vendors/project/${id}/assign`, {
                  method: "POST",
                  token,
                  body: JSON.stringify({ vendorId, tradeRole: trade }),
                });
                setTrade("");
                await load();
              }}
            >
              <Select className="min-w-[200px] flex-1" value={vendorId} onChange={(e) => setVendorId(e.target.value)} required>
                <option value="">Select vendor</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </Select>
              <Input className="min-w-[120px]" placeholder="Trade" value={trade} onChange={(e) => setTrade(e.target.value)} />
              <Button type="submit">Assign</Button>
            </form>
          </Card>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
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
            {!overview?.members?.length && <li className="px-4 py-6 text-sm text-steel-muted">No employees yet — assign from HRM.</li>}
          </ul>
        </Card>
        <Card padding={false}>
          <div className="px-4 py-3 border-b bg-sand/40 font-semibold">Vendor companies</div>
          <ul className="divide-y">
            {overview?.vendors?.map((row: any) => (
              <li key={row.id} className="px-4 py-3 flex justify-between text-sm">
                <div>
                  <div className="font-medium">{row.vendor?.name}</div>
                  <div className="text-xs text-steel-muted">{row.vendor?.trade || row.tradeRole || "—"}</div>
                </div>
                <Badge tone="neutral">{row.tradeRole || "Vendor"}</Badge>
              </li>
            ))}
            {!overview?.vendors?.length && <li className="px-4 py-6 text-sm text-steel-muted">No vendors yet.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
