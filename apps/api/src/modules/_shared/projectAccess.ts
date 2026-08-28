import type { Response } from "express";
import { prisma } from "../../prisma.js";
import type { AuthedRequest } from "../../auth.js";

/** Admin/office see every project; other roles only their memberships. */
export async function userCanAccessProject(req: AuthedRequest, projectId: string): Promise<boolean> {
  const user = req.user;
  if (!user || !projectId) return false;
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) return false;
  if (user.role === "admin" || user.role === "office") return true;
  const member = await prisma.projectMember.findFirst({
    where: { projectId, userId: user.id },
    select: { id: true },
  });
  return Boolean(member);
}

/** Express param / guard — 404 rather than 403 so project ids are not confirmed to outsiders. */
export async function requireProjectAccess(req: AuthedRequest, res: Response, projectId: string): Promise<boolean> {
  const ok = await userCanAccessProject(req, projectId);
  if (!ok) {
    res.status(404).json({ error: "Not found" });
    return false;
  }
  return true;
}
