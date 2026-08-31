/**
 * Generate a local DPR + WPR review pack with full demo data for UAT.
 *
 * Usage:
 *   npx tsx scripts/generate-review-pack.mts
 *   npx tsx scripts/generate-review-pack.mts --code SPDC-DEMO-01 --seed
 *   npx tsx scripts/generate-review-pack.mts --user admin@twinoxis.com
 *
 * Output: uploads/_review-pack/<project-code>/
 *   index.html — open in browser for file links
 *   dpr/*.xlsx — all 7 disciplines
 *   wpr/*.xlsx, *.pptx
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { seedDprDemoDay } from "../apps/api/src/services/dprDemoDaySeed.ts";
import { seedQualitySafetyDemoForDpr } from "../seed/qualitySafetySheets.ts";
import { seedWprDemoWeek } from "../apps/api/src/services/wprDemoSeed.ts";
import { buildDprWorkbook, type DprHeader, type DprLine } from "../apps/api/src/services/dprXlsx.ts";
import { buildWprWorkbook, type WprSections } from "../apps/api/src/services/wprXlsx.ts";
import { buildWprPptx } from "../apps/api/src/services/wprPptx.ts";
import { buildWprClientWorkbook } from "../apps/api/src/services/wprClientPack.ts";
import { renderDprSnapshotHtml } from "../apps/api/src/services/dprSnapshotExport.ts";
import { buildDprChartPack, loadDprScurveHistory } from "../apps/api/src/services/dprCharts.ts";
import {
  buildOfflineDprPack,
  buildOfflineWprPack,
  DPR_DEMO_DISCIPLINES,
  OFFLINE_PROJECT,
} from "../apps/api/src/services/reviewPackOffline.ts";

function flag(name: string, argv: string[]) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? String(argv[i + 1]) : undefined;
}

function splitExtras(headerJson: string | null) {
  let header: DprHeader = {};
  let extras: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(headerJson || "{}");
    const { _extras, ...rest } = parsed;
    header = rest;
    extras = (_extras as Record<string, unknown>) || {};
  } catch {
    /* empty */
  }
  return { header, extras };
}

