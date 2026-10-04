/**
 * Sign-off images for branded checklist downloads (HTML + Excel).
 * Pulls fill-pad signatures and GFC receive/issue signs (client / PMC / site).
 * Falls back to project directory signatures stored in DMS when revision/fill signs are absent.
 */
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { sharnamLogoDataUri, sharnamLogoPath } from "./brandedExport.js";
import type { DirectorySignMap } from "./directorySignatures.js";

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

/** PNG chunk CRC — table-based so it works on every Node version (zlib.crc32 needs Node ≥ 20.15). */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
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

export function collectChecklistSignSlots(src: SignSource, dir?: DirectorySignMap): SignSlot[] {
  const signs = (src.photos || []).filter(isSignPhoto);
  const fillPhoto = signs.find((p) => signRole(p) === "inspector");
  const pmcPhoto = signs.find((p) => signRole(p) === "pmc");
  const clientPhoto = signs.find((p) => signRole(p) === "client");
  const clientByPmc = /on behalf|pmc proxy/i.test(String(clientPhoto?.caption || ""));
  const rev = src.revision;
  const filledName = signName(fillPhoto) || src.submittedBy?.fullName || "";
  const filledDate = fmtDate(src.createdAt);
  const reviewDate = fmtDate(src.reviewedAt) || filledDate;
  const dirDate = (d?: Date | null) => (d ? fmtDate(d) : "");

  return [
    slot(
      "Filled by (Inspector)",
      filledName || dir?.contractor?.name || "",
      filledDate,
      fillPhoto?.fileUrl || rev?.contractorSignUrl || dir?.contractor?.url
    ),
    slot(
      "Reviewed by (SPDC PMC)",
      signName(pmcPhoto) || rev?.pmcSignName || dir?.pmc?.name || "SPDC PMC",
      reviewDate || dirDate(dir?.pmc?.updatedAt),
      pmcPhoto?.fileUrl || rev?.pmcSignUrl || dir?.pmc?.url
    ),
    slot(
      "Site engineer",
      rev?.siteEngineerSignName || dir?.site?.name || filledName,
      filledDate || dirDate(dir?.site?.updatedAt),
      rev?.siteEngineerSignUrl || dir?.site?.url
    ),
    slot(
      clientByPmc ? "Client / hold point (signed by PMC on behalf)" : "Client / hold point",
      signName(clientPhoto) || rev?.clientSignName || dir?.client?.name || "",
      reviewDate || dirDate(dir?.client?.updatedAt),
      clientPhoto?.fileUrl || rev?.clientSignUrl || dir?.client?.url
    ),
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


/**
 * Caption stored on a checklist signature upload: "<Role> · <Name>".
 * Role is Inspector | PMC | Client | "Client (signed by PMC on behalf)".
 */
export function signatureCaption(
  fieldName: string,
  body: Record<string, unknown> | undefined,
  fallbackName?: string | null,
): string | null {
  const b = body || {};
  const name = (key: string) => String(b[key] || "").trim().slice(0, 120);
  const proxy = b.clientSignedByPmc === "1" || b.clientSignedByPmc === "true";
  const join = (role: string, who: string) => (who ? `${role} · ${who}` : role);
  if (fieldName === "signature") return join("Inspector", name("signerNameInspector") || String(fallbackName || "").trim());
  if (fieldName === "signaturePmc") return join("PMC", name("signerNamePmc"));
  if (fieldName === "signatureClient") {
    return join(proxy ? "Client (signed by PMC on behalf)" : "Client", name("signerNameClient") || (proxy ? "" : String(fallbackName || "").trim()));
  }
  return null;
}

type SignRole = "inspector" | "pmc" | "client";

function signRole(p: { caption?: string | null }): SignRole {
  const cap = String(p.caption || "").trim().toLowerCase();
  if (cap.startsWith("pmc")) return "pmc";
  if (cap.startsWith("client")) return "client";
  return "inspector";
}

/** "PMC · Amit Desai" → "Amit Desai" (old captions without a name → ""). */
function signName(p?: { caption?: string | null } | null): string {
  const cap = String(p?.caption || "");
  const i = cap.indexOf(" · ");
  return i >= 0 ? cap.slice(i + 3).trim() : "";
}
