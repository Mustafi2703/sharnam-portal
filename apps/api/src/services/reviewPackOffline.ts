/**
 * Offline DPR/WPR demo packs — no database required (local UAT file generation).
 */
import type { DprEquipment, DprHeader, DprLine, DprManpower, DprMaterial } from "./dprXlsx.js";
import { DPR_DEMO_DISCIPLINES } from "./dprDemoDaySeed.js";
import { DEFAULT_WPR_TITLES, type WprHeader, type WprSection, type WprSections } from "./wprXlsx.js";

export const OFFLINE_PROJECT = {
  code: "SPDC-DEMO-01",
  name: "Arvind Limited — Integrated Industrial Campus",
  clientName: "Arvind Limited",
  location: "Naroda, Ahmedabad, Gujarat",
  contractorName: "M/s Bhavna Infra",
  designConsultant: "SPDC PMC Team",
};

function demoLines(discipline: string): DprLine[] {
  const base: DprLine[] = [
    { group: "Substructure", description: "Excavation & PCC in foundation", unit: "Cum", scopeQty: 420, rate: 850, cumQtyPrev: 180, qtyToday: 12 },
    { group: "Substructure", description: "RCC footing M30", unit: "Cum", scopeQty: 280, rate: 7200, cumQtyPrev: 95, qtyToday: 8 },
    { group: "Superstructure", description: "Column casting M30", unit: "Cum", scopeQty: 190, rate: 7800, cumQtyPrev: 62, qtyToday: 6 },
    { group: "Superstructure", description: "Slab shuttering", unit: "Sqm", scopeQty: 12500, rate: 420, cumQtyPrev: 4100, qtyToday: 320 },
    { group: "Superstructure", description: "Slab RCC M30", unit: "Cum", scopeQty: 980, rate: 7600, cumQtyPrev: 310, qtyToday: 28 },
    { group: "Masonry", description: "Block work 200mm", unit: "Sqm", scopeQty: 8600, rate: 380, cumQtyPrev: 1200, qtyToday: 180 },
    { group: "Finishes", description: "Internal plaster 12mm", unit: "Sqm", scopeQty: 22000, rate: 210, cumQtyPrev: 0, qtyToday: 0 },
    { group: "External", description: "Road sub-base GSB", unit: "Cum", scopeQty: 2400, rate: 620, cumQtyPrev: 890, qtyToday: 45 },
    { group: "PEB", description: "Anchor bolt setting", unit: "Nos", scopeQty: 480, rate: 120, cumQtyPrev: 120, qtyToday: 24 },
    { group: "MEP", description: "Cable tray erection", unit: "Rm", scopeQty: 3200, rate: 185, cumQtyPrev: 800, qtyToday: 95 },
    { group: "Fire", description: "Sprinkler header line", unit: "Rm", scopeQty: 1800, rate: 420, cumQtyPrev: 400, qtyToday: 55 },
    { group: "Plumbing", description: "UG drainage 150mm", unit: "Rm", scopeQty: 2100, rate: 340, cumQtyPrev: 620, qtyToday: 70 },
    { group: "Mechanical", description: "AHU plenum fabrication", unit: "Kg", scopeQty: 12000, rate: 95, cumQtyPrev: 2800, qtyToday: 450 },
    { group: "PEB Supply", description: "Primary frame dispatch", unit: "MT", scopeQty: 420, rate: 82000, cumQtyPrev: 85, qtyToday: 12 },
    { group: "General", description: `${discipline.replace(/_/g, " ")} balance works`, unit: "LS", scopeQty: 1, rate: 500000, cumQtyPrev: 0, qtyToday: 0 },
  ];
  const factor = discipline === "PEB_SUPPLY" ? 0.012 : 0.022;
  return base.map((ln, i) => {
    if (i >= 10 || !ln.scopeQty) return ln;
    const balance = Math.max(0, (ln.scopeQty || 0) - (ln.cumQtyPrev || 0));
    const qtyToday = Math.min(balance, Math.max(1, Math.round((ln.scopeQty || 0) * factor)));
    return { ...ln, qtyToday };
  });
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

const EQUIPMENT: Record<string, DprEquipment[]> = {
  CIVIL: [
    { name: "Excavator – JCB 3DX", qty: 1, workedHrs: 6, idleHrs: 2 },
    { name: "Transit Mixer 6 CUM", qty: 2, workedHrs: 7, idleHrs: 1 },
    { name: "Concrete Boom Pump 36 m", qty: 1, workedHrs: 5, idleHrs: 3 },
  ],
  ELECTRICAL: [{ name: "Cable pulling winch", qty: 1, workedHrs: 7, idleHrs: 1 }],
  FIRE: [{ name: "Pipe threading machine", qty: 1, workedHrs: 6, idleHrs: 2 }],
  MECHANICAL: [{ name: "Chain pulley block 5 T", qty: 2, workedHrs: 6, idleHrs: 2 }],
  PEB_ERECTION: [{ name: "Mobile crane 25 T", qty: 1, workedHrs: 7, idleHrs: 1 }],
  PEB_SUPPLY: [{ name: "Flat-bed trailer (inbound)", qty: 2, workedHrs: 6, idleHrs: 2 }],
  PLUMBING: [{ name: "Pipe threading machine", qty: 1, workedHrs: 6, idleHrs: 2 }],
};

export function buildOfflineDprPack(discipline: string, logDate: Date) {
  const dateStr = logDate.toISOString().slice(0, 10);
  const header: DprHeader = {
    projectName: OFFLINE_PROJECT.name,
    projectManager: OFFLINE_PROJECT.designConsultant,
    contractor: OFFLINE_PROJECT.contractorName,
    location: OFFLINE_PROJECT.location,
    contractRef: "WO/SPDC/2025/014",
    contractCompletion: "2027-03-31",
    calendarHours: "6 Days / Week – 8 hrs",
    shiftHours: 8,
    weather: "Partly cloudy · 32°C · light breeze",
    reportDate: logDate.toISOString(),
    dataDate: logDate.toISOString(),
    reportNumber: `DPR/${discipline.slice(0, 3)}-${dateStr.replace(/-/g, "")}`,
    acCertifiedToDate: 42.5,
    cumManDaysPrev: 1840,
    cumSafeManHoursPrev: 147200,
    dateOfLastLti: null,
    preparedBy: "Site Engineer – Sharnam PMC",
  };
  const materials: DprMaterial[] = [
    { name: "Cement OPC 53", unit: "MT", opening: 120, received: 50, consumed: 42 },
    { name: "Reinforcement steel", unit: "MT", opening: 420, received: 200, consumed: 18.5 },
    { name: "RMC M30", unit: "Cum", opening: 0, received: 24, consumed: 18 },
  ];
  return {
    discipline,
    header,
    lines: demoLines(discipline),
    manpower: defaultManpower(),
    equipment: EQUIPMENT[discipline] || EQUIPMENT.CIVIL,
    materials,
    qualityTests: [
      { test: "Cube M30 — Col 12–15", result: "Cast", remarks: "Set A/B" },
      { test: "Rebar bend test", result: "OK", remarks: "Batch #4421" },
    ],
    safetyRows: [
      { metric: "Toolbox talks", today: 1, cumulative: 48 },
      { metric: "Near miss", today: 0, cumulative: 3 },
      { metric: "First aid", today: 0, cumulative: 1 },
    ],
    safety: { manDaysToday: 55, safeManHoursToday: 440, ltiToday: 0 },
    delays: [{ reason: "RMC delay 45 min", durationHrs: 0.75, impact: "Slab pour shifted" }],
    approvals: [{ item: "Shuttering release GL+3", status: "Pending", owner: "PMC" }],
    issues: [{ description: "Edge protection at Block B", severity: "Medium", owner: "Safety" }],
    highlights: [
      `${discipline.replace(/_/g, " ")} works progressed per weekly look-ahead.`,
      "No LTI — toolbox talk and PPE compliance verified.",
      "QC hold-point cleared for footing pour Zone C.",
    ],
    nextDayPlan: [
      "Continue balance BOQ items on priority zones.",
      "Close open RFIs listed in approvals block.",
      "Maintain cube casting before next pour.",
    ],
    decisions: ["Proceed with next PEB lift after QC clearance."],
    photos: [],
    attachments: [],
    signatures: [],
  };
}

export function buildOfflineWprPack(weekEnd: Date): { header: WprHeader; sections: WprSections } {
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekEnd.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);
  const header: WprHeader = {
    projectName: OFFLINE_PROJECT.name,
    projectCode: OFFLINE_PROJECT.code,
    reportNumber: 50,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    clientName: OFFLINE_PROJECT.clientName,
    designConsultant: OFFLINE_PROJECT.designConsultant,
    contractorName: OFFLINE_PROJECT.contractorName,
    location: OFFLINE_PROJECT.location,
    pmc: "Sharnam Project Development Consultants & Co.",
  };
  const sections = {} as WprSections;
  for (const key of Object.keys(DEFAULT_WPR_TITLES) as (keyof WprSections)[]) {
    const sec: WprSection = {
      title: DEFAULT_WPR_TITLES[key],
      headers: ["Item", "Planned", "Actual", "Remarks"],
      rows: [
        [`${DEFAULT_WPR_TITLES[key]} — line 1`, "100%", "92%", "On track"],
        [`${DEFAULT_WPR_TITLES[key]} — line 2`, "Week 50", "Completed", "Sharnam PMC review"],
        [`${DEFAULT_WPR_TITLES[key]} — line 3`, "—", "—", "See attached DPR pack"],
      ],
    };
    if (key === "projectDashboard") {
      sec.notes = "Overall progress 68% · Manpower 55/day · Zero LTI this week.";
    }
    if (key === "milestones") {
      sec.headers = ["Milestone", "Baseline", "Forecast", "Status"];
      sec.rows = [
        ["Substructure complete", "2026-06-30", "2026-07-15", "At risk"],
        ["Superstructure L4 slab", "2026-09-30", "2026-09-28", "On track"],
        ["PEB erection start", "2026-11-01", "2026-11-01", "On track"],
      ];
    }
    sections[key] = sec;
  }
  return { header, sections };
}

export { DPR_DEMO_DISCIPLINES };
