import { SPDC_DEPARTMENTS, SPDC_DESIGNATIONS, suggestedLoginRoleForCompanyRole } from "@sharnam/shared";
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

/** Which master department each built-in SPDC designation sits under. */
function seedDepartmentFor(title: string, hiringDept: string): string {
  const t = title.toLowerCase();
  if (t === "director") return "Director's Office";
  if (hiringDept === "HR") return "Human Resources";
  if (/accountant|billing/.test(t)) return "Billing & Accounts";
  if (/planning|estimation/.test(t)) return "Planning & Estimation";
  if (/safety/.test(t)) return "Safety";
  if (/mep/.test(t)) return "MEPF";
  return hiringDept === "Site" ? "Projects — Site" : "Projects — Office";
}

/** First run only: fill the roles master from the 23 SPDC designations. */
export async function ensureSpdcDesignationMasters(): Promise<void> {
  try {
    const count = await prisma.hrmDesignation.count();
    if (count > 0) return;
  } catch {
    return;
  }
  let order = 0;
  for (const row of SPDC_DESIGNATIONS) {
    order += 10;
    await prisma.hrmDesignation.upsert({
      where: { title: row.title },
      create: {
        title: row.title,
        department: seedDepartmentFor(row.title, row.department),
        scorecardRole: row.scorecardRole,
        loginRole: row.department === "HR" ? "hr" : row.department === "Office" ? "office" : suggestedLoginRoleForCompanyRole(row.title),
        sortOrder: order,
      },
      update: {},
    });
  }
}
