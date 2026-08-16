/**
 * Seed a published WPR week (SPDC pack + client workbook) for demo screenshots.
 */
import fs from "fs";
import path from "path";
import type { PrismaClient } from "@prisma/client";
import { buildWprWorkbook, type WprHeader } from "./wprXlsx.js";
import { buildWprClientWorkbook } from "./wprClientPack.js";
import { mockOneDrive } from "./mockOneDrive.js";
import { MODULE_TO_ISO_FOLDER } from "./graph.js";
import { seedWprSections } from "./wprSeedSections.js";

/** Snap to the Sunday ending the week that contains `d`. */
export function snapWeekEnding(d: Date): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  const day = out.getDay();
  if (day !== 0) out.setDate(out.getDate() + (7 - day));
  return out;
}

export async function seedWprDemoWeek(
  prisma: PrismaClient,
  projectId: string,
  anchor: Date,
  userId: string,
  opts?: { reportNumber?: number }
) {
  const weekEnd = snapWeekEnding(anchor);
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekEnd.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error(`Project ${projectId} not found`);

  const sections = await seedWprSections(prisma, projectId, weekStart, weekEnd);
  const reportNumber = opts?.reportNumber ?? 50;

  const header: WprHeader = {
    projectName: project.name,
    projectCode: project.code,
    reportNumber,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    clientName: project.clientName || "",
    designConsultant: project.designConsultant || "",
    contractorName: project.contractorName || "",
    location: project.location || "",
    pmc: "Sharnam Project Development Consultants & Co.",
  };

  const snapshot = await prisma.wprSnapshot.upsert({
    where: { projectId_weekEnding: { projectId, weekEnding: weekEnd } },
    create: {
      projectId,
      weekEnding: weekEnd,
      reportNumber,
      sectionsJson: JSON.stringify(sections),
      status: "Published",
      publishedAt: new Date(),
      createdById: userId,
    },
    update: {
      sectionsJson: JSON.stringify(sections),
      status: "Published",
      publishedAt: new Date(),
      reportNumber,
    },
  });

  const dateStr = weekEnd.toISOString().slice(0, 10);
  const spdcBuf = buildWprWorkbook({ header, sections });
  const clientBuf = await buildWprClientWorkbook(prisma, projectId, weekStart, weekEnd);

  const folder = MODULE_TO_ISO_FOLDER.wpr;
  const spdcName = `WPR-${project.code}-${dateStr}.xlsx`;
  const clientName = `WPR-ClientPack-${project.code}-${dateStr}.xlsx`;

  let publishedPath = snapshot.publishedPath;
  try {
    const saved = await mockOneDrive.upload(project.code, folder, spdcName, spdcBuf);
    publishedPath = saved.path;
    await mockOneDrive.upload(project.code, folder, clientName, clientBuf);
  } catch {
    const wprRoot = path.join(process.cwd(), "uploads", "onedrive", project.code, folder);
    fs.mkdirSync(wprRoot, { recursive: true });
    fs.writeFileSync(path.join(wprRoot, spdcName), spdcBuf);
    fs.writeFileSync(path.join(wprRoot, clientName), clientBuf);
    publishedPath = `${folder}/${spdcName}`;
  }

  if (publishedPath !== snapshot.publishedPath) {
    await prisma.wprSnapshot.update({
      where: { id: snapshot.id },
      data: { publishedPath },
    });
  }

  return { weekEnd, weekStart, reportNumber, publishedPath, spdcName, clientName };
}
