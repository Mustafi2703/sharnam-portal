import "dotenv/config";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";
import { seedCostFromBudgetWorkbook } from "./costFromBudget.ts";
import { seedChecklistFillsForReports, seedQualitySafetyFromSheets } from "./qualitySafetySheets.ts";
import { PrismaClient } from "@prisma/client";
import {
  DEFAULT_ROLE_PERMISSIONS,
  portalForRole,
  ROLES,
  type RoleKey,
} from "../packages/shared/src/index.ts";

const prisma = new PrismaClient();
const SEED_PASSWORD = process.env.SEED_PASSWORD || "Demo@1234";

const EXCEL_ROOT = path.resolve(
  process.env.SHARNAM_EXCEL_ROOT || process.cwd()
);

function readSheet(file: string, sheetIndex = 0) {
  if (!fs.existsSync(file)) {
    console.warn("Missing excel:", file);
    return [] as unknown[][];
  }
  const wb = XLSX.readFile(file);
  const name = wb.SheetNames[sheetIndex];
  return XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[name], {
    header: 1,
    defval: "",
  }) as unknown[][];
}

function excelDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 20000) return null;
  const ms = (n - 25569) * 86400 * 1000;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

function cellStr(v: unknown, max = 800): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.slice(0, max);
}

function cellNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}


async function seedRoles() {
  for (const key of ROLES) {
    await prisma.roleDefinition.upsert({
      where: { key },
      create: {
        key,
        label: key.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        portal: portalForRole(key),
        permissions: JSON.stringify(DEFAULT_ROLE_PERMISSIONS[key]),
        isSystem: true,
      },
      update: {
        permissions: JSON.stringify(DEFAULT_ROLE_PERMISSIONS[key]),
        portal: portalForRole(key),
      },
    });
  }
}

async function seedUsers() {
  const hash = await bcrypt.hash(SEED_PASSWORD, 10);
  const demos: { email: string; fullName: string; role: RoleKey }[] = [
    { email: "admin@sharnam.demo", fullName: "Admin User", role: "admin" },
    { email: "office@sharnam.demo", fullName: "Office Coordinator", role: "office" },
    { email: "site@sharnam.demo", fullName: "Site Engineer", role: "site_employee" },
    { email: "client@sharnam.demo", fullName: "Client Viewer", role: "client" },
    { email: "employee@sharnam.demo", fullName: "Demo Employee", role: "employee" },
    { email: "vendor@sharnam.demo", fullName: "Vendor Partner", role: "vendor" },
  ];

  const users = [];
  for (const d of demos) {
    const u = await prisma.user.upsert({
      where: { email: d.email },
      create: {
        email: d.email,
        fullName: d.fullName,
        role: d.role,
        portal: portalForRole(d.role),
        passwordHash: hash,
      },
      update: {
        fullName: d.fullName,
        role: d.role,
        portal: portalForRole(d.role),
        passwordHash: hash,
      },
    });
    users.push(u);
    if (d.role !== "client" && d.role !== "vendor") {
      await prisma.employeeProfile.upsert({
        where: { userId: u.id },
        create: {
          userId: u.id,
          empCode: `EMP-${d.role.toUpperCase().slice(0, 3)}`,
          department: d.role === "site_employee" ? "Site" : "Office",
          designation: d.fullName,
        },
        update: {},
      });
    }
  }
  return users;
}

/** Two separate families:
 *  - SiteExecution  → Final Index (site work / activity checklists)
 *  - QualityInspection → QA inspection forms (drawing review, pre-pour, etc.)
 */
