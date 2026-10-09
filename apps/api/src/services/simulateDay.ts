/**
 * UAT · simulate working days on a project — a day of site activity written the way the portal writes it:
 * site observations / instructions, NCRs, cube groups, checklist fills with photos, F-01 requests, daily safety
 * log + safety records, DPR lines. Everything carries a simulation tag so `removeSimulation` takes it all out.
 */
import fs from "fs";
import path from "path";
import { prisma } from "../prisma.js";
import { rgbPng } from "./checklistSignoff.js";
import { createSpdcCubeGroup } from "./cubeRegisterImport.js";
import { buildDprAutoFill } from "./dprIntegrations.js";
import { dayFromKey } from "./safetyWeek.js";

export const SIM_TAG = "[SIM]";
const SIM_SOURCE = "simulation";

function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LOCATIONS = ["Grid A3 / L1", "Grid B5 / L2", "Grid C4 / Plinth", "Block A — Stair core", "Block B — Terrace", "External — Road edge", "Store yard", "Labour colony", "Grid D2 / L1", "PEB Bay 3–5"];
const OBSERVATIONS: [string, string, string][] = [
  ["Cover blocks missing at column starter", "Medium", "Reinforcement"],
  ["Shuttering joints open — slurry leakage likely", "High", "Shuttering"],
  ["Honeycombing visible on stripped column face", "High", "Concrete"],
  ["Curing not started within 12 hours of pour", "Medium", "Concrete"],
  ["Blockwork joints exceed 12 mm", "Low", "Masonry"],
  ["Rebar lap length short on beam B14", "High", "Reinforcement"],
  ["Material stack not on dunnage — MTC lot mixed", "Low", "Stores"],
  ["Slump test record not available at pour", "Medium", "Concrete"],
  ["Conduit not secured before slab pour", "Medium", "MEP"],
  ["Plaster thickness uneven on internal wall", "Low", "Finishes"],
];
const INSTRUCTIONS = [
  "Stop pour until cover blocks are fixed and re-inspected",
  "Replace damaged shuttering ply before next use",
  "Provide wet curing for 7 days from the pour",
  "Submit revised BBS for beam B14 before further fabrication",
  "Re-test slump at the batching plant gate and record",
  "Barricade open edge at terrace before work resumes",
];
const NCR_ISSUES: [string, string][] = [
  ["Concrete cube 7-day strength below requirement for footing group", "Concrete"],
  ["Reinforcement spacing deviates from approved drawing by more than tolerance", "Reinforcement"],
  ["Waterproofing applied without surface preparation approval", "Waterproofing"],
  ["Column plumb out of tolerance at second lift", "Structure"],
  ["Material delivered without test certificate", "Materials"],
];
const SAFETY_OBS: [string, string, string][] = [
  ["Worker without helmet near hoist", "Observation", "Medium"],
  ["Scaffold missing toe-board at level 2", "Observation", "High"],
  ["Near miss — falling bolt from PEB erection", "Near Miss", "High"],
  ["Extension board exposed to water near mixer", "Observation", "Medium"],
  ["Unsafe stacking of bricks beyond 1.5 m", "Observation", "Low"],
];
const TBT_TOPICS = ["Working at height", "Housekeeping", "Manual handling", "Electrical safety", "Fire prevention", "PPE usage", "Excavation safety", "Concrete pump safety"];
const FILL_REMARKS = ["Checked on site", "Verified with drawing", "Reading within tolerance", "Photo attached", "Reworked and re-checked"];

export const simDayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const at = (key: string, hour = 11, min = 0) => new Date(`${key}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00+05:30`);

function uploadRoot() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
}

/** Six coloured placeholder "site photographs" per project, written once. */
function ensureSimPhotos(projectCode: string): string[] {
  const dir = path.join(uploadRoot(), "onedrive", projectCode, "simulated");
  fs.mkdirSync(dir, { recursive: true });
  const palettes: [number, number, number][] = [[196, 160, 120], [120, 150, 190], [150, 150, 150], [170, 190, 130], [200, 130, 110], [110, 170, 170]];
  return palettes.map((base, k) => {
    const file = path.join(dir, `sim-photo-${k + 1}.png`);
    if (!fs.existsSync(file)) {
      const png = rgbPng(480, 300, (x, y) => {
        const band = Math.floor((y + k * 17) / 38) % 2 ? 0.86 : 1;
        const edge = x < 6 || y < 6 || x > 473 || y > 293 ? 0.5 : 1;
        return [Math.round(base[0] * band * edge), Math.round(base[1] * band * edge), Math.round(base[2] * band * edge)];
      });
      fs.writeFileSync(file, png);
    }
    return `/uploads/onedrive/${projectCode}/simulated/sim-photo-${k + 1}.png`;
  });
}

