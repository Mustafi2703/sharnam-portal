/**
 * Photos + site-instruction docs on Quality/Safety IRs → SharePoint Evidence folder,
 * and optional log into Site Observation / Site Instruction registers.
 */
import { prisma } from "../prisma.js";
import { mockOneDrive } from "./mockOneDrive.js";
import { MODULE_TO_ISO_FOLDER } from "./graph.js";

export type IrAttachment = {
  url: string;
  sharePointUrl?: string | null;
  name: string;
  kind: "photo" | "doc" | "site_instruction";
  uploadedAt: string;
  uploadedBy?: string | null;
};

const IR_KINDS = new Set(["QualityIR", "SafetyIR", "ActivityInspection", "QualityInspection", "SafetyChecklist"]);

export function isInspectionRfiKind(kind: string | null | undefined) {
  return IR_KINDS.has(String(kind || ""));
}

export function parseIrAttachments(raw: string | null | undefined): IrAttachment[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x === "object" && (x.url || x.sharePointUrl))
      .map((x) => ({
        url: String(x.url || x.sharePointUrl || ""),
        sharePointUrl: x.sharePointUrl ? String(x.sharePointUrl) : null,
        name: String(x.name || "file"),
        kind: (x.kind === "doc" || x.kind === "site_instruction" ? x.kind : "photo") as IrAttachment["kind"],
        uploadedAt: String(x.uploadedAt || new Date().toISOString()),
        uploadedBy: x.uploadedBy ? String(x.uploadedBy) : null,
      }));
  } catch {
    return [];
  }
}

function evidenceFolder(rfiKind: string, rfiNumber: string, closed: boolean) {
  const root = rfiKind === "SafetyIR" || rfiKind === "SafetyChecklist" ? MODULE_TO_ISO_FOLDER.safety : MODULE_TO_ISO_FOLDER.qualityChecklist;
  const safeNo = String(rfiNumber || "IR").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 48);
  return `${root}/Inspection_Requests/${closed ? "Closed" : "Open"}/${safeNo}/Evidence`;
}

export async function addIrAttachments(opts: {
  rfiId: string;
  userId: string;
  userName?: string | null;
  files: { buffer: Buffer; originalname: string; mimetype?: string; fieldname?: string }[];
  kindHint?: "photo" | "doc" | "site_instruction";
}) {
  const rfi = await prisma.rfi.findUnique({ where: { id: opts.rfiId } });
  if (!rfi) throw new Error("Inspection request not found");
  if (!isInspectionRfiKind(rfi.rfiKind)) throw new Error("Attachments are for Quality / Safety inspection requests only.");
  const project = await prisma.project.findUnique({ where: { id: rfi.projectId }, select: { code: true } });
  if (!project) throw new Error("Project not found");

  const existing = parseIrAttachments(rfi.attachmentsJson);
  const closed = /closed|approved|rejected/i.test(rfi.status);
  const folder = evidenceFolder(rfi.rfiKind, rfi.irNumber || rfi.number, closed);
  const added: IrAttachment[] = [];

  for (const f of opts.files.slice(0, 12)) {
    const isImage = /^image\//i.test(f.mimetype || "") || /\.(jpe?g|png|gif|webp|heic)$/i.test(f.originalname);
    const field = String(f.fieldname || "");
    const kind: IrAttachment["kind"] =
      opts.kindHint ||
      (/site.?instruction|si_doc/i.test(field) ? "site_instruction" : isImage ? "photo" : "doc");
    const safe = f.originalname.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
    const name = `${Date.now()}-${kind}-${safe}`;
    const saved = await mockOneDrive.upload(
      project.code,
      folder,
      name,
      f.buffer,
      f.mimetype || (isImage ? "image/jpeg" : "application/octet-stream"),
    );
    added.push({
      url: saved.url,
      sharePointUrl: saved.sharePointUrl || null,
      name: f.originalname,
      kind,
      uploadedAt: new Date().toISOString(),
      uploadedBy: opts.userName || null,
    });
  }

  const next = [...existing, ...added].slice(-40);
  const updated = await prisma.rfi.update({
    where: { id: rfi.id },
    data: { attachmentsJson: JSON.stringify(next) },
  });
  return { rfi: updated, attachments: next, added, folder };
}

