import { prisma } from "../prisma.js";

export const STANDARD_COMMS_MATRIX_SPECS = [
  { communicationType: "RFI Update", fromRole: "office", toRole: "client", frequency: "As needed", channel: "RFI" },
  { communicationType: "RFI Update", fromRole: "office", toRole: "vendor", frequency: "As needed", channel: "RFI" },
  { communicationType: "RFI Update", fromRole: "office", toRole: "site_employee", frequency: "As needed", channel: "RFI" },
  { communicationType: "RFI Update", fromRole: "employee", toRole: "office", frequency: "As needed", channel: "RFI" },
  { communicationType: "Site Meeting", fromRole: "office", toRole: "client", frequency: "Weekly", channel: "Meeting" },
  { communicationType: "Site Meeting", fromRole: "office", toRole: "vendor", frequency: "Weekly", channel: "Meeting" },
  { communicationType: "Site Meeting", fromRole: "office", toRole: "site_employee", frequency: "Weekly", channel: "Meeting" },
  { communicationType: "Design Meeting", fromRole: "employee", toRole: "office", frequency: "Bi-weekly", channel: "Meeting" },
  { communicationType: "Design Meeting", fromRole: "office", toRole: "client", frequency: "Bi-weekly", channel: "Meeting" },
  { communicationType: "Checklist fill", fromRole: "office", toRole: "vendor", frequency: "As needed", channel: "RFI" },
  { communicationType: "Checklist fill", fromRole: "office", toRole: "site_employee", frequency: "As needed", channel: "RFI" },
] as const;

/** Seed Meeting + RFI matrix rows so respond/fill parties are defined (idempotent). */
export async function seedStandardCommsMatrix(projectId: string): Promise<number> {
  let created = 0;
  for (const s of STANDARD_COMMS_MATRIX_SPECS) {
    const exists = await prisma.communicationMatrix.findFirst({
      where: {
        projectId,
        communicationType: s.communicationType,
        fromRole: s.fromRole,
        toRole: s.toRole,
        channel: s.channel,
      },
    });
    if (exists) continue;
    await prisma.communicationMatrix.create({ data: { projectId, ...s, isActive: true } });
    created += 1;
  }
  return created;
}

const ARVIND_COMMS_SPECS = [
  { communicationType: "Technical query", fromRole: "vendor", toRole: "office", frequency: "As needed", channel: "Email" },
  { communicationType: "Drawing release", fromRole: "employee", toRole: "office", frequency: "As needed", channel: "Email" },
  { communicationType: "Drawing release", fromRole: "office", toRole: "vendor", frequency: "As needed", channel: "Email" },
  { communicationType: "Site instruction", fromRole: "office", toRole: "vendor", frequency: "Daily", channel: "Site" },
  { communicationType: "WPR / DPR", fromRole: "office", toRole: "client", frequency: "Weekly", channel: "Email" },
  { communicationType: "Hindrance / risk", fromRole: "office", toRole: "client", frequency: "Weekly", channel: "Email" },
  { communicationType: "Invoice / COP", fromRole: "vendor", toRole: "office", frequency: "Monthly", channel: "Email" },
  { communicationType: "Commercial / PR", fromRole: "office", toRole: "client", frequency: "As needed", channel: "Email" },
] as const;

/** Arvind / NTX site routing — same parties as the week dashboards. */
export async function seedArvindCommsMatrix(projectId: string): Promise<number> {
  const base = await seedStandardCommsMatrix(projectId);
  let extra = 0;
  for (const s of ARVIND_COMMS_SPECS) {
    const exists = await prisma.communicationMatrix.findFirst({
      where: {
        projectId,
        communicationType: s.communicationType,
        fromRole: s.fromRole,
        toRole: s.toRole,
        channel: s.channel,
      },
    });
    if (exists) continue;
    await prisma.communicationMatrix.create({ data: { projectId, ...s, isActive: true } });
    extra += 1;
  }
  return base + extra;
}
