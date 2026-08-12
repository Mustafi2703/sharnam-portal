/**
 * Optional prisma db push during Hostinger build — never fails the build.
 */
import { runDbBoot } from "./hostinger-db-boot.mjs";
import { applyDatabaseUrl } from "./resolve-database-url.mjs";

applyDatabaseUrl();
if (!process.env.MYSQL_USER && !process.env.DATABASE_URL?.startsWith("mysql://")) {
  console.log("SKIP hostinger-db-push: MYSQL_* not set at build time");
  process.exit(0);
}

const ok = await runDbBoot(process.cwd());
if (!ok) {
  console.warn("WARN: build-time db push failed — app will retry at startup");
}
process.exit(0);
