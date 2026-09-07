/**
 * Log-Dump service.
 * Materialises project registers as CSVs and pushes them into the ISO folder tree
 * (SharePoint when live, mock OneDrive otherwise). Also refreshes an index file
 * so users can find every dumped register from the root.
 */
import { prisma } from "../prisma.js";
import { mockOneDrive } from "./mockOneDrive.js";
import { MODULE_TO_ISO_FOLDER } from "./graph.js";

type Row = Record<string, string | number | boolean | null | undefined>;

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: Row[]): string {
  if (!rows.length) return "no rows,\n";
  const headers = Array.from(
    rows.reduce<Set<string>>((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set())
  );
  const lines = [headers.map(csvEscape).join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape(r[h])).join(","));
  }
  return lines.join("\n") + "\n";
}

function iso(d: Date | null | undefined) {
  return d ? new Date(d).toISOString() : "";
}

type RegisterBucket =
  | "rfi"
  | "drawings"
  | "designCoordination"
  | "submittals"
  | "dpr"
  | "hindrance"
  | "progress"
  | "checklist"
  | "cube"
  | "ncr"
  | "hira"
  | "meetings";

/** Portal register CSV dumps — kept under _Registers only (not mixed with GFC PDFs). */
const REGISTER_BUCKETS: Record<RegisterBucket, string> = {
  rfi: "_Registers/RFI",
  drawings: "_Registers/Drawings",
  designCoordination: "_Registers/Drawings",
  submittals: "_Registers/Drawings",
  dpr: "_Registers/Progress",
  hindrance: "_Registers/Progress",
  progress: "_Registers/Progress",
  checklist: "_Registers/Quality",
  cube: "_Registers/Quality",
  ncr: "_Registers/Quality",
  hira: "_Registers/Safety",
  meetings: "_Registers/Comms",
};

const FOLDER = {
  registers: "_Registers",
} as const;

/** Mirror register CSVs into designated ISO module folders (not only _Registers). */
const ISO_MIRROR: Partial<Record<RegisterBucket, string>> = {
  rfi: MODULE_TO_ISO_FOLDER.rfiInformation,
  drawings: MODULE_TO_ISO_FOLDER.drawings,
  designCoordination: MODULE_TO_ISO_FOLDER.designCoordination,
  submittals: MODULE_TO_ISO_FOLDER.submittals,
  dpr: MODULE_TO_ISO_FOLDER.dpr,
  hindrance: MODULE_TO_ISO_FOLDER.hindrance,
  progress: MODULE_TO_ISO_FOLDER.progress,
  checklist: MODULE_TO_ISO_FOLDER.qualityChecklist,
  cube: MODULE_TO_ISO_FOLDER.cube,
  ncr: MODULE_TO_ISO_FOLDER.ncr,
  hira: MODULE_TO_ISO_FOLDER.safety,
  meetings: MODULE_TO_ISO_FOLDER.meetings,
};

async function upload(projectCode: string, folder: string, fileName: string, content: string, replace = false) {
  return mockOneDrive.upload(projectCode, folder, fileName, Buffer.from(content, "utf8"), "text/csv", { replace });
}

async function dropRegister(projectCode: string, bucket: RegisterBucket, name: string, rows: Row[]) {
  const folder = REGISTER_BUCKETS[bucket];
  const csv = toCsv(rows);
  const saved = await upload(projectCode, folder, `${name}.csv`, csv, true);
  const isoFolder = ISO_MIRROR[bucket];
  if (isoFolder) {
    await upload(projectCode, isoFolder, `${name}.csv`, csv, true);
  }
  return { name, rows: rows.length, folder, isoFolder: isoFolder || null, saved };
}

