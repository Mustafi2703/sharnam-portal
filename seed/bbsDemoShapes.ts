/**
 * Attach demo bend-diagram SVGs to sample BBS rows (client walkthrough).
 * Idempotent — skips rows that already have a diagram unless force=true.
 */
import fs from "fs";
import path from "path";
import type { PrismaClient } from "@prisma/client";

const BBS_FOLDER = "07_EXECUTION_AND_DELIVERY/07.06_Method_Statements_and_Temporary_Works";

function bendSvg(mark: string, shapeCode: string, diaMm: number, location: string) {
  const d = diaMm > 0 ? `${diaMm} mm` : "12 mm";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="200" viewBox="0 0 420 200">
  <rect width="420" height="200" fill="#f8fafc"/>
  <text x="16" y="28" font-family="Arial,sans-serif" font-size="14" font-weight="bold" fill="#1e293b">Mark ${mark} · Shape ${shapeCode}</text>
  <text x="16" y="48" font-family="Arial,sans-serif" font-size="11" fill="#64748b">${location.slice(0, 48)} · Ø ${d}</text>
  <g stroke="#dc2626" stroke-width="4" fill="none" stroke-linecap="round" transform="translate(40,70)">
    <path d="M20,80 L20,20 L120,20"/>
    <path d="M160,80 L160,20 L260,20" opacity="0.35"/>
    <circle cx="20" cy="80" r="6" fill="#dc2626"/>
    <circle cx="120" cy="20" r="6" fill="#dc2626"/>
  </g>
  <text x="16" y="185" font-family="Arial,sans-serif" font-size="10" fill="#94a3b8">SPDC BBS demo · annotated bend diagram</text>
</svg>`;
}

export async function seedBbsDemoShapes(
  prisma: PrismaClient,
  projectId: string,
  projectCode: string,
  opts?: { force?: boolean; limit?: number }
) {
  const limit = opts?.limit ?? 8;
  const existing = await prisma.costBbsLine.count({
    where: { projectId, shapeDiagramPath: { not: null } },
  });
  if (!opts?.force && existing >= 3) {
    console.log("BBS demo shapes: skipped (already", existing, "diagrams)");
    return existing;
  }

  const lines = await prisma.costBbsLine.findMany({
    where: { projectId },
    orderBy: [{ packageName: "asc" }, { barMark: "asc" }],
    take: Math.max(limit, 20),
  });

  const picks = lines.filter((l) => l.barMark || l.location).slice(0, limit);
  if (!picks.length) {
    console.log("BBS demo shapes: no BBS lines to attach");
    return 0;
  }

  let n = 0;
  for (const line of picks) {
    if (!opts?.force && line.shapeDiagramPath) continue;
    const mark = (line.barMark || `M${n + 1}`).replace(/[^A-Za-z0-9._-]+/g, "_");
    const pkgFolder = line.packageName.replace(/[^A-Za-z0-9._-]+/g, "_") || "BBS";
    const relFolder = `${BBS_FOLDER}/${pkgFolder}/shapes`;
    const absFolder = path.join(process.cwd(), "uploads", "onedrive", projectCode, relFolder);
    fs.mkdirSync(absFolder, { recursive: true });

    const fileName = `${mark}-demo-bend.svg`;
    const absFile = path.join(absFolder, fileName);
    const svg = bendSvg(mark, line.shape || "L", line.diameterMm, line.location || line.packageName);
    fs.writeFileSync(absFile, svg, "utf8");

    const storagePath = `${relFolder}/${fileName}`;
    const shareUrl = `/uploads/onedrive/${projectCode}/${storagePath}`;

    await prisma.costBbsLine.update({
      where: { id: line.id },
      data: { shapeDiagramPath: storagePath, shapeDiagramUrl: shareUrl },
    });
    n++;
  }

  console.log("BBS demo shapes attached:", n);
  return n;
}
