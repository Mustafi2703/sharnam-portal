/**
 * Project programme with real dates.
 * Loaded from the client WPR deck (MS Project table) or from an MS Project XML import.
 * The full list stays on the project; the weekly pack prints summaries plus open / in-week tasks.
 */
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import type { PrismaClient } from "@prisma/client";

export type ScheduleTaskInput = {
  wbs: string;
  name: string;
  outlineLevel: number;
  summary: boolean;
  durationDays: number;
  start: Date | null;
  finish: Date | null;
  baselineStart: Date | null;
  baselineFinish: Date | null;
  actualStart: Date | null;
  actualFinish: Date | null;
  /** 0–1 */
  pctComplete: number;
  predecessors: string | null;
  source: string;
};

function searchRoots(): string[] {
  return [process.cwd(), path.resolve(process.cwd(), ".."), path.resolve(process.cwd(), "../..")];
}

export function resolveReferenceWprDeck(): string | null {
  const rels = [
    ["module_prompts", "Sharnam_modules_docs 2", "SPDC_Arvind Limited_WPR_50.pptx"],
    ["module_prompts", "Sharnam_modules_docs 2"],
  ];
  for (const root of searchRoots()) {
    const direct = path.join(root, ...rels[0]);
    if (fs.existsSync(direct)) return direct;
    const dir = path.join(root, ...rels[1]);
    if (!fs.existsSync(dir)) continue;
    const hit = fs.readdirSync(dir).find((f) => /wpr/i.test(f) && /\.pptx$/i.test(f));
    if (hit) return path.join(dir, hit);
  }
  return null;
}