function writeIndex(
  outRoot: string,
  projectCode: string,
  projectName: string,
  dateStr: string,
  files: { label: string; rel: string; kind: string }[]
) {
  const indexHtml = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>Review pack — ${projectCode}</title>
<style>
body{font-family:system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;color:#1a1d26}
h1{font-size:1.35rem} .meta{color:#5c6578;font-size:.9rem;margin-bottom:1.5rem}
ul{list-style:none;padding:0} li{margin:.5rem 0;padding:.75rem 1rem;border:1px solid #e2e5eb;border-radius:10px}
a{color:#0f766e;font-weight:600;text-decoration:none} a:hover{text-decoration:underline}
.tag{font-size:.65rem;text-transform:uppercase;letter-spacing:.08em;color:#5c6578;margin-left:.5rem}
</style></head><body>
<h1>Sharnam review pack — ${projectName}</h1>
<p class="meta">Project <strong>${projectCode}</strong> · DPR date ${dateStr} · generated ${new Date().toISOString().slice(0, 19)}</p>
<ul>
${files.map((f) => `<li><a href="${f.rel}">${f.label}</a><span class="tag">${f.kind}</span></li>`).join("\n")}
</ul>
<p class="meta">Open XLSX in Excel · HTML → Print to PDF · PPTX in PowerPoint. Compare DASHBOARD sheet to client templates.</p>
</body></html>`;
  fs.writeFileSync(path.join(outRoot, "index.html"), indexHtml);
}

async function main() {
  const argv = process.argv.slice(2);
  const projectCode = flag("code", argv) || "SPDC-DEMO-01";
  const userEmail = flag("user", argv) || "admin@twinoxis.com";
  const doSeed = argv.includes("--seed");
  const offline = argv.includes("--offline") || !process.env.DATABASE_URL;

  if (offline) {
    console.log("\n=== Offline review pack (no database) ===\n");
    const logDate = new Date();
    logDate.setDate(logDate.getDate() - 1);
    logDate.setHours(0, 0, 0, 0);
    const weekEnd = new Date();
    weekEnd.setHours(23, 59, 59, 999);
    const dateStr = logDate.toISOString().slice(0, 10);
    const outRoot = path.join(process.cwd(), "uploads", "_review-pack", projectCode);
    const dprDir = path.join(outRoot, "dpr");
    const wprDir = path.join(outRoot, "wpr");
    fs.mkdirSync(dprDir, { recursive: true });
    fs.mkdirSync(wprDir, { recursive: true });
    const files: { label: string; rel: string; kind: string }[] = [];

    for (const discipline of DPR_DEMO_DISCIPLINES) {
      const pack = buildOfflineDprPack(discipline, logDate);
      const xlsxName = `DPR-${projectCode}-${discipline}-${dateStr}.xlsx`;
      fs.writeFileSync(path.join(dprDir, xlsxName), await buildDprWorkbook(pack, { logDate }));
      files.push({ label: `DPR ${discipline}`, rel: `dpr/${xlsxName}`, kind: "xlsx" });
      const charts = buildDprChartPack(pack, []);
      const htmlName = `DPR-${projectCode}-${discipline}-${dateStr}.html`;
      fs.writeFileSync(
        path.join(dprDir, htmlName),
        renderDprSnapshotHtml({
          project: OFFLINE_PROJECT,
          logDate,
          discipline,
          status: "Published",
          header: pack.header,
          lines: pack.lines,
          manpower: pack.manpower,
          materials: pack.materials,
          safety: pack.safety,
          highlights: pack.highlights,
          nextDayPlan: pack.nextDayPlan,
          delays: pack.delays,
          issues: pack.issues,
          signatures: pack.signatures,
          charts,
        })
      );
      files.push({ label: `DPR ${discipline} PDF source`, rel: `dpr/${htmlName}`, kind: "html" });
      console.log(`  ✓ ${xlsxName}`);
    }

    const { header, sections } = buildOfflineWprPack(weekEnd);
    const wEndStr = weekEnd.toISOString().slice(0, 10);
    const spdcXlsx = `WPR-${projectCode}-${wEndStr}.xlsx`;
    fs.writeFileSync(path.join(wprDir, spdcXlsx), buildWprWorkbook({ header, sections }));
    files.push({ label: "WPR SPDC workbook", rel: `wpr/${spdcXlsx}`, kind: "xlsx" });
    const pptxName = `WPR-${projectCode}-${wEndStr}.pptx`;
    fs.writeFileSync(path.join(wprDir, pptxName), await buildWprPptx({ header, sections }));
    files.push({ label: "WPR PPTX (Sharnam branded)", rel: `wpr/${pptxName}`, kind: "pptx" });
    console.log(`  ✓ ${spdcXlsx}, ${pptxName}`);

    writeIndex(outRoot, projectCode, OFFLINE_PROJECT.name, dateStr, files);
    console.log(`\n✓ Review pack ready:\n  file://${outRoot}/index.html\n`);
    return;
  }

  const prisma = new PrismaClient();
  const outRoot = path.join(process.cwd(), "uploads", "_review-pack", projectCode);
  fs.mkdirSync(outRoot, { recursive: true });

  try {
    const project = await prisma.project.findUnique({ where: { code: projectCode } });
    if (!project) throw new Error(`Project ${projectCode} not found — run npm run db:seed first.`);

    const user = await prisma.user.findFirst({ where: { email: userEmail } });
    if (!user) throw new Error(`User ${userEmail} not found.`);

    const weekEnd = new Date();
    weekEnd.setHours(23, 59, 59, 999);
    const logDate = new Date(weekEnd);
    logDate.setDate(logDate.getDate() - 1);
    logDate.setHours(0, 0, 0, 0);

    if (doSeed) {
      console.log("Seeding quality/safety + DPR demo day + WPR week…");
      await seedQualitySafetyDemoForDpr(prisma, project.id, weekEnd, user.id, { weekDays: 7 });
      await seedDprDemoDay(prisma, project.id, logDate, user.id);
      await seedWprDemoWeek(prisma, project.id, weekEnd, user.id, { reportNumber: 50 });
    }

    const dprDir = path.join(outRoot, "dpr");
    const wprDir = path.join(outRoot, "wpr");
    fs.mkdirSync(dprDir, { recursive: true });
    fs.mkdirSync(wprDir, { recursive: true });

    const dateStr = logDate.toISOString().slice(0, 10);
    const files: { label: string; rel: string; kind: string }[] = [];

    for (const discipline of DPR_DEMO_DISCIPLINES) {
      const snap = await prisma.dprSnapshot.findUnique({
        where: { projectId_logDate_discipline: { projectId: project.id, logDate, discipline } },
      });
      if (!snap) {
        console.warn(`  ⚠ No snapshot for ${discipline} on ${dateStr} — run with --seed`);
        continue;
      }
      const { header, extras } = splitExtras(snap.headerJson);
      const lines: DprLine[] = JSON.parse(snap.linesJson || "[]");
      const pack = {
        discipline,
        header,
        lines,
        manpower: (extras.manpower as []) || [],
        equipment: (extras.equipment as []) || [],
        materials: (extras.materials as []) || [],
        qualityTests: (extras.qualityTests as []) || [],
        safetyRows: (extras.safetyRows as []) || [],
        safety: extras.safety as Record<string, unknown> | undefined,
        delays: (extras.delays as []) || [],
        approvals: (extras.approvals as []) || [],
        issues: (extras.issues as []) || [],
        highlights: (extras.highlights as []) || [],
        nextDayPlan: (extras.nextDayPlan as []) || [],
        decisions: (extras.decisions as []) || [],
        photos: (extras.photos as []) || [],
        attachments: (extras.attachments as []) || [],
        signatures: (extras.signatures as []) || [],
      };

      const xlsxName = `DPR-${project.code}-${discipline}-${dateStr}.xlsx`;
      fs.writeFileSync(path.join(dprDir, xlsxName), await buildDprWorkbook(pack, { projectId: project.id, logDate }));
      files.push({ label: `DPR ${discipline}`, rel: `dpr/${xlsxName}`, kind: "xlsx" });

      const scurve = await loadDprScurveHistory(project.id, discipline, logDate, pack);
      const charts = buildDprChartPack(pack, scurve);
      const htmlName = `DPR-${project.code}-${discipline}-${dateStr}.html`;
      fs.writeFileSync(
        path.join(dprDir, htmlName),
        renderDprSnapshotHtml({
          project: { code: project.code, name: project.name, clientName: project.clientName, location: project.location },
          logDate,
          discipline,
          status: snap.status,
          header,
          lines,
          manpower: pack.manpower,
          materials: pack.materials,
          safety: pack.safety,
          highlights: pack.highlights,
          nextDayPlan: pack.nextDayPlan,
          delays: pack.delays,
          issues: pack.issues,
          signatures: pack.signatures,
          charts,
        })
      );
      files.push({ label: `DPR ${discipline} PDF source`, rel: `dpr/${htmlName}`, kind: "html" });
      console.log(`  ✓ ${xlsxName}`);
    }

    const wprSnap = await prisma.wprSnapshot.findFirst({
      where: { projectId: project.id },
      orderBy: { weekEnding: "desc" },
    });
    if (wprSnap) {
      const weekEndDate = wprSnap.weekEnding;
      const weekStart = new Date(weekEndDate);
      weekStart.setDate(weekEndDate.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);
      const wEndStr = weekEndDate.toISOString().slice(0, 10);
      const sections: WprSections = JSON.parse(wprSnap.sectionsJson || "{}");
      const header = {
        projectName: project.name,
        projectCode: project.code,
        reportNumber: wprSnap.reportNumber || 50,
        weekStart: weekStart.toISOString(),
        weekEnd: weekEndDate.toISOString(),
        clientName: project.clientName || "",
        designConsultant: project.designConsultant || "",
        contractorName: project.contractorName || "",
        location: project.location || "",
        pmc: "Sharnam Project Development Consultants & Co.",
      };

      const spdcXlsx = `WPR-${project.code}-${wEndStr}.xlsx`;
      fs.writeFileSync(path.join(wprDir, spdcXlsx), buildWprWorkbook({ header, sections }));
      files.push({ label: "WPR SPDC workbook", rel: `wpr/${spdcXlsx}`, kind: "xlsx" });

      const clientXlsx = `WPR-ClientPack-${project.code}-${wEndStr}.xlsx`;
      fs.writeFileSync(path.join(wprDir, clientXlsx), await buildWprClientWorkbook(prisma, project.id, weekStart, weekEndDate));
      files.push({ label: "WPR client workbook", rel: `wpr/${clientXlsx}`, kind: "xlsx" });

      const pptxName = `WPR-${project.code}-${wEndStr}.pptx`;
      fs.writeFileSync(path.join(wprDir, pptxName), await buildWprPptx({ header, sections }));
      files.push({ label: "WPR PPTX (Sharnam branded)", rel: `wpr/${pptxName}`, kind: "pptx" });
      console.log(`  ✓ ${spdcXlsx}, ${clientXlsx}, ${pptxName}`);
    } else {
      console.warn("  ⚠ No WPR snapshot — re-run with --seed");
    }

    writeIndex(outRoot, project.code, project.name, dateStr, files);
    console.log(`\n✓ Review pack ready:\n  file://${outRoot}/index.html\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
