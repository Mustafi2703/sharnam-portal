/**
 * Pack completeness — verify a project has the sheet-backed registers
 * needed for a full DPR day and WPR week (single source of truth checks).
 */
import { prisma } from "../prisma.js";

export type PackCheck = {
  key: string;
  layer: "cost" | "progress" | "quality" | "safety" | "diary" | "comms" | "reports";
  label: string;
  ok: boolean;
  count: number;
  min: number;
  sheet: string;
  feeds: string;
  detail?: string;
};

function check(
  key: string,
  layer: PackCheck["layer"],
  label: string,
  count: number,
  min: number,
  sheet: string,
  feeds: string,
  detail?: string
): PackCheck {
  return { key, layer, label, ok: count >= min, count, min, sheet, feeds, detail };
}

export async function verifyPackCompleteness(projectId: string, opts?: { logDate?: Date }) {
  const day = opts?.logDate || new Date();
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const weekStart = new Date(start);
  const dow = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() + (dow === 0 ? -6 : 1 - dow));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [
    monitoring,
    mb,
    bbs,
    cashflow,
    pvaCash,
    pvaActivity,
    manpower,
    milestones,
    hindrance,
    risk,
    legal,
    qap,
    ncr,
    cube,
    sor,
    safety,
    diary,
    drawingsPublished,
    dprSnaps,
    wprPacks,
    openRfi,
  ] = await Promise.all([
    prisma.costMonitoringLine.count({ where: { projectId } }),
    prisma.costMbLine.count({ where: { projectId } }),
    prisma.costBbsLine.count({ where: { projectId } }),
    prisma.costCashflowPeriod.count({
      where: { projectId, NOT: { packageName: "COP-day" } },
    }),
    prisma.progressPlannedActual.count({ where: { projectId } }),
    prisma.progressActivityLine.count({ where: { projectId } }),
    prisma.progressManpower.count({ where: { projectId } }),
    prisma.progressMilestone.count({ where: { projectId } }),
    prisma.progressHindrance.count({ where: { projectId } }),
    prisma.progressRisk.count({ where: { projectId } }),
    prisma.progressLegalApproval.count({ where: { projectId } }),
    prisma.qapActivity.count({ where: { projectId } }),
    prisma.qualityNcr.count({ where: { projectId } }),
    prisma.cubeTest.count({ where: { projectId } }),
    prisma.qualitySiteRecord.count({ where: { projectId } }),
    prisma.safetyRecord.count({ where: { projectId } }),
    prisma.dailyLog.count({
      where: { projectId, logDate: { gte: weekStart, lt: weekEnd } },
    }),
    prisma.drawing.count({ where: { projectId, isPublished: true } }),
    prisma.dprSnapshot.count({
      where: { projectId, logDate: { gte: start, lt: end }, status: "Published" },
    }),
    prisma.wprSnapshot.count({ where: { projectId } }),
    prisma.rfi.count({ where: { projectId, status: "Open" } }),
  ]);

  const checks: PackCheck[] = [
    check("boq", "cost", "BOQ / Monitoring lines", monitoring, 10, "SPDC_Budget_Arvind · Monitoring *", "DPR qty rows · Progress BOQ view"),
    check("mb", "cost", "Measurement book lines", mb, 1, "SPDC_Budget · * MB", "DPR cumulative qty"),
    check("bbs", "cost", "BBS lines", bbs, 1, "SPDC_Budget · * BBS", "DPR rebar kg"),
    check(
      "cashflow",
      "cost",
      "Cost cashflow periods",
      cashflow,
      1,
      "Cashflow - Dashboard.xlsx (+ PVA sync / COP)",
      "DPR AC certified · WPR cashflow",
      "One layer: edit Progress PvsA cashflow → Sync → Cost. Do not dual-edit Chart rows."
    ),
    check(
      "pva-cash",
      "progress",
      "Planned vs Actual cashflow",
      pvaCash,
      1,
      "Planned Vs. Actual · Project Cashflow",
      "Auto-sync → CostCashflowPeriod (PVA)"
    ),
    check(
      "pva-activity",
      "progress",
      "PvsA activity qty register",
      pvaActivity,
      5,
      "Planned Vs. Actual · Planned Vs Actual",
      "DPR planned hints · WPR PvsA slides"
    ),
    check("manpower", "progress", "Weekly manpower trades", manpower, 1, "Planned Vs. Actual · Weekly Manpower", "DPR/WPR manpower"),
    check("milestones", "progress", "Milestones", milestones, 5, "Milestone tracking.xlsx", "WPR milestone slides"),
    check("hindrance", "progress", "Hindrance register", hindrance, 0, "HInderance Register Dashboard", "DPR delays · WPR"),
    check("risk", "progress", "Risk register", risk, 0, "Risk Register - Dashboard", "WPR risk"),
    check("legal", "progress", "Legal approvals", legal, 0, "Legal Approvals - Dashboard", "WPR legal"),
    check("qap", "quality", "QAP activities", qap, 10, "Quality Assurance Plan Week 50 / Quality Dashboard", "WPR quality"),
    check("ncr", "quality", "Quality NCR/CAR", ncr, 0, "NCR 01.xlsx", "DPR quality · WPR"),
    check("cube", "quality", "Cube register", cube, 1, "SPDC CUBE REGISTER", "DPR cubes · WPR"),
    check("sor", "quality", "SOR / site records", sor, 0, "Quality Dashboard · SOR Log", "DPR SOR lines"),
    check("safety", "safety", "Safety records", safety, 0, "Safety Dashboard / Safety NCR", "DPR HSE · WPR"),
    check("diary", "diary", "Day logs this week", diary, 1, "Site day log (portal)", "WPR manpower fallback · dump-logs"),
    check("drawings", "comms", "Published drawings", drawingsPublished, 1, "DRAWING REGISTER / GFC log", "Checklist gate · WPR drawing"),
    check(
      "dpr-today",
      "reports",
      "Published DPR today (any discipline)",
      dprSnaps,
      0,
      "SPDC_DPR_*_DASHBOARD.xlsx × 7",
      "SharePoint 07.02",
      dprSnaps ? undefined : "Generate via DPR Maker → Publish for each discipline worked today"
    ),
    check("wpr-pack", "reports", "WPR snapshots saved", wprPacks, 0, "SPDC_Arvind Limited_WPR_50.pptx", "SharePoint 10.01"),
    check("open-rfi", "comms", "Open RFIs (info)", openRfi, 0, "SPDC_RFI_Form_and_Register", "DPR approvals pending"),
  ];

  const required = checks.filter((c) => c.min > 0);
  const okRequired = required.filter((c) => c.ok).length;
  const okAll = checks.filter((c) => c.ok).length;

  return {
    projectId,
    asOf: day.toISOString().slice(0, 10),
    summary: {
      checks: checks.length,
      ok: okAll,
      required: required.length,
      requiredOk: okRequired,
      readyForDpr: required.filter((c) => ["boq", "pva-activity", "manpower"].includes(c.key)).every((c) => c.ok),
      readyForWpr:
        required.filter((c) => ["boq", "pva-cash", "milestones", "qap"].includes(c.key)).every((c) => c.ok) ||
        (monitoring >= 10 && milestones >= 5 && qap >= 10),
    },
    checks,
    oneLayerRules: [
      "Planned Vs Actual cashflow: Progress is the edit surface; Cost receives auto-sync (PVA · … + Chart overlay).",
      "COP Certified/Approved/Paid writes COP-* actuals only — never hand-edit those rows.",
      "BOQ achieved: prefer MB sync → Monitoring; DPR qtyToday is the daily increment only.",
      "NCR lives in Quality; Safety NCR/observations stay in Safety — do not duplicate.",
      "Closed RFI + checklist fill archives branded XLSX to SharePoint 03.06 Closed + 08.02 Closed_RFI.",
    ],
  };
}
