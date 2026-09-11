/**
 * Generate the 23–29 July 2026 WPR PowerPoint from the client week workbook.
 *
 *   npx tsx scripts/generate-july-wpr-pptx.mts
 *
 * Output: docs/client-share/WPR-Arvind-23-29-Jul-2026.pptx
 */
import fs from "node:fs";
import path from "node:path";
import { buildJulyWprPack } from "../apps/api/src/services/wprJulyWorkbook.ts";
import { buildWprPptx } from "../apps/api/src/services/wprPptx.ts";
import { buildWprWorkbook } from "../apps/api/src/services/wprXlsx.ts";

async function main() {
  const pack = buildJulyWprPack();
  const [pptxBuf, xlsxBuf] = await Promise.all([buildWprPptx(pack), buildWprWorkbook(pack)]);
  const outDir = path.join(process.cwd(), "docs", "client-share");
  fs.mkdirSync(outDir, { recursive: true });
  const pptxName = "WPR-Arvind-23-29-Jul-2026.pptx";
  const xlsxName = "WPR-Arvind-23-29-Jul-2026.xlsx";
  fs.writeFileSync(path.join(outDir, pptxName), pptxBuf);
  fs.writeFileSync(path.join(outDir, xlsxName), xlsxBuf);
  console.log(`Wrote ${path.join(outDir, pptxName)} (${pptxBuf.length} bytes)`);
  console.log(`Wrote ${path.join(outDir, xlsxName)} (${xlsxBuf.length} bytes)`);
  console.log(`Week ${pack.header.weekStart} → ${pack.header.weekEnd} · report ${pack.header.reportNumber}`);
  const keys = Object.entries(pack.sections).map(([k, s]) => `${k}:${s?.rows?.length || 0}`);
  console.log("Sections", keys.join(" · "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
