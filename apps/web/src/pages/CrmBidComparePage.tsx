import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Button, Card, Input, Select } from "../components/ui";
import { SearchableCheckboxList } from "../components/SearchableCheckboxList";
import { CrmBidCompareDesk } from "../components/CrmBidCompareDesk";
import { ActionReasonDialog, actionReasonFromError, type ActionReason } from "../components/ActionReasonDialog";
import { isVendorOrContractor } from "../lib/vendorTypes";

type Discipline = { key: string; label: string; sheetName: string };

type VendorBoqSlot = {
  id: string;
  vendorLabel: string;
  discipline: string;
  fileName?: string | null;
  uploadedAt?: string | null;
  sharePointUrl?: string | null;
  sheetId?: string | null;
  vendor?: { id?: string; name?: string; email?: string | null } | null;
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
  dueDate?: string | null;
  awardedVendorId?: string | null;
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
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [slotPanel, setSlotPanel] = useState<{ slot: VendorBoqSlot; tab: "edit" | "upload" } | null>(null);
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
  const [showNewBidForm, setShowNewBidForm] = useState(false);
  const [projectVendorIds, setProjectVendorIds] = useState<string[]>([]);
  const [disciplineSource, setDisciplineSource] = useState<"saved" | "work_packages" | "default" | "">("");
  const [dueDate, setDueDate] = useState("");
  const [accessSlip, setAccessSlip] = useState<{ vendor: string; email: string; tempPassword: string }[]>([]);
  const [actionError, setActionError] = useState<ActionReason | null>(null);
  const [mainTab, setMainTab] = useState<"overview" | "comparative" | "matrix" | "manage">("overview");
  const [pkgFilter, setPkgFilter] = useState("");

  function showActionError(title: string, err: unknown) {
    const reason = actionReasonFromError(title, err);
    setActionError(reason);
    setMsg(reason.message);
  }

  function showActionNeed(title: string, message: string) {
    setActionError({ title, message });
    setMsg(message);
  }

  const packagesForDesk = useMemo(() => {
    if (!setupProjectId) return packages;
    return packages.filter((p) => (p.project?.id || p.projectId) === setupProjectId);
  }, [packages, setupProjectId]);

  const filteredPackages = useMemo(() => {
    const q = pkgFilter.trim().toLowerCase();
    if (!q) return packagesForDesk;
    return packagesForDesk.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.project?.code || "").toLowerCase().includes(q) ||
        p.status.toLowerCase().includes(q)
    );
  }, [packagesForDesk, pkgFilter]);

  const workflowStep = useMemo(() => {
    if (!setupProjectId) return 0;
    if (!detail) return 1;
    if (detail.status === "Draft") return 2;
    const done = detail.uploadProgress?.done ?? 0;
    const total = detail.uploadProgress?.total ?? 0;
    const pct = total ? Math.round((100 * done) / total) : 0;
    if (pct < 100) return 3;
    const hasCompare =
      detail.summary?.grandTotals && Object.keys(detail.summary.grandTotals).length > 0;
    if (!hasCompare) return 4;
    if (detail.status === "Awarded") return 6;
    return 5;
  }, [setupProjectId, detail]);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === setupProjectId),
    [projects, setupProjectId]
  );

  const load = useCallback(async () => {
    if (!canManage) return;
    const [pkgs, l, p, v] = await Promise.all([
      api<BidPackage[]>(`/api/crm/bid-packages${setupProjectId ? `?projectId=${encodeURIComponent(setupProjectId)}` : ""}`, { token }).catch(() => []),
      api<any[]>("/api/crm/leads", { token }).catch(() => []),
      api<{ id: string; code: string; name: string }[]>("/api/projects", { token }).catch(() => []),
      api<any[]>("/api/vendors", { token }).catch(() => []),
    ]);
    setPackages(pkgs);
    setLeads(l);
    setProjects(p);
    setVendors(v);
  }, [token, canManage, setupProjectId]);

  const loadDetail = useCallback(
    async (id: string) => {
      try {
        const row = await api<BidPackage>(`/api/crm/bid-packages/${id}`, { token });
        setDetail(row);
        if (row.disciplines?.length) setDisciplines(row.disciplines);
      } catch (err) {
        setDetail(null);
        setSelectedId(null);
        setMsg(err instanceof Error ? err.message : "Bid package not found");
        const q = setupProjectId ? `?projectId=${encodeURIComponent(setupProjectId)}` : "";
        nav(`/crm/bids${q}`, { replace: true });
      }
    },
    [token, nav, setupProjectId],
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
    setShowNewBidForm(false);
    setSlotPanel(null);
    setUploadFile(null);
    setMainTab("overview");
    const q = setupProjectId ? `?projectId=${encodeURIComponent(setupProjectId)}` : "";
    nav(`/crm/bids/${id}${q}`, { replace: true });
  }

  function openNewBidSetup(prefill?: Partial<typeof form>) {
    setSelectedId(null);
    setDetail(null);
    setShowNewBidForm(true);
    const pid = prefill?.projectId || setupProjectId;
    setSlotPanel(null);
    setUploadFile(null);
    setMsg("");
    setForm({
      title: "",
      leadId: "",
      revisionLabel: "R2",
      vendorIds: [],
      disciplineKeys: [],
      customDisciplines: [],
      ...prefill,
      projectId: pid || "",
    });
    const q = pid ? `?projectId=${encodeURIComponent(pid)}` : "";
    nav(`/crm/bids${q}`, { replace: true });
  }

  function openSlotPanel(slot: VendorBoqSlot, tab: "edit" | "upload") {
    setMainTab("matrix");
    setSlotPanel({ slot, tab });
    if (tab === "upload") setUploadFile(null);
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
      showActionError("Comparative did not refresh", err);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!setupProjectId && !setupLeadId) return;
    const project = projects.find((p) => p.id === setupProjectId);
    setForm((f) => ({
      ...f,
      projectId: setupProjectId || f.projectId,
      leadId: setupLeadId || f.leadId,
      title: f.title || (project ? `${project.name} — comparative bid` : f.title),
    }));
  }, [setupProjectId, setupLeadId, projects]);

  useEffect(() => {
    const pid = form.projectId || setupProjectId;
    if (!pid || !token) return;
    void api<{ vendorId?: string; vendor?: { id?: string; partyType?: string; email?: string | null } }[]>(
      `/api/vendors/project/${pid}`,
      { token }
    )
      .then((rows) => {
        const ids = rows
          .filter((r) => {
            const party = r.vendor?.partyType || "";
            return party === "Contractor" || party === "Vendor";
          })
          .map((r) => r.vendorId || r.vendor?.id || "")
          .filter(Boolean);
        setProjectVendorIds(ids);
        if (ids.length) {
          setForm((f) => ({ ...f, vendorIds: ids }));
        }
      })
      .catch(() => {
        setProjectVendorIds([]);
      });
  }, [form.projectId, setupProjectId, token]);

  useEffect(() => {
    if (!form.projectId || !canManage) return;
    void api<{ disciplines: Discipline[]; source?: "saved" | "work_packages" | "default" }>(
      `/api/projects/${form.projectId}/bid-disciplines`,
      { token }
    )
      .then((r) => {
        setDisciplineSource(r.source || "default");
        if (r.disciplines?.length) {
          setDisciplines(r.disciplines);
          setForm((f) => ({ ...f, disciplineKeys: r.disciplines.map((d) => d.key) }));
        } else {
          setDisciplines([]);
          setForm((f) => ({ ...f, disciplineKeys: [] }));
        }
      })
      .catch(() => {});
  }, [form.projectId, token, canManage]);

  const selectableVendors = useMemo(() => {
    const base = vendors.filter((v) => isVendorOrContractor(v.partyType));
    if (!projectVendorIds.length) return [...base].sort((a, b) => a.name.localeCompare(b.name));
    const onProject = new Set(projectVendorIds);
    return [...base].sort((a, b) => {
      const aOn = onProject.has(a.id) ? 0 : 1;
      const bOn = onProject.has(b.id) ? 0 : 1;
      return aOn - bOn || a.name.localeCompare(b.name);
    });
  }, [vendors, projectVendorIds]);

  const bidderItems = useMemo(
    () =>
      selectableVendors.map((v) => ({
        id: v.id,
        label: v.name,
        sublabel: projectVendorIds.includes(v.id) ? `${v.partyType || "Vendor"} · assigned on project` : v.partyType,
        trade: v.trade,
      })),
    [selectableVendors, projectVendorIds],
  );

  const detailDisciplines = detail?.disciplines || disciplines;

  const vendorMatrix = useMemo(() => {
    if (!detail?.vendorBoqs?.length) return [];
    const vendorNames = [...new Set(detail.vendorBoqs.map((b) => b.vendorLabel))];
    const discList = detailDisciplines;
    return vendorNames.map((vendorLabel) => ({
      vendorLabel,
      slots: discList.map((d) => {
        const slot = detail.vendorBoqs!.find((b) => b.vendorLabel === vendorLabel && b.discipline === d.key);
        return { discipline: d, slot };
      }),
    }));
  }, [detail, detailDisciplines]);

  const summaryVendorGap = useMemo(() => {
    const summaryLabels = detail?.summary?.vendorLabels || [];
    if (!summaryLabels.length) return null;
    const slotLabels = new Set(detail?.vendorBoqs?.map((b) => b.vendorLabel) || []);
    const inSummaryOnly = summaryLabels.filter((v) => !slotLabels.has(v));
    const inSlotsOnly = [...slotLabels].filter((v) => !summaryLabels.includes(v));
    if (!inSummaryOnly.length && !inSlotsOnly.length) return null;
    return { inSummaryOnly, inSlotsOnly };
  }, [detail]);

  async function openBidPackage() {
    if (!selectedId) return;
    setBusy(true);
    setMsg("");
    try {
      const out = await api<{
        package: BidPackage;
        notify: {
          notified: number;
          total: number;
          missingEmail?: string[];
          accessSlips?: { vendor: string; email: string; tempPassword: string }[];
        };
      }>(`/api/crm/bid-packages/${selectedId}/open`, {
        method: "POST",
        token,
        body: JSON.stringify({ dueDate: dueDate || undefined, createLogins: true }),
      });
      const missing = out.notify.missingEmail?.length
        ? ` Missing email: ${out.notify.missingEmail.join(", ")}.`
        : "";
      const slips = (out.notify.accessSlips || [])
        .map((s) => `${s.vendor} · ${s.email} · ${s.tempPassword}`)
        .join(" | ");
      setAccessSlip(out.notify.accessSlips || []);
      setMsg(
        `Bid opened — emailed ${out.notify.notified}/${out.notify.total} bidder(s). They can upload BOQs at /crm/vendor-bids.${missing}${
          slips ? ` Access slip: ${slips}` : ""
        }`,
      );
      await loadDetail(selectedId);
      await load();
    } catch (err) {
      showActionError("Could not open this bid", err);
    } finally {
      setBusy(false);
    }
  }

  async function createPackage(e: FormEvent) {
    e.preventDefault();
    if (!form.projectId) {
      showActionNeed("Project required", "Pick a project first — bids are stored on that project.");
      return;
    }
    if (form.vendorIds.length < 1) {
      showActionNeed(
        "Select a vendor first",
        "Tick at least one vendor / contractor. After you create the package, Open bid emails them so they can upload BOQs from /login/vendor.",
      );
      return;
    }
    if (!form.disciplineKeys.length) {
      showActionNeed(
        "Work package required",
        "Pick a project with work packages on the project card (Civil, PEB, MEP, etc.). Those packages become the bid disciplines.",
      );
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
      await load();
      selectPackage(row.id);
      setShowNewBidForm(false);
      setMsg(`Bid package saved as Draft. Click Open bid when vendors should upload BOQs.`);
      await loadDetail(row.id);
      setForm({
        title: "",
        projectId: form.projectId,
        leadId: form.leadId,
        revisionLabel: "R2",
        vendorIds: [],
        disciplineKeys: [],
        customDisciplines: [],
      });
    } catch (err) {
      showActionError("Could not create the bid package", err);
    } finally {
      setBusy(false);
    }
  }

  async function addCustomDiscipline() {
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
    if (!selectedId) {
      showActionNeed("No bid selected", "Open a bid package first, then add discipline sheets.");
      return;
    }
    if (!addDiscKeys.length) {
      showActionNeed("Select a discipline first", "Tick the BOQ sheet you want to add for every vendor on this bid.");
      return;
    }
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
      showActionError("Could not add disciplines", err);
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
    if (!selectedId) {
      showActionNeed("No bid selected", "Open a bid package first, then add the vendor.");
      return;
    }
    if (!addVendorIds.length) {
      showActionNeed("Select a vendor first", "Tick the vendor / contractor you want on this bid, then add them.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const out = await api<{
        added: string[];
        notify: { notified: number; total: number } | null;
        draftLogins?: { vendor: string; email: string; tempPassword?: string }[];
      }>(
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
      const loginPart = out.draftLogins?.length
        ? ` · ${out.draftLogins.length} portal login(s) ready (see access slip)`
        : "";
      setMsg(`Added ${out.added.join(", ")}${notifyPart}${loginPart}. Portal logins created when email is on file.`);
      if (out.draftLogins?.length) {
        setAccessSlip(
          out.draftLogins.map((s) => ({
            vendor: s.vendor,
            email: s.email,
            tempPassword: s.tempPassword || "Demo@1234",
          })),
        );
      }
      await loadDetail(selectedId);
    } catch (err) {
      showActionError("Could not add bidders", err);
    } finally {
      setBusy(false);
    }
  }

  async function uploadBoq(e: FormEvent) {
    e.preventDefault();
    if (!uploadFile || !selectedId || !slotPanel) return;
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      await api(`/api/crm/bid-packages/${selectedId}/vendor-boq/${slotPanel.slot.id}`, {
        method: "POST",
        token,
        body: fd,
      });
      setMsg(
        `BOQ uploaded — ${slotPanel.slot.vendorLabel} / ${disciplineLabel(disciplines, slotPanel.slot.discipline)}`,
      );
      setUploadFile(null);
      setSlotPanel((prev) => (prev ? { ...prev, tab: "edit" } : null));
      await loadDetail(selectedId);
      await load();
    } catch (err) {
      showActionError("BOQ upload failed", err);
    } finally {
      setBusy(false);
    }
  }

  async function awardVendor(vendorLabel: string) {
    if (!selectedId) return;
    if (!window.confirm(`Award "${vendorLabel}" as the successful bidder for "${detail?.title}"? The comparative locks and that vendor can open the project desk (checklists, RFIs) — no clock-in.`)) return;
    setBusy(true);
    setMsg("");
    try {
      const vendorId = vendors.find((v) => v.name === vendorLabel)?.id;
      const out = await api<{ access?: { projectId?: string; email?: string; tempPassword?: string } }>(
        `/api/crm/bid-packages/${selectedId}/award`,
        {
          method: "POST",
          token,
          body: JSON.stringify({ vendorLabel, vendorId }),
        },
      );
      const slip = out.access?.email
        ? ` Vendor login ${out.access.email}${out.access.tempPassword ? ` · ${out.access.tempPassword}` : ""}.`
        : "";
      setMsg(`Awarded to ${vendorLabel}. Project opened on their contractor desk.${slip}`);
      await loadDetail(selectedId);
      await load();
    } catch (err) {
      showActionError("Could not award this bid", err);
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
    <div className="crm-bid-page space-y-3">
      {msg && (
        <p className={`text-sm shrink-0 px-0.5 ${actionError ? "text-danger" : "text-ok"}`}>{msg}</p>
      )}

      <CrmBidCompareDesk
        token={token}
        canManage={canManage}
        busy={busy}
        setupProjectId={setupProjectId}
        activeProject={activeProject}
        projects={projects}
        packagesForDesk={packagesForDesk}
        filteredPackages={filteredPackages}
        pkgFilter={pkgFilter}
        onPkgFilter={setPkgFilter}
        selectedId={selectedId}
        detail={detail}
        mainTab={mainTab}
        onMainTab={setMainTab}
        workflowStep={workflowStep}
        uploadedPct={uploadedPct}
        onProjectChange={(id) => {
          const q = new URLSearchParams(searchParams);
          if (id) q.set("projectId", id);
          else q.delete("projectId");
          setSearchParams(q, { replace: true });
          setSelectedId(null);
          setDetail(null);
          setShowNewBidForm(false);
          if (!id) nav("/crm/bids", { replace: true });
        }}
        onNewBid={() => {
          if (!setupProjectId) {
            showActionNeed("Pick a project", "Choose a project in the left rail, then create a new bid.");
            return;
          }
          openNewBidSetup({ projectId: setupProjectId });
        }}
        onSelectPackage={selectPackage}
        onOpenBid={() => void openBidPackage()}
        onRefreshCompare={() => void recomputeComparative()}
        onAward={(label) => void awardVendor(label)}
        vendorTotals={vendorTotals}
        vendorMatrix={vendorMatrix}
        detailDisciplines={detailDisciplines}
        summaryVendorGap={summaryVendorGap}
        formatINR={formatINR}
        disciplineLabel={disciplineLabel}
        openSlotPanel={openSlotPanel}
        copyVendorLink={copyVendorLink}
        slotPanel={slotPanel}
        onCloseSlot={() => {
          setSlotPanel(null);
          setUploadFile(null);
        }}
        uploadFile={uploadFile}
        onUploadFile={setUploadFile}
        onUploadBoq={uploadBoq}
        onSlotTab={(tab) => {
          setSlotPanel((prev) => (prev ? { ...prev, tab } : null));
          if (tab === "upload") setUploadFile(null);
        }}
        onSlotSaved={() => {
          if (selectedId) {
            void loadDetail(selectedId);
            void load();
          }
        }}
        accessSlip={accessSlip}
        showNewBidForm={showNewBidForm}
        onCloseNewBid={() => setShowNewBidForm(false)}
        newBidForm={
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 className="font-semibold text-sm">New bid package</h2>
              <Button type="button" variant="secondary" className="!text-xs" onClick={() => setShowNewBidForm(false)}>
                Cancel
              </Button>
            </div>
            <form className="space-y-3" onSubmit={createPackage}>
              {!form.projectId ? (
                <label className="text-xs font-semibold text-steel-muted block">
                  Project
                  <Select
                    className="mt-1"
                    value={form.projectId}
                    onChange={(e) => {
                      const pid = e.target.value;
                      const p = projects.find((x) => x.id === pid);
                      setForm({
                        ...form,
                        projectId: pid,
                        title: form.title || (p ? `${p.name} — comparative bid` : ""),
                      });
                    }}
                    required
                  >
                    <option value="">Select project…</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} · {p.name}
                      </option>
                    ))}
                  </Select>
                </label>
              ) : (
                <p className="text-xs text-steel-muted">
                  Project: <span className="font-mono font-semibold text-ink">{projects.find((p) => p.id === form.projectId)?.code}</span>
                </p>
              )}
              <Input
                required
                placeholder="Package title (e.g. Civil works — Phase 1)"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <div className="grid sm:grid-cols-2 gap-2">
                <Input
                  placeholder="Revision"
                  value={form.revisionLabel}
                  onChange={(e) => setForm({ ...form, revisionLabel: e.target.value })}
                />
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div>
                <p className="text-xs font-semibold text-steel-muted mb-1">
                  Work packages
                  {disciplineSource === "work_packages" && <span className="font-normal"> · from project card</span>}
                </p>
                {!disciplines.length ? (
                  <p className="text-xs text-amber-800 border border-amber-200 rounded-lg p-2 bg-amber-50">
                    Tick packages on{" "}
                    <Link to={`/crm/setup?projectId=${form.projectId}&step=project`} className="text-brand font-semibold">
                      Project setup
                    </Link>{" "}
                    first.
                  </p>
                ) : (
                  <div className="max-h-32 overflow-y-auto border rounded-xl p-2 space-y-1">
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
                        {d.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-steel-muted mb-1">
                  Vendors{" "}
                  <Link to="/crm/directory/vendors" className="text-brand font-semibold">
                    (CRM directory)
                  </Link>
                </p>
                <SearchableCheckboxList
                  items={bidderItems}
                  selectedIds={form.vendorIds}
                  onChange={(vendorIds) => setForm({ ...form, vendorIds })}
                  placeholder="Search vendor…"
                  emptyMessage="Add contractors on CRM → Vendors first."
                />
              </div>
              <Button type="submit" disabled={busy}>
                {busy ? "Creating…" : "Create bid package"}
              </Button>
            </form>
          </>
        }
        leads={leads}
        onBidChanged={async () => {
          if (detail) {
            await loadDetail(detail.id);
            await load();
          }
        }}
        onBidDeleted={() => {
          setSelectedId(null);
          setDetail(null);
          const q = setupProjectId ? `?projectId=${encodeURIComponent(setupProjectId)}` : "";
          nav(`/crm/bids${q}`, { replace: true });
        }}
        managePanel={
          <div className="crm-bid-manage-grid">
            <Card className="!p-4">
              <h4 className="font-semibold text-sm mb-1">Add bidders</h4>
              <p className="text-xs text-steel-muted mb-3">Creates BOQ slots and portal logins when email is on file.</p>
              <SearchableCheckboxList
                items={vendorsNotOnPackage.map((v) => ({
                  id: v.id,
                  label: v.name,
                  sublabel: v.partyType || "Vendor",
                  trade: v.trade,
                }))}
                selectedIds={addVendorIds}
                onChange={setAddVendorIds}
                placeholder="Search contractor…"
                emptyMessage="All CRM contractors are already on this bid."
              />
              <Button type="button" className="mt-3 !text-xs" disabled={busy || !addVendorIds.length} onClick={() => void addVendorsToPackage()}>
                Add selected bidders
              </Button>
            </Card>
            <Card className="!p-4">
              <h4 className="font-semibold text-sm mb-1">Add discipline sheets</h4>
              <p className="text-xs text-steel-muted mb-3">Adds a BOQ column for every vendor on this package.</p>
              <div className="max-h-36 overflow-y-auto border rounded-xl p-2 space-y-1 mb-3">
                {disciplines.map((d) => (
                  <label key={d.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={addDiscKeys.includes(d.key)}
                      onChange={(e) => {
                        setAddDiscKeys(
                          e.target.checked ? [...addDiscKeys, d.key] : addDiscKeys.filter((k) => k !== d.key)
                        );
                      }}
                    />
                    {d.label}
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Input
                  className="flex-1 min-w-[140px] !text-xs"
                  placeholder="Custom discipline"
                  value={customDiscLabel}
                  onChange={(e) => setCustomDiscLabel(e.target.value)}
                />
                <Button type="button" variant="secondary" className="!text-xs" onClick={() => void addCustomDiscipline()}>
                  Add custom
                </Button>
              </div>
              <Button type="button" className="mt-3 !text-xs" disabled={busy || !addDiscKeys.length} onClick={() => void addDisciplinesToPackage()}>
                Add discipline BOQs
              </Button>
            </Card>
          </div>
        }
      />

      <ActionReasonDialog reason={actionError} onClose={() => setActionError(null)} />
    </div>
  );
}
