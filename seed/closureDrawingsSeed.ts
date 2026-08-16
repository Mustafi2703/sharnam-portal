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

function registerRowPayload(row: unknown[]) {
  const delay = row[14];
  return {
    srNo: n(row[0]) || null,
    projectPackage: s(row[1], 80) || null,
    building: s(row[2], 80) || null,
    discipline: s(row[3], 80) || null,
    drawingTitle: s(row[5], 300),
    drawingType: s(row[6], 120) || null,
    consultantName: s(row[7], 120) || null,
    revisionNumber: s(row[8], 40) || null,
    revisionDate: excelDate(row[9]),
    revisionDescription: s(row[10], 400) || null,
    latestRevision: s(row[11], 20) || null,
    plannedSubmissionDate: excelDate(row[12]),
    actualSubmissionDate: excelDate(row[13]),
    submissionDelayDays: delay === "" || delay == null ? null : n(delay),
    delayResponsibility: s(row[15], 120) || null,
    issuedTo: s(row[16], 120) || null,
    issueDate: excelDate(row[17]),
    copiesCount: n(row[18]) || null,
    criticalDrawing: s(row[19], 20) || null,
    remarks: s(row[20], 400) || null,
    source: "DRAWING REGISTER - 01.xlsx",
  };
}

/** Workbook may repeat drawing numbers — keep every row via sr # suffix when needed. */
function uniqueRegisterNumber(base: string, srNo: number, seen: Map<string, number>) {
  const count = seen.get(base) || 0;
  seen.set(base, count + 1);
  if (count === 0) return base;
  return `${base} · ${srNo}`;
}

function disciplineFolder(discipline: string | null | undefined) {
  const d = (discipline || "General").toUpperCase();
  if (/MEP/i.test(d)) return "Drawings/MEP";
  if (/STRUCT/i.test(d)) return "Drawings/Structural";
  if (/ARCH/i.test(d)) return "Drawings/Architecture";
  if (/CIVIL/i.test(d)) return "Drawings/Civil";
  return "Drawings/General";
}

