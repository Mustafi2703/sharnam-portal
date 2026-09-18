import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, signToken, toAuthUser, joiningMetaForUser, type AuthedRequest } from "../auth.js";
import { audit } from "../services/audit.js";
import {
  DEFAULT_ROLE_PERMISSIONS,
  portalForRole,
  type RoleKey,
} from "@sharnam/shared";
import { isHrDeskOnly } from "../services/hrDesk.js";

export const authRouter = Router();

const DEFAULT_PORTAL_PASSWORD = "Demo@1234";

function defaultPasswords() {
  return [...new Set([DEFAULT_PORTAL_PASSWORD, process.env.SEED_PASSWORD].filter(Boolean) as string[])];
}

async function findUserByLoginEmail(email: string) {
  const lower = email.trim().toLowerCase();
  return (
    (await prisma.user.findUnique({ where: { email: lower } })) ||
    (await prisma.user.findFirst({ where: { email: lower } })) ||
    (await prisma.user.findFirst({ where: { email } }))
  );
}

async function findContractorByEmail(email: string) {
  const lower = email.trim().toLowerCase();
  const byPrimary = await prisma.vendor.findFirst({
    where: { email: { equals: lower }, isActive: true },
    select: { id: true, name: true, email: true, businessPhone: true, partyType: true },
  });
  if (byPrimary) return byPrimary;
  const contact = await prisma.vendorContact.findFirst({
    where: { email: lower },
    include: { vendor: { select: { id: true, name: true, email: true, businessPhone: true, partyType: true, isActive: true } } },
  });
  if (contact?.vendor?.isActive !== false) return contact?.vendor || null;
  return null;
}

function isContractorCompany(partyType?: string | null) {
  return !partyType || partyType === "Contractor" || partyType === "Vendor";
}

async function passwordMatches(plain: string, hash?: string | null) {
  if (!hash) return false;
  try {
    if (await bcrypt.compare(plain, hash)) return true;
  } catch {
    return false;
  }
  const aliases = defaultPasswords();
  if (!aliases.includes(plain)) return false;
  for (const alias of aliases) {
    if (alias === plain) continue;
    try {
      if (await bcrypt.compare(alias, hash)) return true;
    } catch {
      /* ignore bad hash */
    }
  }
  return false;
}

function loginPathForRole(role: string) {
  if (role === "vendor") return "/login/vendor";
  if (role === "client") return "/login/client";
  if (role === "site_employee") return "/login/site";
  if (role === "hr") return "/login/hr";
  if (role === "employee") return "/login/stakeholder";
  if (role === "admin" || role === "office") return "/login/office";
  return "/login";
}

authRouter.post("/login", async (req, res) => {
  const { email, password, allowedRoles, portal } = req.body as {
    email?: string;
    password?: string;
    allowedRoles?: string[];
    portal?: string;
  };
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  const lower = email.trim().toLowerCase();

  try {
    let user = await findUserByLoginEmail(lower);

    if (!user && portal === "vendor") {
      const company = await findContractorByEmail(lower);
      if (company && isContractorCompany(company.partyType)) {
        const { ensureVendorPortalLogin } = await import("../services/crmVendorCredentials.js");
        const login = await ensureVendorPortalLogin({
          email: lower,
          name: company.name,
          businessPhone: company.businessPhone,
          vendorId: company.id,
        });
        if (login) user = await prisma.user.findUnique({ where: { id: login.userId } });
      }
    }

    if (!user) {
      if (lower.endsWith("@sharnam.demo")) {
        return res.status(401).json({
          error:
            "Demo emails like vendor@sharnam.demo are not on this live portal. Sign in with the contractor email from Access users. First password is Demo@1234.",
        });
      }
      if (portal === "vendor") {
        return res.status(401).json({
          error:
            "No contractor login for this email. Use the email on the vendor / contractor in the project directory, or ask office to create it in Access users. First password is Demo@1234.",
        });
      }
      return res.status(401).json({ error: "No account for this email. Check the address or ask office to create the login." });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: "This login is inactive. Ask office to turn it back on in Access users." });
    }

    const ok = await passwordMatches(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({
        error:
          portal === "vendor"
            ? "Wrong password. First password is Demo@1234 unless Access users set a different one."
            : "Wrong password. Default first password is Demo@1234 unless it was changed.",
      });
    }

    if (isHrDeskOnly(user.email, user.role) && portal && portal !== "hr") {
      return res.status(403).json({
        error: "This account signs in only at the HR portal (people management): https://portal.spdc.in/login/hr",
      });
    }

    let roleAllowed = !Array.isArray(allowedRoles) || allowedRoles.length === 0 || allowedRoles.includes(user.role);
    if (!roleAllowed && portal === "vendor") {
      const company =
        (user.vendorId
          ? await prisma.vendor.findUnique({
              where: { id: user.vendorId },
              select: { id: true, partyType: true },
            })
          : null) || (await findContractorByEmail(user.email));
      if (company && isContractorCompany(company.partyType)) {
        roleAllowed = true;
        if (user.role !== "vendor" && user.role !== "admin" && user.role !== "office" && user.role !== "site_employee") {
          const { portalForRole: nextPortal } = await import("@sharnam/shared");
          user = await prisma.user.update({
            where: { id: user.id },
            data: { role: "vendor", portal: nextPortal("vendor"), vendorId: company.id },
          });
        }
      }
    }

    if (!roleAllowed) {
      return res.status(403).json({
        error: `This account signs in at ${loginPathForRole(user.role)}, not the ${portal || "selected"} portal.`,
      });
    }

    if (portal === "employee") {
      return res.status(403).json({
        error:
          "The new-joiner portal is retired. SPDC HR handles pre-joining and onboarding. Sign in at the HR desk if you are HR staff, or use Office / Site after HR issues your login.",
      });
    }

    if (portal === "vendor" && !user.vendorId) {
      const company = await findContractorByEmail(user.email);
      if (company) {
        user = await prisma.user.update({ where: { id: user.id }, data: { vendorId: company.id } });
      }
    }

    const joining = await joiningMetaForUser(user.id, user.email);
    const authUser = toAuthUser(user, undefined, joining);
    const token = signToken(authUser);
    await audit("login", { userId: user.id, meta: { portal: portal || "general" } });
    res.json({ token, user: authUser });
  } catch (err) {
    console.error("login error:", err);
    res.status(503).json({
      error: "Sign-in could not reach the database. Retry in a moment. If it keeps failing, Hostinger MySQL is down.",
    });
  }
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: "Not found" });
    const joining = await joiningMetaForUser(user.id, user.email);
    const roleDef = await prisma.roleDefinition.findUnique({ where: { key: user.role } });
    res.json({
      user: toAuthUser(user, req.user!.impersonatedBy, joining),
      permissions: roleDef ? JSON.parse(roleDef.permissions) : DEFAULT_ROLE_PERMISSIONS[user.role as RoleKey],
    });
  } catch (err) {
    console.error("auth/me error:", err);
    res.status(503).json({ error: "Database temporarily unavailable — please retry." });
  }
});