function formBits(rfi: { formDataJson?: string | null; subject?: string; question?: string | null }) {
  let form: Record<string, string> = {};
  try {
    form = rfi.formDataJson ? JSON.parse(rfi.formDataJson) : {};
  } catch {
    form = {};
  }
  return {
    location: form.location || form.workLocation || form.area || "",
    activity: form.activityDescription || form.activity || rfi.subject || "",
    actionRequired: form.actionRequired || "",
    clearance: form.clearanceResult || "",
    form,
  };
}

/** Create Site Observation / Site Instruction register row from an IR (Quality SOR or Safety). */
export async function logIrToSiteRegister(opts: {
  rfiId: string;
  userId: string;
  recordType: "Site Observation" | "Site Instruction";
  title?: string;
  description?: string;
  includeAttachments?: boolean;
}) {
  const rfi = await prisma.rfi.findUnique({
    where: { id: opts.rfiId },
    include: { assignedTo: { select: { fullName: true } } },
  });
  if (!rfi) throw new Error("Inspection request not found");
  if (!isInspectionRfiKind(rfi.rfiKind)) throw new Error("Only inspection requests can log to SI / SO registers.");

  const bits = formBits(rfi);
  const att = parseIrAttachments(rfi.attachmentsJson);
  const attachLines =
    opts.includeAttachments !== false && att.length
      ? "\n\nEvidence:\n" +
        att
          .map((a) => `- ${a.kind}: ${a.name}${a.sharePointUrl ? ` — ${a.sharePointUrl}` : a.url ? ` — ${a.url}` : ""}`)
          .join("\n")
      : "";
  const title =
    opts.title?.trim() ||
    `${opts.recordType} from ${rfi.irNumber || rfi.number} — ${bits.activity || rfi.subject}`.slice(0, 200);
  const description = (
    opts.description?.trim() ||
    [
      `Linked IR: ${rfi.irNumber || rfi.number}`,
      bits.activity ? `Activity: ${bits.activity}` : "",
      bits.clearance ? `Clearance / result: ${bits.clearance}` : "",
      bits.actionRequired ? `Action required: ${bits.actionRequired}` : "",
      rfi.question ? String(rfi.question).slice(0, 1200) : "",
      attachLines,
    ]
      .filter(Boolean)
      .join("\n")
  ).slice(0, 4000);

  const isSafety = rfi.rfiKind === "SafetyIR" || rfi.rfiKind === "SafetyChecklist";
  const source = `IR:${rfi.number}`;

  if (isSafety) {
    const row = await prisma.safetyRecord.create({
      data: {
        projectId: rfi.projectId,
        // Site Instruction sheet filters on exact type; observations use Observation + IR source.
        recordType: opts.recordType === "Site Instruction" ? "Site Instruction" : "Observation",
        title,
        description,
        location: bits.location || null,
        severity: /critical|high/i.test(bits.clearance) ? "High" : "Medium",
        status: "Open",
        correctiveAction: bits.actionRequired || null,
        issuedTo: rfi.assignedTo?.fullName || null,
        source,
        reportedById: opts.userId,
        occurredAt: new Date(),
      },
    });
    return { register: "safety", record: row };
  }

  const photosJson =
    opts.includeAttachments !== false
      ? JSON.stringify(
          att
            .filter((a) => a.kind === "photo")
            .slice(-12)
            .map((a) => ({ url: a.url, sharePointUrl: a.sharePointUrl, name: a.name })),
        )
      : null;

  const row = await prisma.qualitySiteRecord.create({
    data: {
      projectId: rfi.projectId,
      recordType: opts.recordType,
      title,
      description,
      location: bits.location || null,
      severity: "Medium",
      status: "Open",
      issuedTo: rfi.assignedTo?.fullName || null,
      correctiveAction: bits.actionRequired || null,
      reportedById: opts.userId,
      source,
      photosJson,
    },
  });
  return { register: "quality", record: row };
}
