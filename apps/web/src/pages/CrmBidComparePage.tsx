import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader, Select } from "../components/ui";
import { FilePickButton } from "../components/FilePickButton";
import { ComparativeStatementPanel } from "../components/ComparativeStatementPanel";
import { downloadAuthFile } from "../lib/downloadReport";

type Discipline = { key: string; label: string; sheetName: string };

type VendorBoqSlot = {
  id: string;
  vendorLabel: string;
  discipline: string;
  fileName?: string | null;
  uploadedAt?: string | null;
  sharePointUrl?: string | null;
  sheetId?: string | null;
};

type BidPackage = {
  id: string;
  title: string;
  status: string;
  revisionLabel: string;
  comparativeSheetId?: string | null;
  summarySheetId?: string | null;
  comparativeSharePointUrl?: string | null;
  vendorNames?: string[];
  disciplines?: Discipline[];
  vendorBoqs?: VendorBoqSlot[];
  uploadProgress?: { done: number; total: number };
  lead?: { id: string; title: string } | null;
  project?: { id: string; code: string; name: string } | null;
  notes?: string | null;
  summary?: {
    vendorLabels: string[];
    sectionTotals: { section: string; title: string; totals: Record<string, number> }[];
    grandTotals: Record<string, number>;
    lowestVendor?: string;
  } | null;
};

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
}

function disciplineLabel(disciplines: Discipline[], key: string) {
  return disciplines.find((d) => d.key === key)?.label || key;
}

