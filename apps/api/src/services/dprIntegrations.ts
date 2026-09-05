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
 *   CostCashflowPeriod           → AC certified to date (COP month, else Chart actual)
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
    ncrsToday,
    cubesToday,
    hindrances,
    rfisOpen,
    cashflow,
    prev,
    checklistFillsToday,
    siteRecordsToday,
    qapAgencies,
    diaryToday,
  ] = await Promise.all([
    prisma.costMonitoringLine.findMany({
      where: { projectId, packageName: { in: pkgs } },
      orderBy: { itemNo: "asc" },
      take: 400,
    }),
    prisma.progressActivityLine.findMany({ where: { projectId }, orderBy: { srNo: "asc" }, take: 200 }),
    prisma.costMbLine.findMany({ where: { projectId, packageName: { in: pkgs } }, take: 500 }),
    prisma.costBbsLine.findMany({ where: { projectId, packageName: { in: pkgs } }, take: 500 }),
    prisma.progressManpower.findMany({ where: { projectId }, orderBy: { rank: "asc" }, take: 20 }),
    prisma.safetyRecord.findMany({ where: { projectId, occurredAt: { gte: start, lt: end } } }),
    prisma.safetyRecord.findMany({ where: { projectId, status: "Open" }, take: 50 }),
    prisma.qualityNcr.findMany({ where: { projectId, status: "Open" }, take: 50 }),
    prisma.qualityNcr.findMany({
      where: {
        projectId,
        OR: [
          { issueDate: { gte: start, lt: end } },
          { actualClosure: { gte: start, lt: end } },
          { createdAt: { gte: start, lt: end } },
        ],
      },
      take: 30,
    }),
    prisma.cubeTest.findMany({
      where: {
        projectId,
        OR: [
          { castDate: { gte: start, lt: end } },
          { testDate7: { gte: start, lt: end } },
          { testDate28: { gte: start, lt: end } },
        ],
      },
      orderBy: { castDate: "desc" },
      take: 40,
    }),
    prisma.progressHindrance.findMany({ where: { projectId, status: "Open" }, take: 15, orderBy: { occurredAt: "desc" } }),
    prisma.rfi.findMany({ where: { projectId, status: "Open" }, take: 15, orderBy: { createdAt: "desc" } }),
    prisma.costCashflowPeriod.findMany({
      where: {
        projectId,
        OR: [
          { packageName: "COP" },
          { packageName: "Project cashflow" },
          { packageName: { contains: "Chart" } },
          { packageName: { startsWith: "PVA" } },
        ],
      },
      take: 80,
    }),
    previousDprCumulative(projectId, logDate, discipline),
    prisma.checklistSubmission.findMany({
      where: {
        assignment: { projectId },
        status: { in: ["Submitted", "Approved"] },
        createdAt: { gte: start, lt: end },
      },
      include: { assignment: { include: { template: { select: { checklistType: true } } } } },
      take: 30,
    }),
    prisma.qualitySiteRecord.findMany({
      where: { projectId, occurredAt: { gte: start, lt: end } },
      orderBy: { occurredAt: "desc" },
      take: 40,
    }),
    prisma.qapActivity.findMany({
      where: { projectId, testAgency: { not: null } },
      select: { testAgency: true },
      distinct: ["testAgency"],
      take: 10,
    }),
    prisma.dailyLog.findFirst({
      where: { projectId, logDate: { gte: start, lt: end } },
      include: { manpower: true, equipment: true },
    }),
  ]);

  if (monitoring.length) sources.push(`BOQ monitoring (${pkgs.slice(0, 2).join(", ")})`);
  if (activityLines.length) sources.push("Planned vs Actual activities");
  if (mbLines.length) sources.push(`MB (${pkg})`);
  if (bbsLines.length) sources.push(`BBS (${pkg})`);
  if (prev.priorCount) sources.push(`${prev.priorCount} prior DPR(s)`);
  if (manpowerRegs.length) sources.push("Progress manpower register");
  if (diaryToday?.manpower?.length) sources.push("Day log manpower");
  if (safetyToday.length || safetyOpen.length) sources.push("Safety records / NCR");
  if (ncrsOpen.length || cubesToday.length) sources.push("Quality NCR / cube tests");
  if (checklistFillsToday.length) sources.push("QI / Safety checklist fills");
  if (siteRecordsToday.length) sources.push("SOR log (site obs / instruction)");
  if (hindrances.length) sources.push("Hindrance register");
  if (rfisOpen.length) sources.push("Open RFIs");

  function dailyQtyFromProgress(weeklyActual: number | null | undefined, remaining: number) {
    const wa = Number(weeklyActual || 0);
    if (wa <= 0) return 0;
    const suggested = Math.round((wa / 6) * 1000) / 1000;
    if (remaining <= 0) return suggested;
    return Math.min(suggested, remaining);
  }

  const scoredMonitoring = monitoring
    .map((r) => {
      const act = activityLines.find((a) => fuzzyMatch(a.activity, r.description));
      const score =
        (act && Number(act.weeklyActual || 0) > 0 ? 4 : 0) +
        (act && Number(act.weeklyPlanned || 0) > 0 ? 2 : 0) +
        (Number(r.achievedQty || 0) > 0 ? 1 : 0);
      return { r, act, score };
    })
    .sort((a, b) => b.score - a.score);
  const pickedMonitoring = (scoredMonitoring.some((x) => x.score > 0) ? scoredMonitoring.filter((x) => x.score > 0) : scoredMonitoring).slice(
    0,
    40
  );

  const lines: DprLine[] =
    pickedMonitoring.length > 0
      ? pickedMonitoring.map(({ r, act }) => {
          const mbQty = mbLines
            .filter((m) => fuzzyMatch(m.description, r.description))
            .reduce((s, m) => s + (m.qty || 0), 0);
          const dprCum = prev.lineCum.get(norm(r.description)) || 0;
          const cumQtyPrev = Math.max(r.achievedQty || 0, mbQty, dprCum);
          const scopeQty = r.boqQty || r.gfcQty || act?.boqQty || 0;
          const remaining = Math.max(0, scopeQty - cumQtyPrev);
          const plannedHint = act?.weeklyPlanned ?? act?.boqQty;
          const weeklyPlanned = Number(act?.weeklyPlanned || 0);
          const plannedQtyToday =
            weeklyPlanned > 0 ? Math.round((weeklyPlanned / 6) * 1000) / 1000 : 0;
          const qtyToday = dailyQtyFromProgress(act?.weeklyActual, remaining);
          return {
            srNo: undefined,
            group: r.section || act?.tower || undefined,
            description: r.description,
            unit: r.uom || act?.unit || undefined,
            scopeQty,
            rate: r.rate || 0,
            start: act?.plannedStart ? act.plannedStart.toISOString().slice(0, 10) : null,
            finish: act?.plannedEnd ? act.plannedEnd.toISOString().slice(0, 10) : null,
            cumQtyPrev,
            qtyToday,
            plannedQtyToday,
            remarks: plannedHint
              ? `Planned: ${plannedHint}${act?.weeklyActual != null ? ` · P-A actual: ${act.weeklyActual}` : ""}${qtyToday ? " · qty today from weekly actual / 6" : ""}`
              : qtyToday
                ? "Qty today from Progress weekly actual / 6"
                : "",
          };
        })
      : activityLines
          .filter((a) => Number(a.weeklyActual || 0) > 0 || Number(a.weeklyPlanned || 0) > 0)
          .slice(0, 25)
          .map((a) => {
            const cumQtyPrev = a.cumulativeQty || a.executedQty || prev.lineCum.get(norm(a.activity)) || 0;
            const scopeQty = a.boqQty || a.gfcQty || 0;
            const remaining = Math.max(0, scopeQty - cumQtyPrev);
            const qtyToday = dailyQtyFromProgress(a.weeklyActual, remaining);
            return {
              group: a.tower || undefined,
              description: a.activity,
              unit: a.unit || undefined,
              scopeQty,
              cumQtyPrev,
              qtyToday,
              remarks: `Planned ${a.weeklyPlanned} · Actual ${a.weeklyActual}${qtyToday ? " · qty today from weekly actual / 6" : ""}`,
            };
          });

  if (lines.some((l) => Number(l.qtyToday || 0) > 0)) {
    sources.push("Progress weekly actual → qty today");
  }

  try {
    const { loadMsProjectSummary } = await import("./msProjectSchedule.js");
    const ms = await loadMsProjectSummary(projectId);
    for (const ln of lines) {
      if (ln.start && ln.finish) continue;
      const task = ms.tasks.find((t) => fuzzyMatch(t.name, ln.description));
      if (task?.baselineStart && task?.baselineFinish) {
        ln.start = task.baselineStart.toISOString().slice(0, 10);
        ln.finish = task.baselineFinish.toISOString().slice(0, 10);
      }
    }
  } catch {
    /* MS Project schedule optional */
  }

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
    : (diaryToday?.manpower || []).map((m) => ({
        trade: m.companyName || "Labour",
        planned: m.workerCount || 0,
        actual: m.workerCount || 0,
        hoursWorked: m.hoursWorked || 8,
      }));

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

  const qiChecklists = checklistFillsToday.filter(
    (s) => s.assignment.template.checklistType === "QualityInspection"
  ).length;
  const safetyChecklists = checklistFillsToday.filter(
    (s) => s.assignment.template.checklistType === "Safety"
  ).length;

  const cubeSummary = (specimens: typeof cubesToday, phase: "7" | "28") => {
    const hits = specimens.filter((c) => (phase === "7" ? c.load7 || c.strength7 : c.load28 || c.strength28));
    if (!hits.length) return "—";
    const byGroup = new Map<string, typeof hits>();
    for (const c of hits) {
      const key = `${c.srNo || ""}|${c.description}`;
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key)!.push(c);
    }
    return Array.from(byGroup.entries())
      .map(([key, rows]) => {
        const desc = rows[0]?.description || key;
        const strengths = rows
          .map((r) => (phase === "7" ? r.strength7 : r.strength28) ?? r.strength)
          .filter((x): x is number => x != null);
        const avg = rows.find((r) => r.avgStrength)?.avgStrength;
        const result = rows.find((r) => r.result && /pass|fail/i.test(r.result))?.result;
        const str =
          strengths.length > 1
            ? `${strengths.map((s) => s.toFixed(2)).join(", ")} MPa`
            : strengths[0] != null
              ? `${strengths[0].toFixed(2)} MPa`
              : "—";
        return `${desc}: ${str}${avg != null ? ` (avg ${avg.toFixed(2)})` : ""}${result ? ` · ${result}` : ""}`;
      })
      .join("; ");
  };

  const sorObsToday = siteRecordsToday.filter((r) => r.recordType !== "Site Instruction");
  const sorInstrToday = siteRecordsToday.filter((r) => r.recordType === "Site Instruction");
  const sorNcrToday = ncrsToday.filter((n) => !/^CAR/i.test(n.number || ""));
  const sorCarToday = ncrsToday.filter((n) => /^CAR/i.test(n.number || ""));
  const sorLinesToday = [
    ...siteRecordsToday.map((r) => `${r.recordType}: ${r.title}`),
    ...ncrsToday.map((n) => `${/^CAR/i.test(n.number || "") ? "CAR" : "NCR"} ${n.number}: ${n.description.slice(0, 80)}`),
  ];

  const cubeAgencies = [
    ...new Set(
      cubesToday.map((c) => c.testAgency).filter(Boolean) as string[]
    ),
  ];
  const qapAgencyList = qapAgencies.map((a) => a.testAgency).filter(Boolean) as string[];
  const testingAgencyLog = [...new Set([...cubeAgencies, ...qapAgencyList])].join(", ") || "—";

  const cubeCastGroups = cubesToday.length ? new Set(cubesToday.map((c) => `${c.srNo}|${c.description}`)).size : 0;
  const cubePass = cubesToday.filter((c) => /pass/i.test(c.result || "")).length;
  const cubeFail = cubesToday.filter((c) => /fail/i.test(c.result || "")).length;

  const qualityTests: DprQualityTest[] = [
    {
      parameter: "SOR — site observations today",
      figure: sorObsToday.length
        ? `${sorObsToday.length} raised · ${sorObsToday.filter((r) => r.status === "Closed").length} closed`
        : "—",
    },
    {
      parameter: "SOR — site instructions today",
      figure: sorInstrToday.length
        ? `${sorInstrToday.length} issued · ${sorInstrToday.filter((r) => r.status === "Closed").length} closed`
        : "—",
    },
    {
      parameter: "Pour cards offered / approved",
      figure: cubeCastGroups ? String(cubeCastGroups) : "—",
    },
    {
      parameter: "Concrete cube sets cast / slump tests",
      figure: cubesToday.length
        ? `${cubeCastGroups} set(s) · ${cubesToday.length} specimen(s) · ${cubePass} pass · ${cubeFail} fail`
        : "—",
    },
    {
      parameter: "Testing agency (cube / QAP)",
      figure: testingAgencyLog,
    },
    {
      parameter: "QI / Safety checklists filled today",
      figure: `${qiChecklists} QI · ${safetyChecklists} Safety`,
    },
    { parameter: "7-day cube result", figure: cubeSummary(cubesToday, "7") },
    { parameter: "28-day cube result", figure: cubeSummary(cubesToday, "28") },
    {
      parameter: "NCR / CAR today (SOR register)",
      figure: `${sorNcrToday.length} NCR · ${sorCarToday.length} CAR · ${ncrsOpen.length} open total`,
    },
    {
      parameter: "SOR dated lines (report day)",
      figure: sorLinesToday.length ? sorLinesToday.slice(0, 4).join("; ") : "—",
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

  const copMonth = cashflow.filter((c) => c.packageName === "COP");
  const chartCf = cashflow.filter((c) => c.packageName !== "COP");
  const acCertifiedToDate =
    (copMonth.length ? copMonth : chartCf).reduce((s, c) => s + (c.actualAmount || 0), 0) ||
    monitoring.reduce((s, m) => s + (m.certifiedQty || 0) * (m.rate || 0), 0);

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
