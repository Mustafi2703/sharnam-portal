import fs from "fs";
import path from "path";
import xlsx from "xlsx";
import { prisma } from "../prisma.js";

const XLSX = xlsx;

export type VerifyCheck = {
  key: string;
  label: string;
  ok: boolean;
  expected: string | number;
  actual: string | number;
  detail?: string;
};

function excelRoot() {
  return path.resolve(process.env.SHARNAM_EXCEL_ROOT || process.cwd());
}

function cellStr(v: unknown) {
  return String(v ?? "").trim();
}

function cellNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function sheetRows(file: string, sheetName?: string | RegExp) {
  if (!fs.existsSync(file)) return null;
  const wb = XLSX.readFile(file);
  let name =
    typeof sheetName === "string"
      ? sheetName
      : sheetName
        ? wb.SheetNames.find((n) => sheetName.test(n))
        : wb.SheetNames[0];
  if (!name || !wb.Sheets[name]) return null;
  return XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[name], {
    header: 1,
    defval: "",
  }) as unknown as unknown[][];
}

/** Expected Progress sheet counts + key field samples from client Excel packs */
export function readProgressExcelExpectations() {
  const root = excelRoot();
  const overview = path.join(root, "Progress Overview.xlsx");
  const mileFile = path.join(root, "Milestone tracking.xlsx");
  const plannedFile = path.join(root, "Planned Vs. Actual Dashboard (1).xlsx");
  const hindFile = path.join(root, "HInderance Register Dashboard (1).xlsx");
  const monthlyFile = path.join(
    root,
    fs.existsSync(path.join(root, "Monthly Progress Dashboard (1).xlsx"))
      ? "Monthly Progress Dashboard (1).xlsx"
      : "Monthly Progress Dashboard.xlsx"
  );

  const mileRows =
    sheetRows(mileFile, /data input/i) || sheetRows(overview, /^Milestone$/i) || [];
  const milestones = mileRows
    .slice(1)
    .filter((r) => /^M\d+/i.test(cellStr((r as unknown[])[0])))
    .map((r) => {
      const row = r as unknown[];
      return {
        code: cellStr(row[0]),
        activity: cellStr(row[2]),
        plannedDays: cellNum(row[5]),
        status: cellStr(row[13]),
        pctComplete: (() => {
          const p = cellNum(row[10]);
          return p > 1 ? p / 100 : p;
        })(),
      };
    });

  const hindRows = sheetRows(hindFile, /hinder/i) || sheetRows(overview, /hinder/i) || [];
  const hindrances = hindRows.slice(2).filter((r) => cellStr((r as unknown[])[1])).length;

  const riskRows = sheetRows(overview, /risk/i) || [];
  const risks = riskRows.slice(2).filter((r) => /^R\d+/i.test(cellStr((r as unknown[])[0]))).length;

  const legalRows = sheetRows(overview, /legal/i) || [];
  const legal = legalRows
    .slice(3)
    .filter((r) => cellStr((r as unknown[])[0]) && cellStr((r as unknown[])[3])).length;
  const legalSample = legalRows.slice(3).find((r) => cellStr((r as unknown[])[0]) === "LA-01") as
    | unknown[]
    | undefined;

  const cashRows = sheetRows(plannedFile, /cashflow/i) || [];
  const cashflow = cashRows
    .slice(1)
    .filter((r) => cellStr((r as unknown[])[0]) && cellNum((r as unknown[])[3]) > 0)
    .map((r) => {
      const row = r as unknown[];
      return { month: cellStr(row[0]), planned: cellNum(row[3]), actual: cellNum(row[4]) };
    });

  const manRows = sheetRows(plannedFile, /weekly manpower/i) || [];
  const manpower: { trade: string; required: number; available: number }[] = [];
  for (let i = 2; i < manRows.length; i++) {
    const row = manRows[i] as unknown[];
    const trade = cellStr(row[0]);
    if (!trade || /total/i.test(trade) || /date/i.test(trade)) break;
    if (!cellNum(row[1]) && !cellNum(row[2])) continue;
    manpower.push({ trade, required: cellNum(row[1]), available: cellNum(row[2]) });
  }

  const actRows = sheetRows(plannedFile, /planned vs actual/i) || [];
  const activities = actRows.filter((r) => {
    const row = r as unknown[];
    return cellNum(row[0]) > 0 && cellStr(row[2]);
  }).length;

  const sorRows = sheetRows(monthlyFile, /sor/i) || [];
  let sor = 0;
  for (let i = 1; i < sorRows.length; i++) {
    const row = sorRows[i] as unknown[];
    if (!cellNum(row[0]) || !cellStr(row[1])) {
      if (sor > 0) break; // end of primary SOR summary block
      continue;
    }
    sor++;
  }

  return {
    files: { overview, mileFile, plannedFile, hindFile, monthlyFile },
    milestones,
    counts: {
      milestones: milestones.length,
      hindrances,
      risks: Math.min(risks, 40),
      legal,
      plannedActual: cashflow.length,
      manpower: manpower.length,
      activityLines: activities,
      sor,
    },
    samples: {
      m01: milestones.find((m) => m.code === "M01"),
      cashAugust: cashflow.find((c) => /august/i.test(c.month)),
      legalLA01: legalSample
        ? { id: cellStr(legalSample[0]), status: cellStr(legalSample[8]), description: cellStr(legalSample[3]) }
        : null,
      manpowerFirst: manpower[0] || null,
    },
  };
}

