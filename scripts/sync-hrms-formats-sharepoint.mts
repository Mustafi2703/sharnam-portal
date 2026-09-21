/**
 * Upload SPDC HR letter templates from apps/api/formats/hrms/ to the _HR SharePoint vault.
 *
 * Target: _HR/06_HR_AND_ADMIN/06.04_Letter_Templates/
 *
 * Usage: npm run hrms:sync-formats
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { applyDatabaseUrl } from "./resolve-database-url.mjs";
import { mockOneDrive } from "../apps/api/src/services/mockOneDrive.ts";
import { ensureHrCompanyTree } from "../apps/api/src/services/hrEmployeeVault.ts";

applyDatabaseUrl();

const SOURCE = path.join(process.cwd(), "apps/api/formats/hrms");
const TARGET = "06_HR_AND_ADMIN/06.04_Letter_Templates";

const MIME: Record<string, string> = {
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

async function main() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Missing source folder: ${SOURCE}`);
  }

  await ensureHrCompanyTree();
  const files = fs.readdirSync(SOURCE).filter((f) => !f.startsWith("."));
  if (!files.length) throw new Error("No template files found.");

  console.log(`Uploading ${files.length} file(s) to _HR/${TARGET}/ …`);
  console.log(`MOCK_ONEDRIVE=${process.env.MOCK_ONEDRIVE ?? "true"}`);

  for (const name of files.sort()) {
    const abs = path.join(SOURCE, name);
    if (!fs.statSync(abs).isFile()) continue;
    const ext = path.extname(name).toLowerCase();
    const buf = fs.readFileSync(abs);
    const saved = await mockOneDrive.upload("_HR", TARGET, name, buf, MIME[ext] || "application/octet-stream", {
      replace: true,
    });
    console.log(`  ✓ ${name} → ${saved.sharePointUrl || saved.url || saved.path}`);
  }

  console.log(`\nDone. Templates live at _HR/${TARGET}/ on the HR vault drive.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
