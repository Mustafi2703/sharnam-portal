/**
 * Budget certified, forecast, rate difference and gross total
 * are calculated from Monitoring, Finance and the rate-difference rows.
 * Typed amounts stay only when overrideReason is set.
 *
 * Gross formula: see BUDGET_GROSS_FORMULA in @sharnam/shared.
 */
import { budgetGrossTotal } from "@sharnam/shared";
import { prisma } from "../prisma.js";

const CERTIFIED_STATUS = ["Certified", "Approved", "Paid"];

type SourceKind = "monitoringPackage" | "vendor" | "rateDiff";

const PACKAGE_HINTS: { test: RegExp; packages: string[] }[] = [
  { test: /external electric|external electrification/i, packages: ["External Electric"] },
  { test: /fire alarm|fire fight/i, packages: ["Fire Fighting"] },
  { test: /plumb/i, packages: ["Plumbing"] },
  { test: /\bgas\b/i, packages: ["Gas Line"] },
  { test: /window/i, packages: ["Windows"] },
  { test: /furniture/i, packages: ["Furniture"] },
  { test: /wpc/i, packages: ["WPC Door"] },
  { test: /bhavna|bhavana|dormitory|construction cost/i, packages: ["Civil Dormitory", "External Development", "UGWT", "Septic Tank"] },
  { test: /pearl|electric/i, packages: ["Electric"] },
];

function normName(value: string | null | undefined): string {
  return String(value || "")
    .toLowerCase()
    .replace(/\bm\/s\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function namesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normName(a);
  const right = normName(b);
  if (!left || !right) return false;
  return left.includes(right) || right.includes(left);
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

export async function ensureBudgetSources(projectId: string) {
  const lines = await prisma.costBudgetLine.findMany({
    where: { projectId },
    include: { sources: true },
  });
  for (const line of lines) {
    if (line.sources.length) continue;
    const blob = `${line.description} ${line.stakeholder || ""}`;
    const hint = PACKAGE_HINTS.find((row) => row.test.test(blob));
    const data: { budgetLineId: string; kind: SourceKind; ref: string }[] = [];
    for (const pkg of hint?.packages || []) {
      data.push({ budgetLineId: line.id, kind: "monitoringPackage", ref: pkg });
    }
    if (line.stakeholder) data.push({ budgetLineId: line.id, kind: "vendor", ref: line.stakeholder });
    if (data.length) await prisma.costBudgetSource.createMany({ data });
  }
}

export async function recalculateBudget(projectId: string) {
  await ensureBudgetSources(projectId);
  const [lines, monitoring, rates, cops, ras] = await Promise.all([
    prisma.costBudgetLine.findMany({ where: { projectId }, include: { sources: true } }),
    prisma.costMonitoringLine.findMany({ where: { projectId } }),
    prisma.costRateDifference.findMany({ where: { projectId } }),
    prisma.certificateOfPayment.findMany({
      where: { projectId, status: { in: CERTIFIED_STATUS } },
    }),
    prisma.raBill.findMany({
      where: { projectId, status: { in: ["Certified", "Paid"] } },
    }),
  ]);

  const copRaIds = new Set(cops.map((cop) => cop.raBillId).filter((id): id is string => Boolean(id)));
  let updated = 0;
  for (const line of lines) {
    if (line.overrideReason) continue;
    const packages = new Set(line.sources.filter((s) => s.kind === "monitoringPackage").map((s) => s.ref));
    const vendors = line.sources.filter((s) => s.kind === "vendor").map((s) => s.ref);
    const vendorHit = (name: string | null | undefined) =>
      vendors.some((vendor) => namesMatch(vendor, name)) || namesMatch(line.stakeholder, name) || namesMatch(line.description, name);

    const mon = monitoring.filter((row) => packages.has(row.packageName));
    let financeCertified = 0;
    for (const cop of cops) {
      if (vendorHit(cop.contractor)) financeCertified += cop.amountCertified || 0;
    }
    for (const ra of ras) {
      if (copRaIds.has(ra.id)) continue;
      if (vendorHit(ra.vendorName)) financeCertified += ra.totalInvoiceWithoutGst || ra.netAmountPayable || 0;
    }
    const monitoringCertified = mon.reduce((sum, row) => sum + (row.certifiedInvoiceCost || 0), 0);
    const certifiedAmount = financeCertified > 0 ? financeCertified : monitoringCertified;

    let forecastedAmount = 0;
    let forecastReduction = 0;
    for (const row of mon) {
      const diff = (row.gfcCost || 0) - (row.boqCost || 0);
      if (diff > 0) forecastedAmount += diff;
      else forecastReduction += -diff;
    }

    let steelExcess = 0;
    let steelSaving = 0;
    let cementExcess = 0;
    let cementSaving = 0;
    let tilesExcess = 0;
    let tilesSaving = 0;
    for (const rate of rates) {
      if (!vendorHit(rate.vendorName)) continue;
      const material = rate.materialType.toLowerCase();
      if (material === "steel") {
        steelExcess += rate.excessAmount || 0;
        steelSaving += rate.savingAmount || 0;
      } else if (material === "cement") {
        cementExcess += rate.excessAmount || 0;
        cementSaving += rate.savingAmount || 0;
      } else if (material === "tiles") {
        tilesExcess += rate.excessAmount || 0;
        tilesSaving += rate.savingAmount || 0;
      }
    }

    const grossTotal = budgetGrossTotal({
      workOrderAmount: line.workOrderAmount,
      forecastedAmount,
      forecastReduction,
      nonTendered: line.nonTendered,
      steelExcess,
      steelSaving,
      cementExcess,
      cementSaving,
      tilesExcess,
      tilesSaving,
    });

    await prisma.costBudgetLine.update({
      where: { id: line.id },
      data: {
        certifiedAmount,
        forecastedAmount,
        forecastReduction,
        steelExcess,
        steelSaving,
        cementExcess,
        cementSaving,
        tilesExcess,
        tilesSaving,
        grossTotal,
      },
    });
    updated += 1;
  }

  const byMonth = new Map<string, number>();
  for (const cop of cops) {
    if (!cop.certificateDate) continue;
    const label = monthLabel(cop.certificateDate);
    byMonth.set(label, (byMonth.get(label) || 0) + (cop.amountCertified || 0));
  }
  for (const ra of ras) {
    if (copRaIds.has(ra.id) || !ra.invoiceDate) continue;
    const label = monthLabel(ra.invoiceDate);
    byMonth.set(label, (byMonth.get(label) || 0) + (ra.totalInvoiceWithoutGst || ra.netAmountPayable || 0));
  }
  if (byMonth.size) {
    const periods = await prisma.costCashflowPeriod.findMany({
      where: { projectId, packageName: { contains: "Chart" } },
    });
    for (const period of periods) {
      const key = [...byMonth.keys()].find((label) => label.toLowerCase() === period.periodLabel.toLowerCase());
      if (!key) continue;
      const actualAmount = byMonth.get(key) || 0;
      await prisma.costCashflowPeriod.update({
        where: { id: period.id },
        data: {
          actualAmount,
          progressPct: period.plannedAmount ? actualAmount / period.plannedAmount : 0,
        },
      });
    }
  }

  return { updated, lines: lines.length };
}
