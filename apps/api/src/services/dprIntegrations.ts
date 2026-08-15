/**
 * DPR auto-fill — single source of truth wiring (mirrors WPR seedSections).
 *
 * Client reference packs:
 *   Sharnam_modules_docs/DPR-Sharnam PMC- ARVIND LIMITED (3) (1).xlsx
 *     Summary · Daily Progress Dashboard · Manpower/Equipment/Materials · Concern · Hindrance
 *   Sharnam_modules_docs/Planned Vs. Actual Dashboard.xlsx
 *   SPDC discipline templates (apps/api/dpr-templates/*_DASHBOARD.xlsx)
 *
 * Data flow (discipline-scoped by packageName):
 *   CostMonitoringLine (BOQ)     → quantity progress lines (scope, rate, achieved)
 *   ProgressActivityLine         → planned qty / location hints on matching descriptions
 *   CostMbLine                   → MB qty enriches cumQtyPrev where description matches
 *   CostBbsLine                  → reinforcement kg → materials "consumed" row
 *   Previous DprSnapshot         → cumQtyPrev, cumManDaysPrev, cumSafeManHoursPrev
 *   ProgressManpower             → manpower planned vs actual
 *   SafetyRecord (day)           → HSE stats + safetyRows
 *   QualityNcr + CubeTest        → quality control figures
 *   ProgressHindrance (open)     → delays + issues
 *   Rfi (open)                   → approvals pending
 *   CostCashflowPeriod           → AC certified to date (header)
 */
import { prisma } from "../prisma.js";
import type {
  DprApprovalPending,
  DprDelay,
  DprEquipment,
  DprHeader,
  DprIssue,
  DprLine,
  DprManpower,
  DprMaterial,
  DprQualityTest,
  DprSafety,
  DprSafetyRow,
} from "./dprXlsx.js";

/** Cost monitoring package names from SPDC_Budget_Arvind (see seed/costFromBudget.ts). */
const DISCIPLINE_PACKAGES: Record<string, string[]> = {
  CIVIL: ["Civil Dormitory", "Combined", "Civil"],
  ELECTRICAL: ["Electric", "External Electric", "Electrical"],
  FIRE: ["Fire Fighting", "Fire Alarm", "Fire"],
  MECHANICAL: ["Gas Line", "Furniture", "Mechanical"],
  PEB_ERECTION: ["Compound Wall", "Road & Paving", "External Development", "PEB"],
  PEB_SUPPLY: ["Combined", "Windows", "WPC Door", "PEB Supply"],
  PLUMBING: ["Plumbing", "UGWT", "Septic Tank"],
};

export function disciplinePackages(discipline: string): string[] {
  return DISCIPLINE_PACKAGES[discipline.toUpperCase()] || ["Civil Dormitory", "Combined"];
}

/** Primary package label (for logging / UI). */
export function disciplinePackage(discipline: string): string {
  return disciplinePackages(discipline)[0];
}

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function fuzzyMatch(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  return x.includes(y) || y.includes(x);
}