export default function CrmBidComparePage() {
  const { token, user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "office";

  const [packages, setPackages] = useState<BidPackage[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [projects, setProjects] = useState<{ id: string; code: string; name: string }[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BidPackage | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadSlot, setUploadSlot] = useState<VendorBoqSlot | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    title: "",
    projectId: "",
    leadId: "",
    revisionLabel: "R2",
    vendorIds: [] as string[],
    disciplineKeys: [] as string[],
    customDisciplines: [] as { key: string; label: string; sheetName: string }[],
  });
  const [customDiscLabel, setCustomDiscLabel] = useState("");
  const [customDiscSheet, setCustomDiscSheet] = useState("");
  const [addDiscKeys, setAddDiscKeys] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!canManage) return;
    const [pkgs, disc, l, p, v] = await Promise.all([
      api<BidPackage[]>("/api/crm/bid-packages", { token }).catch(() => []),
      api<Discipline[]>("/api/crm/disciplines", { token }).catch(() => []),
      api<any[]>("/api/crm/leads", { token }).catch(() => []),
      api<{ id: string; code: string; name: string }[]>("/api/projects", { token }).catch(() => []),
      api<any[]>("/api/vendors", { token }).catch(() => []),
    ]);
    setPackages(pkgs);
    setDisciplines(disc);
    setLeads(l);
    setProjects(p);
    setVendors(v);
  }, [token, canManage]);

  const loadDetail = useCallback(
    async (id: string) => {
      const row = await api<BidPackage>(`/api/crm/bid-packages/${id}`, { token });
      setDetail(row);
      if (row.disciplines?.length) setDisciplines(row.disciplines);
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

  useEffect(() => {
    if (disciplines.length && !form.disciplineKeys.length) {
      setForm((f) => ({ ...f, disciplineKeys: disciplines.map((d) => d.key) }));
    }
  }, [disciplines, form.disciplineKeys.length]);

  useEffect(() => {
    if (!form.projectId || !canManage) return;
    void api<{ disciplines: Discipline[] }>(`/api/projects/${form.projectId}/bid-disciplines`, { token })
      .then((r) => {
        if (r.disciplines?.length) {
          setForm((f) => ({ ...f, disciplineKeys: r.disciplines.map((d) => d.key) }));
        }
      })
      .catch(() => {});
  }, [form.projectId, token, canManage]);

  const vendorsByType = useMemo(() => {
    const groups: Record<string, typeof vendors> = {};
    for (const v of vendors) {
      const t = v.partyType || "Vendor";
      (groups[t] ||= []).push(v);
    }
    const order = ["Contractor", "Vendor", "Consultant", "Client", "PMC"];
    return order
      .filter((k) => groups[k]?.length)
      .map((k) => ({ type: k, rows: groups[k]! }))
      .concat(
        Object.keys(groups)
          .filter((k) => !order.includes(k))
          .map((k) => ({ type: k, rows: groups[k]! }))
      );
  }, [vendors]);

  const vendorMatrix = useMemo(() => {
    if (!detail?.vendorBoqs?.length) return [];
    const vendorNames = [...new Set(detail.vendorBoqs.map((b) => b.vendorLabel))];
    return vendorNames.map((vendorLabel) => ({
      vendorLabel,
      slots: (detail.disciplines || disciplines).map((d) => {
        const slot = detail.vendorBoqs!.find((b) => b.vendorLabel === vendorLabel && b.discipline === d.key);
        return { discipline: d, slot };
      }),
    }));
  }, [detail, disciplines]);

  async function createPackage(e: FormEvent) {
    e.preventDefault();
    if (form.vendorIds.length < 2) {
      setMsg("Select at least 2 bidders to compare.");
      return;
    }
    if (!form.disciplineKeys.length) {
      setMsg("Select at least one discipline BOQ sheet.");
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
          projectId: form.projectId || undefined,
          leadId: form.leadId || undefined,
          revisionLabel: form.revisionLabel,
          vendorNames,
          disciplineKeys: form.disciplineKeys,
          customDisciplines: form.customDisciplines,
        }),
      });
      setMsg(`Bid package created — ${row.uploadProgress?.total || form.disciplineKeys.length * vendorNames.length} discipline upload slots ready.`);
      setForm({
        title: "",
        projectId: "",
        leadId: "",
        revisionLabel: "R2",
        vendorIds: [],
        disciplineKeys: disciplines.map((d) => d.key),
        customDisciplines: [],
      });
      await load();
      setSelectedId(row.id);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveProjectDisciplines() {
    if (!form.projectId) {
      setMsg("Select a project first.");
      return;
    }
    setBusy(true);
    try {
      await api(`/api/projects/${form.projectId}/bid-disciplines`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          disciplineKeys: form.disciplineKeys,
          customDisciplines: form.customDisciplines,
        }),
      });
      setMsg("Project default bid disciplines saved.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  function addCustomDiscipline() {
    const label = customDiscLabel.trim();
    if (!label) return;
    const key = label.toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 40);
    const entry = { key, label, sheetName: customDiscSheet.trim() || label };
    setForm((f) => ({
      ...f,
      customDisciplines: [...f.customDisciplines.filter((c) => c.key !== key), entry],
      disciplineKeys: f.disciplineKeys.includes(key) ? f.disciplineKeys : [...f.disciplineKeys, key],
    }));
    setCustomDiscLabel("");
    setCustomDiscSheet("");
  }

  async function addDisciplinesToPackage() {
    if (!selectedId || !addDiscKeys.length) return;
    setBusy(true);
    try {
      await api(`/api/crm/bid-packages/${selectedId}/disciplines`, {
        method: "POST",
        token,
        body: JSON.stringify({ disciplineKeys: addDiscKeys }),
      });
      setMsg(`Added ${addDiscKeys.length} discipline(s) to package.`);
      setAddDiscKeys([]);
      await loadDetail(selectedId);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Add disciplines failed");
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
      await api(`/api/crm/bid-packages/${selectedId}/vendor-boq/${uploadSlot.id}`, {
        method: "POST",
        token,
        body: fd,
      });
      setMsg(`BOQ uploaded — ${uploadSlot.vendorLabel} / ${disciplineLabel(disciplines, uploadSlot.discipline)}`);
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
        <PageHeader eyebrow="CRM" title="Comparative analysis" subtitle="Office confidential." />
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
        title="Bid management — Comparative Statement R2"
        subtitle="Not the PMC proposal (quotation). Here contractors upload discipline BOQs; office compares multiple bids project-wise using Comparative Statement - R2.xlsx."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/crm">
              <Button variant="secondary">← CRM</Button>
            </Link>
            <Link to="/quotations/new">
              <Button variant="secondary">PMC proposal maker</Button>
            </Link>
            <Link to="/crm/vendor-bids">
              <Button variant="secondary">Vendor uploads</Button>
            </Link>
            <Button
              variant="secondary"
              type="button"
              onClick={() => void downloadAuthFile("/api/crm/template.xlsx", token, "Comparative-Statement-R2.xlsx")}
            >
              Download R2 .xlsx
            </Button>
            <Button
              variant="secondary"
              type="button"
              disabled={busy}
              onClick={async () => {
                if (!confirm("Load a demo bid package (Alpha / Bharat / Concord × Civil, Electrical, Admin)?  Real bid packages are never touched.")) return;
                setBusy(true);
                setMsg("");
                try {
                  const pkg = await api<{ id: string; title: string; summary?: { lowestVendor?: string; grandTotals?: Record<string, number> } }>(
                    "/api/crm/bid-packages/seed-demo",
                    {
                      method: "POST",
                      token,
                      body: JSON.stringify({ projectId: form.projectId || undefined }),
                    }
                  );
                  const totals = pkg.summary?.grandTotals || {};
                  const totalStr = Object.entries(totals)
                    .map(([v, n]) => `${v.split(" ")[0]}: ${formatINR(Number(n))}`)
                    .join(" · ");
                  setMsg(`Demo package "${pkg.title}" loaded — ${totalStr}. Lowest: ${pkg.summary?.lowestVendor ?? "—"}.`);
                  await load();
                  setSelectedId(pkg.id);
                } catch (err) {
                  setMsg(err instanceof Error ? err.message : "Demo load failed");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Load 3-vendor demo
            </Button>
          </div>
        }
      />

      {msg && <p className="text-sm text-ok">{msg}</p>}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-4">
        <div className="space-y-4">
          <Card>
            <h3 className="font-semibold text-sm mb-3">New bid package</h3>
            <form className="space-y-3" onSubmit={createPackage}>
              <Input
                required
                placeholder="Package title (e.g. Civil & structural works)"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <Select
                required
                value={form.projectId}
                onChange={(e) => setForm({ ...form, projectId: e.target.value })}
              >
                <option value="">Select project (required for SharePoint + vendor portal)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.name}
                  </option>
                ))}
              </Select>
              {form.projectId && (
                <Button type="button" variant="secondary" className="!text-xs" onClick={() => void saveProjectDisciplines()}>
                  Save discipline list as project default
                </Button>
              )}
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
                <p className="text-xs font-mono uppercase text-steel-muted mb-1">
                  Discipline BOQ sheets ({form.disciplineKeys.length} selected)
                </p>
                <div className="max-h-32 overflow-y-auto border rounded-xl p-2 space-y-1 mb-2">
                  {disciplines.map((d) => (
                    <label key={d.key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.disciplineKeys.includes(d.key)}
                        onChange={(e) => {
                          setForm({
                            ...form,
                            disciplineKeys: e.target.checked
                              ? [...form.disciplineKeys, d.key]
                              : form.disciplineKeys.filter((x) => x !== d.key),
                          });
                        }}
                      />
                      <span>{d.label}</span>
                      <span className="text-[10px] text-steel-muted font-mono">{d.sheetName}</span>
                    </label>
                  ))}
                  {form.customDisciplines.map((d) => (
                    <label key={d.key} className="flex items-center gap-2 text-sm text-brand-dark">
                      <input type="checkbox" checked readOnly />
                      <span>{d.label}</span>
                      <span className="text-[10px] font-mono">custom · {d.sheetName}</span>
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Input
                    placeholder="Custom discipline label"
                    value={customDiscLabel}
                    onChange={(e) => setCustomDiscLabel(e.target.value)}
                    className="!text-sm flex-1 min-w-[140px]"
                  />
                  <Input
                    placeholder="Excel sheet name (optional)"
                    value={customDiscSheet}
                    onChange={(e) => setCustomDiscSheet(e.target.value)}
                    className="!text-sm flex-1 min-w-[140px]"
                  />
                  <Button type="button" variant="secondary" className="!text-xs" onClick={addCustomDiscipline}>
                    + Add discipline
                  </Button>
                </div>
              </div>
              <div>
                <p className="text-xs font-mono uppercase text-steel-muted mb-1">Bidders to compare (min 2)</p>
                <div className="max-h-40 overflow-y-auto border rounded-xl p-2 space-y-3">
                  {vendorsByType.map(({ type, rows }) => (
                    <div key={type}>
                      <p className="text-[10px] font-bold uppercase text-steel-muted mb-1">{type}</p>
                      {rows.map((v) => (
                        <label key={v.id} className="flex items-center gap-2 text-sm py-0.5">
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
                          <span>{v.name}</span>
                          {v.trade && <span className="text-[10px] text-steel-muted">· {v.trade}</span>}
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-steel-muted">
                Creates {form.disciplineKeys.length || 0} discipline slot(s) per bidder. Contractors vs trade vendors
                are grouped by party type. Comparative R2 → SharePoint 05.06; vendor BOQs → 05.05.
              </p>
              <Button type="submit" disabled={busy}>
                {busy ? "Creating…" : "Create from R2 template"}
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
                      {p.project?.code ? `${p.project.code} · ` : ""}
                      {p.revisionLabel} · {p.status}
                    </div>
                    <div className="text-[10px] text-steel-muted mt-1">
                      BOQs {p.uploadProgress?.done ?? 0} / {p.uploadProgress?.total ?? 0}
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
                      {detail.project?.code ? (
                        <span className="font-mono">{detail.project.code}</span>
                      ) : null}
                      {detail.project?.code ? " · " : ""}
                      {detail.revisionLabel} · <Badge>{detail.status}</Badge>
                      {detail.uploadProgress && (
                        <span className="ml-2">
                          {detail.uploadProgress.done}/{detail.uploadProgress.total} discipline BOQs uploaded
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {detail.comparativeSharePointUrl && (
                      <a href={detail.comparativeSharePointUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="secondary">R2 SharePoint</Button>
                      </a>
                    )}
                    {detail.summarySheetId && (
                      <Link to={`/custom-sheets/${detail.summarySheetId}`}>
                        <Button variant="secondary">Summary sheet</Button>
                      </Link>
                    )}
                    {detail.comparativeSheetId && (
                      <Link to={`/custom-sheets/${detail.comparativeSheetId}`}>
                        <Button>Master BOQ compare</Button>
                      </Link>
                    )}
                  </div>
                </div>

                {detail.summary?.grandTotals && Object.keys(detail.summary.grandTotals).length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-xs font-mono uppercase text-steel-muted mb-2">Comparative statement (R2 summary tab)</h4>
                    <ComparativeStatementPanel
                      summary={detail.summary}
                      summarySheetId={detail.summarySheetId}
                      masterSheetId={detail.comparativeSheetId}
                    />
                  </div>
                )}

                {detail.notes && (
                  <p className="text-xs text-steel-muted mb-3 border-l-2 border-brand pl-2">{detail.notes}</p>
                )}

                <div className="mb-4 p-3 border border-dashed border-line rounded-xl">
                  <p className="text-xs font-mono uppercase text-steel-muted mb-2">Add discipline BOQ slots</p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {disciplines
                      .filter((d) => !(detail.disciplines || []).some((x) => x.key === d.key))
                      .map((d) => (
                        <label key={d.key} className="flex items-center gap-1 text-xs border rounded-lg px-2 py-1">
                          <input
                            type="checkbox"
                            checked={addDiscKeys.includes(d.key)}
                            onChange={(e) =>
                              setAddDiscKeys((prev) =>
                                e.target.checked ? [...prev, d.key] : prev.filter((x) => x !== d.key)
                              )
                            }
                          />
                          {d.label}
                        </label>
                      ))}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="!text-xs"
                    disabled={!addDiscKeys.length || busy}
                    onClick={() => void addDisciplinesToPackage()}
                  >
                    Add selected disciplines to package
                  </Button>
                </div>

                <h4 className="text-xs font-mono uppercase text-steel-muted mb-2">Vendor × discipline BOQ uploads</h4>
                <div className="space-y-4">
                  {vendorMatrix.map(({ vendorLabel, slots }) => (
                    <div key={vendorLabel} className="border border-line rounded-xl overflow-hidden">
                      <div className="px-3 py-2 bg-sand/50 font-semibold text-sm">{vendorLabel}</div>
                      <ul className="divide-y">
                        {slots.map(({ discipline, slot }) => (
                          <li key={discipline.key} className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                            <div className="min-w-0">
                              <div className="font-medium">{discipline.label}</div>
                              <div className="text-[10px] text-steel-muted font-mono">{discipline.sheetName}</div>
                              {slot?.fileName ? (
                                <div className="text-xs text-steel-muted truncate">
                                  {slot.fileName}
                                  {slot.sharePointUrl && (
                                    <>
                                      {" · "}
                                      <a
                                        href={slot.sharePointUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-brand font-semibold"
                                      >
                                        SharePoint
                                      </a>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <div className="text-xs text-warn">Not uploaded</div>
                              )}
                            </div>
                            <div className="flex gap-2 shrink-0">
                              {slot?.sheetId && (
                                <Link to={`/custom-sheets/${slot.sheetId}`}>
                                  <Button variant="secondary" className="!text-xs !py-1">
                                    View
                                  </Button>
                                </Link>
                              )}
                              {slot && (
                                <Button
                                  variant="secondary"
                                  className="!text-xs !py-1"
                                  onClick={() => {
                                    setUploadSlot(slot);
                                    setUploadFile(null);
                                  }}
                                >
                                  {slot.fileName ? "Replace" : "Upload"}
                                </Button>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </Card>

              {uploadSlot && (
                <Card>
                  <h4 className="font-semibold text-sm mb-1">Upload discipline BOQ</h4>
                  <p className="text-xs text-steel-muted mb-3">
                    {uploadSlot.vendorLabel} · {disciplineLabel(disciplines, uploadSlot.discipline)} — use the matching sheet
                    from the R2 workbook or a discipline-only export.
                  </p>
                  <form className="space-y-3" onSubmit={uploadBoq}>
                    <FilePickButton accept=".xlsx,.xls,.csv" onPick={(files) => setUploadFile(files[0] || null)}>
                      {uploadFile ? uploadFile.name : "Choose Excel BOQ"}
                    </FilePickButton>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={!uploadFile || busy}>
                        Upload
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setUploadSlot(null);
                          setUploadFile(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <p className="text-sm text-steel-muted">
                Select a bid package. Each vendor uploads one Excel per discipline (CCV, Electrical Lab, Admin, Security, etc.) —
                same structure as Comparative Statement R2.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