async function seedChecklistsFromExcel() {
  const indexFile = path.join(EXCEL_ROOT, "Final Index.xlsx");
  const drawingFile = path.join(EXCEL_ROOT, "Drwing check master checklist.xlt.xls");

  // Reclassify legacy rows that all used checklistType "Quality"
  await prisma.checklistTemplate.updateMany({
    where: { OR: [{ source: "Final Index.xlsx" }, { source: "fallback-catalog" }] },
    data: { checklistType: "SiteExecution" },
  });
  await prisma.checklistTemplate.updateMany({
    where: {
      OR: [
        { source: "Drwing check master checklist.xlt.xls" },
        { name: { contains: "Drawing Review" } },
      ],
    },
    data: { checklistType: "DrawingCheck", requirePhotosMin: 0 },
  });
  await prisma.checklistTemplate.updateMany({
    where: { source: "quality-inspection-catalog" },
    data: { checklistType: "QualityInspection", requirePhotosMin: 3 },
  });

  const indexRows = readSheet(indexFile);
  let created = 0;
  // Final Index header is usually on row 3: Sr No | File Name | Work Category
  for (let i = 0; i < indexRows.length; i++) {
    const sr = String(indexRows[i][0] ?? "").trim();
    const name = String(indexRows[i][1] ?? "").trim();
    const category = String(indexRows[i][2] ?? "General").trim() || "General";
    if (!name || /^file name$/i.test(name) || /^sr\.?\s*no/i.test(sr)) continue;
    if (!/^\d+$/.test(sr)) continue;
    const existing = await prisma.checklistTemplate.findFirst({ where: { name, category } });
    if (existing) {
      if (existing.checklistType !== "SiteExecution") {
        await prisma.checklistTemplate.update({
          where: { id: existing.id },
          data: { checklistType: "SiteExecution", source: "Final Index.xlsx" },
        });
      }
      continue;
    }
    await prisma.checklistTemplate.create({
      data: {
        name,
        category,
        checklistType: "SiteExecution",
        source: "Final Index.xlsx",
        items: {
          create: [
            { itemCode: "1", description: `${name} — preliminary checks complete`, sortOrder: 1, section: "Pre-checks" },
            { itemCode: "2", description: "Materials verified as per approved brand", sortOrder: 2, section: "Pre-checks" },
            { itemCode: "3", description: "Setting out / levels verified on site", sortOrder: 3, section: "Execution" },
            { itemCode: "4", description: "Workmanship acceptable to PMC", sortOrder: 4, section: "Execution" },
            { itemCode: "5", description: "Safety precautions observed", sortOrder: 5, section: "Safety" },
            { itemCode: "6", description: "Ready for next activity / handover", sortOrder: 6, section: "Close-out" },
          ],
        },
      },
    });
    created++;
  }
  console.log("Site execution templates from Final Index:", created);

  // Fallback Final Index catalog when Excel is missing (e.g. empty deploy)
  const siteCount = await prisma.checklistTemplate.count({ where: { checklistType: "SiteExecution" } });
  if (siteCount < 5) {
    const fallback = [
      ["Mobilization", "Checklist For Pre-Construction & Mobilization"],
      ["Civil", "Checklist For Excavation Work"],
      ["Civil", "Checklist For Brick Masonry Work"],
      ["Civil", "Checklist For Block Work"],
      ["Civil", "Checklist For Filling Work"],
      ["Civil", "Checklist For Floor Trimix Work"],
      ["Civil", "Checklist For Anchor Bolt Fixing — PEB"],
      ["Civil", "Anti Termite Report"],
      ["Civil", "Aggregate Crushing Value Test"],
      ["MEP", "Checklist For Electrical Conduit Concealment"],
      ["MEP", "Checklist For Plumbing Rough-In"],
      ["MEP", "Checklist For Fire Fighting Installation"],
      ["Finishing", "Checklist For Plaster Work"],
      ["Finishing", "Checklist For Tile Flooring"],
      ["Handover", "Checklist For Handing Over Work"],
    ] as const;
    for (const [category, name] of fallback) {
      const existing = await prisma.checklistTemplate.findFirst({ where: { name } });
      if (existing) {
        await prisma.checklistTemplate.update({
          where: { id: existing.id },
          data: { checklistType: "SiteExecution", source: existing.source || "fallback-catalog" },
        });
        continue;
      }
      await prisma.checklistTemplate.create({
        data: {
          name,
          category,
          checklistType: "SiteExecution",
          source: "fallback-catalog",
          items: {
            create: [
              { itemCode: "1.0", description: "Approved drawing revision available on site", sortOrder: 1, section: "Pre-checks" },
              { itemCode: "2.0", description: "Materials verified as per approved brand/make", sortOrder: 2, section: "Pre-checks" },
              { itemCode: "3.0", description: "Setting out / levels verified", sortOrder: 3, section: "Execution" },
              { itemCode: "4.0", description: "Workmanship acceptable to PMC", sortOrder: 4, section: "Execution" },
              { itemCode: "5.0", description: "Safety precautions observed", sortOrder: 5, section: "Safety" },
              { itemCode: "6.0", description: "Ready for next activity / inspection", sortOrder: 6, section: "Close-out" },
            ],
          },
        },
      });
    }
  }

  // Quality inspection — Drawing review master (one template per discipline section)
  const drawRows = readSheet(drawingFile);
  let section = "General";
  const bySection = new Map<string, { itemCode: string; description: string; section: string; sortOrder: number }[]>();
  let order = 0;
  for (let i = 0; i < drawRows.length; i++) {
    const c0 = String(drawRows[i][0] ?? "").trim();
    const c1 = String(drawRows[i][1] ?? "").trim();
    const c2 = String(drawRows[i][2] ?? "").trim();
    const header = c0 || c1;
    if (/DRAWING REVIEW|CHECKLIST/i.test(header) && !c2) {
      section = header.replace(/^\d+\.\s*/, "").trim();
      if (!bySection.has(section)) bySection.set(section, []);
      order = 0;
      continue;
    }
    if (/^Sr\.?$/i.test(c0) || /^Sr\.?$/i.test(c1) || c1 === "Sr.") continue;
    const code = c0 && /^\d+/.test(c0) ? c0 : c1;
    const desc = c2 || (c0 && !/^\d+/.test(c0) ? "" : c1);
    // sheet layout: Sr | Check Point | Yes | No | N.A.
    const checkpoint = c1 && !/^Sr/i.test(c1) ? c1 : desc;
    if (!checkpoint || /Yes|No|N\.A/i.test(checkpoint)) continue;
    if (!bySection.has(section)) bySection.set(section, []);
    order++;
    bySection.get(section)!.push({
      itemCode: String(order),
      description: checkpoint,
      section,
      sortOrder: order,
    });
  }

  for (const [sec, items] of bySection) {
    if (!items.length) continue;
    const name = sec.length > 80 ? sec.slice(0, 77) + "…" : sec;
    const existing = await prisma.checklistTemplate.findFirst({ where: { name } });
    if (!existing) {
      await prisma.checklistTemplate.create({
        data: {
          name,
          category: "Drawings",
          checklistType: "DrawingCheck",
          source: "Drwing check master checklist.xlt.xls",
          instructions: "Complete before uploading any drawing or revision (GFC gate).",
          requirePhotosMin: 0,
          items: { create: items },
        },
      });
    } else {
      await prisma.checklistTemplate.update({
        where: { id: existing.id },
        data: {
          checklistType: "DrawingCheck",
          source: "Drwing check master checklist.xlt.xls",
          instructions: "Complete before uploading any drawing or revision (GFC gate).",
          requirePhotosMin: 0,
        },
      });
      if ((await prisma.checklistItem.count({ where: { templateId: existing.id } })) === 0) {
        await prisma.checklistItem.createMany({
          data: items.map((it) => ({ ...it, templateId: existing.id })),
        });
      }
    }
  }
  // Keep legacy single Architectural template updated if present
  const legacy = await prisma.checklistTemplate.findFirst({
    where: { name: "Architectural / Civil Drawing Review Checklist" },
  });
  if (legacy) {
    await prisma.checklistTemplate.update({
      where: { id: legacy.id },
      data: { checklistType: "DrawingCheck", requirePhotosMin: 0 },
    });
  }

  const qiFallback: { category: string; name: string; lines: string[] }[] = [
    {
      category: "Structural",
      name: "QI — Raft / Footing Pre-Pour Inspection",
      lines: [
        "Formwork alignment matches approved GFC",
        "Cover blocks / chairs in place",
        "Rebar size, spacing & lap as per schedule",
        "Construction joint prepared",
        "Embeds / sleeves verified",
        "Ready for concrete pour",
      ],
    },
    {
      category: "Structural",
      name: "QI — Slab / Beam Pre-Pour Inspection",
      lines: [
        "Soffit levels checked",
        "Prop / staging adequate",
        "Top & bottom reinforcement complete",
        "Electrical / plumbing inserts cast-in confirmed",
        "Cleaning completed; debris removed",
      ],
    },
    {
      category: "MEP",
      name: "QI — Electrical First Fix Inspection",
      lines: [
        "Conduit routes match coordinated GFC",
        "Box locations / heights correct",
        "Earthing continuity provisional OK",
        "No clashes with structural / HVAC",
      ],
    },
    {
      category: "Finishing",
      name: "QI — Waterproofing Inspection",
      lines: [
        "Surface preparation accepted",
        "Membrane / coating as approved system",
        "Overlaps / detailing at drains correct",
        "Flood / ponding test scheduled",
      ],
    },
  ];
  for (const q of qiFallback) {
    const existing = await prisma.checklistTemplate.findFirst({ where: { name: q.name } });
    if (existing) {
      await prisma.checklistTemplate.update({
        where: { id: existing.id },
        data: {
          checklistType: "QualityInspection",
          source: "quality-inspection-catalog",
          requirePhotosMin: 3,
          instructions: "Attach at least 3 site photos when filling this QI checklist.",
        },
      });
      continue;
    }
    await prisma.checklistTemplate.create({
      data: {
        name: q.name,
        category: q.category,
        checklistType: "QualityInspection",
        source: "quality-inspection-catalog",
        requirePhotosMin: 3,
        instructions: "Attach at least 3 site photos when filling this QI checklist.",
        items: {
          create: q.lines.map((description, i) => ({
            itemCode: `${i + 1}.0`,
            description,
            instruction: "Verify against approved GFC / ITP.",
            sortOrder: i + 1,
            section: i === q.lines.length - 1 ? "Close-out" : "Inspection",
            requirePhoto: i === 0,
          })),
        },
      },
    });
  }

  const safetyDefs = [
    {
      name: "PPE & Site Induction Checklist",
      lines: ["Helmet / shoes / vest worn", "Induction completed", "Work area barricaded"],
    },
    {
      name: "Safety NCR follow-up checklist",
      lines: ["NCR acknowledged", "Corrective action in place", "Photo evidence attached", "Closed with PMC sign-off"],
    },
  ];
  for (const s of safetyDefs) {
    const existing = await prisma.checklistTemplate.findFirst({ where: { name: s.name } });
    if (existing) {
      await prisma.checklistTemplate.update({
        where: { id: existing.id },
        data: { checklistType: "Safety", requirePhotosMin: 3 },
      });
      continue;
    }
    await prisma.checklistTemplate.create({
      data: {
        name: s.name,
        category: "Safety",
        checklistType: "Safety",
        source: "safety-catalog",
        requirePhotosMin: 3,
        instructions: "Safety fills require 3 photos. Raise SafetyChecklist RFI to assign filler.",
        items: {
          create: s.lines.map((description, i) => ({
            itemCode: `${i + 1}`,
            description,
            sortOrder: i + 1,
            requirePhoto: true,
          })),
        },
      },
    });
  }

  const siteN = await prisma.checklistTemplate.count({ where: { checklistType: "SiteExecution" } });
  const qiN = await prisma.checklistTemplate.count({ where: { checklistType: "QualityInspection" } });
  const dwN = await prisma.checklistTemplate.count({ where: { checklistType: "DrawingCheck" } });
  const safN = await prisma.checklistTemplate.count({ where: { checklistType: "Safety" } });
  console.log(`Checklist families — Site: ${siteN}, QI: ${qiN}, DrawingCheck: ${dwN}, Safety: ${safN}`);
}