export type SimulationSummary = Record<string, number>;

export async function simulateDay(opts: { projectId: string; dateKey: string; userId: string; today?: Date }): Promise<SimulationSummary> {
  const { projectId, dateKey, userId } = opts;
  const today = opts.today || new Date();
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const r = rng(`${project.code}|${dateKey}`);
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  const between = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  const sum: SimulationSummary = {};
  const bump = (k: string, n = 1) => {
    sum[k] = (sum[k] || 0) + n;
  };
  const daysAgo = Math.max(0, Math.round((new Date(simDayKey(today)).getTime() - new Date(dateKey).getTime()) / 86400000));
  const photos = ensureSimPhotos(project.code);
  const contractor = project.contractorName || "Contractor";
  const dayStart = at(dateKey, 0, 0);
  const dayEnd = at(dateKey, 23, 59);

  // ── Quality: site observations + instructions ──
  const haveRecords = await prisma.qualitySiteRecord.count({ where: { projectId, source: SIM_SOURCE, occurredAt: { gte: dayStart, lte: dayEnd } } });
  if (!haveRecords) {
    for (let i = 0; i < between(2, 3); i++) {
      const [title, severity, trade] = pick(OBSERVATIONS);
      const shots = Array.from({ length: between(1, 2) }, (_, k) => ({ url: photos[(i + k + daysAgo) % photos.length], name: `${trade}-${k + 1}.png` }));
      await prisma.qualitySiteRecord.create({
        data: {
          projectId,
          recordType: "Site Observation",
          title: `${SIM_TAG} ${title}`,
          description: `${trade} — raised during the morning round.`,
          location: pick(LOCATIONS),
          severity,
          status: "Open",
          issuedTo: contractor,
          reportedById: userId,
          occurredAt: at(dateKey, between(9, 16), between(0, 59)),
          photosJson: JSON.stringify(shots),
          source: SIM_SOURCE,
        },
      });
      bump("siteObservations");
    }
    for (let i = 0; i < between(1, 2); i++) {
      await prisma.qualitySiteRecord.create({
        data: {
          projectId,
          recordType: "Site Instruction",
          title: `${SIM_TAG} ${pick(INSTRUCTIONS)}`,
          location: pick(LOCATIONS),
          severity: "Medium",
          status: "Open",
          issuedTo: contractor,
          reportedById: userId,
          occurredAt: at(dateKey, between(9, 16), between(0, 59)),
          source: SIM_SOURCE,
        },
      });
      bump("siteInstructions");
    }
    // Earlier simulated records get closed over the following days.
    const older = await prisma.qualitySiteRecord.findMany({ where: { projectId, source: SIM_SOURCE, status: "Open", occurredAt: { lt: dayStart } } });
    for (const rec of older) {
      if (r() < 0.28) {
        await prisma.qualitySiteRecord.update({
          where: { id: rec.id },
          data: { status: "Closed", closedAt: at(dateKey, 17), correctiveAction: "Rectified by contractor and verified by PMC." },
        });
        bump("recordsClosed");
      }
    }
  }

  // ── Quality: an NCR / CAR on roughly every second day; older ones get closed ──
  const haveNcr = await prisma.qualityNcr.count({ where: { projectId, source: SIM_SOURCE, issueDate: { gte: dayStart, lte: dayEnd } } });
  if (!haveNcr && r() < 0.6) {
    const rows = await prisma.qualityNcr.findMany({ where: { projectId }, select: { number: true } });
    let max = 0;
    for (const n of rows) max = Math.max(max, Number(String(n.number || "").match(/(\d+)\s*$/)?.[1] || 0));
    const [issue, trade] = pick(NCR_ISSUES);
    const car = r() < 0.3;
    await prisma.qualityNcr.create({
      data: {
        projectId,
        number: `${car ? "CAR" : "NCR"}-${String(max + 1).padStart(2, "0")}`,
        issueDate: at(dateKey, 10),
        ncrType: car ? "CAR" : "Quality",
        contractor,
        description: `${SIM_TAG} ${issue}`,
        location: pick(LOCATIONS),
        plannedClosure: at(dateKey, 10),
        status: "Open",
        source: SIM_SOURCE,
        formDataJson: JSON.stringify({ trade, raisedBy: "PMC Quality Engineer" }),
      },
    });
    bump("ncrs");
  }
  const oldNcrs = await prisma.qualityNcr.findMany({ where: { projectId, source: SIM_SOURCE, status: "Open", issueDate: { lt: dayStart } } });
  for (const n of oldNcrs) {
    if (r() < 0.22) {
      await prisma.qualityNcr.update({ where: { id: n.id }, data: { status: "Closed", actualClosure: at(dateKey, 15) } });
      bump("ncrsClosed");
    }
  }

  // ── Quality: one cube group per day (7-day / 28-day loads fill in as the cast ages) ──
  const haveCube = await prisma.cubeTest.count({ where: { projectId, source: SIM_SOURCE, castDate: { gte: dayStart, lte: dayEnd } } });
  if (!haveCube) {
    const grade = pick(["M25", "M30"]);
    const fck = grade === "M30" ? 30 : 25;
    const fail28 = r() < 0.12;
    const loadFor = (ratio: number) => Math.round(fck * ratio * 22.5 * 10) / 10;
    const seq =
      (await prisma.cubeTest.findMany({ where: { projectId }, select: { srNo: true } })).reduce((m, c) => Math.max(m, Number(String(c.srNo || "").match(/(\d+)/)?.[1] || 0)), 0) + 1;
    const specimens = [
      ...Array.from({ length: 3 }, () => ({ phase: "7d" as const, cubeWeight: Math.round((8.1 + r() * 0.4) * 100) / 100, load7: daysAgo >= 7 ? loadFor(0.68 + r() * 0.1) : null })),
      ...Array.from({ length: 3 }, () => ({
        phase: "28d" as const,
        cubeWeight: Math.round((8.1 + r() * 0.4) * 100) / 100,
        load28: daysAgo >= 28 ? loadFor(fail28 ? 0.88 + r() * 0.07 : 1.05 + r() * 0.2) : null,
      })),
    ];
    await createSpdcCubeGroup({
      projectId,
      srNo: String(seq),
      castDate: at(dateKey, 9),
      description: `${SIM_TAG} ${pick(["Footing F", "Column C", "Slab S", "Beam B"])}${between(1, 40)} — ${pick(LOCATIONS)}`,
      grade,
      testAgency: "Site lab",
      source: SIM_SOURCE,
      specimens,
    });
    bump("cubeGroups");
  }

  // ── Checklist fills with photos (quality ×2, site ×1, safety ×1) ──
  const marker = `${SIM_TAG} ${dateKey}`;
  const alreadyFilled = await prisma.checklistSubmission.count({ where: { remarks: { startsWith: marker }, assignment: { projectId } } });
  if (!alreadyFilled) {
    const wanted: [string, number][] = [["QualityInspection", 2], ["SiteExecution", 1], ["Safety", 1]];
    for (const [type, n] of wanted) {
      const assigns = await prisma.checklistAssignment.findMany({
        where: { projectId, template: { checklistType: type, isActive: true } },
        include: { template: { include: { items: { orderBy: { sortOrder: "asc" } } } } },
        take: 60,
      });
      const usable = assigns.filter((a) => a.template.items.length > 0 && a.template.items.length <= 60);
      for (let k = 0; k < Math.min(n, usable.length); k++) {
        const a = usable.splice(Math.floor(r() * usable.length), 1)[0];
        const responses: Record<string, { answer: string; remarks?: string }> = {};
        for (const it of a.template.items) {
          const roll = r();
          responses[it.id] =
            roll < 0.88
              ? { answer: "Yes", remarks: r() < 0.3 ? pick(FILL_REMARKS) : "" }
              : roll < 0.95
                ? { answer: "N.A.", remarks: "Not applicable at this stage" }
                : { answer: "No", remarks: "Rectify and re-offer" };
        }
        const when = at(dateKey, between(9, 16), between(0, 59));
        const sub = await prisma.checklistSubmission.create({
          data: { assignmentId: a.id, submittedById: userId, status: "Submitted", responsesJson: JSON.stringify(responses), remarks: `${marker} — simulated fill`, purpose: "Fill", createdAt: when },
        });
        const flagged = a.template.items.filter((it) => it.requirePhoto);
        let p = 0;
        for (const it of flagged) {
          for (let c = 0; c < 3; c++) {
            await prisma.checklistPhoto.create({ data: { submissionId: sub.id, itemId: it.id, kind: "photo", fileUrl: photos[(p++ + daysAgo) % photos.length], caption: `Simulated site photo ${c + 1}`, createdAt: when } });
          }
        }
        for (let c = 0; c < 3; c++) {
          await prisma.checklistPhoto.create({ data: { submissionId: sub.id, itemId: null, kind: "photo", fileUrl: photos[(p++ + daysAgo) % photos.length], caption: "Simulated site photo", createdAt: when } });
        }
        bump("checklistFills");
        bump("checklistPhotos", flagged.length * 3 + 3);
      }
    }
  }

  // ── F-01 Request for Inspection ──
  const irNumber = `SIM-IR-${dateKey.replace(/-/g, "")}`;
  if (!(await prisma.rfi.count({ where: { projectId, number: irNumber } }))) {
    const activity = pick(["RCC column casting", "Footing reinforcement", "Brick masonry — ground floor", "Slab shuttering", "PCC below footing", "Waterproofing — terrace"]);
    const loc = pick(LOCATIONS);
    await prisma.rfi.create({
      data: {
        projectId,
        number: irNumber,
        subject: `${SIM_TAG} Request for Inspection — ${activity}`,
        question: `${activity} at ${loc} is ready for inspection. Self-check completed and checklist enclosed.`,
        rfiKind: "QualityIR",
        irNumber: `IR/CIV/SIM-${between(100, 199)}`,
        status: r() < 0.5 ? "Closed" : "Open",
        ballInCourt: "Assignee",
        createdById: userId,
        formDataJson: JSON.stringify({
          projectFacility: project.code,
          employerClient: project.clientName || "",
          contractorAgency: contractor,
          pmcEngineer: "SPDC",
          dateRaised: dateKey,
          discipline: "Civil / Structural",
          activityDescription: activity,
          location: loc,
          quantityUnit: `${between(2, 40)} cum`,
          stageOfWork: "Pre-pour hold point",
          controlPoint: "H — Hold point",
        }),
        scheduleImpact: "None",
        costImpact: "None",
      },
    });
    bump("inspectionRequests");
  }

  // ── Safety: daily log + a record ──
  if (!(await prisma.safetyDailyLog.findFirst({ where: { projectId, date: dayFromKey(dateKey) } }))) {
    const manpower = between(40, 95);
    await prisma.safetyDailyLog.create({
      data: {
        projectId,
        date: dayFromKey(dateKey),
        manpower,
        hoursPerHead: 8,
        safeManHours: manpower * 8,
        toolboxTalks: 1,
        tbtTopics: `${pick(TBT_TOPICS)}; ${pick(TBT_TOPICS)}`,
        inductions: between(0, 5),
        permitsIssued: between(1, 6),
        ppeCompliancePct: between(90, 99),
        remarks: `${SIM_TAG} simulated day`,
        createdById: userId,
      },
    });
    bump("safetyDailyLogs");
  }
  if (!(await prisma.safetyRecord.count({ where: { projectId, source: SIM_SOURCE, occurredAt: { gte: dayStart, lte: dayEnd } } }))) {
    const [title, type, severity] = pick(SAFETY_OBS);
    await prisma.safetyRecord.create({
      data: { projectId, recordType: type, title: `${SIM_TAG} ${title}`, severity, status: "Open", location: pick(LOCATIONS), reportedById: userId, source: SIM_SOURCE, occurredAt: at(dateKey, between(9, 16)), issuedTo: contractor },
    });
    bump("safetyRecords");
    const oldSafety = await prisma.safetyRecord.findMany({ where: { projectId, source: SIM_SOURCE, status: "Open", occurredAt: { lt: dayStart } } });
    for (const rec of oldSafety) {
      if (r() < 0.3) {
        await prisma.safetyRecord.update({ where: { id: rec.id }, data: { status: "Closed", closedAt: at(dateKey, 16), actionTaken: "Corrected on site and briefed in toolbox talk." } });
        bump("safetyRecordsClosed");
      }
    }
  }

  // ── Progress: DPR lines carried forward day to day (Civil) ──
  const logDate = new Date(Number(dateKey.slice(0, 4)), Number(dateKey.slice(5, 7)) - 1, Number(dateKey.slice(8, 10)), 0, 0, 0, 0);
  const discipline = "CIVIL";
  if (!(await prisma.dprSnapshot.findUnique({ where: { projectId_logDate_discipline: { projectId, logDate, discipline } } }))) {
    const auto = await buildDprAutoFill(projectId, logDate, discipline);
    let lines = auto.lines;
    if (!lines.length) {
      const prev = await prisma.dprSnapshot.findFirst({ where: { projectId, discipline, logDate: { lt: logDate } }, orderBy: { logDate: "desc" } });
      const prevLines: { description: string; unit?: string; cumQtyPrev?: number; qtyToday?: number }[] = prev ? JSON.parse(prev.linesJson || "[]") : [];
      const base = prevLines.length
        ? prevLines.map((l) => ({ description: l.description, unit: l.unit, cumQtyPrev: Number(l.cumQtyPrev || 0) + Number(l.qtyToday || 0) }))
        : [
            { description: "RCC column casting", unit: "m3", cumQtyPrev: 0 },
            { description: "Brick masonry", unit: "m2", cumQtyPrev: 0 },
            { description: "Reinforcement fixing", unit: "MT", cumQtyPrev: 0 },
          ];
      lines = base.map((l, i) => ({ srNo: i + 1, description: l.description, unit: l.unit, cumQtyPrev: l.cumQtyPrev }));
    }
    const filled = lines.map((l) => {
      // Daily output ≈ 0.4–2.2 % of the line's scope when known, else a plausible figure for the unit.
      const scope = Number(l.scopeQty) || 0;
      const qty = scope > 0 ? Math.max(1, Math.round(scope * (0.004 + r() * 0.018))) : /m3|cum|cmt/i.test(l.unit || "") ? between(6, 22) : /mt/i.test(l.unit || "") ? between(1, 5) : between(25, 90);
      return { ...l, qtyToday: r() < 0.15 ? 0 : qty, remarks: "" };
    });
    const extras = {
      manpower: auto.manpower.length
        ? auto.manpower
        : [
            { trade: "Mason", planned: 12, actual: between(8, 14), hoursWorked: 8 },
            { trade: "Bar Bender", planned: 10, actual: between(7, 11), hoursWorked: 8 },
            { trade: "Helper", planned: 20, actual: between(15, 24), hoursWorked: 8 },
          ],
      materials: auto.materials,
      qualityTests: auto.qualityTests,
      safetyRows: auto.safetyRows,
      safety: auto.safety,
      delays: auto.delays,
      approvals: auto.approvals,
      issues: auto.issues,
      highlights: ["Simulated day — figures are for UAT only"],
      nextDayPlan: ["Continue RCC and masonry as planned"],
      decisions: [],
      photos: [],
      attachments: [],
      signatures: [],
    };
    await prisma.dprSnapshot.create({
      data: { projectId, logDate, discipline, headerJson: JSON.stringify({ ...auto.header, _simulated: true, _extras: extras }), linesJson: JSON.stringify(filled), status: "Draft", createdById: userId },
    });
    bump("dprDays");
  }

  return sum;
}

