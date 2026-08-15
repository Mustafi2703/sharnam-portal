/**
 * Seed Quality / Safety / Cube / QAP / payment registers from client Excel packs.
 * Refresh-on-seed so sheet edits stay maintained when re-running db:seed.
 */
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import type { PrismaClient } from "@prisma/client";

function n(v: unknown) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}
function s(v: unknown, max = 500) {
  const t = String(v ?? "").trim();
  return t ? t.slice(0, max) : "";
}
function excelDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === "number" && v > 20000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + Math.floor(v));
    return epoch;
  }
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}
function sheet(wb: XLSX.WorkBook, name: string | RegExp) {
  const key =
    typeof name === "string"
      ? wb.SheetNames.find((n) => n === name) || name
      : wb.SheetNames.find((n) => name.test(n));
  if (!key || !wb.Sheets[key]) return [] as unknown[][];
  return XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[key], {
    header: 1,
    defval: "",
  }) as unknown as unknown[][];
}

export async function seedQualitySafetyFromSheets(
  prisma: PrismaClient,
  projectId: string,
  excelRoot: string,
  reportedById: string
) {
  // Refresh sheet-backed quality/safety registers (keep live QI forms / user safety edits? — replace seeded sources)
  await prisma.cubeTest.deleteMany({ where: { projectId } });
  await prisma.qualityNcr.deleteMany({ where: { projectId } });
  await prisma.qapActivity.deleteMany({ where: { projectId } });
  await prisma.safetyRecord.deleteMany({ where: { projectId } });

  // --- Quality NCR REGISTER ---
  {
    const file = path.join(excelRoot, "NCR 01 .xlsx");
    if (fs.existsSync(file)) {
      const wb = XLSX.readFile(file);
      const rows = sheet(wb, /NCR REGISTER/i);
      let created = 0;
      for (let i = 4; i < rows.length; i++) {
        const row = rows[i] as unknown[];
        const description = s(row[4], 2000);
        const no = s(row[0], 20);
        if (!description || !/^\d+$/.test(no)) continue;
        await prisma.qualityNcr.create({
          data: {
            projectId,
            number: `NCR-${no}`,
            issueDate: excelDate(row[1]),
            ncrType: s(row[2], 80) || "General",
            contractor: s(row[3], 120) || null,
            description,
            location: s(row[5], 120) || null,
            plannedClosure: excelDate(row[6]),
            actualClosure: excelDate(row[7]),
            status: s(row[8], 40) || "Open",
            source: "NCR 01 .xlsx",
          },
        });
        created++;
      }
      console.log("Quality NCRs seeded:", created);
    }
  }

  // --- Monthly CAR register (extra rows if present) ---
  {
    const monthly = fs.existsSync(path.join(excelRoot, "Monthly Progress Dashboard (1).xlsx"))
      ? "Monthly Progress Dashboard (1).xlsx"
      : "Monthly Progress Dashboard.xlsx";
    const file = path.join(excelRoot, monthly);
    if (fs.existsSync(file)) {
      const wb = XLSX.readFile(file);
      const rows = sheet(wb, /CAR register/i);
      let created = 0;
      for (let i = 2; i < rows.length; i++) {
        const row = rows[i] as unknown[];
        const description = s(row[4], 2000);
        const no = s(row[0], 20);
        if (!description || !/^\d+$/.test(no)) continue;
        const number = `CAR-${no}`;
        const exists = await prisma.qualityNcr.findFirst({ where: { projectId, number } });
        if (exists) continue;
        await prisma.qualityNcr.create({
          data: {
            projectId,
            number,
            issueDate: excelDate(row[1]),
            ncrType: s(row[2], 80) || "Quality",
            contractor: s(row[3], 120) || null,
            description,
            location: s(row[5], 120) || null,
            plannedClosure: excelDate(row[6]),
            actualClosure: excelDate(row[7]),
            status: s(row[8], 40) || "Open",
            source: monthly,
          },
        });
        created++;
      }
      if (created) console.log("CAR register rows seeded:", created);
    }
  }

  // --- Cube register ---
  {
    const file = path.join(excelRoot, "SPDC CUBE REGISTER (1).xlsx");
    if (fs.existsSync(file)) {
      const wb = XLSX.readFile(file);
      const rows = sheet(wb, "Sheet1");
      let created = 0;
      let lastDesc = "";
      let lastGrade = "";
      let lastCast: Date | null = null;
      let lastSr = "";
      for (let i = 10; i < rows.length && created < 120; i++) {
        const row = rows[i] as unknown[];
        const sr = s(row[0], 20);
        const desc = s(row[2], 300);
        const grade = s(row[3], 40);
        if (sr && /^\d+$/.test(sr)) {
          lastSr = sr;
          lastCast = excelDate(row[1]);
          lastDesc = desc || lastDesc;
          lastGrade = grade || lastGrade;
        }
        const strength = n(row[9]) || n(row[10]);
        const result = s(row[11], 40);
        if (!lastDesc && !desc) continue;
        if (!strength && !result && !n(row[7]) && !n(row[4])) continue;
        await prisma.cubeTest.create({
          data: {
            projectId,
            srNo: lastSr || null,
            castDate: lastCast,
            description: desc || lastDesc || `Cube ${lastSr || created + 1}`,
            grade: grade || lastGrade || null,
            cubeWeight: n(row[4]) || null,
            testDate7: excelDate(row[5]),
            testDate28: excelDate(row[6]),
            load7: n(row[7]) || null,
            load28: n(row[8]) || null,
            strength: n(row[9]) || null,
            avgStrength: n(row[10]) || null,
            result: result || null,
            source: "SPDC CUBE REGISTER (1).xlsx",
          },
        });
        created++;
      }
      console.log("Cube tests seeded:", created);
    }
  }

  // --- QAP from Week 50 + Monthly QAP Detail ---
  {
    const qapFile = path.join(excelRoot, "Quality Assurance Plan Week 50.xlsx");
    let created = 0;
    if (fs.existsSync(qapFile)) {
      const wb = XLSX.readFile(qapFile);
      const rows = sheet(wb, "Sheet1");
      let activity = "";
      for (let i = 10; i < Math.min(rows.length, 120); i++) {
        const row = rows[i] as unknown[];
        const sr = s(row[0], 20);
        const act = s(row[1], 120);
        const detail = s(row[2], 300);
        if (act) activity = act;
        if (!detail) continue;
        if (sr && !/^\d+$/.test(sr) && !act) continue;
        const contractorOk = /yes|perform|qc|surveyor/i.test(s(row[6], 40));
        const pmcOk = /yes|review|witness/i.test(s(row[8], 40));
        const clientOk = /yes|witness|random/i.test(s(row[9], 40));
        await prisma.qapActivity.create({
          data: {
            projectId,
            weekLabel: "W50",
            activity: `${activity}${detail ? ` — ${detail}` : ""}`.slice(0, 400),
            discipline: activity || null,
            contractorOk,
            pmcOk,
            clientOk,
            status: clientOk && pmcOk ? "Done" : "Open",
            completedAt: clientOk && pmcOk ? new Date() : null,
          },
        });
        created++;
      }
    }
    const monthly = path.join(
      excelRoot,
      fs.existsSync(path.join(excelRoot, "Monthly Progress Dashboard (1).xlsx"))
        ? "Monthly Progress Dashboard (1).xlsx"
        : "Monthly Progress Dashboard.xlsx"
    );
    if (fs.existsSync(monthly) && created < 20) {
      const wb = XLSX.readFile(monthly);
      const rows = sheet(wb, /Quality Assurance Plan/i);
      let activity = "";
      for (let i = 9; i < Math.min(rows.length, 80) && created < 60; i++) {
        const row = rows[i] as unknown[];
        const act = s(row[1], 120);
        const detail = s(row[2], 300);
        const remarks = s(row[11], 80);
        if (act) activity = act;
        if (!detail) continue;
        await prisma.qapActivity.create({
          data: {
            projectId,
            weekLabel: "Monthly",
            activity: `${activity} — ${detail}`.slice(0, 400),
            discipline: activity || null,
            contractorOk: true,
            pmcOk: /complete|done|yes/i.test(remarks),
            clientOk: /complete|done/i.test(remarks),
            status: /complete|done/i.test(remarks) ? "Done" : "Open",
            completedAt: /complete|done/i.test(remarks) ? new Date() : null,
          },
        });
        created++;
      }
    }
    console.log("QAP activities seeded:", created);
  }

  // --- Safety NCR + observations ---
  {
    // already cleared at start of seedQualitySafetyFromSheets
    const file = path.join(excelRoot, "Safety NCR.xlsx");
    let created = 0;
    if (fs.existsSync(file)) {
      const wb = XLSX.readFile(file);
      const ncrRows = sheet(wb, /^NCR$/i);
      const projectName = s(ncrRows[1]?.[2], 200) || "Demo project";
      await prisma.safetyRecord.create({
        data: {
          projectId,
          recordType: "NCR",
          title: s(ncrRows[6]?.[2], 200) || "Safari-Safety NCR-Sharnam-001",
          description: `Seeded from Safety NCR.xlsx for ${projectName}. Activity/task and category to be filled on site.`,
          severity: "Medium",
          status: "Open",
          location: projectName,
          correctiveAction: "Follow site HSE corrective action plan",
          reportedById,
        },
      });
      created++;

      const obs = sheet(wb, /Observation/i);
      const types = ["Working at height", "Improper tool use", "Non-compliance with PPE", "Housekeeping"];
      for (const t of types) {
        await prisma.safetyRecord.create({
          data: {
            projectId,
            recordType: "Observation",
            title: `Unsafe act — ${t}`,
            description: `From Observation - Unsafe Act sheet (${s(obs[6]?.[2], 80) || "report"}).`,
            severity: t.includes("height") ? "High" : "Low",
            status: "Open",
            location: s(obs[1]?.[2], 120) || null,
            reportedById,
          },
        });
        created++;
      }
    }
    if (created < 2) {
      await prisma.safetyRecord.createMany({
        data: [
          {
            projectId,
            recordType: "Toolbox Talk",
            title: "Working at height — balcony guard rails",
            description: "Morning toolbox talk completed.",
            severity: "Medium",
            status: "Closed",
            location: "Block A — Level 2",
            correctiveAction: "Guard rails confirmed",
            reportedById,
            closedAt: new Date(),
          },
          {
            projectId,
            recordType: "Near Miss",
            title: "Loose plank on scaffold access",
            description: "Unstable plank on tower scaffold east face.",
            severity: "High",
            status: "Open",
            location: "Block A — East scaffold",
            reportedById,
          },
        ],
      });
      created += 2;
    }
    console.log("Safety records seeded:", created);
  }

  // --- Payment summary → vendor bills ---
  {
    const file = path.join(excelRoot, "Payment Summary - VIATRIX - Copy.xlsx");
    if (fs.existsSync(file)) {
      const existing = await prisma.vendorBill.count({ where: { projectId } });
      if (existing === 0) {
        const wb = XLSX.readFile(file);
        const rows = sheet(wb, /Summary Civil/i);
        let created = 0;
        for (let i = 7; i < Math.min(rows.length, 20); i++) {
          const row = rows[i] as unknown[];
          const desc = s(row[1], 200);
          const amount = n(row[5]) || n(row[4]) || n(row[3]);
          if (!desc || !amount) continue;
          await prisma.vendorBill.create({
            data: {
              projectId,
              vendorName: "NK Infra",
              billNo: `RA-CIV-${s(row[0], 10) || created + 1}`,
              amount,
              status: "Certified",
              description: desc,
              copNo: "RA-7",
            },
          });
          created++;
        }
        console.log("Vendor bills from Payment Summary:", created);
      }
    }
  }
}

