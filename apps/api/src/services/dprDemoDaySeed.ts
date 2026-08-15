/**
 * Seed one published DPR demo day — all 7 disciplines with qty, signatures, XLSX + HTML.
 * Used by CLI (seed/dprDemoDay.ts) and POST /api/dpr-maker/:projectId/seed-demo-day.
 */
import fs from "fs";
import path from "path";
import type { PrismaClient } from "@prisma/client";
import { buildDprAutoFill } from "./dprIntegrations.js";
import { buildDprChartPack, loadDprScurveHistory } from "./dprCharts.js";
import { renderDprSnapshotHtml } from "./dprSnapshotExport.js";
import { MODULE_TO_ISO_FOLDER } from "./graph.js";
import { mockOneDrive } from "./mockOneDrive.js";
import {
  buildDprWorkbook,
  type DprEquipment,
  type DprHeader,
  type DprLine,
  type DprManpower,
  type DprMaterial,
  type DprPhoto,
} from "./dprXlsx.js";

export const DPR_DEMO_DISCIPLINES = [
  "CIVIL",
  "ELECTRICAL",
  "FIRE",
  "MECHANICAL",
  "PEB_ERECTION",
  "PEB_SUPPLY",
  "PLUMBING",
] as const;

const DEMO_SIG_ROLES = ["Site Engineer", "PMC Manager", "Contractor Rep"] as const;

function packHeader(header: DprHeader, extras: Record<string, unknown>): string {
  return JSON.stringify({ ...header, _extras: extras });
}

function defaultManpower(): DprManpower[] {
  return [
    { trade: "Mason", planned: 12, actual: 11, hoursWorked: 8 },
    { trade: "Bar Bender", planned: 8, actual: 8, hoursWorked: 8 },
    { trade: "Carpenter – Shuttering", planned: 10, actual: 9, hoursWorked: 8 },
    { trade: "Helper / Unskilled", planned: 18, actual: 16, hoursWorked: 8 },
    { trade: "Operators – Machine & Pump", planned: 4, actual: 4, hoursWorked: 8 },
    { trade: "Supervisor & PMC Staff", planned: 3, actual: 3, hoursWorked: 8 },
  ];
}

