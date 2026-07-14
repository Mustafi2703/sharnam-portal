import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { AuthUser, RoleKey, PortalKey, ModuleKey, PermissionAction } from "@sharnam/shared";
import { DEFAULT_ROLE_PERMISSIONS, can } from "@sharnam/shared";

const JWT_SECRET = process.env.JWT_SECRET || "sharnam-demo-jwt-secret";

export type AuthedRequest = Request & { user?: AuthUser };

export function signToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as AuthUser;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireRoles(...roles: RoleKey[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (req.user.role === "admin" || roles.includes(req.user.role)) return next();
    return res.status(403).json({ error: "Forbidden" });
  };
}

/** Enforce module permission matrix (admin always allowed). */
export function requirePermission(module: ModuleKey, action: PermissionAction) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    if (req.user.role === "admin") return next();
    const perms = DEFAULT_ROLE_PERMISSIONS[req.user.role];
    if (can(perms, module, action)) return next();
    return res.status(403).json({ error: "Forbidden" });
  };
}

export function toAuthUser(u: {
  id: string;
  email: string;
  fullName: string;
  role: string;
  portal: string;
}): AuthUser {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role as RoleKey,
    portal: u.portal as PortalKey,
  };
}
