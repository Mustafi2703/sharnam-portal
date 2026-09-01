import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import {
  CrmDetailLines,
  CrmDetailPanel,
  CrmStatusTimeline,
  CrmTextLineList,
} from "./crm/CrmDetailPanel";
import { RegisterEmptyRow, RegisterSheetFrame } from "./RegisterSheetFrame";
import { Button, Input, Select } from "./ui";
import {
  type CrmQuotation,
  type QuotationLogEntry,
  filterQuotations,
  fmtProposalDate,
  logTimelineEntries,
  proposalDetailLines,
  proposalStatusTone,
  scopeLineItems,
} from "../lib/crmProposalUtils";

const PAGE_SIZE = 50;

type Props = {
  quotations: CrmQuotation[];
  canWrite: boolean;
};

export function CrmProposalsRegister({ quotations, canWrite }: Props) {
  const { token } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<(CrmQuotation & { log?: QuotationLogEntry[] }) | null>(null);

  const statusOptions = useMemo(
    () => [...new Set(quotations.map((r) => r.status).filter(Boolean))].sort() as string[],
    [quotations],
  );

  const filtered = useMemo(() => filterQuotations(quotations, { q, status }), [quotations, q, status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const selected = quotations.find((r) => r.id === selectedId) || null;

  useEffect(() => {
    if (!selectedId || !token) {
      setDetail(null);
      return;
    }
    void api<CrmQuotation & { log: QuotationLogEntry[] }>(`/api/crm/quotations/${selectedId}`, { token })
      .then(setDetail)
      .catch(() => setDetail(selected));
  }, [selectedId, token, selected]);

  const driveUrl = detail?.attachmentSharePointUrl || detail?.attachmentUrl || selected?.attachmentSharePointUrl || selected?.attachmentUrl;

  return (
    <div className="space-y-3 pb-2">
      <div className="grid lg:grid-cols-[1fr_auto] gap-3 items-end shrink-0">
        <div className="grid sm:grid-cols-2 gap-2">
          <Input
            placeholder="Search client, quotation no, project…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
          />
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">All statuses</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-center gap-2">
          {canWrite && (
            <Link to="/crm/proposals/new">
              <Button type="button" variant="secondary" className="!py-1.5 !text-xs">
                + New proposal
              </Button>
            </Link>
          )}
          <span className="text-xs text-steel-muted font-mono whitespace-nowrap">
            {pageRows.length} of {filtered.length} · {quotations.length} total
          </span>
        </div>
      </div>

      <div className="grid xl:grid-cols-[1fr_360px] gap-3">
        <RegisterSheetFrame
          title="PMC proposals register"
          sheetLabel="Quotation desk · Drive + status log"
          rowCount={filtered.length}
          className="min-h-[420px]"
        >
          <table className="sheet-register__table min-w-[960px]">
            <thead>
              <tr>
                <th>Quotation no</th>
                <th>Client</th>
                <th>Status</th>
                <th>Value</th>
                <th>Date</th>
                <th>Linked lead</th>
                <th>Project</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {!pageRows.length && <RegisterEmptyRow colSpan={8} message="No proposals match filters." />}
              {pageRows.map((row) => (
                <tr
                  key={row.id}
                  className={selectedId === row.id ? "bg-brand/5 cursor-pointer" : "cursor-pointer hover:bg-sand/30"}
                  onClick={() => setSelectedId(row.id)}
                >
                  <td className="font-mono text-xs whitespace-nowrap">{row.quotationNo}</td>
                  <td className="font-medium max-w-[200px]">
                    <div className="line-clamp-2">{row.clientName}</div>
                  </td>
                  <td>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${proposalStatusTone(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="text-xs font-mono whitespace-nowrap">
                    {row.totalValue != null && row.totalValue > 0
                      ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(row.totalValue)
                      : "—"}
                  </td>
                  <td className="text-xs whitespace-nowrap">{fmtProposalDate(row.quotationDate)}</td>
                  <td className="text-xs max-w-[160px]">
                    <span className="line-clamp-2">{row.lead?.title || "—"}</span>
                  </td>
                  <td className="font-mono text-[10px]">{row.project?.code || "—"}</td>
                  <td className="whitespace-nowrap">
                    <Link
                      to={`/crm/proposals/${row.id}`}
                      className="text-[10px] font-semibold text-brand"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Log →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </RegisterSheetFrame>

        <CrmDetailPanel
          title="Proposal detail"
          emptyMessage="Select a proposal to view client lines, scope, and status history."
        >
          {selected && (
            <>
              <div>
                <div className="text-[10px] font-mono uppercase text-steel-muted">{selected.quotationNo}</div>
                <h3 className="font-display text-lg leading-snug">{selected.clientName}</h3>
                <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded font-semibold ${proposalStatusTone(selected.status)}`}>
                  {selected.status}
                </span>
              </div>

              <CrmDetailLines lines={proposalDetailLines(detail || selected)} />

              {scopeLineItems(detail || selected).length > 0 && (
                <CrmTextLineList title="Scope summary" items={scopeLineItems(detail || selected)} />
              )}

              {detail?.log && detail.log.length > 0 && (
                <CrmStatusTimeline entries={logTimelineEntries(detail.log)} />
              )}

              <div className="flex flex-col gap-2 border-t border-line pt-3">
                {driveUrl && (
                  <a
                    href={driveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-brand"
                  >
                    Open in Drive →
                  </a>
                )}
                <Link to={`/crm/proposals/${selected.id}`} className="text-sm font-semibold text-brand">
                  Full status log →
                </Link>
                  <Link to={`/crm/proposals/new?leadId=${selected.id}`} className="text-sm font-semibold text-brand">
                    Create PMC proposal (Word in SharePoint) →
                  </Link>
              </div>
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
