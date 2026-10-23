/**
 * Create, submit and result updates for quality IRs (F-01).
 */
import { prisma } from "../prisma.js";
import { queueProjectEmail } from "./email.js";
import {
  canClientSign,
  canEditDeclaration,
  canRaiseQualityIr,
  canSetResult,
  canVerifyCloseout,
  checkQualitySubmit,
  decideQualityResult,
  lineIrType,
  type QapRoleRow,
} from "./qapSignoff.js";
import { prefillFromLine } from "./qapQuality.js";
import {
  QUALITY_CLIENT_PATCH_KEYS,
  QUALITY_CONTRACTOR_PATCH_KEYS,
  QUALITY_SPDC_PATCH_KEYS,
  requiredEnclosures,
  resultCode,
} from "@sharnam/shared";

type UserLike = { id: string; role: string; fullName?: string | null; email?: string | null; vendorId?: string | null };

function parseForm(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? { ...(v as Record<string, unknown>) } : {};
  } catch {
    return {};
  }
}

async function loadUser(user: UserLike): Promise<UserLike> {
  if (user.vendorId !== undefined) return user;
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { vendorId: true, fullName: true, email: true, role: true } });
  return { ...user, vendorId: row?.vendorId || null, fullName: user.fullName || row?.fullName, role: user.role || row?.role || "" };
}

async function assignments(projectId: string): Promise<QapRoleRow[]> {
  const rows = await prisma.qapRoleAssignment.findMany({ where: { projectId } });
  return rows.map((r) => ({ roleLabel: r.roleLabel, party: r.party, userId: r.userId, vendorId: r.vendorId }));
}

function attachedKeys(raw: string | null | undefined): string[] {
  try {
    const arr = JSON.parse(raw || "[]");
    if (!Array.isArray(arr)) return [];
    return arr.map((a) => String(a?.recordKey || "")).filter(Boolean);
  } catch {
    return [];
  }
}

async function emailsFor(projectId: string, party: string, label: string | null | undefined) {
  const lab = String(label || "").trim();
  if (!lab) return [];
  const rows = await prisma.qapRoleAssignment.findMany({
    where: { projectId, party, roleLabel: lab },
    include: { user: { select: { email: true } }, contact: { select: { email: true } } },
  });
  return [...new Set(rows.map((r) => r.user?.email || r.contact?.email || "").filter(Boolean))];
}

export async function prepareQualityIrCreate(opts: {
  projectId: string;
  user: UserLike;
  body: Record<string, unknown>;
}): Promise<
  | { error: string; status: number }
  | { qapLineId: string | null; previousIrId: string | null; form: Record<string, unknown>; linkedAssignmentId: string | null; status: string; needsChecklist: boolean }
