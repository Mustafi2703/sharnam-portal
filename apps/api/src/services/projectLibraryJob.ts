import { prisma } from "../prisma.js";

const inflight = new Map<string, Promise<void>>();

/**
 * ISO folders, drawing registers, and the CRM won-project card.
 * Runs after the HTTP response so a new project does not sit on the 55s browser limit.
 */
export function queueProjectLibraryFinish(projectId: string) {
  const existing = inflight.get(projectId);
  if (existing) return existing;
  const task = (async () => {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, code: true } });
    if (!project) return;
    const { mockOneDrive } = await import("./mockOneDrive.js");
    await mockOneDrive.ensureProjectTree(project.id, { awaitSharePoint: true });
    const { publishDrawingRegistersToDrive } = await import("./drawingRegisterDrive.js");
    await publishDrawingRegistersToDrive(project.id).catch((err) =>
      console.warn("[sharepoint] registers:", err instanceof Error ? err.message : err),
    );
    const { fileWonProjectPack } = await import("./crmSharePoint.js");
    await fileWonProjectPack(project.id).catch((err) =>
      console.warn("[CRM] won folder:", err instanceof Error ? err.message : err),
    );
  })().finally(() => {
    inflight.delete(projectId);
  });
  inflight.set(projectId, task);
  return task;
}
