import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import type { PrismaClient } from "@prisma/client";

const AUDIT_PACK = path.join(process.cwd(), "docs/SITE_AUDIT_Pack.xlsx");
const KPI_PACK = path.join(process.cwd(), "docs/MASTER_KPI_DASHBOARD.xlsx");

function cell(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function num(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseChecklistSection(rows: unknown[][], promptCol = 1): { itemNo: number; prompt: string }[] {
  const out: { itemNo: number; prompt: string }[] = [];
  for (const row of rows) {
    const first = row[0];
    const n = num(first);
    if (n == null || n <= 0) continue;
    const prompt = cell(row[promptCol]);
    if (!prompt) continue;
    out.push({ itemNo: Math.trunc(n), prompt });
  }
  return out;
}

export type AuditKpiImportOpts = {
  auditBuffer?: Buffer;
  kpiBuffer?: Buffer;
};

export async function seedAuditKpiFromSheets(
  prisma: PrismaClient,
  projectId: string,
  opts?: AuditKpiImportOpts
) {
  const auditBuf =
    opts?.auditBuffer ?? (fs.existsSync(AUDIT_PACK) ? fs.readFileSync(AUDIT_PACK) : undefined);
  const kpiBuf = opts?.kpiBuffer ?? (fs.existsSync(KPI_PACK) ? fs.readFileSync(KPI_PACK) : undefined);

  if (!auditBuf && !kpiBuf) {
    console.warn("Audit/KPI packs missing — skip import");
    return { findings: 0, checklist: 0, subjects: 0, kras: 0 };
  }

  let findingCount = 0;
  let checklistCount = 0;
  let subjectCount = 0;
  let kraCount = 0;

  const audit = await prisma.siteAudit.upsert({
    where: { id: `${projectId}-audit-demo` },
    create: {
      id: `${projectId}-audit-demo`,
      projectId,
      title: "Site document audit",
      auditRef: "AUD-IMPORT",
      status: "InProgress",
      leadAuditor: "Document Controller",
      plannedDate: new Date(),
      scopeNotes: "Imported from SITE_AUDIT_Pack.xlsx",
    },
    update: { scopeNotes: "Imported from SITE_AUDIT_Pack.xlsx", updatedAt: new Date() },
  });

  if (auditBuf) {
    const awb = XLSX.read(auditBuf, { type: "buffer" });
    for (const [sheet, section] of [
      ["SITE_WALK", "SiteWalk"],
      ["DC_INTERVIEW", "DcInterview"],
      ["FOLDER_SAMPLE", "FolderSample"],
    ] as const) {
      const ws = awb.Sheets[sheet];
      if (!ws) continue;
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" }) as unknown[][];
      for (const it of parseChecklistSection(rows)) {
        await prisma.auditChecklistItem.upsert({
          where: { projectId_section_itemNo: { projectId, section, itemNo: it.itemNo } },
          create: {
            projectId,
            siteAuditId: audit.id,
            section,
            itemNo: it.itemNo,
            prompt: it.prompt,
          },
          update: { prompt: it.prompt },
        });
        checklistCount++;
      }
    }

    const findingsWs = awb.Sheets.FINDINGS;
    if (findingsWs) {
      const rows = XLSX.utils.sheet_to_json<unknown[]>(findingsWs, { header: 1, defval: "" }) as unknown[][];
      for (const row of rows) {
        const sr = num(row[0]);
        const findingNo = cell(row[1]);
        if (sr == null || !findingNo) continue;
        await prisma.auditFinding.upsert({
          where: { projectId_findingNo: { projectId, findingNo } },
          create: {
            projectId,
            siteAuditId: audit.id,
            srNo: Math.trunc(sr),
            findingNo,
            source: cell(row[2]) || null,
            refNo: cell(row[3]) || null,
            folderLocation: cell(row[4]) || null,
            description: cell(row[5]) || findingNo,
            photoRef: cell(row[6]) || null,
            severity: cell(row[7]) || "Minor",
            status: "Open",
          },
          update: {
            description: cell(row[5]) || findingNo,
            severity: cell(row[7]) || "Minor",
          },
        });
        findingCount++;
      }
    }
  }

  if (kpiBuf) {
    const kwb = XLSX.read(kpiBuf, { type: "buffer" });
    const subjectWs = kwb.Sheets["03_SUBJECT_DATA"];
    if (subjectWs) {
      const rows = XLSX.utils.sheet_to_json<unknown[]>(subjectWs, { header: 1, defval: "" }) as unknown[][];
      for (const row of rows) {
        const sr = num(row[0]);
        const isoArea = cell(row[1]);
        const name = cell(row[4]);
        if (sr == null || !isoArea || !name) continue;
        await prisma.kpiSubject.upsert({
          where: { projectId_srNo: { projectId, srNo: Math.trunc(sr) } },
          create: {
            projectId,
            srNo: Math.trunc(sr),
            isoArea,
            folder: cell(row[2]) || isoArea,
            isoClause: cell(row[3]) || null,
            name,
            custodian: cell(row[5]) || "HO",
            relativePath: cell(row[6]) || null,
            workbookFileName: cell(row[7]) || null,
            recordsCount: num(row[8]) ?? 0,
            openCount: num(row[9]) ?? 0,
            closedCount: num(row[10]) ?? 0,
            overdueCount: num(row[11]) ?? 0,
            pctClosed: num(row[12]),
            oldestOpenDays: num(row[13]),
            kraScore: num(row[14]),
            rag: cell(row[15]) || "UNUSED",
            lastRefreshedAt: new Date(),
          },
          update: {
            name,
            openCount: num(row[9]) ?? 0,
            closedCount: num(row[10]) ?? 0,
            overdueCount: num(row[11]) ?? 0,
            pctClosed: num(row[12]),
            rag: cell(row[15]) || "UNUSED",
            lastRefreshedAt: new Date(),
          },
        });
        subjectCount++;
      }
    }

    await prisma.kpiRoleKra.deleteMany({ where: { projectId } });
    const kraWs = kwb.Sheets["06_ROLE_KRA"];
    if (kraWs) {
      const rows = XLSX.utils.sheet_to_json<unknown[]>(kraWs, { header: 1, defval: "" }) as unknown[][];
      let roleKey = "";
      for (const row of rows) {
        const col0 = cell(row[0]);
        if (
          col0 &&
          !col0.startsWith("Owns") &&
          col0.length > 2 &&
          !col0.includes("ROLE KRA") &&
          !col0.includes("Project:") &&
          col0 !== "Holder:"
        ) {
          roleKey = col0.replace(/\s+$/, "");
        }
        if (col0.startsWith("Owns") && roleKey) {
          await prisma.kpiRoleKra.create({
            data: {
              projectId,
              roleKey,
              kraNo: "KRA1",
              description: col0,
              subjectCount: num(row[4]) ?? 127,
              redCount: num(row[5]) ?? 0,
              amberCount: num(row[6]) ?? 0,
              greenCount: num(row[7]) ?? 0,
            },
          });
          kraCount++;
        }
      }
    }

    if (kraCount === 0) {
      await prisma.kpiRoleKra.createMany({
        data: [
          {
            projectId,
            roleKey: "Project Manager",
            kraNo: "KRA1",
            description: "Owns all ISO areas — closure ≥ 90%",
            subjectCount: 127,
          },
          {
            projectId,
            roleKey: "Document Controller",
            kraNo: "KRA1",
            description: "Drawing register + folder sampling",
            subjectCount: 24,
          },
        ],
      });
      kraCount = 2;
    }
  }

  return { findings: findingCount, checklist: checklistCount, subjects: subjectCount, kras: kraCount };
}