const EQUIPMENT_BY_DISCIPLINE: Record<string, DprEquipment[]> = {
  CIVIL: [
    { name: "Excavator – JCB 3DX", qty: 1, workedHrs: 6, idleHrs: 2 },
    { name: "Transit Mixer 6 CUM", qty: 2, workedHrs: 7, idleHrs: 1 },
    { name: "Concrete Boom Pump 36 m", qty: 1, workedHrs: 5, idleHrs: 3 },
    { name: "Needle Vibrator 40 mm", qty: 4, workedHrs: 6, idleHrs: 2 },
    { name: "Bar Cutting / Bending M/C", qty: 1, workedHrs: 8, idleHrs: 0 },
    { name: "De-watering Pump & DG Set", qty: 1, workedHrs: 4, idleHrs: 4 },
  ],
  ELECTRICAL: [
    { name: "Cable pulling winch", qty: 1, workedHrs: 7, idleHrs: 1 },
    { name: "Hydraulic crimping tool set", qty: 2, workedHrs: 6, idleHrs: 2 },
    { name: "MEWP / boom lift", qty: 1, workedHrs: 5, idleHrs: 3 },
    { name: "DG set 125 kVA (temp power)", qty: 1, workedHrs: 8, idleHrs: 0 },
    { name: "Drilling / chasing machine", qty: 2, workedHrs: 6, idleHrs: 2 },
    { name: "Testing kit (megger / earth)", qty: 1, workedHrs: 3, idleHrs: 5 },
  ],
  FIRE: [
    { name: "Pipe threading machine", qty: 1, workedHrs: 6, idleHrs: 2 },
    { name: "Grooving / coupling kit", qty: 1, workedHrs: 5, idleHrs: 3 },
    { name: "Pressure test pump", qty: 1, workedHrs: 4, idleHrs: 4 },
    { name: "Welding set (MS supports)", qty: 1, workedHrs: 6, idleHrs: 2 },
    { name: "MEWP", qty: 1, workedHrs: 5, idleHrs: 3 },
    { name: "Compressor (pneumatic tools)", qty: 1, workedHrs: 7, idleHrs: 1 },
  ],
  MECHANICAL: [
    { name: "Chain pulley block 5 T", qty: 2, workedHrs: 6, idleHrs: 2 },
    { name: "Alignment kit / dial gauge", qty: 1, workedHrs: 4, idleHrs: 4 },
    { name: "Pipe fit-up stand", qty: 2, workedHrs: 7, idleHrs: 1 },
    { name: "Welding machine", qty: 2, workedHrs: 6, idleHrs: 2 },
    { name: "Rigging tools / slings", qty: 1, workedHrs: 5, idleHrs: 3 },
    { name: "Grinder / cut-off saw", qty: 3, workedHrs: 6, idleHrs: 2 },
  ],
  PEB_ERECTION: [
    { name: "Mobile crane 25 T", qty: 1, workedHrs: 7, idleHrs: 1 },
    { name: "Boom lift / MEWP", qty: 1, workedHrs: 6, idleHrs: 2 },
    { name: "Torque wrench set (HSFG)", qty: 2, workedHrs: 7, idleHrs: 1 },
    { name: "Welding machine (site splice)", qty: 1, workedHrs: 5, idleHrs: 3 },
    { name: "Rigging / tag line crew kit", qty: 1, workedHrs: 7, idleHrs: 1 },
    { name: "DG + lighting tower", qty: 1, workedHrs: 8, idleHrs: 0 },
  ],
  PEB_SUPPLY: [
    { name: "Flat-bed trailer (inbound)", qty: 2, workedHrs: 6, idleHrs: 2 },
    { name: "Overhead EOT 5 T (yard)", qty: 1, workedHrs: 7, idleHrs: 1 },
    { name: "Mobile crane (offload)", qty: 1, workedHrs: 4, idleHrs: 4 },
    { name: "Forklift 3 T", qty: 1, workedHrs: 6, idleHrs: 2 },
    { name: "Weighbridge (dispatch QC)", qty: 1, workedHrs: 8, idleHrs: 0 },
    { name: "Paint touch-up spray kit", qty: 1, workedHrs: 3, idleHrs: 5 },
  ],
  PLUMBING: [
    { name: "Pipe threading machine", qty: 1, workedHrs: 6, idleHrs: 2 },
    { name: "Groover / fusion kit", qty: 1, workedHrs: 5, idleHrs: 3 },
    { name: "Pressure test set", qty: 1, workedHrs: 4, idleHrs: 4 },
    { name: "Core cutting machine", qty: 1, workedHrs: 3, idleHrs: 5 },
    { name: "De-watering pump", qty: 2, workedHrs: 6, idleHrs: 2 },
    { name: "Welding set (MS supports)", qty: 1, workedHrs: 5, idleHrs: 3 },
  ],
};

function applyDemoQuantities(lines: DprLine[], discipline: string): DprLine[] {
  const factor = discipline === "PEB_SUPPLY" ? 0.015 : 0.025;
  return lines.map((ln, i) => {
    const scope = Number(ln.scopeQty) || 0;
    const prev = Number(ln.cumQtyPrev) || 0;
    const balance = Math.max(0, scope - prev);
    if (i >= 8 || balance <= 0 || scope <= 0) return { ...ln, qtyToday: 0 };
    const qtyToday = Math.min(balance, Math.max(1, Math.round(scope * factor * (1 + (i % 3) * 0.1))));
    return { ...ln, qtyToday };
  });
}

function enrichMaterials(materials: DprMaterial[], discipline: string): DprMaterial[] {
  if (discipline === "CIVIL") {
    return materials.map((m) => {
      if (/cement/i.test(m.name)) return { ...m, consumed: 42, received: 50, opening: 120 };
      if (/reinforcement/i.test(m.name)) return { ...m, consumed: m.consumed || 1850, received: 2000, opening: 4200 };
      if (/rmc/i.test(m.name)) return { ...m, consumed: 18, received: 24, opening: 0 };
      if (/aggregate/i.test(m.name)) return { ...m, consumed: 12, received: 15, opening: 30 };
      if (/shuttering/i.test(m.name)) return { ...m, consumed: 85, received: 0, opening: 220 };
      return m;
    });
  }
  return materials;
}

