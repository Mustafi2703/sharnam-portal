import { prisma } from "../prisma.js";

export function isUniqueConstraint(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002");
}

type ProjectCreateInput = {
  code: string;
  name: string;
  clientName?: string | null;
  location?: string | null;
  status?: string | null;
  clientContactName?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientAddress?: string | null;
  clientGst?: string | null;
  designConsultant?: string | null;
  contractorName?: string | null;
  pmcName?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  bidDisciplinesJson?: string | null;
  workPackages?: string | null;
};

/** Idempotent — never throw on an existing project code. */
export async function createOrReuseProject(data: ProjectCreateInput) {
  const code = String(data.code || "").trim();
  if (!code) throw new Error("code required");
  const existing = await prisma.project.findFirst({ where: { code } });
  if (existing) return { project: existing, created: false };

  try {
    const project = await prisma.project.create({
      data: {
        code,
        name: String(data.name || code).trim(),
        clientName: data.clientName || null,
        location: data.location || null,
        status: data.status || "Planning",
        clientContactName: data.clientContactName || null,
        clientEmail: data.clientEmail || null,
        clientPhone: data.clientPhone || null,
        clientAddress: data.clientAddress || null,
        clientGst: data.clientGst || null,
        designConsultant: data.designConsultant || null,
        contractorName: data.contractorName || null,
        pmcName: data.pmcName || "SPDC",
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        emailEnabled: false,
        ...(data.bidDisciplinesJson ? { bidDisciplinesJson: data.bidDisciplinesJson } : {}),
        ...(data.workPackages ? { workPackages: data.workPackages } : {}),
      },
    });
    return { project, created: true };
  } catch (err) {
    if (isUniqueConstraint(err)) {
      const again = await prisma.project.findFirst({ where: { code } });
      if (again) return { project: again, created: false };
    }
    throw err;
  }
}
