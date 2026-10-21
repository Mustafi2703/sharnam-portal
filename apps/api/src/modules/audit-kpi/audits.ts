/**
 * Site audits are many per project. Checklist rows belong to one audit.
 */
import { prisma } from "../../prisma.js";
import { auditVerdict, findingTiming, findingsOpen, parseDetail, tallyScores, WALK_SECTIONS } from "./scoring.js";

export function isAuditClosed(status: string | null | undefined) {
  return (status || "").trim().toLowerCase() === "closed";
}

export async function nextAuditRef(projectId: string, code: string) {
  const rows = await prisma.siteAudit.findMany({ where: { projectId }, select: { auditRef: true } });
  let max = 0;
  for (const row of rows) {
    const match = String(row.auditRef || "").match(/(\d+)\s*$/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  const n = Math.max(max, rows.length) + 1;
  return `SA/${code}/${String(n).padStart(2, "0")}`;
}

/** Latest open audit, else the newest audit. Explicit ids must belong to the project. */
export async function resolveAudit(projectId: string, auditId?: string | null) {
  if (auditId) {
    return prisma.siteAudit.findFirst({ where: { id: auditId, projectId } });
  }
  const open = await prisma.siteAudit.findFirst({
    where: { projectId, NOT: { status: "Closed" } },
    orderBy: { createdAt: "desc" },
  });
  if (open) return open;
  return prisma.siteAudit.findFirst({ where: { projectId }, orderBy: { createdAt: "desc" } });
}

export async function countUnlinkedLowScores(siteAuditId: string) {
  const rows = await prisma.auditChecklistItem.findMany({
    where: { siteAuditId, section: { in: ["SiteWalk", "FolderSample"] }, score: { in: [0, 1] } },
    select: { detailJson: true },
  });
  return rows.filter((row) => !parseDetail(row.detailJson).findingRef).length;
}

export async function auditScoreFor(siteAuditId: string) {
  const [checklist, findings] = await Promise.all([
    prisma.auditChecklistItem.findMany({
      where: { siteAuditId, section: { in: ["SiteWalk", "FolderSample"] } },
      select: { section: true, itemNo: true, score: true, detailJson: true },
    }),
    prisma.auditFinding.findMany({
      where: { siteAuditId },
      select: { severity: true, status: true, findingNo: true },
    }),
  ]);
  const walk = checklist.filter((row) => row.section === "SiteWalk");
  const folders = checklist.filter((row) => row.section === "FolderSample");
  const walkTally = tallyScores(walk.map((row) => row.score));
  const folderTally = tallyScores(folders.map((row) => row.score));
  const combined = tallyScores([...walk.map((row) => row.score), ...folders.map((row) => row.score)]);
  const critical = findings.filter((row) => row.severity === "Critical").length;
  const unlinkedLow = checklist.filter((row) => (row.score === 0 || row.score === 1) && !parseDetail(row.detailJson).findingRef).length;
  const sections = WALK_SECTIONS.map((sec) => {
    const inBand = walk.filter((row) => row.itemNo >= sec.from && row.itemNo <= sec.to);
    const tally = tallyScores(inBand.map((row) => row.score));
    return { title: sec.title, checks: inBand.length, met: tally.met, notMet: tally.notMet, score: tally.score };
  });
  return {
    folders: folders.length,
    walkChecks: walk.length,
    scored: combined.scored,
    notMet: combined.notMet,
    overall: combined.score,
    critical,
    folderScore: folderTally.score,
    walkScore: walkTally.score,
    findingsRaised: findings.filter((row) => row.findingNo).length,
    findingsOpen: findingsOpen(findings.map((row) => row.status)),
    unlinkedLow,
    verdict: auditVerdict(combined.score, critical),
    sections,
  };
}

export async function listProjectAudits(projectId: string) {
  const [audits, checklist, findings] = await Promise.all([
    prisma.siteAudit.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    prisma.auditChecklistItem.findMany({
      where: { projectId, section: { in: ["SiteWalk", "FolderSample"] } },
      select: { siteAuditId: true, section: true, score: true },
    }),
    prisma.auditFinding.findMany({
      where: { projectId },
      select: { siteAuditId: true, severity: true, status: true, dueDate: true, closedAt: true },
    }),
  ]);
  return audits.map((audit) => {
    const rows = checklist.filter((row) => row.siteAuditId === audit.id);
    const found = findings.filter((row) => row.siteAuditId === audit.id);
    const combined = tallyScores(rows.map((row) => row.score));
    const critical = found.filter((row) => row.severity === "Critical").length;
    const openFindings = found.filter((row) => row.status === "Open" || row.status === "Under Rectification").length;
    return {
      ...audit,
      overall: combined.score,
      scored: combined.scored,
      critical,
      openFindings,
      verdict: auditVerdict(combined.score, critical),
    };
  });
}

export function presentFindingRow<T extends { dueDate: Date | null; closedAt: Date | null; status: string }>(row: T) {
  return { ...row, ...findingTiming(row) };
}