> {
  const user = await loadUser(opts.user);
  const body = opts.body;
  const formIn = body.formDataJson && typeof body.formDataJson === "object" ? { ...(body.formDataJson as Record<string, unknown>) } : parseForm(typeof body.formDataJson === "string" ? body.formDataJson : null);
  const qapLineId = String(body.qapLineId || formIn.qapLineId || "").trim() || null;
  const onBehalf = body.onBehalf === true || formIn.onBehalf === true || formIn.onBehalf === "true";
  const map = await assignments(opts.projectId);
  const line = qapLineId
    ? await prisma.qapLine.findFirst({ where: { id: qapLineId, projectId: opts.projectId } })
    : null;
  if (qapLineId && !line) return { error: "QAP line is not on this project.", status: 400 };
  const gate = canRaiseQualityIr({
    user: { id: user.id, role: user.role, vendorId: user.vendorId },
    line,
    assignments: map,
    onBehalf,
    unlinkedReason: String(body.unlinkedReason || formIn.unlinkedReason || ""),
  });
  if (!gate.ok) return { error: gate.error || "Not allowed to raise this IR.", status: 403 };

  const prefill = line ? prefillFromLine(line) : null;
  const form: Record<string, unknown> = {
    ...(prefill
      ? {
          activityDescription: prefill.activityDescription,
          itpRef: prefill.itpRef,
          discipline: prefill.discipline,
          specClause: prefill.specClause,
          irType: prefill.irType,
        }
      : { irType: "Site inspection" }),
    ...formIn,
    qapLineId: line?.id || "",
    onBehalf: onBehalf ? "true" : "",
  };
  if (line) form.irType = lineIrType(line);

  const needsChecklist = !!(line && requiredEnclosures(line.records).some((e) => e.kind === "checklist"));
  let linkedAssignmentId = body.linkedAssignmentId ? String(body.linkedAssignmentId) : null;
  if (needsChecklist && !linkedAssignmentId) {
    linkedAssignmentId = await ensureActivityChecklist(opts.projectId, line?.section || line?.activity || "");
  }

  const submit = body.submit === true || (body.status && String(body.status) !== "Draft");
  let status = submit ? "Open" : "Draft";
  if (submit && line) {
    const check = checkQualitySubmit({
      line,
      form,
      submittedAt: new Date(),
      hasChecklist: !!linkedAssignmentId || needsChecklist,
      attachedRecordKeys: attachedKeys(typeof body.attachmentsJson === "string" ? body.attachmentsJson : null),
      requiredRecordKeys: requiredEnclosures(line.records).map((e) => e.key),
    });
    if (!check.ok) return { error: check.error || "IR is not ready to submit.", status: 400 };
    if (check.shortNotice) form.shortNotice = "true";
  } else if (submit && !line) {
    status = "Open";
  } else {
    status = "Draft";
  }

  return { qapLineId: line?.id || null, previousIrId: null, form, linkedAssignmentId, status, needsChecklist };
}

type QualityIrRow = {
  id: string;
  projectId: string;
  number: string;
  irNumber: string | null;
  status: string;
  formDataJson: string | null;
  qapLineId: string | null;
  subject: string;
  assignedToId: string | null;
  assigneeContactId: string | null;
  assigneeEmail: string | null;
  assigneeName: string | null;
  responsibleVendorId: string | null;
  linkedAssignmentId: string | null;
};

