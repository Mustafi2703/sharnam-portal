import { FormEvent, type ReactNode } from "react";
import { Badge, Button, Card, Input } from "./ui";
import { FilePickButton } from "./FilePickButton";
import { CrmComparativeRegister } from "./CrmComparativeRegister";
import { CrmBidVendorMatrix } from "./CrmBidVendorMatrix";
import { CrmBidBoqRegister } from "./CrmBidBoqRegister";
import { SearchableCheckboxList } from "./SearchableCheckboxList";
import { BidManageActions } from "./BidManageActions";
import { downloadAuthFile } from "../lib/downloadReport";

const BID_FLOW_STEPS = ["Project", "Bid package", "Open & invite", "Vendor BOQs", "Comparative", "Award"] as const;

type Discipline = { key: string; label: string; sheetName: string };

type VendorBoqSlot = {
  id: string;
  vendorLabel: string;
  discipline: string;
  fileName?: string | null;
  vendor?: { email?: string | null } | null;
};

type BidPackage = {
  id: string;
  title: string;
  status: string;
  revisionLabel: string;
  projectId?: string | null;
  notes?: string | null;
  dueDate?: string | null;
  awardedVendorId?: string | null;
  uploadProgress?: { done: number; total: number };
  summary?: {
    vendorLabels: string[];
    grandTotals: Record<string, number>;
    lowestVendor?: string;
    sectionTotals: { section: string; title: string; totals: Record<string, number> }[];
  } | null;
  summarySheetId?: string | null;
  comparativeSheetId?: string | null;
  project?: { id: string; code: string; name: string } | null;
  lead?: { id: string } | null;
  leadId?: string | null;
  vendorBoqs?: VendorBoqSlot[];
  disciplines?: Discipline[];
};

export type CrmBidDeskProps = {
  token: string | null;
  canManage: boolean;
  busy: boolean;
  setupProjectId: string;
  activeProject?: { id: string; code: string; name: string };
  projects: { id: string; code: string; name: string }[];
  packagesForDesk: BidPackage[];
  filteredPackages: BidPackage[];
  pkgFilter: string;
  onPkgFilter: (v: string) => void;
  selectedId: string | null;
  detail: BidPackage | null;
  mainTab: "overview" | "comparative" | "matrix" | "manage";
  onMainTab: (t: CrmBidDeskProps["mainTab"]) => void;
  workflowStep: number;
  uploadedPct: number;
  onProjectChange: (id: string) => void;
  onNewBid: () => void;
  onSelectPackage: (id: string) => void;
  onOpenBid: () => void;
  onRefreshCompare: () => void;
  onAward: (label: string) => void;
  vendorTotals: { label: string; total: number; isLowest: boolean }[];
  vendorMatrix: { vendorLabel: string; slots: { discipline: Discipline; slot?: VendorBoqSlot | null }[] }[];
  detailDisciplines: Discipline[];
  summaryVendorGap: { inSummaryOnly: string[]; inSlotsOnly: string[] } | null;
  formatINR: (n: number) => string;
  disciplineLabel: (disciplines: Discipline[], key: string) => string;
  openSlotPanel: (slot: VendorBoqSlot, tab: "edit" | "upload") => void;
  copyVendorLink: (label: string) => void;
  slotPanel: { slot: VendorBoqSlot; tab: "edit" | "upload" } | null;
  onCloseSlot: () => void;
  uploadFile: File | null;
  onUploadFile: (f: File | null) => void;
  onUploadBoq: (e: FormEvent) => void;
  onSlotTab: (tab: "edit" | "upload") => void;
  onSlotSaved: () => void;
  accessSlip: { vendor: string; email: string; tempPassword: string }[];
  showNewBidForm: boolean;
  onCloseNewBid: () => void;
  newBidForm: ReactNode;
  leads: any[];
  onBidChanged: () => Promise<void>;
  onBidDeleted: () => void;
  managePanel: ReactNode;
};

