import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card } from "../components/ui";
import { FilePickButton } from "../components/FilePickButton";
import { CrmComparativeRegister } from "../components/CrmComparativeRegister";
import { CrmBidBoqRegister } from "../components/CrmBidBoqRegister";
import { CrmBidSharePointPanel } from "../components/CrmBidSharePointPanel";
import { downloadAuthFile } from "../lib/downloadReport";
import { openChecklistFillWindow, openFamilyChecklistFill } from "../lib/checklistFillWindow";

type BidSlot = {
  id: string;
  bidPackageId: string;
  bidPackageTitle: string;
  bidPackageStatus: string;
  revisionLabel: string;
  projectNote?: string | null;
  projectId?: string | null;
  projectCode?: string | null;
  projectName?: string | null;
  comparativeSharePointUrl?: string | null;
  summarySheetId?: string | null;
  comparativeSheetId?: string | null;
  awardedVendorId?: string | null;
  awardedVendorLabel?: string | null;
  isAwardedToYou?: boolean;
  vendorLabel: string;
  discipline: string;
  disciplineLabel: string;
  fileName?: string | null;
  uploadedAt?: string | null;
  sharePointUrl?: string | null;
  sheetId?: string | null;
};

type PackageSummary = {
  id: string;
  title: string;
  status?: string;
  myVendorLabel?: string | null;
  awardedVendorLabel?: string | null;
  isAwardedToYou?: boolean;
  isLowestBidder?: boolean;
  myGrandTotal?: number;
  lowestGrandTotal?: number | null;
  summary?: {
    vendorLabels: string[];
    sectionTotals: { section: string; title: string; totals: Record<string, number> }[];
    grandTotals: Record<string, number>;
    lowestVendor?: string;
  } | null;
  summarySheetId?: string | null;
  comparativeSheetId?: string | null;
  comparativeSharePointUrl?: string | null;
  uploadProgress?: { done: number; total: number };
};

type ProjectGroup = {
  key: string;
  projectCode: string | null;
  projectName: string | null;
  packages: Record<string, BidSlot[]>;
};

