import { Router } from "express";
import { guardProjectParam } from "../modules/_shared/projectAccess.js";
import multer from "multer";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { audit } from "../services/audit.js";
import { mockOneDrive } from "../services/mockOneDrive.js";
import { MODULE_TO_ISO_FOLDER } from "../services/graph.js";
import { isChecklistFillRfiKind } from "../services/ensureFillRequestDraft.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const CONSULTANT_PARTY_TYPES = ["Consultant", "PMC", "Designer"] as const;

function vendorDesk(partyType: string) {
  if (partyType === "Client") return "client";
  if ((CONSULTANT_PARTY_TYPES as readonly string[]).includes(partyType)) return "consultant";
  return "vendor";
}

function vendorDeskLabel(partyType: string) {
  if (vendorDesk(partyType) === "client") return "Clients";
  if (vendorDesk(partyType) === "consultant") return "Consultants";
  return "Vendors / contractors";
}

function partyTypeWhere(partyType?: string) {
  if (!partyType) return {};
  const requested = partyType.split(",").map((s) => s.trim()).filter(Boolean);
  const expanded = requested.flatMap((t) => (t === "Contractor" || t === "Vendor" ? ["Contractor", "Vendor"] : [t]));
  const unique = [...new Set(expanded)];
  if (!unique.length) return {};
  return { partyType: unique.length === 1 ? unique[0] : { in: unique } };
}

export const vendorsRouter = Router();

/** Public read — consultant type labels for directory dropdowns (no auth needed). */
vendorsRouter.get("/consultant-types", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const { getConsultantTypes, DEFAULT_CONSULTANT_TYPES } = await import("../services/consultantTypeCatalog.js");
    const types = await getConsultantTypes();
    res.json({ types: types.length ? types : [...DEFAULT_CONSULTANT_TYPES] });
  } catch {
    const { DEFAULT_CONSULTANT_TYPES } = await import("../services/consultantTypeCatalog.js");
    res.json({ types: [...DEFAULT_CONSULTANT_TYPES] });
  }
});

vendorsRouter.use(requireAuth);
guardProjectParam(vendorsRouter);

vendorsRouter.get("/", async (req: AuthedRequest, res) => {
  const role = req.user?.role;
  if (role === "client") return res.json([]);
  if (role === "vendor") {
    const { resolveVendorForUser } = await import("../services/vendorPortal.js");
    const mine = await resolveVendorForUser(req.user!);
    return res.json(mine ? [mine] : []);
  }
  const partyType = typeof req.query.partyType === "string" ? req.query.partyType : undefined;
  const vendors = await prisma.vendor.findMany({
    where: {
      isActive: true,
      ...partyTypeWhere(partyType),
    },
    include: { _count: { select: { projects: true } } },
    orderBy: [{ partyType: "asc" }, { name: "asc" }],
  });
  const emails = vendors.map((v) => v.email).filter(Boolean) as string[];
  const portalUsers = emails.length
    ? await prisma.user.findMany({
        where: { email: { in: emails.map((e) => e.toLowerCase()) } },
        select: { email: true },
      })
    : [];
  const activeEmails = new Set(portalUsers.map((u) => u.email.toLowerCase()));
  res.json(
    vendors.map((v) => ({
      ...v,
      portalLoginActive: Boolean(v.email && activeEmails.has(v.email.toLowerCase())),
    })),
  );
});

vendorsRouter.post("/consultant-types", requireRoles("admin", "office"), async (req, res) => {
  const { addConsultantType } = await import("../services/consultantTypeCatalog.js");
  try {
    res.status(201).json({ types: await addConsultantType(String(req.body?.name || req.body?.type || "")) });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Could not add type" });
  }
});

vendorsRouter.patch("/consultant-types", requireRoles("admin", "office"), async (req, res) => {
  const { renameConsultantType } = await import("../services/consultantTypeCatalog.js");
  try {
    res.json({
      types: await renameConsultantType(String(req.body?.from || ""), String(req.body?.to || req.body?.name || "")),
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Could not rename type" });
  }
});

vendorsRouter.delete("/consultant-types", requireRoles("admin", "office"), async (req, res) => {
  const { removeConsultantType } = await import("../services/consultantTypeCatalog.js");
  try {
    res.json({ types: await removeConsultantType(String(req.body?.name || req.query.name || "")) });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Could not delete type" });
  }
});

vendorsRouter.post("/", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const rawParty = String(req.body.partyType || "");
  const partyType = rawParty === "Vendor" || rawParty === "Contractor"
    ? "Contractor"
    : ["Client", "Consultant", "PMC", "Designer"].includes(rawParty)
      ? rawParty
      : "Contractor";
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Company name required" });
  const email = req.body.email ? String(req.body.email).trim().toLowerCase() : "";
  const data = {
    name,
    partyType,
    trade: req.body.trade,
    address: req.body.address,
    city: req.body.city,
    state: req.body.state,
    country: req.body.country || "India",
    businessPhone: req.body.businessPhone,
    email: email || req.body.email || null,
    website: req.body.website,
    primaryContactName: req.body.primaryContactName,
    licenseNumber: req.body.licenseNumber,
    gstNumber: req.body.gstNumber,
    isUnionMember: !!req.body.isUnionMember,
    isPrequalified: !!req.body.isPrequalified,
    isMinorityOwned: !!req.body.isMinorityOwned,
    isWomenOwned: !!req.body.isWomenOwned,
    insuranceVerified: !!req.body.insuranceVerified,
    notes: req.body.notes,
    isActive: true,
  };
  const existing = email
    ? await prisma.vendor.findFirst({ where: { email } })
    : await prisma.vendor.findFirst({ where: { name, partyType } });
  if (existing && vendorDesk(existing.partyType) !== vendorDesk(partyType)) {
    return res.status(409).json({
      error: `${existing.name} is already on CRM → ${vendorDeskLabel(existing.partyType)}. Open that list to edit — this desk is only for ${vendorDeskLabel(partyType)}.`,
    });
  }
  const v = existing
    ? await prisma.vendor.update({ where: { id: existing.id }, data })
    : await prisma.vendor.create({ data: { ...data, createdVia: "Manual" } });
  await audit(existing ? "vendor.update" : "vendor.create", { userId: req.user!.id, entity: "Vendor", entityId: v.id });

  let login = null;
  let loginError: string | undefined;
  const shouldLogin = email && (req.body.createLogin === true || req.body.activatePortal === true);
  if (shouldLogin) {
    const { syncDirectoryPortalLogin } = await import("../services/crmVendorCredentials.js");
    const sync = await syncDirectoryPortalLogin({
      vendor: v,
      password: req.body.password ? String(req.body.password) : null,
    });
    if (sync && "error" in sync) loginError = sync.error;
    else login = sync;
  }
  res.status(existing ? 200 : 201).json({ ...v, login, loginError });
});

/** Seed global bidder catalog — one vendor per R2 BOQ discipline package (idempotent). */
vendorsRouter.post("/seed-bid-catalog", requireRoles("admin", "office"), async (_req: AuthedRequest, res) => {
  const { seedBidVendorCatalog } = await import("../services/crmVendorCatalog.js");
  const out = await seedBidVendorCatalog(prisma);
  res.json({ ok: true, ...out });
});

function vendorPatchFromBody(body: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  const pick = (key: string, transform?: (v: unknown) => unknown) => {
    if (body[key] === undefined) return;
    patch[key] = transform ? transform(body[key]) : body[key];
  };
  pick("name", (v) => String(v ?? "").trim());
  pick("partyType");
  pick("trade", (v) => (v == null ? null : String(v).trim()));
  pick("address", (v) => (v == null ? null : String(v).trim()));
  pick("city", (v) => (v == null ? null : String(v).trim()));
  pick("state", (v) => (v == null ? null : String(v).trim()));
  pick("country", (v) => (v == null ? null : String(v).trim()));
  pick("businessPhone", (v) => (v == null ? null : String(v).trim()));
  pick("email", (v) => {
    const s = String(v ?? "").trim();
    return s ? s.toLowerCase() : null;
  });
  pick("website", (v) => (v == null ? null : String(v).trim()));
  pick("primaryContactName", (v) => (v == null ? null : String(v).trim()));
  pick("licenseNumber", (v) => (v == null ? null : String(v).trim()));
  pick("gstNumber", (v) => (v == null ? null : String(v).trim()));
  pick("notes", (v) => (v == null ? null : String(v).trim()));
  pick("isUnionMember", (v) => (v === undefined ? undefined : !!v));
  pick("isPrequalified", (v) => (v === undefined ? undefined : !!v));
  pick("isMinorityOwned", (v) => (v === undefined ? undefined : !!v));
  pick("isWomenOwned", (v) => (v === undefined ? undefined : !!v));
  pick("insuranceVerified", (v) => (v === undefined ? undefined : !!v));
  pick("isActive", (v) => (v === undefined ? undefined : !!v));
  return patch;
}

vendorsRouter.patch("/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const current = await prisma.vendor.findUnique({ where: { id: req.params.id } });
  if (!current) return res.status(404).json({ error: "Company not found" });
  const password = req.body.password ? String(req.body.password) : null;
  const activatePortal = req.body.activatePortal === true;
  const data = vendorPatchFromBody(req.body as Record<string, unknown>);
  if (data.partyType === "Vendor") data.partyType = "Contractor";
  if (data.name !== undefined && !String(data.name).trim()) {
    return res.status(400).json({ error: "Company name is required" });
  }
  if (data.partyType && vendorDesk(String(current.partyType)) !== vendorDesk(String(data.partyType))) {
    return res.status(409).json({
      error: `${current.name} is on CRM → ${vendorDeskLabel(current.partyType)}. Open that list to edit — party type cannot jump desks.`,
    });
  }
  const v = await prisma.vendor.update({ where: { id: req.params.id }, data });
  let login = null;
  let loginError: string | undefined;
  let projectsSynced = 0;
  if (v.email && (password || activatePortal)) {
    const { syncDirectoryPortalLogin } = await import("../services/crmVendorCredentials.js");
    const sync = await syncDirectoryPortalLogin({
      vendor: v,
      password,
    });
    if (sync && "error" in sync) loginError = sync.error;
    else login = sync;
  }
  if (v.partyType === "Client") {
    const { syncClientVendorToLinkedProjects } = await import("../services/crmVendorCredentials.js");
    projectsSynced = await syncClientVendorToLinkedProjects(v);
  }
  res.json({ ...v, login, loginError, projectsSynced });
});

/** Client representatives only — not vendor/contractor logins (those use primary email on the company card). */
const DIRECTORY_CONTACT_PARTY_TYPES = ["Client", "Contractor", "Vendor", "Consultant", "PMC", "Designer"] as const;

async function loadCompanyForContacts(vendorId: string) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true, name: true, partyType: true, email: true, isActive: true, trade: true },
  });
  if (!vendor || vendor.isActive === false) return { error: "not_found" as const };
  if (!(DIRECTORY_CONTACT_PARTY_TYPES as readonly string[]).includes(vendor.partyType)) {
    return {
      error: "unsupported" as const,
      message: "Portal users can only be added for clients, vendors/contractors, or consultants in the CRM directory.",
    };
  }
  return { vendor };
}