export async function seedDrawingRegisterFromWorkbook(
  prisma: PrismaClient,
  projectId: string,
  excelRoot: string
) {
  const file = path.join(excelRoot, "DRAWING REGISTER - 01.xlsx");
  if (!fs.existsSync(file)) return 0;
  await prisma.drawingRegisterLine.deleteMany({ where: { projectId, source: { contains: "DRAWING REGISTER" } } });
  const wb = XLSX.readFile(file);
  const rows = sheet(wb, /Master Drawing Register/i);
  const headerIdx = rows.findIndex((r) => /sr\s*#/i.test(String(r[0] ?? "").trim()));
  const seen = new Map<string, number>();
  let created = 0;
  for (let i = (headerIdx >= 0 ? headerIdx : 5) + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const sn = n(row[0]);
    const baseNumber = s(row[4], 80);
    const payload = registerRowPayload(row);
    if (!sn || !baseNumber || !payload.drawingTitle) continue;
    const drawingNumber = uniqueRegisterNumber(baseNumber, sn, seen);
    await prisma.drawingRegisterLine.create({
      data: {
        projectId,
        drawingNumber,
        ...payload,
      },
    });
    created++;
  }
  if (created) console.log("Drawing register lines seeded:", created);
  return created;
}

/** Published GFC drawings matching register numbers — for screenshot-ready GFC links. */
export async function seedGfcDrawingsFromRegister(
  prisma: PrismaClient,
  projectId: string,
  projectCode: string,
  uploadedById: string
) {
  const lines = await prisma.drawingRegisterLine.findMany({
    where: { projectId },
    orderBy: { srNo: "asc" },
  });
  if (!lines.length) return { created: 0, linked: 0 };

  const driveRoot = path.join(process.cwd(), "uploads", "onedrive", projectCode);
  let created = 0;
  let linked = 0;

  for (const line of lines) {
    const isGfc = /gfc|good for construction/i.test(line.drawingType || "");
    const publish = isGfc || /yes/i.test(line.latestRevision || "") || /yes/i.test(line.criticalDrawing || "");
    const folder = disciplineFolder(line.discipline);
    const absDir = path.join(driveRoot, folder.replace(/^Drawings\//, "Drawings/"));
    fs.mkdirSync(absDir, { recursive: true });
    const rev = (line.revisionNumber || "R0").replace(/\s+/g, "");
    const fileName = `${line.drawingNumber.replace(/[^\w.-]+/g, "_")}-${rev}-placeholder.txt`;
    const absFile = path.join(absDir, fileName);
    if (!fs.existsSync(absFile)) {
      fs.writeFileSync(
        absFile,
        `Mock GFC sheet ${line.drawingNumber} — ${line.drawingTitle}\n${line.drawingType || "Drawing"} · ${rev}\n`
      );
    }

    const drawing = await prisma.drawing.upsert({
      where: {
        projectId_drawingNumber: { projectId, drawingNumber: line.drawingNumber },
      },
      create: {
        projectId,
        drawingNumber: line.drawingNumber,
        title: line.drawingTitle,
        discipline: line.discipline || "General",
        buildingArea: line.building || line.projectPackage || "Site",
        currentRev: rev,
        status: publish ? "Approved" : "Draft",
        isPublished: publish,
        folderPath: folder,
        revisions: {
          create: {
            revisionNumber: rev,
            revisionLabel: `${rev} — ${line.drawingType || "Issue"}`,
            fileUrl: `/uploads/onedrive/${projectCode}/${folder}/${fileName}`,
            fileName,
            published: publish,
            uploadedById,
          },
        },
      },
      update: {
        title: line.drawingTitle,
        discipline: line.discipline || "General",
        buildingArea: line.building || line.projectPackage || "Site",
        currentRev: rev,
        isPublished: publish ? true : undefined,
        status: publish ? "Approved" : undefined,
      },
    });
    created++;

    if (line.drawingId !== drawing.id) {
      await prisma.drawingRegisterLine.update({
        where: { id: line.id },
        data: { drawingId: drawing.id },
      });
      linked++;
    }
  }

  if (created) console.log(`  GFC drawings from register (${projectCode}):`, created, "linked:", linked);
  return { created, linked };
}

const SNAGLIST_DEMO: [string, string, string, string, string, string, string, string][] = [
  ["1", "Package A", "Paint finish mismatch — main lobby", "Tower 1 GF", "Lobby", "Low", "Medium", "Open"],
  ["2", "Package A", "Door hardware alignment — corridor L3", "Tower 1 L3", "Corridor", "Medium", "High", "Open"],
  ["3", "MEP", "AC grille not flush — plant room", "Plant room", "MEP", "Low", "Low", "Closed"],
  ["4", "Package A", "Tile lippage > 2mm — washroom block B", "Tower 1 L2", "Washroom", "Medium", "High", "Open"],
  ["5", "Facade", "Sealant gap at curtain wall junction", "North elevation", "Facade", "High", "High", "Open"],
  ["6", "Electrical", "DB label missing — basement LT panel", "Basement", "Electrical", "Low", "Medium", "Open"],
  ["7", "Interior", "False ceiling access panel not provided", "Admin block L1", "Interior", "Low", "Low", "Closed"],
  ["8", "Civil", "Floor level variation at expansion joint", "Podium deck", "Civil", "Medium", "Medium", "Open"],
  ["9", "MEP", "Insulation damage on chilled water pipe", "Terrace plant", "MEP", "Medium", "High", "Open"],
  ["10", "Package A", "Handrail height non-compliant — stair 2", "Tower 1", "Stair", "High", "High", "Open"],
  ["11", "Landscape", "Irrigation head coverage gap — zone 3", "East lawn", "External", "Low", "Low", "Closed"],
  ["12", "Fire", "Hose reel cabinet door latch defective", "Basement parking", "Fire", "High", "High", "Open"],
];

async function seedSnaglistDemo(prisma: PrismaClient, projectId: string) {
  for (const d of SNAGLIST_DEMO) {
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
        raisedBy: "PMC Site Engineer",
        raisedOn: new Date(Date.now() - Number(d[0]) * 86400000),
        targetCompletionDate: new Date(Date.now() + 14 * 86400000),
        source: "Snaglist demo (screenshot pack)",
      },
    });
  }
  console.log("Snaglist demo rows seeded:", SNAGLIST_DEMO.length);
}

