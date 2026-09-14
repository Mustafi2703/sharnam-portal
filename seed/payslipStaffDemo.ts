/**
 * HR desk demo: HR-only role, office admins, and June 2026 payslips for every
 * SPDC staff login (office, site, HR — including Anushka Jha).
 *
 * Does not reset passwords. Usage: npm run db:seed-payslips
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { applyDatabaseUrl } from "../scripts/resolve-database-url.mjs";
import { DEFAULT_ROLE_PERMISSIONS, portalForRole, type RoleKey } from "../packages/shared/src/index.ts";

const YEAR = 2026;
const MONTH = 6;
const WORKING_DAYS = 30;

const ROLE_UPDATES: { email: string; role: RoleKey; fullName: string }[] = [
  { email: "nirav@spdc.in", role: "admin", fullName: "Nirav Parekh" },
  { email: "saurabh@spdc.in", role: "admin", fullName: "Saurabh Prajapati" },
  { email: "operations@spdc.in", role: "office", fullName: "Saurabh Prajapati" },
  { email: "anushka.jha@spdc.in", role: "hr", fullName: "Anushka Jha (HR Head)" },
];

function ctcForRole(role: string) {
  if (role === "admin") return 2_400_000;
  if (role === "office") return 1_800_000;
  if (role === "hr") return 1_200_000;
  if (role === "site_employee") return 600_000;
  return 840_000;
}

function empCodeFor(email: string) {
  const local = email.split("@")[0].toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14);
  return `EMP-${local || "STAFF"}`;
}

function computePayslip(ctcAnnual: number, basicMonthly: number | null, hraMonthly: number | null) {
  const factor = 1;
  const basic = (basicMonthly || (ctcAnnual * 0.5) / 12) * factor;
  const hra = (hraMonthly || basic * 0.4) * factor;
  const conveyance = 1600 * factor;
  const medicalAllow = 1250 * factor;
  const specialAllow = Math.max(0, ctcAnnual / 12 - basic - hra - conveyance - medicalAllow);
  const gross = basic + hra + conveyance + medicalAllow + specialAllow;
  const pfEmployee = Math.min(basic, 15_000) * 0.12;
  const esicEmployee = gross <= 21_000 ? gross * 0.0075 : 0;
  const professionalTax = 200;
  const totalDeductions = pfEmployee + esicEmployee + professionalTax;
  return {
    basic,
    hra,
    conveyance,
    medicalAllow,
    specialAllow,
    otherEarnings: 0,
    grossEarnings: gross,
    pfEmployee,
    esicEmployee,
    professionalTax,
    incomeTax: 0,
    otherDeduction: 0,
    totalDeductions,
    netPay: gross - totalDeductions,
  };
}

export async function seedPayslipStaffDemo(prisma: PrismaClient) {
  await prisma.roleDefinition.upsert({
    where: { key: "hr" },
    create: {
      key: "hr",
      label: "HR",
      portal: portalForRole("hr"),
      permissions: JSON.stringify(DEFAULT_ROLE_PERMISSIONS.hr),
      isSystem: true,
    },
    update: {
      label: "HR",
      portal: portalForRole("hr"),
      permissions: JSON.stringify(DEFAULT_ROLE_PERMISSIONS.hr),
    },
  });

  for (const row of ROLE_UPDATES) {
    const existing = await prisma.user.findUnique({ where: { email: row.email } });
    if (!existing) continue;
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        fullName: row.fullName,
        role: row.role,
        portal: portalForRole(row.role),
        isActive: true,
      },
    });
  }

  const staff = await prisma.user.findMany({
    where: {
      isActive: true,
      NOT: { email: { startsWith: "deleted." } },
      OR: [
        { role: { in: ["admin", "office", "hr", "site_employee"] } },
        { role: "employee", vendorId: null },
      ],
    },
    orderBy: { fullName: "asc" },
  });

  const actor =
    staff.find((u) => u.email === "anushka.jha@spdc.in") ||
    staff.find((u) => u.role === "hr") ||
    staff.find((u) => u.role === "admin" || u.role === "office");
  if (!actor) throw new Error("Need at least one HR / office / admin user before seeding payslips.");

  const slips: { name: string; email: string; role: string; netPay: number }[] = [];
  const skipped: { email: string; reason: string }[] = [];

  for (const user of staff) {
    const ctcAnnual = ctcForRole(user.role);
    const basicMonthly = (ctcAnnual * 0.5) / 12;
    const hraMonthly = basicMonthly * 0.4;
    let profile = await prisma.employeeProfile.findUnique({ where: { userId: user.id } });
    if (!profile) {
      let empCode = empCodeFor(user.email);
      const taken = await prisma.employeeProfile.findUnique({ where: { empCode } });
      if (taken) empCode = `${empCode}${String(Date.now()).slice(-4)}`;
      profile = await prisma.employeeProfile.create({
        data: {
          userId: user.id,
          empCode,
          department: user.role === "site_employee" ? "Site" : user.role === "hr" ? "HR" : "Office",
          designation: user.fullName,
          ctcAnnual,
          basicMonthly,
          hraMonthly,
          joinDate: new Date("2024-04-01T00:00:00.000Z"),
        },
      });
    } else if (!profile.ctcAnnual && !profile.basicMonthly) {
      profile = await prisma.employeeProfile.update({
        where: { id: profile.id },
        data: { ctcAnnual, basicMonthly, hraMonthly },
      });
    }

    const ctc = profile.ctcAnnual || ctcAnnual;
    const numbers = computePayslip(ctc, profile.basicMonthly, profile.hraMonthly);
    const slip = await prisma.payslip.upsert({
      where: { userId_year_month: { userId: user.id, year: YEAR, month: MONTH } },
      create: {
        userId: user.id,
        year: YEAR,
        month: MONTH,
        workingDays: WORKING_DAYS,
        paidDays: WORKING_DAYS,
        lopDays: 0,
        ...numbers,
        status: "Generated",
        generatedById: actor.id,
      },
      update: {
        workingDays: WORKING_DAYS,
        paidDays: WORKING_DAYS,
        lopDays: 0,
        ...numbers,
        status: "Generated",
        generatedById: actor.id,
        generatedAt: new Date(),
      },
    });
    slips.push({ name: user.fullName, email: user.email, role: user.role, netPay: slip.netPay });
  }

  return {
    year: YEAR,
    month: MONTH,
    count: slips.length,
    slips,
    skipped,
    roles: ROLE_UPDATES,
  };
}

applyDatabaseUrl();
const runningDirect = process.argv[1]?.includes("payslipStaffDemo");
if (runningDirect) {
  const prisma = new PrismaClient();
  seedPayslipStaffDemo(prisma)
    .then((r) => {
      console.log(`Payslip demo ${r.month}/${r.year}: ${r.count} staff slips`);
      for (const row of r.roles) console.log(`  Role → ${row.email} = ${row.role}`);
      for (const s of r.slips) {
        console.log(`  ${s.name} <${s.email}> [${s.role}] net ₹${Math.round(s.netPay).toLocaleString("en-IN")}`);
      }
      console.log("HR login: anushka.jha@spdc.in at /login/hr (HR portal only).");
      console.log("Office: nirav@spdc.in and saurabh@spdc.in at /login/office (full desk).");
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
