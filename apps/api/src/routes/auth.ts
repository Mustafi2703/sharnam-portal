import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, signToken, toAuthUser, type AuthedRequest } from "../auth.js";
import { audit } from "../services/audit.js";
import {
  DEFAULT_ROLE_PERMISSIONS,
  portalForRole,
  type RoleKey,
} from "@sharnam/shared";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const { email, password, allowedRoles, portal } = req.body as {
    email?: string;
    password?: string;
    allowedRoles?: string[];
    portal?: string;
  };
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.isActive) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return res.status(403).json({
      error: `This account cannot sign in to the ${portal || "selected"} portal. Use the correct portal for your role.`,
    });
  }

  const authUser = toAuthUser(user);
  const token = signToken(authUser);
  await audit("login", { userId: user.id, meta: { portal: portal || "general" } });
  res.json({ token, user: authUser });
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: "Not found" });
  const roleDef = await prisma.roleDefinition.findUnique({ where: { key: user.role } });
  res.json({
    user: toAuthUser(user),
    permissions: roleDef ? JSON.parse(roleDef.permissions) : DEFAULT_ROLE_PERMISSIONS[user.role as RoleKey],
  });
});

export const rolesRouter = Router();

rolesRouter.use(requireAuth);

rolesRouter.get("/", async (_req, res) => {
  const roles = await prisma.roleDefinition.findMany({ orderBy: { key: "asc" } });
  res.json(
    roles.map((r) => ({
      ...r,
      permissions: JSON.parse(r.permissions),
    }))
  );
});

rolesRouter.put("/:key", requireRoles("admin"), async (req, res) => {
  const { label, portal, permissions } = req.body;
  const updated = await prisma.roleDefinition.update({
    where: { key: req.params.key },
    data: {
      ...(label ? { label } : {}),
      ...(portal ? { portal } : {}),
      ...(permissions ? { permissions: JSON.stringify(permissions) } : {}),
    },
  });
  await audit("role.update", { userId: (req as AuthedRequest).user?.id, entity: "RoleDefinition", entityId: updated.id });
  res.json({ ...updated, permissions: JSON.parse(updated.permissions) });
});

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get("/", requireRoles("admin", "office"), async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, fullName: true, role: true, portal: true, phone: true, isActive: true },
    orderBy: { fullName: "asc" },
  });
  res.json(users);
});

usersRouter.patch("/:id", requireRoles("admin"), async (req, res) => {
  const { role, portal, isActive, fullName, phone } = req.body;
  const data: Record<string, unknown> = {};
  if (role) {
    data.role = role;
    data.portal = portal || portalForRole(role as RoleKey);
  }
  if (portal) data.portal = portal;
  if (typeof isActive === "boolean") data.isActive = isActive;
  if (fullName) data.fullName = fullName;
  if (phone !== undefined) data.phone = phone;

  const user = await prisma.user.update({ where: { id: req.params.id }, data });
  await audit("user.update", { userId: (req as AuthedRequest).user?.id, entity: "User", entityId: user.id });
  res.json(toAuthUser(user));
});