function deskLabel(partyType: string): string {
  if (partyType === "Client") return "client";
  if (partyType === "Consultant" || partyType === "Designer" || partyType === "PMC") return "consultant";
  return "vendor / contractor";
}

/** Additional portal users for a CRM directory company (client / vendor / consultant — separate roles). */
vendorsRouter.get("/:id/contacts", requireRoles("admin", "office"), async (req, res) => {
  const loaded = await loadCompanyForContacts(req.params.id);
  if (loaded.error === "not_found") return res.status(404).json({ error: "Company not found" });
  if (loaded.error === "unsupported") return res.status(400).json({ error: loaded.message });
  const { portalRoleForPartyType } = await import("../services/crmVendorCredentials.js");
  const portalRole = portalRoleForPartyType(loaded.vendor.partyType);
  const stored = await prisma.vendorContact.findMany({
    where: { vendorId: req.params.id },
    orderBy: { createdAt: "asc" },
  });
  const primaryEmail = (loaded.vendor.email || "").trim().toLowerCase();
  const rows =
    primaryEmail && !stored.some((r) => r.email.toLowerCase() === primaryEmail)
      ? [
          {
            id: `primary-${loaded.vendor.id}`,
            vendorId: loaded.vendor.id,
            email: primaryEmail,
            fullName: null as string | null,
            role: "Primary contact",
            createdAt: new Date(0),
            updatedAt: new Date(0),
          },
          ...stored,
        ]
      : stored;
  const emails = rows.map((r) => r.email.toLowerCase());
  const users = emails.length
    ? await prisma.user.findMany({
        where: {
          email: { in: emails },
          role: portalRole,
          isActive: { not: false },
        },
        select: { email: true, vendorId: true },
      })
    : [];
  const active = new Set(users.map((u) => u.email.toLowerCase()));
  res.json(rows.map((r) => ({ ...r, portalActive: active.has(r.email.toLowerCase()) })));
});

vendorsRouter.post("/:id/contacts", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  try {
    const loaded = await loadCompanyForContacts(req.params.id);
    if (loaded.error === "not_found") return res.status(404).json({ error: "Company not found" });
    if (loaded.error === "unsupported") return res.status(400).json({ error: loaded.message });
    const vendor = loaded.vendor;

    const email = String(req.body.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "Email is required." });
    const fullName = req.body.fullName ? String(req.body.fullName).trim() : null;
    const role = req.body.role ? String(req.body.role).trim() : null;

    const { portalRoleForPartyType } = await import("../services/crmVendorCredentials.js");
    const expectedRole = portalRoleForPartyType(vendor.partyType);

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser && (existingUser.role === "office" || existingUser.role === "admin" || existingUser.role === "hr")) {
      return res.status(409).json({
        error: "This email is an SPDC office login. Use the person's company email instead.",
      });
    }
    if (existingUser && existingUser.role !== expectedRole) {
      return res.status(409).json({
        error: `This email is already a different portal type (${existingUser.role}). Each login is either client, vendor, or consultant — use a separate email.`,
      });
    }

    const onThisCompany = await prisma.vendorContact.findFirst({
      where: { vendorId: vendor.id, email },
    });
    if (onThisCompany) {
      const row = await prisma.vendorContact.update({
        where: { id: onThisCompany.id },
        data: {
          ...(fullName ? { fullName } : {}),
          ...(role ? { role } : {}),
        },
      });
      return res.status(200).json(row);
    }

    const otherRep = await prisma.vendorContact.findUnique({ where: { email } });
    if (otherRep) {
      const otherCo = await prisma.vendor.findUnique({
        where: { id: otherRep.vendorId },
        select: { name: true, partyType: true },
      });
      return res.status(409).json({
        error: `This email is already added for ${deskLabel(otherCo?.partyType || "")} “${otherCo?.name || "another company"}”. Use a different email or remove them there first.`,
      });
    }

    const otherCompanyEmail = await prisma.vendor.findFirst({
      where: {
        email,
        NOT: { id: vendor.id },
      },
      select: { name: true, partyType: true },
    });
    if (otherCompanyEmail) {
      return res.status(409).json({
        error: `This email is the primary login for ${deskLabel(otherCompanyEmail.partyType)} “${otherCompanyEmail.name}”. Additional users need their own email.`,
      });
    }

    const row = await prisma.vendorContact.create({
      data: {
        vendorId: vendor.id,
        email,
        fullName,
        role,
      },
    });
    await audit("vendor.contact.create", { userId: req.user!.id, entity: "VendorContact", entityId: row.id });
    res.status(201).json(row);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(409).json({
        error: "This email is already used for someone else in the directory. Each person needs a unique email.",
      });
    }
    console.error("[vendor contact create]", err);
    return res.status(500).json({ error: err instanceof Error ? err.message : "Could not add person" });
  }
});

vendorsRouter.patch("/:id/contacts/:contactId", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  try {
    const loaded = await loadCompanyForContacts(req.params.id);
    if (loaded.error === "not_found") return res.status(404).json({ error: "Company not found" });
    if (loaded.error === "unsupported") return res.status(400).json({ error: loaded.message });

    const existing = await prisma.vendorContact.findFirst({
      where: { id: req.params.contactId, vendorId: req.params.id },
    });
    const vendorRow = await prisma.vendor.findUnique({
      where: { id: req.params.id },
      select: { id: true, email: true, primaryContactName: true },
    });
    let target = existing;
    if (!target && req.params.contactId.startsWith("primary-") && vendorRow?.email) {
      const email = vendorRow.email.trim().toLowerCase();
      const taken = await prisma.vendorContact.findUnique({ where: { email } });
      if (taken && taken.vendorId !== vendorRow.id) {
        return res.status(409).json({ error: "This email is already a representative on another company." });
      }
      target =
        taken ||
        (await prisma.vendorContact.create({
          data: {
            vendorId: vendorRow.id,
            email,
            fullName: vendorRow.primaryContactName,
            role: "Primary contact",
          },
        }));
    }
    if (!target) return res.status(404).json({ error: "Representative not found" });
    const nextEmail = req.body.email !== undefined ? String(req.body.email).trim().toLowerCase() : target.email;
    const nextName =
      req.body.fullName !== undefined ? (req.body.fullName ? String(req.body.fullName).trim() : null) : target.fullName;
    const row = await prisma.vendorContact.update({
      where: { id: target.id },
      data: {
        ...(req.body.email !== undefined ? { email: nextEmail } : {}),
        ...(req.body.fullName !== undefined ? { fullName: nextName } : {}),
        ...(req.body.role !== undefined ? { role: req.body.role ? String(req.body.role).trim() : null } : {}),
      },
    });
    if (vendorRow && target.email === (vendorRow.email || "").trim().toLowerCase()) {
      await prisma.vendor.update({
        where: { id: vendorRow.id },
        data: {
          ...(req.body.fullName !== undefined ? { primaryContactName: nextName } : {}),
          ...(req.body.email !== undefined ? { email: nextEmail } : {}),
        },
      });
    }
    if (nextName) {
      await prisma.user.updateMany({
        where: { email: { in: [target.email, row.email] }, vendorId: req.params.id },
        data: { fullName: nextName, ...(row.email !== target.email ? { email: row.email } : {}) },
      });
    }
    res.json(row);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(409).json({ error: "That email is already used for another client representative." });
    }
    return res.status(500).json({ error: err instanceof Error ? err.message : "Update failed" });
  }
});

vendorsRouter.post("/:id/contacts/:contactId/activate-portal", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const loaded = await loadCompanyForContacts(req.params.id);
  if (loaded.error === "not_found") return res.status(404).json({ error: "Company not found" });
  if (loaded.error === "unsupported") return res.status(400).json({ error: loaded.message });
  const vendor = loaded.vendor;
  let contact = await prisma.vendorContact.findFirst({
    where: { id: req.params.contactId, vendorId: req.params.id },
  });
  if (!contact && req.params.contactId.startsWith("primary-")) {
    const email = (vendor.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "Add an email on the company card first." });
    const taken = await prisma.vendorContact.findUnique({ where: { email } });
    if (taken && taken.vendorId !== vendor.id) {
      return res.status(409).json({ error: "This email is already a representative on another company." });
    }
    contact =
      taken ||
      (await prisma.vendorContact.create({
        data: { vendorId: vendor.id, email, role: "Primary contact" },
      }));
  }
  if (!contact) return res.status(404).json({ error: "Person not found on this company" });
  const { syncCompanyRepresentativePortal } = await import("../services/crmVendorCredentials.js");
  const result = await syncCompanyRepresentativePortal({
    vendorId: vendor.id,
    email: contact.email,
    fullName: contact.fullName,
    password: req.body.password ? String(req.body.password) : null,
  });
  if (result && "error" in result) return res.status(400).json({ error: result.error });
  await audit("vendor.contact.portal", {
    userId: req.user!.id,
    entity: "VendorContact",
    entityId: contact.id,
    meta: { email: contact.email, vendorId: vendor.id, partyType: vendor.partyType },
  });
  res.json({ ok: true, login: result, loginPath: result.loginPath });
});

vendorsRouter.delete("/:id/contacts/:contactId", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  await prisma.vendorContact.deleteMany({
    where: { id: req.params.contactId, vendorId: req.params.id },
  });
  res.json({ ok: true });
});

vendorsRouter.delete("/project/:projectId/assign", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const vendorId = String(req.body?.vendorId || req.query.vendorId || "").trim();
  if (!vendorId) return res.status(400).json({ error: "vendorId required" });
  await prisma.projectVendor.deleteMany({
    where: { projectId: req.params.projectId, vendorId },
  });
  await audit("vendor.unassign", {
    userId: req.user!.id,
    entity: "ProjectVendor",
    entityId: vendorId,
    meta: { projectId: req.params.projectId },
  });
  res.json({ ok: true });
});

vendorsRouter.delete("/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const confirmName = String(req.body?.confirmName || req.query.confirmName || "").trim();
  const vendor = await prisma.vendor.findUnique({
    where: { id: req.params.id },
    select: { id: true, name: true, email: true },
  });
  if (!vendor) return res.status(404).json({ error: "Not found" });
  if (!confirmName || confirmName.toLowerCase() !== vendor.name.toLowerCase()) {
    return res.status(400).json({ error: `Type the company name ${vendor.name} to confirm delete.` });
  }
  let portalLoginsRetired = 0;
  await prisma.$transaction(async (tx) => {
    const { retirePortalLoginsForVendor } = await import("../services/crmVendorCredentials.js");
    portalLoginsRetired = await retirePortalLoginsForVendor(tx, vendor);
    await tx.projectVendor.deleteMany({ where: { vendorId: vendor.id } });
    await tx.user.updateMany({ where: { vendorId: vendor.id }, data: { vendorId: null } });
    await tx.rfi.updateMany({ where: { responsibleVendorId: vendor.id }, data: { responsibleVendorId: null } });
    await tx.vendor.update({ where: { id: vendor.id }, data: { isActive: false } });
  });
  await audit("vendor.delete", {
    userId: req.user!.id,
    entity: "Vendor",
    entityId: vendor.id,
    meta: { name: vendor.name, portalLoginsRetired },
  });
  res.json({ ok: true, id: vendor.id, portalLoginsRetired });
});

