import { SPDC_DEPARTMENTS } from "@sharnam/shared";
import { prisma } from "../prisma.js";

/** Ensure HrmDepartment master rows exist for SPDC (CRM does not manage internal staff). */
export async function ensureSpdcDepartmentMasters(): Promise<void> {
  try {
    const count = await prisma.hrmDepartment.count({ where: { isActive: true } });
    if (count > 0) return;
  } catch {
    return;
  }
  for (const name of SPDC_DEPARTMENTS) {
    const code = name
      .slice(0, 24)
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    await prisma.hrmDepartment.upsert({
      where: { code: code || "DEPT" },
      create: { code: code || "DEPT", name },
      update: { name, isActive: true },
    });
  }
}