function BidFlowBar({ step }: { step: number }) {
  return (
    <div className="crm-bid-flow" aria-label="Bid workflow">
      {BID_FLOW_STEPS.map((label, i) => (
        <span
          key={label}
          className={`crm-bid-flow__step${step > i ? " is-done" : ""}${step === i ? " is-active" : ""}`}
        >
          <span className="crm-bid-flow__num">{step > i ? "✓" : i + 1}</span>
          {label}
        </span>
      ))}
    </div>
  );
}

function statusBadge(status: string) {
  if (status === "Awarded") return <Badge tone="ok">Awarded</Badge>;
  if (status === "Draft") return <Badge tone="warn">Draft</Badge>;
  if (status === "Open") return <Badge tone="brand">Open</Badge>;
  if (status === "Evaluation") return <Badge tone="brand">Evaluation</Badge>;
  return <Badge tone="neutral">{status}</Badge>;
}

export function CrmBidCompareDesk(props: CrmBidDeskProps) {
  const {
    token,
    canManage,
    busy,
    setupProjectId,
    activeProject,
    projects,
    packagesForDesk,
    filteredPackages,
    pkgFilter,
    onPkgFilter,
    selectedId,
    detail,
    mainTab,
    onMainTab,
    workflowStep,
    uploadedPct,
    onProjectChange,
    onNewBid,
    onSelectPackage,
    onOpenBid,
    onRefreshCompare,
    onAward,
    vendorTotals,
    vendorMatrix,
    detailDisciplines,
    summaryVendorGap,
    formatINR,
    disciplineLabel,
    openSlotPanel,
    copyVendorLink,
    slotPanel,
    onCloseSlot,
    uploadFile,
    onUploadFile,
    onUploadBoq,
    onSlotTab,
    onSlotSaved,
    accessSlip,
    showNewBidForm,
    onCloseNewBid,
    newBidForm,
    leads,
    onBidChanged,
    onBidDeleted,
    managePanel,
  } = props;

  const hasCompare = Boolean(detail?.summary?.grandTotals && Object.keys(detail.summary.grandTotals).length);
  const hasMatrix = vendorMatrix.length > 0;

  return (
    <div className="crm-bid-desk">
      <aside className="crm-bid-desk__rail">
        <div className="crm-bid-desk__rail-head space-y-2.5">
          {activeProject ? (
            <div className="rounded-lg border border-brand/25 bg-brand-soft/40 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-brand">Active project</p>
              <p className="font-mono text-xs font-semibold text-ink truncate">{activeProject.code}</p>
              <p className="text-[11px] text-steel-muted line-clamp-2 mt-0.5">{activeProject.name}</p>
            </div>
          ) : null}
          <label className="text-[10px] font-semibold text-steel-muted block">
            Filter by project
            <select
              className="mt-1 w-full border border-line rounded-lg px-2 py-1.5 text-xs bg-white"
              value={setupProjectId}
              onChange={(e) => onProjectChange(e.target.value)}
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code}
                </option>
              ))}
            </select>
          </label>
          <Input
            className="!text-xs !py-1.5"
            placeholder="Search bids…"
            value={pkgFilter}
            onChange={(e) => onPkgFilter(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="!text-xs flex-1" onClick={onNewBid}>
              + New bid
            </Button>
            <Button
              variant="secondary"
              type="button"
              className="!text-xs"
              onClick={() => void downloadAuthFile("/api/crm/template.xlsx", token, "Comparative-Statement-R2.xlsx")}
            >
              R2 sample
            </Button>
          </div>
          <p className="text-[10px] text-steel-muted font-mono uppercase tracking-wide">
            {filteredPackages.length} of {packagesForDesk.length} package(s)
          </p>
        </div>
        <ul className="crm-bid-desk__rail-list divide-y">
          {filteredPackages.map((p) => {
            const pct = p.uploadProgress
              ? Math.round((100 * (p.uploadProgress.done || 0)) / Math.max(1, p.uploadProgress.total || 0))
              : 0;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className={`crm-bid-rail-item${selectedId === p.id ? " is-selected" : ""}`}
                  onClick={() => onSelectPackage(p.id)}
                >
                  <div className="font-medium text-sm flex items-center gap-2">
                    <span className="truncate">{p.title}</span>
                    {statusBadge(p.status)}
                  </div>
                  <div className="text-xs text-steel-muted mt-0.5">
                    {p.project?.code ? `${p.project.code} · ` : ""}
                    {p.revisionLabel}
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-line overflow-hidden">
                    <div
                      className={`h-full ${pct === 100 ? "bg-ok" : "bg-brand"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-steel-muted mt-0.5">
                    BOQs {p.uploadProgress?.done ?? 0}/{p.uploadProgress?.total ?? 0}
                    {pct === 100 ? " · ready" : pct > 0 ? " · uploading" : " · pending"}
                  </div>
                </button>
              </li>
            );
          })}
          {!packagesForDesk.length && (
            <li className="px-4 py-8 text-sm text-steel-muted text-center space-y-3">
              <p className="font-semibold text-ink">No bid packages yet</p>
              <Button type="button" className="!text-xs" onClick={onNewBid}>
                Create first bid
              </Button>
            </li>
          )}
          {packagesForDesk.length > 0 && !filteredPackages.length && (
            <li className="px-4 py-6 text-xs text-steel-muted text-center">No bids match your search.</li>
          )}
        </ul>
      </aside>

      <div className="crm-bid-desk__main flex flex-col min-h-0">
        {showNewBidForm && (
          <div className="crm-bid-modal">
            <button type="button" className="crm-bid-modal__backdrop" aria-label="Close" onClick={onCloseNewBid} />
            <Card className="crm-bid-modal__panel !p-4">{newBidForm}</Card>
          </div>
        )}

        {detail ? (
          <>
            <BidFlowBar step={workflowStep} />
            <div className="crm-bid-hero">
              <div className="crm-bid-hero__title">{detail.title}</div>
              <div className="crm-bid-hero__meta">
                {detail.project?.code ? <span className="font-mono font-semibold">{detail.project.code}</span> : null}
                <span>{detail.revisionLabel}</span>
                {statusBadge(detail.status)}
                {detail.dueDate ? <span>Due {new Date(detail.dueDate).toLocaleDateString("en-IN")}</span> : null}
              </div>
              {detail.project?.name ? (
                <p className="text-xs text-steel-muted mt-1 line-clamp-2">{detail.project.name}</p>
              ) : null}
              <div className="crm-bid-hero__progress">
                <div className="crm-bid-hero__progress-bar">
                  <div
                    className={`crm-bid-hero__progress-fill${uploadedPct === 100 ? " is-complete" : ""}`}
                    style={{ width: `${uploadedPct}%` }}
                  />
                </div>
                <span className="text-xs text-steel-muted whitespace-nowrap">
                  {detail.uploadProgress?.done ?? 0}/{detail.uploadProgress?.total ?? 0} BOQs · {uploadedPct}%
                </span>
              </div>
              <div className="crm-bid-hero__actions">
                {(detail.status === "Draft" || detail.status === "Open") && (
                  <Button type="button" disabled={busy} onClick={onOpenBid}>
                    {detail.status === "Draft" ? "Open bid & notify" : "Resend invites"}
                  </Button>
                )}
                <Button type="button" variant="secondary" disabled={busy} onClick={onRefreshCompare}>
                  Refresh comparative
                </Button>
                {detail.status !== "Awarded" && vendorTotals.length === 1 && (
                  <Button type="button" variant="secondary" disabled={busy} onClick={() => onAward(vendorTotals[0].label)}>
                    Award {vendorTotals[0].label}
                  </Button>
                )}
              </div>
            </div>

            <div className="crm-bid-tabs" role="tablist">
              {(
                [
                  ["overview", "Overview"],
                  ["comparative", "Comparative"],
                  ["matrix", "BOQ matrix"],
                  ["manage", "Manage"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={mainTab === key}
                  className={`crm-bid-tabs__btn${mainTab === key ? " is-on" : ""}`}
                  onClick={() => onMainTab(key)}
                >
                  {label}
                  {key === "comparative" && hasCompare ? " ✓" : null}
                  {key === "matrix" && hasMatrix ? ` (${vendorMatrix.length})` : null}
                </button>
              ))}
            </div>

            <div className="crm-bid-tab-panel">
              {mainTab === "overview" && (
                <div className="space-y-4">
                  {detail.status === "Draft" && (
                    <Card className="!p-4 border-amber-300 bg-amber-50/70">
                      <p className="text-sm text-ink">
                        <strong>Draft</strong> — vendors cannot upload until you click{" "}
                        <strong>Open bid &amp; notify</strong>.
                      </p>
                    </Card>
                  )}
                  {accessSlip.length > 0 && (
                    <Card className="!p-4 border-amber-200 bg-amber-50/80">
                      <p className="text-xs font-semibold uppercase tracking-wide text-steel-muted mb-2">
                        Vendor access slip
                      </p>
                      {accessSlip.map((s) => (
                        <p key={s.email} className="font-mono text-xs">
                          {s.vendor} · {s.email} · {s.tempPassword}
                        </p>
                      ))}
                    </Card>
                  )}
                  {vendorTotals.length > 0 && (
                    <Card className="!p-4">
                      <p className="text-xs font-mono uppercase text-steel-muted mb-3">Bidder totals</p>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {vendorTotals.map((v) => (
                          <div
                            key={v.label}
                            className={`rounded-xl border p-3 ${v.isLowest ? "border-ok bg-ok/5" : "border-line bg-paper"}`}
                          >
                            <div className="font-semibold text-sm flex items-center gap-2">
                              {v.label}
                              {v.isLowest && <Badge tone="ok">L1</Badge>}
                            </div>
                            <div className="font-mono text-lg mt-1">{formatINR(v.total)}</div>
                            {detail.status !== "Awarded" && (
                              <Button
                                type="button"
                                className="!text-xs mt-2"
                                variant={v.isLowest ? "primary" : "secondary"}
                                disabled={busy}
                                onClick={() => onAward(v.label)}
                              >
                                Award bidder
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                  {detail.notes && (
                    <Card className="!p-4">
                      <p className="text-xs font-semibold text-steel-muted mb-1">Notes</p>
                      <p className="text-sm">{detail.notes}</p>
                    </Card>
                  )}
                  {!hasCompare && (
                    <p className="text-sm text-steel-muted">
                      Upload vendor BOQs on the <button type="button" className="text-brand font-semibold" onClick={() => onMainTab("matrix")}>BOQ matrix</button> tab, then refresh comparative.
                    </p>
                  )}
                </div>
              )}

              {mainTab === "comparative" && (
                <Card className="!p-4 min-w-0">
                  {summaryVendorGap && (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                      {summaryVendorGap.inSummaryOnly.length > 0 && (
                        <>Comparative lists vendors not on this package — add them under Manage, then refresh.</>
                      )}
                      {summaryVendorGap.inSlotsOnly.length > 0 && (
                        <>Some matrix bidders missing from totals — upload BOQs and refresh comparative.</>
                      )}
                    </p>
                  )}
                  <CrmComparativeRegister
                    summary={detail.summary}
                    summarySheetId={detail.summarySheetId}
                    masterSheetId={detail.comparativeSheetId}
                    revisionLabel={detail.revisionLabel}
                  />
                </Card>
              )}

              {mainTab === "matrix" && (
                <>
                  {hasMatrix ? (
                    <Card className="!p-4 min-w-0">
                      <CrmBidVendorMatrix
                        disciplines={detailDisciplines}
                        vendorMatrix={vendorMatrix}
                        grandTotals={detail.summary?.grandTotals}
                        lowestVendor={detail.summary?.lowestVendor}
                        onManageSlot={openSlotPanel}
                        onCopyLink={copyVendorLink}
                      />
                    </Card>
                  ) : (
                    <Card className="!p-6 text-center text-sm text-steel-muted">
                      No vendor BOQ slots yet — add bidders under Manage.
                    </Card>
                  )}
                  {slotPanel && selectedId && (
                    <div className="crm-bid-slot-panel">
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                        <div>
                          <h4 className="font-semibold text-sm">
                            {slotPanel.slot.vendorLabel} · {disciplineLabel(detailDisciplines, slotPanel.slot.discipline)}
                          </h4>
                          <p className="text-xs text-steel-muted mt-0.5">
                            Fill rates in portal or upload a completed Excel BOQ.
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
                                `SPDC-BOQ-${slotPanel.slot.discipline}-${slotPanel.slot.vendorLabel.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 40)}.xlsx`
                              )
                            }
                          >
                            Download template
                          </Button>
                          <Button type="button" variant="ghost" className="!text-xs" onClick={onCloseSlot}>
                            Close
                          </Button>
                        </div>
                      </div>
                      <div className="flex gap-2 mb-4">
                        <Button
                          type="button"
                          variant={slotPanel.tab === "edit" ? "primary" : "secondary"}
                          className="!text-xs"
                          onClick={() => onSlotTab("edit")}
                        >
                          Edit in portal
                        </Button>
                        <Button
                          type="button"
                          variant={slotPanel.tab === "upload" ? "primary" : "secondary"}
                          className="!text-xs"
                          onClick={() => onSlotTab("upload")}
                        >
                          Upload Excel
                        </Button>
                      </div>
                      {slotPanel.tab === "edit" ? (
                        <CrmBidBoqRegister
                          token={token!}
                          bidPackageId={selectedId}
                          slotId={slotPanel.slot.id}
                          title={`${slotPanel.slot.vendorLabel} — ${disciplineLabel(detailDisciplines, slotPanel.slot.discipline)}`}
                          sheetLabel={disciplineLabel(detailDisciplines, slotPanel.slot.discipline)}
                          canEdit={canManage}
                          onSaved={onSlotSaved}
                          onClose={onCloseSlot}
                        />
                      ) : (
                        <form className="space-y-3" onSubmit={onUploadBoq}>
                          <FilePickButton accept=".xlsx,.xls,.csv" onPick={(files) => onUploadFile(files[0] || null)}>
                            {uploadFile ? uploadFile.name : "Choose Excel BOQ"}
                          </FilePickButton>
                          <Button type="submit" disabled={!uploadFile || busy}>
                            {busy ? "Uploading…" : "Upload BOQ"}
                          </Button>
                        </form>
                      )}
                    </div>
                  )}
                </>
              )}

              {mainTab === "manage" && (
                <div className="space-y-4">
                  {canManage && token && detail && (
                    <Card className="!p-4">
                      <p className="text-xs font-semibold text-steel-muted mb-2">Package settings</p>
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
                        onChanged={onBidChanged}
                        onDeleted={onBidDeleted}
                      />
                    </Card>
                  )}
                  {managePanel}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="crm-bid-desk__empty flex-1">
            <BidFlowBar step={workflowStep} />
            <div className="text-4xl mt-4" aria-hidden>
              📋
            </div>
            <p className="font-semibold text-ink text-sm">Bid management desk</p>
            <p className="text-xs text-steel-muted max-w-md">
              Pick a project, create a bid package, invite vendors, collect BOQs, run the comparative, and award L1.
            </p>
            {setupProjectId ? (
              <Button type="button" onClick={onNewBid}>
                + New bid for {activeProject?.code || "this project"}
              </Button>
            ) : (
              <p className="text-xs">Select a project in the left rail to begin.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
