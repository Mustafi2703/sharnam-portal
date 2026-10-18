/**
 * Drawing markup from RFIs and design coordination: read a revision's PDF (local copy or SharePoint), give a
 * SharePoint viewer link for it, and build + file the branded markup PDF (notes page + marked-up pages).
 */
import fs from "fs";
import path from "path";
import { SPDC_PMC_NAME } from "@sharnam/shared";
import { prisma } from "../prisma.js";
import { sharnamLogoPath } from "./brandedExport.js";
import { mockOneDrive } from "./mockOneDrive.js";
import {
  MODULE_TO_ISO_FOLDER,
  downloadDriveFile,
  driveItemWebUrl,
  graphConfig,
  legacyProjectLibraryPath,
  projectLibraryPath,
  sanitizeProjectCode,
  sharePointPathFromWebUrl,
  uploadToProjectLibrary,
} from "./graph.js";

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

type RevLike = { fileUrl: string; fileName?: string | null; pdfFileUrl?: string | null; pdfFileName?: string | null };

export function revisionPdfUrl(rev: RevLike): string | null {
  if (rev.pdfFileUrl) return rev.pdfFileUrl;
  if (/\.pdf(\?|#|$)/i.test(rev.fileUrl || "") || /\.pdf$/i.test(rev.fileName || "")) return rev.fileUrl;
  return null;
}

/**
 * Resolve portal /uploads/onedrive/… URLs → local disk + SharePoint sandbox path.
 * Project codes may contain `/` and spaces (e.g. SHAR/SNT/26-27/Voltamp…); SharePoint always
 * uses sanitizeProjectCode. Never take only the first path segment as the project folder.
 */
function locate(url: string, projectCode: string): { local: string | null; sp: string | null; code: string; rel: string | null } {
  const code = sanitizeProjectCode(projectCode);
  if (/^https?:/i.test(url)) {
    return { local: null, sp: sharePointPathFromWebUrl(url), code, rel: null };
  }
  const marker = "/uploads/onedrive/";
  const idx = url.indexOf(marker);
  if (idx < 0) {
    if (url.startsWith("/uploads/")) {
      return { local: path.join(UPLOAD_DIR, decodeURIComponent(url.slice(9).split("?")[0])), sp: null, code, rel: null };
    }
    return { local: null, sp: null, code, rel: null };
  }
  const rest = decodeURIComponent(url.slice(idx + marker.length).split("?")[0]).replace(/^\/+/, "");
  let rel: string | null = null;
  for (const pfx of [projectCode, code]) {
    if (!pfx) continue;
    if (rest === pfx) {
      rel = "";
      break;
    }
    if (rest.startsWith(`${pfx}/`)) {
      rel = rest.slice(pfx.length + 1);
      break;
    }
  }
  if (rel == null) {
    const iso = rest.match(/(?:^|\/)(\d{2}_[A-Za-z0-9].*)$/);
    rel = iso ? iso[1] : rest;
  }
  const localCandidates = [
    path.join(UPLOAD_DIR, "onedrive", rest),
    path.join(UPLOAD_DIR, "onedrive", code, rel),
    path.join(UPLOAD_DIR, "onedrive", ...projectCode.split("/").filter(Boolean), rel),
  ];
  const local = localCandidates.find((p) => {
    try {
      return fs.existsSync(p) && fs.statSync(p).isFile();
    } catch {
      return false;
    }
  }) || localCandidates[0] || null;
  const sp = rel ? projectLibraryPath(code, rel) : null;
  return { local, sp, code, rel };
}

export async function readRevisionPdf(rev: RevLike, projectCode: string): Promise<{ buffer: Buffer; name: string } | null> {
  const url = revisionPdfUrl(rev);
  if (!url) return null;
  const loc = locate(url, projectCode);
  const name = rev.pdfFileName || rev.fileName || path.basename(url.split("?")[0]) || "drawing.pdf";
  if (loc.local && fs.existsSync(loc.local) && fs.statSync(loc.local).isFile()) return { buffer: fs.readFileSync(loc.local), name };
  if (loc.sp) {
    try {
      return { buffer: await downloadDriveFile(loc.sp), name };
    } catch {
      try {
        return { buffer: await downloadDriveFile(legacyProjectLibraryPath(loc.code, loc.rel || "")), name };
      } catch {
        /* try alternate SharePoint folder names below */
      }
    }
  }
  // Older uploads may live under a second sanitized form or the raw folder name on Graph.
  const code = sanitizeProjectCode(projectCode);
  const rel = loc.rel;
  if (rel) {
    for (const folder of [code, projectCode.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80)]) {
      if (!folder || folder === code) continue;
      try {
        return { buffer: await downloadDriveFile(legacyProjectLibraryPath(folder, rel)), name };
      } catch {
        /* next */
      }
    }
  }
  return null;
}

/** SharePoint web link for the revision PDF; files a copy to SharePoint first when only the portal has it. */
export async function revisionSharePointLink(rev: RevLike, projectCode: string): Promise<string | null> {
  const cfg = graphConfig();
  if (!cfg.configured || cfg.mock) throw new Error("SharePoint is not connected on this server.");
  const url = revisionPdfUrl(rev) || rev.fileUrl;
  if (/^https?:/i.test(url) && /sharepoint\.com/i.test(url)) return url;
  const loc = locate(url, projectCode);
  if (loc.sp) {
    const web = await driveItemWebUrl(loc.sp);
    if (web) return web;
  }
  const file = await readRevisionPdf(rev, projectCode);
  if (!file || !loc.rel) return null;
  const up = await uploadToProjectLibrary(loc.code, path.posix.dirname(loc.rel), path.posix.basename(loc.rel), file.buffer, "application/pdf", { replace: true });
  return up.url || null;
}

export async function latestPdfRevision(drawingId: string) {
  const revs = await prisma.drawingRevision.findMany({ where: { drawingId }, orderBy: { createdAt: "desc" } });
  return revs.find((r) => revisionPdfUrl(r)) || null;
}

type BuildOpts = {
  projectCode: string;
  projectName: string;
  drawingNumber: string;
  drawingTitle: string;
  revisionNumber: string;
  forLabel: string;
  byName: string;
  note: string;
  pages: { pageNumber: number; buffer: Buffer }[];
};

/** Markup PDF: Sharnam band + logo, details and notes, then each marked-up page fitted on its own landscape page. */
export async function buildMarkupPdf(o: BuildOpts): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A3", layout: "landscape", margin: 36, autoFirstPage: true, info: { Title: `Markup ${o.drawingNumber} ${o.revisionNumber}`, Author: SPDC_PMC_NAME } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const logo = sharnamLogoPath();
    const stamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

    const band = (subtitle: string) => {
      const w = doc.page.width;
      doc.rect(0, 0, w, 40).fill("#0B2545");
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(11).text(`${SPDC_PMC_NAME} · Drawing markup`, 36, 14, { width: w / 2 });
      doc.font("Helvetica").fontSize(10).text(subtitle, w / 2, 15, { width: w / 2 - 36, align: "right" });
      doc.fillColor("#0f172a");
    };

    band(`${o.projectCode} · ${o.drawingNumber} · ${o.revisionNumber}`);
    const w = doc.page.width;
    let y = 58;
    if (logo) {
      try {
        doc.image(logo, 36, y, { fit: [150, 50] });
      } catch {
        /* optional */
      }
    }
    doc.font("Helvetica-Bold").fontSize(20).fillColor("#0B2545").text("Drawing markup", 210, y + 4);
    doc.font("Helvetica").fontSize(11).fillColor("#334155").text(o.forLabel, 210, y + 30, { width: w - 246 });
    y = 124;
    doc.moveTo(36, y).lineTo(w - 36, y).strokeColor("#0B6A78").lineWidth(2).stroke();
    y += 14;
    const rows: [string, string][] = [
      ["Project", `${o.projectCode} — ${o.projectName}`],
      ["Drawing", `${o.drawingNumber} — ${o.drawingTitle}`],
      ["Revision", o.revisionNumber],
      ["Raised for", o.forLabel],
      ["Marked up by", o.byName],
      ["Date", stamp],
      ["Pages marked", o.pages.map((p) => p.pageNumber).join(", ")],
    ];
    for (const [k, v] of rows) {
      const h = Math.max(22, doc.heightOfString(v, { width: w - 72 - 170 }) + 10);
      doc.rect(36, y, 170, h).fillAndStroke("#F3F6FA", "#D5DCE4");
      doc.rect(206, y, w - 242, h).stroke("#D5DCE4");
      doc.fillColor("#0B2545").font("Helvetica-Bold").fontSize(10).text(k, 44, y + 6, { width: 156 });
      doc.fillColor("#0f172a").font("Helvetica").fontSize(10).text(v, 214, y + 6, { width: w - 258 });
      y += h;
    }
    y += 16;
    doc.fillColor("#0B2545").font("Helvetica-Bold").fontSize(12).text("Notes", 36, y);
    y += 18;
    doc.fillColor("#0f172a").font("Helvetica").fontSize(11).text(o.note || "—", 36, y, { width: w - 72, lineGap: 3 });

    for (const p of o.pages) {
      doc.addPage({ size: "A3", layout: "landscape", margin: 36 });
      band(`${o.drawingNumber} · ${o.revisionNumber} · page ${p.pageNumber}`);
      const pw = doc.page.width;
      const ph = doc.page.height;
      try {
        doc.image(p.buffer, 24, 52, { fit: [pw - 48, ph - 76], align: "center", valign: "center" });
      } catch {
        doc.fillColor("#b91c1c").fontSize(12).text(`Page ${p.pageNumber}: the image could not be placed.`, 36, 80);
      }
    }
    doc.end();
  });
}

export const MARKUP_FOLDER: Record<string, string> = {
  rfi: `${MODULE_TO_ISO_FOLDER.rfiInformation}/Markups`,
  coordination: `${MODULE_TO_ISO_FOLDER.designCoordination}/Markups`,
  drawing: `${MODULE_TO_ISO_FOLDER.drawings}/Markups`,
};

export async function fileMarkupPdf(projectCode: string, targetType: string, drawingNumber: string, fileName: string, buffer: Buffer) {
  const folder = `${MARKUP_FOLDER[targetType] || MARKUP_FOLDER.drawing}/${drawingNumber.replace(/[^\w.-]+/g, "_")}`;
  return mockOneDrive.upload(projectCode, folder, fileName, buffer, "application/pdf");
}