function near(a: number, b: number, eps = 0.02) {
  return Math.abs(a - b) <= eps;
}

/** Compare DB progress registers to Excel source packs */
export async function verifyProgressProject(projectId: string) {
  const expected = readProgressExcelExpectations();
  const [
    milestones,
    hindrances,
    risks,
    plannedActual,
    legal,
    manpower,
    activityLines,
    sor,
  ] = await Promise.all([
    prisma.progressMilestone.findMany({ where: { projectId }, orderBy: { code: "asc" } }),
    prisma.progressHindrance.findMany({ where: { projectId } }),
    prisma.progressRisk.findMany({ where: { projectId } }),
    prisma.progressPlannedActual.findMany({ where: { projectId } }),
    prisma.progressLegalApproval.findMany({ where: { projectId } }),
    prisma.progressManpower.findMany({ where: { projectId } }),
    prisma.progressActivityLine.findMany({ where: { projectId } }),
    prisma.progressSorStat.findMany({ where: { projectId } }),
  ]);

  const checks: VerifyCheck[] = [];

  const countPairs: [string, string, number, number][] = [
    ["milestones", "Milestones", expected.counts.milestones, milestones.length],
    ["hindrances", "Hindrance register", expected.counts.hindrances, hindrances.length],
    ["risks", "Risk register", expected.counts.risks, risks.length],
    ["legal", "Legal approvals", expected.counts.legal, legal.length],
    ["plannedActual", "Cashflow P/A months", expected.counts.plannedActual, plannedActual.length],
    ["manpower", "Weekly manpower trades", expected.counts.manpower, manpower.length],
    ["activityLines", "Planned vs Actual qty lines", expected.counts.activityLines, activityLines.length],
    ["sor", "Monthly SOR rows", expected.counts.sor, sor.length],
  ];

  for (const [key, label, exp, act] of countPairs) {
    checks.push({
      key: `count.${key}`,
      label: `${label} count`,
      ok: exp === act,
      expected: exp,
      actual: act,
      detail: exp === act ? "match" : `DB has ${act}, Excel expects ${exp}`,
    });
  }

  const m01 = milestones.find((m) => m.code === "M01");
  const expM01 = expected.samples.m01;
  if (expM01) {
    checks.push({
      key: "sample.m01.activity",
      label: "M01 activity name",
      ok: !!m01 && m01.activity === expM01.activity,
      expected: expM01.activity,
      actual: m01?.activity || "(missing)",
    });
    checks.push({
      key: "sample.m01.plannedDays",
      label: "M01 planned days",
      ok: !!m01 && m01.plannedDays === expM01.plannedDays,
      expected: expM01.plannedDays,
      actual: m01?.plannedDays ?? "(missing)",
    });
    checks.push({
      key: "sample.m01.status",
      label: "M01 status",
      ok: !!m01 && m01.status === expM01.status,
      expected: expM01.status,
      actual: m01?.status || "(missing)",
    });
  }

  const aug = plannedActual.find((p) => /august/i.test(p.periodLabel));
  const expAug = expected.samples.cashAugust;
  if (expAug) {
    checks.push({
      key: "sample.cash.august.planned",
      label: "August planned cashflow ₹",
      ok: !!aug && near(aug.plannedAmount, expAug.planned, 1),
      expected: expAug.planned,
      actual: aug?.plannedAmount ?? "(missing)",
    });
    checks.push({
      key: "sample.cash.august.actual",
      label: "August actual cashflow ₹",
      ok: !!aug && near(aug.actualAmount, expAug.actual, 1),
      expected: expAug.actual,
      actual: aug?.actualAmount ?? "(missing)",
    });
  }

  const la01 = legal.find((l) => l.approvalId === "LA-01");
  const expLa = expected.samples.legalLA01;
  if (expLa) {
    checks.push({
      key: "sample.legal.la01.status",
      label: "LA-01 status",
      ok: !!la01 && la01.status === expLa.status,
      expected: expLa.status,
      actual: la01?.status || "(missing)",
    });
  }

  const man0 = expected.samples.manpowerFirst;
  if (man0) {
    const dbMan = manpower.find((m) => m.trade === man0.trade);
    checks.push({
      key: "sample.manpower.first",
      label: `${man0.trade} required/available`,
      ok: !!dbMan && dbMan.required === man0.required && dbMan.available === man0.available,
      expected: `${man0.required}/${man0.available}`,
      actual: dbMan ? `${dbMan.required}/${dbMan.available}` : "(missing)",
    });
  }

  const openH = hindrances.filter((h) => h.status === "Open").length;
  const delayed = milestones.filter((m) => /delay/i.test(m.status) || (m.varianceDays || 0) > 0).length;

  const failed = checks.filter((c) => !c.ok);
  return {
    ok: failed.length === 0,
    summary: {
      passed: checks.filter((c) => c.ok).length,
      failed: failed.length,
      total: checks.length,
    },
    totals: {
      milestones: milestones.length,
      delayed,
      openHindrance: openH,
      risks: risks.length,
      legal: legal.length,
      activityLines: activityLines.length,
    },
    checks,
    failed,
    excelRoot: excelRoot(),
  };
}
