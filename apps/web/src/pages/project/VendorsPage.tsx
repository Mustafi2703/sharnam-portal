import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader } from "../../components/ui";
import { SearchableSelect } from "../../components/SearchableSelect";
import { VendorManageActions } from "../../components/VendorManageActions";
import { formatPartyType, isVendorOrContractor } from "../../lib/vendorTypes";

export default function VendorsPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [vendors, setVendors] = useState<any[]>([]);
  const [assigned, setAssigned] = useState<any[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [tradeRole, setTradeRole] = useState("");
  const [msg, setMsg] = useState("");
  const canEdit = user?.role === "admin" || user?.role === "office";

  const load = async () => {
    const [all, proj] = await Promise.all([
      api<any[]>("/api/vendors", { token }),
      api<any[]>(`/api/vendors/project/${id}`, { token }),
    ]);
    setVendors(all.filter((v) => isVendorOrContractor(v.partyType)));
    setAssigned(proj);
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  const assignOptions = useMemo(() => {
    const onProject = new Set(assigned.map((a) => a.vendorId || a.vendor?.id));
    return vendors
      .filter((v) => !onProject.has(v.id))
      .map((v) => ({
        value: v.id,
        label: v.name,
        sublabel: [v.trade, v.email].filter(Boolean).join(" · ") || undefined,
        keywords: `${v.name} ${v.email || ""} ${v.trade || ""}`,
      }));
  }, [vendors, assigned]);

  async function assignVendor(e: FormEvent) {
    e.preventDefault();
    if (!vendorId || !id) return;
    await api(`/api/vendors/project/${id}/assign`, {
      method: "POST",
      token,
      body: JSON.stringify({ vendorId, tradeRole: tradeRole || undefined }),
    });
    setVendorId("");
    setTradeRole("");
    setMsg("Company linked from CRM directory.");
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Project · vendors"
        title="Vendors / contractors on this project"
        subtitle="Assign companies from the CRM vendor directory. Add or edit the master record on CRM → Vendors — not here."
        actions={
          <Link to="/crm/directory/vendors" className="text-sm font-semibold text-brand">
            CRM vendor directory →
          </Link>
        }
      />

      {msg && <p className="text-sm text-brand bg-brand-soft px-3 py-2 rounded-xl">{msg}</p>}

      {canEdit && (
        <Card className="!p-4">
          <form className="flex flex-wrap gap-2 items-end" onSubmit={(e) => void assignVendor(e)}>
            <SearchableSelect
              className="min-w-[220px] flex-1"
              options={assignOptions}
              value={vendorId}
              onChange={setVendorId}
              placeholder="Pick from CRM directory…"
              searchPlaceholder="Search contractor…"
              required
            />
            <Input
              className="min-w-[160px]"
              placeholder="Trade on this job"
              value={tradeRole}
              onChange={(e) => setTradeRole(e.target.value)}
            />
            <Button type="submit">Assign</Button>
          </form>
        </Card>
      )}

      <Card padding={false}>
        <div className="px-4 py-3 border-b border-line font-semibold bg-sand/40">On this project</div>
        <ul className="divide-y divide-line">
          {assigned.map((a) => (
            <li key={a.id} className="px-4 py-3 text-sm space-y-2">
              <div className="flex justify-between gap-2">
                <span className="font-medium">{a.vendor.name}</span>
                <Badge tone="neutral">{formatPartyType(a.vendor.partyType)}</Badge>
              </div>
              <div className="text-steel-muted text-xs">
                {a.tradeRole || a.vendor.trade || "—"} · {a.vendor.email || "—"}
              </div>
              {canEdit ? (
                <VendorManageActions
                  vendor={a.vendor}
                  token={token}
                  projectId={id}
                  showEdit={false}
                  onChanged={() => void load()}
                />
              ) : null}
            </li>
          ))}
          {!assigned.length && (
            <li className="p-4 text-steel-muted text-sm">
              No vendors assigned yet. Pick from CRM directory above or add a company on CRM → Vendors.
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
}
