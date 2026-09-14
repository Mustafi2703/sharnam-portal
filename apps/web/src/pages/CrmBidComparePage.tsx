import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, Select } from "../components/ui";
import { FilePickButton } from "../components/FilePickButton";
import { CrmComparativeRegister } from "../components/CrmComparativeRegister";
import { CrmBidVendorMatrix } from "../components/CrmBidVendorMatrix";
import { CrmBidBoqRegister } from "../components/CrmBidBoqRegister";
import { SearchableCheckboxList } from "../components/SearchableCheckboxList";
import { downloadAuthFile } from "../lib/downloadReport";
import { CrmBidSharePointPanel } from "../components/CrmBidSharePointPanel";
import { BidManageActions } from "../components/BidManageActions";
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

const SHOW_DEV_BID_TOOLS = true;

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
}

type BidWorkflowStep = "configure" | "publish" | "collect" | "compare" | "award";

const BID_WORKFLOW_STEPS: { id: BidWorkflowStep; label: string; hint: string }[] = [
  { id: "configure", label: "Configure", hint: "Project · work packages · vendors" },
  { id: "publish", label: "Publish", hint: "Open bid & notify bidders" },
  { id: "collect", label: "Collect BOQs", hint: "Separate SPDC BOQ per vendor × package — Qty + Rate" },
  { id: "compare", label: "Compare", hint: "Refresh comparative statement" },
  { id: "award", label: "Award", hint: "Select L1 & close package" },
];

