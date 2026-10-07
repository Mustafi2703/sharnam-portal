/**
 * Contractor action desk — everything waiting on a vendor across the projects it is assigned to:
 *   • Quality NCR / CAR issued to the company (respond: root cause, corrective action, evidence)
 *   • Safety NCR / observation / unsafe act issued to the company (respond; PMC verifies and closes)
 *   • RA bills and the stage each one is at (Submitted → Checked → Certified → COP)
 */
import type { PrismaClient, SafetyRecord } from "@prisma/client";

type VendorRef = { id: string; name: string; email?: string | null };

const norm = (s: string | null | undefined) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Company name match used across NCR / safety: either name contains the other's first words. */
function nameMatches(text: string | null | undefined, vendorName: string) {
  const t = norm(text);
  const v = norm(vendorName).replace(/\b(m s|pvt|private|ltd|limited|llp)\b/g, "").trim();
  if (!t || !v) return false;
  const key = v.split(" ").slice(0, 2).join(" ");
  return t.includes(key) || v.includes(t);
}

export function safetyRecordAssignedToVendor(
  r: Pick<SafetyRecord, "issuedTo" | "responsibleParty" | "assignedToId">,
  vendor: VendorRef,
  userId: string
) {
  return r.assignedToId === userId || nameMatches(r.issuedTo, vendor.name) || nameMatches(r.responsibleParty, vendor.name);
}

function ncrAssignedToVendor(n: { contractor: string | null; formDataJson: string | null }, vendor: VendorRef) {
  let form: Record<string, unknown> = {};
  try {
    form = JSON.parse(n.formDataJson || "{}");
  } catch {
    /* ignore */
  }
  if (form.contractorVendorId && String(form.contractorVendorId) === vendor.id) return true;
  if (vendor.email && String(form.contractorEmail || "").toLowerCase() === vendor.email.toLowerCase()) return true;
  return nameMatches(n.contractor, vendor.name);
}

export type VendorAction = {
  /** NCR · CAR · Safety NCR · Safety NCN · Safety observation / unsafe act … · RA bill */
  kind: string;
  id: string;
  projectId: string;
  projectCode: string;
  number: string;
  title: string;
  status: string;
  /** What the contractor has to do next */
  next: string;
  due: Date | null;
  raisedAt: Date | null;
  href: string;
  waitingOn: "contractor" | "pmc" | "done";
};

export async function vendorActions(prisma: PrismaClient, vendor: VendorRef, userId: string) {
  const links = await prisma.projectVendor.findMany({ where: { vendorId: vendor.id }, select: { projectId: true } });
  const projectIds = [...new Set(links.map((l) => l.projectId))];
  const [projects, ncrs, safety, ras] = await Promise.all([
    prisma.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, code: true, name: true } }),
    prisma.qualityNcr.findMany({ where: { projectId: { in: projectIds } }, orderBy: { createdAt: "desc" } }),
    prisma.safetyRecord.findMany({ where: { projectId: { in: projectIds } }, orderBy: { occurredAt: "desc" } }),
    prisma.raBill.findMany({ where: { vendorId: vendor.id }, orderBy: { createdAt: "desc" } }),
  ]);
  const code = new Map(projects.map((p) => [p.id, p.code]));
  const out: VendorAction[] = [];

  for (const n of ncrs) {
    if (!ncrAssignedToVendor(n, vendor)) continue;
    const isCar = /^CAR/i.test(n.number || "") || /car/i.test(n.ncrType || "");
    let form: Record<string, unknown> = {};
    try {
      form = JSON.parse(n.formDataJson || "{}");
    } catch {
      /* ignore */
    }
    const responded = !!(form.workCarriedOutNote || form.signedContractor || form.correctiveAction || form.contractorResponse || form.actionTaken);
    const closed = n.status === "Closed";
    out.push({
      kind: isCar ? "CAR" : "NCR",
      id: n.id,
      projectId: n.projectId,
      projectCode: code.get(n.projectId) || "",
      number: n.number || n.id.slice(-6),
      title: n.description,
      status: n.status,
      next: closed ? "Closed by PMC" : responded ? "Response sent — PMC to verify and close" : "Record the work carried out and sign the compliance response",
      due: n.plannedClosure,
      raisedAt: n.issueDate || n.createdAt,
      href: `/projects/${n.projectId}/ncr-form/quality/${n.id}`,
      waitingOn: closed ? "done" : responded ? "pmc" : "contractor",
    });
  }

  for (const r of safety) {
    // Notices that need a contractor response (not toolbox talks, inductions, JHAs …).
    if (!/ncr|ncn|observation|unsafe|near miss|site instruction/i.test(r.recordType)) continue;
    if (!safetyRecordAssignedToVendor(r, vendor, userId)) continue;
    const closed = r.status === "Closed";
    const responded = !!(r.actionTaken || r.correctiveAction || r.longTermAction);
    out.push({
      kind: /^nc[rn]$/i.test(r.recordType) ? `Safety ${r.recordType.toUpperCase()}` : `Safety · ${r.recordType}`,
      id: r.id,
      projectId: r.projectId,
      projectCode: code.get(r.projectId) || "",
      number: r.ncrNumber || `${r.recordType} ${r.id.slice(-5)}`,
      title: r.title,
      status: r.status,
      next: closed ? "Closed by PMC" : responded ? "Action recorded — PMC to verify and close" : "Record the action taken / corrective action",
      due: r.targetCompletion || r.followUpDate,
      raisedAt: r.occurredAt,
      href: `/projects/${r.projectId}/ncr-form/safety/${r.id}`,
      waitingOn: closed ? "done" : responded ? "pmc" : "contractor",
    });
  }

  for (const b of ras) {
    const s = b.status;
    const next =
      s === "Submitted"
        ? "With PMC for checking (Corrected workbook)"
        : s === "Checked" || s === "Corrected"
          ? "With PMC for certification"
          : s === "Certified"
            ? "Certified — COP being generated"
            : s === "COP generated"
              ? `COP ${b.copNo || ""} generated — payment in process`
              : s === "Paid"
                ? "Paid"
                : "Draft — submit with your bill workbook";
    out.push({
      kind: "RA bill",
      id: b.id,
      projectId: b.projectId,
      projectCode: code.get(b.projectId) || "",
      number: b.raNumber,
      title: `${b.discipline || ""} · ₹${Math.round(b.totalInvoiceWithoutGst).toLocaleString("en-IN")} excl. GST`,
      status: s,
      next,
      due: null,
      raisedAt: b.invoiceDate || b.createdAt,
      href: `/projects/${b.projectId}/finance?tab=ra`,
      waitingOn: s === "Paid" ? "done" : s === "Draft" ? "contractor" : "pmc",
    });
  }

  const rank = { contractor: 0, pmc: 1, done: 2 } as const;
  out.sort((a, b) => rank[a.waitingOn] - rank[b.waitingOn] || (b.raisedAt?.getTime() || 0) - (a.raisedAt?.getTime() || 0));
  return {
    vendor: { id: vendor.id, name: vendor.name },
    projects,
    counts: {
      contractor: out.filter((a) => a.waitingOn === "contractor").length,
      pmc: out.filter((a) => a.waitingOn === "pmc").length,
      done: out.filter((a) => a.waitingOn === "done").length,
    },
    actions: out,
  };
}
