import { prisma } from "../prisma.js";

/** Standard SPDC leave types — HR assigns balances per employee in Users / leave-balances. */
export const SPDC_LEAVE_TYPES = [
  { code: "CL", name: "Casual Leave (CL)", daysPerYear: 12, colour: "#0F766E" },
  { code: "PL", name: "Privilege Leave (PL)", daysPerYear: 15, colour: "#7B4DFF" },
  { code: "SL", name: "Sick Leave (SL)", daysPerYear: 6, colour: "#C45C26" },
  { code: "EL", name: "Emergency Leave", daysPerYear: 3, colour: "#B91C1C" },
  { code: "SHL", name: "Short Leave", daysPerYear: 24, colour: "#64748B" },
] as const;

export async function ensureSpdcLeaveTypes(): Promise<void> {
  try {
    const count = await prisma.leaveType.count();
    if (count >= SPDC_LEAVE_TYPES.length) return;
  } catch {
    return;
  }
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
