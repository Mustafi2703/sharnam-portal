import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import {
  CrmDetailLines,
  CrmDetailPanel,
  CrmStatusTimeline,
  CrmTextLineList,
} from "./crm/CrmDetailPanel";
import { RegisterEmptyRow, RegisterSheetFrame } from "./RegisterSheetFrame";
import { Button, Card, Input, Select } from "./ui";
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
  onRefresh?: () => void;
};

export function CrmProposalsRegister({ quotations, canWrite, onRefresh }: Props) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<(CrmQuotation & { log?: QuotationLogEntry[] }) | null>(null);
  const [awardBusy, setAwardBusy] = useState(false);
  const [awardMsg, setAwardMsg] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createLeadId, setCreateLeadId] = useState("");
  const [createClient, setCreateClient] = useState("");
  const [createQuotationNo, setCreateQuotationNo] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createMsg, setCreateMsg] = useState("");

  const statusOptions = useMemo(
    () => [...new Set(quotations.map((r) => r.status).filter(Boolean))].sort() as string[],
    [quotations],
  );

  const deferredQ = useDeferredValue(q);
  const filtered = useMemo(() => filterQuotations(quotations, { q: deferredQ, status }), [quotations, deferredQ, status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const selected = quotations.find((r) => r.id === selectedId) || null;

  useEffect(() => {
    setAwardMsg("");
  }, [selectedId]);

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
  const awardedProjectId = detail?.awardedProjectId || detail?.projectId || selected?.awardedProjectId || selected?.projectId;
  const isAwarded = (detail?.status || selected?.status || "").toLowerCase() === "awarded";
  const isLost = (detail?.status || selected?.status || "").toLowerCase() === "lost";

  async function openCreateModal(leadId = "", clientName = "") {
    setCreateLeadId(leadId);
    setCreateClient(clientName);
    setCreateMsg("");
    setCreateOpen(true);
    if (token) {
      try {
        const next = await api<{ quotationNo: string }>("/api/crm/quotations/next-number", { token });
        setCreateQuotationNo(next.quotationNo);
      } catch {
        setCreateQuotationNo("");
      }
    }
  }

  async function createProposal() {
    if (!token) return;
    const clientName = createClient.trim();
    const quotationNo = createQuotationNo.trim();
    if (!clientName) {
      setCreateMsg("Client name is required.");
      return;
    }
    if (!quotationNo) {
      setCreateMsg("Quotation number is required.");
      return;
    }
    setCreateBusy(true);
    setCreateMsg("");
    try {
      const row = await api<CrmQuotation>("/api/crm/quotations", {
        method: "POST",
        token,
        body: JSON.stringify({
          clientName,
          quotationNo,
          leadId: createLeadId || undefined,
        }),
      });
      setCreateOpen(false);
      onRefresh?.();
      navigate(`/crm/proposals/${row.id}`);
    } catch (err) {
      setCreateMsg(err instanceof Error ? err.message : "Could not create proposal");
    } finally {
      setCreateBusy(false);
    }
  }

  async function awardSelected() {
    if (!selectedId || !token) return;
    setAwardBusy(true);
    setAwardMsg("");
    try {
      const res = await api<{
        projectId?: string;
        alreadyAwarded?: boolean;
        project?: { id: string; code: string; name: string; status?: string };
      }>(`/api/crm/quotations/${selectedId}/award`, { method: "POST", token, body: JSON.stringify({}) });
      setAwardMsg(
        res.alreadyAwarded
          ? "Already awarded — continue setup on the projects register."
          : `${res.project?.code || "Project"} is on the register as Planning. Continue setup to pick parties and staff.`,
      );
      onRefresh?.();
      const row = await api<CrmQuotation & { log: QuotationLogEntry[] }>(`/api/crm/quotations/${selectedId}`, { token });
      setDetail(row);
    } catch (err) {
      setAwardMsg(err instanceof Error ? err.message : "Could not award this proposal");
    } finally {
      setAwardBusy(false);
    }
  }

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
            <Button type="button" variant="secondary" className="!py-1.5 !text-xs" onClick={() => void openCreateModal()}>
              + New proposal
            </Button>
          )}
          <span className="text-xs text-steel-muted font-mono whitespace-nowrap">
            {pageRows.length} of {filtered.length} · {quotations.length} total
          </span>
        </div>
      </div>

      <div className="grid xl:grid-cols-[1fr_360px] gap-3">
        <RegisterSheetFrame
          title="PMC proposals register"
          sheetLabel="SharePoint versions · Award → Planning project"
          rowCount={filtered.length}
          className="min-h-[420px]"
        >
          <table className="sheet-register__table min-w-[960px]">
            <thead>
              <tr>
                <th>Quotation no</th>
                <th>Client</th>
                <th>Status</th>
                <th>Ver</th>
                <th>Value</th>
                <th>Date</th>
                <th>Linked lead</th>
                <th>Project</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {!pageRows.length && <RegisterEmptyRow colSpan={9} message="No proposals match filters." />}
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
                  <td className="font-mono text-[10px] whitespace-nowrap">
                    R{row.currentRevisionNo ?? 0}
                    {row.revisions?.length ? ` · ${row.revisions.length}` : ""}
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
          emptyMessage="Select a proposal to view client lines, SharePoint versions, and Award."
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
                {awardMsg && <p className="text-xs text-ok leading-relaxed">{awardMsg}</p>}
                {driveUrl && (
                  <a
                    href={driveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-brand"
                  >
                    Open in SharePoint →
                  </a>
                )}
                <Link to={`/crm/proposals/${selected.id}`} className="text-sm font-semibold text-brand">
                  Open proposal + add revision →
                </Link>
                {(detail?.revisions || selected.revisions || []).length > 0 && (
                  <CrmTextLineList
                    title="SharePoint versions"
                    items={(detail?.revisions || selected.revisions || []).map(
                      (rev) => `R${rev.revisionNo} · ${rev.stage}${rev.fileName ? ` · ${rev.fileName}` : ""}`
                    )}
                  />
                )}
                {canWrite && !isAwarded && !isLost && (
                  <Button type="button" disabled={awardBusy} onClick={() => void awardSelected()}>
                    {awardBusy ? "Awarding…" : "Award → projects register"}
                  </Button>
                )}
                {isAwarded && awardedProjectId && (
                  <>
                    <Button type="button" onClick={() => navigate(`/crm/setup?projectId=${awardedProjectId}&step=project`)}>
                      Continue project setup
                    </Button>
                    <Link to="/crm/projects" className="text-sm font-semibold text-brand">
                      Open projects register →
                    </Link>
                  </>
                )}
                {canWrite && selected.leadId && !isAwarded && (
                  <button
                    type="button"
                    className="text-sm font-semibold text-brand text-left"
                    onClick={() =>
                      void openCreateModal(selected.leadId || "", selected.clientName || selected.lead?.title || "")
                    }
                  >
                    Another proposal on this lead →
                  </button>
                )}
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

      {createOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <Card className="w-full max-w-md space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-xl">New PMC proposal</h3>
                <p className="text-xs text-steel-muted mt-1">
                  Creates the SharePoint Word file in 05.03 / PMC_Proposals. Edit and add revisions on the proposal page.
                </p>
              </div>
              <Button type="button" variant="ghost" className="!text-xs" onClick={() => setCreateOpen(false)}>
                Close
              </Button>
            </div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-steel-muted">
              Quotation no
              <Input
                className="mt-1 font-mono"
                value={createQuotationNo}
                onChange={(e) => setCreateQuotationNo(e.target.value)}
                placeholder="SPDC/26-27/INQ/79"
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wider text-steel-muted">
              Client name
              <Input
                className="mt-1"
                value={createClient}
                onChange={(e) => setCreateClient(e.target.value)}
                placeholder="e.g. Arvind Limited"
                autoFocus
              />
            </label>
            {createLeadId ? (
              <p className="text-[11px] text-steel-muted">Linked to lead — award later puts the job on Projects as Planning.</p>
            ) : null}
            {createMsg ? <p className="text-xs text-danger">{createMsg}</p> : null}
            <div className="flex gap-2 pt-1">
              <Button type="button" disabled={createBusy} onClick={() => void createProposal()}>
                {createBusy ? "Creating…" : "Create proposal file"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
