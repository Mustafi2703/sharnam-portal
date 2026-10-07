/**
 * Register header parties for a project — the project card first, then the project directory
 * (companies assigned on the project by party type). Used by client-format registers such as the
 * SPDC Cube Register header: Name of Project · Name of Client · Principal Consultant · PMC · Vendor.
 */
import { prisma } from "../prisma.js";

const SPDC = "Sharnam Project Development Consultants & Co. (SPDC)";

export async function projectParties(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true, location: true, clientName: true, designConsultant: true, pmcName: true, contractorName: true },
  });
  if (!project) return null;
  const links = await prisma.projectVendor.findMany({
    where: { projectId },
    include: { vendor: { select: { name: true, partyType: true, trade: true, isActive: true } } },
    orderBy: { createdAt: "asc" },
  });
  const of = (types: RegExp) =>
    links
      .filter((l) => l.vendor?.isActive !== false && types.test(String(l.vendor?.partyType || "")))
      .map((l) => l.vendor!.name)
      .filter((n, i, a) => n && a.indexOf(n) === i);
  const pick = (card: string | null | undefined, names: string[]) => (card && card.trim()) || names.join(", ");
  return {
    projectName: [project.name, project.location].filter(Boolean).join(" — "),
    client: pick(project.clientName, of(/client/i)),
    consultant: pick(project.designConsultant, of(/consultant/i)),
    pmc: pick(project.pmcName && !/^spdc$/i.test(project.pmcName) ? project.pmcName : null, of(/pmc/i)) || SPDC,
    vendor: pick(project.contractorName, of(/contractor|vendor/i)),
  };
}
