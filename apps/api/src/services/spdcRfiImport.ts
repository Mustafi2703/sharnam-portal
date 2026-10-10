/**
 * Read SPDC_RFI_Form_and_Register.xlsx (sheet 04_RFI_REGISTER, header "RFI NO …") into the portal's RFI log.
 * One row → one RFI (upserted by number); a RESPONSE becomes an official response. The reverse of spdcRfiForm.ts.
 */
import XLSX from "../lib/xlsx.js";
import { prisma } from "../prisma.js";

function s(v: unknown) {
  return String(v ?? "").trim();
}
function d(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "number" && v > 20000) {
    const t = new Date(Date.UTC(1899, 11, 30));
    t.setUTCDate(t.getUTCDate() + Math.floor(v));
    return t;
  }
  const t = new Date(s(v));
  return Number.isNaN(t.getTime()) ? null : t;
}
const key = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export type RfiImportResult = { created: number; updated: number; responses: number; skipped: number; source: string };

export async function importSpdcRfiRegister(projectId: string, buffer: Buffer, userId: string, source = "upload.xlsx"): Promise<RfiImportResult> {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const name = wb.SheetNames.find((n) => /04.*rfi.*register|rfi register/i.test(n)) || wb.SheetNames.find((n) => /register/i.test(n)) || wb.SheetNames[0];
  const out: RfiImportResult = { created: 0, updated: 0, responses: 0, skipped: 0, source };
  if (!name) return out;
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: "", raw: true }) as unknown[][];
  const hi = rows.findIndex((r) => r.some((c) => key(s(c)) === "rfi no"));
  if (hi < 0) return out;
  const col = new Map<string, number>();
  rows[hi].forEach((h, i) => col.set(key(s(h)), i));
  const get = (r: unknown[], ...names: string[]) => {
    for (const n of names) {
      const i = col.get(key(n));
      if (i != null && r[i] !== "" && r[i] != null) return r[i];
    }
    return "";
  };
  const team = await prisma.user.findMany({ where: { role: { in: ["admin", "office"] } }, select: { id: true }, take: 1 });
  const fallbackResponder = userId || team[0]?.id;

  for (const r of rows.slice(hi + 1)) {
    const number = s(get(r, "RFI NO"));
    const subject = s(get(r, "SUBJECT"));
    if (!number || !subject || /^rfi no$/i.test(number)) {
      if (number || subject) out.skipped++;
      continue;
    }
    const statusRaw = s(get(r, "STATUS")).toLowerCase();
    const status = /clos/.test(statusRaw) ? "Closed" : /answer/.test(statusRaw) ? "Answered" : /void|withdraw/.test(statusRaw) ? "Closed" : "Open";
    const raised = d(get(r, "DATE RAISED"));
    const replyBy = d(get(r, "REPLY REQUIRED BY"));
    const closed = d(get(r, "DATE CLOSED"));
    const form = {
      revision: s(get(r, "REV")) || "0",
      package: s(get(r, "PACKAGE")),
      discipline: s(get(r, "DISCIPLINE")),
      category: s(get(r, "CATEGORY")),
      location: s(get(r, "LOCATION / GRID")),
      drawingRef: s(get(r, "DWG REF")),
      drawingRev: s(get(r, "DWG REV")),
      specClause: s(get(r, "SPEC CLAUSE")),
      queryRaised: s(get(r, "QUERY RAISED")),
      contractorSolution: s(get(r, "CONTRACTOR'S PROPOSED SOLUTION")),
      originator: s(get(r, "ORIGINATOR")),
      priority: s(get(r, "PRIORITY")).toUpperCase() || "NORMAL",
      slaDays: s(get(r, "SLA DAYS")),
      replyRequiredBy: replyBy ? replyBy.toISOString().slice(0, 10) : "",
      responsibleParty: s(get(r, "RESPONSIBLE PARTY")),
      respondedBy: s(get(r, "RESPONDED BY")),
      costImpact: s(get(r, "COST IMPACT")),
      estCostInr: s(get(r, "EST. COST (INR)")),
      timeImpact: s(get(r, "TIME IMPACT")),
      estDelayDays: s(get(r, "EST. DELAY (d)")),
      changeVoRef: s(get(r, "CHANGE / VO REF")),
      attachments: s(get(r, "ATTACHMENTS")),
      pmcRemarks: s(get(r, "PMC REMARKS")),
    };
    const data = {
      subject,
      question: form.queryRaised || subject,
      rfiKind: "RequestForInformation",
      irNumber: null as string | null,
      formDataJson: JSON.stringify(form),
      status,
      dueDate: replyBy,
      closedAt: status === "Closed" ? closed || new Date() : null,
      specSectionLink: form.specClause || null,
    };
    const existing = await prisma.rfi.findUnique({ where: { projectId_number: { projectId, number } }, select: { id: true } });
    const rfi = existing
      ? await prisma.rfi.update({ where: { id: existing.id }, data })
      : await prisma.rfi.create({
          data: { projectId, number, ...data, ballInCourt: status === "Open" ? "Assignee" : "Originator", createdById: userId, ...(raised ? { createdAt: raised } : {}) },
        });
    existing ? out.updated++ : out.created++;
    const response = s(get(r, "RESPONSE"));
    if (response && fallbackResponder) {
      const already = await prisma.rfiResponse.count({ where: { rfiId: rfi.id, responseText: response } });
      if (!already) {
        await prisma.rfiResponse.create({
          data: { rfiId: rfi.id, respondedById: fallbackResponder, responseText: response, isOfficialResponse: true, responseChannel: "Import", createdAt: d(get(r, "DATE RESPONDED")) || new Date() },
        });
        out.responses++;
      }
    }
  }
  return out;
}
