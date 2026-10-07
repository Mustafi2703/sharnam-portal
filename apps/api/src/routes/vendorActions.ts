import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, requireRoles, type AuthedRequest } from "../auth.js";
import { resolveVendorForUser } from "../services/vendorPortal.js";
import { vendorActions } from "../services/vendorActions.js";

/** Contractor action desk — NCR / CAR, safety NCs and RA bills waiting on (or about) this vendor. */
export const vendorActionsRouter = Router();
vendorActionsRouter.use(requireAuth);

vendorActionsRouter.get("/", requireRoles("vendor"), async (req: AuthedRequest, res) => {
  const vendor = await resolveVendorForUser(req.user!);
  if (!vendor) return res.status(403).json({ error: "Vendor account not linked to a company" });
  res.json(await vendorActions(prisma, vendor, req.user!.id));
});
