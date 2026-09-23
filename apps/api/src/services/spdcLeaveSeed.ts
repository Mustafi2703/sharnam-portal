import { prisma } from "../prisma.js";

/** Standard SPDC leave types — HR can override per employee on HRMS → Leave. */
export const SPDC_LEAVE_TYPES = [
  { code: "CL", name: "Casual Leave (CL)", daysPerYear: 12, colour: "#0F766E" },
  { code: "PL", name: "Privilege Leave (PL)", daysPerYear: 12, colour: "#7B4DFF" },
  { code: "SL", name: "Sick Leave (SL)", daysPerYear: 6, colour: "#C45C26" },
  { code: "EL", name: "Emergency Leave", daysPerYear: 3, colour: "#B91C1C" },
  { code: "SHL", name: "Short Leave", daysPerYear: 24, colour: "#64748B" },
] as const;

export function defaultEntitledForLeaveCode(code: string): number {
  const hit = SPDC_LEAVE_TYPES.find((t) => t.code === code);
  return hit?.daysPerYear ?? 0;
}

export async function ensureSpdcLeaveTypes(): Promise<void> {
  for (const t of SPDC_LEAVE_TYPES) {
    await prisma.leaveType.upsert({
      where: { code: t.code },
      create: {
        code: t.code,
        name: t.name,
        daysPerYear: t.daysPerYear,
        isPaid: true,
        carryForward: t.code === "PL",
        requiresApproval: true,
        colour: t.colour,
      },
      update: { name: t.name, daysPerYear: t.daysPerYear, colour: t.colour },
    });
  }
}

/** Create year balances from SPDC defaults (PL = 12 days). Skips types that already have a row. */
export async function ensureDefaultLeaveBalancesForUser(
  userId: string,
  year = new Date().getFullYear(),
  overrides?: Partial<Record<string, number>>,
): Promise<void> {
  await ensureSpdcLeaveTypes();
  const types = await prisma.leaveType.findMany({ where: { code: { in: SPDC_LEAVE_TYPES.map((t) => t.code) } } });
  for (const t of types) {
    const entitled = overrides?.[t.code] ?? defaultEntitledForLeaveCode(t.code) ?? t.daysPerYear;
    const existing = await prisma.leaveBalance.findUnique({
      where: { userId_leaveTypeId_year: { userId, leaveTypeId: t.id, year } },
    });
    if (existing) continue;
    await prisma.leaveBalance.create({
      data: {
        userId,
        leaveTypeId: t.id,
        year,
        entitled,
        used: 0,
        balance: entitled,
      },
    });
  }
}

export async function applyLeaveBalanceDelta(
  userId: string,
  leaveTypeId: string,
  year: number,
  daysDelta: number,
): Promise<void> {
  const bal = await prisma.leaveBalance.findUnique({
    where: { userId_leaveTypeId_year: { userId, leaveTypeId, year } },
  });
  if (!bal) return;
  const used = Math.max(0, bal.used + daysDelta);
  await prisma.leaveBalance.update({
    where: { id: bal.id },
    data: { used, balance: bal.entitled - used },
  });
}