/** When F-01 is raised on a QAP line whose records name a checklist, open the linked F-02. */
export async function raiseActivityChecklistForIr(opts: {
  projectId: string;
  userId: string;
  qualityIr: QualityIrRow;
}): Promise<{ id: string; number: string; formDataJson: string } | null> {
  const form = parseForm(opts.qualityIr.formDataJson);
  if (String(form.checklistRef || "").trim()) return null;
  const line = opts.qualityIr.qapLineId
    ? await prisma.qapLine.findFirst({ where: { id: opts.qualityIr.qapLineId, projectId: opts.projectId } })
    : null;
  if (!line || !requiredEnclosures(line.records).some((e) => e.kind === "checklist")) return null;

  const existing = await prisma.rfi.findMany({
    where: { projectId: opts.projectId, rfiKind: "ActivityInspection" },
    select: { number: true },
  });
  const used = new Set(existing.map((row) => row.number));
  let n = existing.length + 1;
  let number = `CL-${String(n).padStart(3, "0")}`;
  while (used.has(number)) {
    n += 1;
    number = `CL-${String(n).padStart(3, "0")}`;
  }

  const irNo = opts.qualityIr.irNumber || opts.qualityIr.number;
  const activity = String(form.activityDescription || line.description || line.section || "Activity");
  const today = new Date().toISOString().slice(0, 10);
  const linkedAssignmentId =
    opts.qualityIr.linkedAssignmentId || (await ensureActivityChecklist(opts.projectId, line.section || line.activity || ""));
  const f02Form = {
    projectFacility: form.projectFacility || "",
    employerClient: form.employerClient || "",
    contractorAgency: form.contractorAgency || "",
    checklistNo: number,
    dateRaised: form.dateRaised || today,
    linkedIrNo: irNo,
    activityDescription: activity,
    discipline: String(form.discipline || line.discipline || line.section || ""),
    location: form.location || "",
    quantityUnit: form.quantityUnit || "",
    drawingRef: form.drawingRef || "",
    specClause: String(form.specClause || line.codeOfConformance || ""),
    methodStmtNo: form.methodStmtNo || "",
    itpRef: String(form.itpRef || [line.section, line.frequency].filter(Boolean).join(" / ")),
    qapLineId: line.id,
    parentIrId: opts.qualityIr.id,
  };
  const created = await prisma.rfi.create({
    data: {
      projectId: opts.projectId,
      number,
      irNumber: number,
      subject: `Activity checklist: ${activity}`.slice(0, 500),
      question: `SPDC/QA/F-02 raised with ${irNo}. ${activity}`,
      rfiKind: "ActivityInspection",
      formDataJson: JSON.stringify(f02Form),
      status: opts.qualityIr.status === "Draft" ? "Draft" : "Open",
      qapLineId: line.id,
      ballInCourt: "Assignee",
      assignedToId: opts.qualityIr.assignedToId,
      assigneeContactId: opts.qualityIr.assigneeContactId,
      assigneeEmail: opts.qualityIr.assigneeEmail,
      assigneeName: opts.qualityIr.assigneeName,
      createdById: opts.userId,
      linkedAssignmentId,
      responsibleVendorId: opts.qualityIr.responsibleVendorId,
    },
  });
  const nextForm = { ...form, checklistRef: number, f02Id: created.id };
  const formDataJson = JSON.stringify(nextForm);
  await prisma.rfi.update({
    where: { id: opts.qualityIr.id },
    data: {
      formDataJson,
      ...(linkedAssignmentId && !opts.qualityIr.linkedAssignmentId ? { linkedAssignmentId } : {}),
    },
  });
  if (linkedAssignmentId) {
    const { ensureFillRequestDraft } = await import("./ensureFillRequestDraft.js");
    await ensureFillRequestDraft(prisma as unknown as import("@prisma/client").PrismaClient, {
      rfiId: created.id,
      rfiNumber: number,
      subject: created.subject,
      assignmentId: linkedAssignmentId,
      createdById: opts.userId,
      assignedToId: opts.qualityIr.assignedToId,
    }).catch(() => undefined);
  }
  return { id: created.id, number, formDataJson };
}

async function ensureActivityChecklist(projectId: string, section: string): Promise<string | null> {
  const needle = section.trim().toLowerCase();
  if (needle.length < 3) return null;
  const templates = await prisma.checklistTemplate.findMany({
    where: { checklistType: { in: ["ActivityInspection", "SiteExecution"] } },
    select: { id: true, name: true },
  });
  const hit = templates.find((t) => t.name.toLowerCase().includes(needle.slice(0, 24)) || needle.includes(t.name.toLowerCase().slice(0, 16)));
  if (!hit) return null;
  const row = await prisma.checklistAssignment.upsert({
    where: { projectId_templateId: { projectId, templateId: hit.id } },
    create: { projectId, templateId: hit.id },
    update: {},
  });
  return row.id;
}

export async function notifyQualityIr(projectId: string, kind: "submit" | "client", line: { pmcRole?: string | null; clientRole?: string | null; section?: string | null; description?: string | null }, irNumber: string) {
  const to = kind === "submit" ? await emailsFor(projectId, "PMC", line.pmcRole) : await emailsFor(projectId, "Client", line.clientRole);
  if (!to.length) return;
  const what = [line.section, line.description].filter(Boolean).join(" - ");
  await queueProjectEmail({
    projectId,
    toOverride: to.join(", "),
    subject: kind === "submit" ? `Quality IR submitted: ${irNumber}` : `Quality IR needs client sign-off: ${irNumber}`,
    body: kind === "submit"
      ? `${irNumber} for ${what} is ready for SPDC inspection.`
      : `${irNumber} for ${what} is approved by SPDC and needs the client sign-off named on the QAP line.`,
    context: `quality-ir:${irNumber}:${kind}`,
  }).catch(() => undefined);
}

