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
  }
  console.log("Checklist templates from Final Index:", created);

  // Fallback catalog when Excel is missing on Render
  if ((await prisma.checklistTemplate.count()) < 5) {
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
      if (existing) continue;
      await prisma.checklistTemplate.create({
        data: {
          name,
          category,
          checklistType: "Quality",
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
  for (const d of drawingSet) {
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
        currentRev: d.rev,
        status: d.published ? "Approved" : "Draft",
        isPublished: d.published,
        folderPath: folder,
        revisions: {
          create: {
            revisionNumber: d.rev,
            revisionLabel: `${d.rev} — IFC`,
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
        currentRev: d.rev,
        isPublished: d.published,
        status: d.published ? "Approved" : "Draft",
      },
    });
    if (!firstDrawingId) firstDrawingId = drawing.id;
    if (d.drawingNumber === "S-101") structuralDrawingId = drawing.id;
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

  // Vendors (Procore-style company directory)
  const vendorDefs = [
    {
      name: "M/s Bhavna Infra",
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
      name: "Pearl Electricals",
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
      trade: "Structural steel",
      city: "Rajkot",
      state: "Gujarat",
      email: "sales@steelform.demo",
      primaryContactName: "Nilesh Patel",
      isPrequalified: true,
      insuranceVerified: false,
    },
  ] as const;

  for (const v of vendorDefs) {
    const existing = await prisma.vendor.findFirst({ where: { name: v.name } });
    const vendor =
      existing ||
      (await prisma.vendor.create({
        data: { ...v, country: "India", createdVia: "Seed" },
      }));
    await prisma.projectVendor.upsert({
      where: { projectId_vendorId: { projectId: project.id, vendorId: vendor.id } },
      create: { projectId: project.id, vendorId: vendor.id, tradeRole: v.trade, assignedVia: "Seed" },
      update: { tradeRole: v.trade },
    });
  }
  console.log("Vendors seeded:", vendorDefs.length);

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
        title: "Raft foundation pre-pour",
        inspectionType: "Quality",
        status: "Open",
        location: "Block A — Grid A1-D4",
        linkedDrawingId: structuralDrawing.id,
        trade: "Civil",
        createdById: officeUserId,
        assignedToId: siteId,
        dueDate: new Date(Date.now() + 2 * 86400000),
        items: {
          create: [
            { description: "Formwork alignment matches S-101", sortOrder: 1 },
            { description: "Cover blocks / chairs in place", sortOrder: 2 },
            { description: "Rebar size & spacing as per schedule", sortOrder: 3 },
            { description: "Construction joint prepared", sortOrder: 4 },
            {
              description: "Ready for concrete pour",
              sortOrder: 5,
              autoGenerateRfi: true,
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
  console.log("Logins: admin@sharnam.demo / office@sharnam.demo / site@sharnam.demo / client@sharnam.demo");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
