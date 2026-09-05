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