vendorsRouter.get("/project/:projectId", async (req, res) => {
  const rows = await prisma.projectVendor.findMany({
    where: { projectId: req.params.projectId },
    include: { vendor: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(rows);
});

vendorsRouter.post("/project/:projectId/assign", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const { vendorId, tradeRole } = req.body;
  const packages = Array.isArray(req.body.packages) ? req.body.packages.map((x: unknown) => String(x).trim()).filter(Boolean) : undefined;
  const packagesJson = packages ? JSON.stringify([...new Set(packages)]) : undefined;
  const row = await prisma.projectVendor.upsert({
    where: { projectId_vendorId: { projectId: req.params.projectId, vendorId } },
    create: { projectId: req.params.projectId, vendorId, tradeRole, packagesJson },
    update: {
      ...(tradeRole !== undefined ? { tradeRole } : {}),
      ...(packagesJson !== undefined ? { packagesJson } : {}),
    },
    include: { vendor: true },
  });
  await audit("vendor.assign", { userId: req.user!.id, entity: "ProjectVendor", entityId: row.id });

  let portal: { email: string; created: boolean; tempPassword?: string; role?: string } | null = null;
  if (row.vendor.email) {
    try {
      const { provisionCompanyAccess } = await import("../services/crmVendorCredentials.js");
      const login = await provisionCompanyAccess({
        projectId: req.params.projectId,
        vendor: row.vendor,
        assignedVia: "Project setup",
      });
      if (login) {
        portal = { email: login.email, created: login.created, tempPassword: login.tempPassword, role: login.role };
      }
    } catch (err) {
      console.warn("Company portal login on assign failed:", err instanceof Error ? err.message : err);
    }
  }
  res.status(201).json({ ...row, portal });
});

export const rfiRouter = Router();
rfiRouter.use(requireAuth);
guardProjectParam(rfiRouter);

const rfiDetailInclude = {
  assignedTo: { select: { id: true, fullName: true } },
  createdBy: { select: { id: true, fullName: true } },
  drawing: {
    select: {
      id: true,
      drawingNumber: true,
      title: true,
      currentRev: true,
      revisions: {
        orderBy: { createdAt: "desc" as const },
        take: 5,
        select: {
          id: true,
          revisionNumber: true,
          pdfFileUrl: true,
          pdfFileName: true,
          fileUrl: true,
          fileName: true,
          published: true,
          markupPages: {
            orderBy: { createdAt: "desc" as const },
            select: {
              id: true,
              pageNumber: true,
              fileUrl: true,
              fileName: true,
              createdAt: true,
              uploadedBy: { select: { fullName: true } },
            },
          },
        },
      },
    },
  },
  vendor: { select: { id: true, name: true } },
  responses: { include: { respondedBy: { select: { fullName: true } } }, orderBy: { createdAt: "asc" as const } },
};

async function nextSpdcRfiNumber(projectId: string) {
  const rows = await prisma.rfi.findMany({
    where: { projectId, rfiKind: "RequestForInformation" },
    select: { number: true },
  });
  let max = 0;
  for (const r of rows) {
    const m = String(r.number || "").match(/(\d+)\s*$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `SPDC-RFI-${String(max + 1).padStart(3, "0")}`;
}

function sendWorkbook(res: import("express").Response, buf: Buffer, filename: string, html = false) {
  if (html) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
  } else {
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }
  res.setHeader("Content-Disposition", `attachment; filename="${filename.replace(/"/g, "")}"`);
  res.send(buf);
}

rfiRouter.get("/project/:projectId", async (req: AuthedRequest, res) => {
  const { roleOnRfiMatrix } = await import("../services/reportPacks.js");
  const canRespond = await roleOnRfiMatrix(req.params.projectId, req.user!.role);
  const kind = typeof req.query.kind === "string" ? req.query.kind : undefined;
  const kindList = kind && kind !== "All" ? kind.split(",").map((k) => k.trim()).filter(Boolean) : [];
  const rfis = await prisma.rfi.findMany({
    where: {
      projectId: req.params.projectId,
      ...(kindList.length === 1 ? { rfiKind: kindList[0] } : kindList.length > 1 ? { rfiKind: { in: kindList } } : {}),
    },
    include: rfiDetailInclude,
    orderBy: { createdAt: "desc" },
  });
  res.json({ rfis, canRespond, canClose: canRespond, matrixGate: true });
});

rfiRouter.post("/project/:projectId", requireRoles("admin", "office", "site_employee", "employee", "client", "vendor"), async (req: AuthedRequest, res) => {
  const count = await prisma.rfi.count({ where: { projectId: req.params.projectId } });
  const isClient = req.user!.role === "client";
  const rfiKind = isClient
    ? "ClientConcern"
    : req.body.rfiKind ||
      (req.body.linkedChecklistItemId || req.body.linkedAssignmentId
        ? "DrawingChecklist"
        : "RequestForInformation");
  const noDrawingLink = [
    "QualityIR",
    "SafetyIR",
    "ActivityInspection",
    "QualityInspection",
    "SafetyChecklist",
    "SiteExecution",
  ].includes(rfiKind);
  const prefix =
    rfiKind === "QualityIR"
      ? "IR-QA"
      : rfiKind === "SafetyIR"
        ? "HSE-IR"
        : rfiKind === "ActivityInspection"
          ? "CL"
          : rfiKind === "QualityInspection"
            ? "QI-RFI"
            : rfiKind === "DrawingChecklist"
              ? "DWG-RFI"
              : rfiKind === "SafetyChecklist"
                ? "SAF-RFI"
                : rfiKind === "SiteExecution"
                  ? "SITE-CL"
                  : rfiKind === "RequestForInformation"
                  ? "SPDC-RFI"
                  : isClient
                    ? "CON"
                    : "RFI";
  const formObj =
    req.body.formDataJson && typeof req.body.formDataJson === "object" ? req.body.formDataJson : {};
  if (rfiKind === "RequestForInformation" && !isClient) {
    const solution = String(formObj.contractorSolution || formObj.proposedSolution || "").trim();
    if (!solution) {
      return res.status(400).json({
        error: "An RFI without the contractor's proposed solution is returned unanswered.",
      });
    }
  }
  const fillNeedsTarget = [
    "QualityInspection",
    "SafetyChecklist",
    "QualityIR",
    "SafetyIR",
    "DrawingChecklist",
    "ActivityInspection",
    "SiteExecution",
  ].includes(rfiKind);
  if (fillNeedsTarget && !isClient && !req.body.assignedToId && !req.body.responsibleVendorId) {
    return res.status(400).json({
      error: "Raise the fill request to a named person or a vendor from this project's directory.",
    });
  }
  if (req.body.assignedToId) {
    const assigneeId = String(req.body.assignedToId);
    const onProject = await prisma.projectMember.findFirst({
      where: { projectId: req.params.projectId, userId: assigneeId },
      select: { id: true },
    });
    if (!onProject) {
      // Communication matrix people (matched by email → User) may not be ProjectMember yet
      const assignee = await prisma.user.findUnique({
        where: { id: assigneeId },
        select: { email: true },
      });
      const email = assignee?.email?.trim();
      const onMatrix = email
        ? await prisma.communicationContact.findFirst({
            where: { projectId: req.params.projectId, email },
            select: { id: true },
          })
        : null;
      if (!onMatrix) {
        return res.status(400).json({
          error: "Assignee must be on this project's directory or communication matrix (matching email).",
        });
      }
    }
  }
  if (req.body.responsibleVendorId) {
    const assignedCompany = await prisma.projectVendor.findFirst({
      where: { projectId: req.params.projectId, vendorId: String(req.body.responsibleVendorId) },
      select: { id: true },
    });
    if (!assignedCompany) {
      return res.status(400).json({ error: "Vendor must be assigned on this project's directory." });
    }
  }
  const slaDays = { CRITICAL: 3, HIGH: 7, NORMAL: 14, LOW: 21 } as Record<string, number>;
  const priority = String(formObj.priority || "NORMAL").toUpperCase();
  const number =
    req.body.number ||
    (rfiKind === "RequestForInformation"
      ? await nextSpdcRfiNumber(req.params.projectId)
      : `${prefix}-${String(count + 1).padStart(3, "0")}`);
  const due = req.body.dueDate
    ? new Date(req.body.dueDate)
    : new Date(Date.now() + (slaDays[priority] || 14) * 86400000);
  const formDataJson =
    req.body.formDataJson && typeof req.body.formDataJson === "object"
      ? JSON.stringify(req.body.formDataJson)
      : typeof req.body.formDataJson === "string"
        ? req.body.formDataJson
        : null;

  const rfi = await prisma.rfi.create({
    data: {
      projectId: req.params.projectId,
      number,
      subject: req.body.subject,
      question: req.body.question,
      rfiKind,
      irNumber: req.body.irNumber || null,
      formDataJson,
      status: req.body.status || "Open",
      ballInCourt: "Assignee",
      assignedToId: req.body.assignedToId || null,
      createdById: req.user!.id,
      dueDate: due,
      linkedDrawingId: isClient || noDrawingLink ? null : req.body.linkedDrawingId || null,
      linkedChecklistItemId: req.body.linkedChecklistItemId || null,
      linkedAssignmentId: req.body.linkedAssignmentId || null,
      attachmentsJson: req.body.attachmentsJson ? JSON.stringify(req.body.attachmentsJson) : req.body.attachmentNote || null,
      responsibleVendorId: req.body.responsibleVendorId || null,
      scheduleImpact: req.body.scheduleImpact || "None",
      costImpact: req.body.costImpact || "None",
      isPrivate: !!req.body.isPrivate,
      specSectionLink: req.body.specSectionLink,
      questionReceivedFrom: isClient ? "Client portal" : req.body.questionReceivedFrom,
    },
    include: {
      assignedTo: { select: { fullName: true } },
      createdBy: { select: { fullName: true } },
      drawing: { select: { drawingNumber: true, title: true } },
      vendor: { select: { id: true, name: true } },
    },
  });
  await audit("rfi.create", { userId: req.user!.id, entity: "Rfi", entityId: rfi.id });
  let sharePointExports: Array<{ kind: string; path: string; url?: string | null }> = [];
  try {
    const { syncRfiToDrive } = await import("../services/syncRfiToDrive.js");
    sharePointExports = (await syncRfiToDrive(rfi.id)).exports;
  } catch (err) {
    console.warn("[RFI] SharePoint fill sync failed:", err instanceof Error ? err.message : err);
  }
  try {
    const [project, assignment] = await Promise.all([
      prisma.project.findUnique({
        where: { id: req.params.projectId },
        select: { code: true, name: true },
      }),
      rfi.linkedAssignmentId
        ? prisma.checklistAssignment.findUnique({
            where: { id: rfi.linkedAssignmentId },
            include: { template: { select: { name: true } } },
          })
        : Promise.resolve(null),
    ]);
    const { notifyRfiRaised, rfiEmailContextFromRecord } = await import("../services/rfiFlowNotify.js");
    await notifyRfiRaised({
      projectId: req.params.projectId,
      rfiId: rfi.id,
      linkedAssignmentId: rfi.linkedAssignmentId,
      createdById: req.user!.id,
      extraEmails: req.body.extraEmails || req.body.notifyEmails || null,
      ...rfiEmailContextFromRecord(
        rfi,
        project,
        assignment?.template?.name || null
      ),
    });
  } catch {
    /* email optional */
  }
  if (isChecklistFillRfiKind(rfiKind) && rfi.linkedAssignmentId) {
    try {
      const { ensureFillRequestDraft } = await import("../services/ensureFillRequestDraft.js");
      await ensureFillRequestDraft(prisma, {
        rfiId: rfi.id,
        rfiNumber: rfi.number,
        subject: rfi.subject,
        assignmentId: rfi.linkedAssignmentId,
        createdById: req.user!.id,
        assignedToId: rfi.assignedToId,
        drawingId: rfi.linkedDrawingId,
      });
    } catch (err) {
      console.warn("[RFI] fill-request draft:", err instanceof Error ? err.message : err);
    }
  }
  res.status(201).json({ ...rfi, sharePointExports });
});

/** SPDC RFI register = design queries only (Request for Information). Inspection / checklist requests have their own registers. */
const SPDC_RFI_REGISTER_KINDS = ["RequestForInformation", "Manual"];

rfiRouter.get("/project/:projectId/register.xlsx", async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
  if (!project) return res.status(404).json({ error: "Project not found" });
  const rfis = await prisma.rfi.findMany({
    where: { projectId: project.id, rfiKind: { in: SPDC_RFI_REGISTER_KINDS } },
    include: rfiDetailInclude,
    orderBy: { createdAt: "asc" },
  });
  const { buildSpdcRfiXlsxBuffer, safeRfiFilename } = await import("../services/spdcRfiForm.js");
  const buf = await buildSpdcRfiXlsxBuffer({ project, rfis });
  sendWorkbook(res, buf, `${String(project.code).replace(/[^\w.-]+/g, "_")}-RFI-Register.xlsx`);
});

rfiRouter.get("/project/:projectId/register.html", async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
  if (!project) return res.status(404).json({ error: "Project not found" });
  const rfis = await prisma.rfi.findMany({
    where: { projectId: project.id, rfiKind: { in: SPDC_RFI_REGISTER_KINDS } },
    include: rfiDetailInclude,
    orderBy: { createdAt: "asc" },
  });
  const { renderSpdcRfiFormHtml } = await import("../services/spdcRfiForm.js");
  const latest = rfis[rfis.length - 1];
  if (!latest) return res.status(404).json({ error: "No RFIs in register" });
  const html = renderSpdcRfiFormHtml({ project, rfi: latest });
  sendWorkbook(res, Buffer.from(html, "utf8"), `${project.code}-RFI-Register.html`, true);
});

rfiRouter.get("/:id/inspection.xlsx", async (req, res) => {
  const rfi = await prisma.rfi.findUnique({ where: { id: req.params.id } });
  if (!rfi) return res.status(404).json({ error: "RFI not found" });
  const project = await prisma.project.findUnique({ where: { id: rfi.projectId } });
  if (!project) return res.status(404).json({ error: "Project not found" });
  if (!["QualityIR", "SafetyIR", "ActivityInspection"].includes(rfi.rfiKind)) {
    return res.status(400).json({ error: "Not an inspection IR record" });
  }
  const linkedAssignment = rfi.linkedAssignmentId
    ? await prisma.checklistAssignment.findUnique({
        where: { id: rfi.linkedAssignmentId },
        include: { template: { select: { name: true } } },
      })
    : null;
  const { buildInspectionIrXlsx, safeInspectionIrFilename } = await import("../services/spdcInspectionIr.js");
  const buf = await buildInspectionIrXlsx({ ...rfi, linkedAssignment }, project);
  sendWorkbook(res, buf, safeInspectionIrFilename(rfi.number, "xlsx"));
});

rfiRouter.get("/:id/inspection.html", async (req, res) => {
  const rfi = await prisma.rfi.findUnique({ where: { id: req.params.id } });
  if (!rfi) return res.status(404).json({ error: "RFI not found" });
  const project = await prisma.project.findUnique({ where: { id: rfi.projectId } });
  if (!project) return res.status(404).json({ error: "Project not found" });
  if (!["QualityIR", "SafetyIR", "ActivityInspection"].includes(rfi.rfiKind)) {
    return res.status(400).json({ error: "Not an inspection IR record" });
  }
  const linkedAssignment = rfi.linkedAssignmentId
    ? await prisma.checklistAssignment.findUnique({
        where: { id: rfi.linkedAssignmentId },
        include: { template: { select: { name: true } } },
      })
    : null;
  const { renderInspectionIrHtml, safeInspectionIrFilename } = await import("../services/spdcInspectionIr.js");
  const html = renderInspectionIrHtml({ ...rfi, linkedAssignment }, project);
  sendWorkbook(res, Buffer.from(html, "utf8"), safeInspectionIrFilename(rfi.number, "html"), true);
});

rfiRouter.get("/:id/download.xlsx", async (req, res) => {
  const rfi = await prisma.rfi.findUnique({ where: { id: req.params.id }, include: rfiDetailInclude });
  if (!rfi) return res.status(404).json({ error: "RFI not found" });
  const project = await prisma.project.findUnique({ where: { id: rfi.projectId } });
  if (!project) return res.status(404).json({ error: "Project not found" });
  const rfis = await prisma.rfi.findMany({
    where: { projectId: rfi.projectId },
    include: rfiDetailInclude,
    orderBy: { createdAt: "asc" },
  });
  const { buildSpdcRfiXlsxBuffer, safeRfiFilename } = await import("../services/spdcRfiForm.js");
  const buf = await buildSpdcRfiXlsxBuffer({ project, rfis, selectRfiId: rfi.id });
  sendWorkbook(res, buf, safeRfiFilename(rfi.number, "xlsx"));
});

rfiRouter.get("/:id/download.html", async (req, res) => {
  const rfi = await prisma.rfi.findUnique({ where: { id: req.params.id }, include: rfiDetailInclude });
  if (!rfi) return res.status(404).json({ error: "RFI not found" });
  const project = await prisma.project.findUnique({ where: { id: rfi.projectId } });
  if (!project) return res.status(404).json({ error: "Project not found" });
  const { renderSpdcRfiFormHtml, safeRfiFilename } = await import("../services/spdcRfiForm.js");
  const html = renderSpdcRfiFormHtml({ project, rfi });
  sendWorkbook(res, Buffer.from(html, "utf8"), safeRfiFilename(rfi.number, "html"), true);
});

rfiRouter.post("/:id/follow-up", requireRoles("admin", "office", "site_employee", "employee"), async (req: AuthedRequest, res) => {
  const existing = await prisma.rfi.findUnique({
    where: { id: req.params.id },
    include: rfiDetailInclude,
  });
  if (!existing) return res.status(404).json({ error: "RFI not found" });
  const project = await prisma.project.findUnique({
    where: { id: existing.projectId },
    select: { code: true, name: true },
  });
  const { notifyRfiFollowUp, rfiEmailContextFromRecord } = await import("../services/rfiFlowNotify.js");
  const result = await notifyRfiFollowUp({
    projectId: existing.projectId,
    rfiId: existing.id,
    linkedAssignmentId: existing.linkedAssignmentId,
    createdById: req.user!.id,
    extraEmails: req.body.extraEmails || req.body.notifyEmails || null,
    note: req.body.note || null,
    ...rfiEmailContextFromRecord(existing, project),
  });
  await audit("rfi.follow-up", { userId: req.user!.id, entity: "Rfi", entityId: existing.id });
  res.json({ ok: true, email: result });
});

rfiRouter.post("/:id/respond", async (req: AuthedRequest, res) => {
  const existing = await prisma.rfi.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "RFI not found" });
  const { roleOnRfiMatrix } = await import("../services/reportPacks.js");
  const allowed = await roleOnRfiMatrix(existing.projectId, req.user!.role);
  if (!allowed) {
    return res.status(403).json({
      error: "Only roles listed on this project's Communication Matrix (RFI rows) can respond. Ask Sharnam office to add your role.",
    });
  }
  const response = await prisma.rfiResponse.create({
    data: {
      rfiId: req.params.id,
      respondedById: req.user!.id,
      responseText: req.body.responseText,
      responseChannel: req.body.responseChannel || "Web",
      isOfficialResponse: !!req.body.isOfficialResponse,
    },
  });
  await prisma.rfi.update({
    where: { id: req.params.id },
    data: {
      status: req.body.close ? "Answered" : "Open",
      ballInCourt: req.body.isOfficialResponse ? "Creator" : "Assignee",
      closedAt: req.body.close ? new Date() : null,
    },
  });
  try {
    const [project, fullRfi] = await Promise.all([
      prisma.project.findUnique({
        where: { id: existing.projectId },
        select: { code: true, name: true },
      }),
      prisma.rfi.findUnique({
        where: { id: existing.id },
        include: {
          assignedTo: { select: { fullName: true } },
          createdBy: { select: { fullName: true } },
          drawing: { select: { drawingNumber: true, title: true } },
          vendor: { select: { name: true } },
        },
      }),
    ]);
    const { notifyRfiResponse, rfiEmailContextFromRecord } = await import("../services/rfiFlowNotify.js");
    if (fullRfi) {
      await notifyRfiResponse({
        projectId: existing.projectId,
        rfiId: existing.id,
        responseText: req.body.responseText || "",
        respondedByName: req.user!.fullName || undefined,
        isOfficial: !!req.body.isOfficialResponse,
        createdById: req.user!.id,
        ...rfiEmailContextFromRecord(fullRfi, project),
      });
    }
  } catch {
    /* email optional */
  }
  try {
    const { syncRfiToDrive } = await import("../services/syncRfiToDrive.js");
    await syncRfiToDrive(existing.id);
  } catch (err) {
    console.warn("[RFI] SharePoint respond sync failed:", err instanceof Error ? err.message : err);
  }
  res.status(201).json(response);
});

rfiRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.rfi.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "RFI not found" });
  const { roleOnRfiMatrix } = await import("../services/reportPacks.js");
  const allowed = await roleOnRfiMatrix(existing.projectId, req.user!.role);
  if (!allowed) {
    return res.status(403).json({
      error: "Only Communication Matrix parties (or Sharnam office) can close / update this RFI.",
    });
  }
  const rfi = await prisma.rfi.update({
    where: { id: req.params.id },
    data: {
      status: req.body.status,
      ballInCourt: req.body.ballInCourt,
      assignedToId: req.body.assignedToId,
      closedAt: req.body.status === "Closed" ? new Date() : undefined,
    },
  });
  if (req.body.status && req.body.status !== existing.status) {
    if (req.body.status === "Closed") {
      try {
        const { archiveClosedRfiReport } = await import("../services/archiveClosedRfiReport.js");
        await archiveClosedRfiReport({ projectId: existing.projectId, rfiId: rfi.id });
      } catch (err) {
        console.warn("[RFI] SharePoint archive failed:", err instanceof Error ? err.message : err);
      }
      const [project, closedRfi, assignment] = await Promise.all([
        prisma.project.findUnique({
          where: { id: existing.projectId },
          select: { code: true, name: true },
        }),
        prisma.rfi.findUnique({
          where: { id: rfi.id },
          include: {
            assignedTo: { select: { fullName: true } },
            createdBy: { select: { fullName: true } },
            drawing: { select: { drawingNumber: true, title: true } },
            vendor: { select: { name: true } },
          },
        }),
        existing.linkedAssignmentId
          ? prisma.checklistAssignment.findUnique({
              where: { id: existing.linkedAssignmentId },
              include: { template: { select: { name: true } } },
            })
          : Promise.resolve(null),
      ]);
      const { notifyRfiClosed, rfiEmailContextFromRecord } = await import("../services/rfiFlowNotify.js");
      if (closedRfi) {
        await notifyRfiClosed({
          projectId: existing.projectId,
          rfiId: rfi.id,
          createdById: req.user!.id,
          ...rfiEmailContextFromRecord(closedRfi, project, assignment?.template?.name || null),
        });
      }
      try {
        const { refreshQualityPackAfterChange } = await import("../services/checklistWeekAdvance.js");
        await refreshQualityPackAfterChange(existing.projectId, req.user!.id);
      } catch (err) {
        console.warn("[RFI] quality pack refresh:", err instanceof Error ? err.message : err);
      }
    } else {
      const { notifyRfiStatus } = await import("../services/ncrNotify.js");
      await notifyRfiStatus({
        projectId: existing.projectId,
        number: rfi.number,
        subject: rfi.subject,
        status: rfi.status,
        createdById: req.user!.id,
      });
    }
  }
  res.json(rfi);
});