/**
 * Admin test mode — sign in as any login to walk that desk, then return.
 * The real admin is kept on the token so the session can always be handed back.
 */
async function resolveImpersonator(req: AuthedRequest) {
  const adminId = req.user?.impersonatedBy?.id || req.user?.id;
  if (!adminId) return null;
  const admin = await prisma.user.findUnique({ where: { id: adminId } });
  if (!admin || !admin.isActive || admin.role !== "admin") return null;
  return admin;
}

authRouter.post("/impersonate", requireAuth, async (req: AuthedRequest, res) => {
  const admin = await resolveImpersonator(req);
  if (!admin) {
    return res.status(403).json({ error: "Only an admin can sign in as another user." });
  }
  const userId = req.body?.userId ? String(req.body.userId) : "";
  const email = req.body?.email ? String(req.body.email).trim().toLowerCase() : "";
  if (!userId && !email) return res.status(400).json({ error: "userId or email required" });

  const target = userId
    ? await prisma.user.findUnique({ where: { id: userId } })
    : await prisma.user.findUnique({ where: { email } });
  if (!target) return res.status(404).json({ error: "No login for that user" });
  if (!target.isActive) return res.status(400).json({ error: "That login is inactive — activate it first." });
  if (target.id === admin.id) {
    return res.status(400).json({ error: "That is already your own account." });
  }

  const authUser = toAuthUser(target, admin);
  const token = signToken(authUser);
  await audit("auth.impersonate", {
    userId: admin.id,
    entity: "User",
    entityId: target.id,
    meta: { as: target.email, role: target.role },
  });
  res.json({ token, user: authUser, landingPath: loginPathForRole(target.role) });
});

authRouter.post("/impersonate/stop", requireAuth, async (req: AuthedRequest, res) => {
  if (!req.user?.impersonatedBy) {
    return res.status(400).json({ error: "This session is already your own account." });
  }
  const admin = await resolveImpersonator(req);
  if (!admin) return res.status(403).json({ error: "Original admin login is no longer active." });
  const authUser = toAuthUser(admin);
  const token = signToken(authUser);
  await audit("auth.impersonate.stop", {
    userId: admin.id,
    entity: "User",
    entityId: req.user.id,
    meta: { was: req.user.email },
  });
  res.json({ token, user: authUser });
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

usersRouter.get("/", requireRoles("admin", "office"), async (req, res) => {
  const kind = String(req.query.kind || "");
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      NOT: { email: { startsWith: "deleted." } },
      ...(kind === "staff"
        ? {
            OR: [
              { role: { in: ["admin", "office", "hr", "site_employee"] } },
              { role: "employee", vendorId: null },
            ],
          }
        : {}),
    },
    select: { id: true, email: true, fullName: true, role: true, portal: true, phone: true, isActive: true, vendorId: true },
    orderBy: { fullName: "asc" },
  });
  const { isHiddenPortalListUser } = await import("../services/keepPortalUsers.js");
  res.json(users.filter((u) => !isHiddenPortalListUser(u.email)));
});

usersRouter.patch("/:id", requireRoles("admin", "office"), async (req, res) => {
  const { role, portal, isActive, fullName, phone } = req.body;
  const data: Record<string, unknown> = {};
  const isOffice = (req as AuthedRequest).user?.role === "office";

  if (role && !isOffice) {
    data.role = role;
    data.portal = portal || portalForRole(role as RoleKey);
  }
  if (portal && !isOffice) data.portal = portal;
  if (typeof isActive === "boolean" && !isOffice) data.isActive = isActive;
  if (fullName) data.fullName = fullName;
  if (phone !== undefined) data.phone = phone;

  if (!Object.keys(data).length) {
    return res.status(400).json({ error: "Nothing to update" });
  }

  const user = await prisma.user.update({ where: { id: req.params.id }, data });
  await audit("user.update", { userId: (req as AuthedRequest).user?.id, entity: "User", entityId: user.id });
  res.json(toAuthUser(user));
});
