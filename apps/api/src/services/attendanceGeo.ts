/**
 * Attendance: site geofence check, private selfie storage and the daily selfie purge.
 * Selfies are kept on the server only (never SharePoint) and deleted after one day.
 */
import fs from "fs";
import path from "path";
import { haversineMeters } from "@sharnam/shared";
import { prisma } from "../prisma.js";

export const DEFAULT_SITE_RADIUS_M = 300;
/** GPS accuracy credited on top of the radius (phones report 10–100 m indoors). */
const MAX_ACCURACY_CREDIT_M = 150;
const SELFIE_PREFIX = "selfie:";
const KEEP_MS = 24 * 60 * 60 * 1000;

export type SiteCheck = {
  siteName: string | null;
  distanceM: number | null;
  ok: boolean;
  /** Why the punch needs a person to look at it (empty when auto-verified). */
  reason: string;
};

export function checkAgainstSite(
  site: { name?: string | null; code?: string | null; location?: string | null; siteLat?: number | null; siteLng?: number | null; siteRadiusM?: number | null } | null,
  lat: number,
  lng: number,
  accuracy?: number | null,
): SiteCheck {
  if (!site) return { siteName: "Office", distanceM: null, ok: false, reason: "Office punch — no site pin to check against" };
  const siteName = site.location || site.name || site.code || null;
  if (site.siteLat == null || site.siteLng == null) {
    return { siteName, distanceM: null, ok: false, reason: "Site has no map pin — HR to review the location" };
  }
  const distanceM = Math.round(haversineMeters(site.siteLat, site.siteLng, lat, lng));
  const radius = site.siteRadiusM && site.siteRadiusM > 0 ? site.siteRadiusM : DEFAULT_SITE_RADIUS_M;
  const credit = Math.min(MAX_ACCURACY_CREDIT_M, Number.isFinite(accuracy ?? NaN) ? Number(accuracy) : 0);
  const ok = distanceM <= radius + credit;
  return { siteName, distanceM, ok, reason: ok ? "" : `${distanceM} m from the site pin (allowed ${radius} m)` };
}

function selfieRoot(): string {
  return path.join(process.cwd(), "data", "attendance-selfies");
}

/** Save a punch selfie privately; returns the stored reference kept on the attendance row. */
export function saveSelfie(buffer: Buffer, fileName: string, day: string): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const dir = path.join(selfieRoot(), day);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, safe), buffer);
  return `${SELFIE_PREFIX}${day}/${safe}`;
}

export function selfieLocalPath(stored: string | null | undefined): string | null {
  if (!stored || !stored.startsWith(SELFIE_PREFIX)) return null;
  const rel = stored.slice(SELFIE_PREFIX.length);
  if (rel.includes("..")) return null;
  const p = path.join(selfieRoot(), rel);
  return fs.existsSync(p) ? p : null;
}

/** Delete selfies older than one day (files + references). Location, time and status stay on the record. */
export async function purgeOldSelfies(now = new Date()): Promise<{ folders: number; rows: number }> {
  let folders = 0;
  const root = selfieRoot();
  if (fs.existsSync(root)) {
    for (const day of fs.readdirSync(root)) {
      const full = path.join(root, day);
      try {
        const st = fs.statSync(full);
        if (now.getTime() - st.mtimeMs > KEEP_MS) {
          fs.rmSync(full, { recursive: true, force: true });
          folders++;
        }
      } catch {
        /* skip */
      }
    }
  }
  // `date` is the start of the punch day, so 30 h after it is at least a full day after any selfie that day.
  const cutoff = new Date(now.getTime() - KEEP_MS - 6 * 60 * 60 * 1000);
  const [a, b] = await Promise.all([
    prisma.attendance.updateMany({ where: { date: { lt: cutoff }, inPhotoUrl: { not: null } }, data: { inPhotoUrl: null } }),
    prisma.attendance.updateMany({ where: { date: { lt: cutoff }, outPhotoUrl: { not: null } }, data: { outPhotoUrl: null } }),
  ]);
  return { folders, rows: a.count + b.count };
}

let started = false;
/** Rotate selfies hourly (and once at boot). */
export function startSelfieRotation(): void {
  if (started) return;
  started = true;
  const run = () =>
    purgeOldSelfies()
      .then((r) => {
        if (r.folders || r.rows) console.log(`[attendance] selfie rotation: removed ${r.folders} day folder(s), cleared ${r.rows} photo link(s)`);
      })
      .catch((err) => console.warn("[attendance] selfie rotation failed:", err instanceof Error ? err.message : err));
  setTimeout(run, 30_000);
  setInterval(run, 60 * 60 * 1000).unref?.();
}
