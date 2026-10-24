/**
 * SPDC/HSE/F-01 Safety IR → SPDC/HSE/F-03 activity checklist.
 * The high-risk activity on the IR picks the F-03 section. Clearance (S1/S2) waits until that checklist is submitted for this IR.
 */
import { prisma } from "../prisma.js";

const SECTION_RULES: { test: RegExp; section: string }[] = [
  { test: /scaffold/i, section: "Scaffold Erection" },
  { test: /confined/i, section: "Confined Space" },
  { test: /excav/i, section: "Excavation" },
  { test: /lift/i, section: "Lifting" },
  { test: /hot\s*work|weld|gas cut/i, section: "Hot Work" },
  { test: /height|lifeline|fragile/i, section: "Work at Height" },
  { test: /electr|loto|energis/i, section: "Electrical" },
];

export function safetyActivitySection(highRiskType: string): string {
  const text = String(highRiskType || "");
  return SECTION_RULES.find((rule) => rule.test.test(text))?.section || "";
}

function parseForm(raw: string | null | undefined): Record<string, unknown> {
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function f03Template() {
  return prisma.checklistTemplate.findFirst({
    where: {
      isActive: true,
      checklistType: "Safety",
      OR: [{ name: { contains: "F-03" } }, { name: { contains: "Activity-Specific" } }],
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
}

/** Assign F-03 on this project and store the activity section on the Safety IR. Keeps a checklist the user already linked. */
export async function attachSafetyActivityChecklist(projectId: string, rfiId: string) {
  const rfi = await prisma.rfi.findFirst({
    where: { id: rfiId, projectId, rfiKind: "SafetyIR" },
    select: { id: true, formDataJson: true, linkedAssignmentId: true, linkedChecklistItemId: true, subject: true },
  });
  if (!rfi) return null;
  const template = await f03Template();
  if (!template) return null;

  const form = parseForm(rfi.formDataJson);
  const section = safetyActivitySection(String(form.highRiskType || rfi.subject || ""));
  const assignment = await prisma.checklistAssignment.upsert({
    where: { projectId_templateId: { projectId, templateId: template.id } },
    create: { projectId, templateId: template.id },
    update: {},
    select: { id: true },
  });
  const linked = rfi.linkedAssignmentId || assignment.id;
  const nextForm = { ...form, activitySection: section, checklistRef: template.name };
  const updated = await prisma.rfi.update({
    where: { id: rfi.id },
    data: {
      linkedAssignmentId: linked,
      linkedChecklistItemId: rfi.linkedChecklistItemId || template.id,
      formDataJson: JSON.stringify(nextForm),
    },
    select: { formDataJson: true, linkedAssignmentId: true },
  });
  return {
    assignmentId: updated.linkedAssignmentId || linked,
    section,
    label: section || "F-03",
    formDataJson: updated.formDataJson || "",
  };
}

/** S1 and S2 clearance need a submitted F-03 fill stamped with this Safety IR number. */
export async function safetyClearanceChecklistError(projectId: string, rfiId: string, numbers: string[]) {
  const attached = await attachSafetyActivityChecklist(projectId, rfiId);
  if (!attached) return null;
  const needles = [...new Set(numbers.map((n) => String(n || "").trim()).filter(Boolean))];
  if (!needles.length) return "This Safety IR has no number, so the activity checklist cannot be matched.";
  const submitted = await prisma.checklistSubmission.count({
    where: {
      assignmentId: attached.assignmentId,
      status: "Submitted",
      OR: needles.map((needle) => ({ responsesJson: { contains: needle } })),
    },
  });
  if (submitted) return null;
  const which = attached.section ? ` (${attached.section})` : "";
  return `Fill and submit the activity checklist${which} for ${needles[0]} before this Safety IR can be cleared.`;
}