export async function seedClosureFromWorkbooks(prisma: PrismaClient, projectId: string, excelRoot: string) {
  await prisma.snagItem.deleteMany({ where: { projectId } });
  await prisma.lessonLearnt.deleteMany({ where: { projectId } });

  const snagFile = path.join(excelRoot, "Snaglist - Sharnam PMC.xlsx");
  if (fs.existsSync(snagFile)) {
    const wb = XLSX.readFile(snagFile);
    const rows = sheet(wb, /.*/);
    const headerIdx = rows.findIndex((r) => /s\.?\s*no/i.test(String(r[0] ?? "")) && /item description/i.test(String(r[2] ?? "")));
    let created = 0;
    const start = headerIdx >= 0 ? headerIdx + 1 : 3;
    for (let i = start; i < rows.length; i++) {
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
    if (!created) await seedSnaglistDemo(prisma, projectId);
    else console.log("Snaglist rows seeded:", created);
  } else {
    await seedSnaglistDemo(prisma, projectId);
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

  const openSnags = await prisma.snagItem.count({ where: { projectId, status: "Open" } });
  const closedSnags = await prisma.snagItem.count({ where: { projectId, status: "Closed" } });
  const totalSnags = openSnags + closedSnags;

  await prisma.projectClosureReport.upsert({
    where: { projectId },
    create: {
      projectId,
      title: "Project Closure Report — Safari Industrial Plant Halol",
      status: "In Review",
      summary:
        "PMC closure pack summarising snag clearance, lessons learnt, and handover documentation for client sign-off.",
      sectionsJson: JSON.stringify({
        projectOverview:
          "Safari Industrial Plant Halol — EPC delivery by Shapoorji Pallonji with Sharnam PMC oversight. Mechanical completion achieved; snag clearance and O&M handover in progress.",
        scopeDelivered:
          "Civil, structural, MEP, facade and interior works per approved GFC drawings. QAP sign-offs recorded for raft, superstructure and MEP testing.",
        snagSummary: `${totalSnags} snags logged — ${openSnags} open, ${closedSnags} closed. Priority items: facade sealant, stair handrail, fire hose reel.`,
        lessonsSummary:
          "Ground water table trial pits recommended at pre-construction; pile value-engineering saved time vs brick substructure in crane aisles.",
        handoverChecklist:
          "O&M manuals · as-built GFC register · test certificates · training attendance · warranty register · statutory approvals folder",
        clientSignOff: "Pending final snag walk — scheduled with Safari India project team.",
        pmcSignOff: "Sharnam PMC — draft closure report for client review.",
      }),
    },
    update: {
      title: "Project Closure Report — Safari Industrial Plant Halol",
      status: "In Review",
      summary:
        "PMC closure pack summarising snag clearance, lessons learnt, and handover documentation for client sign-off.",
      sectionsJson: JSON.stringify({
        projectOverview:
          "Safari Industrial Plant Halol — EPC delivery by Shapoorji Pallonji with Sharnam PMC oversight. Mechanical completion achieved; snag clearance and O&M handover in progress.",
        scopeDelivered:
          "Civil, structural, MEP, facade and interior works per approved GFC drawings. QAP sign-offs recorded for raft, superstructure and MEP testing.",
        snagSummary: `${totalSnags} snags logged — ${openSnags} open, ${closedSnags} closed. Priority items: facade sealant, stair handrail, fire hose reel.`,
        lessonsSummary:
          "Ground water table trial pits recommended at pre-construction; pile value-engineering saved time vs brick substructure in crane aisles.",
        handoverChecklist:
          "O&M manuals · as-built GFC register · test certificates · training attendance · warranty register · statutory approvals folder",
        clientSignOff: "Pending final snag walk — scheduled with Safari India project team.",
        pmcSignOff: "Sharnam PMC — draft closure report for client review.",
      }),
    },
  });
}

export async function seedClosureDrawingsForDemoProjects(
  prisma: PrismaClient,
  uploadedById?: string
) {
  const excelRoot = process.env.SHARNAM_EXCEL_ROOT || path.join(process.cwd(), "seed", "data");
  const uploader =
    uploadedById ||
    (await prisma.user.findFirst({ where: { email: "office@sharnam.demo" } }))?.id ||
    (await prisma.user.findFirst({ where: { email: "site@sharnam.demo" } }))?.id;
  if (!uploader) {
    console.warn("seedClosureDrawingsForDemoProjects: no uploader user — skip GFC drawings");
  }

  for (const code of ["SPDC-DEMO-01", "SPDC-PILOT-02"]) {
    const project = await prisma.project.findUnique({ where: { code } });
    if (!project) continue;
    console.log(`\n  Drawing register + closure — ${code}`);
    await seedDrawingRegisterFromWorkbook(prisma, project.id, excelRoot);
    await seedClosureFromWorkbooks(prisma, project.id, excelRoot);
    if (uploader) {
      await seedGfcDrawingsFromRegister(prisma, project.id, project.code, uploader);
    }
  }
}
