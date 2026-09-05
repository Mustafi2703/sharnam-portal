import "dotenv/config";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";
import { applyDatabaseUrl } from "../scripts/resolve-database-url.mjs";
import { seedCostFromBudgetWorkbook } from "./costFromBudget.ts";
import { seedBbsDemoShapes } from "./bbsDemoShapes.ts";
import { seedChecklistFillsForReports, seedDemoChecklistSignoffs, seedQualitySafetyFromSheets, seedQualitySafetyDemoForDpr, seedSafetyFromWorkbooksForAllDemoProjects } from "./qualitySafetySheets.ts";
import { seedFinanceRaCopDemo } from "./financeRaCopDemo.ts";
import { seedQuotationDemo } from "./quotationDemo.ts";
import { seedFullDemoPack } from "./fullDemoPack.ts";
import { seedAuditKpiFromSheets } from "./auditKpiFromSheets.ts";
import { resyncProgressSorStats } from "../apps/api/src/services/progressSorParse.ts";
import { PrismaClient, type User } from "@prisma/client";
import {
  DEFAULT_ROLE_PERMISSIONS,
  portalForRole,
  ROLES,
  type RoleKey,
} from "../packages/shared/src/index.ts";

applyDatabaseUrl();

const prisma = new PrismaClient();
const SEED_PASSWORD = process.env.SEED_PASSWORD || "Demo@1234";

