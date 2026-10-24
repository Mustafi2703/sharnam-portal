import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { AuthUser, RoleKey, PortalKey, ModuleKey, PermissionAction } from "@sharnam/shared";
import { DEFAULT_ROLE_PERMISSIONS, can } from "@sharnam/shared";
import { hrDeskApiAllowed, isHrDeskOnly } from "./services/hrDesk.js";
import { prisma } from "./prisma.js";

import { randomBytes } from "node:crypto";

let bootSecret = "";
/** Read at use time (route modules load before dotenv runs). Production never falls back to the public demo secret. */
function jwtSecret(): string {
  const configured = process.env.JWT_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    if (!bootSecret) {
      bootSecret = randomBytes(48).toString("hex");
      console.error("[auth] JWT_SECRET is not set: using a one-off secret, so logins reset on every restart. Set JWT_SECRET.");
    }
    return bootSecret;
  }
  return "sharnam-demo-jwt-secret";
}

export type AuthedRequest = Request & { user?: AuthUser };

export function signToken(user: AuthUser): string {
  return jwt.sign(user, jwtSecret(), { expiresIn: "7d" });
}

function tokenFromRequest(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  const q = req.query.token;
  if (typeof q === "string" && q.trim()) return q.trim();
  return null;
}

/** Client portal is read-only: the only writes are raising / answering RFIs and their own account. */
const CLIENT_WRITE_ALLOW: RegExp[] = [
  /^\/api\/rfis\/project\/[^/]+\/?$/, // raise an RFI / client concern
  /^\/api\/rfis\/[^/]+\/respond\/?$/, // answer an RFI where the client is on the matrix
  /^\/api\/auth\/(impersonate\/stop|logout)\/?$/,
  /^\/api\/users\/me(\/|$)/, // own profile / password
  /^\/api\/directory\/project\/[^/]+\/members\/[^/]+\/signature\/?$/, // own signature
  /^\/api\/notifications(\/|$)/,
  /^\/api\/checklist\/assignments\/[^/]+\/client-signature\/?$/, // sign a checklist SPDC sent
  /^\/api\/closure\/project\/[^/]+\/client-sign(off)?\/?/, // closure sign-off
  /^\/api\/(wpr|dpr)-maker\/[^/]+\/signature\/?$/, // sign the weekly / daily report pack
];

/** External consultants / stakeholders (employee login linked to a party): RFIs, design coordination, drawing review, meeting actions. */
const STAKEHOLDER_WRITE_ALLOW: RegExp[] = [
  ...CLIENT_WRITE_ALLOW,
  /^\/api\/rfis\/[^/]+\/?$/, // update / close an RFI on their matrix
  /^\/api\/directory\/project\/[^/]+\/coordination\/?$/,
  /^\/api\/directory\/coordination\/[^/]+(\/follow-up)?\/?$/,
  /^\/api\/drawings\/revision\/[^/]+\/markup-pages\/?$/,
  /^\/api\/drawings\/project\/[^/]+\/markups\/?$/, // branded markup PDF on an RFI / coordination issue they are answering
  /^\/api\/comms\/meetings\/[^/]+\/items\/?$/,
];

function stakeholderWriteAllowed(method: string, url: string): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) return true;
  const path = url.split("?")[0];
  return STAKEHOLDER_WRITE_ALLOW.some((re) => re.test(path));
}

function clientWriteAllowed(method: string, url: string): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) return true;
  const path = url.split("?")[0];
  return CLIENT_WRITE_ALLOW.some((re) => re.test(path));
}

type LiveAccount = { isActive: boolean; role: string; vendorId: string | null; at: number };
const LIVE_ACCOUNT_TTL_MS = 15_000;
const liveAccounts = new Map<string, LiveAccount>();

/**
 * The token is signed for 7 days, so re-read the account: a deactivated, removed or re-roled login
 * must stop working within seconds, not when its token runs out. Cached briefly per user.
 */
async function liveAccount(userId: string): Promise<LiveAccount | null> {
  const hit = liveAccounts.get(userId);
  if (hit && Date.now() - hit.at < LIVE_ACCOUNT_TTL_MS) return hit;
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true, role: true, vendorId: true },
  });
  if (!row) {
    liveAccounts.delete(userId);
    return null;
  }
  const live = { isActive: row.isActive !== false, role: row.role, vendorId: row.vendorId ?? null, at: Date.now() };
  liveAccounts.set(userId, live);
  return live;
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const raw = tokenFromRequest(req);
  if (!raw) return res.status(401).json({ error: "Unauthorized" });
  let user: AuthUser;
  try {
    user = jwt.verify(raw, jwtSecret()) as AuthUser;
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
  let live: LiveAccount | null;
  try {
    live = await liveAccount(user.id);
  } catch (err) {
    console.error("requireAuth account check failed:", err);
    return res.status(503).json({ error: "Database temporarily unavailable — please retry." });
  }
  if (!live || !live.isActive) {
    return res.status(401).json({ error: "This login is no longer active. Ask the Sharnam office if you still need access." });
  }
  if (live.role !== user.role) {
    return res.status(401).json({ error: "Your portal access changed. Sign in again." });
  }
  req.user = { ...user, vendorId: live.vendorId };
  if (req.user.role === "client" && !clientWriteAllowed(req.method, req.originalUrl)) {
    return res.status(403).json({ error: "Client logins are read-only. Raise an RFI or concern, or ask the Sharnam office to make the change." });
  }
  if (req.user.role === "employee" && req.user.vendorId && !stakeholderWriteAllowed(req.method, req.originalUrl)) {
    return res.status(403).json({ error: "Consultant logins can raise and answer RFIs, work on design coordination and review drawings. Ask the Sharnam office for other changes." });
  }
  if (isHrDeskOnly(req.user.email, req.user.role) && !hrDeskApiAllowed(req.originalUrl, req.method)) {
    return res.status(403).json({ error: "This login is HR portal only — people management." });
  }
  next();
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

export function toAuthUser(
  u: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    portal: string;
    vendorId?: string | null;
  },
  impersonatedBy?: { id: string; email: string; fullName: string } | null,
  joining?: { joiningOfferId?: string | null; preJoinComplete?: boolean } | null
): AuthUser {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role as RoleKey,
    portal: u.portal as PortalKey,
    vendorId: u.vendorId ?? null,
    hrDeskOnly: isHrDeskOnly(u.email, u.role),
    joiningOfferId: joining?.joiningOfferId ?? null,
    preJoinComplete: joining?.preJoinComplete ?? false,
    impersonatedBy: impersonatedBy
      ? { id: impersonatedBy.id, email: impersonatedBy.email, fullName: impersonatedBy.fullName }
      : null,
  };
}

/** New-joiner self-service portal removed — HR desk runs pre-joining. */
export async function joiningMetaForUser(_userId: string, _email: string) {
  return { joiningOfferId: null, preJoinComplete: false };
}
