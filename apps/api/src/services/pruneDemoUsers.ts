import type { PrismaClient } from "@prisma/client";
import { isKeptPortalEmail } from "./keepPortalUsers.js";

/** Soft-remove demo / leftover logins. Kept users stay active. */
export async function pruneDemoUsers(db: PrismaClient) {
  const users = await db.user.findMany({
    select: { id: true, email: true, fullName: true, isActive: true },
  });
  const removed: string[] = [];
  for (const u of users) {
    const email = u.email.toLowerCase();
    if (isKeptPortalEmail(email)) continue;
    if (email.startsWith("deleted.")) continue;
    const stamp = Date.now();
    const retiredEmail = `deleted.${stamp}.${u.id.slice(-8)}.${email.replace("@", "_at_")}`.slice(0, 180);
    await db.projectMember.deleteMany({ where: { userId: u.id } }).catch(() => undefined);
    await db.employeeProfile.deleteMany({ where: { userId: u.id } }).catch(() => undefined);
    await db.user.update({
      where: { id: u.id },
      data: {
        isActive: false,
        vendorId: null,
        email: retiredEmail,
        fullName: `[Removed] ${u.fullName}`.slice(0, 200),
      },
    });
    removed.push(email);
  }
  await db.user.updateMany({
    where: { email: { in: ["nirav@spdc.in", "saurabh@spdc.in"] } },
    data: { role: "admin", portal: "admin", isActive: true },
  });
  await retireOperationsMailbox(db);
  return { kept: users.filter((u) => isKeptPortalEmail(u.email)).length, removed };
}

const RETIRED_MAILBOX = "operations@spdc.in";
const SAURABH_MAILBOX = "saurabh@spdc.in";

/** Retire the old operations mailbox. Saurabh stays on saurabh@spdc.in. */
export async function retireOperationsMailbox(db: PrismaClient) {
  const opsRows = await db.communicationContact.findMany({
    where: { email: RETIRED_MAILBOX },
    select: { id: true, projectId: true, matrixKind: true },
  });
  for (const row of opsRows) {
    const dup = await db.communicationContact.findFirst({
      where: {
        id: { not: row.id },
        projectId: row.projectId,
        matrixKind: row.matrixKind,
        email: SAURABH_MAILBOX,
        isSectionHeader: false,
      },
      select: { id: true },
    });
    if (dup) await db.communicationContact.delete({ where: { id: row.id } });
    else await db.communicationContact.update({ where: { id: row.id }, data: { email: SAURABH_MAILBOX } });
  }

  const projects = await db.project.findMany({
    where: { notificationEmails: { contains: RETIRED_MAILBOX } },
    select: { id: true, notificationEmails: true },
  });
  for (const project of projects) {
    const next = (project.notificationEmails || "")
      .split(/[,;\s]+/)
      .map((part) => part.trim())
      .filter((part) => part && part.toLowerCase() !== RETIRED_MAILBOX);
    await db.project.update({
      where: { id: project.id },
      data: { notificationEmails: next.length ? next.join(", ") : null },
    });
  }

  await db.vendorContact.deleteMany({ where: { email: RETIRED_MAILBOX } }).catch(() => undefined);

  const user = await db.user.findUnique({ where: { email: RETIRED_MAILBOX } });
  if (!user) return;
  const retiredEmail = `deleted.${Date.now()}.${user.id.slice(-8)}.operations_at_spdc.in`.slice(0, 180);
  await db.projectMember.deleteMany({ where: { userId: user.id } }).catch(() => undefined);
  await db.employeeProfile.deleteMany({ where: { userId: user.id } }).catch(() => undefined);
  await db.user.update({
    where: { id: user.id },
    data: {
      isActive: false,
      vendorId: null,
      email: retiredEmail,
      fullName: "[Removed] SPDC Operations",
    },
  });
}
