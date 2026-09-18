/**
 * Smoke-test WPR template PPTX + PDF export locally.
 *   npx tsx scripts/wpr-export-test.mts
 */
import fs from "node:fs";
import path from "node:path";
import { buildJulyWprPack } from "../apps/api/src/services/wprJulyWorkbook.ts";
import { buildWprPptx } from "../apps/api/src/services/wprPptx.ts";
import { wprTemplateAvailable } from "../apps/api/src/services/wprPptxTemplate.ts";
import { convertWprPptxToPdf, pdfEngineAvailable } from "../apps/api/src/services/wprPdf.ts";

async function main() {
  const pack = buildJulyWprPack();
  console.log("Template available:", wprTemplateAvailable());
  console.log("PDF engine available:", await pdfEngineAvailable());

  const pptx = await buildWprPptx(pack);
  const outDir = path.join(process.cwd(), "docs", "client-share");
  fs.mkdirSync(outDir, { recursive: true });
  const pptxPath = path.join(outDir, "WPR-Template-Export-Test.pptx");
  fs.writeFileSync(pptxPath, pptx);
  console.log("Wrote", pptxPath, pptx.length, "bytes");

  try {
    const { buffer, engine } = await convertWprPptxToPdf(pptx, pack.header.projectCode || "DEMO");
    const pdfPath = path.join(outDir, "WPR-Template-Export-Test.pdf");
    fs.writeFileSync(pdfPath, buffer);
    console.log("Wrote", pdfPath, buffer.length, "bytes via", engine);
  } catch (err) {
    console.warn("PDF skipped:", err instanceof Error ? err.message : err);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
