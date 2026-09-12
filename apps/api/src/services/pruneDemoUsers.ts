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
    const retiredEmail = `deleted.${stamp}.${email.replace("@", "_at_")}`.slice(0, 180);
    await db.projectMember.deleteMany({ where: { userId: u.id } });
    await db.employeeProfile.deleteMany({ where: { userId: u.id } });
    await db.user.update({
      where: { id: u.id },
      data: {
        isActive: false,
        email: retiredEmail,
        fullName: `[Removed] ${u.fullName}`.slice(0, 200),
      },
    });
    removed.push(email);
  }
  return { kept: users.filter((u) => isKeptPortalEmail(u.email)).length, removed };
}