/**
 * Demo checklist fills (today / this week) so DPR/WPR Progress Reports show typed activity.
 * Mapping:
 *  DrawingCheck → Drawing / GFC gate fills
 *  QualityInspection → Quality module + WPR Quality section
 *  Safety → Safety module + WPR Safety section
 *  SiteExecution → DPR daily checklist / site progress
 */
export async function seedChecklistFillsForReports(
  prisma: PrismaClient,
  projectId: string,
  submittedById: string
) {
  const types = ["DrawingCheck", "QualityInspection", "Safety", "SiteExecution"] as const;
  const today = new Date();
  today.setHours(10, 0, 0, 0);

  for (const checklistType of types) {
    const assignment = await prisma.checklistAssignment.findFirst({
      where: { projectId, template: { checklistType } },
      include: { template: true },
    });
    if (!assignment) continue;

    const already = await prisma.checklistSubmission.findFirst({
      where: {
        assignmentId: assignment.id,
        purpose: "Fill",
        remarks: { contains: "seed-report" },
      },
    });
    if (already) {
      await prisma.checklistSubmission.update({
        where: { id: already.id },
        data: { createdAt: today, status: checklistType === "Safety" ? "Submitted" : "Approved" },
      });
      continue;
    }

    await prisma.checklistSubmission.create({
      data: {
        assignmentId: assignment.id,
        submittedById,
        status: checklistType === "Safety" ? "Submitted" : "Approved",
        purpose: "Fill",
        remarks: `seed-report:${checklistType}`,
        responsesJson: JSON.stringify({ note: `Demo ${checklistType} fill for Progress Reports` }),
        createdAt: today,
        reviewedAt: checklistType === "Safety" ? null : today,
      },
    });
  }
  console.log("Checklist fills seeded for Progress Reports (Drawing / QI / Safety / Site)");
}

