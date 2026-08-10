import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, apiBase } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader, Select } from "../components/ui";
import { FilePickButton } from "../components/FilePickButton";

type BidPackage = {
  id: string;
  title: string;
  status: string;
  revisionLabel: string;
  vendorNames?: string[];
  vendorNamesJson?: string;
  comparativeSheetId?: string | null;
  lead?: { id: string; title: string; stage?: string } | null;
  vendorBoqs?: {
    id: string;
    vendorLabel: string;
    fileName?: string | null;
    uploadedAt?: string | null;
    sheetId?: string | null;
    vendor?: { id: string; name: string; email?: string | null } | null;
  }[];
  summary?: {
    vendorLabels: string[];
    grandTotals: Record<string, number>;
    lowestVendor?: string;
  } | null;
};

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
}

export default function CrmBidComparePage() {
  const { token, user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "office";

  const [packages, setPackages] = useState<BidPackage[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BidPackage | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadSlot, setUploadSlot] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    title: "",
    leadId: "",
    revisionLabel: "R2",
    vendorIds: [] as string[],
  });

  const load = useCallback(async () => {
    if (!canManage) return;
    const [pkgs, l, v] = await Promise.all([
      api<BidPackage[]>("/api/crm/bid-packages", { token }).catch(() => []),
      api<any[]>("/api/crm/leads", { token }).catch(() => []),
      api<any[]>("/api/vendors", { token }).catch(() => []),
    ]);
    setPackages(pkgs);
    setLeads(l);
    setVendors(v.filter((x) => x.partyType === "Contractor" || x.partyType === "Vendor"));
  }, [token, canManage]);

  const loadDetail = useCallback(
    async (id: string) => {
      const row = await api<BidPackage>(`/api/crm/bid-packages/${id}`, { token });
      setDetail(row);
    },
    [token]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  async function createPackage(e: FormEvent) {
    e.preventDefault();
    if (form.vendorIds.length < 2) {
      setMsg("Select at least 2 vendors to compare.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const vendorNames = form.vendorIds
        .map((id) => vendors.find((v) => v.id === id)?.name)
        .filter(Boolean) as string[];
      const row = await api<BidPackage>("/api/crm/bid-packages", {
        method: "POST",
        token,
        body: JSON.stringify({
          title: form.title,
          leadId: form.leadId || undefined,
          revisionLabel: form.revisionLabel,
          vendorNames,
        }),
      });
      setMsg(`Bid package created — comparative sheet ready.`);
      setForm({ title: "", leadId: "", revisionLabel: "R2", vendorIds: [] });
      await load();
      setSelectedId(row.id);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadBoq(e: FormEvent) {
    e.preventDefault();
    if (!uploadFile || !selectedId || !uploadSlot) return;
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      await api(`/api/crm/bid-packages/${selectedId}/vendor-boq/${uploadSlot}`, {
        method: "POST",
        token,
        body: fd,
      });
      setMsg("Vendor BOQ uploaded.");
      setUploadFile(null);
      setUploadSlot(null);
      await loadDetail(selectedId);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  if (!canManage) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow="CRM" title="Comparative analysis" subtitle="Office confidential — bid comparison and vendor BOQs." />
        <Card>
          <p className="text-sm text-steel-muted">Comparative bid analysis is available to Office / Admin only.</p>
          <Link to="/crm" className="text-sm text-brand font-semibold mt-2 inline-block">
            ← Back to CRM
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CRM · Confidential"
        title="Comparative analysis"
        subtitle="Vendors upload BOQs here; Sharnam team builds the Comparative Statement R2 — section totals and grand total per vendor."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/crm">
              <Button variant="secondary">← CRM</Button>
            </Link>
            <a href={`${apiBase()}/api/crm/template.xlsx?token=${encodeURIComponent(token || "")}`} download>
              <Button variant="secondary">Download R2 template</Button>
            </a>
          </div>
        }
      />

      {msg && <p className="text-sm text-ok">{msg}</p>}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4">
        <div className="space-y-4">
          <Card>
            <h3 className="font-semibold text-sm mb-3">New bid package</h3>
            <form className="space-y-3" onSubmit={createPackage}>
              <Input
                required
                placeholder="Package title (e.g. Civil works — Phase 1)"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <Select value={form.leadId} onChange={(e) => setForm({ ...form, leadId: e.target.value })}>
                <option value="">Link to lead (optional)</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </Select>
              <Input
                placeholder="Revision"
                value={form.revisionLabel}
                onChange={(e) => setForm({ ...form, revisionLabel: e.target.value })}
              />
              <div>
                <p className="text-xs font-mono uppercase text-steel-muted mb-1">Vendors to compare (min 2)</p>
                <div className="max-h-36 overflow-y-auto border rounded-xl p-2 space-y-1">
                  {vendors.map((v) => (
                    <label key={v.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.vendorIds.includes(v.id)}
                        onChange={(e) => {
                          setForm({
                            ...form,
                            vendorIds: e.target.checked
                              ? [...form.vendorIds, v.id]
                              : form.vendorIds.filter((x) => x !== v.id),
                          });
                        }}
                      />
                      {v.name}
                      <span className="text-[10px] text-steel-muted">({v.trade || v.partyType})</span>
                    </label>
                  ))}
                </div>
              </div>
              <Button type="submit" disabled={busy}>
                {busy ? "Creating…" : "Create + comparative sheet"}
              </Button>
            </form>
          </Card>

          <Card padding={false}>
            <div className="px-4 py-3 border-b bg-sand/40 font-semibold text-sm">Bid packages</div>
            <ul className="divide-y">
              {packages.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className={`w-full text-left px-4 py-3 hover:bg-brand-soft/40 ${selectedId === p.id ? "bg-brand-soft/60" : ""}`}
                    onClick={() => setSelectedId(p.id)}
                  >
                    <div className="font-medium text-sm">{p.title}</div>
                    <div className="text-xs text-steel-muted mt-0.5">
                      {p.revisionLabel} · {p.status}
                      {p.lead ? ` · ${p.lead.title}` : ""}
                    </div>
                    <div className="text-[10px] text-steel-muted mt-1">
                      {(p.vendorBoqs || []).filter((b) => b.fileName).length} / {(p.vendorBoqs || []).length} BOQs uploaded
                    </div>
                  </button>
                </li>
              ))}
              {!packages.length && <li className="px-4 py-6 text-sm text-steel-muted">No bid packages yet.</li>}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          {detail ? (
            <>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-semibold">{detail.title}</h3>
                    <p className="text-xs text-steel-muted mt-0.5">
                      Comparative Statement {detail.revisionLabel} · <Badge>{detail.status}</Badge>
                    </p>
                  </div>
                  {detail.comparativeSheetId && (
                    <Link to={`/custom-sheets/${detail.comparativeSheetId}`}>
                      <Button>Open comparative sheet →</Button>
                    </Link>
                  )}
                </div>

                {detail.summary && (
                  <div className="rounded-xl border border-line bg-sand/30 p-3 mb-4">
                    <p className="text-xs font-mono uppercase text-steel-muted mb-2">Grand total comparison</p>
                    <div className="grid sm:grid-cols-3 gap-2">
                      {detail.summary.vendorLabels.map((v) => (
                        <div key={v} className="rounded-lg bg-paper border border-line px-3 py-2">
                          <div className="text-[10px] text-steel-muted truncate">{v}</div>
                          <div className="font-mono font-semibold text-sm">
                            {formatINR(detail.summary!.grandTotals[v] || 0)}
                          </div>
                          {detail.summary!.lowestVendor === v && (
                            <span className="text-[10px] text-ok font-semibold">Lowest L1</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <h4 className="text-xs font-mono uppercase text-steel-muted mb-2">Vendor BOQ uploads</h4>
                <ul className="space-y-3">
                  {(detail.vendorBoqs || []).map((slot) => (
                    <li key={slot.id} className="flex flex-wrap items-center justify-between gap-2 border border-line rounded-xl px-3 py-2">
                      <div className="min-w-0">
                        <div className="font-medium text-sm">{slot.vendorLabel}</div>
                        {slot.fileName ? (
                          <div className="text-xs text-steel-muted">
                            {slot.fileName}
                            {slot.uploadedAt ? ` · ${new Date(slot.uploadedAt).toLocaleString("en-IN")}` : ""}
                          </div>
                        ) : (
                          <div className="text-xs text-warn">BOQ not uploaded yet</div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {slot.sheetId && (
                          <Link to={`/custom-sheets/${slot.sheetId}`}>
                            <Button variant="secondary" className="!text-xs !py-1">
                              View BOQ
                            </Button>
                          </Link>
                        )}
                        <Button variant="secondary" className="!text-xs !py-1" onClick={() => setUploadSlot(slot.id)}>
                          {slot.fileName ? "Replace BOQ" : "Upload BOQ"}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>

              {uploadSlot && (
                <Card>
                  <h4 className="font-semibold text-sm mb-2">Upload vendor BOQ (Excel)</h4>
                  <form className="space-y-3" onSubmit={uploadBoq}>
                    <FilePickButton accept=".xlsx,.xls,.csv" onPick={(files) => setUploadFile(files[0] || null)}>
                      {uploadFile ? uploadFile.name : "Choose Excel BOQ"}
                    </FilePickButton>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={!uploadFile || busy}>
                        Upload
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => { setUploadSlot(null); setUploadFile(null); }}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <p className="text-sm text-steel-muted">Select a bid package to upload vendor BOQs and open the comparative sheet.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