function formatINR(n?: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function VendorPackageCard({
  pkgId,
  pkgSlots,
  summary,
  highlighted,
  onUpload,
  onClear,
  vendorView = false,
}: {
  pkgId: string;
  pkgSlots: BidSlot[];
  summary?: PackageSummary;
  highlighted?: boolean;
  onUpload: (slot: BidSlot, mode: "online" | "excel") => void;
  onClear?: (slot: BidSlot) => void;
  vendorView?: boolean;
}) {
  const head = pkgSlots[0];
  const done = pkgSlots.filter((s) => s.fileName || s.uploadedAt).length;
  const isOpen = head?.bidPackageStatus === "Open";
  const isAwarded = head?.bidPackageStatus === "Awarded";
  const awardedLabel = summary?.awardedVendorLabel || head?.awardedVendorLabel;

  return (
    <Card className={highlighted ? "ring-2 ring-brand" : isOpen ? "border-brand/40" : undefined}>
      <div className="mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{head?.bidPackageTitle}</h3>
          {isOpen ? <Badge tone="ok">Open for bids</Badge> : isAwarded ? <Badge tone="ok">Awarded</Badge> : <Badge>{head?.bidPackageStatus}</Badge>}
          {summary?.isLowestBidder && !isAwarded && <Badge tone="ok">L1 (lowest total)</Badge>}
          {summary?.isAwardedToYou && <Badge tone="ok">Awarded to you</Badge>}
        </div>
        <p className="text-xs text-steel-muted mt-0.5">
          {head?.revisionLabel}
          {head?.projectCode && <span className="ml-2 font-mono">{head.projectCode}</span>}
          <span className="ml-2">
            Your BOQs {done}/{pkgSlots.length}
          </span>
          {summary?.myVendorLabel && (
            <span className="ml-2 font-mono">· {summary.myVendorLabel}</span>
          )}
        </p>
        {(isAwarded || summary?.myGrandTotal != null) && (
          <p className="text-[11px] text-steel-muted mt-1">
            {isAwarded && awardedLabel && (
              <span>
                <strong className="text-ink">Award:</strong> {awardedLabel}
                {summary?.isAwardedToYou ? " (your company)" : ""}
                {" · "}
              </span>
            )}
            {summary?.myGrandTotal != null && (
              <span>
                Your grand total: <strong className="text-ink">{formatINR(summary.myGrandTotal)}</strong>
                {summary.summary?.lowestVendor && !isAwarded && (
                  <span> · L1: {summary.summary.lowestVendor}</span>
                )}
              </span>
            )}
          </p>
        )}
        <div className="flex flex-wrap gap-3 mt-1">
          {head?.comparativeSharePointUrl && (
            <a
              href={head.comparativeSharePointUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-brand font-semibold"
            >
              Comparative Statement R2 (SharePoint) →
            </a>
          )}
        </div>
        {head?.projectNote && <p className="text-[11px] text-steel-muted mt-1">{head.projectNote}</p>}
      </div>

      {summary?.summary?.grandTotals && Object.keys(summary.summary.grandTotals).length > 0 && !vendorView && (
        <div className="mb-4">
          <h4 className="text-xs font-mono uppercase text-steel-muted mb-2">
            Comparative statement (R2 summary — all bidders)
          </h4>
          <CrmComparativeRegister summary={summary.summary} revisionLabel={head?.revisionLabel || "R2"} />
        </div>
      )}

      <h4 className="text-xs font-mono uppercase text-steel-muted mb-2">Your discipline BOQs (R2 sheets)</h4>
      <ul className="divide-y border border-line rounded-xl overflow-hidden">
        {pkgSlots.map((s) => (
          <li key={s.id} className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-sm bg-paper">
            <div className="min-w-0">
              <div className="font-medium">{s.disciplineLabel}</div>
              <div className="text-xs text-steel-muted">{s.fileName || "Not uploaded"}</div>
              {s.uploadedAt && (
                <div className="text-[10px] text-steel-muted">
                  {new Date(s.uploadedAt).toLocaleDateString("en-IN")}
                </div>
              )}
              {s.sharePointUrl && (
                <a
                  href={s.sharePointUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-brand font-semibold"
                >
                  Open in SharePoint
                </a>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button type="button" variant="primary" className="!text-xs !py-1" onClick={() => onUpload(s, "online")}>
                {s.fileName ? "Edit BOQ" : "Fill BOQ online"}
              </Button>
              <Button type="button" variant="secondary" className="!text-xs !py-1" onClick={() => onUpload(s, "excel")}>
                {s.fileName ? "Replace Excel" : "Upload Excel"}
              </Button>
              {s.fileName && onClear && (
                <Button type="button" variant="ghost" className="!text-xs !py-1" onClick={() => onClear(s)}>
                  Clear
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function CrmVendorBidsPage() {
  const { token, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusPkgId = searchParams.get("pkg") || "";
  const desk = (["bids", "projects", "inbox"].includes(searchParams.get("desk") || "")
    ? searchParams.get("desk")
    : "bids") as "bids" | "projects" | "inbox";
  const [slots, setSlots] = useState<BidSlot[]>([]);
  const [summaries, setSummaries] = useState<Record<string, PackageSummary>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadSlot, setUploadSlot] = useState<BidSlot | null>(null);
  const [uploadMode, setUploadMode] = useState<"online" | "excel" | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [scope, setScope] = useState<"open" | "all">("all");
  const [myProjects, setMyProjects] = useState<{ id: string; code: string; name: string }[]>([]);
  const [inbox, setInbox] = useState<{
    projects: { id: string; code: string; name: string }[];
    assignments: { id: string; projectId: string; title: string; checklistType: string; latestStatus: string }[];
    rfis: { id: string; number: string; subject: string; rfiKind: string; status: string; projectId: string; linkedAssignmentId?: string | null }[];
  }>({ projects: [], assignments: [], rfis: [] });

  function openUpload(slot: BidSlot, mode: "online" | "excel") {
    setUploadSlot(slot);
    setUploadMode(mode);
    setUploadFile(null);
  }

  function closeUpload() {
    setUploadSlot(null);
    setUploadMode(null);
    setUploadFile(null);
  }

  useEffect(() => {
    if (!uploadSlot) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [uploadSlot]);

  const load = useCallback(async () => {
    const rows = await api<BidSlot[]>("/api/crm/my-bid-slots", { token }).catch(() => []);
    setSlots(rows);

    const pkgIds = [...new Set(rows.map((r) => r.bidPackageId))];
    const loaded = await Promise.all(
      pkgIds.map((id) =>
        api<PackageSummary>(`/api/crm/my-bid-packages/${id}/summary`, { token }).catch(() => null)
      )
    );
    const map: Record<string, PackageSummary> = {};
    pkgIds.forEach((id, i) => {
      if (loaded[i]) map[id] = loaded[i]!;
    });
    setSummaries(map);
    const [projects, deskInbox] = await Promise.all([
      api<{ id: string; code: string; name: string }[]>("/api/projects", { token }).catch(() => []),
      api<typeof inbox>("/api/checklist/vendor-inbox", { token }).catch(() => ({
        projects: [],
        assignments: [],
        rfis: [],
      })),
    ]);
    setMyProjects(projects);
    setInbox(deskInbox);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleSlots = useMemo(() => {
    if (scope === "all") return slots;
    return slots.filter((s) => s.bidPackageStatus === "Open" || (s.bidPackageStatus === "Awarded" && s.isAwardedToYou));
  }, [slots, scope]);

  const byProject = useMemo(() => {
    const groups: ProjectGroup[] = [];
    const index = new Map<string, ProjectGroup>();

    for (const slot of visibleSlots) {
      const key = slot.projectId || slot.projectCode || "unlinked";
      let group = index.get(key);
      if (!group) {
        group = {
          key,
          projectCode: slot.projectCode || null,
          projectName: slot.projectName || null,
          packages: {},
        };
        index.set(key, group);
        groups.push(group);
      }
      (group.packages[slot.bidPackageId] ||= []).push(slot);
    }
    return groups;
  }, [visibleSlots]);

  const openPackageCount = useMemo(() => {
    const seen = new Set<string>();
    for (const s of slots) {
      if (s.bidPackageStatus === "Open") seen.add(s.bidPackageId);
    }
    return seen.size;
  }, [slots]);

  const pendingUploads = useMemo(
    () => visibleSlots.filter((s) => s.bidPackageStatus === "Open" && !s.fileName && !s.uploadedAt).length,
    [visibleSlots]
  );

  async function clearBoq(slot: BidSlot) {
    if (!window.confirm(`Clear the uploaded BOQ for ${slot.disciplineLabel}? You can upload again.`)) return;
    setBusy(true);
    setMsg("");
    try {
      await api(`/api/crm/bid-packages/${slot.bidPackageId}/vendor-boq/${slot.id}`, { method: "DELETE", token });
      setMsg(`Cleared ${slot.disciplineLabel}`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Clear failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadBoq(e: FormEvent) {
    e.preventDefault();
    if (!uploadFile || !uploadSlot) return;
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      await api(`/api/crm/bid-packages/${uploadSlot.bidPackageId}/vendor-boq/${uploadSlot.id}`, {
        method: "POST",
        token,
        body: fd,
      });
      setMsg(`Uploaded — ${uploadSlot.disciplineLabel}${uploadSlot.projectCode ? ` · ${uploadSlot.projectCode}` : ""}`);
      closeUpload();
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  if (user?.role !== "vendor") {
    return (
      <Card>
        <p className="text-sm text-steel-muted">
          Sign in via the <strong>Contractor</strong> portal to fill bid BOQs here.
        </p>
        <ul className="text-xs text-steel-muted mt-2 space-y-1">
          <li>
            <strong>vendor@sharnam.demo</strong> — M/s Bhavna Infra
          </li>
          <li>
            <strong>nkinra@sharnam.demo</strong> — M/s Nikhra Infra
          </li>
        </ul>
        <Link to="/login/vendor" className="text-sm text-brand font-semibold mt-2 inline-block">
          Contractor login →
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <Card className="!p-4 bg-sand/40 border-brand/20">
        <p className="font-mono text-[10px] uppercase tracking-wider text-brand mb-1">Contractor bid desk</p>
        <h2 className="font-display text-lg text-ink">What you applied for</h2>
        <p className="text-sm text-steel-muted mt-1 max-w-2xl">
          Every R2 package assigned to your company — project, disciplines, and your uploaded BOQs. Fill or upload while the bid is open. Your totals stay on this desk after award.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button
            type="button"
            variant={desk === "bids" ? "primary" : "secondary"}
            className="!text-xs !py-1"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.set("desk", "bids");
              setSearchParams(next);
            }}
          >
            My bids
          </Button>
          <Button
            type="button"
            variant={desk === "projects" ? "primary" : "secondary"}
            className="!text-xs !py-1"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.set("desk", "projects");
              setSearchParams(next);
            }}
          >
            My projects
          </Button>
          <Button
            type="button"
            variant={desk === "inbox" ? "primary" : "secondary"}
            className="!text-xs !py-1"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.set("desk", "inbox");
              setSearchParams(next);
            }}
          >
            Checklist / RFI inbox
          </Button>
          {desk === "bids" && (
            <>
              <Badge tone="ok">{openPackageCount} open package{openPackageCount === 1 ? "" : "s"}</Badge>
              <Badge tone={pendingUploads ? "warn" : "neutral"}>{pendingUploads} pending upload{pendingUploads === 1 ? "" : "s"}</Badge>
              <Button type="button" variant={scope === "open" ? "primary" : "secondary"} className="!text-xs !py-1" onClick={() => setScope("open")}>
                Open for me
              </Button>
              <Button type="button" variant={scope === "all" ? "primary" : "secondary"} className="!text-xs !py-1" onClick={() => setScope("all")}>
                All assignments
              </Button>
            </>
          )}
        </div>
      </Card>

      {desk === "bids" && (
      <div className="flex flex-wrap gap-2 shrink-0">
        <Button
          type="button"
          variant="secondary"
          onClick={() => void downloadAuthFile("/api/crm/template.xlsx", token, "Comparative-Statement-R2.xlsx")}
        >
          Download R2 .xlsx
        </Button>
      </div>
      )}

      {msg && <p className="text-sm text-ok">{msg}</p>}

      {desk === "projects" && (
        <Card className="!p-4 space-y-2">
          <h3 className="font-semibold text-sm">Jobs you can open</h3>
          <p className="text-xs text-steel-muted">Opened when PMC completes setup or invites your company on a bid.</p>
          {!myProjects.length && <p className="text-sm text-steel-muted">No project access yet — ask office to open a bid or assign your company.</p>}
          <ul className="divide-y divide-line">
            {myProjects.map((p) => (
              <li key={p.id} className="py-2 flex flex-wrap justify-between gap-2">
                <span>
                  <span className="font-mono text-xs">{p.code}</span>
                  <span className="ml-2 font-medium text-sm">{p.name}</span>
                </span>
                <span className="flex flex-wrap gap-3 text-sm">
                  <Link to={`/projects/${p.id}`} className="font-semibold text-brand">
                    Project desk →
                  </Link>
                  <Link to={`/projects/${p.id}/rfis`} className="font-semibold text-brand">
                    RFIs →
                  </Link>
                  <Link to={`/projects/${p.id}/hub/quality`} className="font-semibold text-brand">
                    Quality →
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {desk === "inbox" && (
        <div className="space-y-3">
          <Card className="!p-4 space-y-2">
            <h3 className="font-semibold text-sm">Checklist inbox</h3>
            {!inbox.assignments.length && <p className="text-sm text-steel-muted">No assigned checklists on your projects yet.</p>}
            <ul className="divide-y divide-line text-sm">
              {inbox.assignments.map((a) => {
                const project = inbox.projects.find((p) => p.id === a.projectId);
                return (
                  <li key={a.id} className="py-2 flex flex-wrap justify-between gap-2">
                    <span>
                      <span className="font-medium">{a.title}</span>
                      <span className="block text-xs text-steel-muted">
                        {project?.code || a.projectId} · {a.checklistType} · {a.latestStatus}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="font-semibold text-brand"
                      onClick={() =>
                        openChecklistFillWindow(a.projectId, a.id, a.checklistType || "SiteExecution", { resumeDraft: true })
                      }
                    >
                      Open fill
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card className="!p-4 space-y-2">
            <h3 className="font-semibold text-sm">RFI inbox</h3>
            {!inbox.rfis.length && <p className="text-sm text-steel-muted">No open RFIs assigned to your company.</p>}
            <ul className="divide-y divide-line text-sm">
              {inbox.rfis.map((r) => {
                const project = inbox.projects.find((p) => p.id === r.projectId);
                return (
                  <li key={r.id} className="py-2 flex flex-wrap justify-between gap-2">
                    <span>
                      <span className="font-mono text-xs">{r.number}</span>
                      <span className="ml-2 font-medium">{r.subject}</span>
                      <span className="block text-xs text-steel-muted">
                        {project?.code || r.projectId} · {r.rfiKind} · {r.status}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="font-semibold text-brand"
                      onClick={() => {
                        if (r.linkedAssignmentId) {
                          openChecklistFillWindow(r.projectId, r.linkedAssignmentId, r.rfiKind, { resumeDraft: true });
                          return;
                        }
                        void openFamilyChecklistFill(r.projectId, r.rfiKind, token, { preferAssignmentFill: true });
                      }}
                    >
                      Open fill
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      )}

      {desk !== "bids" ? null : (
        <>

      {slots.length > 0 && (
        <Card padding={false} className="overflow-hidden">
          <div className="px-4 py-3 border-b border-line">
            <h3 className="font-semibold text-sm">Applications</h3>
            <p className="text-xs text-steel-muted">Packages PMC assigned to your company and the BOQs you submitted.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[40rem]">
              <thead>
                <tr className="text-left bg-sand/50">
                  <th className="p-2">Project</th>
                  <th className="p-2">Package</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Disciplines applied</th>
                  <th className="p-2">Your BOQs</th>
                  <th className="p-2">Your total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(
                  slots.reduce<Record<string, BidSlot[]>>((acc, s) => {
                    (acc[s.bidPackageId] ||= []).push(s);
                    return acc;
                  }, {})
                ).map(([pkgId, pkgSlots]) => {
                  const head = pkgSlots[0];
                  const done = pkgSlots.filter((s) => s.fileName || s.uploadedAt).length;
                  const sum = summaries[pkgId];
                  return (
                    <tr key={pkgId} className="border-t border-line">
                      <td className="p-2 font-mono">{head.projectCode || "—"}</td>
                      <td className="p-2 font-medium">{head.bidPackageTitle}</td>
                      <td className="p-2">{head.bidPackageStatus}</td>
                      <td className="p-2">{pkgSlots.map((s) => s.disciplineLabel).join(", ")}</td>
                      <td className="p-2 tabular-nums">
                        {done}/{pkgSlots.length}
                      </td>
                      <td className="p-2 tabular-nums">{formatINR(sum?.myGrandTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {scope === "open" && !visibleSlots.length && slots.length > 0 && (
        <Card>
          <p className="text-sm text-steel-muted">
            No packages are open for bids right now. Switch to <strong>All assignments</strong> to see awarded or closed packages.
          </p>
        </Card>
      )}

      {!slots.length && (
        <Card>
          <p className="text-sm text-steel-muted">
            No open bid packages assigned to your company yet.
          </p>
          <ul className="text-xs text-steel-muted mt-3 space-y-1.5 list-disc pl-5">
            <li>
              Sign in as <strong>vendor@sharnam.demo</strong> (M/s Bhavna Infra) or <strong>nkinra@sharnam.demo</strong> (M/s Nikhra Infra) — password <strong>Demo@1234</strong>
            </li>
            <li>
              Demo package: <strong>SPDC-DEMO-01 · Civil & structural — R2 demo bid</strong> — structural, civil, and other discipline BOQs
            </li>
            <li>
              Office opens bids at{" "}
              <Link to="/crm/bids" className="text-brand font-semibold">
                CRM → Comparative bids
              </Link>
            </li>
          </ul>
          <p className="text-xs text-steel-muted mt-3">
            If this is a fresh server, run <code className="text-[10px]">npm run db:seed</code> to load demo bidders and pre-filled BOQs.
          </p>
        </Card>
      )}

      {byProject.map((project) => (
        <div key={project.key} className="space-y-3">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="font-semibold text-base">
              {project.projectCode ? `${project.projectCode}` : "Unlinked project"}
            </h2>
            {project.projectName && <span className="text-sm text-steel-muted">{project.projectName}</span>}
          </div>

          {Object.entries(project.packages).map(([pkgId, pkgSlots]) => (
            <div key={pkgId} className="space-y-2">
              <VendorPackageCard
                pkgId={pkgId}
                pkgSlots={pkgSlots}
                summary={summaries[pkgId]}
                highlighted={focusPkgId === pkgId}
                onUpload={openUpload}
                onClear={(s) => void clearBoq(s)}
                vendorView
              />
              {token && (
                <CrmBidSharePointPanel token={token} bidPackageId={pkgId} vendorView />
              )}
            </div>
          ))}
        </div>
      ))}
        </>
      )}

      {uploadSlot &&
        uploadMode &&
        createPortal(
          <div className="register-modal" role="dialog" aria-modal="true" onClick={closeUpload}>
            <div className={`register-modal__panel register-modal__panel--2xl`} onClick={(e) => e.stopPropagation()}>
              <div className="register-modal__head">
                <div>
                  <div className="text-[10px] font-mono uppercase text-steel-muted">R2 bid BOQ</div>
                  <h3 className="font-semibold text-base sm:text-lg">
                    {uploadSlot.disciplineLabel}
                    {uploadSlot.projectCode ? ` · ${uploadSlot.projectCode}` : ""}
                  </h3>
                </div>
                <button type="button" className="text-steel-muted hover:text-ink text-2xl leading-none px-2" onClick={closeUpload} aria-label="Close">
                  ×
                </button>
              </div>
              <div className="register-modal__body">
                <div className="flex flex-wrap gap-2 mb-4">
                  <Button
                    type="button"
                    variant={uploadMode === "online" ? "primary" : "secondary"}
                    className="!text-xs"
                    onClick={() => setUploadMode("online")}
                  >
                    Fill online
                  </Button>
                  <Button
                    type="button"
                    variant={uploadMode === "excel" ? "primary" : "secondary"}
                    className="!text-xs"
                    onClick={() => setUploadMode("excel")}
                  >
                    Upload Excel
                  </Button>
                </div>
                {uploadMode === "online" ? (
                  <CrmBidBoqRegister
                    token={token!}
                    bidPackageId={uploadSlot.bidPackageId}
                    slotId={uploadSlot.id}
                    title={uploadSlot.disciplineLabel}
                    sheetLabel={uploadSlot.disciplineLabel}
                    canEdit
                    onSaved={() => void load()}
                    onClose={closeUpload}
                  />
                ) : (
                  <form className="space-y-3" onSubmit={uploadBoq}>
                    <p className="text-xs text-steel-muted">
                      Use the matching discipline sheet from Comparative Statement R2 ({uploadSlot.disciplineLabel}).
                    </p>
                    <FilePickButton accept=".xlsx,.xls,.csv" onPick={(files) => setUploadFile(files[0] || null)}>
                      {uploadFile ? uploadFile.name : "Choose Excel from R2 workbook"}
                    </FilePickButton>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={!uploadFile || busy}>
                        {busy ? "Uploading…" : "Upload BOQ"}
                      </Button>
                      <Button type="button" variant="secondary" onClick={closeUpload}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