/** Publish branded QAP / cube XLSX workbooks into ISO folders after CSV dump. */
async function publishRegisterWorkbooks(projectId: string, projectCode: string) {
  const office = await prisma.user.findFirst({ where: { role: { in: ["office", "admin"] } }, select: { id: true } });
  if (!office) return [];

  const published: { kind: string; fileName: string; folder: string }[] = [];
  const { publishRegisterWorkbook } = await import("./registerWorkbookPublish.js");

  const qapCount = await prisma.qapActivity.count({ where: { projectId } });
  if (qapCount > 0) {
    try {
      const { exportQapWorkbook } = await import("./qapImportExport.js");
      const { stampSpdcWorkbookLogo } = await import("./brandedExport.js");
      const { buffer, weekLabel } = await exportQapWorkbook(projectId);
      const stamped = await stampSpdcWorkbookLogo(buffer);
      const fileName = `QAP-${projectCode}-${weekLabel.replace(/\s+/g, "-")}.xlsx`;
      const out = await publishRegisterWorkbook({
        projectId,
        userId: office.id,
        moduleKey: "qap",
        fileName,
        buffer: stamped,
        auditAction: "qap.published.dump",
        auditMeta: { weekLabel, source: "dump-logs" },
      });
      published.push({ kind: "qap", fileName, folder: MODULE_TO_ISO_FOLDER.qap });
    } catch (e) {
      console.warn("dump-logs: QAP workbook publish skipped:", e instanceof Error ? e.message : e);
    }
  }

  const cubeCount = await prisma.cubeTest.count({ where: { projectId } });
  if (cubeCount > 0) {
    try {
      const { exportCubeWorkbook } = await import("./cubeRegisterImport.js");
      const { buffer } = await exportCubeWorkbook(projectId);
      const fileName = `Cube-Register-${projectCode}.xlsx`;
      const out = await publishRegisterWorkbook({
        projectId,
        userId: office.id,
        moduleKey: "cube",
        fileName,
        buffer,
        auditAction: "cube.published.dump",
        auditMeta: { rowCount: cubeCount, source: "dump-logs" },
      });
      published.push({ kind: "cube", fileName, folder: MODULE_TO_ISO_FOLDER.cube });
    } catch (e) {
      console.warn("dump-logs: cube workbook publish skipped:", e instanceof Error ? e.message : e);
    }
  }

  return published;
}

