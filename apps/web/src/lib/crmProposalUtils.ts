import { fmtInr, fmtLeadDate, textToLineItems, type CrmLead } from "./crmLeadUtils";

export type CrmQuotation = {
  id: string;
  quotationNo: string;
  clientName: string;
  clientAddress?: string | null;
  clientGst?: string | null;
  scopeSummary?: string | null;
  totalValue?: number | null;
  currency?: string | null;
  status: string;
  validityDays?: number | null;
  quotationDate?: string | null;
  awardedAt?: string | null;
  attachmentUrl?: string | null;
  attachmentSharePointUrl?: string | null;
  leadId?: string | null;
  projectId?: string | null;
  lead?: CrmLead | null;
  project?: { id: string; code: string; name: string } | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type QuotationLogEntry = {
  id: string;
  action: string;
  createdAt: string;
  user?: { fullName?: string | null; email?: string | null } | null;
};

export const PROPOSAL_STATUSES = ["Draft", "Sent", "Negotiation", "Won", "Lost", "Awarded", "Editing", "Sent to client"] as const;

export function proposalStatusTone(status?: string | null): string {
  const s = (status || "Draft").toLowerCase();
  if (s.includes("won") || s.includes("awarded")) return "bg-emerald-600 text-white";
  if (s.includes("lost")) return "bg-stone-400 text-white";
  if (s.includes("negotiation")) return "bg-brand text-white";
  if (s.includes("sent")) return "bg-sky-600 text-white";
  if (s.includes("edit")) return "bg-amber-500/20 text-amber-900 dark:text-amber-200";
  return "bg-sand text-steel border border-line";
}

export function fmtProposalDate(v?: string | null): string {
  return fmtLeadDate(v);
}

export function proposalDetailLines(q: CrmQuotation) {
  return [
    { label: "Quotation no", value: q.quotationNo, mono: true },
    { label: "Client", value: q.clientName },
    { label: "Status", value: q.status },
    { label: "Total value", value: fmtInr(q.totalValue) },
    { label: "Currency", value: q.currency || "INR", mono: true },
    { label: "Quotation date", value: fmtProposalDate(q.quotationDate) },
    { label: "Validity", value: q.validityDays != null ? `${q.validityDays} days` : "—" },
    { label: "Awarded", value: fmtProposalDate(q.awardedAt) },
    { label: "Client address", value: q.clientAddress || "—" },
    { label: "Client GST", value: q.clientGst || "—", mono: true },
    { label: "Linked lead", value: q.lead?.title || "—" },
    { label: "Linked project", value: q.project ? `${q.project.code} — ${q.project.name}` : "—", mono: true },
    { label: "Created", value: fmtProposalDate(q.createdAt) },
    { label: "Updated", value: fmtProposalDate(q.updatedAt) },
  ];
}

export function filterQuotations(
  rows: CrmQuotation[],
  opts: { q: string; status: string },
): CrmQuotation[] {
  const q = opts.q.trim().toLowerCase();
  return rows.filter((r) => {
    if (opts.status && opts.status !== "all" && r.status !== opts.status) return false;
    if (!q) return true;
    const hay = [
      r.clientName,
      r.quotationNo,
      r.status,
      r.scopeSummary,
      r.lead?.title,
      r.project?.code,
      r.project?.name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function scopeLineItems(q: CrmQuotation): string[] {
  return textToLineItems(q.scopeSummary);
}

export function logTimelineEntries(log: QuotationLogEntry[]) {
  return log.map((e) => ({
    at: fmtProposalDate(e.createdAt),
    label: e.action,
    by: e.user?.fullName || e.user?.email || null,
  }));
}
