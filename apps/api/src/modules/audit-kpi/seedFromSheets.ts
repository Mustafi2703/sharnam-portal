import fs from "fs";
import * as XLSX from "xlsx";
import type { PrismaClient } from "@prisma/client";
import type { DetailMap } from "./scoring.js";
import { auditKpiTemplatePaths } from "./templatePaths.js";

const AUDIT_PACK = auditKpiTemplatePaths().auditPack;
const KPI_PACK = auditKpiTemplatePaths().kpiPack;

function cell(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function dateCell(v: unknown): Date | null {
  const s = cell(v);
  if (!s || s.startsWith("=")) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function num(v: unknown): number | null {
  if (v === "" || v == null) return null;
  if (typeof v === "string" && v.startsWith("=")) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function rowsOf(wb: XLSX.WorkBook, sheet: string): unknown[][] {
  const ws = wb.Sheets[sheet];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" }) as unknown[][];
}

export type AuditKpiImportOpts = {
  auditBuffer?: Buffer;
  kpiBuffer?: Buffer;
  /** Add rows that are not there yet. Never rewrite scores or typed figures. */
  missingOnly?: boolean;
};

type ChecklistDraft = {
  section: string;
  itemNo: number;
  prompt: string;
  detail: DetailMap;
};

function walkRows(rows: unknown[][]): ChecklistDraft[] {
  const out: ChecklistDraft[] = [];
  let walkSection = "";
  for (const row of rows) {
    const n = num(row[0]);
    if (n == null || n <= 0) {
      const header = cell(row[0]);
      if (header && !header.startsWith("SITE WALK") && !header.startsWith("Physical") && !header.startsWith("Project:")) {
        walkSection = header;
      }
      continue;
    }
    const prompt = cell(row[1]);
    if (!prompt) continue;
    out.push({
      section: "SiteWalk",
      itemNo: Math.trunc(n),
      prompt,
      detail: walkSection ? { walkSection } : {},
    });
  }
  return out;
}

function interviewRows(rows: unknown[][]): ChecklistDraft[] {
  const out: ChecklistDraft[] = [];
  let questionGroup = "";
  for (const row of rows) {
    const n = num(row[0]);
    if (n == null || n <= 0) {
      const header = cell(row[0]);
      if (
        header &&
        !header.startsWith("DOCUMENT") &&
        !header.startsWith("Ask these") &&
        !header.startsWith("Interviewee") &&
        header !== "#"
      ) {
        questionGroup = header;
      }
      continue;
    }
    const prompt = cell(row[1]);
    if (!prompt) continue;
    out.push({
      section: "DcInterview",
      itemNo: Math.trunc(n),
      prompt,
      detail: questionGroup ? { questionGroup } : {},
    });
  }
  return out;
}

function folderRows(rows: unknown[][]): ChecklistDraft[] {
  const out: ChecklistDraft[] = [];
  let areaName = "";
  for (const row of rows) {
    const n = num(row[0]);
    if (n == null || n <= 0) {
      const header = cell(row[0]);
      if (/^\d{2}_/.test(header)) areaName = header;
      continue;
    }
    const subject = cell(row[4]);
    const folder = cell(row[2]);
    if (!subject && !folder) continue;
    out.push({
      section: "FolderSample",
      itemNo: Math.trunc(n),
      prompt: subject || folder,
      detail: {
        areaName,
        area: cell(row[1]),
        folder,
        custodian: cell(row[3]),
        subject,
        sampleToTake: cell(row[5]),
        mustBeTrue: cell(row[6]),
      },
    });
  }
  return out;
}

function planRows(rows: unknown[][]): ChecklistDraft[] {
  const out: ChecklistDraft[] = [];
  let block: "PlanDesk" | "PlanDay" | "PlanAfter" | "" = "";
  const counters = { PlanDesk: 0, PlanDay: 0, PlanAfter: 0 };
  for (const row of rows) {
    const a = cell(row[0]);
    const b = cell(row[1]);
    if (a.startsWith("BEFORE YOU GO")) {
      block = "PlanDesk";
      continue;
    }
    if (a.startsWith("THE DAY")) {
      block = "PlanDay";
      continue;
    }
    if (a.startsWith("AFTER THE AUDIT")) {
      block = "PlanAfter";
      continue;
    }
    if (a.startsWith("WHAT TO TAKE") || a.startsWith("RULES")) {
      block = "";
      continue;
    }
    if (!block) continue;
    if (a === "When" || a === "Time" || a === "•" || !b) continue;
    counters[block] += 1;
    if (block === "PlanDay") {
      out.push({
        section: block,
        itemNo: counters[block],
        prompt: b,
        detail: { when: a, testing: cell(row[2]), sheetRef: cell(row[3]) },
      });
    } else {
      out.push({
        section: block,
        itemNo: counters[block],
        prompt: b,
        detail: { when: a, why: cell(row[2]) },
      });
    }
  }
  return out;
}

async function ensureOpenAudit(prisma: PrismaClient, projectId: string) {
  const open = await prisma.siteAudit.findFirst({
    where: { projectId, NOT: { status: "Closed" } },
    orderBy: { createdAt: "desc" },
  });
  if (open) return open;
  const any = await prisma.siteAudit.findFirst({ where: { projectId }, orderBy: { createdAt: "desc" } });
  if (any) return any;
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { code: true } });
  const code = project?.code || "PROJECT";
  return prisma.siteAudit.create({
    data: {
      projectId,
      title: "Site document audit",
      auditRef: `SA/${code}/01`,
      status: "Planned",
    },
  });
}

/** Copy plan, interview, walk and folder prompts onto one audit. Scores are not written. */
export async function seedChecklistForAudit(
  prisma: PrismaClient,
  projectId: string,
  siteAuditId: string,
  auditBuffer?: Buffer
) {
  const buf = auditBuffer ?? (fs.existsSync(AUDIT_PACK) ? fs.readFileSync(AUDIT_PACK) : undefined);
  if (!buf) return { checklistAdded: 0 };
  const awb = XLSX.read(buf, { type: "buffer" });
  const drafts = [
    ...walkRows(rowsOf(awb, "SITE_WALK")),
    ...interviewRows(rowsOf(awb, "DC_INTERVIEW")),
    ...folderRows(rowsOf(awb, "FOLDER_SAMPLE")),
    ...planRows(rowsOf(awb, "PLAN")),
  ];
  let checklistAdded = 0;
  for (const it of drafts) {
    const existing = await prisma.auditChecklistItem.findFirst({
      where: { siteAuditId, section: it.section, itemNo: it.itemNo },
    });
    if (existing) continue;
    await prisma.auditChecklistItem.create({
      data: {
        projectId,
        siteAuditId,
        section: it.section,
        itemNo: it.itemNo,
        prompt: it.prompt,
        detailJson: JSON.stringify(it.detail),
      },
    });
    checklistAdded++;
  }
  return { checklistAdded };
}

export async function seedAuditKpiFromSheets(
  prisma: PrismaClient,
  projectId: string,
  opts?: AuditKpiImportOpts
) {
  const auditBuf =
    opts?.auditBuffer ?? (fs.existsSync(AUDIT_PACK) ? fs.readFileSync(AUDIT_PACK) : undefined);
  const kpiBuf = opts?.kpiBuffer ?? (fs.existsSync(KPI_PACK) ? fs.readFileSync(KPI_PACK) : undefined);

  if (!auditBuf && !kpiBuf) {
    console.warn("Audit/KPI packs missing - skip import");
    return { findings: 0, checklist: 0, checklistAdded: 0, subjects: 0, subjectsAdded: 0, kras: 0, krasAdded: 0 };
  }

  let findingCount = 0;
  let checklistCount = 0;
  let checklistAdded = 0;
  let subjectCount = 0;
  let subjectsAdded = 0;
  let kraCount = 0;
  let krasAdded = 0;

  const audit = await ensureOpenAudit(prisma, projectId);

  if (auditBuf) {
    const seeded = await seedChecklistForAudit(prisma, projectId, audit.id, auditBuf);
    checklistAdded = seeded.checklistAdded;
    checklistCount = seeded.checklistAdded;
    const awb = XLSX.read(auditBuf, { type: "buffer" });
    const findingRows = rowsOf(awb, "FINDINGS");
    for (const row of findingRows) {
      const sr = num(row[0]);
      const findingNo = cell(row[1]);
      if (sr == null || !findingNo || findingNo.startsWith("=")) continue;
      const description = cell(row[5]) || findingNo;
      const existing = await prisma.auditFinding.findUnique({
        where: { projectId_findingNo: { projectId, findingNo } },
      });
      if (!existing) {
        await prisma.auditFinding.create({
          data: {
            projectId,
            siteAuditId: audit.id,
            srNo: Math.trunc(sr),
            findingNo,
            source: cell(row[2]) || null,
            refNo: cell(row[3]) || null,
            folderLocation: cell(row[4]) || null,
            description,
            photoRef: cell(row[6]) || null,
            severity: cell(row[7]) || "Minor",
            rootCause: cell(row[8]) || null,
            correctiveAction: cell(row[9]) || null,
            preventiveAction: cell(row[10]) || null,
            owner: cell(row[11]) || null,
            dueDate: dateCell(row[12]),
            closedAt: dateCell(row[13]),
            verifiedBy: cell(row[16]) || null,
            status: cell(row[17]) || "Open",
          },
        });
      }
      findingCount++;
    }
  }

  if (kpiBuf) {
    const kwb = XLSX.read(kpiBuf, { type: "buffer" });
    for (const row of rowsOf(kwb, "03_SUBJECT_DATA")) {
      const sr = num(row[0]);
      const isoArea = cell(row[1]);
      const name = cell(row[4]);
      if (sr == null || !isoArea || !name || isoArea.startsWith("=")) continue;
      const srNo = Math.trunc(sr);
      const where = { projectId_srNo: { projectId, srNo } };
      const existing = await prisma.kpiSubject.findUnique({ where });
      const template = {
        isoArea,
        folder: cell(row[2]) || isoArea,
        isoClause: cell(row[3]) || null,
        name,
        custodian: cell(row[5]) || "HO",
        relativePath: cell(row[6]) || null,
        workbookFileName: cell(row[7]) || null,
      };
      const counted = {
        recordsCount: num(row[8]),
        openCount: num(row[9]),
        closedCount: num(row[10]),
        overdueCount: num(row[11]),
        oldestOpenDays: num(row[13]),
        kraScore: num(row[14]),
      };
      if (!existing) {
        await prisma.kpiSubject.create({
          data: {
            projectId,
            srNo,
            ...template,
            recordsCount: counted.recordsCount ?? 0,
            openCount: counted.openCount ?? 0,
            closedCount: counted.closedCount ?? 0,
            overdueCount: counted.overdueCount ?? 0,
            oldestOpenDays: counted.oldestOpenDays,
            kraScore: counted.kraScore,
            rag: "UNUSED",
            dataSource: "manual",
          },
        });
        subjectsAdded++;
      }
      subjectCount++;
    }

    let roleKey = "";
    let holder = "";
    for (const row of rowsOf(kwb, "06_ROLE_KRA")) {
      const col0 = cell(row[0]);
      const col1 = cell(row[1]);
      if (!col0 || col0.startsWith("ROLE KRA") || col0.startsWith("Key result") || col0.startsWith("Project:")) continue;
      if (col0 === "#" || col0 === "Owns") {
        if (col0 === "Owns" && roleKey) {
          if (await upsertKra(prisma, projectId, {
            roleKey,
            kraNo: "OWNS",
            lineKind: "owns",
            description: col1,
            holder,
          })) krasAdded++;
          kraCount++;
        }
        continue;
      }
      if (/^KRA\d+/i.test(col0)) {
        if (await upsertKra(prisma, projectId, {
          roleKey,
          kraNo: col0,
          lineKind: "kra",
          description: col1,
          consequence: cell(row[2]),
          evidenceHint: cell(row[3]),
          holder,
        })) krasAdded++;
        kraCount++;
        continue;
      }
      if (/^K\d+$/i.test(col0)) {
        if (await upsertKra(prisma, projectId, {
          roleKey,
          kraNo: col0,
          lineKind: "kpi",
          description: col1,
          target: cell(row[2]),
          holder,
        })) krasAdded++;
        kraCount++;
        continue;
      }
      if (col1) continue;
      roleKey = col0;
      holder = "";
    }
  }

  return { findings: findingCount, checklist: checklistCount, checklistAdded, subjects: subjectCount, subjectsAdded, kras: kraCount, krasAdded };
}

async function upsertKra(
  prisma: PrismaClient,
  projectId: string,
  row: {
    roleKey: string;
    kraNo: string;
    lineKind: string;
    description?: string;
    consequence?: string;
    evidenceHint?: string;
    target?: string;
    holder?: string;
  }
) {
  if (!row.roleKey) return false;
  const existing = await prisma.kpiRoleKra.findFirst({
    where: { projectId, roleKey: row.roleKey, kraNo: row.kraNo },
  });
  const data = {
    description: row.description || null,
    consequence: row.consequence || null,
    evidenceHint: row.evidenceHint || null,
    target: row.target || null,
    lineKind: row.lineKind,
    holder: row.holder || null,
  };
  if (existing) return false;
  await prisma.kpiRoleKra.create({
    data: { projectId, roleKey: row.roleKey, kraNo: row.kraNo, ...data },
  });
  return true;
}