rfiRouter.delete("/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const existing = await prisma.rfi.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "RFI not found" });
  await prisma.$transaction([
    prisma.inspectionItem.updateMany({ where: { linkedRfiId: existing.id }, data: { linkedRfiId: null } }),
    prisma.designCoordinationIssue.updateMany({ where: { escalatedRfiId: existing.id }, data: { escalatedRfiId: null } }),
    prisma.rfiResponse.deleteMany({ where: { rfiId: existing.id } }),
    prisma.rfi.delete({ where: { id: existing.id } }),
  ]);
  await audit("rfi.delete", {
    userId: req.user!.id,
    entity: "Rfi",
    entityId: existing.id,
    meta: { number: existing.number, kind: existing.rfiKind, projectId: existing.projectId },
  });
  // Keep the live SharePoint register in step; the RFI's own files are removed from SharePoint by hand.
  if (!["QualityIR", "SafetyIR", "ActivityInspection", "DrawingChecklist", "QualityInspection", "SafetyChecklist", "SiteExecution"].includes(existing.rfiKind)) {
    void import("../services/syncRfiToDrive.js")
      .then(({ refreshRfiRegisterOnDrive }) => refreshRfiRegisterOnDrive(existing.projectId))
      .catch((err) => console.warn("[rfi] register refresh after delete:", err instanceof Error ? err.message : err));
  }
  res.json({ ok: true, number: existing.number });
});

export const inspectionsRouter = Router();
inspectionsRouter.use(requireAuth);
guardProjectParam(inspectionsRouter);

inspectionsRouter.get("/project/:projectId", async (req, res) => {
  const rows = await prisma.qualityInspection.findMany({
    where: { projectId: req.params.projectId },
    include: {
      createdBy: { select: { fullName: true } },
      assignedTo: { select: { fullName: true } },
      drawing: { select: { drawingNumber: true, title: true, isPublished: true } },
      items: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
  const published = await prisma.drawing.count({
    where: { projectId: req.params.projectId, isPublished: true },
  });
  res.json({ inspections: rows, canInspect: true, publishedDrawings: published });
});

inspectionsRouter.post("/project/:projectId", requireRoles("admin", "office", "site_employee", "employee"), async (req: AuthedRequest, res) => {
  const published = await prisma.drawing.count({
    where: { projectId: req.params.projectId, isPublished: true },
  });

  const itemsFromBody: { description: string; autoGenerateRfi?: boolean }[] = req.body.items || [];
  let items = itemsFromBody;

  if (req.body.checklistTemplateId) {
    const tpl = await prisma.checklistTemplate.findUnique({
      where: { id: req.body.checklistTemplateId },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    if (tpl?.items?.length) {
      items = tpl.items.map((it) => ({ description: `${it.itemCode ? it.itemCode + " — " : ""}${it.description}` }));
    }
  }

  if (!items.length) {
    items = [
      { description: "Work per approved method / QAP" },
      { description: "Materials as specified" },
      { description: "Workmanship acceptable" },
      { description: "Safety compliance verified" },
      { description: "Ready for next activity", autoGenerateRfi: true },
    ];
  }

  const inspection = await prisma.qualityInspection.create({
    data: {
      projectId: req.params.projectId,
      title: req.body.title,
      inspectionType: req.body.inspectionType || "Quality",
      status: req.body.status || "Draft",
      location: req.body.location,
      linkedDrawingId: req.body.linkedDrawingId || null,
      checklistTemplateId: req.body.checklistTemplateId || null,
      trade: req.body.trade,
      createdById: req.user!.id,
      assignedToId: req.body.assignedToId || null,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      attachmentsJson: req.body.attachmentsJson
        ? typeof req.body.attachmentsJson === "string"
          ? req.body.attachmentsJson
          : JSON.stringify(req.body.attachmentsJson)
        : null,
      items: {
        create: items.map((it, i) => ({
          description: it.description,
          sortOrder: i + 1,
          autoGenerateRfi: !!it.autoGenerateRfi,
        })),
      },
    },
    include: { items: true, drawing: true, assignedTo: { select: { fullName: true } } },
  });

  // Store under Mock OneDrive by drawing discipline (Procore-style folder by type)
  const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
  if (project) {
    await mockOneDrive.ensureProjectTree(project.id);
    const drawing = inspection.linkedDrawingId
      ? await prisma.drawing.findUnique({ where: { id: inspection.linkedDrawingId } })
      : null;
    const disc = drawing?.discipline || "Architecture";
    await mockOneDrive.upload(
      project.code,
      `${MODULE_TO_ISO_FOLDER.qualityChecklist}/Inspections/${disc}`,
      `${inspection.id}-meta.txt`,
      Buffer.from(
        `Inspection: ${inspection.title}\nType: ${inspection.inspectionType}\nDrawing: ${drawing?.drawingNumber || "n/a"}\n`
      )
    );
  }

  await audit("inspection.create", { userId: req.user!.id, entity: "QualityInspection", entityId: inspection.id });
  res.status(201).json(inspection);
});

inspectionsRouter.post("/:id/items", requireRoles("admin", "office", "site_employee", "employee"), async (req: AuthedRequest, res) => {
  const inspection = await prisma.qualityInspection.findUnique({ where: { id: req.params.id }, include: { items: true } });
  if (!inspection) return res.status(404).json({ error: "Not found" });
  const item = await prisma.inspectionItem.create({
    data: {
      inspectionId: inspection.id,
      description: req.body.description,
      sortOrder: (inspection.items?.length || 0) + 1,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      autoGenerateRfi: !!req.body.autoGenerateRfi,
    },
  });
  res.status(201).json(item);
});

inspectionsRouter.patch("/:id", requireRoles("admin", "office", "site_employee", "employee"), async (req: AuthedRequest, res) => {
  const row = await prisma.qualityInspection.update({
    where: { id: req.params.id },
    data: {
      status: req.body.status,
      title: req.body.title,
      assignedToId: req.body.assignedToId,
      linkedDrawingId: req.body.linkedDrawingId,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      completedAt: req.body.status === "Closed" ? new Date() : undefined,
      attachmentsJson: req.body.attachmentsJson
        ? typeof req.body.attachmentsJson === "string"
          ? req.body.attachmentsJson
          : JSON.stringify(req.body.attachmentsJson)
        : undefined,
    },
    include: { items: true, assignedTo: { select: { fullName: true } }, drawing: true },
  });
  res.json(row);
});

inspectionsRouter.patch("/items/:itemId", requireRoles("admin", "office", "site_employee", "vendor", "employee"), async (req: AuthedRequest, res) => {
  const item = await prisma.inspectionItem.update({
    where: { id: req.params.itemId },
    data: {
      status: req.body.status,
      remarks: req.body.remarks,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      ...(req.body.attachmentsJson !== undefined ? { attachmentsJson: req.body.attachmentsJson } : {}),
    },
    include: { inspection: true },
  });

  // Auto-generate RFI when unresolved
  if (req.body.status === "Unresolved" && item.autoGenerateRfi && !item.linkedRfiId) {
    const count = await prisma.rfi.count({ where: { projectId: item.inspection.projectId } });
    const rfi = await prisma.rfi.create({
      data: {
        projectId: item.inspection.projectId,
        number: `QI-RFI-${String(count + 1).padStart(3, "0")}`,
        subject: `QI checklist fill / issue: ${item.inspection.title}`,
        question: `${item.description}${item.remarks ? `\n\nRemarks: ${item.remarks}` : ""}`,
        rfiKind: "QualityInspection",
        status: "Open",
        ballInCourt: "Assignee",
        createdById: req.user!.id,
        linkedDrawingId: item.inspection.linkedDrawingId,
        linkedChecklistItemId: item.inspection.checklistTemplateId || null,
        dueDate: new Date(Date.now() + 5 * 86400000),
      },
    });
    await prisma.inspectionItem.update({
      where: { id: item.id },
      data: { linkedRfiId: rfi.id },
    });
    return res.json({ ...item, linkedRfiId: rfi.id, generatedRfi: rfi });
  }

  res.json(item);
});

inspectionsRouter.post(
  "/items/:itemId/attachments",
  requireRoles("admin", "office", "site_employee", "vendor", "employee"),
  upload.array("files", 10),
  async (req: AuthedRequest, res) => {
    const item = await prisma.inspectionItem.findUnique({
      where: { id: req.params.itemId },
      include: { inspection: { include: { project: true } } },
    });
    if (!item) return res.status(404).json({ error: "Item not found" });
    const files = (req.files as Express.Multer.File[]) || [];
    if (!files.length) return res.status(400).json({ error: "No files" });
    const comment = typeof req.body.comment === "string" ? req.body.comment : "";
    const existing: { url: string; name: string; kind: string; comment?: string }[] = (() => {
      try {
        return JSON.parse(item.attachmentsJson || "[]");
      } catch {
        return [];
      }
    })();
    for (const f of files) {
      const kind = f.mimetype?.startsWith("image/") ? "photo" : "doc";
      const saved = await mockOneDrive.upload(
        item.inspection.project.code,
        `${MODULE_TO_ISO_FOLDER.qualityChecklist}/Inspections`,
        f.originalname,
        f.buffer
      );
      existing.push({ url: saved.url, name: f.originalname, kind, comment: comment || undefined });
    }
    const updated = await prisma.inspectionItem.update({
      where: { id: item.id },
      data: {
        attachmentsJson: JSON.stringify(existing),
        remarks: req.body.remarks !== undefined ? req.body.remarks : item.remarks,
      },
    });
    res.json(updated);
  }
);

inspectionsRouter.delete("/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  await prisma.inspectionItem.deleteMany({ where: { inspectionId: req.params.id } });
  await prisma.qualityInspection.delete({ where: { id: req.params.id } });
  await audit("inspection.delete", { userId: req.user!.id, entity: "QualityInspection", entityId: req.params.id });
  res.json({ ok: true });
});

inspectionsRouter.post("/:id/complete", requireRoles("admin", "office", "site_employee"), async (req: AuthedRequest, res) => {
  const row = await prisma.qualityInspection.update({
    where: { id: req.params.id },
    data: { status: "Completed", completedAt: new Date() },
  });
  res.json(row);
});

export const directoryRouter = Router();
directoryRouter.use(requireAuth);
guardProjectParam(directoryRouter);

directoryRouter.get("/project/:projectId/overview", async (req: AuthedRequest, res) => {
  const projectId = req.params.projectId;
  const role = req.user?.role;
  const [members, vendors, drawings, rfis, inspections, submittals, photos, coordination] = await Promise.all([
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, fullName: true, email: true, role: true, phone: true } } },
    }),
    prisma.projectVendor.findMany({ where: { projectId }, include: { vendor: true } }),
    prisma.drawing.findMany({ where: { projectId } }),
    prisma.rfi.findMany({ where: { projectId } }),
    prisma.qualityInspection.findMany({ where: { projectId } }),
    prisma.submittal.findMany({ where: { projectId } }),
    prisma.projectPhoto.findMany({ where: { projectId }, take: 20, orderBy: { createdAt: "desc" } }),
    prisma.designCoordinationIssue.findMany({
      where: { projectId },
      include: { documents: { orderBy: { createdAt: "desc" } } },
    }),
  ]);
  let visibleVendors = vendors;
  if (role === "client") {
    visibleVendors = vendors.filter((v) => v.vendor.partyType === "Client");
  } else if (role === "vendor") {
    const { resolveVendorForUser } = await import("../services/vendorPortal.js");
    const mine = await resolveVendorForUser(req.user!);
    visibleVendors = mine ? vendors.filter((v) => v.vendorId === mine.id) : [];
  }
  const { listClientRepresentativesForProject } = await import("../services/projectDirectoryPeople.js");
  const clientRepresentatives = await listClientRepresentativesForProject(projectId);
  res.json({
    members,
    vendors: visibleVendors,
    clientRepresentatives,
    parties: {
      contractors: visibleVendors.filter((v) => v.vendor.partyType === "Contractor"),
      vendorsOnly: visibleVendors.filter((v) => v.vendor.partyType === "Vendor" || !v.vendor.partyType),
      clients: visibleVendors.filter((v) => v.vendor.partyType === "Client"),
      consultants: visibleVendors.filter((v) => v.vendor.partyType === "Consultant"),
      pmc: visibleVendors.filter((v) => v.vendor.partyType === "PMC"),
    },
    stats: {
      drawings: drawings.length,
      publishedDrawings: drawings.filter((d) => d.isPublished).length,
      openRfis: rfis.filter((r) => r.status === "Open").length,
      inspections: inspections.length,
      submittals: submittals.length,
      photos: photos.length,
      coordinationOpen: coordination.filter((c) => c.status === "Open").length,
      contractors: visibleVendors.filter((v) => v.vendor.partyType === "Contractor").length,
      vendorCompanies: visibleVendors.filter((v) => v.vendor.partyType === "Vendor" || !v.vendor.partyType).length,
      clients: visibleVendors.filter((v) => v.vendor.partyType === "Client").length,
    },
    photos,
    submittals,
    coordination,
  });
});

const signUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

directoryRouter.get("/project/:projectId/signatures", async (req, res) => {
  const { listDirectorySignatures, DIRECTORY_SIGNATURES_FOLDER } = await import("../services/directorySignatures.js");
  const signatures = await listDirectorySignatures(prisma, req.params.projectId);
  res.json({ signatures, folder: DIRECTORY_SIGNATURES_FOLDER });
});

directoryRouter.get("/project/:projectId/signatures/me", async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, email: true, role: true, vendorId: true },
  });
  if (!user) return res.status(404).json({ error: "Not found" });
  const { getMyDirectorySignatureSlots, DIRECTORY_SIGNATURES_FOLDER } = await import(
    "../services/directorySignatures.js"
  );
  const slots = await getMyDirectorySignatureSlots(prisma, req.params.projectId, user);
  res.json({ ...slots, folder: DIRECTORY_SIGNATURES_FOLDER });
});

directoryRouter.post(
  "/project/:projectId/members/:memberId/signature",
  signUpload.single("signature"),
  async (req: AuthedRequest, res) => {
    const { projectId, memberId } = req.params;
    const file = req.file;
    if (!file) return res.status(400).json({ error: "signature file required (field: signature)" });

    const member = await prisma.projectMember.findFirst({
      where: { id: memberId, projectId },
      select: { userId: true },
    });
    if (!member) return res.status(404).json({ error: "Member not found" });

    const isSelf = member.userId === req.user!.id;
    const canManage = ["admin", "office"].includes(req.user!.role);
    if (!isSelf && !canManage) return res.status(403).json({ error: "Not allowed to update this signature" });

    try {
      const { saveMemberDirectorySignature } = await import("../services/directorySignatures.js");
      const updated = await saveMemberDirectorySignature(prisma, projectId, memberId, file.buffer, file.originalname, {
        signatoryTitle: typeof req.body.signatoryTitle === "string" ? req.body.signatoryTitle : undefined,
        uploadedById: req.user!.id,
      });
      await audit("directory.signature.member", {
        userId: req.user!.id,
        entity: "ProjectMember",
        entityId: memberId,
        meta: { projectId },
      });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Upload failed" });
    }
  }
);

directoryRouter.post(
  "/project/:projectId/vendors/:projectVendorId/signature",
  signUpload.single("signature"),
  async (req: AuthedRequest, res) => {
    const { projectId, projectVendorId } = req.params;
    const file = req.file;
    if (!file) return res.status(400).json({ error: "signature file required (field: signature)" });

    const pv = await prisma.projectVendor.findFirst({
      where: { id: projectVendorId, projectId },
      include: { vendor: { select: { id: true, email: true, partyType: true, name: true } } },
    });
    if (!pv) return res.status(404).json({ error: "Project party not found" });

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true, role: true, vendorId: true },
    });
    if (!user) return res.status(404).json({ error: "Not found" });

    const { saveVendorDirectorySignature, canEditVendorSignature } = await import(
      "../services/directorySignatures.js"
    );
    if (!canEditVendorSignature(user, pv)) {
      return res.status(403).json({ error: "Not allowed to update this company signature" });
    }

    try {
      const updated = await saveVendorDirectorySignature(
        prisma,
        projectId,
        projectVendorId,
        file.buffer,
        file.originalname,
        { signatoryName: typeof req.body.signatoryName === "string" ? req.body.signatoryName : undefined }
      );
      await audit("directory.signature.vendor", {
        userId: req.user!.id,
        entity: "ProjectVendor",
        entityId: projectVendorId,
        meta: { projectId },
      });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Upload failed" });
    }
  }
);

directoryRouter.post("/project/:projectId/submittals", requireRoles("admin", "office", "site_employee", "employee", "vendor"), async (req: AuthedRequest, res) => {
  const count = await prisma.submittal.count({ where: { projectId: req.params.projectId } });
  const row = await prisma.submittal.create({
    data: {
      projectId: req.params.projectId,
      number: req.body.number || `SUB-${String(count + 1).padStart(3, "0")}`,
      title: req.body.title,
      submittalType: req.body.submittalType || "Product Data",
      status: req.body.status || "Draft",
      ballInCourt: req.body.ballInCourt || "Submitter",
      specSection: req.body.specSection,
      description: req.body.description || null,
      revisionNumber: req.body.revisionNumber || "0",
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      attachmentsJson: req.body.attachmentsJson
        ? typeof req.body.attachmentsJson === "string"
          ? req.body.attachmentsJson
          : JSON.stringify(req.body.attachmentsJson)
        : null,
    },
  });
  await audit("submittal.create", { userId: req.user!.id, entity: "Submittal", entityId: row.id });
  res.status(201).json(row);
});

directoryRouter.patch("/submittals/:id", requireRoles("admin", "office", "site_employee", "employee", "vendor"), async (req: AuthedRequest, res) => {
  const row = await prisma.submittal.update({
    where: { id: req.params.id },
    data: {
      title: req.body.title,
      submittalType: req.body.submittalType,
      status: req.body.status,
      ballInCourt: req.body.ballInCourt,
      specSection: req.body.specSection,
      description: req.body.description,
      revisionNumber: req.body.revisionNumber,
      reviewerNotes: req.body.reviewerNotes,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      attachmentsJson: req.body.attachmentsJson !== undefined
        ? typeof req.body.attachmentsJson === "string"
          ? req.body.attachmentsJson
          : JSON.stringify(req.body.attachmentsJson)
        : undefined,
    },
  });
  await audit("submittal.update", { userId: req.user!.id, entity: "Submittal", entityId: row.id });
  res.json(row);
});

directoryRouter.get("/project/:projectId/submittals", async (req, res) => {
  const rows = await prisma.submittal.findMany({
    where: { projectId: req.params.projectId },
    orderBy: { updatedAt: "desc" },
  });
  res.json(rows);
});