function dayRange(logDate: Date) {
  const start = new Date(logDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export type DprAutoFill = {
  header: Partial<DprHeader>;
  lines: DprLine[];
  manpower: DprManpower[];
  materials: DprMaterial[];
  qualityTests: DprQualityTest[];
  safetyRows: DprSafetyRow[];
  safety: Partial<DprSafety>;
  delays: DprDelay[];
  approvals: DprApprovalPending[];
  issues: DprIssue[];
  sources: string[];
};

/** Sum qtyToday from published DPRs before logDate for cumulative progress. */
async function previousDprCumulative(projectId: string, logDate: Date, discipline: string) {
  const prior = await prisma.dprSnapshot.findMany({
    where: {
      projectId,
      discipline,
      logDate: { lt: logDate },
      status: { in: ["Published", "Draft"] },
    },
    orderBy: { logDate: "asc" },
  });

  let cumManDays = 0;
  let cumSafeHours = 0;
  const lineCum = new Map<string, number>();

  for (const snap of prior) {
    const { header, extras } = splitHeaderJson(snap.headerJson);
    cumManDays += Number(header.cumManDaysPrev || 0) + sumManDays(extras?.manpower);
    cumSafeHours += Number(header.cumSafeManHoursPrev || 0) + Number(extras?.safety?.safeManHoursToday || 0);

    const lines: DprLine[] = JSON.parse(snap.linesJson || "[]");
    for (const ln of lines) {
      const key = norm(ln.description || "");
      lineCum.set(key, (lineCum.get(key) || 0) + Number(ln.qtyToday || 0));
    }
  }

  return { lineCum, cumManDays, cumSafeHours, priorCount: prior.length };
}

function splitHeaderJson(headerJson: string | null) {
  const raw = JSON.parse(headerJson || "{}") as Record<string, unknown>;
  const { _extras, ...header } = raw;
  return { header: header as DprHeader, extras: (_extras || {}) as { manpower?: DprManpower[]; safety?: DprSafety } };
}

function sumManDays(rows?: DprManpower[]) {
  if (!rows?.length) return 0;
  return rows.reduce((s, r) => s + Number(r.actual || 0), 0);
}

export async function buildDprAutoFill(
  projectId: string,
  logDate: Date,
  discipline: string
): Promise<DprAutoFill> {
  const pkgs = disciplinePackages(discipline);
  const pkg = pkgs[0];
  const { start, end } = dayRange(logDate);
  const sources: string[] = [];

  const [
    monitoring,
    activityLines,
    mbLines,
    bbsLines,
    manpowerRegs,
    safetyToday,
    safetyOpen,
    ncrsOpen,
    cubesToday,
    hindrances,
    rfisOpen,
    cashflow,
    prev,
  ] = await Promise.all([
    prisma.costMonitoringLine.findMany({
      where: { projectId, packageName: { in: pkgs } },
      orderBy: { itemNo: "asc" },
      take: 15,
    }),
    prisma.progressActivityLine.findMany({ where: { projectId }, orderBy: { srNo: "asc" }, take: 200 }),
    prisma.costMbLine.findMany({ where: { projectId, packageName: { in: pkgs } }, take: 500 }),
    prisma.costBbsLine.findMany({ where: { projectId, packageName: { in: pkgs } }, take: 500 }),
    prisma.progressManpower.findMany({ where: { projectId }, orderBy: { rank: "asc" }, take: 20 }),
    prisma.safetyRecord.findMany({ where: { projectId, occurredAt: { gte: start, lt: end } } }),
    prisma.safetyRecord.findMany({ where: { projectId, status: "Open" }, take: 50 }),
    prisma.qualityNcr.findMany({ where: { projectId, status: "Open" }, take: 50 }),
    prisma.cubeTest.findMany({
      where: { projectId, castDate: { gte: start, lt: end } },
      take: 20,
    }),
    prisma.progressHindrance.findMany({ where: { projectId, status: "Open" }, take: 15, orderBy: { occurredAt: "desc" } }),
    prisma.rfi.findMany({ where: { projectId, status: "Open" }, take: 15, orderBy: { createdAt: "desc" } }),
    prisma.costCashflowPeriod.findMany({
      where: { projectId, OR: [{ packageName: { in: pkgs } }, { packageName: "Project cashflow" }] },
      take: 40,
    }),
    previousDprCumulative(projectId, logDate, discipline),
  ]);

  if (monitoring.length) sources.push(`BOQ monitoring (${pkgs.slice(0, 2).join(", ")})`);
  if (activityLines.length) sources.push("Planned vs Actual activities");
  if (mbLines.length) sources.push(`MB (${pkg})`);
  if (bbsLines.length) sources.push(`BBS (${pkg})`);
  if (prev.priorCount) sources.push(`${prev.priorCount} prior DPR(s)`);
  if (manpowerRegs.length) sources.push("Progress manpower register");
  if (safetyToday.length || safetyOpen.length) sources.push("Safety records / NCR");
  if (ncrsOpen.length || cubesToday.length) sources.push("Quality NCR / cube tests");
  if (hindrances.length) sources.push("Hindrance register");
  if (rfisOpen.length) sources.push("Open RFIs");

  const lines: DprLine[] =
    monitoring.length > 0
      ? monitoring.map((r) => {
          const act = activityLines.find((a) => fuzzyMatch(a.activity, r.description));
          const mbQty = mbLines
            .filter((m) => fuzzyMatch(m.description, r.description))
            .reduce((s, m) => s + (m.qty || 0), 0);
          const dprCum = prev.lineCum.get(norm(r.description)) || 0;
          const cumQtyPrev = Math.max(r.achievedQty || 0, mbQty, dprCum);
          const plannedHint = act?.weeklyPlanned ?? act?.boqQty;
          return {
            srNo: undefined,
            group: r.section || act?.tower || undefined,
            description: r.description,
            unit: r.uom || act?.unit || undefined,
            scopeQty: r.boqQty || r.gfcQty || act?.boqQty || 0,
            rate: r.rate || 0,
            start: act?.plannedStart ? act.plannedStart.toISOString().slice(0, 10) : null,
            finish: act?.plannedEnd ? act.plannedEnd.toISOString().slice(0, 10) : null,
            cumQtyPrev,
            qtyToday: 0,
            remarks: plannedHint ? `Planned: ${plannedHint}${act?.weeklyActual != null ? ` · P-A actual: ${act.weeklyActual}` : ""}` : "",
          };
        })
      : activityLines.slice(0, 15).map((a) => ({
          group: a.tower || undefined,
          description: a.activity,
          unit: a.unit || undefined,
          scopeQty: a.boqQty || a.gfcQty || 0,
          cumQtyPrev: a.cumulativeQty || a.executedQty || prev.lineCum.get(norm(a.activity)) || 0,
          qtyToday: 0,
          remarks: `Planned ${a.weeklyPlanned} · Actual ${a.weeklyActual}`,
        }));

  const bbsKg = bbsLines.reduce((s, b) => s + (b.weightKg || 0), 0);
  const materials: DprMaterial[] = [
    { name: "Cement OPC 53", unit: "BAGS", opening: 0, received: 0, consumed: 0 },
    {
      name: "Reinforcement Fe 500 D",
      unit: "KGS",
      opening: 0,
      received: 0,
      consumed: bbsKg > 0 ? Math.round(bbsKg) : 0,
    },
    { name: "RMC M30 (direct pour)", unit: "CUM", opening: 0, received: 0, consumed: 0 },
    { name: "Coarse Aggregate 20 / 10 mm", unit: "CUM", opening: 0, received: 0, consumed: 0 },
    { name: "Shuttering Ply 12 mm", unit: "SQM", opening: 0, received: 0, consumed: 0 },
    { name: "Cover Blocks & Binding Wire", unit: "NOS", opening: 0, received: 0, consumed: 0 },
  ];

  const manpower: DprManpower[] = manpowerRegs.length
    ? manpowerRegs.map((m) => ({
        trade: m.trade,
        planned: m.required,
        actual: m.available,
        hoursWorked: 8,
      }))
    : [];

  const nearMiss = safetyToday.filter((s) => /near/i.test(s.recordType)).length;
  const firstAid = safetyToday.filter((s) => /first aid/i.test(s.recordType)).length;
  const observationsRaised = safetyToday.filter((s) => /observation/i.test(s.recordType)).length;
  const observationsClosed = safetyToday.filter((s) => s.status === "Closed").length;
  const safeManHoursToday = manpower.reduce((s, m) => s + Number(m.actual || 0) * Number(m.hoursWorked || 8), 0);

  const safety: Partial<DprSafety> = {
    safeManHoursToday,
    safeManDaysToday: sumManDays(manpower),
    toolboxTalks: safetyToday.filter((s) => /toolbox|tbt/i.test(s.title + s.recordType)).length,
    nearMiss,
    firstAid,
    observationsRaised,
    observationsClosed,
    ltis: safetyToday.filter((s) => /lti|lost time/i.test(s.recordType + s.title)).length,
    incidents: safetyToday.filter((s) => /incident/i.test(s.recordType)).length,
  };

  const qualityTests: DprQualityTest[] = [
    {
      parameter: "Pour cards offered / approved",
      figure: String(cubesToday.length ? cubesToday.length : "—"),
    },
    {
      parameter: "Concrete cube sets cast / slump tests",
      figure: cubesToday.map((c) => c.description).join("; ") || "—",
    },
    { parameter: "Reinforcement & shuttering checklists", figure: "—" },
    { parameter: "7-day cube result", figure: "—" },
    {
      parameter: "NCRs open / closed today",
      figure: `${ncrsOpen.length} open · ${safetyOpen.filter((s) => /ncr/i.test(s.recordType)).length} safety`,
    },
    { parameter: "Field density (compaction) tests", figure: "—" },
  ];

  const cumSafe = prev.cumSafeHours + safeManHoursToday;
  const safetyRows: DprSafetyRow[] = [
    { parameter: "Safe man-hours – today / cumulative", figure: `${safeManHoursToday} / ${cumSafe}` },
    { parameter: "Days without LTI", figure: "—" },
    { parameter: "Toolbox talks conducted", figure: String(safety.toolboxTalks ?? 0) },
    { parameter: "Permits to work issued", figure: "—" },
    {
      parameter: "Safety observations raised / closed",
      figure: `${observationsRaised} / ${observationsClosed}`,
    },
    { parameter: "Near miss / first aid today", figure: `${nearMiss} / ${firstAid}` },
  ];

  const delays: DprDelay[] = hindrances.slice(0, 4).map((h) => ({
    cause: h.description,
    category: h.category || "Hindrance",
    from: undefined,
    to: undefined,
    hoursLost: h.daysImpacted ? h.daysImpacted * 8 : h.scheduleImpact ? h.scheduleImpact * 8 : undefined,
    eot: "Review",
  }));

  const approvals: DprApprovalPending[] = rfisOpen.slice(0, 4).map((r) => ({
    refNo: r.number,
    description: r.subject,
    raisedOn: r.createdAt.toISOString().slice(0, 10),
    pendingWith: r.ballInCourt || "—",
  }));

  const issues: DprIssue[] = [
    ...hindrances.slice(0, 3).map((h) => ({
      description: h.description,
      severity: "High" as const,
      owner: h.accountable || "PMC",
    })),
    ...ncrsOpen.slice(0, 2).map((n) => ({
      description: n.description,
      severity: "Medium" as const,
      owner: "Quality",
    })),
  ];

  const acCertifiedToDate = cashflow.reduce((s, c) => s + (c.actualAmount || 0), 0)
    || monitoring.reduce((s, m) => s + (m.certifiedQty || 0) * (m.rate || 0), 0);

  const header: Partial<DprHeader> = {
    acCertifiedToDate,
    cumManDaysPrev: prev.cumManDays,
    cumSafeManHoursPrev: prev.cumSafeHours,
  };

  return {
    header,
    lines,
    manpower,
    materials,
    qualityTests,
    safetyRows,
    safety,
    delays,
    approvals,
    issues,
    sources,
  };
}
