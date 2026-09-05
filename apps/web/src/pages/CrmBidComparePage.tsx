import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, Select } from "../components/ui";
import { FilePickButton } from "../components/FilePickButton";
import { CrmComparativeRegister } from "../components/CrmComparativeRegister";
import { CrmBidVendorMatrix } from "../components/CrmBidVendorMatrix";
import { vendorMatchesBidDisciplines } from "../lib/crmBidDisciplines";
import { CrmBidBoqRegister } from "../components/CrmBidBoqRegister";
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
  projectId?: string | null;
  leadId?: string | null;
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
  const { id: routePkgId } = useParams();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const setupProjectId = searchParams.get("projectId") || "";
  const setupLeadId = searchParams.get("leadId") || "";

  const [packages, setPackages] = useState<BidPackage[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [projects, setProjects] = useState<{ id: string; code: string; name: string }[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(routePkgId || null);
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
  const [addVendorIds, setAddVendorIds] = useState<string[]>([]);
  const [deskFilter, setDeskFilter] = useState<"converted" | "all">("converted");
  const [activeDiscipline, setActiveDiscipline] = useState<string>("all");
  const [showSetup, setShowSetup] = useState(true);
  const [dueDate, setDueDate] = useState("");

  const convertedLeads = useMemo(() => leads.filter((l) => l.projectId), [leads]);
  const convertedProjectIds = useMemo(
    () => new Set(convertedLeads.map((l) => l.projectId).filter(Boolean) as string[]),
    [convertedLeads],
  );
  const convertedProjects = useMemo(
    () => projects.filter((p) => convertedProjectIds.has(p.id)),
    [projects, convertedProjectIds],
  );
  const packagesForDesk = useMemo(() => {
    if (deskFilter === "all") return packages;
    return packages.filter((p) => {
      const pid = p.project?.id || p.projectId;
      return pid && convertedProjectIds.has(pid);
    });
  }, [packages, deskFilter, convertedProjectIds]);
  const pendingBidSetup = useMemo(
    () =>
      convertedLeads.filter((l) => {
        const linked = packages.some((p) => p.lead?.id === l.id || p.leadId === l.id);
        return !linked;
      }),
    [convertedLeads, packages],
  );

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
    if (routePkgId) setSelectedId(routePkgId);
  }, [routePkgId]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  function selectPackage(id: string) {
    setSelectedId(id);
    setShowSetup(false);
    setActiveDiscipline("all");
    nav(`/crm/bids/${id}`, { replace: true });
  }

  async function recomputeComparative() {
    if (!selectedId) return;
    setBusy(true);
    setMsg("");
    try {
      await api(`/api/crm/bid-packages/${selectedId}/recompute`, { method: "POST", token });
      setMsg("Comparative statement refreshed from all vendor BOQs.");
      await loadDetail(selectedId);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Recompute failed");
    } finally {
      setBusy(false);
    }
  }

  async function simulateR2Boqs() {
    if (!selectedId) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await api<{ uploaded: number; total: number }>(`/api/crm/bid-packages/${selectedId}/seed-r2-boqs`, {
        method: "POST",
        token,
        body: JSON.stringify({ force: true }),
      });
      setMsg(`Simulated vendor BOQ uploads from R2 template: ${r.uploaded}/${r.total} disciplines filled.`);
      await loadDetail(selectedId);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Simulate failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (disciplines.length && !form.disciplineKeys.length) {
      setForm((f) => ({ ...f, disciplineKeys: disciplines.map((d) => d.key) }));
    }
  }, [disciplines, form.disciplineKeys.length]);

  useEffect(() => {
    if (!setupProjectId && !setupLeadId) return;
    const project = projects.find((p) => p.id === setupProjectId);
    setForm((f) => ({
      ...f,
      projectId: setupProjectId || f.projectId,
      leadId: setupLeadId || f.leadId,
      title: f.title || (project ? `${project.name} — comparative bid` : f.title),
    }));
    if (setupProjectId && !routePkgId) {
      setMsg("New project linked — select contractors and disciplines, then create the bid package.");
    }
  }, [setupProjectId, setupLeadId, projects, routePkgId]);

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

  const allBidders = useMemo(
    () => vendors.filter((v) => vendorMatchesBidDisciplines(v, form.disciplineKeys)),
    [vendors, form.disciplineKeys],
  );

  const detailDisciplines = detail?.disciplines || disciplines;
  const matrixDisciplines = useMemo(() => {
    if (activeDiscipline === "all") return detailDisciplines;
    return detailDisciplines.filter((d) => d.key === activeDiscipline);
  }, [detailDisciplines, activeDiscipline]);

  const vendorMatrix = useMemo(() => {
    if (!detail?.vendorBoqs?.length) return [];
    const vendorNames = [...new Set(detail.vendorBoqs.map((b) => b.vendorLabel))];
    const discList = matrixDisciplines.length ? matrixDisciplines : detailDisciplines;
    return vendorNames.map((vendorLabel) => ({
      vendorLabel,
      slots: discList.map((d) => {
        const slot = detail.vendorBoqs!.find((b) => b.vendorLabel === vendorLabel && b.discipline === d.key);
        return { discipline: d, slot };
      }),
    }));
  }, [detail, detailDisciplines, matrixDisciplines]);

  async function openBidPackage() {
    if (!selectedId) return;
    setBusy(true);
    setMsg("");
    try {
      const out = await api<{ package: BidPackage; notify: { notified: number; total: number } }>(
        `/api/crm/bid-packages/${selectedId}/open`,
        {
          method: "POST",
          token,
          body: JSON.stringify({ dueDate: dueDate || undefined }),
        },
      );
      setMsg(
        `Bid opened — emailed ${out.notify.notified}/${out.notify.total} bidder(s). They can upload BOQs at /crm/vendor-bids.`,
      );
      await loadDetail(selectedId);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Open bid failed");
    } finally {
      setBusy(false);
    }
  }

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
          dueDate: dueDate || undefined,
          vendorNames,
          disciplineKeys: form.disciplineKeys,
          customDisciplines: form.customDisciplines,
        }),
      });
      setMsg(
        `Bid package created (Draft) — ${row.uploadProgress?.total || form.disciplineKeys.length * vendorNames.length} BOQ slots. Open the bid to email bidders.`,
      );
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
      selectPackage(row.id);
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
      setAddDiscKeys([]);
      setMsg("Discipline BOQ slots added for all bidders on this package.");
      await loadDetail(selectedId);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Add disciplines failed");
    } finally {
      setBusy(false);
    }
  }

  const packageVendorNames = useMemo(
    () => [...new Set(detail?.vendorBoqs?.map((b) => b.vendorLabel) || [])],
    [detail],
  );

  const vendorsNotOnPackage = useMemo(
    () =>
      vendors.filter(
        (v) =>
          !packageVendorNames.includes(v.name) &&
          (v.partyType === "Contractor" || v.partyType === "Vendor" || !v.partyType),
      ),
    [vendors, packageVendorNames],
  );

  async function addVendorsToPackage() {
    if (!selectedId || !addVendorIds.length) return;
    setBusy(true);
    setMsg("");
    try {
      const out = await api<{ added: string[]; notify: { notified: number; total: number } | null }>(
        `/api/crm/bid-packages/${selectedId}/vendors`,
        {
          method: "POST",
          token,
          body: JSON.stringify({ vendorIds: addVendorIds, createLogins: true }),
        },
      );
      setAddVendorIds([]);
      const notifyPart =
        out.notify != null ? ` · emailed ${out.notify.notified}/${out.notify.total} new bidder(s)` : "";
      setMsg(`Added ${out.added.join(", ")}${notifyPart}. Portal logins created when email is on file.`);
      await loadDetail(selectedId);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Add bidders failed");
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

  async function awardVendor(vendorLabel: string) {
    if (!selectedId) return;
    if (!window.confirm(`Award "${vendorLabel}" as the successful bidder for "${detail?.title}"? The comparative is locked and the package status moves to "Awarded".`)) return;
    setBusy(true);
    setMsg("");
    try {
      await api(`/api/crm/bid-packages/${selectedId}/award`, {
        method: "POST",
        token,
        body: JSON.stringify({ vendorLabel }),
      });
      setMsg(`Awarded to ${vendorLabel}. Package locked.`);
      await loadDetail(selectedId);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Award failed");
    } finally {
      setBusy(false);
    }
  }

  function copyVendorLink(vendorLabel: string) {
    const link = `${window.location.origin}/crm/vendor-bids?pkg=${encodeURIComponent(selectedId || "")}`;
    void navigator.clipboard?.writeText(link).then(
      () => setMsg(`Vendor upload link copied — send to ${vendorLabel}.`),
      () => setMsg(`Copy failed. Share manually: ${link}`)
    );
  }

  const uploadedPct = detail?.uploadProgress
    ? Math.round((100 * (detail.uploadProgress.done || 0)) / Math.max(1, detail.uploadProgress.total || 0))
    : 0;

  const vendorTotals = useMemo(() => {
    if (!detail?.summary?.grandTotals) return [] as { label: string; total: number; isLowest: boolean }[];
    return Object.entries(detail.summary.grandTotals)
      .map(([label, total]) => ({ label, total: Number(total || 0), isLowest: label === detail.summary!.lowestVendor }))
      .sort((a, b) => a.total - b.total);
  }, [detail]);

  if (!canManage) {
    return (
      <Card>
        <p className="text-sm text-steel-muted">Comparative bid analysis is available to Office / Admin only.</p>
        <Link to="/crm/leads" className="text-sm text-brand font-semibold mt-2 inline-block">
          ← Back to CRM
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-wrap gap-2 shrink-0">
        <Link to="/crm/leads">
          <Button variant="secondary">← Leads</Button>
        </Link>
        <Link to="/crm/proposals/new">
          <Button variant="secondary">New PMC proposal</Button>
        </Link>
        <Link to="/crm/directory/vendors">
          <Button variant="secondary">Bidder directory</Button>
        </Link>
        <Button
          variant="secondary"
          type="button"
          onClick={() => void downloadAuthFile("/api/crm/template.xlsx", token, "Comparative-Statement-R2.xlsx")}
        >
          Download R2 .xlsx
        </Button>
      </div>

      {msg && <p className="text-sm text-ok shrink-0">{msg}</p>}

      {pendingBidSetup.length > 0 && deskFilter === "converted" && !routePkgId && (
        <Card className="!p-4 border-amber-200 bg-amber-50/60">
          <h3 className="font-semibold text-sm mb-2">Converted leads — bid setup pending ({pendingBidSetup.length})</h3>
          <p className="text-xs text-steel-muted mb-3">
            These SPDC projects were created from CRM leads but do not have a comparative bid package yet.
          </p>
          <ul className="divide-y border rounded-xl bg-white/80 max-h-48 overflow-y-auto">
            {pendingBidSetup.slice(0, 12).map((l) => (
              <li key={l.id} className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium line-clamp-1">{l.title}</span>
                <button
                  type="button"
                  className="text-xs font-semibold text-brand shrink-0"
                  onClick={() => {
                    setForm((f) => ({
                      ...f,
                      projectId: l.projectId || "",
                      leadId: l.id,
                      title: f.title || `${l.title} — comparative bid`,
                    }));
                    setMsg(`Select contractors and disciplines for ${l.title}, then create the bid package.`);
                  }}
                >
                  Setup bids →
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 items-center shrink-0">
        <Button
          variant={deskFilter === "converted" ? "primary" : "secondary"}
          type="button"
          onClick={() => setDeskFilter("converted")}
        >
          Converted projects ({packagesForDesk.length})
        </Button>
        <Button
          variant={deskFilter === "all" ? "primary" : "secondary"}
          type="button"
          onClick={() => setDeskFilter("all")}
        >
          All packages ({packages.length})
        </Button>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-4">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-sm">Setup new bid (R2 template)</h3>
            <Button type="button" variant="secondary" className="!text-xs" onClick={() => setShowSetup((v) => !v)}>
              {showSetup ? "Hide setup" : "Show setup"}
            </Button>
          </div>
          {showSetup && (
          <Card>
            <h3 className="font-semibold text-sm mb-1">1 · Project & package</h3>
            <p className="text-xs text-steel-muted mb-3">Comparative Statement R2 — summary + discipline BOQ tabs (CCV, Electrical Lab, Admin, …)</p>
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
                {convertedProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.name}
                  </option>
                ))}
                {deskFilter === "all" &&
                  projects
                    .filter((p) => !convertedProjectIds.has(p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} · {p.name} (non-CRM)
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
                {convertedLeads.map((l) => (
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
              <Input
                type="date"
                placeholder="Bid due date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              <div>
                <p className="text-xs font-mono uppercase text-steel-muted mb-1">
                  2 · Discipline BOQ sheets ({form.disciplineKeys.length} selected)
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
                <p className="text-xs font-mono uppercase text-steel-muted mb-1">3 · Bidders to compare (min 2)</p>
                <p className="text-[10px] text-steel-muted mb-1">Contractors and vendors are both bidders — same R2 comparative flow.</p>
                <div className="max-h-44 overflow-y-auto border rounded-xl p-2 space-y-1">
                  {allBidders.map((v) => (
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
                      {v.partyType && v.partyType !== "Vendor" && (
                        <span className="text-[10px] text-steel-muted">· {v.partyType}</span>
                      )}
                    </label>
                  ))}
                  {!allBidders.length && (
                    <p className="text-xs text-steel-muted">No bidders tagged for selected disciplines — add in Master → Vendors.</p>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-steel-muted">
                Creates {form.disciplineKeys.length || 0} discipline slot(s) per bidder from{" "}
                <strong>Comparative Statement - R2.xlsx</strong>. After create, click <strong>Open bid & notify</strong> to email bidders.
              </p>
              <Button type="submit" disabled={busy}>
                {busy ? "Creating…" : "Create draft package"}
              </Button>
            </form>
          </Card>
          )}

          <Card padding={false}>
            <div className="px-4 py-3 border-b bg-sand/40 font-semibold text-sm flex items-center justify-between">
              <span>Bid packages ({packagesForDesk.length})</span>
              {packagesForDesk.length > 0 && (
                <span className="text-[10px] text-steel-muted font-normal">
                  {packagesForDesk.reduce((s, p) => s + (p.uploadProgress?.done || 0), 0)}/
                  {packagesForDesk.reduce((s, p) => s + (p.uploadProgress?.total || 0), 0)} BOQs in
                </span>
              )}
            </div>
            <ul className="divide-y">
              {packagesForDesk.map((p) => {
                const pct = p.uploadProgress
                  ? Math.round((100 * (p.uploadProgress.done || 0)) / Math.max(1, p.uploadProgress.total || 0))
                  : 0;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={`w-full text-left px-4 py-3 hover:bg-brand-soft/40 ${selectedId === p.id ? "bg-brand-soft/60" : ""}`}
                      onClick={() => selectPackage(p.id)}
                    >
                      <div className="font-medium text-sm flex items-center gap-2">
                        <span className="truncate">{p.title}</span>
                        {p.status === "Awarded" && <Badge tone="ok">Awarded</Badge>}
                        {p.status === "Draft" && <Badge tone="warn">Draft</Badge>}
                        {p.status === "Evaluation" && <Badge tone="brand">Evaluation</Badge>}
                      </div>
                      <div className="text-xs text-steel-muted mt-0.5">
                        {p.project?.code ? `${p.project.code} · ` : ""}
                        {p.revisionLabel} · {p.status}
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-line overflow-hidden">
                        <div
                          className={`h-full ${pct === 100 ? "bg-ok" : "bg-brand"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-steel-muted mt-0.5">
                        BOQs {p.uploadProgress?.done ?? 0} / {p.uploadProgress?.total ?? 0}
                        {pct === 100 ? " · ready to compare" : pct > 0 ? " · in progress" : " · awaiting uploads"}
                      </div>
                    </button>
                  </li>
                );
              })}
              {!packages.length && (
                <li className="px-4 py-8 text-sm text-steel-muted text-center space-y-3">
                  <div className="text-4xl">📊</div>
                  <p className="font-semibold text-ink">No bid packages yet.</p>
                  <p className="text-xs">
                    Fill the form on the left to create your first bid package, then invite vendors to upload discipline BOQs.
                  </p>
                </li>
              )}
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
                    {(detail.status === "Draft" || detail.status === "Open") && (
                      <Button type="button" disabled={busy} onClick={() => void openBidPackage()}>
                        {detail.status === "Draft" ? "Open bid & notify bidders" : "Resend bid invites"}
                      </Button>
                    )}
                    {detail.comparativeSharePointUrl && (
                      <a href={detail.comparativeSharePointUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="secondary">R2 SharePoint</Button>
                      </a>
                    )}
                    <Button type="button" variant="secondary" disabled={busy} onClick={() => void recomputeComparative()}>
                      Refresh comparative
                    </Button>
                    {canManage && (
                      <Button type="button" variant="secondary" disabled={busy} onClick={() => void simulateR2Boqs()}>
                        Simulate R2 BOQ uploads
                      </Button>
                    )}
                  </div>
                </div>

                {/* Package progress meter — visible at a glance so PMC knows
                    what's still missing before the comparison can be locked. */}
                {detail.uploadProgress && (
                  <div className="mb-4 p-3 border border-line rounded-xl bg-paper">
                    <div className="flex items-center justify-between mb-1.5 text-xs">
                      <span className="font-semibold uppercase text-steel-muted">
                        Vendor BOQ upload progress
                      </span>
                      <span className={`font-mono font-semibold ${uploadedPct === 100 ? "text-ok" : "text-brand"}`}>
                        {detail.uploadProgress.done}/{detail.uploadProgress.total} · {uploadedPct}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-line overflow-hidden">
                      <div
                        className={`h-full transition-all ${uploadedPct === 100 ? "bg-ok" : "bg-brand"}`}
                        style={{ width: `${uploadedPct}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-steel-muted mt-1.5">
                      {uploadedPct === 100
                        ? "All slots filled — comparative statement is ready to lock and award."
                        : `Send the per-vendor upload link from the matrix below to speed up the remaining ${detail.uploadProgress.total - detail.uploadProgress.done} slot(s).`}
                    </p>
                  </div>
                )}

                {detail.summary?.grandTotals && Object.keys(detail.summary.grandTotals).length > 0 && (
                  <div className="mb-4 space-y-3">
                    <CrmComparativeRegister
                      summary={detail.summary}
                      summarySheetId={detail.summarySheetId}
                      masterSheetId={detail.comparativeSheetId}
                      revisionLabel={detail.revisionLabel}
                    />

                    {vendorTotals.length > 1 && detail.status !== "Awarded" && (
                      <div className="p-3 border border-brand/30 rounded-xl bg-brand-soft/30">
                        <p className="text-xs font-mono uppercase text-steel-muted mb-2">Award recommendation</p>
                        <div className="flex flex-wrap gap-2 items-center">
                          {vendorTotals.map((v) => (
                            <div key={v.label} className="flex items-center gap-1.5">
                              <span className={`text-xs px-2 py-1 rounded-full border ${v.isLowest ? "bg-ok text-white border-ok" : "border-line text-steel-muted"}`}>
                                {v.label} · {formatINR(v.total)} {v.isLowest && "· L1"}
                              </span>
                              <Button
                                type="button"
                                variant={v.isLowest ? "primary" : "secondary"}
                                className="!text-xs !py-1"
                                disabled={busy}
                                onClick={() => void awardVendor(v.label)}
                              >
                                Award
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {detail.notes && (
                  <p className="text-xs text-steel-muted mb-3 border-l-2 border-brand pl-2">{detail.notes}</p>
                )}

                <div className="mb-4 p-3 border border-dashed border-line rounded-xl space-y-4">
                  <div>
                    <p className="text-xs font-mono uppercase text-steel-muted mb-2">Add bidders (after deploy)</p>
                    <p className="text-[11px] text-steel-muted mb-2">
                      Pick from{" "}
                      <Link to="/crm/directory/vendors" className="text-brand font-semibold">
                        CRM vendor directory
                      </Link>
                      . If the bid is already Open, new bidders are emailed and get portal logins when email is set.
                    </p>
                    <div className="flex flex-wrap gap-2 mb-2 max-h-28 overflow-y-auto">
                      {vendorsNotOnPackage.map((v) => (
                        <label key={v.id} className="flex items-center gap-1 text-xs border rounded-lg px-2 py-1 bg-paper">
                          <input
                            type="checkbox"
                            checked={addVendorIds.includes(v.id)}
                            onChange={(e) =>
                              setAddVendorIds((prev) =>
                                e.target.checked ? [...prev, v.id] : prev.filter((x) => x !== v.id),
                              )
                            }
                          />
                          {v.name}
                        </label>
                      ))}
                      {!vendorsNotOnPackage.length && (
                        <span className="text-xs text-steel-muted">All directory vendors are already on this package.</span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="!text-xs"
                      disabled={!addVendorIds.length || busy}
                      onClick={() => void addVendorsToPackage()}
                    >
                      Add selected bidders
                    </Button>
                  </div>

                  <div className="border-t border-line pt-3">
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
                </div>

                {vendorMatrix.length > 0 && (
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-1 mb-3" role="tablist" aria-label="Discipline BOQ">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={activeDiscipline === "all"}
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium border ${
                          activeDiscipline === "all" ? "bg-procore-navy text-white border-procore-navy" : "bg-paper border-line"
                        }`}
                        onClick={() => setActiveDiscipline("all")}
                      >
                        All disciplines
                      </button>
                      {detailDisciplines.map((d) => (
                        <button
                          key={d.key}
                          type="button"
                          role="tab"
                          aria-selected={activeDiscipline === d.key}
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium border max-w-[180px] truncate ${
                            activeDiscipline === d.key ? "bg-procore-navy text-white border-procore-navy" : "bg-paper border-line"
                          }`}
                          onClick={() => setActiveDiscipline(d.key)}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                    <CrmBidVendorMatrix
                      disciplines={matrixDisciplines.length ? matrixDisciplines : detailDisciplines}
                      vendorMatrix={vendorMatrix}
                      grandTotals={detail.summary?.grandTotals}
                      lowestVendor={detail.summary?.lowestVendor}
                      onOpenSlot={(slot) => setUploadSlot(slot)}
                      onUploadSlot={(slot) => {
                        setUploadSlot(slot);
                        setUploadFile(null);
                      }}
                    />
                  </div>
                )}

                <h4 className="text-xs font-mono uppercase text-steel-muted mb-2">Vendor upload links & file detail</h4>
                <div className="space-y-4">
                  {vendorMatrix.map(({ vendorLabel, slots }) => (
                    <div key={vendorLabel} className="border border-line rounded-xl overflow-hidden">
                      <div className="px-3 py-2 bg-sand/50 font-semibold text-sm flex items-center justify-between">
                        <span>{vendorLabel}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          className="!text-[10px] !py-0.5"
                          onClick={() => copyVendorLink(vendorLabel)}
                        >
                          📋 Copy upload link
                        </Button>
                      </div>
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
                                <Button
                                  variant="secondary"
                                  className="!text-xs !py-1"
                                  type="button"
                                  onClick={() => setUploadSlot(slot)}
                                >
                                  {slot.fileName ? "View / edit BOQ" : "Fill BOQ"}
                                </Button>
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

              {uploadSlot && selectedId && uploadSlot.sheetId && (
                <CrmBidBoqRegister
                  token={token!}
                  sheetId={uploadSlot.sheetId}
                  bidPackageId={selectedId}
                  slotId={uploadSlot.id}
                  title={`${uploadSlot.vendorLabel} — ${disciplineLabel(disciplines, uploadSlot.discipline)}`}
                  sheetLabel={disciplineLabel(disciplines, uploadSlot.discipline)}
                  canEdit={canManage}
                  onSaved={() => {
                    void loadDetail(selectedId);
                    void load();
                  }}
                  onClose={() => {
                    setUploadSlot(null);
                    setUploadFile(null);
                  }}
                />
              )}

              {uploadSlot && (
                <Card>
                  <h4 className="font-semibold text-sm mb-1">Upload Excel BOQ (optional)</h4>
                  <p className="text-xs text-steel-muted mb-3">
                    {uploadSlot.vendorLabel} · {disciplineLabel(disciplines, uploadSlot.discipline)} — matching R2 discipline sheet.
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
                        Close
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