directoryRouter.get("/project/:projectId/photos", async (req, res) => {
  const album = req.query.album ? String(req.query.album) : undefined;
  const rows = await prisma.projectPhoto.findMany({
    where: { projectId: req.params.projectId, ...(album ? { album } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const albums = await prisma.projectPhoto.groupBy({
    by: ["album"],
    where: { projectId: req.params.projectId },
    _count: true,
  });
  res.json({ photos: rows, albums });
});

directoryRouter.post(
  "/project/:projectId/photos",
  requireRoles("admin", "office", "site_employee", "employee", "vendor"),
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
    if (!project) return res.status(404).json({ error: "Not found" });
    let fileUrl = req.body.fileUrl || "";
    if (req.file) {
      const { mockOneDrive } = await import("../services/mockOneDrive.js");
      const saved = await mockOneDrive.upload(
        project.code,
        `${MODULE_TO_ISO_FOLDER.photos}/Site Progress`,
        req.file.originalname,
        req.file.buffer
      );
      fileUrl = saved.url;
    }
    if (!fileUrl) fileUrl = `/uploads/photos/placeholder-${Date.now()}.txt`;
    const row = await prisma.projectPhoto.create({
      data: {
        projectId: req.params.projectId,
        fileUrl,
        album: req.body.album || "Site Progress",
        description: req.body.description,
        trade: req.body.trade,
        location: req.body.location,
        isPrivate: req.body.isPrivate === "true" || req.body.isPrivate === true,
      },
    });
    await audit("photo.create", { userId: req.user!.id, entity: "ProjectPhoto", entityId: row.id });
    res.status(201).json(row);
  }
);

directoryRouter.delete("/photos/:id", requireRoles("admin", "office", "site_employee", "employee"), async (req: AuthedRequest, res) => {
  await prisma.projectPhoto.delete({ where: { id: req.params.id } });
  await audit("photo.delete", { userId: req.user!.id, entity: "ProjectPhoto", entityId: req.params.id });
  res.json({ ok: true });
});

directoryRouter.delete("/submittals/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  await prisma.submittal.delete({ where: { id: req.params.id } });
  await audit("submittal.delete", { userId: req.user!.id, entity: "Submittal", entityId: req.params.id });
  res.json({ ok: true });
});

directoryRouter.delete("/coordination/:id", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  await prisma.designCoordinationIssue.delete({ where: { id: req.params.id } });
  await audit("coordination.delete", { userId: req.user!.id, entity: "DesignCoordinationIssue", entityId: req.params.id });
  res.json({ ok: true });
});

directoryRouter.post("/project/:projectId/coordination", requireRoles("admin", "office", "employee", "site_employee"), async (req: AuthedRequest, res) => {
  const row = await prisma.designCoordinationIssue.create({
    data: {
      projectId: req.params.projectId,
      title: req.body.title,
      description: req.body.description,
      discipline: req.body.discipline,
      location: req.body.location,
      priority: req.body.priority || "Medium",
      ballInCourt: req.body.ballInCourt || "Assignee",
      linkedDrawingId: req.body.linkedDrawingId || null,
      assignedToName: req.body.assignedToName || null,
      assignedToId: req.body.assignedToId || null,
      assignedToEmail: req.body.assignedToEmail || null,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
    },
  });
  const { getProjectMatrixEmails } = await import("../services/matrixContacts.js");
  const matrix = await getProjectMatrixEmails(req.params.projectId, "TECHNICAL");
  const assignee = String(req.body.assignedToEmail || "").trim().toLowerCase();
  const to = assignee || matrix.to[0] || matrix.cc[0] || "";
  const cc = [...new Set([...matrix.to, ...matrix.cc].filter((email) => email && email !== to))];
  if (to) {
    const { queueProjectEmail } = await import("../services/email.js");
    await queueProjectEmail({
      projectId: req.params.projectId,
      subject: `Design coordination — ${req.body.title}`,
      body: [
        `A design coordination issue was logged.`,
        ``,
        `Issue: ${req.body.title}`,
        req.body.discipline ? `Drawing type: ${req.body.discipline}` : "",
        req.body.description ? `Details: ${req.body.description}` : "",
        req.body.assignedToName ? `Assigned to: ${req.body.assignedToName}` : "",
        ``,
        `Assignee is on To. Communication-matrix contacts (To and Cc) are copied.`,
      ]
        .filter(Boolean)
        .join("\n"),
      context: "coordination.logged",
      createdById: req.user!.id,
      toOverride: to,
      ccOverride: cc.join(", "),
    }).catch(() => undefined);
  }
  publishCoordinationRegisterInBackground(req.params.projectId);
  res.status(201).json(row);
});

directoryRouter.get("/project/:projectId/coordination/register.xlsx", async (req, res) => {
  const { buildDesignCoordinationRegisterXlsx } = await import("../services/drawingRegisterExport.js");
  const buf = await buildDesignCoordinationRegisterXlsx(req.params.projectId);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="Design-Coordination-Register-${req.params.projectId}.xlsx"`);
  res.send(buf);
});

directoryRouter.get("/project/:projectId/coordination/register.pdf", async (req, res) => {
  const { buildDesignCoordinationRegisterPdf } = await import("../services/drawingRegisterExport.js");
  const buf = await buildDesignCoordinationRegisterPdf(req.params.projectId);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="Design-Coordination-Register-${req.params.projectId}.pdf"`);
  res.send(buf);
});

const coordImportUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

/** Office: import a Design Coordination Register Excel (no emails are sent for imported rows). */
directoryRouter.post(
  "/project/:projectId/coordination/import",
  requireRoles("admin", "office"),
  coordImportUpload.single("file"),
  async (req: AuthedRequest, res) => {
    if (!req.file) return res.status(400).json({ error: "Choose the register Excel file to import" });
    try {
      const { importCoordinationRegister } = await import("../services/coordinationRegisterImport.js");
      const out = await importCoordinationRegister(req.params.projectId, req.file.buffer);
      await audit("coordination.import", {
        userId: req.user!.id,
        entity: "Project",
        entityId: req.params.projectId,
        meta: { created: out.created, updated: out.updated },
      });
      publishCoordinationRegisterInBackground(req.params.projectId);
      res.json(out);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Import failed" });
    }
  },
);

function publishCoordinationRegisterInBackground(projectId: string) {
  void import("../services/drawingRegisterDrive.js")
    .then(({ publishCoordinationRegisterToDrive }) => publishCoordinationRegisterToDrive(projectId))
    .catch((err) => console.warn("[coordination] SharePoint register:", err instanceof Error ? err.message : err));
}