/** Tiny valid PDF for in-browser iframe preview in GFC / coordination demos */
function writeMinimalDemoPdf(absPath: string, lines: string[]) {
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  let y = 720;
  const cmds = lines
    .filter(Boolean)
    .slice(0, 6)
    .map((line) => {
      const cmd = `72 ${y} Td (${esc(line.slice(0, 72))}) Tj`;
      y -= 20;
      return cmd;
    });
  const stream = `BT /F1 14 Tf ${cmds.join("\n")} ET`;
  const len = Buffer.byteLength(stream, "utf8");
  const pdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>>>>>>>endobj
4 0 obj<</Length ${len}>>stream
${stream}
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000058 00000 n 
0000000112 00000 n 
0000000268 00000 n 
trailer<</Size 5/Root 1 0 R>>
startxref
380
%%EOF`;
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, pdf);
}

const ISO_DRAWINGS_ROOT = "04_DESIGN_AND_INFORMATION_MANAGEMENT/04.02_Drawings_and_Specifications";

/**
 * Where the seed looks for client-shared Excel workbooks.
 *
 * Resolution order (first hit wins):
 *   1. $SHARNAM_EXCEL_ROOT — explicit override.
 *   2. `seed/data/`         — reference sheets shipped with the repo.
 *                             This is the path used on Render, so a fresh
 *                             deploy always has a real demo project.
 *   3. process.cwd()        — legacy: allows keeping the sheets at repo root
 *                             for local iteration.
 */
function resolveExcelRoot(): string {
  if (process.env.SHARNAM_EXCEL_ROOT) return path.resolve(process.env.SHARNAM_EXCEL_ROOT);
  const bundled = path.resolve(process.cwd(), "seed/data");
  if (fs.existsSync(bundled)) return bundled;
  return process.cwd();
}
const EXCEL_ROOT = resolveExcelRoot();

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
    { email: "pmc@sharnam.demo", fullName: "Partner PMC Lead", role: "employee" },
    { email: "mep@sharnam.demo", fullName: "MEP Design Engineer", role: "employee" },
    { email: "struct@sharnam.demo", fullName: "Structural Reviewer", role: "employee" },
    { email: "vendor@sharnam.demo", fullName: "Vendor Partner", role: "vendor" },
    { email: "tcc@sharnam.demo", fullName: "TCC Bid Manager", role: "vendor" },
    { email: "pearl@sharnam.demo", fullName: "Pearl Bid Manager", role: "vendor" },
  ];

  const users: User[] = [];
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
      const empCode = `EMP-${d.email.split("@")[0].toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12)}`;
      const existing = await prisma.employeeProfile.findUnique({ where: { userId: u.id } });
      if (!existing) {
        const taken = await prisma.employeeProfile.findUnique({ where: { empCode } });
        if (!taken) {
          await prisma.employeeProfile.create({
            data: {
              userId: u.id,
              empCode,
              department: d.role === "site_employee" ? "Site" : "Office",
              designation: d.fullName,
            },
          });
        }
      }
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
            instruction: "Verify on site per QAP / method statement.",
            sortOrder: i + 1,
            section: i === q.lines.length - 1 ? "Close-out" : "Inspection",
            requirePhoto: i === 0,
          })),
        },
      },
    });
  }

  // Quality Dashboard.xlsx Sheet1 — QI checklist type catalog (never reclassify Site / Drawing / Safety)
  const qdFile = path.join(EXCEL_ROOT, "Quality Dashboard.xlsx");
  if (fs.existsSync(qdFile)) {
    const wb = XLSX.readFile(qdFile);
    const sheetName = wb.SheetNames.find((n) => /^Sheet1$/i.test(n));
    const rows = sheetName
      ? (XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[sheetName], { header: 1, defval: "" }) as unknown[][])
      : [];
    let qdCreated = 0;
    let qdSkipped = 0;
    for (let i = 0; i < rows.length; i++) {
      const sr = String(rows[i][0] ?? "").trim();
      const name = String(rows[i][1] ?? "").trim();
      const category = String(rows[i][2] ?? "General").trim() || "General";
      if (!name || !/^\d+$/.test(sr) || /file name/i.test(name)) continue;

      const qiExisting = await prisma.checklistTemplate.findFirst({
        where: { name, checklistType: "QualityInspection" },
      });
      if (qiExisting) continue;

      const otherFamily = await prisma.checklistTemplate.findFirst({
        where: { name, checklistType: { not: "QualityInspection" } },
      });
      if (otherFamily) {
        qdSkipped++;
        continue;
      }

      await prisma.checklistTemplate.create({
        data: {
          name,
          category,
          checklistType: "QualityInspection",
          source: "Quality Dashboard.xlsx · Sheet1",
          requirePhotosMin: 3,
          instructions: "Minimum 3 observation photos. Upload or add checklist line items in master.",
          items: {
            create: [
              { itemCode: "1", description: `${name} — preliminary checks`, sortOrder: 1, section: "Pre-checks", requirePhoto: true },
              { itemCode: "2", description: "Materials / method as per QAP", sortOrder: 2, section: "Execution" },
              { itemCode: "3", description: "Workmanship acceptable to PMC", sortOrder: 3, section: "Execution" },
              { itemCode: "4", description: "Safety precautions observed", sortOrder: 4, section: "Safety" },
              { itemCode: "5", description: "Ready for next activity / sign-off", sortOrder: 5, section: "Close-out", requirePhoto: true },
            ],
          },
        },
      });
      qdCreated++;
    }
    if (qdCreated) console.log("Quality Dashboard Sheet1 QI templates:", qdCreated);
    if (qdSkipped) console.log("Quality Dashboard Sheet1 skipped (name used by Site/Drawing/Safety):", qdSkipped);
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

async function seedProjectAndCost(users: User[]) {
  const project = await prisma.project.upsert({
    where: { code: "SPDC-DEMO-01" },
    create: {
      code: "SPDC-DEMO-01",
      name: "Sharnam Demo Dormitory Project",
      clientName: "Demo Client Corp",
      location: "Ahmedabad, Gujarat",
      status: "In Progress",
      notificationEmails: "office@sharnam.demo,client@sharnam.demo",
      notificationWhatsApp: "8160757201,9106945294",
      whatsAppEnabled: true,
      emailFromName: "शरणम् Portal",
      emailEnabled: true,
      notifyOnDrawingPublish: true,
      notifyOnChecklistSubmit: true,
    },
    update: {
      notificationEmails: "office@sharnam.demo,client@sharnam.demo",
      notificationWhatsApp: "8160757201,9106945294",
      whatsAppEnabled: true,
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
    const fileName = `${d.drawingNumber}-${d.rev.replace("Rev ", "R")}-GFC.pdf`;
    const absDir = path.join(driveRoot, folder);
    writeMinimalDemoPdf(path.join(absDir, fileName), [
      d.drawingNumber,
      d.title,
      `${d.rev} — Good for Construction`,
      "Sharnam portal demo",
    ]);
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
        const r1Name = `${d.drawingNumber}-R1-GFC.pdf`;
        writeMinimalDemoPdf(path.join(absDir, r1Name), [
          d.drawingNumber,
          d.title,
          "R1 — IFC revision",
          "Sharnam portal demo",
        ]);
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

  // Mirror published sheets into ISO 04.02 library (Drawing files browse in SharePoint tree)
  for (const sub of ["Architecture", "Structural", "MEP", "Civil"]) {
    fs.mkdirSync(path.join(driveRoot, ISO_DRAWINGS_ROOT, sub), { recursive: true });
  }
  for (const d of drawingSet.filter((x) => x.published)) {
    const sub = d.discipline === "MEP" ? "MEP" : d.discipline;
    const relFolder = `${ISO_DRAWINGS_ROOT}/${sub}`;
    const fileName = `${d.drawingNumber}-GFC.pdf`;
    writeMinimalDemoPdf(path.join(driveRoot, relFolder, fileName), [
      d.drawingNumber,
      d.title,
      `${d.rev} — Good for Construction`,
      "SharePoint · 04.02 Drawings and Specifications",
    ]);
  }

  // Upgrade legacy .txt revision placeholders to PDF for existing demo DBs
  const txtRevisions = await prisma.drawingRevision.findMany({
    where: {
      drawing: { projectId: project.id },
      OR: [{ fileName: { endsWith: ".txt" } }, { fileUrl: { endsWith: ".txt" } }],
    },
    include: { drawing: true },
  });
  for (const rev of txtRevisions) {
    const oldUrl = rev.fileUrl || "";
    const oldName = rev.fileName || path.basename(oldUrl);
    const pdfName = oldName.replace(/-placeholder\.txt$/i, "-GFC.pdf").replace(/\.txt$/i, ".pdf");
    const relInUrl = oldUrl.replace(/^\/uploads\/onedrive\/[^/]+\//, "");
    const relPath = relInUrl.replace(oldName, pdfName);
    const absPath = path.join(driveRoot, relPath);
    writeMinimalDemoPdf(absPath, [rev.drawing.drawingNumber, rev.drawing.title, rev.revisionNumber || ""]);
    await prisma.drawingRevision.update({
      where: { id: rev.id },
      data: {
        fileName: pdfName,
        fileUrl: `/uploads/onedrive/${project.code}/${relPath.replace(/\\/g, "/")}`,
      },
    });
  }

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
  await seedDemoChecklistSignoffs(prisma, { id: project.id, code: project.code });

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
  const plannedFile =
    [path.join(EXCEL_ROOT, "Planned Vs. Actual Dashboard (1).xlsx"), path.join(EXCEL_ROOT, "Planned Vs. Actual Dashboard.xlsx")].find(
      (p) => fs.existsSync(p)
    ) || path.join(EXCEL_ROOT, "Planned Vs. Actual Dashboard.xlsx");
  const monthlyFile = path.join(
    EXCEL_ROOT,
    fs.existsSync(path.join(EXCEL_ROOT, "Monthly Progress Dashboard (1).xlsx"))
      ? "Monthly Progress Dashboard (1).xlsx"
      : "Monthly Progress Dashboard.xlsx"
  );
  const hindFile =
    [path.join(EXCEL_ROOT, "HInderance Register Dashboard (1).xlsx"), path.join(EXCEL_ROOT, "HInderance Register Dashboard.xlsx")].find(
      (p) => fs.existsSync(p)
    ) || path.join(EXCEL_ROOT, "HInderance Register Dashboard.xlsx");

  if (!fs.existsSync(mileFile) && !fs.existsSync(overviewFile)) {
    console.warn("Missing excel:", mileFile);
    console.warn("Missing excel:", overviewFile);
  }
  if (fs.existsSync(mileFile) || fs.existsSync(overviewFile)) {
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
            resolutionDescription: cellStr(row[15], 500),
            remarks: cellStr(row[16], 500),
          },
        });
        n++;
      }
      console.log("Hindrances seeded:", n);
    }
  }

  const riskFile = path.join(EXCEL_ROOT, "Risk Register - Dashboard 1.xlsx");
  const legalFile = path.join(EXCEL_ROOT, "Legal Approvals - Dashboard.xlsx");

  if (fs.existsSync(riskFile)) {
    const wb = XLSX.readFile(riskFile);
    const sheet = wb.Sheets["Risk Register"];
    if (sheet) {
      const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: "" }) as unknown[][];
      let n = 0;
      for (let i = 2; i < rows.length; i++) {
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
            weeksLikely: cellNum(row[10]),
            urgency: cellStr(row[11], 40),
            responseCategory: cellStr(row[12], 80),
            impactNotes: cellStr(row[13], 2000),
            riskOwner: cellStr(row[14], 120),
            contingencyPlan: cellStr(row[15], 2000),
            status: cellStr(row[16], 80) || "Open",
            dateLastUpdated: excelDate(row[17]),
            trackingComments: cellStr(row[18], 500),
          },
        });
        n++;
      }
      console.log("Risks seeded:", n);
    }
  } else if (fs.existsSync(overviewFile)) {
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
      console.log("Risks seeded (overview fallback):", n);
    }
  }

  if (fs.existsSync(legalFile)) {
    const wb = XLSX.readFile(legalFile);
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
  } else if (fs.existsSync(overviewFile)) {
    const wb = XLSX.readFile(overviewFile);
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
      console.log("Legal approvals seeded (overview fallback):", n);
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

    const draw = wb.Sheets["As per drawing status"];
    const actName = wb.SheetNames.find((n) => /planned vs actual/i.test(n) && !/dashboard/i.test(n));
    const act = draw || (actName && wb.Sheets[actName]) || wb.Sheets["Planned Vs Actual "];
    if (act) {
      const rows = XLSX.utils.sheet_to_json<(string | number)[]>(act, { header: 1, defval: "" }) as unknown[][];
      let n = 0;
      let lastTower = "";
      const startRow = draw ? 3 : 0;
      for (let i = startRow; i < rows.length; i++) {
        const row = rows[i] as (string | number)[];
        const sr = cellNum(row[0]);
        const activity = cellStr(row[2], 200);
        if (!sr || !activity) continue;
        const towerCell = cellStr(row[1], 80);
        if (towerCell) lastTower = towerCell;
        const tower = towerCell || lastTower || null;
        if (draw) {
          const gfc = cellNum(row[5]);
          const totalAchieved = cellNum(row[8]);
          await prisma.progressActivityLine.create({
            data: {
              projectId: project.id,
              srNo: sr,
              tower,
              activity,
              unit: cellStr(row[3], 20),
              boqQty: cellNum(row[4]),
              gfcQty: gfc,
              executedQty: totalAchieved,
              balanceQty: gfc > 0 ? Math.max(0, gfc - totalAchieved) : 0,
              weeklyPlanned: cellNum(row[6]),
              weeklyActual: cellNum(row[7]),
              cumulativeQty: totalAchieved,
              pctComplete: gfc > 0 ? Math.min(1.2, totalAchieved / gfc) : 0,
            },
          });
        } else {
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
        }
        n++;
      }
      console.log("Activity lines seeded:", n);
    }
  }

  if (fs.existsSync(monthlyFile)) {
    const rows = await resyncProgressSorStats(project.id);
    console.log("Monthly SOR stats seeded:", rows.length);
  }

  // Cost from SPDC Budget workbook (Budget / Monitoring / MB / BBS / rate diffs)
  await seedCostFromBudgetWorkbook(prisma, project.id, EXCEL_ROOT);
  await seedBbsDemoShapes(prisma, project.id, project.code);

  // Communications matrix — RFI respond/fill parties (standard + legacy rows)
  const matrixSpecs = [
    { communicationType: "RFI Update", fromRole: "office", toRole: "client", frequency: "As needed", channel: "RFI" },
    { communicationType: "RFI Update", fromRole: "office", toRole: "vendor", frequency: "As needed", channel: "RFI" },
    { communicationType: "RFI Update", fromRole: "office", toRole: "site_employee", frequency: "As needed", channel: "RFI" },
    { communicationType: "RFI Update", fromRole: "employee", toRole: "office", frequency: "As needed", channel: "RFI" },
    { communicationType: "RFI Update", fromRole: "site_employee", toRole: "office", frequency: "As needed", channel: "RFI" },
    { communicationType: "Checklist fill", fromRole: "office", toRole: "vendor", frequency: "As needed", channel: "RFI" },
    { communicationType: "Checklist fill", fromRole: "office", toRole: "site_employee", frequency: "As needed", channel: "RFI" },
    { communicationType: "Checklist fill", fromRole: "office", toRole: "employee", frequency: "As needed", channel: "RFI" },
    { communicationType: "Weekly Report", fromRole: "office", toRole: "client", frequency: "Weekly", channel: "Email" },
    { communicationType: "Daily Diary Summary", fromRole: "site_employee", toRole: "office", frequency: "Daily", channel: "In-App" },
    { communicationType: "Site Meeting MoM", fromRole: "office", toRole: "client", frequency: "Weekly", channel: "Email" },
  ] as const;
  for (const s of matrixSpecs) {
    const exists = await prisma.communicationMatrix.findFirst({
      where: {
        projectId: project.id,
        communicationType: s.communicationType,
        fromRole: s.fromRole,
        toRole: s.toRole,
        channel: s.channel,
      },
    });
    if (!exists) {
      await prisma.communicationMatrix.create({ data: { projectId: project.id, ...s, isActive: true } });
    }
  }

  const contactCount = await prisma.communicationContact.count({ where: { projectId: project.id } });
  if (contactCount === 0) {
    const contacts = [
      ["Client", "SPDC Project Owner", "Client Representative", "SPDC", "client@sharnam.demo", "TO", 1],
      ["PMC", "Sharnam PMC", "Office Coordinator", "Sharnam", "office@sharnam.demo", "TO", 2],
      ["PMC", "Sharnam PMC", "MEP Design Engineer", "Sharnam", "mep@sharnam.demo", "CC", 3],
      ["PMC", "Sharnam PMC", "Structural Reviewer", "Sharnam", "struct@sharnam.demo", "CC", 4],
      ["Consultant", "MEP Consultant", "Lead MEP", "Consultant Co", "mep@sharnam.demo", "TO", 5],
      ["Contractor", "M/s Bhavna Infra", "Site Engineer", "Bhavna Infra", "site@sharnam.demo", "TO", 6],
    ] as const;
    for (const [section, org, name, company, email, mailRole, sortOrder] of contacts) {
      await prisma.communicationContact.create({
        data: {
          projectId: project.id,
          matrixKind: "TECHNICAL",
          orgSection: section,
          orgName: org,
          personName: name,
          company,
          email,
          mailRole,
          sortOrder,
        },
      });
    }
    console.log("Communication contacts seeded:", contacts.length);
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
      trade: "Civil & Structural (CCV), Admin Building, U.G Tank + Pump Room",
      city: "Ahmedabad",
      state: "Gujarat",
      businessPhone: "+91 79 2650 1001",
      email: "vendor@sharnam.demo",
      primaryContactName: "Ketan Shah",
      gstNumber: "24AAAAA0000A1Z5",
      licenseNumber: "LIC-CIV-1042",
      isPrequalified: true,
      insuranceVerified: true,
    },
    {
      name: "TCC Projects PVT. LTD.",
      partyType: "Contractor",
      trade: "Civil & Structural (CCV), Entrance Gate",
      city: "Ahmedabad",
      state: "Gujarat",
      email: "tcc@sharnam.demo",
      primaryContactName: "Ramesh Desai",
      isPrequalified: true,
      insuranceVerified: true,
    },
    {
      name: "Pearl Electricals",
      partyType: "Vendor",
      trade: "Electrical Lab",
      city: "Vadodara",
      state: "Gujarat",
      businessPhone: "+91 265 240 2200",
      email: "pearl@sharnam.demo",
      primaryContactName: "Meera Joshi",
      gstNumber: "24BBBBB0000B1Z5",
      isPrequalified: true,
      insuranceVerified: true,
    },
    {
      name: "AquaFlow MEP",
      partyType: "Vendor",
      trade: "U.G Tank + Pump Room, Cooling Tower",
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
      trade: "Entrance Gate, Civil & Structural (CCV)",
      city: "Rajkot",
      state: "Gujarat",
      email: "sales@steelform.demo",
      primaryContactName: "Nilesh Patel",
      isPrequalified: true,
      insuranceVerified: false,
    },
    {
      name: "SecureGate Systems",
      partyType: "Vendor",
      trade: "Security, Entrance Gate",
      city: "Ahmedabad",
      state: "Gujarat",
      email: "bids@securegate.demo",
      primaryContactName: "Vikram Mehta",
      isPrequalified: true,
      insuranceVerified: true,
    },
    {
      name: "WeighPro India",
      partyType: "Vendor",
      trade: "Weigh Bridge",
      city: "Vadodara",
      state: "Gujarat",
      email: "sales@weighpro.demo",
      primaryContactName: "Sanjay Rao",
      isPrequalified: true,
      insuranceVerified: true,
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
  const mepUserId = users.find((u) => u.email === "mep@sharnam.demo")?.id!;
  const structUserId = users.find((u) => u.email === "struct@sharnam.demo")?.id!;
  const employeeId = users.find((u) => u.email === "employee@sharnam.demo")?.id!;

  const drawingByNum = async (num: string) =>
    prisma.drawing.findFirst({ where: { projectId: project.id, drawingNumber: num } });

  const s201 = await drawingByNum("S-201");
  const e101 = await drawingByNum("E-101");
  const p101 = await drawingByNum("P-101");
  const siteExecAssignment = await prisma.checklistAssignment.findFirst({
    where: { projectId: project.id, template: { checklistType: "SiteExecution" } },
  });
  const drawingCheckAssignment = await prisma.checklistAssignment.findFirst({
    where: { projectId: project.id, template: { checklistType: "DrawingCheck" } },
  });
  const a301 = await drawingByNum("A-301");

  // Demo RFIs — varied fill / response states for walkthrough
  const demoRfis: {
    number: string;
    subject: string;
    question: string;
    status: string;
    rfiKind: string;
    createdById: string;
    assignedToId?: string;
    linkedDrawingId?: string | null;
    linkedAssignmentId?: string | null;
    scheduleImpact?: string;
    costImpact?: string;
    responses?: { text: string; byId: string; official?: boolean }[];
  }[] = [
    {
      number: "RFI-001",
      subject: "Beam depth conflict at Grid B/3",
      question:
        "Structural S-201 shows 450mm beam; architectural ceiling void on A-301 allows only 380mm. Please confirm preferred resolution.",
      status: "Open",
      rfiKind: "RequestForInformation",
      createdById: siteId,
      assignedToId: structUserId || officeUserId,
      linkedDrawingId: s201?.id || structuralDrawing.id || null,
      scheduleImpact: "Medium",
      costImpact: "Low",
    },
    {
      number: "RFI-002",
      subject: "DB location at GF electrical room — confirm clearance",
      question: "E-101 shows DB flush with wall; site measure is 120mm short. Confirm revised layout or wall chase.",
      status: "Answered",
      rfiKind: "RequestForInformation",
      createdById: mepUserId || siteId,
      assignedToId: officeUserId,
      linkedDrawingId: e101?.id || null,
      scheduleImpact: "Low",
      costImpact: "None",
      responses: [
        {
          text: "Proceed with 150mm chase on grid line B — updated sketch will be issued as E-101 R1.",
          byId: officeUserId,
          official: true,
        },
      ],
    },
    {
      number: "RFI-003",
      subject: "Facade fixing detail — request consultant confirmation",
      question: "Curtain wall bracket spacing differs from shop drawing. Need formal approval before proceed.",
      status: "Closed",
      rfiKind: "RequestForInformation",
      createdById: employeeId || siteId,
      assignedToId: officeUserId,
      scheduleImpact: "High",
      costImpact: "Medium",
      responses: [
        { text: "Consultant confirmed 600mm centres — attach approved markup to site file.", byId: officeUserId, official: true },
        { text: "Closed after site photo uploaded.", byId: officeUserId, official: true },
      ],
    },
    {
      number: "RFI-005",
      subject: "Slab opening size at lift lobby — confirm with MEP",
      question: "Architectural A-301 shows 900×900 opening; lift vendor needs 950. Confirm revised opening before formwork.",
      status: "Open",
      rfiKind: "RequestForInformation",
      createdById: siteId,
      assignedToId: officeUserId,
      linkedDrawingId: a301?.id || null,
      scheduleImpact: "Medium",
      costImpact: "Low",
    },
    {
      number: "DWG-CHK-001",
      subject: "Drawing check — S-201 revision R1 markup",
      question: "Complete drawing check checklist for structural revision before issue to site.",
      status: "Open",
      rfiKind: "DrawingChecklist",
      createdById: officeUserId,
      assignedToId: structUserId || siteId,
      linkedDrawingId: s201?.id || structuralDrawing.id || null,
      linkedAssignmentId: drawingCheckAssignment?.id || null,
    },
    {
      number: "SITE-RFI-001",
      subject: "Site execution checklist — Block A slab pour",
      question: "Fill the linked site checklist (SPDC Activity F-02) and attach pour card photos before tomorrow's review.",
      status: "Open",
      rfiKind: "SiteExecution",
      createdById: officeUserId,
      assignedToId: siteId,
      linkedAssignmentId: siteExecAssignment?.id || null,
    },
    {
      number: "RFI-004",
      subject: "Plumbing riser offset at Shaft S-02",
      question: "Escalated from design coordination — confirm 75mm offset acceptable for insulation clearance.",
      status: "Open",
      rfiKind: "RequestForInformation",
      createdById: mepUserId || officeUserId,
      assignedToId: officeUserId,
      linkedDrawingId: p101?.id || null,
      scheduleImpact: "Medium",
      costImpact: "Low",
    },
  ];

  for (const spec of demoRfis) {
    const exists = await prisma.rfi.findFirst({ where: { projectId: project.id, number: spec.number } });
    if (exists) continue;
    const rfi = await prisma.rfi.create({
      data: {
        projectId: project.id,
        number: spec.number,
        subject: spec.subject,
        question: spec.question,
        status: spec.status,
        rfiKind: spec.rfiKind,
        ballInCourt: spec.status === "Closed" ? "Creator" : "Assignee",
        createdById: spec.createdById,
        assignedToId: spec.assignedToId || null,
        linkedDrawingId: spec.linkedDrawingId || null,
        linkedAssignmentId: spec.linkedAssignmentId || null,
        dueDate: new Date(Date.now() + 5 * 86400000),
        scheduleImpact: spec.scheduleImpact || "None",
        costImpact: spec.costImpact || "None",
        closedAt: spec.status === "Closed" ? new Date() : null,
      },
    });
    for (const resp of spec.responses || []) {
      await prisma.rfiResponse.create({
        data: {
          rfiId: rfi.id,
          respondedById: resp.byId,
          responseText: resp.text,
          isOfficialResponse: resp.official !== false,
        },
      });
    }
  }
  console.log("Demo RFIs seeded (open / answered / closed / checklist fill)");

  // Fix legacy mis-seeded site execution row stored as drawing checklist
  const legacySiteAsDrawing = await prisma.rfi.findFirst({
    where: { projectId: project.id, number: "DWG-RFI-001", rfiKind: "DrawingChecklist" },
  });
  if (legacySiteAsDrawing) {
    await prisma.rfi.update({
      where: { id: legacySiteAsDrawing.id },
      data: {
        number: "SITE-RFI-001",
        rfiKind: "SiteExecution",
        subject: "Site execution checklist — Block A slab pour",
        question:
          "Fill the linked site checklist (SPDC Activity F-02) and attach pour card photos before tomorrow's review.",
        linkedAssignmentId: siteExecAssignment?.id || legacySiteAsDrawing.linkedAssignmentId,
      },
    });
    console.log("Patched legacy DWG-RFI-001 → SITE-RFI-001 (SiteExecution under Quality)");
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
    const drawingIdByNumber = async (num: string) =>
      (await prisma.drawing.findFirst({ where: { projectId: project.id, drawingNumber: num } }))?.id ?? null;
    const [s201, s401, p101] = await Promise.all([
      drawingIdByNumber("S-201"),
      drawingIdByNumber("S-401"),
      drawingIdByNumber("P-101"),
    ]);
    await prisma.designCoordinationIssue.createMany({
      data: [
        {
          projectId: project.id,
          title: "AHU duct vs beam clash — Level 1 corridor",
          description: "400x600 duct conflicts with secondary beam at Grid C.",
          discipline: "MEP",
          location: "L1 corridor · Grid C",
          priority: "High",
          ballInCourt: "Consultant",
          assignedToName: "MEP consultant",
          linkedDrawingId: s201,
        },
        {
          projectId: project.id,
          title: "Stair headroom below slab soffit — Block A",
          description: "Finished floor to soffit 2.05 m; code requires 2.10 m at landing.",
          discipline: "Architecture",
          location: "Block A stair 01",
          priority: "Medium",
          status: "Open",
          ballInCourt: "PMC",
          linkedDrawingId: s401,
        },
        {
          projectId: project.id,
          title: "Cable tray routing vs plumbing riser — Level 2",
          description: "Electrical tray clashes with plumbing riser at shaft S-02.",
          discipline: "MEP",
          location: "Shaft S-02 · L2",
          priority: "High",
          ballInCourt: "Contractor",
          assignedToName: "Electrical contractor",
          linkedDrawingId: p101,
        },
      ],
    });
  } else {
    const drawingIdByNumber = async (num: string) =>
      (await prisma.drawing.findFirst({ where: { projectId: project.id, drawingNumber: num } }))?.id ?? null;
    for (const [titlePart, num] of [
      ["AHU duct", "S-201"],
      ["Stair headroom", "S-401"],
      ["Cable tray", "P-101"],
    ] as const) {
      const linkedDrawingId = await drawingIdByNumber(num);
      if (!linkedDrawingId) continue;
      await prisma.designCoordinationIssue.updateMany({
        where: { projectId: project.id, title: { contains: titlePart }, linkedDrawingId: null },
        data: { linkedDrawingId },
      });
    }
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
  console.log("Tip: run `npm run db:push` before seed if QapActivity schema changed.");
  await seedRoles();
  const users = await seedUsers();
  await seedChecklistsFromExcel();

  // The project/cost seed is a soft-fail: it slurps reference Excel packs
  // that aren't shipped with the repo. If any of them are missing or
  // malformed we log & keep going so the API can still boot.
  try {
    const { project } = await seedProjectAndCost(users);
    console.log("Demo project:", project.code, project.name);
    const officeId = users.find((u) => u.role === "office")?.id;
    if (officeId) {
      await seedFinanceRaCopDemo(prisma, project.id, officeId);
      await seedQuotationDemo(prisma, officeId);
    }
    await seedFullDemoPack(prisma, { skipDemoDay: true });
    const auditStats = await seedAuditKpiFromSheets(prisma, project.id);
    console.log("Audit/KPI seed:", auditStats);
  } catch (e) {
    console.warn(
      "seedProjectAndCost failed — continuing with the users/roles/checklists that were seeded.",
      e instanceof Error ? e.message : e
    );
  }

  try {
    const { seedAllDemoSheetModules } = await import("./demoScreenshotsPack.ts");
    await seedAllDemoSheetModules(prisma);
  } catch (e) {
    console.warn("seedAllDemoSheetModules failed:", e instanceof Error ? e.message : e);
  }

  try {
    const { seedSpdcLiveTeam } = await import("./spdcLiveTeam.ts");
    const live = await seedSpdcLiveTeam(prisma);
    console.log("Live team seeded on", live.project.code);
  } catch (e) {
    console.warn("seedSpdcLiveTeam failed:", e instanceof Error ? e.message : e);
  }

  console.log("Done.");
  console.log("Password for all demo users:", SEED_PASSWORD);
  console.log(
    "Logins: admin / office / site / client / employee / mep / struct / vendor @sharnam.demo"
  );
  console.log("Bid vendors: vendor@ (Bhavna) · tcc@ · pearl@ @sharnam.demo");
}

main()
  .catch((e) => {
    console.error("Seed hard-failed at top level:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