async function seedProjectAndCost(users: { id: string; role: string }[]) {
  const project = await prisma.project.upsert({
    where: { code: "SPDC-DEMO-01" },
    create: {
      code: "SPDC-DEMO-01",
      name: "Sharnam Demo Dormitory Project",
      clientName: "Demo Client Corp",
      location: "Ahmedabad, Gujarat",
      status: "In Progress",
      notificationEmails: "office@sharnam.demo,client@sharnam.demo",
      emailFromName: "शरणम् Portal",
      emailEnabled: true,
      notifyOnDrawingPublish: true,
      notifyOnChecklistSubmit: true,
    },
    update: {
      notificationEmails: "office@sharnam.demo,client@sharnam.demo",
      emailFromName: "शरणम् Portal",
      emailEnabled: true,
    },
  });

  for (const u of users) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId: u.id } },
      create: { projectId: project.id, userId: u.id, role: u.role },
      update: {},
    });
  }

  // Ensure mock drive tree folders on disk + DB
  const driveRoot = path.join(process.cwd(), "uploads", "onedrive", project.code);
  const folders = [
    "Drawings",
    "Drawings/Architecture",
    "Drawings/Structural",
    "Drawings/MEP",
    "Drawings/Civil",
    "Documents",
    "Documents/Contracts",
    "Documents/Reports",
    "Photos",
    "Checklists",
  ];
  for (const rel of folders) {
    fs.mkdirSync(path.join(driveRoot, rel), { recursive: true });
    const name = rel.split("/").pop()!;
    const parentPath = rel.includes("/") ? rel.split("/").slice(0, -1).join("/") : null;
    await prisma.documentFolder.upsert({
      where: { projectId_path: { projectId: project.id, path: rel } },
      create: {
        projectId: project.id,
        path: rel,
        name,
        parentPath,
        mockDriveId: `mock-${project.code}-${rel}`,
        lastSyncedAt: new Date(),
      },
      update: { lastSyncedAt: new Date() },
    });
  }

  // Rich drawing register for demo walkthrough
  const officeId = users.find((u) => u.role === "office")?.id;
  const drawingSet: {
    drawingNumber: string;
    title: string;
    discipline: string;
    rev: string;
    published: boolean;
  }[] = [
    { drawingNumber: "A-101", title: "Ground Floor Plan", discipline: "Architecture", rev: "Rev C", published: true },
    { drawingNumber: "A-102", title: "First Floor Plan", discipline: "Architecture", rev: "Rev B", published: true },
    { drawingNumber: "A-103", title: "Second Floor Plan", discipline: "Architecture", rev: "Rev B", published: true },
    { drawingNumber: "A-104", title: "Terrace / Roof Plan", discipline: "Architecture", rev: "Rev A", published: true },
    { drawingNumber: "A-201", title: "Building Elevations — North & South", discipline: "Architecture", rev: "Rev B", published: true },
    { drawingNumber: "A-202", title: "Building Elevations — East & West", discipline: "Architecture", rev: "Rev B", published: true },
    { drawingNumber: "A-301", title: "Wall Sections & Details", discipline: "Architecture", rev: "Rev A", published: true },
    { drawingNumber: "A-401", title: "Door & Window Schedule", discipline: "Architecture", rev: "Rev A", published: false },
    { drawingNumber: "S-101", title: "Foundation Plan", discipline: "Structural", rev: "Rev C", published: true },
    { drawingNumber: "S-102", title: "Column Layout — Ground", discipline: "Structural", rev: "Rev B", published: true },
    { drawingNumber: "S-201", title: "Typical Floor Framing Plan", discipline: "Structural", rev: "Rev B", published: true },
    { drawingNumber: "S-301", title: "Beam / Slab Reinforcement Details", discipline: "Structural", rev: "Rev A", published: true },
    { drawingNumber: "S-401", title: "Staircase Structural Details", discipline: "Structural", rev: "Rev A", published: false },
    { drawingNumber: "E-101", title: "Electrical Lighting Layout — GF", discipline: "MEP", rev: "Rev B", published: true },
    { drawingNumber: "E-102", title: "Power & DB Layout — GF", discipline: "MEP", rev: "Rev A", published: true },
    { drawingNumber: "P-101", title: "Plumbing Water Supply Layout", discipline: "MEP", rev: "Rev B", published: true },
    { drawingNumber: "P-201", title: "Drainage & Soil Layout", discipline: "MEP", rev: "Rev A", published: true },
    { drawingNumber: "F-101", title: "Fire Fighting Layout", discipline: "MEP", rev: "Rev A", published: false },
    { drawingNumber: "C-101", title: "Site Grading & Road Layout", discipline: "Civil", rev: "Rev B", published: true },
    { drawingNumber: "C-201", title: "UG Tank & Drainage Network", discipline: "Civil", rev: "Rev A", published: true },
    { drawingNumber: "C-301", title: "Compound Wall Details", discipline: "Civil", rev: "Rev A", published: false },
  ];

  let firstDrawingId = "";
  let structuralDrawingId = "";
  let drawIdx = 0;
  for (const d of drawingSet) {
    drawIdx += 1;
    const folder = `Drawings/${d.discipline === "MEP" ? "MEP" : d.discipline}`;
    const fileName = `${d.drawingNumber}-placeholder.txt`;
    const absDir = path.join(driveRoot, folder);
    fs.mkdirSync(absDir, { recursive: true });
    fs.writeFileSync(
      path.join(absDir, fileName),
      `Mock IFC sheet ${d.drawingNumber} — ${d.title} (${d.rev})\nReplace with PDF via Office portal.`
    );
    const drawing = await prisma.drawing.upsert({
      where: {
        projectId_drawingNumber: { projectId: project.id, drawingNumber: d.drawingNumber },
      },
      create: {
        projectId: project.id,
        drawingNumber: d.drawingNumber,
        title: d.title,
        discipline: d.discipline,
        buildingArea: d.discipline === "Civil" ? "Site" : "Block A",
        tlNo: String((drawIdx % 5) + 1),
        currentRev: d.rev.replace("Rev ", "R"),
        status: d.published ? "Approved" : "Draft",
        isPublished: d.published,
        folderPath: folder,
        revisions: {
          create: {
            revisionNumber: d.rev.replace("Rev ", "R"),
            revisionLabel: `${d.rev.replace("Rev ", "R")} — IFC`,
            fileUrl: `/uploads/onedrive/${project.code}/${folder}/${fileName}`,
            fileName,
            published: d.published,
            uploadedById: officeId,
          },
        },
      },
      update: {
        title: d.title,
        discipline: d.discipline,
        buildingArea: d.discipline === "Civil" ? "Site" : "Block A",
        currentRev: d.rev.replace("Rev ", "R"),
        isPublished: d.published,
        status: d.published ? "Approved" : "Draft",
      },
    });
    if (!firstDrawingId) firstDrawingId = drawing.id;
    if (d.drawingNumber === "S-101") structuralDrawingId = drawing.id;

    // Extra R1 revision on published sheets so GFC R0/R1 date columns look like the Excel log
    if (d.published) {
      const revCount = await prisma.drawingRevision.count({ where: { drawingId: drawing.id } });
      if (revCount < 2) {
        const r1Name = `${d.drawingNumber}-R1-placeholder.txt`;
        fs.writeFileSync(
          path.join(absDir, r1Name),
          `Mock IFC sheet ${d.drawingNumber} — ${d.title} (R1)\nRevision uploaded after publish.\n`
        );
        await prisma.drawingRevision.create({
          data: {
            drawingId: drawing.id,
            revisionNumber: "R1",
            revisionLabel: "R1 — IFC revision",
            fileUrl: `/uploads/onedrive/${project.code}/${folder}/${r1Name}`,
            fileName: r1Name,
            published: true,
            uploadedById: officeId,
            createdAt: new Date(Date.now() - 3 * 86400000),
          },
        });
        await prisma.drawing.update({
          where: { id: drawing.id },
          data: { currentRev: "R1" },
        });
        // Backdate R0 createdAt so columns show distinct dates
        const r0 = await prisma.drawingRevision.findFirst({
          where: { drawingId: drawing.id, revisionNumber: { in: ["R0", "Rev 0", d.rev.replace("Rev ", "R")] } },
          orderBy: { createdAt: "asc" },
        });
        if (r0) {
          await prisma.drawingRevision.update({
            where: { id: r0.id },
            data: { createdAt: new Date(Date.now() - 14 * 86400000), revisionNumber: "R0", published: false },
          });
        }
      }
    }
  }
  console.log("Drawings seeded:", drawingSet.length);

  // Assign ALL checklist templates to the demo project
  const templates = await prisma.checklistTemplate.findMany();
  for (const t of templates) {
    await prisma.checklistAssignment.upsert({
      where: { projectId_templateId: { projectId: project.id, templateId: t.id } },
      create: { projectId: project.id, templateId: t.id },
      update: {},
    });
  }
  console.log("Checklist assignments:", templates.length);
  const drawing = { id: firstDrawingId };
  const structuralDrawing = { id: structuralDrawingId || firstDrawingId };

  const officeForSheets = users.find((u) => u.role === "office")?.id!;
  const siteForSheets = users.find((u) => u.role === "site_employee")?.id!;
  await seedQualitySafetyFromSheets(prisma, project.id, EXCEL_ROOT, siteForSheets || officeForSheets);
  await seedChecklistFillsForReports(prisma, project.id, siteForSheets || officeForSheets);

  // Cost sample from cashflow packages (fallback if budget workbook missing)
  const packages = [
    ["1", "Project Development Consultancy", "SPDC", 2400000, 1720000, 722795],
    ["3.1", "Construction cost for Dormitory blocks", "M/s Bhavna Infra", 57100727, 57673579, 20483680],
    ["4", "Electrical Package", "Pearl Electricals", 5258950, 7053515, 0],
    ["5", "Plumbing Package", "", 5258950, 0, 0],
    ["6", "Furniture Package", "", 9146000, 0, 0],
  ] as const;

  const existingBudget = await prisma.costBudgetLine.count({ where: { projectId: project.id } });
  if (existingBudget === 0) {
    for (const [sr, desc, stake, bud, wo, cert] of packages) {
      await prisma.costBudgetLine.create({
        data: {
          projectId: project.id,
          srNo: sr,
          description: desc,
          stakeholder: stake,
          budgetedAmount: bud,
          workOrderAmount: wo,
          certifiedAmount: cert,
        },
      });
    }
  }

  const existingCf = await prisma.costCashflowPeriod.count({ where: { projectId: project.id } });
  if (existingCf === 0) {
    const months = ["Oct-2025", "Nov-2025", "Dec-2025", "Jan-2026"];
    const planned = [6485619, 8564401, 5975619, 5975619];
    const actual = [5650000, 6735532, 4993250, 4930000];
    for (let i = 0; i < months.length; i++) {
      await prisma.costCashflowPeriod.create({
        data: {
          projectId: project.id,
          periodLabel: months[i],
          packageName: "Project cashflow",
          plannedAmount: planned[i],
          actualAmount: actual[i],
          progressPct: actual[i] / planned[i],
        },
      });
    }
  }

  // Measurement / Monitoring sheet from Cashflow Dashboard (skip long parent headers)
  const monCount = await prisma.costMonitoringLine.count({ where: { projectId: project.id } });
  if (monCount === 0) {
    const cashFile = path.join(EXCEL_ROOT, "Cashflow - Dashboard.xlsx");
    const monRows = readSheet(cashFile, 0);
    // Prefer Monitoring sheet by name
    let monData: unknown[][] = [];
    if (fs.existsSync(cashFile)) {
      const wb = XLSX.readFile(cashFile);
      const sheetName = wb.SheetNames.find((n) => /monitor/i.test(n)) || wb.SheetNames[5];
      if (sheetName) {
        monData = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[sheetName], {
          header: 1,
          defval: "",
        }) as unknown as unknown[][];
      }
    }
    let createdMon = 0;
    for (let i = 0; i < monData.length && createdMon < 40; i++) {
      const row = monData[i] as (string | number)[];
      const itemNo = String(row[0] ?? "").trim();
      const description = String(row[1] ?? "").trim();
      const uom = String(row[2] ?? "").trim();
      const rate = Number(row[3]) || 0;
      const boqQty = Number(row[4]) || 0;
      if (!description || description.length < 8) continue;
      if (!uom && !rate && !boqQty) continue; // skip parent narrative rows without UOM
      if (/^item no/i.test(itemNo) || /^item of work/i.test(description)) continue;
      const gfcQty = Number(row[6]) || 0;
      const achievedQty = Number(row[7]) || 0;
      const excessQty = Number(row[8]) || 0;
      await prisma.costMonitoringLine.create({
        data: {
          projectId: project.id,
          itemNo: itemNo || String(createdMon + 1),
          description: description.slice(0, 500),
          uom: uom || null,
          rate,
          boqQty,
          gfcQty,
          achievedQty,
          excessQty,
          boqCost: rate * boqQty,
        },
      });
      createdMon++;
    }
    console.log("Monitoring (measurement) lines seeded:", createdMon);
  }

  // Progress: refresh from client Excel packs (exact sheet data)
  await prisma.progressActivityLine.deleteMany({ where: { projectId: project.id } });
  await prisma.progressManpower.deleteMany({ where: { projectId: project.id } });
  await prisma.progressSorStat.deleteMany({ where: { projectId: project.id } });
  await prisma.progressLegalApproval.deleteMany({ where: { projectId: project.id } });
  await prisma.progressPlannedActual.deleteMany({ where: { projectId: project.id } });
  await prisma.progressRisk.deleteMany({ where: { projectId: project.id } });
  await prisma.progressHindrance.deleteMany({ where: { projectId: project.id } });
  await prisma.progressMilestone.deleteMany({ where: { projectId: project.id } });

  const overviewFile = path.join(EXCEL_ROOT, "Progress Overview.xlsx");
  const mileFile = path.join(EXCEL_ROOT, "Milestone tracking.xlsx");
  const plannedFile = path.join(EXCEL_ROOT, "Planned Vs. Actual Dashboard (1).xlsx");
  const monthlyFile = path.join(
    EXCEL_ROOT,
    fs.existsSync(path.join(EXCEL_ROOT, "Monthly Progress Dashboard (1).xlsx"))
      ? "Monthly Progress Dashboard (1).xlsx"
      : "Monthly Progress Dashboard.xlsx"
  );
  const hindFile = path.join(EXCEL_ROOT, "HInderance Register Dashboard (1).xlsx");

  {
    const file = fs.existsSync(mileFile) ? mileFile : overviewFile;
    const wb = XLSX.readFile(file);
    const sheet =
      wb.Sheets["Data Input"] ||
      wb.Sheets["Milestone"] ||
      wb.Sheets[wb.SheetNames.find((n) => /milestone|data input/i.test(n)) || wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: "" }) as unknown[][];
    let n = 0;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] as (string | number)[];
      const code = cellStr(row[0], 40);
      const activity = cellStr(row[2], 300);
      if (!code || !activity || !/^M\d+/i.test(code)) continue;
      const plannedDays = cellNum(row[5]);
      const actualDays = cellNum(row[8]);
      const delays = cellNum(row[14]);
      const pct = cellNum(row[10]);
      await prisma.progressMilestone.create({
        data: {
          projectId: project.id,
          code,
          category: cellStr(row[1], 80),
          activity,
          plannedStart: excelDate(row[3]),
          plannedEnd: excelDate(row[4]),
          plannedDays,
          actualStart: excelDate(row[6]),
          actualEnd: excelDate(row[7]),
          actualDays: actualDays > 0 ? actualDays : 0,
          varianceDays: delays || actualDays - plannedDays,
          weightage: cellNum(row[9]),
          pctComplete: pct > 1 ? pct / 100 : pct,
          stakeholder: cellStr(row[11], 80),
          zone: cellStr(row[12], 40),
          status: cellStr(row[13], 40) || "Planned",
        },
      });
      n++;
    }
    console.log("Milestones seeded:", n);
  }

  if (fs.existsSync(hindFile) || fs.existsSync(overviewFile)) {
    const file = fs.existsSync(hindFile) ? hindFile : overviewFile;
    const wb = XLSX.readFile(file);
    const sheetName = wb.SheetNames.find((n) => /hinder/i.test(n));
    const sheet = wb.Sheets["Hinderance Register"] || (sheetName ? wb.Sheets[sheetName] : undefined);
    if (sheet) {
      const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: "" }) as unknown[][];
      let n = 0;
      for (let i = 2; i < rows.length; i++) {
        const row = rows[i] as (string | number)[];
        const description = cellStr(row[1], 500);
        if (!description) continue;
        await prisma.progressHindrance.create({
          data: {
            projectId: project.id,
            description,
            location: cellStr(row[2], 120),
            activity: cellStr(row[3], 120),
            correspondence: cellStr(row[4], 120),
            category: cellStr(row[5], 80),
            type: cellStr(row[6], 200),
            occurredAt: excelDate(row[7]),
            resolvedAt: excelDate(row[8]),
            daysImpacted: cellNum(row[9]),
            baselineStart: excelDate(row[10]),
            scheduleImpact: cellNum(row[11]),
            delayType: cellStr(row[12], 80),
            accountable: cellStr(row[13], 80),
            status: cellStr(row[14], 40) || "Open",
            remarks: cellStr(row[15], 500),
          },
        });
        n++;
      }
      console.log("Hindrances seeded:", n);
    }
  }

  if (fs.existsSync(overviewFile)) {
    const wb = XLSX.readFile(overviewFile);
    const sheet = wb.Sheets["Risk Register"];
    if (sheet) {
      const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: "" }) as unknown[][];
      let n = 0;
      for (let i = 2; i < rows.length && n < 40; i++) {
        const row = rows[i] as (string | number)[];
        const code = cellStr(row[0], 20);
        const name = cellStr(row[3], 200);
        if (!code || !name || !/^R\d+/i.test(code)) continue;
        const probability = Math.min(5, Math.max(1, Math.round(cellNum(row[5]) || 1)));
        const consequence = Math.min(5, Math.max(1, Math.round(cellNum(row[6]) || 1)));
        await prisma.progressRisk.create({
          data: {
            projectId: project.id,
            code,
            category: cellStr(row[1], 80),
            opportunityThreat: cellStr(row[2], 40) || "Threat",
            name,
            description: cellStr(row[4], 1000),
            probability,
            consequence,
            severity: cellNum(row[7]) || probability * consequence,
            probabilityPct: cellNum(row[8]),
            costImpact: cellNum(row[9]),
            status: /complete|close|mitigat/i.test(String(row[11] || "")) ? "Closed" : "Open",
          },
        });
        n++;
      }
      console.log("Risks seeded:", n);
    }

    const legal = wb.Sheets["Legal Approval Tracker"];
    if (legal) {
      const rows = XLSX.utils.sheet_to_json<(string | number)[]>(legal, { header: 1, defval: "" }) as unknown[][];
      let n = 0;
      for (let i = 3; i < rows.length; i++) {
        const row = rows[i] as (string | number)[];
        const approvalId = cellStr(row[0], 40);
        const description = cellStr(row[3], 400);
        if (!approvalId || !description) continue;
        await prisma.progressLegalApproval.create({
          data: {
            projectId: project.id,
            approvalId,
            category: cellStr(row[1], 80),
            authority: cellStr(row[2], 120),
            description,
            packageName: cellStr(row[4], 120),
            submissionDate: excelDate(row[5]),
            requiredBy: excelDate(row[6]),
            receivedDate: excelDate(row[7]),
            status: cellStr(row[8], 40) || "Submitted",
            delayDays: cellNum(row[9]),
            responsible: cellStr(row[10], 80),
            remarks: cellStr(row[11], 300),
          },
        });
        n++;
      }
      console.log("Legal approvals seeded:", n);
    }
  }

  if (fs.existsSync(plannedFile)) {
    const wb = XLSX.readFile(plannedFile);
    const cashName = wb.SheetNames.find((n) => /cashflow/i.test(n));
    const cash = (cashName && wb.Sheets[cashName]) || wb.Sheets["Project Cashflow "];
    if (cash) {
      const rows = XLSX.utils.sheet_to_json<(string | number)[]>(cash, { header: 1, defval: "" }) as unknown[][];
      let n = 0;
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i] as (string | number)[];
        const month = cellStr(row[0], 40);
        const planned = cellNum(row[3]);
        if (!month || !planned) continue;
        const actual = cellNum(row[4]);
        await prisma.progressPlannedActual.create({
          data: {
            projectId: project.id,
            periodLabel: month,
            packageName: cellStr(row[1], 40) || "Overall",
            plannedAmount: planned,
            actualAmount: actual,
            plannedPct: planned ? 1 : 0,
            actualPct: planned ? Math.min(1.5, actual / planned) : 0,
          },
        });
        n++;
      }
      console.log("Planned vs Actual cashflow seeded:", n);
    }

    const man = wb.Sheets["Weekly Manpower"];
    if (man) {
      const rows = XLSX.utils.sheet_to_json<(string | number)[]>(man, { header: 1, defval: "" }) as unknown[][];
      let n = 0;
      for (let i = 2; i < rows.length; i++) {
        const row = rows[i] as (string | number)[];
        const trade = cellStr(row[0], 80);
        if (!trade || /total/i.test(trade) || /^date$/i.test(trade)) break;
        if (!cellNum(row[1]) && !cellNum(row[2])) continue;
        await prisma.progressManpower.create({
          data: {
            projectId: project.id,
            trade,
            required: cellNum(row[1]),
            available: cellNum(row[2]),
            shortage: cellNum(row[3]),
            shortagePct: cellNum(row[4]),
            rank: Math.round(cellNum(row[5])) || n + 1,
          },
        });
        n++;
      }
      console.log("Manpower rows seeded:", n);
    }

    const actName = wb.SheetNames.find((n) => /planned vs actual/i.test(n) && !/dashboard/i.test(n));
    const act = (actName && wb.Sheets[actName]) || wb.Sheets["Planned Vs Actual "];
    if (act) {
      const rows = XLSX.utils.sheet_to_json<(string | number)[]>(act, { header: 1, defval: "" }) as unknown[][];
      let n = 0;
      let lastTower = "";
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i] as (string | number)[];
        const sr = cellNum(row[0]);
        const activity = cellStr(row[2], 200);
        if (!sr || !activity) continue;
        const towerCell = cellStr(row[1], 80);
        if (towerCell) lastTower = towerCell;
        const tower = towerCell || lastTower || null;
        const gfc = cellNum(row[7]);
        const executed = cellNum(row[8]);
        await prisma.progressActivityLine.create({
          data: {
            projectId: project.id,
            srNo: sr,
            tower,
            activity,
            unit: cellStr(row[5], 20),
            plannedStart: excelDate(row[3]),
            plannedEnd: excelDate(row[4]),
            boqQty: cellNum(row[6]),
            gfcQty: gfc,
            executedQty: executed,
            balanceQty: cellNum(row[9]),
            weeklyPlanned: cellNum(row[10]),
            weeklyActual: cellNum(row[11]),
            cumulativeQty: cellNum(row[12]) || executed,
            status: cellStr(row[16], 40),
            pctComplete: gfc > 0 ? Math.min(1.2, executed / gfc) : cellNum(row[17]),
          },
        });
        n++;
      }
      console.log("Activity lines seeded:", n);
    }
  }

  if (fs.existsSync(monthlyFile)) {
    const wb = XLSX.readFile(monthlyFile);
    const sor = wb.Sheets["SOR Log"];
    if (sor) {
      const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sor, { header: 1, defval: "" }) as unknown[][];
      let n = 0;
      for (let i = 1; i < Math.min(rows.length, 6); i++) {
        const row = rows[i] as (string | number)[];
        const observation = cellStr(row[1], 120);
        if (!observation || !cellNum(row[0])) continue;
        await prisma.progressSorStat.create({
          data: {
            projectId: project.id,
            observation,
            total: cellNum(row[2]),
            openCount: cellNum(row[3]),
            closedCount: cellNum(row[4]),
            closureRate: cellNum(row[5]),
          },
        });
        n++;
      }
      console.log("Monthly SOR stats seeded:", n);
    }
  }

  // Cost from SPDC Budget workbook (Budget / Monitoring / MB / BBS / rate diffs)
  await seedCostFromBudgetWorkbook(prisma, project.id, EXCEL_ROOT);

  // Communications matrix defaults
  const matrixCount = await prisma.communicationMatrix.count({ where: { projectId: project.id } });
  if (matrixCount === 0) {
    const matrix = [
      ["Weekly Report", "office", "client", "Weekly", "Email"],
      ["Daily Diary Summary", "site_employee", "office", "Daily", "In-App"],
      ["RFI Update", "office", "client", "Ad-hoc", "Email"],
      ["Progress Photos", "site_employee", "client", "Weekly", "In-App"],
      ["Site Meeting MoM", "office", "client", "Weekly", "Email"],
    ] as const;
    for (const [type, from, to, freq, channel] of matrix) {
      await prisma.communicationMatrix.create({
        data: {
          projectId: project.id,
          communicationType: type,
          fromRole: from,
          toRole: to,
          frequency: freq,
          channel,
        },
      });
    }
  }

  // CRM / HRM sample
  const leadCount = await prisma.lead.count();
  if (leadCount === 0) {
    await prisma.lead.create({
      data: {
        title: "Warehouse expansion enquiry",
        contactName: "Ravi Patel",
        email: "ravi@example.com",
        stage: "Qualified",
        value: 15000000,
        ownerId: users.find((u) => u.role === "office")?.id,
      },
    });
    await prisma.deal.create({
      data: {
        name: "Dormitory PMC retainer",
        stage: "Closed Won",
        value: 2400000,
        projectId: project.id,
      },
    });
  }

  // Vendors / contractors / clients / PMC (directory parties)
  const vendorDefs = [
    {
      name: "M/s Bhavna Infra",
      partyType: "Contractor",
      trade: "Civil / Main Contractor",
      city: "Ahmedabad",
      state: "Gujarat",
      businessPhone: "+91 79 2650 1001",
      email: "projects@bhavnainfra.demo",
      primaryContactName: "Ketan Shah",
      gstNumber: "24AAAAA0000A1Z5",
      licenseNumber: "LIC-CIV-1042",
      isPrequalified: true,
      insuranceVerified: true,
    },
    {
      name: "TCC Projects PVT. LTD.",
      partyType: "Contractor",
      trade: "Civil Structural",
      city: "Ahmedabad",
      state: "Gujarat",
      email: "site@tcc.demo",
      primaryContactName: "Ramesh Desai",
      isPrequalified: true,
      insuranceVerified: true,
    },
    {
      name: "Pearl Electricals",
      partyType: "Vendor",
      trade: "Electrical",
      city: "Vadodara",
      state: "Gujarat",
      businessPhone: "+91 265 240 2200",
      email: "ops@pearl.demo",
      primaryContactName: "Meera Joshi",
      gstNumber: "24BBBBB0000B1Z5",
      isPrequalified: true,
      insuranceVerified: true,
    },
    {
      name: "AquaFlow MEP",
      partyType: "Vendor",
      trade: "Plumbing",
      city: "Surat",
      state: "Gujarat",
      email: "info@aquaflow.demo",
      primaryContactName: "Imran Khan",
      isPrequalified: false,
      insuranceVerified: true,
    },
    {
      name: "SteelForm Fabricators",
      partyType: "Vendor",
      trade: "Structural steel",
      city: "Rajkot",
      state: "Gujarat",
      email: "sales@steelform.demo",
      primaryContactName: "Nilesh Patel",
      isPrequalified: true,
      insuranceVerified: false,
    },
    {
      name: "Arvind Limited",
      partyType: "Client",
      trade: "Client / Owner",
      city: "Ahmedabad",
      state: "Gujarat",
      email: "projects@arvind.demo",
      primaryContactName: "Client PM",
      isPrequalified: true,
      insuranceVerified: true,
    },
    {
      name: "AK Consultant",
      partyType: "Consultant",
      trade: "Project Consultant",
      city: "Ahmedabad",
      state: "Gujarat",
      email: "ak@consultant.demo",
      primaryContactName: "A. Kumar",
      isPrequalified: true,
      insuranceVerified: true,
    },
    {
      name: "Sharnam Project Development Consultants & Co.",
      partyType: "PMC",
      trade: "PMC",
      city: "Ahmedabad",
      state: "Gujarat",
      email: "office@sharnam.demo",
      primaryContactName: "Office Coordinator",
      isPrequalified: true,
      insuranceVerified: true,
    },
  ] as const;

  for (const v of vendorDefs) {
    const existing = await prisma.vendor.findFirst({ where: { name: v.name } });
    const vendor = existing
      ? await prisma.vendor.update({
          where: { id: existing.id },
          data: { partyType: v.partyType, trade: v.trade, email: v.email, primaryContactName: v.primaryContactName },
        })
      : await prisma.vendor.create({
          data: { ...v, country: "India", createdVia: "Seed" },
        });
    await prisma.projectVendor.upsert({
      where: { projectId_vendorId: { projectId: project.id, vendorId: vendor.id } },
      create: { projectId: project.id, vendorId: vendor.id, tradeRole: v.trade, assignedVia: "Seed" },
      update: { tradeRole: v.trade },
    });
  }
  console.log("Directory parties seeded:", vendorDefs.length);

  const adminId = users.find((u) => u.role === "admin")?.id!;
  const siteId = users.find((u) => u.role === "site_employee")?.id!;
  const officeUserId = users.find((u) => u.role === "office")?.id!;

  // Sample RFI
  const rfiCount = await prisma.rfi.count({ where: { projectId: project.id } });
  if (rfiCount === 0 && drawing.id) {
    await prisma.rfi.create({
      data: {
        projectId: project.id,
        number: "RFI-001",
        subject: "Beam depth conflict at Grid B/3",
        question:
          "Structural S-201 shows 450mm beam; architectural ceiling void on A-301 allows only 380mm. Please confirm preferred resolution.",
        status: "Open",
        ballInCourt: "Assignee",
        assignedToId: officeUserId,
        createdById: siteId,
        linkedDrawingId: structuralDrawing.id,
        dueDate: new Date(Date.now() + 5 * 86400000),
        scheduleImpact: "Medium",
        costImpact: "Low",
      },
    });
  }

  // Sample QA inspection (gated by published drawings)
  const inspCount = await prisma.qualityInspection.count({ where: { projectId: project.id } });
  if (inspCount === 0 && structuralDrawing.id) {
    const insp = await prisma.qualityInspection.create({
      data: {
        projectId: project.id,
        title: "Raft foundation — Quality Action Plan",
        inspectionType: "Quality Action Plan",
        status: "Open",
        location: "Block A — Grid A1-D4",
        linkedDrawingId: structuralDrawing.id,
        trade: "Civil",
        createdById: officeUserId,
        assignedToId: siteId,
        dueDate: new Date(Date.now() + 2 * 86400000),
        items: {
          create: [
            { description: "Formwork alignment matches S-101", sortOrder: 1, dueDate: new Date(Date.now() + 1 * 86400000) },
            { description: "Cover blocks / chairs in place", sortOrder: 2, dueDate: new Date(Date.now() + 1 * 86400000) },
            { description: "Rebar size & spacing as per schedule", sortOrder: 3, dueDate: new Date(Date.now() + 2 * 86400000) },
            { description: "Construction joint prepared", sortOrder: 4, dueDate: new Date(Date.now() + 2 * 86400000) },
            {
              description: "Ready for concrete pour",
              sortOrder: 5,
              autoGenerateRfi: true,
              dueDate: new Date(Date.now() + 3 * 86400000),
            },
          ],
        },
      },
    });
    const inspFolder = path.join(driveRoot, "Inspections", "Structural");
    fs.mkdirSync(inspFolder, { recursive: true });
    fs.writeFileSync(
      path.join(inspFolder, `${insp.id}-meta.txt`),
      `Inspection: ${insp.title}\nLinked drawing: S-101\n`
    );
  }

  // Submittal + coordination sample
  if ((await prisma.submittal.count({ where: { projectId: project.id } })) === 0) {
    await prisma.submittal.create({
      data: {
        projectId: project.id,
        number: "SUB-001",
        title: "AAC block manufacturer data",
        submittalType: "Product Data",
        status: "Open",
        ballInCourt: "Reviewer",
        specSection: "04 22 00",
      },
    });
  }
  if ((await prisma.designCoordinationIssue.count({ where: { projectId: project.id } })) === 0) {
    await prisma.designCoordinationIssue.create({
      data: {
        projectId: project.id,
        title: "AHU duct vs beam clash — Level 1 corridor",
        description: "400x600 duct conflicts with secondary beam at Grid C.",
        discipline: "MEP",
        location: "L1 corridor",
        priority: "High",
      },
    });
  }

  // Sample meeting for MoM demo
  if ((await prisma.meeting.count({ where: { projectId: project.id } })) === 0) {
    await prisma.meeting.create({
      data: {
        projectId: project.id,
        title: "Weekly Site Coordination",
        meetingDate: new Date(),
        location: "Site cabin / Teams",
        status: "Agenda",
        items: {
          create: [
            {
              category: "Quality",
              description: "Confirm GFC publish for Block A elevations",
              priority: "High",
              resolutionStatus: "Open",
              assignedToId: officeUserId,
            },
            {
              category: "Safety",
              description: "Edge protection on Level 2 balcony",
              priority: "Medium",
              resolutionStatus: "Open",
              assignedToId: siteId,
            },
            {
              category: "General",
              description: "Vendor induction for Pearl Electricals completed",
              priority: "Low",
              resolutionStatus: "Closed",
            },
          ],
        },
      },
    });
  }

  // Safety records are refreshed from Safety NCR.xlsx in seedQualitySafetyFromSheets

  // Ensure Inspections / RFIs folders exist in mock drive
  for (const rel of [
    "Inspections",
    "Inspections/Architecture",
    "Inspections/Structural",
    "Inspections/MEP",
    "Inspections/Civil",
    "RFIs",
    "Submittals",
  ]) {
    fs.mkdirSync(path.join(driveRoot, rel), { recursive: true });
    const name = rel.split("/").pop()!;
    const parentPath = rel.includes("/") ? rel.split("/").slice(0, -1).join("/") : null;
    await prisma.documentFolder.upsert({
      where: { projectId_path: { projectId: project.id, path: rel } },
      create: {
        projectId: project.id,
        path: rel,
        name,
        parentPath,
        mockDriveId: `mock-${project.code}-${rel}`,
        lastSyncedAt: new Date(),
      },
      update: { lastSyncedAt: new Date() },
    });
  }

  void adminId;
  return { project, drawing };
}

async function main() {
  console.log("Seeding शरणम् portal...");
  console.log("Excel root:", EXCEL_ROOT);
  await seedRoles();
  const users = await seedUsers();
  await seedChecklistsFromExcel();
  const { project } = await seedProjectAndCost(users);
  console.log("Done.");
  console.log("Demo project:", project.code, project.name);
  console.log("Password for all demo users:", SEED_PASSWORD);
  console.log("Logins: admin / office / site / client / employee / vendor @sharnam.demo");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
