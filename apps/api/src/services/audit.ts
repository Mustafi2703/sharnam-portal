import { prisma } from "../prisma.js";

export async function audit(
  action: string,
  opts: { userId?: string; entity?: string; entityId?: string; meta?: unknown } = {}
) {
  await prisma.auditEvent.create({
    data: {
      action,
      userId: opts.userId,
      entity: opts.entity,
      entityId: opts.entityId,
      metaJson: opts.meta ? JSON.stringify(opts.meta) : null,
    },
  });
}
