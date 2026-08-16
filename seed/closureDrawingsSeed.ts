/**
 * Seed Drawing Register, Snaglist, Lessons Learnt, Closure report from client workbooks.
 */
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import type { PrismaClient } from "@prisma/client";

function n(v: unknown) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}
function s(v: unknown, max = 500) {
  const t = String(v ?? "").trim();
  return t ? t.slice(0, max) : "";
}
function excelDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === "number" && v > 20000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + Math.floor(v));
    return epoch;
  }
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function sheet(wb: XLSX.WorkBook, name: string | RegExp) {
  const key =
    typeof name === "string"
      ? wb.SheetNames.find((n) => n === name) || name
      : wb.SheetNames.find((n) => name.test(n));
  if (!key || !wb.Sheets[key]) return [] as unknown[][];
  return XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[key], {
    header: 1,
    defval: "",
  }) as unknown as unknown[][];
}

export async function seedDrawingRegisterFromWorkbook(
  prisma: PrismaClient,
  projectId: string,
  excelRoot: string
) {
  const file = path.join(excelRoot, "DRAWING REGISTER - 01.xlsx");
  if (!fs.existsSync(file)) return;
  await prisma.drawingRegisterLine.deleteMany({ where: { projectId, source: { contains: "DRAWING REGISTER" } } });
  const wb = XLSX.readFile(file);
  const rows = sheet(wb, /Master Drawing Register/i);
  const headerIdx = rows.findIndex((r) => String(r[0] ?? "").trim() === "Sr #");
  let created = 0;
  for (let i = (headerIdx >= 0 ? headerIdx : 5) + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const sn = n(row[0]);
    const drawingNumber = s(row[4], 80);
    const drawingTitle = s(row[5], 300);
    if (!sn || !drawingNumber || !drawingTitle) continue;
    await prisma.drawingRegisterLine.upsert({
      where: { projectId_drawingNumber: { projectId, drawingNumber } },
      create: {
        projectId,
        srNo: sn,
        projectPackage: s(row[1], 80) || null,
        building: s(row[2], 80) || null,
        discipline: s(row[3], 80) || null,
        drawingNumber,
        drawingTitle,
        drawingType: s(row[6], 120) || null,
        consultantName: s(row[7], 120) || null,
        revisionNumber: s(row[8], 40) || null,
        revisionDate: excelDate(row[9]),
        revisionDescription: s(row[10], 400) || null,
        latestRevision: s(row[11], 20) || null,
        plannedSubmissionDate: excelDate(row[12]),
        actualSubmissionDate: excelDate(row[13]),
        submissionDelayDays: n(row[14]) || null,
        delayResponsibility: s(row[15], 120) || null,
        issuedTo: s(row[16], 120) || null,
        issueDate: excelDate(row[17]),
        copiesCount: n(row[18]) || null,
        criticalDrawing: s(row[19], 20) || null,
        remarks: s(row[20], 400) || null,
        source: "DRAWING REGISTER - 01.xlsx",
      },
      update: {
        drawingTitle,
        discipline: s(row[3], 80) || null,
        drawingType: s(row[6], 120) || null,
        revisionNumber: s(row[8], 40) || null,
        criticalDrawing: s(row[19], 20) || null,
      },
    });
    created++;
  }
  if (created) console.log("Drawing register lines seeded:", created);
}