function BidDeskStepper({ active, complete }: { active: BidWorkflowStep; complete?: boolean }) {
  const activeIdx = BID_WORKFLOW_STEPS.findIndex((s) => s.id === active);
  return (
    <nav
      className="flex flex-wrap gap-1 sm:gap-0 sm:divide-x border border-line rounded-xl overflow-hidden bg-white"
      aria-label="Bid management workflow"
    >
      {BID_WORKFLOW_STEPS.map((step, i) => {
        const done = complete || i < activeIdx;
        const current = !complete && step.id === active;
        return (
          <div
            key={step.id}
            className={`flex-1 min-w-[7rem] px-3 py-2 ${current ? "bg-brand-soft/50" : done ? "bg-ok/5" : "bg-sand/20"}`}
          >
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  done ? "bg-ok text-white" : current ? "bg-brand text-white" : "bg-line text-steel-muted"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className={`text-xs font-semibold ${current ? "text-brand-dark" : "text-ink"}`}>{step.label}</span>
            </div>
            <p className="text-[10px] text-steel-muted mt-0.5 pl-6 hidden sm:block">{step.hint}</p>
          </div>
        );
      })}
    </nav>
  );
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
  const [deskFilter, setDeskFilter] = useState<"open" | "converted" | "all">("open");
  const [activeDiscipline, setActiveDiscipline] = useState<string>("all");
  const [showNewBidForm, setShowNewBidForm] = useState(false);
  const [projectVendorIds, setProjectVendorIds] = useState<string[]>([]);
  const [disciplineSource, setDisciplineSource] = useState<"saved" | "work_packages" | "default" | "">("");
  const [dueDate, setDueDate] = useState("");
  const [accessSlip, setAccessSlip] = useState<{ vendor: string; email: string; tempPassword: string }[]>([]);
  const [showSharePoint, setShowSharePoint] = useState(false);
  const [actionError, setActionError] = useState<ActionReason | null>(null);
  const [clearConfirm, setClearConfirm] = useState("");

  function showActionError(title: string, err: unknown) {
    const reason = actionReasonFromError(title, err);
    setActionError(reason);
    setMsg(reason.message);
  }

  function showActionNeed(title: string, message: string) {
    setActionError({ title, message });
    setMsg(message);
  }

  const convertedLeads = useMemo(() => leads.filter((l) => l.projectId), [leads]);
  const convertedProjectIds = useMemo(
    () => new Set(convertedLeads.map((l) => l.projectId).filter(Boolean) as string[]),
    [convertedLeads],
  );
  const packagesForDesk = useMemo(() => {
    const scoped = setupProjectId
      ? packages.filter((p) => (p.project?.id || p.projectId) === setupProjectId)
      : packages;
    if (deskFilter === "open") return scoped.filter((p) => p.status === "Open" || p.status === "Draft");
    if (deskFilter === "all") return scoped;
    return scoped.filter((p) => {
      const pid = p.project?.id || p.projectId;
      return pid && convertedProjectIds.has(pid);
    });
  }, [packages, deskFilter, convertedProjectIds, setupProjectId]);

  const bidWorkflowStep = useMemo((): BidWorkflowStep => {
    if (showNewBidForm) return "configure";
    if (!detail) return "configure";
    if (detail.status === "Awarded") return "award";
    if (detail.status === "Draft") return "publish";
    const done = detail.uploadProgress?.done ?? 0;
    const total = detail.uploadProgress?.total ?? 0;
    if (detail.status === "Open" && total > 0 && done < total) return "collect";
    if (detail.summary?.grandTotals && Object.keys(detail.summary.grandTotals).length > 0) return "compare";
    if (total > 0 && done >= total) return "compare";
    return "collect";
  }, [showNewBidForm, detail]);

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
    setShowSharePoint(false);
  }, [selectedId]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  function selectPackage(id: string) {
    setSelectedId(id);
    setShowNewBidForm(false);
    setSlotPanel(null);
    setUploadFile(null);
    setActiveDiscipline("all");
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
      setMsg(`Test BOQs loaded from the R2 comparative workbook: ${r.uploaded}/${r.total} disciplines filled. Refresh comparative to award.`);
      await loadDetail(selectedId);
      await load();
    } catch (err) {
      showActionError("Test BOQs did not load", err);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (setupProjectId && !routePkgId) {
      setShowNewBidForm(true);
    }
  }, [setupProjectId, routePkgId]);

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
      try {
        const opened = await api<{
          notify: {
            notified: number;
            total: number;
            missingEmail?: string[];
            accessSlips?: { vendor: string; email: string; tempPassword: string }[];
          };
        }>(`/api/crm/bid-packages/${row.id}/open`, {
          method: "POST",
          token,
          body: JSON.stringify({ dueDate: dueDate || undefined, createLogins: true }),
        });
        setAccessSlip(opened.notify.accessSlips || []);
        const missing = opened.notify.missingEmail?.length
          ? ` Missing email: ${opened.notify.missingEmail.join(", ")}.`
          : "";
        setMsg(
          `Bid opened — emailed ${opened.notify.notified}/${opened.notify.total} bidder(s). They sign in and upload at /crm/vendor-bids.${missing}`,
        );
        await loadDetail(row.id);
        await load();
      } catch (openErr) {
        showActionError(
          "Package saved — open bid failed",
          openErr instanceof Error
            ? openErr
            : new Error("Package saved. Use Open bid & notify bidders to email vendor logins."),
        );
      }
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

  async function clearExistingBids() {
    if (clearConfirm.trim() !== "DELETE ALL BIDS") {
      showActionNeed(
        "Confirm delete",
        "Type DELETE ALL BIDS in the box, then click Clear existing bids. This removes bid packages and vendor BOQs only — projects, vendors, and logins stay.",
      );
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const out = await api<{ removed: number; titles: string[] }>("/api/crm/bid-packages/clear-existing", {
        method: "POST",
        token,
        body: JSON.stringify({
          confirm: "DELETE ALL BIDS",
          projectId: setupProjectId || undefined,
        }),
      });
      setClearConfirm("");
      setSelectedId(null);
      setDetail(null);
      setMsg(
        setupProjectId
          ? `Cleared ${out.removed} bid(s) on this project. Select vendors and create a new bid.`
          : `Cleared ${out.removed} bid package(s). Select vendors and open a new bid.`,
      );
      await load();
    } catch (err) {
      showActionError("Could not delete existing bids", err);
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

  const scopedProject = projects.find((p) => p.id === setupProjectId);

  return (
    <div className="crm-bid-page space-y-3">
      <p className="text-xs text-steel-muted max-w-3xl leading-relaxed px-0.5">
        R2 comparative bids per project. Add vendors from <strong className="text-ink">CRM → Vendors</strong>, open the package, collect BOQs, refresh comparative, award L1. Company master stays on CRM directory tabs only.
      </p>
      <Card className="!p-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-semibold text-steel-muted flex-1 min-w-[16rem]">
            Project for this bid
            <select
              className="mt-1 w-full border border-line rounded-lg px-2 py-1.5 text-sm bg-white"
              value={setupProjectId}
              onChange={(e) => {
                const id = e.target.value;
                const q = new URLSearchParams(searchParams);
                if (id) q.set("projectId", id);
                else q.delete("projectId");
                setSearchParams(q, { replace: true });
                setSelectedId(null);
                setDetail(null);
                if (id) {
                  openNewBidSetup({ projectId: id });
                } else {
                  setShowNewBidForm(false);
                  nav("/crm/bids", { replace: true });
                }
              }}
            >
              <option value="">All projects — pick one to set up a bid</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            onClick={() => {
              if (!setupProjectId) {
                showActionNeed(
                  "Pick a project first",
                  "Choose the project in the dropdown, then open a new bid. After you select the vendor, Create & open package emails them to upload BOQs.",
                );
                return;
              }
              openNewBidSetup({ projectId: setupProjectId });
            }}
          >
            New R2 bid for this project
          </Button>
        </div>
        {scopedProject && (
          <p className="text-xs text-steel-muted mt-2">
            Packages below are only for <span className="font-mono text-ink">{scopedProject.code}</span>. Add vendors, then
            fill or upload BOQs and open the comparative.
          </p>
        )}
      </Card>
      {msg && (
        <p className={`text-sm shrink-0 px-0.5 ${actionError ? "text-danger" : "text-ok"}`}>{msg}</p>
      )}

      {(showNewBidForm || detail) && (
        <BidDeskStepper active={bidWorkflowStep} complete={detail?.status === "Awarded"} />
      )}

      {showNewBidForm && (
        <Card className="max-w-3xl">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="font-semibold text-sm">New R2 bid package</h2>
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
              placeholder="Package title (e.g. Civil & structural works)"
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
                Work packages (bid disciplines)
                {disciplineSource === "work_packages" && (
                  <span className="font-normal text-steel-muted"> · from project card</span>
                )}
                {disciplineSource === "saved" && (
                  <span className="font-normal text-steel-muted"> · saved on project</span>
                )}
              </p>
              {!disciplines.length ? (
                <p className="text-xs text-amber-800 border border-amber-200 rounded-lg p-2 bg-amber-50">
                  No work packages on this project yet. Add packages (Civil, PEB, MEP, etc.) on{" "}
                  <Link to={`/crm/setup?projectId=${form.projectId}&step=project`} className="text-brand font-semibold">
                    Project setup
                  </Link>{" "}
                  first — not the R2 sheet list (CCV, Electrical Lab, etc.).
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
            <p className="text-xs text-steel-muted">
              Each vendor uploads one BOQ per work package using the{" "}
              <button
                type="button"
                className="text-brand font-semibold underline-offset-2 hover:underline"
                onClick={() => void downloadAuthFile("/api/crm/template.xlsx", token, "Comparative-Statement-R2.xlsx")}
              >
                Comparative Statement R2 (.xlsx)
              </button>{" "}
              sample format.
            </p>
            <div>
              <p className="text-xs font-semibold text-steel-muted mb-1">
                Vendors / contractors{" "}
                <Link to="/crm/directory/vendors" className="text-brand font-semibold">
                  (CRM directory)
                </Link>
              </p>
              <SearchableCheckboxList
                items={bidderItems}
                selectedIds={form.vendorIds}
                onChange={(vendorIds) => setForm({ ...form, vendorIds })}
                placeholder="Search vendor…"
                emptyMessage="No vendors yet — add contractors on CRM → Vendors, or assign them on the project directory."
              />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create & open package"}
            </Button>
          </form>
        </Card>
      )}

      <div className="crm-bid-desk">
        <aside className="crm-bid-desk__rail">
          <div className="crm-bid-desk__rail-head space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="!text-xs flex-1" onClick={() => openNewBidSetup({ projectId: setupProjectId })}>
                + New bid
              </Button>
              <Button
                variant="secondary"
                type="button"
                className="!text-xs"
                onClick={() => void downloadAuthFile("/api/crm/template.xlsx", token, "Comparative-Statement-R2.xlsx")}
              >
                R2 .xlsx
              </Button>
            </div>
            <div className="flex gap-1">
              <Button
                variant={deskFilter === "open" ? "primary" : "secondary"}
                type="button"
                className="!text-xs flex-1"
                onClick={() => setDeskFilter("open")}
              >
                Open
              </Button>
              <Button
                variant={deskFilter === "converted" ? "primary" : "secondary"}
                type="button"
                className="!text-xs flex-1"
                onClick={() => setDeskFilter("converted")}
              >
                Converted
              </Button>
              <Button
                variant={deskFilter === "all" ? "primary" : "secondary"}
                type="button"
                className="!text-xs flex-1"
                onClick={() => setDeskFilter("all")}
              >
                All
              </Button>
            </div>
            <p className="text-[10px] text-steel-muted font-mono uppercase tracking-wide">
              {packagesForDesk.length} package(s)
            </p>
            {packages.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <Input
                  value={clearConfirm}
                  onChange={(e) => setClearConfirm(e.target.value)}
                  placeholder="Type DELETE ALL BIDS"
                  className="!text-xs"
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="!text-xs w-full !bg-danger/10 !border-danger/40 !text-danger"
                  disabled={busy}
                  onClick={() => void clearExistingBids()}
                >
                  Clear existing bids
                </Button>
              </div>
            )}
          </div>
          <ul className="crm-bid-desk__rail-list divide-y">
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
                  <Button type="button" onClick={() => openNewBidSetup()}>
                    Open a bid →
                  </Button>
                </li>
              )}
          </ul>
        </aside>

        <div className="crm-bid-desk__main">
          {detail?.project?.id && (
            <div className="crm-bid-desk__toolbar mb-3">
              <Link to={`/crm/setup?projectId=${detail.project.id}`}>
                <Button variant="secondary" className="!text-xs">
                  Project setup
                </Button>
              </Link>
            </div>
          )}
          <div className="space-y-4">
          {detail ? (
            <>
              {detail.status === "Draft" && (
                <Card className="!p-4 border-amber-300 bg-amber-50/70">
                  <p className="text-sm text-ink">
                    <strong>Draft package</strong> — bidders cannot upload yet. Click{" "}
                    <strong>Open bid &amp; notify bidders</strong> to email portal logins and unlock vendor uploads.
                  </p>
                </Card>
              )}
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
                    {SHOW_DEV_BID_TOOLS && canManage && (
                      <Button type="button" variant="secondary" disabled={busy} onClick={() => void simulateR2Boqs()}>
                        Load test BOQs from R2
                      </Button>
                    )}
                    {canManage && token && (
                      <BidManageActions
                        bid={{
                          id: detail.id,
                          title: detail.title,
                          status: detail.status,
                          revisionLabel: detail.revisionLabel,
                          notes: detail.notes,
                          dueDate: detail.dueDate,
                          projectId: detail.project?.id || detail.projectId,
                          leadId: detail.lead?.id || detail.leadId,
                          awardedVendorId: detail.awardedVendorId,
                        }}
                        token={token}
                        projects={projects}
                        leads={leads}
                        onChanged={async () => {
                          await loadDetail(detail.id);
                          await load();
                        }}
                        onDeleted={() => {
                          setSelectedId(null);
                          setDetail(null);
                          const q = setupProjectId ? `?projectId=${encodeURIComponent(setupProjectId)}` : "";
                          nav(`/crm/bids${q}`, { replace: true });
                        }}
                      />
                    )}
                  </div>
                </div>
                {(() => {
                  const noEmail = [
                    ...new Map(
                      (detail.vendorBoqs || [])
                        .filter((b) => !b.vendor?.email)
                        .map((b) => [b.vendorLabel, b.vendorLabel])
                    ).values(),
                  ];
                  if (!noEmail.length && !accessSlip.length) return null;
                  return (
                    <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs space-y-1">
                      {noEmail.length > 0 && (
                        <p>
                          <strong>No email on file:</strong> {noEmail.join(", ")}. Add an email on the vendor card before they can receive a login.
                        </p>
                      )}
                      {accessSlip.length > 0 && (
                        <div>
                          <p className="font-semibold uppercase tracking-wide text-steel-muted">Access slip — give these to vendors</p>
                          {accessSlip.map((s) => (
                            <p key={s.email} className="font-mono">
                              {s.vendor} · {s.email} · {s.tempPassword}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Package progress meter — visible at a glance so PMC knows
                    what's still missing before the comparison can be locked. */}
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

                <div className="mb-4 rounded-xl border border-brand/30 bg-brand-soft/20 p-3 space-y-4">
                  <p className="text-xs font-semibold text-ink">Add vendors and discipline sheets to this bid</p>
                    <div>
                      <p className="text-[11px] text-steel-muted mb-2">
                        Pick from{" "}
                        <Link to="/crm/directory/vendors" className="text-brand font-semibold">
                          CRM vendor directory
                        </Link>
                        . Open bids email new bidders automatically.
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
                        disabled={busy}
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
                                    e.target.checked ? [...prev, d.key] : prev.filter((x) => x !== d.key),
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
                        disabled={busy}
                        onClick={() => void addDisciplinesToPackage()}
                      >
                        Add selected disciplines
                      </Button>
                    </div>
                </div>

                {vendorMatrix.length > 0 && (
                  <div className="mb-4 w-full min-w-0 overflow-x-auto">
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
                      onManageSlot={openSlotPanel}
                      onCopyLink={copyVendorLink}
                    />
                    {selectedId && detail.project?.code && token && (
                      <div className="mt-4">
                        {!showSharePoint ? (
                          <Button type="button" variant="secondary" className="!text-xs" onClick={() => setShowSharePoint(true)}>
                            Show SharePoint BOQ tree
                          </Button>
                        ) : (
                          <CrmBidSharePointPanel token={token} bidPackageId={selectedId} />
                        )}
                      </div>
                    )}
                  </div>
                )}
              </Card>

              {slotPanel && selectedId && (
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div>
                      <h4 className="font-semibold text-sm">
                        {slotPanel.slot.vendorLabel} · {disciplineLabel(disciplines, slotPanel.slot.discipline)}
                      </h4>
                      <p className="text-xs text-steel-muted">
                        Separate BOQ per contractor × work package. Download SPDC sample, fill Qty + Rate, or edit in portal — comparative updates for office.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="!text-xs"
                        onClick={() =>
                          void downloadAuthFile(
                            `/api/crm/bid-packages/${selectedId}/vendor-boq/${slotPanel.slot.id}/template.xlsx`,
                            token,
                            `SPDC-BOQ-${slotPanel.slot.discipline}-${slotPanel.slot.vendorLabel.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 40)}.xlsx`,
                          )
                        }
                      >
                        Download SPDC BOQ
                      </Button>
                      <Button
                      type="button"
                      variant="ghost"
                      className="!text-xs"
                      onClick={() => {
                        setSlotPanel(null);
                        setUploadFile(null);
                      }}
                    >
                      Close
                    </Button>
                    </div>
                  </div>
                  <div className="flex gap-2 mb-4">
                    <Button
                      type="button"
                      variant={slotPanel.tab === "edit" ? "primary" : "secondary"}
                      className="!text-xs"
                      onClick={() => setSlotPanel((prev) => (prev ? { ...prev, tab: "edit" } : null))}
                    >
                      Edit in portal
                    </Button>
                    <Button
                      type="button"
                      variant={slotPanel.tab === "upload" ? "primary" : "secondary"}
                      className="!text-xs"
                      onClick={() => {
                        setSlotPanel((prev) => (prev ? { ...prev, tab: "upload" } : null));
                        setUploadFile(null);
                      }}
                    >
                      Upload Excel
                    </Button>
                  </div>
                  {slotPanel.tab === "edit" ? (
                    <CrmBidBoqRegister
                      token={token!}
                      bidPackageId={selectedId}
                      slotId={slotPanel.slot.id}
                      title={`${slotPanel.slot.vendorLabel} — ${disciplineLabel(disciplines, slotPanel.slot.discipline)}`}
                      sheetLabel={disciplineLabel(disciplines, slotPanel.slot.discipline)}
                      canEdit={canManage}
                      onSaved={() => {
                        void loadDetail(selectedId);
                        void load();
                      }}
                      onClose={() => {
                        setSlotPanel(null);
                        setUploadFile(null);
                      }}
                    />
                  ) : (
                    <form className="space-y-3" onSubmit={uploadBoq}>
                      <FilePickButton accept=".xlsx,.xls,.csv" onPick={(files) => setUploadFile(files[0] || null)}>
                        {uploadFile ? uploadFile.name : "Choose Excel BOQ"}
                      </FilePickButton>
                      <Button type="submit" disabled={!uploadFile || busy}>
                        {busy ? "Uploading…" : "Upload BOQ"}
                      </Button>
                    </form>
                  )}
                </Card>
              )}
            </>
          ) : (
            <Card>
              <p className="text-sm text-steel-muted">
                Select a bid package. Each vendor uploads one Excel per work package (Civil, PEB, MEP, etc.) —
                same structure as Comparative Statement R2.
              </p>
            </Card>
          )}
          </div>
        </div>
      </div>
      <ActionReasonDialog reason={actionError} onClose={() => setActionError(null)} />
    </div>
  );
}
