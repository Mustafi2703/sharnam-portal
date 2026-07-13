import "dotenv/config";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";
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
  process.env.SHARNAM_EXCEL_ROOT || path.join(process.cwd(), "..", "app")
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
    if (d.role !== "client") {
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

async function seedChecklistsFromExcel() {
  const indexFile = path.join(EXCEL_ROOT, "Final Index.xlsx");
  const drawingFile = path.join(EXCEL_ROOT, "Drwing check master checklist.xlt.xls");

  const indexRows = readSheet(indexFile);
  let created = 0;
  for (let i = 1; i < indexRows.length; i++) {
    const sr = String(indexRows[i][0] ?? "").trim();
    const name = String(indexRows[i][1] ?? "").trim();
    const category = String(indexRows[i][2] ?? "General").trim() || "General";
    if (!name) continue;
    const existing = await prisma.checklistTemplate.findFirst({ where: { name, category } });
    if (existing) continue;
    await prisma.checklistTemplate.create({
      data: {
        name,
        category,
        checklistType: "Quality",
        source: "Final Index.xlsx",
        items: {
          create: [
            { itemCode: "1", description: `${name} — preliminary checks complete`, sortOrder: 1 },
            { itemCode: "2", description: "Materials verified as per approved brand", sortOrder: 2 },
            { itemCode: "3", description: "Workmanship acceptable", sortOrder: 3 },
            { itemCode: "4", description: "Safety precautions observed", sortOrder: 4 },
            { itemCode: "5", description: "Ready for next activity / handover", sortOrder: 5 },
          ],
        },
      },
    });
    created++;
    if (created >= 40) break; // keep seed lean for demo
  }

  // Drawing review checklist with Yes/No/NA form items
  const drawRows = readSheet(drawingFile);
  let section = "General";
  const items: { itemCode: string; description: string; section: string; sortOrder: number }[] = [];
  let order = 0;
  for (let i = 0; i < drawRows.length; i++) {
    const c1 = String(drawRows[i][1] ?? "").trim();
    const c2 = String(drawRows[i][2] ?? "").trim();
    if (!c1 && !c2) continue;
    if (/DRAWING REVIEW|CHECKLIST/i.test(c1) && !c2) {
      section = c1.replace(/^\d+\.\s*/, "");
      continue;
    }
    if (/^Sr\.?$/i.test(c1) || c1 === "Sr.") continue;
    if (c2) {
      order++;
      items.push({
        itemCode: c1 || String(order),
        description: c2,
        section,
        sortOrder: order,
      });
    }
  }

  if (items.length) {
    const name = "Architectural / Civil Drawing Review Checklist";
    const existing = await prisma.checklistTemplate.findFirst({ where: { name } });
    if (!existing) {
      await prisma.checklistTemplate.create({
        data: {
          name,
          category: "Drawings",
          checklistType: "Quality",
          source: "Drwing check master checklist.xlt.xls",
          items: { create: items },
        },
      });
    }
  }
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
    },
    update: {},
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

  // Sample drawing published so site can submit checklists
  const drawing = await prisma.drawing.upsert({
    where: { projectId_drawingNumber: { projectId: project.id, drawingNumber: "A-101" } },
    create: {
      projectId: project.id,
      drawingNumber: "A-101",
      title: "Ground Floor Plan",
      discipline: "Architecture",
      currentRev: "Rev A",
      status: "Approved",
      isPublished: true,
      folderPath: "Drawings/Architecture",
      revisions: {
        create: {
          revisionNumber: "Rev A",
          revisionLabel: "Rev A — IFC",
          fileUrl: "/uploads/onedrive/SPDC-DEMO-01/Drawings/Architecture/A-101-placeholder.txt",
          fileName: "A-101-placeholder.txt",
          published: true,
          uploadedById: users.find((u) => u.role === "office")?.id,
        },
      },
    },
    update: { isPublished: true, status: "Approved" },
  });

  const uploadDir = path.join(process.cwd(), "uploads", "onedrive", "SPDC-DEMO-01", "Drawings", "Architecture");
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.writeFileSync(
    path.join(uploadDir, "A-101-placeholder.txt"),
    "Mock drawing file for demo — replace with PDF via Office portal upload."
  );

  // Assign a few checklist templates
  const templates = await prisma.checklistTemplate.findMany({ take: 8 });
  for (const t of templates) {
    await prisma.checklistAssignment.upsert({
      where: { projectId_templateId: { projectId: project.id, templateId: t.id } },
      create: { projectId: project.id, templateId: t.id },
      update: {},
    });
  }

  // Cost sample from cashflow packages
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
    const months = ["Jan-2023", "Feb-2023", "Mar-2023", "Apr-2023"];
    for (const m of months) {
      await prisma.costCashflowPeriod.create({
        data: {
          projectId: project.id,
          periodLabel: m,
          packageName: "Civil Works",
          plannedAmount: 3000000,
          actualAmount: m.startsWith("Apr") ? 0 : 2800000,
          progressPct: m.startsWith("Apr") ? 0 : 0.9,
        },
      });
    }
  }

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
  console.log("Logins: admin@sharnam.demo / office@sharnam.demo / site@sharnam.demo / client@sharnam.demo");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
