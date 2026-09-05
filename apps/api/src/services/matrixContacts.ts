import { prisma } from "../prisma.js";

export type MatrixEmailLists = {
  to: string[];
  cc: string[];
  all: string[];
  csv: string;
};

function normEmail(raw: string | null | undefined): string | null {
  const e = (raw || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/** All matrix contact emails for meetings / MoM / agenda (TO + CC, deduped). */
export async function getProjectMatrixEmails(
  projectId: string,
  matrixKind = "TECHNICAL"
): Promise<MatrixEmailLists> {
  const rows = await prisma.communicationContact.findMany({
    where: { projectId, matrixKind, isSectionHeader: false },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const to: string[] = [];
  const cc: string[] = [];
  for (const r of rows) {
    const email = normEmail(r.email);
    if (!email) continue;
    if (r.mailRole === "TO") to.push(email);
    else cc.push(email);
  }

  const all = Array.from(new Set([...to, ...cc]));
  return { to, cc, all, csv: all.join(", ") };
}

/** Prefer explicit override, then matrix, then project notification list. */
export async function resolveMeetingRecipients(
  projectId: string,
  override?: string | null
): Promise<{ csv: string; source: "override" | "matrix" | "project" | "none" }> {
  const trimmed = (override || "").trim();
  if (trimmed) return { csv: trimmed, source: "override" };

  const matrix = await getProjectMatrixEmails(projectId);
  if (matrix.all.length) return { csv: matrix.csv, source: "matrix" };

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { notificationEmails: true },
  });
  const projectCsv = (project?.notificationEmails || "").trim();
  if (projectCsv) return { csv: projectCsv, source: "project" };

  return { csv: "", source: "none" };
}
