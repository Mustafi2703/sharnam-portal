/**
 * Finance COP → Cost cashflow actual (Chart view).
 * Certified / Approved / Paid COP amounts roll into the matching calendar period
 * so DPR header AC certified and WPR cashflow stay aligned.
 */
import { prisma } from "../../prisma.js";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function fmtDay(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtWeek(d: Date) {
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  return `Wk ${fmtDay(d)} – ${fmtDay(end)}`;
}

function fmtMonth(d: Date) {
  return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

const COUNTED_STATUS = new Set(["Certified", "Approved", "Paid"]);

/**
 * Rebuild COP-driven cashflow actuals for a project.
 * Planned amounts from Excel import are preserved; COP rows tagged packageName COP / COP-week / COP-day.
 */
export async function syncCopToCashflow(projectId: string) {
  const cops = await prisma.certificateOfPayment.findMany({
    where: { projectId, status: { in: [...COUNTED_STATUS] } },
    orderBy: { certificateDate: "asc" },
  });

  await prisma.costCashflowPeriod.deleteMany({
    where: { projectId, packageName: { in: ["COP", "COP-week", "COP-day"] } },
  });

  if (!cops.length) return { periods: 0 };

  const dayMap = new Map<string, { date: Date; amount: number }>();
  const weekMap = new Map<string, { date: Date; amount: number }>();
  const monthMap = new Map<string, { date: Date; amount: number }>();

  for (const cop of cops) {
    const amt = Number(cop.amountPayable || cop.amountCertified || 0);
    if (!amt) continue;
    const when = cop.certificateDate || cop.createdAt;
    const d = startOfDay(when);
    const w = startOfWeek(when);
    const m = startOfMonth(when);
    const dk = d.toISOString().slice(0, 10);
    const wk = w.toISOString().slice(0, 10);
    const mk = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
    dayMap.set(dk, { date: d, amount: (dayMap.get(dk)?.amount || 0) + amt });
    weekMap.set(wk, { date: w, amount: (weekMap.get(wk)?.amount || 0) + amt });
    monthMap.set(mk, { date: m, amount: (monthMap.get(mk)?.amount || 0) + amt });
  }

  const rows: Array<{
    projectId: string;
    periodLabel: string;
    periodDate: Date;
    packageName: string;
    plannedAmount: number;
    actualAmount: number;
    progressPct: number;
  }> = [];

  for (const { date, amount } of dayMap.values()) {
    rows.push({
      projectId,
      periodLabel: fmtDay(date),
      periodDate: date,
      packageName: "COP-day",
      plannedAmount: 0,
      actualAmount: amount,
      progressPct: 1,
    });
  }
  for (const { date, amount } of weekMap.values()) {
    rows.push({
      projectId,
      periodLabel: fmtWeek(date),
      periodDate: date,
      packageName: "COP-week",
      plannedAmount: 0,
      actualAmount: amount,
      progressPct: 1,
    });
  }
  for (const { date, amount } of monthMap.values()) {
    rows.push({
      projectId,
      periodLabel: fmtMonth(date),
      periodDate: date,
      packageName: "COP",
      plannedAmount: 0,
      actualAmount: amount,
      progressPct: 1,
    });
  }

  if (rows.length) await prisma.costCashflowPeriod.createMany({ data: rows });

  /** Overlay COP monthly actual onto matching Chart planned periods (same month label). */
  const chartRows = await prisma.costCashflowPeriod.findMany({
    where: {
      projectId,
      AND: [
        { packageName: { notIn: ["COP", "COP-week", "COP-day"] } },
        {
          OR: [{ packageName: { contains: "Chart" } }, { packageName: "Project cashflow" }],
        },
      ],
    },
  });
  for (const [mk, { amount, date }] of monthMap) {
    const label = fmtMonth(date);
    const match = chartRows.find((c) => {
      const pl = (c.periodLabel || "").toLowerCase();
      return pl.includes(label.toLowerCase()) || (c.periodDate && `${c.periodDate.getFullYear()}-${String(c.periodDate.getMonth() + 1).padStart(2, "0")}` === mk);
    });
    if (match) {
      await prisma.costCashflowPeriod.update({
        where: { id: match.id },
        data: {
          actualAmount: amount,
          progressPct: match.plannedAmount > 0 ? amount / match.plannedAmount : 1,
        },
      });
    }
  }

  return { periods: rows.length };
}
