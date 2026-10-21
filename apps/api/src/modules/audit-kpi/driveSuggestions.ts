/**
 * Folder-sample suggestions from the project library.
 * Live SharePoint when it is configured, with a 10 minute memory cache.
 */
import { prisma } from "../../prisma.js";
import { mockOneDrive, sharePointLive, type DriveNode } from "../../services/mockOneDrive.js";
import { parseDetail } from "./scoring.js";

export type DriveSuggestion = {
  kind: "folder" | "file";
  area: string;
  folder: string;
  path: string;
  name: string;
  url?: string;
  fileCount?: number;
  newestAt?: string | null;
  accepted: boolean;
  sampleMatch: boolean;
  emptyInSharePoint: boolean;
};

type Cached = {
  at: number;
  sharePoint: boolean;
  partial: boolean;
  suggestions: DriveSuggestion[];
};

const cache = new Map<string, Cached>();
const TEN_MINUTES = 10 * 60 * 1000;

function codesIn(text: string) {
  return [...text.toUpperCase().matchAll(/\d{2}\.\d{2}_[A-Z0-9]+/g)].map((match) => match[0]);
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      out[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function listDriveSuggestions(projectId: string, opts?: { refresh?: boolean }) {
  const hit = cache.get(projectId);
  if (hit && !opts?.refresh && Date.now() - hit.at < TEN_MINUTES) {
    return { ...hit, cached: true, notice: hit.sharePoint ? null : "SharePoint not connected - showing files stored on the portal only." };
  }
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { code: true } });
  if (!project) return null;
  const live = sharePointLive();
  const items = await prisma.auditChecklistItem.findMany({
    where: { projectId, section: "FolderSample" },
    select: { detailJson: true, locationChecked: true, notes: true, response: true, prompt: true },
  });
  const sampleCodes = new Set<string>();
  const sampleFolders = new Set<string>();
  const acceptedFiles = new Set<string>();
  for (const item of items) {
    const detail = parseDetail(item.detailJson);
    for (const key of [detail.folder, detail.path, detail.area, item.locationChecked, item.prompt]) {
      if (!key) continue;
      sampleFolders.add(key.toLowerCase());
      for (const code of codesIn(key)) sampleCodes.add(code);
    }
    const blob = `${detail.sampled || ""} ${detail.recordsInLog || ""} ${item.notes || ""} ${item.response || ""}`.toLowerCase();
    for (const part of blob.split(/[;\n,]/)) {
      const name = part.trim();
      if (name) acceptedFiles.add(name);
    }
  }

  const deadline = Date.now() + 20_000;
  let partial = false;
  const listWithin = async (rel: string): Promise<DriveNode[]> => {
    if (Date.now() >= deadline) {
      partial = true;
      return [];
    }
    const remaining = Math.max(1, deadline - Date.now());
    try {
      return await Promise.race([
        mockOneDrive.listChildrenLive(project.code, rel, { liveOnly: live }),
        new Promise<DriveNode[]>((_, reject) => setTimeout(() => reject(new Error("timeout")), remaining)),
      ]);
    } catch {
      partial = true;
      return [];
    }
  };

  const suggestions: DriveSuggestion[] = [];
  const roots = (await listWithin("")).filter((node) => node.type === "folder" && /^\d{2}_/.test(node.name));
  const areas = await mapLimit(roots, 5, async (area) => ({ area, children: await listWithin(area.path) }));
  const folders: { area: string; folder: DriveNode }[] = [];
  for (const area of areas) {
    for (const child of area.children) {
      if (child.type === "folder") folders.push({ area: area.area.name, folder: child });
    }
  }
  const listed = await mapLimit(folders, 5, async (entry) => ({
    ...entry,
    files: (await listWithin(entry.folder.path)).filter((node) => node.type === "file"),
  }));

  for (const entry of listed) {
    const code = codesIn(entry.folder.name)[0] || codesIn(entry.folder.path)[0] || "";
    const sampleMatch =
      (code && sampleCodes.has(code)) ||
      sampleFolders.has(entry.folder.name.toLowerCase()) ||
      sampleFolders.has(entry.folder.path.toLowerCase());
    const newest = entry.files.reduce<string | null>((max, file) => {
      if (!file.modifiedAt) return max;
      if (!max || file.modifiedAt > max) return file.modifiedAt;
      return max;
    }, null);
    suggestions.push({
      kind: "folder",
      area: entry.area,
      folder: entry.folder.name,
      path: entry.folder.path,
      name: entry.folder.name,
      fileCount: entry.files.length,
      newestAt: newest,
      accepted: sampleMatch,
      sampleMatch,
      emptyInSharePoint: entry.files.length === 0 && sampleMatch,
    });
    for (const file of entry.files.slice(0, 12)) {
      suggestions.push({
        kind: "file",
        area: entry.area,
        folder: entry.folder.name,
        path: file.path,
        name: file.name,
        url: file.url,
        accepted: acceptedFiles.has(file.name.toLowerCase()),
        sampleMatch,
        emptyInSharePoint: false,
      });
    }
  }

  const payload: Cached = { at: Date.now(), sharePoint: live, partial, suggestions: suggestions.slice(0, 400) };
  cache.set(projectId, payload);
  return {
    ...payload,
    cached: false,
    notice: live ? null : "SharePoint not connected - showing files stored on the portal only.",
  };
}