export async function seedClosureFromWorkbooks(prisma: PrismaClient, projectId: string, excelRoot: string) {
  await prisma.snagItem.deleteMany({ where: { projectId } });
  await prisma.lessonLearnt.deleteMany({ where: { projectId } });

  const snagFile = path.join(excelRoot, "Snaglist - Sharnam PMC.xlsx");
  if (fs.existsSync(snagFile)) {
    const wb = XLSX.readFile(snagFile);
    const rows = sheet(wb, /.*/);
    let created = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as unknown[];
      if (!/^\d+$/.test(s(row[0], 10))) continue;
      const desc = s(row[2], 400);
      if (!desc) continue;
      await prisma.snagItem.create({
        data: {
          projectId,
          srNo: n(row[0]) || null,
          package: s(row[1], 80) || null,
          itemDescription: desc,
          location: s(row[3], 120) || null,
          area: s(row[4], 80) || null,
          severity: s(row[5], 40) || "Medium",
          priority: s(row[6], 40) || "Medium",
          status: s(row[7], 40) || "Open",
          vendor: s(row[8], 120) || null,
          raisedBy: s(row[9], 120) || null,
          raisedOn: excelDate(row[10]),
          targetCompletionDate: excelDate(row[11]),
          source: "Snaglist - Sharnam PMC.xlsx",
        },
      });
      created++;
    }
    if (!created) {
      const demo = [
        ["1", "Package A", "Paint finish mismatch — lobby", "Tower 1 GF", "Lobby", "Low", "Medium", "Open"],
        ["2", "Package A", "Door hardware alignment", "Tower 1 L3", "Corridor", "Medium", "High", "Open"],
        ["3", "MEP", "AC grille not flush", "Plant room", "MEP", "Low", "Low", "Closed"],
      ];
      for (const d of demo) {
        await prisma.snagItem.create({
          data: {
            projectId,
            srNo: Number(d[0]),
            package: d[1],
            itemDescription: d[2],
            location: d[3],
            area: d[4],
            severity: d[5],
            priority: d[6],
            status: d[7],
            raisedBy: "PMC Site",
            raisedOn: new Date(),
            source: "Snaglist demo",
          },
        });
      }
      console.log("Snaglist demo rows seeded: 3");
    } else {
      console.log("Snaglist rows seeded:", created);
    }
  }

  const llFile = path.join(excelRoot, "Lessons Learnt - Sharnam PMC.xls");
  if (fs.existsSync(llFile)) {
    const wb = XLSX.readFile(llFile);
    const rows = sheet(wb, /Lessons Learnt/i);
    let created = 0;
    let pendingCategory = "";
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as unknown[];
      const sr = s(row[0], 10);
      const desc = s(row[1], 200);
      const well = s(row[2], 800);
      const bad = s(row[3], 800);
      const lesson = s(row[4], 800);
      if (/^s\.?\s*no/i.test(sr) || /^lessons learnt/i.test(desc)) continue;
      if (/^\d+$/.test(sr) && desc) pendingCategory = desc;
      if (!well && !bad && !lesson && !desc) continue;
      if (!pendingCategory && !desc && !lesson) continue;
      await prisma.lessonLearnt.create({
        data: {
          projectId,
          srNo: /^\d+$/.test(sr) ? n(sr) : null,
          category: pendingCategory || desc || null,
          description: desc || pendingCategory || null,
          wentWell: well || null,
          notMetExpectation: bad || null,
          lessonsLearnt: lesson || null,
          valueDifferentiator: s(row[5], 400) || null,
          source: "Lessons Learnt - Sharnam PMC.xls",
        },
      });
      created++;
    }
    console.log("Lessons learnt rows seeded:", created);
  }

  await prisma.projectClosureReport.upsert({
    where: { projectId },
    create: {
      projectId,
      title: "Project Closure Report",
      status: "Draft",
      summary: "Seeded from Project Closure Report template — complete sections and upload signed docx.",
      sectionsJson: JSON.stringify({
        projectOverview: "Project handover and closure documentation pack.",
        scopeDelivered: "As per approved GFC drawings and QAP sign-offs.",
        snagSummary: "Refer to Snaglist tab — target zero open snags before client sign-off.",
        lessonsSummary: "Refer to Lessons Learnt register.",
        handoverChecklist: "O&M manuals · as-built drawings · warranties · training log",
        clientSignOff: "",
        pmcSignOff: "",
      }),
    },
    update: {},
  });
}

export async function seedClosureDrawingsForDemoProjects(prisma: PrismaClient) {
  const excelRoot = process.env.SHARNAM_EXCEL_ROOT || path.join(process.cwd(), "seed", "data");
  for (const code of ["SPDC-DEMO-01", "SPDC-PILOT-02"]) {
    const project = await prisma.project.findUnique({ where: { code } });
    if (!project) continue;
    await seedDrawingRegisterFromWorkbook(prisma, project.id, excelRoot);
    await seedClosureFromWorkbooks(prisma, project.id, excelRoot);
  }
}
