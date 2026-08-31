import { useMemo, useState } from "react";
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
import { CrmDetailLines, CrmDetailPanel, CrmTextLineList } from "./crm/CrmDetailPanel";
import { RegisterEmptyRow, RegisterSheetFrame } from "./RegisterSheetFrame";
import { Button, Input, Select } from "./ui";

const PAGE_SIZE = 50;

type Props = {
  leads: CrmLead[];
  canWrite: boolean;
  onConvert: (lead: CrmLead) => void;
  onStageChange: (leadId: string, stage: string) => Promise<void>;
  selectedId: string | null;
  onSelect: (lead: CrmLead | null) => void;
};

export function CrmLeadsRegister({
  leads,
  canWrite,
  onConvert,
  onStageChange,
  selectedId,
  onSelect,
}: Props) {
  const [q, setQ] = useState("");
  const [marketStatus, setMarketStatus] = useState("all");
  const [state, setState] = useState("all");
  const [segment, setSegment] = useState("all");
  const [pipelineStage, setPipelineStage] = useState("all");
  const [page, setPage] = useState(0);

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
    () => filterLeads(leads, { q, marketStatus, state, segment, pipelineStage }),
    [leads, q, marketStatus, state, segment, pipelineStage],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const selected = leads.find((l) => l.id === selectedId) || null;

  return (
    <div className="space-y-3 flex flex-col flex-1 min-h-0">
      <div className="grid lg:grid-cols-[1fr_auto] gap-3 items-end shrink-0">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
          <Input
            placeholder="Search project, district, status…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
          />
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

      <div className="grid xl:grid-cols-[1fr_340px] gap-3 flex-1 min-h-0">
        <RegisterSheetFrame
          title="Market intelligence register"
          sheetLabel="Data - July 2026 · Project Details"
          rowCount={filtered.length}
          className="min-h-[420px]"
        >
          <table className="sheet-register__table min-w-[1200px]">
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
                <th />
              </tr>
            </thead>
            <tbody>
              {!pageRows.length && <RegisterEmptyRow colSpan={10} message="No leads match filters." />}
              {pageRows.map((lead) => (
                <tr
                  key={lead.id}
                  className={selectedId === lead.id ? "bg-brand/5 cursor-pointer" : "cursor-pointer hover:bg-sand/30"}
                  onClick={() => onSelect(lead)}
                >
                  <td className="font-mono text-xs">{lead.srNo ?? "—"}</td>
                  <td className="font-medium max-w-[280px]">
                    <div className="line-clamp-2">{lead.title}</div>
                    {lead.projectType && (
                      <div className="text-[10px] text-steel-muted font-normal">{lead.projectType}</div>
                    )}
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
                  <td className="text-xs max-w-[140px]">
                    <span className="line-clamp-2">{lead.latestSubStatus || "—"}</span>
                  </td>
                  <td className="text-xs whitespace-nowrap">{fmtLeadDate(lead.latestStatusUpdate)}</td>
                  <td className="text-xs max-w-[160px]">
                    <span className="line-clamp-2">{leadLocation(lead)}</span>
                  </td>
                  <td className="text-[10px] uppercase font-mono max-w-[100px]">
                    <span className="line-clamp-2">{[lead.segment, lead.subSegment].filter(Boolean).join(" · ") || "—"}</span>
                  </td>
                  <td className="text-xs text-steel-muted max-w-[180px]">
                    <span className="line-clamp-2">{leadDescriptionPreview(lead)}</span>
                  </td>
                  <td>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${pipelineStageTone(lead.stage)}`}>
                      {lead.stage || "New"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap">
                    {lead.projectId ? (
                      <Link
                        to={`/projects/${lead.projectId}`}
                        className="text-[10px] font-semibold text-brand"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Open →
                      </Link>
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

        <CrmDetailPanel
          title="Lead detail"
          emptyMessage="Select a row to view full project intelligence and convert to SPDC project."
        >
          {selected && (
            <>
              <div>
                <div className="text-[10px] font-mono uppercase text-steel-muted">#{selected.srNo ?? "—"}</div>
                <h3 className="font-display text-lg leading-snug">{selected.title}</h3>
              </div>
              <div className="flex flex-wrap gap-1">
                {selected.latestStatus && (
                  <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${marketStatusTone(selected.latestStatus)}`}>
                    {selected.latestStatus}
                  </span>
                )}
                {selected.latestSubStatus && (
                  <span className="text-[10px] px-2 py-0.5 rounded border border-line text-steel-muted">{selected.latestSubStatus}</span>
                )}
                <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${pipelineStageTone(selected.stage)}`}>
                  {selected.stage || "New"}
                </span>
              </div>

              <CrmDetailLines lines={leadDetailLines(selected)} />

              {textToLineItems(selected.description).length > 0 && (
                <CrmTextLineList title="Project description" items={textToLineItems(selected.description)} />
              )}

              {canWrite && (
                <div className="space-y-2 border-t border-line pt-3">
                  <Link to={`/quotations/new?leadId=${selected.id}`} className="inline-flex text-sm font-semibold text-brand">
                    Create PMC proposal (Word in SharePoint) →
                  </Link>
                  <label className="text-[10px] font-mono uppercase text-steel-muted">Internal pipeline stage</label>
                  <Select
                    value={selected.stage || "New"}
                    onChange={(e) => void onStageChange(selected.id, e.target.value)}
                  >
                    {PIPELINE_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                  {selected.projectId ? (
                    <Link to={`/projects/${selected.projectId}`} className="inline-flex text-sm font-semibold text-brand">
                      Open converted project →
                    </Link>
                  ) : (
                    <Button type="button" className="w-full" onClick={() => onConvert(selected)}>
                      Convert to SPDC project
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </CrmDetailPanel>
      </div>

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
