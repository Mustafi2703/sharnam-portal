import { prisma } from "../prisma.js";
import { errorDetail, pushRuntimeLog } from "./runtimeLog.js";

export async function audit(
  action: string,
  opts: { userId?: string; entity?: string; entityId?: string; meta?: unknown } = {}
) {
  try {
    await prisma.auditEvent.create({
      data: {
        action,
        userId: opts.userId,
        entity: opts.entity,
        entityId: opts.entityId,
        metaJson: opts.meta ? JSON.stringify(opts.meta) : null,
      },
    });
  } catch (err) {
    pushRuntimeLog({
      level: "error",
      source: "audit",
      message: `Could not write audit event: ${action}`,
      detail: errorDetail(err),
      userId: opts.userId,
    });
  }
}