/** "Wed 18-06-25" / "NA" → date or null. */
export function parseDeckDate(raw: string): Date | null {
  const s = raw.replace(/\s+/g, " ").trim();
  if (!s || /^n\/?a$/i.test(s) || s === "-" || s === "—") return null;
  const m = s.match(/(\d{1,2})-(\d{1,2})-(\d{2,4})/);
  if (!m) return null;
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  const d = new Date(year, Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parsePct(raw: string): number {
  const n = Number(String(raw).replace("%", "").trim());
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n > 1 ? Math.min(1, n / 100) : n;
}

function parseDays(raw: string): number {
  const m = String(raw).match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : 0;
}

function cellText(tcXml: string): string {
  const bits = [...tcXml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map((m) => m[1]);
  return bits.join("").replace(/\s+/g, " ").trim();
}

function tables(slideXml: string): string[][][] {
  const blocks = slideXml.match(/<a:tbl>[\s\S]*?<\/a:tbl>/g) || [];
  return blocks.map((tbl) => {
    const trs = tbl.match(/<a:tr[\s\S]*?<\/a:tr>/g) || [];
    return trs.map((tr) => {
      const tcs = tr.match(/<a:tc[\s\S]*?<\/a:tc>/g) || [];
      return tcs.map(cellText);
    });
  });
}

function col(header: string[], re: RegExp, fallback: number) {
  const i = header.findIndex((c) => re.test(c));
  return i >= 0 ? i : fallback;
}

function isWbs(s: string): boolean {
  return /^\d+(\.\d+)*$/.test(s.trim());
}

/** Read the milestone-schedule tables out of the client PPTX. */
export function parseScheduleFromPptx(filePath: string): ScheduleTaskInput[] {
  const dest = fs.mkdtempSync(path.join(os.tmpdir(), "wpr-sched-"));
  try {
    execFileSync("unzip", ["-o", "-qq", filePath, "ppt/slides/slide*.xml", "-d", dest], { stdio: "ignore" });
  } catch {
    return [];
  }
  const slideDir = path.join(dest, "ppt", "slides");
  if (!fs.existsSync(slideDir)) return [];
  const files = fs
    .readdirSync(slideDir)
    .filter((f) => /^slide\d+\.xml$/.test(f))
    .sort((a, b) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, "")));

  const byWbs = new Map<string, ScheduleTaskInput>();
  for (const file of files) {
    const xml = fs.readFileSync(path.join(slideDir, file), "utf8");
    for (const rows of tables(xml)) {
      const headerAt = rows.findIndex((r) => r.some((c) => /^task name$/i.test(c)) && r.some((c) => /^wbs$/i.test(c)));
      if (headerAt < 0) continue;
      const header = rows[headerAt];
      const cWbs = col(header, /^wbs$/i, 0);
      const cName = col(header, /^task name$/i, 1);
      const cDur = col(header, /^duration$/i, 2);
      const cStart = col(header, /^start$/i, 3);
      const cFinish = col(header, /^finish$/i, 4);
      const cBaseStart = col(header, /baseline.*start/i, 5);
      const cBaseFinish = col(header, /baseline.*finish/i, 6);
      const cActStart = col(header, /actual start/i, 7);
      const cActFinish = col(header, /actual finish/i, 8);
      const cPct = col(header, /%?\s*complete/i, 9);
      const cPred = col(header, /predecessor/i, 10);
      for (const row of rows.slice(headerAt + 1)) {
        const wbs = (row[cWbs] || "").trim();
        const name = (row[cName] || "").trim();
        if (!isWbs(wbs) || !name) continue;
        byWbs.set(wbs, {
          wbs,
          name,
          outlineLevel: wbs.split(".").length,
          summary: false,
          durationDays: parseDays(row[cDur] || ""),
          start: parseDeckDate(row[cStart] || ""),
          finish: parseDeckDate(row[cFinish] || ""),
          baselineStart: parseDeckDate(row[cBaseStart] || ""),
          baselineFinish: parseDeckDate(row[cBaseFinish] || ""),
          actualStart: parseDeckDate(row[cActStart] || ""),
          actualFinish: parseDeckDate(row[cActFinish] || ""),
          pctComplete: parsePct(row[cPct] || ""),
          predecessors: (row[cPred] || "").trim() || null,
          source: "WPR deck",
        });
      }
    }
  }
  const tasks = [...byWbs.values()];
  const wbsSet = new Set(tasks.map((t) => t.wbs));
  for (const t of tasks) {
    t.summary = [...wbsSet].some((w) => w.startsWith(`${t.wbs}.`));
  }
  return tasks;
}

export async function replaceProjectSchedule(prisma: PrismaClient, projectId: string, tasks: ScheduleTaskInput[]) {
  await prisma.progressScheduleTask.deleteMany({ where: { projectId } });
  if (!tasks.length) return 0;
  const seen = new Set<string>();
  const data = [];
  for (const t of tasks) {
    const wbs = t.wbs.trim();
    if (!wbs || !t.name.trim() || seen.has(wbs)) continue;
    seen.add(wbs);
    data.push({
      projectId,
      wbs,
      name: t.name.trim(),
      outlineLevel: t.outlineLevel || wbs.split(".").length,
      summary: t.summary,
      durationDays: t.durationDays || 0,
      start: t.start,
      finish: t.finish,
      baselineStart: t.baselineStart,
      baselineFinish: t.baselineFinish,
      actualStart: t.actualStart,
      actualFinish: t.actualFinish,
      pctComplete: t.pctComplete || 0,
      predecessors: t.predecessors,
      source: t.source || "WPR",
    });
  }
  if (data.length) await prisma.progressScheduleTask.createMany({ data });
  return data.length;
}

/** Parse a WPR / programme PPTX from an uploaded buffer (temp file → unzip). */
export function parseScheduleFromPptxBuffer(buffer: Buffer, source = "WPR upload"): ScheduleTaskInput[] {
  if (!buffer?.length) return [];
  const tmp = path.join(os.tmpdir(), `wpr-sched-up-${Date.now()}-${Math.random().toString(36).slice(2)}.pptx`);
  try {
    fs.writeFileSync(tmp, buffer);
    const tasks = parseScheduleFromPptx(tmp);
    for (const t of tasks) t.source = source;
    return tasks;
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

/** Onboard helper — load the shared WPR deck programme when the file is on disk. */
export async function importScheduleFromReferenceDeck(prisma: PrismaClient, projectId: string): Promise<number> {
  const file = resolveReferenceWprDeck();
  if (!file) return 0;
  const tasks = parseScheduleFromPptx(file);
  if (!tasks.length) return 0;
  return replaceProjectSchedule(prisma, projectId, tasks);
}
