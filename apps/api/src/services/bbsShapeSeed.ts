/**
 * BBS shape master — starter catalogue + information-sheet builders.
 *
 * The 15 shapes below cover ~95 % of ordinary reinforcement drawings and are
 * lifted from IS-2502 (SP-34) and BS-8666 nomenclature. Every entry ships with:
 *   - shapeCode           (letter or SP-34 number)
 *   - name / description  (human-readable, sortable)
 *   - parameters          (comma-separated labels the BBS row will collect)
 *   - cutFormula          (cutting length in mm using those labels + d)
 *   - standardRef         (IS or BS reference for the QA / audit trail)
 *
 * The formulas keep to the Indian conventions where d = bar diameter (mm), so
 * the site engineer only needs the parameter values written on the bar-bending
 * schedule. Diagrams are uploaded per shape from the panel (email → drop-in).
 */
import path from "path";
import fs from "fs";
import ExcelJS from "exceljs";
import { prisma } from "../prisma.js";
import { sharnamLogoDataUri, sharnamLogoPath } from "./brandedExport.js";

export type SeedShape = {
  shapeCode: string;
  name: string;
  description: string;
  packageHint: string;
  parameters: string;
  cutFormula: string;
  standardRef: string;
  bendInfo: string;
};

export const STANDARD_SHAPES: SeedShape[] = [
  { shapeCode: "SR", name: "Straight bar", description: "Plain straight bar, no bends.", packageHint: "", parameters: "A", cutFormula: "A", standardRef: "IS-2502 · Type 00", bendInfo: "No bends" },
  { shapeCode: "L", name: "L-bend (single 90°)", description: "One 90° bend at end.", packageHint: "", parameters: "A,B", cutFormula: "A + B - d", standardRef: "IS-2502 · Type 12", bendInfo: "1 × 90° bend" },
  { shapeCode: "U", name: "U-bar (double 90°)", description: "Two 90° bends forming U.", packageHint: "", parameters: "A,B,C", cutFormula: "A + B + C - 2*d", standardRef: "IS-2502 · Type 24", bendInfo: "2 × 90° bends" },
  { shapeCode: "Z", name: "Z-bar (crank)", description: "Crank bar with two opposing 90° bends.", packageHint: "", parameters: "A,B,C", cutFormula: "A + B + C - 2*d", standardRef: "IS-2502 · Type 26", bendInfo: "2 × 90° bends" },
  { shapeCode: "H", name: "Hook bar", description: "Straight bar with standard 180° hook one end.", packageHint: "", parameters: "A", cutFormula: "A + 9*d", standardRef: "IS-2502 · Type 21", bendInfo: "1 × 180° hook" },
  { shapeCode: "HH", name: "Double-hook bar", description: "Standard 180° hook both ends.", packageHint: "", parameters: "A", cutFormula: "A + 18*d", standardRef: "IS-2502 · Type 22", bendInfo: "2 × 180° hooks" },
  { shapeCode: "T", name: "T-bar (three-legged)", description: "Straight bar with an intermediate 90° branch.", packageHint: "Compound Wall BBS", parameters: "A,B,C", cutFormula: "A + B + C - 2*d", standardRef: "IS-2502 · Type 34", bendInfo: "2 × 90° bends" },
  { shapeCode: "STIR-R", name: "Rectangular stirrup", description: "Standard rectangular column / beam stirrup with 135° hooks.", packageHint: "Dormitory BBS", parameters: "A,B", cutFormula: "2*A + 2*B + 20*d", standardRef: "IS-2502 · Type 51", bendInfo: "4 × 90° + 2 × 135° hooks" },
  { shapeCode: "STIR-S", name: "Square stirrup", description: "Square stirrup, single dimension A.", packageHint: "Dormitory BBS", parameters: "A", cutFormula: "4*A + 20*d", standardRef: "IS-2502 · Type 52", bendInfo: "4 × 90° + 2 × 135° hooks" },
  { shapeCode: "STIR-T", name: "Triangular stirrup", description: "Three-sided stirrup for beams with three legs.", packageHint: "Dormitory BBS", parameters: "A,B", cutFormula: "2*A + B + 20*d", standardRef: "IS-2502 · Type 53", bendInfo: "3 × 60° + 2 × 135° hooks" },
  { shapeCode: "STIR-C", name: "Circular stirrup / helical", description: "Circular tie for round columns and piles.", packageHint: "UGWT BBS", parameters: "D", cutFormula: "3.1416 * (D - 2*d) + 20*d", standardRef: "IS-2502 · Type 54", bendInfo: "Closed circular" },
  { shapeCode: "CR", name: "Crank bar (staggered)", description: "Bar with slope crank in middle for beam depth change.", packageHint: "Septic Tank BBS", parameters: "A,B,C,D", cutFormula: "A + B + C + D - 4*d", standardRef: "IS-2502 · Type 56", bendInfo: "2 × 45° cranks" },
  { shapeCode: "TB", name: "Trussed bar", description: "Truss / bent-up bar for slabs and beams.", packageHint: "", parameters: "A,B,C,D,E", cutFormula: "A + B + C + D + E - 4*d", standardRef: "IS-2502 · Type 62", bendInfo: "4 × 30° cranks" },
  { shapeCode: "SP", name: "Spiral (helical)", description: "Helical column spiral tie.", packageHint: "UGWT BBS", parameters: "D,P,N", cutFormula: "N * sqrt((3.1416*(D - 2*d))^2 + P^2)", standardRef: "IS-2502 · Type 71", bendInfo: "Helical, pitch P × N turns" },
  { shapeCode: "SQ", name: "Closed square link", description: "Closed lap-welded square link.", packageHint: "Compound Wall BBS", parameters: "A", cutFormula: "4*A + 24*d", standardRef: "IS-2502 · Type 55", bendInfo: "4 × 90° + closing lap 12d" },
];

