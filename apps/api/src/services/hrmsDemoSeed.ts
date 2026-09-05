/**
 * HRMS demo — leave types, balances, sample requests, handbook documents.
 */
import type { PrismaClient } from "@prisma/client";

const DEMO = "hrms-demo-seed";

export async function seedHrmsDemo(db: PrismaClient) {
  const year = new Date().getFullYear();

  const types = [
    { code: "CL", name: "Casual Leave", maxDays: 12 },
    { code: "SL", name: "Sick Leave", maxDays: 10 },
    { code: "EL", name: "Earned Leave", maxDays: 18 },
    { code: "CO", name: "Comp Off", maxDays: 5 },
  ];

  const typeIds: Record<string, string> = {};
  for (const t of types) {
    const row = await db.leaveType.upsert({
      where: { code: t.code },
      create: { code: t.code, name: t.name, daysPerYear: t.maxDays, isPaid: true },
      update: { name: t.name, daysPerYear: t.maxDays },
    });
    typeIds[t.code] = row.id;
  }

  const staff = await db.user.findMany({
    where: { role: { in: ["employee", "site_employee", "office"] } },
    take: 8,
    select: { id: true, fullName: true, email: true },
  });

  for (const u of staff) {
    for (const t of types) {
      await db.leaveBalance.upsert({
        where: { userId_leaveTypeId_year: { userId: u.id, leaveTypeId: typeIds[t.code], year } },
        create: {
          userId: u.id,
          leaveTypeId: typeIds[t.code],
          year,
          entitled: t.maxDays,
          balance: Math.max(2, t.maxDays - 3),
        },
        update: {},
      });
    }
  }

  const office = staff.find((s) => s.email.includes("office")) || staff[0];
  const site = staff.find((s) => s.email.includes("site")) || staff[1];
  if (office && site) {
    await db.leaveRequest.deleteMany({ where: { reason: { contains: DEMO } } });
    await db.leaveRequest.createMany({
      data: [
        {
          userId: site.id,
          leaveTypeId: typeIds.CL,
          fromDate: new Date(`${year}-08-20`),
          toDate: new Date(`${year}-08-21`),
          reason: `${DEMO} — site visit family function`,
          status: "Approved",
          approverId: office.id,
        },
        {
          userId: office.id,
          leaveTypeId: typeIds.EL,
          fromDate: new Date(`${year}-09-10`),
          toDate: new Date(`${year}-09-12`),
          reason: `${DEMO} — planned earned leave`,
          status: "Pending",
        },
        {
          userId: site.id,
          leaveTypeId: typeIds.SL,
          fromDate: new Date(`${year}-08-05`),
          toDate: new Date(`${year}-08-05`),
          reason: `${DEMO} — medical half day`,
          status: "Approved",
          halfDay: true,
          approverId: office.id,
        },
      ],
    });
  }

  await db.hrmsDocument.deleteMany({ where: { refNo: { startsWith: "HB-DEMO" } } });

  const holidays = [
    { date: `${year}-01-26`, name: "Republic Day", region: "India" },
    { date: `${year}-03-14`, name: "Holi", region: "India" },
    { date: `${year}-08-15`, name: "Independence Day", region: "India" },
    { date: `${year}-10-02`, name: "Gandhi Jayanti", region: "India" },
    { date: `${year}-10-20`, name: "Diwali (office closed)", region: "Gujarat" },
    { date: `${year}-11-01`, name: "Gujarat Day / New Year", region: "Gujarat" },
    { date: `${year}-12-25`, name: "Christmas", region: "India" },
    { date: `${year + 1}-01-01`, name: "New Year", region: "India" },
  ];
  for (const h of holidays) {
    const d = new Date(h.date);
    if (Number.isNaN(d.getTime())) continue;
    const existing = await db.holiday.findFirst({ where: { date: d, name: h.name } });
    if (!existing) {
      await db.holiday.create({
        data: { date: d, name: h.name, region: h.region, isOptional: false },
      });
    }
  }

  await db.hrmsDocument.createMany({
    data: [
      {
        kind: "Handbook",
        refNo: "HB-DEMO-001",
        employeeName: "All employees",
        issueDate: new Date(`${year}-07-01`),
        status: "Published",
        dataJson: JSON.stringify({
          title: "Sharnam Employee Handbook — SPDC UAT",
          sections: [
            { heading: "Leave policy", body: "CL 12 · SL 10 · EL 18 · apply via HRMS Leave before travel." },
            { heading: "Site safety", body: "PPE mandatory · report incidents via Safety NCR within 24h." },
            { heading: "RA / COP workflow", body: "Contractors upload RA Submission; PMC certifies before COP." },
          ],
          source: DEMO,
        }),
      },
      {
        kind: "Appointment",
        refNo: "HB-DEMO-002",
        employeeName: "Demo Employee",
        designation: "Site Engineer",
        department: "Site",
        issueDate: new Date(`${year}-07-15`),
        status: "Signed",
        dataJson: JSON.stringify({
          title: "Letter of Appointment — sample",
          ctc: "As per SPDC CTC calculator",
          source: DEMO,
        }),
      },
    ],
  });

  return { leaveTypes: types.length, staffBalances: staff.length, handbookDocs: 2, holidays: holidays.length };
}