type RfiRow = {
  id: string;
  projectId: string;
  rfiKind: string;
  status: string;
  formDataJson: string | null;
  qapLineId: string | null;
  attachmentsJson: string | null;
  linkedAssignmentId: string | null;
  number: string;
  irNumber: string | null;
};

export async function applyQualityIrPatch(opts: {
  existing: RfiRow;
  user: UserLike;
  body: Record<string, unknown>;
}): Promise<{ error: string; status: number } | { formDataJson: string; nextStatus?: string; closed: boolean; notifyClient: boolean }> {
  const user = await loadUser(opts.user);
  const existing = opts.existing;
  const line = existing.qapLineId
    ? await prisma.qapLine.findFirst({ where: { id: existing.qapLineId, projectId: existing.projectId } })
    : null;
  const map = await assignments(existing.projectId);
  const form = parseForm(existing.formDataJson);
  const patch = opts.body.formPatch && typeof opts.body.formPatch === "object" ? (opts.body.formPatch as Record<string, unknown>) : {};
  const signUser = { id: user.id, role: user.role, vendorId: user.vendorId };
  const onBehalf = String(form.onBehalf || "") === "true";

  const wantsContractor = QUALITY_CONTRACTOR_PATCH_KEYS.some((k) => patch[k] !== undefined);
  const wantsSpdc = QUALITY_SPDC_PATCH_KEYS.some((k) => patch[k] !== undefined);
  const wantsClient = QUALITY_CLIENT_PATCH_KEYS.some((k) => patch[k] !== undefined);

  if (wantsContractor) {
    if (!line || !canEditDeclaration({ user: signUser, line, assignments: map, onBehalf })) {
      return { error: "SPDC cannot edit the contractor declaration.", status: 403 };
    }
    for (const k of QUALITY_CONTRACTOR_PATCH_KEYS) {
      if (patch[k] !== undefined) form[k] = patch[k];
    }
  }
  if (wantsClient) {
    if (!line) return { error: "This IR has no QAP line.", status: 400 };
    const gate = canClientSign({ user: signUser, line, assignments: map });
    if (!gate.ok) return { error: gate.error || "Client sign-off refused.", status: 403 };
    form.witnessedBy = user.fullName || user.email || "";
    form.witnessedAt = new Date().toISOString();
  }
  if (wantsSpdc) {
    if (!line) return { error: "This IR has no QAP line.", status: 400 };
    const settingResult = patch.result !== undefined || patch.observations !== undefined || patch.inspectedOn !== undefined || patch.ncrNo !== undefined;
    const closing = patch.closedBy !== undefined || patch.closedAt !== undefined;
    if (settingResult) {
      const gate = canSetResult({ user: signUser, line, assignments: map });
      if (!gate.ok) return { error: gate.error || "Result refused.", status: 403 };
    }
    if (closing && !canVerifyCloseout({ user: signUser, line, assignments: map })) {
      return { error: "Only the mapped SPDC user can close observations.", status: 403 };
    }
    if (patch.waivers !== undefined && user.role !== "admin" && !["office", "employee", "site_employee"].includes(user.role)) {
      return { error: "Only SPDC can waive a record.", status: 403 };
    }
    for (const k of QUALITY_SPDC_PATCH_KEYS) {
      if (k === "inspectedBy" || k === "inspectedAt") continue;
      if (patch[k] !== undefined) form[k] = patch[k];
    }
    if (patch.result !== undefined) {
      const code = resultCode(patch.result);
      if (!code) return { error: "Result must be A, B, C or D.", status: 400 };
      if (code === "D" && !String(patch.observations ?? form.observations ?? "").trim()) {
        return { error: "Result D needs the reason in observations.", status: 400 };
      }
      form.result = code;
      form.inspectedBy = user.fullName || user.email || "";
      form.inspectedAt = new Date().toISOString();
    }
  }

  const submitting = opts.body.submit === true || (opts.body.status === "Open" && existing.status === "Draft");
  if (submitting) {
    if (!line || !canEditDeclaration({ user: signUser, line, assignments: map, onBehalf })) {
      return { error: "Only the contractor can submit this IR.", status: 403 };
    }
    const check = checkQualitySubmit({
      line,
      form,
      submittedAt: new Date(),
      hasChecklist: !!existing.linkedAssignmentId,
      attachedRecordKeys: attachedKeys(existing.attachmentsJson),
      requiredRecordKeys: requiredEnclosures(line.records).map((e) => e.key),
    });
    if (!check.ok) return { error: check.error || "IR is not ready to submit.", status: 400 };
    if (check.shortNotice) form.shortNotice = "true";
  }

  let nextStatus: string | undefined;
  let closed = false;
  let notifyClient = false;
  const code = resultCode(form.result);
  if (code && line) {
    const openNcr = await prisma.qualityNcr.count({
      where: { projectId: existing.projectId, rfiId: existing.id, status: { notIn: ["Closed", "closed"] } },
    });
    const chainPrev = await prisma.rfi.findMany({
      where: { projectId: existing.projectId, OR: [{ id: existing.id }, { previousIrId: existing.id }] },
      select: { id: true },
    });
    const openOnChain = await prisma.qualityNcr.count({
      where: {
        projectId: existing.projectId,
        rfiId: { in: chainPrev.map((r) => r.id) },
        status: { notIn: ["Closed", "closed"] },
      },
    });
    const decision = decideQualityResult({ result: code, line, form, openNcr: openNcr + openOnChain > 0 && code === "A" });
    nextStatus = decision.status;
    closed = decision.closed;
    notifyClient = (code === "A" || code === "B") && decision.status === "Awaiting client";
  } else if (submitting) {
    nextStatus = "Open";
  }

  return { formDataJson: JSON.stringify(form), nextStatus, closed, notifyClient };
}