const DEMO_SOURCE = "demo-week-seed";

function dayAt(d: Date, hour = 9) {
  const x = new Date(d);
  x.setHours(hour, 0, 0, 0);
  return x;
}

async function buildChecklistResponses(prisma: PrismaClient, templateId: string, answers: string[]) {
  const items = await prisma.checklistItem.findMany({
    where: { templateId },
    orderBy: { sortOrder: "asc" },
    take: 40,
  });
  const responses: Record<string, { answer: string; remarks: string }> = {};
  items.forEach((item, i) => {
    responses[item.id] = {
      answer: answers[i % answers.length] || "Yes",
      remarks: item.section ? `${item.section} — verified on site` : "Verified",
    };
  });
  return responses;
}

/**
 * Realistic quality / safety / checklist demo for DPR + WPR auto-fill.
 * Idempotent per project — re-run safe before DPR demo day or pilot week.
 */
export async function seedQualitySafetyDemoForDpr(
  prisma: PrismaClient,
  projectId: string,
  anchorDate: Date,
  reportedById: string,
  opts?: { weekDays?: number }
) {
  const days = Math.max(1, Math.min(14, opts?.weekDays ?? 1));
  const weekLabel = `Demo-W${anchorDate.toISOString().slice(5, 7)}`;

  await prisma.qualityNcr.deleteMany({ where: { projectId, source: DEMO_SOURCE } });
  await prisma.cubeTest.deleteMany({ where: { projectId, source: DEMO_SOURCE } });
  await prisma.qapActivity.deleteMany({ where: { projectId, weekLabel: { startsWith: "Demo-" } } });
  await prisma.safetyRecord.deleteMany({ where: { projectId, title: { startsWith: "Demo ·" } } });
  await prisma.checklistSubmission.deleteMany({
    where: { assignment: { projectId }, remarks: { contains: DEMO_SOURCE } },
  });

  const ncrs = [
    {
      number: "NCR-101",
      ncrType: "Workmanship",
      description: "Honeycomb observed at column C-12 lift 2 — rectification before next pour.",
      location: "Block A — Grid C-12",
      status: "Open",
    },
    {
      number: "NCR-102",
      ncrType: "Material",
      description: "Mill test certificate pending for Fe 500D batch delivered 12-Aug.",
      location: "Site store — rebar yard",
      status: "Open",
    },
    {
      number: "CAR-08",
      ncrType: "Corrective Action",
      description: "CAR for repeated cover block spacing non-compliance on slab SOG-03.",
      location: "SOG-03",
      status: "Open",
    },
    {
      number: "NCR-099",
      ncrType: "Documentation",
      description: "Pour card sign-off missing for raft PCC — closed after resubmission.",
      location: "Raft foundation Zone 1",
      status: "Closed",
      actualClosure: anchorDate,
    },
    {
      number: "CAR-07",
      ncrType: "Corrective Action",
      description: "CAR closed — shuttering oil contamination on soffit cleaned and approved.",
      location: "Level 1 slab",
      status: "Closed",
      actualClosure: anchorDate,
    },
  ];

  for (const n of ncrs) {
    await prisma.qualityNcr.create({
      data: {
        projectId,
        number: n.number,
        issueDate: dayAt(anchorDate, 8),
        ncrType: n.ncrType,
        contractor: "NK Infra",
        description: n.description,
        location: n.location,
        plannedClosure: new Date(anchorDate.getTime() + 7 * 86400000),
        actualClosure: n.actualClosure ? dayAt(n.actualClosure, 17) : null,
        status: n.status,
        source: DEMO_SOURCE,
      },
    });
  }

  for (let d = 0; d < days; d++) {
    const day = new Date(anchorDate);
    day.setDate(anchorDate.getDate() - (days - 1 - d));
    await prisma.cubeTest.create({
      data: {
        projectId,
        srNo: String(240 + d),
        castDate: dayAt(day, 14),
        description: `M30 raft / column pour — Set ${d + 1}`,
        grade: "M30",
        cubeWeight: 8.1,
        testDate7: new Date(day.getTime() + 7 * 86400000),
        testDate28: new Date(day.getTime() + 28 * 86400000),
        strength: d === days - 1 ? 0 : 28.4,
        result: d === days - 1 ? "Pending" : "Pass",
        source: DEMO_SOURCE,
      },
    });

    await prisma.safetyRecord.create({
      data: {
        projectId,
        recordType: "Toolbox Talk",
        title: `Demo · Toolbox — working at height & PPE`,
        description: "Morning toolbox on guard rails, harness anchor points, and housekeeping.",
        severity: "Medium",
        status: "Closed",
        location: "Block A — muster point",
        correctiveAction: "PPE compliance confirmed",
        occurredAt: dayAt(day, 7),
        closedAt: dayAt(day, 8),
        reportedById,
      },
    });
  }

  await prisma.safetyRecord.create({
    data: {
      projectId,
      recordType: "Near Miss",
      title: "Demo · Loose plank on scaffold access",
      description: "Unstable plank on east face tower scaffold — barricaded and replaced.",
      severity: "High",
      status: "Open",
      location: "Block A — East scaffold",
      occurredAt: dayAt(anchorDate, 11),
      reportedById,
    },
  });

  await prisma.safetyRecord.create({
    data: {
      projectId,
      recordType: "Observation",
      title: "Demo · Housekeeping — rebar cuttings",
      description: "Rebar cuttings cleared from walkway after observation.",
      severity: "Low",
      status: "Closed",
      location: "Rebar yard",
      occurredAt: dayAt(anchorDate, 15),
      closedAt: dayAt(anchorDate, 16),
      reportedById,
    },
  });

  const qapRows = [
    { activity: "Reinforcement — cover & spacing check", discipline: "Civil", done: true },
    { activity: "Shuttering — oil & alignment before pour", discipline: "Civil", done: true },
    { activity: "Cube casting & slump — M30 raft", discipline: "Civil", done: false },
    { activity: "DB termination — torque check sample", discipline: "Electrical", done: false },
    { activity: "Fire hydrant line pressure test witness", discipline: "Fire", done: false },
  ];

  for (const q of qapRows) {
    await prisma.qapActivity.create({
      data: {
        projectId,
        weekLabel,
        activity: q.activity,
        discipline: q.discipline,
        contractorOk: true,
        pmcOk: q.done,
        clientOk: q.done,
        status: q.done ? "Done" : "Open",
        completedAt: q.done ? dayAt(anchorDate, 16) : null,
      },
    });
  }

  const qiAssignment = await prisma.checklistAssignment.findFirst({
    where: { projectId, template: { checklistType: "QualityInspection" } },
    include: { template: true },
  });
  const safetyAssignment = await prisma.checklistAssignment.findFirst({
    where: { projectId, template: { checklistType: "Safety" } },
  });

  if (qiAssignment) {
    const responses = await buildChecklistResponses(prisma, qiAssignment.templateId, [
      "Yes",
      "Yes",
      "NA",
      "Yes",
    ]);
    await prisma.checklistSubmission.create({
      data: {
        assignmentId: qiAssignment.id,
        submittedById: reportedById,
        status: "Approved",
        purpose: "Fill",
        remarks: `${DEMO_SOURCE}:QI pour inspection`,
        responsesJson: JSON.stringify(responses),
        createdAt: dayAt(anchorDate, 10),
        reviewedAt: dayAt(anchorDate, 11),
      },
    });
  }

  if (safetyAssignment) {
    const responses = await buildChecklistResponses(prisma, safetyAssignment.templateId, [
      "Yes",
      "Yes",
      "Yes",
    ]);
    await prisma.checklistSubmission.create({
      data: {
        assignmentId: safetyAssignment.id,
        submittedById: reportedById,
        status: "Submitted",
        purpose: "Fill",
        remarks: `${DEMO_SOURCE}:Safety site walk`,
        responsesJson: JSON.stringify(responses),
        createdAt: dayAt(anchorDate, 9),
      },
    });
  }

  console.log(
    `Quality/Safety demo seeded — ${ncrs.length} NCR/CAR · ${days} cube days · QAP ${qapRows.length} · checklists ${qiAssignment ? 1 : 0}+${safetyAssignment ? 1 : 0}`
  );
}
