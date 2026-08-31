export type CrmLead = {
  id: string;
  srNo?: number | null;
  title: string;
  stage?: string | null;
  latestStatus?: string | null;
  latestSubStatus?: string | null;
  latestStatusUpdate?: string | null;
  landmark?: string | null;
  district?: string | null;
  state?: string | null;
  pinCode?: string | null;
  segment?: string | null;
  subSegment?: string | null;
  sector?: string | null;
  projectType?: string | null;
  description?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  value?: number | null;
  projectId?: string | null;
  sourceSheet?: string | null;
};

export const PIPELINE_STAGES = ["New", "Qualified", "Proposal", "Negotiation", "Converted", "Lost"] as const;

export const MARKET_STATUSES = [
  "Under Construction",
  "Pre-Construction",
  "On Hold",
  "Proposed",
  "Under Approvals",
  "Land Acquisition",
] as const;

export function marketStatusTone(status?: string | null): string {
  const s = (status || "").toLowerCase();
  if (s.includes("under construction")) return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300";
  if (s.includes("pre-construction")) return "bg-sky-500/15 text-sky-900 dark:text-sky-300";
  if (s.includes("on hold")) return "bg-amber-500/15 text-amber-900 dark:text-amber-200";
  if (s.includes("proposed")) return "bg-violet-500/15 text-violet-900 dark:text-violet-300";
  if (s.includes("approval")) return "bg-orange-500/15 text-orange-900 dark:text-orange-200";
  if (s.includes("land")) return "bg-stone-500/15 text-stone-800 dark:text-stone-300";
  return "bg-brand/10 text-brand-dark";
}

export function pipelineStageTone(stage?: string | null): string {
  const s = stage || "New";
  if (s === "Converted") return "bg-emerald-600 text-white";
  if (s === "Lost") return "bg-stone-400 text-white";
  if (s === "Negotiation") return "bg-brand text-white";
  if (s === "Proposal") return "bg-indigo-600 text-white";
  if (s === "Qualified") return "bg-sky-600 text-white";
  return "bg-sand text-steel";
}

export function fmtLeadDate(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function leadLocation(lead: CrmLead): string {
  return [lead.landmark, lead.district, lead.state].filter(Boolean).join(" · ") || "—";
}

export function filterLeads(
  leads: CrmLead[],
  opts: {
    q: string;
    marketStatus: string;
    state: string;
    segment: string;
    pipelineStage: string;
  },
): CrmLead[] {
  const q = opts.q.trim().toLowerCase();
  return leads.filter((l) => {
    if (opts.marketStatus && opts.marketStatus !== "all" && l.latestStatus !== opts.marketStatus) return false;
    if (opts.state && opts.state !== "all" && l.state !== opts.state) return false;
    if (opts.segment && opts.segment !== "all" && l.segment !== opts.segment) return false;
    if (opts.pipelineStage && opts.pipelineStage !== "all" && (l.stage || "New") !== opts.pipelineStage) return false;
    if (!q) return true;
    const hay = [
      l.title,
      l.description,
      l.district,
      l.state,
      l.latestStatus,
      l.latestSubStatus,
      l.segment,
      l.subSegment,
      String(l.srNo ?? ""),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function countByField(leads: CrmLead[], field: keyof CrmLead): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of leads) {
    const k = String(l[field] || "—");
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

/** Split CRM description / notes into readable line items. */
export function textToLineItems(text?: string | null): string[] {
  if (!text?.trim()) return [];
  const byNewline = text
    .split(/\r?\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (byNewline.length > 1) return byNewline;
  const single = text.trim();
  const bySemi = single.split(/;\s+/).map((s) => s.trim()).filter(Boolean);
  if (bySemi.length > 1) return bySemi;
  return [single];
}

export function fmtInr(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export function leadDetailLines(lead: CrmLead) {
  return [
    { label: "Sr No", value: lead.srNo != null ? String(lead.srNo) : "—", mono: true },
    { label: "Market status", value: lead.latestStatus || "—" },
    { label: "Sub status", value: lead.latestSubStatus || "—" },
    { label: "Last updated", value: fmtLeadDate(lead.latestStatusUpdate) },
    { label: "Location", value: leadLocation(lead) },
    { label: "Landmark", value: lead.landmark || "—" },
    { label: "District", value: lead.district || "—" },
    { label: "State", value: lead.state || "—" },
    { label: "Pin code", value: lead.pinCode || "—", mono: true },
    { label: "Segment", value: lead.segment || "—" },
    { label: "Sub-segment", value: lead.subSegment || "—" },
    { label: "Sector", value: lead.sector || "—" },
    { label: "Project type", value: lead.projectType || "—" },
    { label: "Contact", value: lead.contactName || "—" },
    { label: "Email", value: lead.email || "—" },
    { label: "Phone", value: lead.phone || "—", mono: true },
    { label: "Est. value", value: fmtInr(lead.value) },
    { label: "Pipeline", value: lead.stage || "New" },
    { label: "Source sheet", value: lead.sourceSheet || "—" },
  ];
}

export function leadDescriptionPreview(lead: CrmLead, maxLen = 80): string {
  const items = textToLineItems(lead.description);
  if (!items.length) return "—";
  const first = items[0];
  if (first.length <= maxLen) return items.length > 1 ? `${first} (+${items.length - 1} lines)` : first;
  return `${first.slice(0, maxLen)}…`;
}