/** Minimal PNG placeholder for demo signatures (400×100 white bar). */
function demoSignaturePng(role: string): Buffer {
  const candidates = [
    path.resolve(process.cwd(), "apps/web/public/logo.png"),
    path.resolve(process.cwd(), "../web/public/logo.png"),
    path.resolve(process.cwd(), "public/logo.png"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(p);
  }
  void role;
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
}

async function ensureDemoDayRecords(
  prisma: PrismaClient,
  projectId: string,
  logDate: Date,
  reportedById: string
) {
  const start = new Date(logDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  await prisma.safetyRecord.deleteMany({
    where: { projectId, occurredAt: { gte: start, lt: end }, title: { startsWith: "[DPR-DEMO]" } },
  });
  await prisma.cubeTest.deleteMany({
    where: { projectId, castDate: { gte: start, lt: end }, description: { startsWith: "[DPR-DEMO]" } },
  });

  await prisma.safetyRecord.createMany({
    data: [
      {
        projectId,
        recordType: "Toolbox Talk",
        title: "[DPR-DEMO] Working at height & PPE compliance",
        description: "Morning toolbox talk — balcony edge protection and harness use.",
        severity: "Medium",
        status: "Closed",
        location: "Block A — Level 2",
        occurredAt: logDate,
        reportedById,
        closedAt: logDate,
      },
      {
        projectId,
        recordType: "Observation",
        title: "[DPR-DEMO] Housekeeping — rebar bundling yard",
        description: "Loose binding wire and scrap — rectified same day.",
        severity: "Low",
        status: "Closed",
        location: "Block A — rebar yard",
        occurredAt: logDate,
        reportedById,
        closedAt: logDate,
      },
      {
        projectId,
        recordType: "Near Miss",
        title: "[DPR-DEMO] Trip hazard — cable tray staging",
        description: "Unmarked cable drum — cordoned and tagged.",
        severity: "Medium",
        status: "Open",
        location: "Electrical store",
        occurredAt: logDate,
        reportedById,
      },
    ],
  });

  await prisma.cubeTest.create({
    data: {
      projectId,
      description: "[DPR-DEMO] Block A — Col 12–15 · M30 · Set A/B",
      grade: "M30",
      castDate: logDate,
      testDate7: new Date(logDate.getTime() + 7 * 24 * 60 * 60 * 1000),
      result: "Cast",
      source: "DPR demo seed",
    },
  });
}

async function demoSignatures(
  projectCode: string,
  discipline: string,
  logDate: Date
): Promise<DprPhoto[]> {
  const dateStr = logDate.toISOString().slice(0, 10);
  const folder = `${MODULE_TO_ISO_FOLDER.dpr}/${discipline}/signatures`;
  const out: DprPhoto[] = [];
  for (const role of DEMO_SIG_ROLES) {
    const safeRole = role.replace(/[^A-Za-z0-9._-]+/g, "_");
    const fname = `${dateStr}-${safeRole}-demo.png`;
    const saved = await mockOneDrive.upload(projectCode, folder, fname, demoSignaturePng(role));
    out.push({
      path: saved.path,
      caption: role,
      takenAt: new Date().toISOString(),
      kind: "signature",
    });
  }
  return out;
}

function writeLocalFile(projectCode: string, relFolder: string, fname: string, buf: Buffer): string {
  const root = path.join(process.cwd(), "uploads", "onedrive", projectCode, relFolder);
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, fname), buf);
  return `${relFolder}/${fname}`;
}

export type DprDemoDayResult = {
  logDate: string;
  projectCode: string;
  disciplines: Array<{
    discipline: string;
    lineCount: number;
    qtyToday: number;
    publishedPath: string;
    htmlPath: string;
    signatures: number;
    sources: string[];
  }>;
};