/** Dump every register for a project. Idempotent, safe to run repeatedly. */
export async function dumpAllProjectLogs(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const code = project.code;

  await mockOneDrive.ensureProjectTree(projectId);

  const results: { name: string; rows: number }[] = [];

  /* RFI — Information */
  const infoRfis = await prisma.rfi.findMany({
    where: { projectId, rfiKind: "RequestForInformation" },
    include: {
      assignedTo: { select: { fullName: true } },
      createdBy: { select: { fullName: true } },
      responses: { select: { id: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const infoReg = await dropRegister(
    code,
    "rfi",
    "RFI-Information-Log",
    infoRfis.map((r) => ({
      number: r.number,
      subject: r.subject,
      status: r.status,
      ballInCourt: r.ballInCourt,
      assignedTo: r.assignedTo?.fullName ?? "",
      createdBy: r.createdBy?.fullName ?? "",
      createdAt: iso(r.createdAt),
      dueDate: iso(r.dueDate),
      closedAt: iso(r.closedAt),
      responses: r.responses.length,
      scheduleImpact: r.scheduleImpact ?? "",
      costImpact: r.costImpact ?? "",
    }))
  );
  results.push(infoReg);

  /* RFI — Quality */
  const qiRfis = await prisma.rfi.findMany({
    where: { projectId, rfiKind: "QualityInspection" },
    include: {
      assignedTo: { select: { fullName: true } },
      createdBy: { select: { fullName: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  results.push(
    await dropRegister(
      code,
      "checklist",
      "RFI-Quality-Log",
      qiRfis.map((r) => ({
        number: r.number,
        subject: r.subject,
        status: r.status,
        assignedTo: r.assignedTo?.fullName ?? "",
        createdBy: r.createdBy?.fullName ?? "",
        createdAt: iso(r.createdAt),
        dueDate: iso(r.dueDate),
        closedAt: iso(r.closedAt),
      }))
    )
  );

  /* RFI — Safety */
  const safetyRfis = await prisma.rfi.findMany({
    where: { projectId, rfiKind: "SafetyChecklist" },
    include: {
      assignedTo: { select: { fullName: true } },
      createdBy: { select: { fullName: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  results.push(
    await dropRegister(
      code,
      "hira",
      "RFI-Safety-Log",
      safetyRfis.map((r) => ({
        number: r.number,
        subject: r.subject,
        status: r.status,
        assignedTo: r.assignedTo?.fullName ?? "",
        createdBy: r.createdBy?.fullName ?? "",
        createdAt: iso(r.createdAt),
        dueDate: iso(r.dueDate),
        closedAt: iso(r.closedAt),
      }))
    )
  );

  /* RFI — DrawingChecklist */
  const dwgRfis = await prisma.rfi.findMany({
    where: { projectId, rfiKind: "DrawingChecklist" },
    include: {
      drawing: { select: { drawingNumber: true, title: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  results.push(
    await dropRegister(
      code,
      "drawings",
      "RFI-DrawingChecklist-Log",
      dwgRfis.map((r) => ({
        number: r.number,
        subject: r.subject,
        drawing: r.drawing ? `${r.drawing.drawingNumber} · ${r.drawing.title}` : "",
        status: r.status,
        createdAt: iso(r.createdAt),
        dueDate: iso(r.dueDate),
        closedAt: iso(r.closedAt),
      }))
    )
  );

  /* Drawings + revisions */
  const drawings = await prisma.drawing.findMany({
    where: { projectId },
    include: {
      revisions: {
        orderBy: { createdAt: "asc" },
        include: {
          uploadedBy: { select: { fullName: true, email: true } },
          markupPages: { select: { id: true } },
        },
      },
    },
    orderBy: { drawingNumber: "asc" },
  });
  results.push(
    await dropRegister(
      code,
      "drawings",
      "Drawings-Log",
      drawings.map((d) => ({
        drawingNumber: d.drawingNumber,
        title: d.title,
        discipline: d.discipline,
        buildingArea: d.buildingArea ?? "",
        tlNo: d.tlNo ?? "",
        currentRev: d.currentRev,
        status: d.status,
        published: d.isPublished ? "yes" : "no",
        revisions: d.revisions.length,
        latestFile: d.revisions[d.revisions.length - 1]?.fileUrl ?? "",
      }))
    )
  );

  /* Full GFC register grid (matches export.csv columns) */
  const gfcRows: Row[] = [];
  for (const d of drawings) {
    const revsAsc = [...d.revisions].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const row: Row = {
      discipline: d.discipline,
      buildingArea: d.buildingArea ?? "",
      tlNo: d.tlNo ?? "",
      drawingNumber: d.drawingNumber,
      title: d.title,
      currentRev: d.currentRev,
      published: d.isPublished ? "yes" : "no",
    };
    for (let i = 0; i < 6; i++) {
      const r = revsAsc[i];
      const slot = `R${i}`;
      row[`${slot}_planned`] = r?.plannedDate ? iso(r.plannedDate).slice(0, 10) : "";
      row[`${slot}_actual`] = r?.actualDate ? iso(r.actualDate).slice(0, 10) : r ? iso(r.createdAt).slice(0, 10) : "";
    }
    row.totalRevisions = revsAsc.length;
    gfcRows.push(row);
  }
  results.push(await dropRegister(code, "drawings", "GFC-Drawing-Register", gfcRows));

  /* Per-revision upload log with checklist gate id */
  const revisionRows: Row[] = [];
  for (const d of drawings) {
    for (const r of d.revisions) {
      revisionRows.push({
        drawingNumber: d.drawingNumber,
        title: d.title,
        discipline: d.discipline,
        revisionNumber: r.revisionNumber,
        revisionLabel: r.revisionLabel ?? "",
        plannedDate: iso(r.plannedDate).slice(0, 10),
        actualDate: iso(r.actualDate).slice(0, 10),
        receivedDate: r.receivedDate ? iso(r.receivedDate).slice(0, 10) : "",
        copiesReceived: r.copiesReceived ?? "",
        clientSignUrl: r.clientSignUrl ?? "",
        pmcSignUrl: r.pmcSignUrl ?? "",
        siteEngineerSignUrl: r.siteEngineerSignUrl ?? "",
        markupPages: r.markupPages?.length ?? 0,
        uploadedAt: iso(r.createdAt),
        uploadedBy: r.uploadedBy?.fullName ?? "",
        published: r.published ? "yes" : "no",
        fileName: r.fileName ?? "",
        fileUrl: r.fileUrl,
        preCheckSubmissionId: r.preCheckSubmissionId ?? "",
        checklistFilled: r.preCheckSubmissionId ? "yes" : "",
      });
    }
  }
  results.push(await dropRegister(code, "drawings", "Drawings-Revision-Log", revisionRows));

  /* Design Coordination */
  const designIssues = await prisma.designCoordinationIssue.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });
  results.push(
    await dropRegister(
      code,
      "designCoordination",
      "Design-Coordination-Log",
      designIssues.map((i) => ({
        id: i.id,
        title: i.title,
        discipline: i.discipline ?? "",
        status: i.status,
        priority: i.priority,
        assignedToName: i.assignedToName ?? "",
        assignedToEmail: i.assignedToEmail ?? "",
        followUpCount: i.followUpCount,
        lastFollowUpAt: i.lastFollowUpAt ? iso(i.lastFollowUpAt) : "",
        escalatedRfiId: i.escalatedRfiId ?? "",
        linkedDrawingId: i.linkedDrawingId ?? "",
        dueDate: i.dueDate ? iso(i.dueDate).slice(0, 10) : "",
        createdAt: iso(i.createdAt),
      }))
    )
  );

  /* DPR */
  const dpr = await prisma.dailyLog.findMany({
    where: { projectId },
    include: {
      manpower: true,
      equipment: true,
      notes: true,
      photos: true,
      createdBy: { select: { fullName: true } },
    },
    orderBy: { logDate: "asc" },
  });
  results.push(
    await dropRegister(
      code,
      "dpr",
      "DPR-Log",
      dpr.map((r) => ({
        date: iso(r.logDate).slice(0, 10),
        weather: r.weatherCondition ?? "",
        status: r.status,
        createdBy: r.createdBy?.fullName ?? "",
        manpower: r.manpower.length,
        equipment: r.equipment.length,
        notes: r.notes.length,
        photos: r.photos.length,
      }))
    )
  );

  /* WPR aggregation by ISO week */
  const wprMap = new Map<string, { start: string; end: string; days: number; manpower: number; photos: number }>();
  for (const r of dpr) {
    const d = new Date(r.logDate);
    const year = d.getUTCFullYear();
    const jan = new Date(Date.UTC(year, 0, 1));
    const week = Math.ceil(((d.getTime() - jan.getTime()) / 86400000 + jan.getUTCDay() + 1) / 7);
    const key = `${year}-W${String(week).padStart(2, "0")}`;
    const cur = wprMap.get(key);
    const mp = r.manpower.length;
    const day = iso(r.logDate).slice(0, 10);
    if (!cur) {
      wprMap.set(key, { start: day, end: day, days: 1, manpower: mp, photos: r.photos.length });
    } else {
      cur.end = day;
      cur.days += 1;
      cur.manpower += mp;
      cur.photos += r.photos.length;
    }
  }
  results.push(
    await dropRegister(
      code,
      "progress",
      "WPR-Log",
      Array.from(wprMap.entries()).map(([week, v]) => ({ week, ...v }))
    )
  );

  /* Quality Inspections */
  const qi = await prisma.qualityInspection.findMany({
    where: { projectId },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });
  results.push(
    await dropRegister(
      code,
      "checklist",
      "QualityInspection-Log",
      qi.map((r) => ({
        title: r.title,
        inspectionType: r.inspectionType,
        trade: r.trade ?? "",
        status: r.status,
        dueDate: iso(r.dueDate),
        completedAt: iso(r.completedAt),
        items: r.items.length,
      }))
    )
  );

  /* Checklist submissions */
  const submissions = await prisma.checklistSubmission.findMany({
    where: { assignment: { projectId } },
    include: {
      assignment: {
        include: { template: { select: { name: true, category: true, checklistType: true } } },
      },
      drawing: { select: { drawingNumber: true, title: true } },
      revision: { select: { revisionNumber: true } },
      submittedBy: { select: { fullName: true } },
      photos: true,
    },
    orderBy: { createdAt: "asc" },
  });
  results.push(
    await dropRegister(
      code,
      "checklist",
      "Checklist-Submissions-Log",
      submissions.map((s) => ({
        submissionId: s.id,
        template: s.assignment.template?.name ?? "",
        type: s.assignment.template?.checklistType ?? "",
        category: s.assignment.template?.category ?? "",
        drawing: s.drawing?.drawingNumber ?? "",
        drawingTitle: s.drawing?.title ?? "",
        revision: s.revisionNumber || s.revision?.revisionNumber || "",
        purpose: s.purpose,
        status: s.status,
        createdAt: iso(s.createdAt),
        reviewedAt: iso(s.reviewedAt),
        submittedBy: s.submittedBy?.fullName ?? "",
        photos: s.photos.length,
        unlockUsed: s.unlockUsedAt ? iso(s.unlockUsedAt) : "",
      }))
    )
  );

  /* Line-level filled answers → drive CSV */
  const filledLines: Row[] = [];
  for (const s of submissions) {
    let answers: Record<string, { answer?: string; comment?: string }> = {};
    try {
      answers = JSON.parse(s.responsesJson || "{}") as typeof answers;
    } catch {
      answers = {};
    }
    const templateName = s.assignment.template?.name ?? "";
    const drawingNo = s.drawing?.drawingNumber ?? "";
    for (const [itemId, val] of Object.entries(answers)) {
      filledLines.push({
        submissionId: s.id,
        template: templateName,
        drawing: drawingNo,
        revision: s.revisionNumber || s.revision?.revisionNumber || "",
        purpose: s.purpose,
        status: s.status,
        submittedAt: iso(s.createdAt),
        submittedBy: s.submittedBy?.fullName ?? "",
        itemId,
        answer: val?.answer ?? "",
        comment: val?.comment ?? "",
      });
    }
  }
  if (filledLines.length) {
    results.push(await dropRegister(code, "checklist", "Checklist-Filled-Lines", filledLines));
  }

  /* Safety */
  const safety = await prisma.safetyRecord.findMany({
    where: { projectId },
    orderBy: { occurredAt: "asc" },
  });
  results.push(
    await dropRegister(
      code,
      "hira",
      "Safety-Log",
      safety.map((s) => ({
        id: s.id,
        title: s.title,
        recordType: s.recordType,
        severity: s.severity,
        status: s.status,
        occurredAt: iso(s.occurredAt),
        closedAt: iso(s.closedAt),
      }))
    )
  );

  /* NCRs */
  const ncr = await prisma.qualityNcr.findMany({
    where: { projectId },
    orderBy: { issueDate: "asc" },
  });
  results.push(
    await dropRegister(
      code,
      "ncr",
      "NCR-Log",
      ncr.map((n) => ({
        number: n.number ?? "",
        ncrType: n.ncrType ?? "",
        contractor: n.contractor ?? "",
        description: n.description,
        status: n.status,
        issueDate: iso(n.issueDate),
        actualClosure: iso(n.actualClosure),
      }))
    )
  );

  /* Cube tests */
  const cubes = await prisma.cubeTest.findMany({
    where: { projectId },
    orderBy: { castDate: "asc" },
  });
  results.push(
    await dropRegister(
      code,
      "cube",
      "Cube-Test-Log",
      cubes.map((c) => ({
        srNo: c.srNo ?? "",
        description: c.description,
        grade: c.grade ?? "",
        castDate: iso(c.castDate),
        testDate7: iso(c.testDate7),
        testDate28: iso(c.testDate28),
        load28: c.load28 ?? "",
        strength: c.strength ?? "",
        avgStrength: c.avgStrength ?? "",
        result: c.result ?? "",
      }))
    )
  );

  /* Meetings */
  const meetings = await prisma.meeting.findMany({
    where: { projectId },
    include: { items: true },
    orderBy: { meetingDate: "asc" },
  });
  results.push(
    await dropRegister(
      code,
      "meetings",
      "Meetings-Log",
      meetings.map((m) => ({
        title: m.title,
        meetingDate: iso(m.meetingDate),
        location: m.location ?? "",
        status: m.status,
        items: m.items.length,
      }))
    )
  );

  /* Submittals */
  const submittals = await prisma.submittal.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });
  results.push(
    await dropRegister(
      code,
      "submittals",
      "Submittals-Log",
      submittals.map((s) => ({
        number: s.number,
        title: s.title,
        submittalType: s.submittalType,
        status: s.status,
        ballInCourt: s.ballInCourt,
        revisionNumber: s.revisionNumber,
        dueDate: iso(s.dueDate),
        updatedAt: iso(s.updatedAt),
      }))
    )
  );

  /* Hindrances */
  const hindrance = await prisma.progressHindrance.findMany({
    where: { projectId },
    orderBy: { occurredAt: "asc" },
  });
  results.push(
    await dropRegister(
      code,
      "hindrance",
      "Hindrance-Log",
      hindrance.map((h) => ({
        description: h.description,
        category: h.category ?? "",
        type: h.type ?? "",
        status: h.status,
        occurredAt: iso(h.occurredAt),
        resolvedAt: iso(h.resolvedAt),
        daysImpacted: h.daysImpacted,
      }))
    )
  );

  /* Index */
  await upload(
    code,
    FOLDER.registers,
    "_INDEX.csv",
    toCsv(results.map((r) => ({ register: r.name, records: r.rows, refreshedAt: new Date().toISOString() }))),
    true
  );

  const workbooks = await publishRegisterWorkbooks(projectId, code);

  return {
    projectId,
    projectCode: code,
    refreshedAt: new Date().toISOString(),
    registers: results,
    workbooks,
  };
}
