import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  type CrmLead,
  PIPELINE_STAGES,
  filterLeads,
  fmtLeadDate,
  leadDetailLines,
  leadDescriptionPreview,
  leadLocation,
  marketStatusTone,
  pipelineStageTone,
  textToLineItems,
} from "../lib/crmLeadUtils";
import { CrmDetailLines, CrmTextLineList } from "./crm/CrmDetailPanel";
import { RegisterEmptyRow, RegisterSheetFrame } from "./RegisterSheetFrame";
import { Button, Input, Select } from "./ui";

const PAGE_SIZE = 50;

type BidPackageSummary = { id: string; status: string; uploadProgress?: { done: number; total: number } };

type Props = {
  leads: CrmLead[];
  canWrite: boolean;
  onConvert: (lead: CrmLead) => void;
  onSetupBids: (lead: CrmLead) => void;
  onStageChange: (leadId: string, stage: string) => Promise<void>;
  selectedId: string | null;
  onSelect: (lead: CrmLead | null) => void;
  bidPackagesByLeadId?: Record<string, BidPackageSummary[]>;
  defaultConversion?: "all" | "pipeline" | "converted";
};

function LeadDetailBody({
  lead,
  canWrite,
  onConvert,
  onSetupBids,
  onStageChange,
}: {
  lead: CrmLead;
  canWrite: boolean;
  onConvert: (lead: CrmLead) => void;
  onSetupBids: (lead: CrmLead) => void;
  onStageChange: (leadId: string, stage: string) => Promise<void>;
}) {
  return (
    <>
      <div>
        <div className="text-[10px] font-mono uppercase text-steel-muted">#{lead.srNo ?? "—"}</div>
        <h3 className="font-display text-xl leading-snug">{lead.title}</h3>
      </div>
      <div className="flex flex-wrap gap-1">
        {lead.latestStatus && (
          <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${marketStatusTone(lead.latestStatus)}`}>
            {lead.latestStatus}
          </span>
        )}
        {lead.latestSubStatus && (
          <span className="text-[10px] px-2 py-0.5 rounded border border-line text-steel-muted">{lead.latestSubStatus}</span>
        )}
        <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${pipelineStageTone(lead.stage)}`}>
          {lead.stage || "New"}
        </span>
      </div>

      <CrmDetailLines lines={leadDetailLines(lead)} />

      {textToLineItems(lead.description).length > 0 && (
        <CrmTextLineList title="Project description" items={textToLineItems(lead.description)} />
      )}

      {canWrite && (
        <div className="space-y-2 border-t border-line pt-3">
          <Link to={`/crm/proposals/new?leadId=${lead.id}`} className="inline-flex text-sm font-semibold text-brand">
            Create PMC proposal (Word in SharePoint) →
          </Link>
          <label className="text-[10px] font-mono uppercase text-steel-muted">Internal pipeline stage</label>
          <Select value={lead.stage || "New"} onChange={(e) => void onStageChange(lead.id, e.target.value)}>
            {PIPELINE_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          {lead.projectId ? (
            <>
              <Link to={`/projects/${lead.projectId}`} className="inline-flex text-sm font-semibold text-brand">
                Open converted project →
              </Link>
              <Button type="button" className="w-full" variant="secondary" onClick={() => onSetupBids(lead)}>
                Setup comparative bids →
              </Button>
            </>
          ) : (
            <Button type="button" className="w-full" onClick={() => onConvert(lead)}>
              Convert to SPDC project
            </Button>
          )}
        </div>
      )}
    </>
  );
}

export function CrmLeadsRegister({
  leads,
  canWrite,
  onConvert,
  onSetupBids,
  onStageChange,
  selectedId,
  onSelect,
  bidPackagesByLeadId = {},
  defaultConversion = "all",
}: Props) {
  const [q, setQ] = useState("");
  const [marketStatus, setMarketStatus] = useState("all");
  const [state, setState] = useState("all");
  const [segment, setSegment] = useState("all");
  const [pipelineStage, setPipelineStage] = useState("all");
  const [conversion, setConversion] = useState<"all" | "pipeline" | "converted">(defaultConversion);
  const [page, setPage] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);

  const marketOptions = useMemo(
    () => [...new Set(leads.map((l) => l.latestStatus).filter(Boolean))].sort() as string[],
    [leads],
  );
  const stateOptions = useMemo(
    () => [...new Set(leads.map((l) => l.state).filter(Boolean))].sort() as string[],
    [leads],
  );
  const segmentOptions = useMemo(
    () => [...new Set(leads.map((l) => l.segment).filter(Boolean))].sort() as string[],
    [leads],
  );

  const filtered = useMemo(
    () => filterLeads(leads, { q, marketStatus, state, segment, pipelineStage, conversion }),
    [leads, q, marketStatus, state, segment, pipelineStage, conversion],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const selected = leads.find((l) => l.id === selectedId) || null;

  useEffect(() => {
    if (!detailOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDetailOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailOpen]);

  function openLead(lead: CrmLead) {
    onSelect(lead);
    setDetailOpen(true);
  }

  function closeDetail() {
    setDetailOpen(false);
    onSelect(null);
  }

  return (
    <div className="space-y-3 pb-2 w-full min-w-0">
      <div className="grid lg:grid-cols-[1fr_auto] gap-3 items-end shrink-0">
        <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-2">
          <Input
            placeholder="Search project, district, status…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
          />
          <Select
            value={conversion}
            onChange={(e) => {
              setConversion(e.target.value as "all" | "pipeline" | "converted");
              setPage(0);
            }}
          >
            <option value="all">All leads</option>
            <option value="pipeline">Pipeline only</option>
            <option value="converted">Converted only</option>
          </Select>
          <Select
            value={marketStatus}
            onChange={(e) => {
              setMarketStatus(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">All market status</option>
            {marketOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">All states</option>
            {stateOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select
            value={segment}
            onChange={(e) => {
              setSegment(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">All segments</option>
            {segmentOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select
            value={pipelineStage}
            onChange={(e) => {
              setPipelineStage(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">All pipeline stages</option>
            {PIPELINE_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <div className="text-xs text-steel-muted font-mono whitespace-nowrap">
          Showing {pageRows.length} of {filtered.length} · {leads.length} total
        </div>
      </div>

      <RegisterSheetFrame
        title="Market intelligence register"
        sheetLabel="Data - July 2026 · Project Details"
        rowCount={filtered.length}
        className="min-h-[480px] w-full"
      >
        <table className="sheet-register__table min-w-[1480px] w-full">
          <thead>
            <tr>
              <th>Sr</th>
              <th>Project name</th>
              <th>Market status</th>
              <th>Sub status</th>
              <th>Updated</th>
              <th>Location</th>
              <th>Segment</th>
              <th>Description</th>
              <th>Pipeline</th>
              <th>Bids</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {!pageRows.length && <RegisterEmptyRow colSpan={11} message="No leads match filters." />}
            {pageRows.map((lead) => (
              <tr
                key={lead.id}
                className={selectedId === lead.id ? "bg-brand/5 cursor-pointer" : "cursor-pointer hover:bg-sand/30"}
                onClick={() => openLead(lead)}
              >
                <td className="font-mono text-xs">{lead.srNo ?? "—"}</td>
                <td className="font-medium min-w-[220px]">
                  <div>{lead.title}</div>
                  {lead.projectType && <div className="text-[10px] text-steel-muted font-normal">{lead.projectType}</div>}
                </td>
                <td>
                  {lead.latestStatus ? (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${marketStatusTone(lead.latestStatus)}`}>
                      {lead.latestStatus}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="text-xs min-w-[160px]">{lead.latestSubStatus || "—"}</td>
                <td className="text-xs whitespace-nowrap">{fmtLeadDate(lead.latestStatusUpdate)}</td>
                <td className="text-xs min-w-[180px]">{leadLocation(lead)}</td>
                <td className="text-[10px] uppercase font-mono min-w-[120px]">
                  {[lead.segment, lead.subSegment].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="text-xs text-steel-muted min-w-[240px]">{leadDescriptionPreview(lead)}</td>
                <td>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${pipelineStageTone(lead.stage)}`}>
                    {lead.projectId ? "Converted" : lead.stage || "New"}
                  </span>
                </td>
                <td className="text-xs whitespace-nowrap">
                  {lead.projectId ? (
                    (() => {
                      const pkgs = bidPackagesByLeadId[lead.id] || [];
                      if (!pkgs.length) return <span className="text-amber-700 font-semibold">Setup needed</span>;
                      const awarded = pkgs.some((p) => p.status === "Awarded");
                      const inProgress = pkgs.some((p) => (p.uploadProgress?.done || 0) < (p.uploadProgress?.total || 1));
                      if (awarded) return <span className="text-emerald-700 font-semibold">Awarded</span>;
                      if (inProgress) return <span className="text-brand font-semibold">In progress</span>;
                      return <span className="text-steel-muted">{pkgs.length} pkg(s)</span>;
                    })()
                  ) : (
                    "—"
                  )}
                </td>
                <td className="whitespace-nowrap">
                  <button
                    type="button"
                    className="text-[10px] font-semibold text-brand mr-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      openLead(lead);
                    }}
                  >
                    View
                  </button>
                  {lead.projectId ? (
                    <>
                      <button
                        type="button"
                        className="text-[10px] font-semibold text-brand mr-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSetupBids(lead);
                        }}
                      >
                        Bids →
                      </button>
                      <Link
                        to={`/projects/${lead.projectId}`}
                        className="text-[10px] font-semibold text-brand"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Project →
                      </Link>
                    </>
                  ) : canWrite ? (
                    <button
                      type="button"
                      className="text-[10px] font-semibold text-brand"
                      onClick={(e) => {
                        e.stopPropagation();
                        onConvert(lead);
                      }}
                    >
                      Convert
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </RegisterSheetFrame>

      {detailOpen && selected && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/45"
          role="dialog"
          aria-modal="true"
          aria-labelledby="crm-lead-detail-title"
          onClick={closeDetail}
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-line bg-paper shadow-xl p-5 sm:p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="crm-lead-detail-title" className="font-display text-lg text-ink">
                Lead intelligence
              </h2>
              <Button type="button" variant="ghost" className="!text-xs shrink-0" onClick={closeDetail}>
                Close
              </Button>
            </div>
            <LeadDetailBody
              lead={selected}
              canWrite={canWrite}
              onConvert={onConvert}
              onSetupBids={onSetupBids}
              onStageChange={onStageChange}
            />
          </div>
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 shrink-0">
          <Button type="button" variant="secondary" disabled={safePage <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            Previous
          </Button>
          <span className="text-xs font-mono text-steel-muted">
            Page {safePage + 1} / {pageCount}
          </span>
          <Button
            type="button"
            variant="secondary"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