export async function seedDprDemoDay(
  prisma: PrismaClient,
  projectId: string,
  logDate: Date,
  createdById: string
): Promise<DprDemoDayResult> {
  logDate.setHours(0, 0, 0, 0);
  const dateStr = logDate.toISOString().slice(0, 10);

  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  await prisma.project.update({
    where: { id: project.id },
    data: {
      contractorName: project.contractorName || "M/s Bhavna Infra",
      designConsultant: project.designConsultant || "SPDC PMC Team",
      endDate: project.endDate || new Date("2027-03-31"),
    },
  });

  await ensureDemoDayRecords(prisma, project.id, logDate, createdById);

  const disciplines: DprDemoDayResult["disciplines"] = [];
  const relBase = MODULE_TO_ISO_FOLDER.dpr;

  for (const discipline of DPR_DEMO_DISCIPLINES) {
    const auto = await buildDprAutoFill(project.id, logDate, discipline);
    const lines = applyDemoQuantities(auto.lines, discipline);
    const signatures = await demoSignatures(project.code, discipline, logDate);

    const header: DprHeader = {
      projectName: project.name,
      projectManager: project.designConsultant || "SPDC PMC Team",
      contractor: project.contractorName || "M/s Bhavna Infra",
      location: project.location || "Ahmedabad, Gujarat",
      contractRef: "WO/SPDC/2025/014",
      contractCompletion: project.endDate ? project.endDate.toISOString() : null,
      calendarHours: "6 Days / Week – 8 hrs",
      shiftHours: 8,
      weather: "Partly cloudy · 32°C · light breeze",
      reportDate: logDate.toISOString(),
      dataDate: logDate.toISOString(),
      reportNumber: `DPR/${discipline.slice(0, 3)}-${dateStr.replace(/-/g, "")}`,
      acCertifiedToDate: auto.header.acCertifiedToDate ?? 0,
      cumManDaysPrev: auto.header.cumManDaysPrev ?? 0,
      cumSafeManHoursPrev: auto.header.cumSafeManHoursPrev ?? 0,
      dateOfLastLti: null,
      preparedBy: "Site Engineer – SPDC (PMC)",
    };

    const extras = {
      manpower: auto.manpower.length ? auto.manpower : defaultManpower(),
      equipment: EQUIPMENT_BY_DISCIPLINE[discipline] || EQUIPMENT_BY_DISCIPLINE.CIVIL,
      materials: enrichMaterials(auto.materials, discipline),
      qualityTests: auto.qualityTests,
      safetyRows: auto.safetyRows,
      safety: auto.safety,
      delays: auto.delays,
      approvals: auto.approvals,
      issues: auto.issues,
      highlights: [
        `${discipline.replace(/_/g, " ")} works progressed as per weekly look-ahead.`,
        `BOQ lines auto-filled from Cost monitoring (${auto.sources.slice(0, 2).join(", ") || "activity register"}).`,
        "No LTI — toolbox talk and PPE compliance verified on site.",
      ],
      nextDayPlan: [
        "Continue balance activities on priority BOQ items.",
        "Close open hindrances / RFIs listed in approvals block.",
        "Maintain cube casting and checklist sign-off before pour.",
      ],
      decisions: ["Proceed with next lift after QC hold-point clearance."],
      photos: [],
      attachments: [],
      signatures,
    };

    const xlsxBuf = await buildDprWorkbook(
      { discipline, header, lines, ...extras },
      { projectId: project.id, logDate }
    );
    const xlsxName = `DPR-${project.code}-${discipline}-${dateStr}.xlsx`;
    const publishedPath = writeLocalFile(project.code, `${relBase}/${discipline}`, xlsxName, xlsxBuf);

    const snapForCharts = { discipline, header, lines, manpower: extras.manpower, safety: extras.safety };
    const scurve = await loadDprScurveHistory(project.id, discipline, logDate, snapForCharts);
    const charts = buildDprChartPack(snapForCharts, scurve);

    const html = renderDprSnapshotHtml({
      project: { code: project.code, name: project.name, clientName: project.clientName, location: project.location },
      logDate,
      discipline,
      status: "Published",
      header,
      lines,
      manpower: extras.manpower,
      materials: extras.materials,
      safety: extras.safety,
      highlights: extras.highlights,
      nextDayPlan: extras.nextDayPlan,
      delays: extras.delays,
      issues: extras.issues,
      charts,
    });
    const htmlName = `DPR-${project.code}-${discipline}-${dateStr}.html`;
    const htmlPath = writeLocalFile(project.code, `${relBase}/${discipline}`, htmlName, Buffer.from(html, "utf8"));

    await prisma.dprSnapshot.upsert({
      where: { projectId_logDate_discipline: { projectId: project.id, logDate, discipline } },
      create: {
        projectId: project.id,
        logDate,
        discipline,
        headerJson: packHeader(header, extras),
        linesJson: JSON.stringify(lines),
        status: "Published",
        publishedAt: new Date(),
        publishedPath,
        createdById,
      },
      update: {
        headerJson: packHeader(header, extras),
        linesJson: JSON.stringify(lines),
        status: "Published",
        publishedAt: new Date(),
        publishedPath,
        updatedAt: new Date(),
      },
    });

    const qtySum = lines.reduce((s, l) => s + (Number(l.qtyToday) || 0), 0);
    disciplines.push({
      discipline,
      lineCount: lines.length,
      qtyToday: qtySum,
      publishedPath,
      htmlPath,
      signatures: signatures.length,
      sources: auto.sources,
    });
  }

  return { logDate: dateStr, projectCode: project.code, disciplines };
}
