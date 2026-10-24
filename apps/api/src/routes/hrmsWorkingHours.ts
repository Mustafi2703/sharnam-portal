import { Router } from "express";
import { requireRoles, type AuthedRequest } from "../auth.js";
import { audit } from "../services/audit.js";
import {
  addWorkingHour,
  deleteWorkingHour,
  listWorkingHours,
  updateWorkingHour,
  WorkingHoursError,
  WORKING_HOURS_SETTING_KEY,
} from "../services/hrmsWorkingHours.js";

function sendError(res: { status: (code: number) => { json: (body: unknown) => void } }, err: unknown) {
  if (err instanceof WorkingHoursError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: "Could not update working hours" });
}

/** Mounted on the HR router after requireAuth. */
export function mountHrmsWorkingHours(router: Router) {
  router.get("/working-hours", async (_req, res) => {
    res.json(await listWorkingHours());
  });

  router.post("/working-hours", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
    try {
      const option = await addWorkingHour(req.body?.label);
      await audit("hrms.working_hours.add", {
        userId: req.user!.id,
        entity: "AppSetting",
        entityId: WORKING_HOURS_SETTING_KEY,
        meta: option,
      });
      res.status(201).json(option);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.patch("/working-hours/:id", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
    try {
      const option = await updateWorkingHour(req.params.id, req.body?.label);
      await audit("hrms.working_hours.update", {
        userId: req.user!.id,
        entity: "AppSetting",
        entityId: WORKING_HOURS_SETTING_KEY,
        meta: option,
      });
      res.json(option);
    } catch (err) {
      sendError(res, err);
    }
  });

  router.delete("/working-hours/:id", requireRoles("admin", "office", "hr"), async (req: AuthedRequest, res) => {
    try {
      await deleteWorkingHour(req.params.id);
      await audit("hrms.working_hours.delete", {
        userId: req.user!.id,
        entity: "AppSetting",
        entityId: WORKING_HOURS_SETTING_KEY,
        meta: { id: req.params.id },
      });
      res.json({ ok: true });
    } catch (err) {
      sendError(res, err);
    }
  });
}
