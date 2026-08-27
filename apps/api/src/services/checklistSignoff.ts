/**
 * Sign-off images for branded checklist downloads (HTML + Excel).
 * Pulls fill-pad signatures and GFC receive/issue signs (client / PMC / site).
 */
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { sharnamLogoDataUri, sharnamLogoPath } from "./brandedExport.js";

export type SignSlot = {
  role: string;
  name: string;
  date: string;
  buffer: Buffer | null;
  dataUri: string;
};

export type SignSource = {
  createdAt?: Date | string | null;
  reviewedAt?: Date | string | null;
  submittedBy?: { fullName?: string | null } | null;
  photos?: { kind?: string | null; fileUrl?: string | null; caption?: string | null }[];
  revision?: {
    revisionNumber?: string | null;
    clientSignName?: string | null;
    clientSignUrl?: string | null;
    pmcSignName?: string | null;
    pmcSignUrl?: string | null;
    siteEngineerSignName?: string | null;
    siteEngineerSignUrl?: string | null;
    contractorSignName?: string | null;
    contractorSignUrl?: string | null;
  } | null;
};

function uploadRoot() {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
}

function crc32(buf: Buffer) {
  return zlib.crc32(buf) >>> 0;
}

function pngChunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** Compact RGB PNG (no deps) — used for demo scribbles and tests. */
export function rgbPng(width: number, height: number, pixel: (x: number, y: number) => [number, number, number]) {
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y);
      const i = y * stride + 1 + x * 3;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", zlib.deflateSync(raw)), pngChunk("IEND", Buffer.alloc(0))]);
}

function hashName(name: string) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Ink-stroke PNG that reads as a handwritten sign-off. */
export function scribbleSignaturePng(name: string) {
  const w = 280;
  const h = 72;
  const seed = hashName(name || "sign");
  const ink: boolean[][] = Array.from({ length: h }, () => Array(w).fill(false));

  function plot(x: number, y: number, thick = 2) {
    for (let dy = -thick; dy <= thick; dy++) {
      for (let dx = -thick; dx <= thick; dx++) {
        if (dx * dx + dy * dy > thick * thick) continue;
        const xx = Math.round(x + dx);
        const yy = Math.round(y + dy);
        if (xx >= 0 && yy >= 0 && xx < w && yy < h) ink[yy][xx] = true;
      }
    }
  }

  function stroke(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number) {
    for (let t = 0; t <= 1; t += 0.01) {
      const u = 1 - t;
      const x = u * u * x0 + 2 * u * t * x1 + t * t * x2;
      const y = u * u * y0 + 2 * u * t * y1 + t * t * y2;
      plot(x, y, 2);
    }
  }

  const j = (n: number) => ((seed >> (n % 24)) & 31) - 15;
  stroke(18, 48, 70 + j(1), 18 + j(2), 120, 50);
  stroke(70, 52, 140 + j(3), 22, 210, 44 + j(4));
  stroke(150, 20, 190, 62, 250, 28 + j(5));
  stroke(40, 58, 90, 58 + j(6), 160, 60);

  return rgbPng(w, h, (x, y) => (ink[y][x] ? [26, 29, 38] : [255, 255, 255]));
}

export function resolveLocalMedia(url?: string | null): Buffer | null {
  if (!url) return null;
  const raw = String(url).trim();
  if (!raw) return null;
  if (raw.startsWith("data:")) {
    const m = raw.match(/^data:image\/[a-zA-Z+]+;base64,(.+)$/);
    if (!m) return null;
    try {
      return Buffer.from(m[1], "base64");
    } catch {
      return null;
    }
  }
  const candidates: string[] = [];
  if (raw.startsWith("/uploads/")) candidates.push(path.join(uploadRoot(), raw.replace(/^\/uploads\//, "")));
  try {
    const u = raw.startsWith("http") ? new URL(raw) : null;
    if (u?.pathname.startsWith("/uploads/")) {
      candidates.push(path.join(uploadRoot(), u.pathname.replace(/^\/uploads\//, "")));
    }
  } catch {
    /* ignore */
  }
  if (path.isAbsolute(raw) && fs.existsSync(raw)) candidates.push(raw);
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p) && fs.statSync(p).isFile()) return fs.readFileSync(p);
    } catch {
      /* next */
    }
  }
  return null;
}

function toDataUri(buf: Buffer | null) {
  if (!buf || buf.length < 8) return "";
  const isPng = buf[0] === 0x89 && buf[1] === 0x50;
  const mime = isPng ? "image/png" : "image/jpeg";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

function isSignPhoto(p: { kind?: string | null; caption?: string | null; fileUrl?: string | null }) {
  const kind = String(p.kind || "").toLowerCase();
  const cap = String(p.caption || p.fileUrl || "").toLowerCase();
  return kind === "signature" || kind === "sign" || /signature/.test(cap);
}

function fmtDate(d?: Date | string | null) {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function slot(role: string, name: string, date: string, url?: string | null): SignSlot {
  const label = (name && name !== "—") ? name : role;
  let buffer = resolveLocalMedia(url);
  if (!buffer) buffer = scribbleSignaturePng(label);
  return {
    role,
    name: name || "—",
    date: date || "",
    buffer,
    dataUri: toDataUri(buffer),
  };
}

export function collectChecklistSignSlots(src: SignSource): SignSlot[] {
  const fillPhoto = (src.photos || []).find(isSignPhoto);
  const rev = src.revision;
  const filledName = src.submittedBy?.fullName || fillPhoto?.caption || "";
  const filledDate = fmtDate(src.createdAt);
  const reviewDate = fmtDate(src.reviewedAt) || filledDate;

  return [
    slot(
      "Filled by (Inspector)",
      filledName,
      filledDate,
      fillPhoto?.fileUrl || rev?.contractorSignUrl
    ),
    slot("Reviewed by (SPDC PMC)", rev?.pmcSignName || "SPDC PMC", reviewDate, rev?.pmcSignUrl),
    slot(
      "Site engineer",
      rev?.siteEngineerSignName || filledName,
      filledDate,
      rev?.siteEngineerSignUrl
    ),
    slot("Client / hold point", rev?.clientSignName || "", reviewDate, rev?.clientSignUrl),
  ];
}

export function checklistLogoDataUri() {
  return sharnamLogoDataUri();
}

export function checklistLogoPath() {
  return sharnamLogoPath();
}

export function isSignatureUploadName(fileName?: string | null, fieldName?: string | null) {
  const n = `${fileName || ""} ${fieldName || ""}`.toLowerCase();
  return /signature/.test(n) || fieldName === "signature";
}