directoryRouter.patch("/coordination/:id", requireRoles("admin", "office", "employee", "site_employee"), async (req: AuthedRequest, res) => {
  const before = await prisma.designCoordinationIssue.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "Not found" });
  const row = await prisma.designCoordinationIssue.update({
    where: { id: req.params.id },
    data: {
      status: req.body.status,
      title: req.body.title,
      description: req.body.description,
      priority: req.body.priority,
      location: req.body.location,
      discipline: req.body.discipline,
      ballInCourt: req.body.ballInCourt,
      assignedToName: req.body.assignedToName,
      assignedToId: req.body.assignedToId,
      assignedToEmail: req.body.assignedToEmail,
      linkedDrawingId: req.body.linkedDrawingId,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
    },
  });
  // Re-assigned to someone new → they get the same email the first assignee got.
  const newEmail = String(row.assignedToEmail || "").trim().toLowerCase();
  const oldEmail = String(before.assignedToEmail || "").trim().toLowerCase();
  if (newEmail && newEmail !== oldEmail) {
    const { queueProjectEmail } = await import("../services/email.js");
    await queueProjectEmail({
      projectId: row.projectId,
      subject: `Design coordination assigned to you — ${row.title}`,
      body: [
        `A design coordination issue has been assigned to you. Please review and take action.`,
        ``,
        `Issue: ${row.title}`,
        row.discipline ? `Drawing type: ${row.discipline}` : "",
        row.description ? `Details: ${row.description}` : "",
        row.dueDate ? `Due: ${row.dueDate.toISOString().slice(0, 10)}` : "",
        before.assignedToName ? `Previously with: ${before.assignedToName}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      context: "coordination.reassigned",
      createdById: req.user!.id,
      toOverride: newEmail,
      ccOverride: oldEmail || undefined,
    }).catch(() => undefined);
  }
  publishCoordinationRegisterInBackground(row.projectId);
  res.json(row);
});

directoryRouter.post(
  "/coordination/:id/follow-up",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const issue = await prisma.designCoordinationIssue.findUnique({ where: { id: req.params.id } });
    if (!issue) return res.status(404).json({ error: "Not found" });
    try {
      const { sendCoordinationFollowUp, MAX_FOLLOW_UPS } = await import("../services/coordinationEscalation.js");
      const result = await sendCoordinationFollowUp({
        issueId: issue.id,
        projectId: issue.projectId,
        userId: req.user!.id,
      });
      await audit("coordination.follow-up", {
        userId: req.user!.id,
        entity: "DesignCoordinationIssue",
        entityId: issue.id,
        meta: { followUpCount: result.issue.followUpCount, autoEscalated: result.autoEscalated },
      });
      publishCoordinationRegisterInBackground(issue.projectId);
      res.json({ ...result, maxFollowUps: MAX_FOLLOW_UPS });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Follow-up failed" });
    }
  }
);

directoryRouter.post(
  "/coordination/:id/escalate-rfi",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const issue = await prisma.designCoordinationIssue.findUnique({ where: { id: req.params.id } });
    if (!issue) return res.status(404).json({ error: "Not found" });
    if (issue.status === "Closed") return res.status(400).json({ error: "Issue is closed" });
    try {
      const { createRfiFromCoordinationIssue, MAX_FOLLOW_UPS } = await import("../services/coordinationEscalation.js");
      void MAX_FOLLOW_UPS;
      // Escalation is allowed at any time (before or after 5 follow-ups), but only once.
      if (issue.escalatedRfiId) {
        return res.status(400).json({ error: "Already escalated to an RFI" });
      }
      const rfi = await createRfiFromCoordinationIssue({
        issueId: issue.id,
        projectId: issue.projectId,
        userId: req.user!.id,
      });
      await audit("coordination.escalate-rfi", {
        userId: req.user!.id,
        entity: "DesignCoordinationIssue",
        entityId: issue.id,
        meta: { rfiId: rfi.id, number: rfi.number },
      });
      publishCoordinationRegisterInBackground(issue.projectId);
      res.status(201).json({ rfi, issue: await prisma.designCoordinationIssue.findUnique({ where: { id: issue.id } }) });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Escalation failed" });
    }
  }
);

const coordDocUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

directoryRouter.post(
  "/coordination/:id/documents",
  requireRoles("admin", "office", "employee", "site_employee"),
  coordDocUpload.single("file"),
  async (req: AuthedRequest, res) => {
    const issue = await prisma.designCoordinationIssue.findUnique({
      where: { id: req.params.id },
      include: { project: { select: { code: true } } },
    });
    if (!issue) return res.status(404).json({ error: "Not found" });
    const file = req.file;
    if (!file) return res.status(400).json({ error: "file required" });
    const { mockOneDrive } = await import("../services/mockOneDrive.js");
    const { MODULE_TO_ISO_FOLDER } = await import("../services/graph.js");
    const folder = MODULE_TO_ISO_FOLDER.designCoordination || "04.04_Clash_Detection_Design_Coordination";
    const rel = `${folder}/${issue.id}`;
    const saved = await mockOneDrive.upload(issue.project.code, rel, file.originalname, file.buffer, file.mimetype);
    const fileUrl = saved.sharePointUrl || saved.url;
    const doc = await prisma.coordinationIssueDocument.create({
      data: {
        issueId: issue.id,
        fileUrl,
        fileName: file.originalname,
        uploadedById: req.user!.id,
      },
    });
    res.status(201).json(doc);
  }
);

export const safetyRouter = Router();
safetyRouter.use(requireAuth);
guardProjectParam(safetyRouter);

safetyRouter.get("/project/:projectId", async (req, res) => {
  const records = await prisma.safetyRecord.findMany({
    where: { projectId: req.params.projectId },
    include: {
      reportedBy: { select: { id: true, fullName: true } },
      assignedTo: { select: { id: true, fullName: true } },
    },
    orderBy: [{ category: "asc" }, { ncrNumber: "asc" }, { occurredAt: "desc" }],
  });
  const open = records.filter((r) => r.status === "Open").length;
  const incidents = records.filter((r) => r.recordType === "Incident" || r.recordType === "Near Miss").length;
  res.json({ records, stats: { total: records.length, open, incidents } });
});

function safetyRecordCreate(body: Record<string, unknown>) {
  const date = (v: unknown) => (v ? new Date(String(v)) : null);
  const str = (v: unknown, fallback = "") => (v != null && v !== "" ? String(v) : fallback);
  const opt = (v: unknown) => (v != null && v !== "" ? String(v) : null);
  return {
    recordType: str(body.recordType, "Observation"),
    title: str(body.title),
    description: opt(body.description),
    severity: str(body.severity, "Low"),
    status: str(body.status, "Open"),
    location: opt(body.location),
    correctiveAction: opt(body.correctiveAction),
    ncrNumber: opt(body.ncrNumber),
    activityTask: opt(body.activityTask),
    category: opt(body.category),
    rootCause: opt(body.rootCause),
    contributingFactors: opt(body.contributingFactors),
    immediateAction: opt(body.immediateAction),
    longTermAction: opt(body.longTermAction),
    responsibleParty: opt(body.responsibleParty),
    targetCompletion: body.targetCompletion ? date(body.targetCompletion) : null,
    timeImpact: opt(body.timeImpact),
    costImpact: opt(body.costImpact),
    actionTaken: opt(body.actionTaken),
    issuedTo: opt(body.issuedTo),
    followUpDate: body.followUpDate ? date(body.followUpDate) : null,
    source: opt(body.source),
    assignedToId: opt(body.assignedToId),
    occurredAt: body.occurredAt ? date(body.occurredAt) ?? new Date() : new Date(),
  };
}

function safetyRecordPatch(body: Record<string, unknown>) {
  const date = (v: unknown) => (v ? new Date(String(v)) : null);
  const patch: Record<string, unknown> = {};
  const set = (key: string, val: unknown, transform?: (v: unknown) => unknown) => {
    if (val !== undefined) patch[key] = transform ? transform(val) : val;
  };
  set("recordType", body.recordType);
  set("title", body.title);
  set("description", body.description);
  set("severity", body.severity);
  set("status", body.status);
  set("location", body.location);
  set("correctiveAction", body.correctiveAction);
  set("ncrNumber", body.ncrNumber);
  set("activityTask", body.activityTask);
  set("category", body.category);
  set("rootCause", body.rootCause);
  set("contributingFactors", body.contributingFactors);
  set("immediateAction", body.immediateAction);
  set("longTermAction", body.longTermAction);
  set("responsibleParty", body.responsibleParty);
  set("targetCompletion", body.targetCompletion, date);
  set("timeImpact", body.timeImpact);
  set("costImpact", body.costImpact);
  set("actionTaken", body.actionTaken);
  set("issuedTo", body.issuedTo);
  set("followUpDate", body.followUpDate, date);
  set("source", body.source);
  set("assignedToId", body.assignedToId);
  set("occurredAt", body.occurredAt, date);
  return patch;
}

safetyRouter.post(
  "/project/:projectId/hira/sync-template",
  requireRoles("admin", "office", "employee", "site_employee"),
  async (req: AuthedRequest, res) => {
    const { syncHiraFromTemplate } = await import("../services/hiraRegister.js");
    try {
      const out = await syncHiraFromTemplate(req.params.projectId, req.user!.id);
      res.json(out);
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : "HIRA sync failed" });
    }
  }
);

safetyRouter.post(
  "/project/:projectId",
  requireRoles("admin", "office", "site_employee", "employee", "vendor"),
  async (req: AuthedRequest, res) => {
    const row = await prisma.safetyRecord.create({
      data: {
        projectId: req.params.projectId,
        ...safetyRecordCreate(req.body || {}),
        reportedById: req.user!.id,
      },
      include: {
        reportedBy: { select: { fullName: true } },
        assignedTo: { select: { fullName: true } },
      },
    });
    await audit("safety.create", { userId: req.user!.id, entity: "SafetyRecord", entityId: row.id });
    if (row.recordType === "NCR") {
      const { notifyNcrStatus } = await import("../services/ncrNotify.js");
      await notifyNcrStatus({
        projectId: req.params.projectId,
        recordId: row.id,
        kind: "SafetyNCR",
        number: row.ncrNumber || row.title,
        status: row.status,
        description: row.description || row.title,
        createdById: req.user!.id,
        event: "created",
      });
      const project = await prisma.project.findUnique({
        where: { id: req.params.projectId },
        select: { name: true, code: true, clientName: true },
      });
      if (project?.code) {
        try {
          const { syncSafetyNcrToDrive } = await import("../services/syncNcrToDrive.js");
          const drive = await syncSafetyNcrToDrive(project, row);
          return res.status(201).json({ ...row, sharePointExports: drive.exports });
        } catch {
          /* optional */
        }
      }
    }
    res.status(201).json(row);
  }
);

safetyRouter.get("/:id", async (req, res) => {
  const row = await prisma.safetyRecord.findUnique({
    where: { id: req.params.id },
    include: {
      reportedBy: { select: { fullName: true } },
      assignedTo: { select: { fullName: true } },
    },
  });
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

safetyRouter.patch("/:id", requireRoles("admin", "office", "site_employee", "employee", "vendor"), async (req: AuthedRequest, res) => {
  const body = req.body || {};
  const existing = await prisma.safetyRecord.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const nextStatus = body.status != null ? String(body.status) : existing.status;
  if (nextStatus === "Closed" && existing.status !== "Closed" && existing.recordType === "NCR") {
    const { safetyNcrMissingFields } = await import("../services/ncrFormExport.js");
    const merged = { ...existing, ...body };
    const missing = safetyNcrMissingFields(merged);
    if (missing.length) {
      return res.status(400).json({
        error: "Complete the Safety NCR form before closing",
        missingFields: missing,
        formUrl: `/projects/${existing.projectId}/ncr-form/safety/${existing.id}`,
      });
    }
  }

  const patch = safetyRecordPatch(body);
  if (body.status === "Closed") patch.closedAt = new Date();
  else if (body.closedAt) patch.closedAt = new Date(String(body.closedAt));
  const row = await prisma.safetyRecord.update({
    where: { id: req.params.id },
    data: patch,
    include: {
      reportedBy: { select: { fullName: true } },
      assignedTo: { select: { fullName: true } },
    },
  });
  await audit("safety.update", { userId: req.user!.id, entity: "SafetyRecord", entityId: row.id });
  if (row.recordType === "NCR") {
    const { notifyNcrStatus, resolveNcrContractorEmail } = await import("../services/ncrNotify.js");
    const contractorEmail = await resolveNcrContractorEmail(row.projectId, null, row.responsibleParty || row.issuedTo);
    await notifyNcrStatus({
      projectId: row.projectId,
      recordId: row.id,
      kind: "SafetyNCR",
      number: row.ncrNumber || row.title,
      status: row.status,
      description: row.description || row.title,
      createdById: req.user!.id,
      event: row.status === "Closed" && existing.status !== "Closed" ? "closed" : "updated",
      contractorEmail,
      contractorName: row.responsibleParty || row.issuedTo,
      location: row.location,
      plannedClosure: row.targetCompletion,
      formParsed: {
        correctiveAction: row.correctiveAction,
        actionTaken: row.actionTaken,
        rootCause: row.rootCause,
      },
    });
  }
  const project = await prisma.project.findUnique({
    where: { id: row.projectId },
    select: { name: true, code: true, clientName: true },
  });
  let sharePointExports: { kind: string; path: string; url?: string | null }[] = [];
  if (row.recordType === "NCR" && project?.code) {
    try {
      const { syncSafetyNcrToDrive } = await import("../services/syncNcrToDrive.js");
      const drive = await syncSafetyNcrToDrive(project, row);
      sharePointExports = drive.exports;
    } catch {
      /* optional */
    }
  }
  res.json({ ...row, sharePointExports });
});

safetyRouter.post("/:id/follow-up", requireRoles("admin", "office"), async (req: AuthedRequest, res) => {
  const existing = await prisma.safetyRecord.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.recordType !== "NCR") return res.status(404).json({ error: "Safety NCR not found" });
  if (existing.status === "Closed") return res.status(400).json({ error: "Cannot follow up on a closed NCR" });

  const { notifyNcrFollowUp, resolveNcrContractorEmail } = await import("../services/ncrNotify.js");
  const contractorEmail = await resolveNcrContractorEmail(
    existing.projectId,
    null,
    existing.responsibleParty || existing.issuedTo
  );
  const followUpNumber = (existing.followUpDate ? 2 : 1) as number;
  const email = await notifyNcrFollowUp({
    projectId: existing.projectId,
    recordId: existing.id,
    kind: "SafetyNCR",
    number: existing.ncrNumber || existing.title,
    status: existing.status,
    description: existing.description || existing.title,
    createdById: req.user!.id,
    contractorEmail,
    contractorName: existing.responsibleParty || existing.issuedTo,
    location: existing.location,
    plannedClosure: existing.targetCompletion,
    followUpNumber,
    note: req.body?.note ? String(req.body.note) : null,
  });

  await prisma.safetyRecord.update({
    where: { id: existing.id },
    data: { followUpDate: new Date() },
  });

  await audit("safety.ncr.follow-up", {
    userId: req.user!.id,
    entity: "SafetyRecord",
    entityId: existing.id,
    meta: { followUpNumber },
  });

  res.json({ ok: true, followUpNumber, email });
});

safetyRouter.get("/:id/export.xlsx", async (req, res) => {
  const row = await prisma.safetyRecord.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "Not found" });
  const project = await prisma.project.findUnique({
    where: { id: row.projectId },
    select: { name: true, code: true, clientName: true },
  });
  const { buildSafetyNcrXlsxFromTemplate } = await import("../services/ncrFormExport.js");
  const { stampSpdcWorkbookLogo } = await import("../services/brandedExport.js");
  const buf = await stampSpdcWorkbookLogo(await buildSafetyNcrXlsxFromTemplate(row, project || undefined));
  const name = `${row.ncrNumber || row.title || "Safety-NCR"}.xlsx`.replace(/[^\w.-]+/g, "_");
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
  res.send(buf);
});

safetyRouter.get("/:id/export.html", async (req, res) => {
  const row = await prisma.safetyRecord.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "Not found" });
  const project = await prisma.project.findUnique({
    where: { id: row.projectId },
    select: { name: true, code: true, clientName: true },
  });
  const { buildSafetyNcrHtml } = await import("../services/ncrFormExport.js");
  const webOrigin = process.env.WEB_ORIGIN || process.env.VITE_WEB_ORIGIN || "https://portal.spdc.in";
  const html = buildSafetyNcrHtml(row, project || undefined, `${webOrigin.replace(/\/$/, "")}/logo-transparent.png`);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

safetyRouter.get("/:id/export.pdf", async (req, res) => {
  const row = await prisma.safetyRecord.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ error: "Not found" });
  const project = await prisma.project.findUnique({
    where: { id: row.projectId },
    select: { name: true, code: true, clientName: true },
  });
  const { buildSafetyNcrPdf } = await import("../services/ncrFormExport.js");
  const buf = await buildSafetyNcrPdf(row, project || undefined);
  const name = `${row.ncrNumber || row.title || "Safety-NCR"}.pdf`.replace(/[^\w.-]+/g, "_");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
  res.send(buf);
});
