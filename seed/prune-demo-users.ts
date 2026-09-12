import { prisma } from "../apps/api/src/prisma.ts";
import { pruneDemoUsers } from "../apps/api/src/services/pruneDemoUsers.ts";
import { KEEP_PORTAL_EMAILS } from "../apps/api/src/services/keepPortalUsers.ts";

const out = await pruneDemoUsers(prisma);
console.log(`Kept ${out.kept} live logins: ${KEEP_PORTAL_EMAILS.join(", ")}`);
console.log(`Removed ${out.removed.length} leftover users: ${out.removed.join(", ") || "none"}`);
await prisma.$disconnect();