export async function createReoffer(opts: { projectId: string; rfiId: string; user: UserLike }) {
  const src = await prisma.rfi.findFirst({ where: { id: opts.rfiId, projectId: opts.projectId, rfiKind: "QualityIR" } });
  if (!src) return { error: "IR not found.", status: 404 as const };
  const form = parseForm(src.formDataJson);
  if (resultCode(form.result) !== "C") return { error: "Re-offer is only for a rejected IR.", status: 400 as const };
  const user = await loadUser(opts.user);
  const line = src.qapLineId ? await prisma.qapLine.findFirst({ where: { id: src.qapLineId } }) : null;
  const map = await assignments(opts.projectId);
  const gate = canRaiseQualityIr({
    user: { id: user.id, role: user.role, vendorId: user.vendorId },
    line,
    assignments: map,
    onBehalf: user.role !== "vendor",
  });
  if (!gate.ok) return { error: gate.error || "Not allowed.", status: 403 as const };
  const count = await prisma.rfi.count({ where: { projectId: opts.projectId } });
  const number = `IR-QA-${String(count + 1).padStart(3, "0")}`;
  const nextForm = {
    ...form,
    result: "",
    observations: "",
    inspectedBy: "",
    inspectedAt: "",
    witnessedBy: "",
    witnessedAt: "",
    actionTaken: "",
    closedBy: "",
    closedAt: "",
    previousIrNo: src.irNumber || src.number,
    declA: "",
    declB: "",
    declC: "",
    declD: "",
    declE: "",
    declF: "",
    declG: "",
  };
  const created = await prisma.rfi.create({
    data: {
      projectId: opts.projectId,
      number,
      subject: src.subject,
      question: src.question,
      rfiKind: "QualityIR",
      formDataJson: JSON.stringify(nextForm),
      status: "Draft",
      createdById: user.id,
      qapLineId: src.qapLineId,
      previousIrId: src.id,
      responsibleVendorId: src.responsibleVendorId,
      linkedAssignmentId: src.linkedAssignmentId,
      irNumber: null,
    },
  });
  return { rfi: created };
}