/** Everything the simulation wrote on a project. */
export async function removeSimulation(projectId: string): Promise<SimulationSummary> {
  const out: SimulationSummary = {};
  const subs = await prisma.checklistSubmission.findMany({ where: { remarks: { startsWith: SIM_TAG }, assignment: { projectId } }, select: { id: true } });
  if (subs.length) {
    await prisma.checklistPhoto.deleteMany({ where: { submissionId: { in: subs.map((s) => s.id) } } });
    out.checklistFills = (await prisma.checklistSubmission.deleteMany({ where: { id: { in: subs.map((s) => s.id) } } })).count;
  }
  out.siteRecords = (await prisma.qualitySiteRecord.deleteMany({ where: { projectId, source: SIM_SOURCE } })).count;
  out.ncrs = (await prisma.qualityNcr.deleteMany({ where: { projectId, source: SIM_SOURCE } })).count;
  out.cubes = (await prisma.cubeTest.deleteMany({ where: { projectId, source: SIM_SOURCE } })).count;
  out.safetyRecords = (await prisma.safetyRecord.deleteMany({ where: { projectId, source: SIM_SOURCE } })).count;
  out.safetyDailyLogs = (await prisma.safetyDailyLog.deleteMany({ where: { projectId, remarks: { startsWith: SIM_TAG } } })).count;
  out.inspectionRequests = (await prisma.rfi.deleteMany({ where: { projectId, number: { startsWith: "SIM-IR-" } } })).count;
  const dprs = await prisma.dprSnapshot.findMany({ where: { projectId }, select: { id: true, headerJson: true } });
  const simDprs = dprs.filter((d) => d.headerJson.includes('"_simulated":true')).map((d) => d.id);
  if (simDprs.length) out.dprDays = (await prisma.dprSnapshot.deleteMany({ where: { id: { in: simDprs } } })).count;
  return out;
}
