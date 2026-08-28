/**
 * Pre-migration dedupe for Hostinger MySQL.
 *
 * Prisma's `db push` refuses to add `@@unique([srNo, sourceSheet])` on `Lead`
 * when existing rows already share the same (non-NULL) pair — that's the
 * "There might be data loss" warning that keeps failing builds.
 *
 * We neutralise the conflicting pairs BEFORE the schema change by suffixing
 * `sourceSheet` on all but the earliest duplicate row.  Effect: nothing is
 * deleted, no seeded lead is lost, and the unique constraint applies cleanly.
 *
 * Safe if the Lead table doesn't exist yet (fresh DB) — MySQL raises 1146 and
 * we swallow that specific error.
 */
import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyDatabaseUrl } from "./resolve-database-url.mjs";

const url = applyDatabaseUrl();

if (!url.startsWith("mysql://")) {
  console.log("SKIP dedupe: MYSQL_* not set");
  process.exit(0);
}

const DEDUPE_SQL = `
UPDATE \`Lead\` t
JOIN (
  SELECT srNo, sourceSheet, MIN(id) AS keep_id
  FROM \`Lead\`
  WHERE srNo IS NOT NULL AND sourceSheet IS NOT NULL
  GROUP BY srNo, sourceSheet
  HAVING COUNT(*) > 1
) d
  ON d.srNo = t.srNo
 AND d.sourceSheet = t.sourceSheet
SET t.sourceSheet = CONCAT(t.sourceSheet, '#dup-', SUBSTRING(t.id, 1, 8))
WHERE t.id <> d.keep_id;
`.trim();

const tmp = join(tmpdir(), `sharnam-lead-dedupe-${Date.now()}.sql`);
writeFileSync(tmp, DEDUPE_SQL + "\n", "utf8");

try {
  console.log("==> Pre-push: neutralising duplicate Lead(srNo, sourceSheet) pairs, if any…");
  execSync(`npx prisma db execute --schema prisma/schema.prisma --file "${tmp}"`, {
    stdio: "inherit",
    env: process.env,
    timeout: 60_000,
  });
  console.log("==> Dedupe OK (or no duplicates to fix).");
} catch (err) {
  const msg = String(err?.message || err);
  if (/1146|doesn.t exist|Unknown table/i.test(msg)) {
    console.log("==> Lead table not present yet (fresh DB) — no dedupe needed.");
  } else {
    console.warn("WARN: dedupe step failed — continuing to db push anyway.");
    console.warn(msg);
  }
} finally {
  try { unlinkSync(tmp); } catch { /* ignore */ }
}