export async function seedStandardBbsShapes(): Promise<{ created: number; updated: number; total: number }> {
  let created = 0;
  let updated = 0;
  for (const s of STANDARD_SHAPES) {
    const existing = await prisma.bbsShapeMaster.findUnique({ where: { shapeCode: s.shapeCode } });
    if (existing) {
      await prisma.bbsShapeMaster.update({
        where: { id: existing.id },
        data: {
          name: s.name,
          description: s.description,
          bendInfo: s.bendInfo,
          packageHint: s.packageHint || null,
          parameters: s.parameters,
          cutFormula: s.cutFormula,
          standardRef: s.standardRef,
        },
      });
      updated += 1;
    } else {
      await prisma.bbsShapeMaster.create({
        data: {
          shapeCode: s.shapeCode,
          name: s.name,
          description: s.description,
          bendInfo: s.bendInfo,
          packageHint: s.packageHint || null,
          parameters: s.parameters,
          cutFormula: s.cutFormula,
          standardRef: s.standardRef,
        },
      });
      created += 1;
    }
  }
  return { created, updated, total: STANDARD_SHAPES.length };
}

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

/** Sharnam-branded printable "shape with code" reference sheet. */
export async function buildShapeInfoHtml(): Promise<string> {
  const rows = await prisma.bbsShapeMaster.findMany({ orderBy: { shapeCode: "asc" } });
  const logo = sharnamLogoDataUri();
  const cards = rows
    .map(
      (r) => `
      <div class="card">
        <div class="head">
          <span class="code">${esc(r.shapeCode)}</span>
          <span class="name">${esc(r.name || "—")}</span>
          <span class="ref">${esc(r.standardRef || "")}</span>
        </div>
        <div class="body">
          <div class="diag">
            ${
              r.diagramUrl || r.diagramPath
                ? `<img src="${esc(r.diagramUrl || `/uploads/onedrive/${r.diagramPath}`)}" alt="${esc(r.shapeCode)}" />`
                : `<div class="no-diag">upload diagram from panel</div>`
            }
          </div>
          <div class="meta">
            <div class="row"><span class="k">Parameters</span><span class="v mono">${esc(r.parameters || "—")}</span></div>
            <div class="row"><span class="k">Cutting length</span><span class="v mono">${esc(r.cutFormula || "—")}</span></div>
            <div class="row"><span class="k">Bend info</span><span class="v">${esc(r.bendInfo || "—")}</span></div>
            <div class="row"><span class="k">Package</span><span class="v">${esc(r.packageHint || "All packages")}</span></div>
            <div class="row"><span class="k">Notes</span><span class="v">${esc(r.description || "—")}</span></div>
          </div>
        </div>
      </div>`
    )
    .join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>BBS Shape Master · Sharnam PMC</title>
<style>
  @page { size: A4; margin: 10mm 12mm; }
  body { font-family: "Inter","Segoe UI",Arial,sans-serif; color:#111; font-size:10.5px; margin:0; }
  .letterhead { display:flex; align-items:center; gap:14px; border-bottom:2px solid #b28c3c; padding-bottom:8px; margin-bottom:12px; }
  .letterhead img { height:48px; }
  .letterhead h1 { margin:0; font-size:15px; color:#b28c3c; letter-spacing:.3px; }
  .letterhead .co { font-size:10px; color:#444; }
  .letterhead .doc { text-align:right; font-size:10px; color:#555; }
  .letterhead .doc b { color:#111; font-size:12px; }
  .lead { background:#fdf6e3; border:1px solid #e2d5aa; padding:6px 10px; margin-bottom:8px; font-size:10px; border-radius:4px; }
  .grid { display:grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .card { border:1px solid #d6c691; border-radius:4px; padding:8px 10px; background:#fefaf1; break-inside: avoid; }
  .card .head { display:flex; align-items:baseline; gap:8px; border-bottom:1px dashed #d6c691; padding-bottom:4px; margin-bottom:5px; }
  .card .code { font-family: "IBM Plex Mono", monospace; font-weight:700; color:#4a3a12; font-size:13px; }
  .card .name { flex:1; font-weight:600; color:#111; font-size:11px; }
  .card .ref { color:#6b5a2e; font-size:9.5px; font-style:italic; }
  .card .body { display:flex; gap:8px; }
  .card .diag { width:78px; height:56px; border:1px solid #d6c691; background:#fff; display:flex; align-items:center; justify-content:center; overflow:hidden; border-radius:3px; }
  .card .diag img { max-width:100%; max-height:100%; object-fit:contain; }
  .card .diag .no-diag { font-size:8.5px; color:#a89263; text-align:center; padding:4px; line-height:1.2; }
  .card .meta { flex:1; }
  .card .row { display:flex; gap:6px; padding:1px 0; }
  .card .row .k { width:78px; color:#6b5a2e; text-transform:uppercase; font-size:8.5px; letter-spacing:.4px; }
  .card .row .v { flex:1; color:#111; font-size:10px; }
  .card .row .v.mono { font-family:"IBM Plex Mono", monospace; font-size:9.5px; }
  .footer { border-top:1px solid #ddd; margin-top:10px; padding-top:5px; color:#666; font-size:9.5px; display:flex; justify-content:space-between; }
</style></head><body>
  <div class="letterhead">
    ${logo ? `<img src="${logo}" alt="Sharnam" />` : ""}
    <div style="flex:1"><h1>Sharnam Project Development Consultants &amp; Co.</h1>
      <div class="co">Project management consultancy · Ahmedabad, India</div></div>
    <div class="doc"><b>BBS Shape Master</b><br />Shape with code · information sheet<br />${rows.length} shapes on file</div>
  </div>
  <div class="lead">
    Every BBS row on this project can pick the <strong>shape code</strong> below. The <em>Cutting length</em> formula uses parameter labels (A, B, …) captured on the BBS row and <code>d</code> = bar diameter (mm). Add project-specific shapes from Master → BBS shape codes; drop your bend diagram from the panel and it appears here on next print.
  </div>
  <div class="grid">${cards}</div>
  <div class="footer">
    <span>Generated ${new Date().toLocaleString("en-IN")}</span>
    <span>Sharnam PMC · Master → BBS shape library · Confidential</span>
  </div>
</body></html>`;
}

/** Branded XLSX of the same master — mail-friendly for site engineers. */
export async function buildShapeInfoXlsx(): Promise<{ buffer: Buffer; filename: string }> {
  const rows = await prisma.bbsShapeMaster.findMany({ orderBy: { shapeCode: "asc" } });
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sharnam PMC Portal";
  wb.created = new Date();
  const logoPath = sharnamLogoPath();
  const ws = wb.addWorksheet("BBS Shape Master");
  if (logoPath && fs.existsSync(logoPath)) {
    try {
      const id = wb.addImage({ filename: logoPath, extension: "png" });
      ws.addImage(id, { tl: { col: 0.1, row: 0.1 }, ext: { width: 110, height: 55 } });
    } catch {
      /* logo optional */
    }
  }
  ws.mergeCells("B1:H1");
  ws.getCell("B1").value = "Sharnam PMC · BBS Shape Master — shape with code information sheet";
  ws.getCell("B1").font = { bold: true, size: 13, color: { argb: "FFB28C3C" } };
  ws.mergeCells("B2:H2");
  ws.getCell("B2").value = `${rows.length} shapes on file · d = bar diameter (mm) · parameters as captured on BBS row`;
  ws.getCell("B2").font = { italic: true, size: 10 };
  ws.getRow(4).values = ["Code", "Name", "Reference", "Parameters", "Cutting length formula", "Bend info", "Package", "Notes"];
  ws.getRow(4).font = { bold: true, color: { argb: "FF4A3A12" } };
  ws.getRow(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFE4C4" } };
  const widths = [10, 24, 22, 16, 34, 30, 22, 40];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  rows.forEach((r) => {
    ws.addRow([
      r.shapeCode,
      r.name || "—",
      r.standardRef || "—",
      r.parameters || "—",
      r.cutFormula || "—",
      r.bendInfo || "—",
      r.packageHint || "All packages",
      r.description || "—",
    ]);
  });
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: 8 } };
  const ab = await wb.xlsx.writeBuffer();
  return { buffer: Buffer.from(ab as ArrayBuffer), filename: `Sharnam-BBS-Shape-Master-${new Date().toISOString().slice(0, 10)}.xlsx` };
}
