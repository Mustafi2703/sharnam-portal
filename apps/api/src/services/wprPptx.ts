/**
 * WPR PPTX — full deck aligned to SPDC_Arvind Limited_WPR_50.pptx (~61 slides).
 * Built with pptxgenjs from live WPR pack data (same approach as DPR Excel fill).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pptxgenImport from "pptxgenjs";
import {
  DEFAULT_WPR_TITLES,
  type WprPackInput,
  type WprSection,
  type WprSections,
} from "./wprXlsx.js";
import {
  renderWprChartSlide,
  type WprChartSlideKey,
} from "./wprPptxCharts.js";
import { mergeWprChartsForExport } from "./wprChartMerge.js";

/**
 * Client WPR_50 theme (Office scheme) + Excel dashboard navy.
 * Original deck is LAYOUT_WIDE 13.33 × 7.5" — not 16:9 10 × 5.625.
 */
const NAVY = "0E2841";
const NAVY_XL = "002060";
const BRAND = "156082";
const ORANGE = "E97132";
const INK = "1F2937";
const MUTED = "5C6578";
const LIGHT = "E8EEF4";
const BAND = "F3F6F9";
const WHITE = "FFFFFF";
const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const MARGIN = 0.45;
const CONTENT_W = SLIDE_W - MARGIN * 2;
const FOOTER_Y = 7.12;

/** Slide titles as printed on SPDC_Arvind Limited_WPR_50.pptx */
const PPTX_TITLES: Record<string, string> = {
  cover: "WEEKLY PROGRESS REPORT",
  index: "INDEX",
  brief: "Project Brief",
  stakeholders: "Project Stakeholders",
  mobilisation: "Mobilization Plan",
  communicationMatrix: "Communication Matrix",
  projectDashboard: "Project Dashboard",
  criticalAreas: "Critical Areas",
  capex: "Project CAPEX",
  prTracker: "Project PR Tracker",
  hindrance: "Hinderance Register",
  risk: "Risk Register",
  legal: "Legal Approval Tracker",
  drawingRegister: "Drawing Register _ DCI",
  designStatus: "Design Status",
  procurement: "Procurement Status",
  milestones: "Project Milestone Schedule",
  manpowerHistogram: "Weekly Manpower Histogram",
  weeklyExecuted: "Weekly Executed Plan",
  cashflow: "Project Cashflow Overview",
  quality: "Weekly Quality Updates",
  cubeTest: "Cube Test",
  safety: "Weekly Safety Updates",
  plannedVsActual: "Planned Vs. Actual",
  materialStock: "Material Stock",
  progressPictures: "Project Progress",
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function sharnamLogoPath(): string | null {
  const candidates = [
    path.resolve(__dirname, "../../assets/logo-transparent.png"),
    path.resolve(process.cwd(), "apps/api/assets/logo-transparent.png"),
    path.resolve(process.cwd(), "apps/web/public/logo-transparent.png"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function addSharnamLogo(slide: PptxSlide, x = 11.55, y = 0.14, w = 1.35, h = 0.42) {
  const logo = sharnamLogoPath();
  if (!logo) return;
  try {
    slide.addImage({ path: logo, x, y, w, h });
  } catch {
    /* optional */
  }
}

type PptxSlide = {
  background: { color: string };
  addText: (text: string | string[] | unknown, opts: Record<string, unknown>) => void;
  addShape: (type: string, opts: Record<string, unknown>) => void;
  addTable: (rows: unknown[], opts: Record<string, unknown>) => void;
  addImage: (opts: Record<string, unknown>) => void;
  addChart: (type: string, data: unknown[], opts?: Record<string, unknown>) => void;
};

type PptxDeck = {
  layout: string;
  author: string;
  company: string;
  subject: string;
  title: string;
  ShapeType: { rect: string };
  ChartType: { bar: string; line: string; doughnut: string };
  addSlide: () => PptxSlide;
  write: (opts: { outputType: "nodebuffer" }) => Promise<Buffer | Uint8Array>;
};

/** Charts only where the client deck pastes Excel/EMF — not after every table. */
const CHART_AFTER: Partial<Record<keyof WprSections, WprChartSlideKey[]>> = {
  projectDashboard: ["dashboardKpis", "scurve"],
  milestones: ["milestones"],
  manpowerHistogram: ["manpower"],
  cashflow: ["cashflow"],
  drawingRegister: ["drawingDci"],
  quality: ["quality"],
  safety: ["safety"],
  plannedVsActual: ["plannedVsActual"],
};

function createPptx(): PptxDeck {
  const mod: unknown = pptxgenImport;
  const Ctor =
    typeof mod === "function"
      ? (mod as new () => PptxDeck)
      : ((mod as { default: new () => PptxDeck }).default as new () => PptxDeck);
  return new Ctor();
}

function footer(slide: PptxSlide, page: number, total: number, client?: string, ink = MUTED) {
  slide.addText(client || "Sharnam PMC", {
    x: MARGIN,
    y: FOOTER_Y,
    w: 8,
    h: 0.22,
    fontSize: 9,
    color: ink,
  });
  slide.addText(`${page} / ${total}`, {
    x: SLIDE_W - MARGIN - 1.6,
    y: FOOTER_Y,
    w: 1.6,
    h: 0.22,
    fontSize: 9,
    color: ink,
    align: "right",
  });
}

function brandBar(pptx: PptxDeck, slide: PptxSlide) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: SLIDE_W,
    h: 0.08,
    fill: { color: BRAND },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0.08,
    w: SLIDE_W,
    h: 0.035,
    fill: { color: ORANGE },
  });
}

function dividerSlide(
  pptx: PptxDeck,
  title: string,
  pageNo: string,
  meta: { client?: string; page: number; total: number }
) {
  const slide = pptx.addSlide();
  slide.background = { color: NAVY };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 0.22,
    h: SLIDE_H,
    fill: { color: ORANGE },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.22,
    y: 0,
    w: SLIDE_W - 0.22,
    h: 0.08,
    fill: { color: BRAND },
  });
  addSharnamLogo(slide);
  slide.addText(pageNo, {
    x: 0.7,
    y: 2.15,
    w: 12,
    h: 0.4,
    fontSize: 14,
    color: ORANGE,
    bold: true,
  });
  slide.addText(title, {
    x: 0.7,
    y: 2.55,
    w: 12,
    h: 1.05,
    fontSize: 36,
    bold: true,
    color: WHITE,
  });
  slide.addText(meta.client || "Sharnam PMC · Weekly Progress Report", {
    x: 0.7,
    y: 3.7,
    w: 12,
    h: 0.4,
    fontSize: 16,
    color: "B8C4D0",
  });
  footer(slide, meta.page, meta.total, meta.client, "B8C4D0");
}

type IndexEntry = { label: string; page: number };

/**
 * Staff-facing notes ("Import … under Finance", "Upload via WPR Maker", "Regenerate WPR")
 * are guidance for the portal user, not report content — keep them off client slides.
 */
const INTERNAL_NOTE = /\b(import|upload|attach|load|populate|regenerate|re-?sync|sync|fill in|add (more )?rows|wpr maker|appear here|from project photos|auto-filled|not duplicated)\b|→/i;

export function clientFacingNote(notes: string | undefined): string | undefined {
  const parts = String(notes || "")
    .split(/(?<=\.)\s+/)
    .map((p) => p.trim())
    .filter((p) => p && !INTERNAL_NOTE.test(p));
  return parts.length ? parts.join(" ") : undefined;
}

function indexSlide(
  pptx: PptxDeck,
  entries: IndexEntry[],
  meta: { client?: string; page: number; total: number }
) {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };
  brandBar(pptx, slide);
  addSharnamLogo(slide);
  slide.addText(meta.client || "Sharnam PMC", {
    x: MARGIN,
    y: 0.22,
    w: 8,
    h: 0.28,
    fontSize: 12,
    color: BRAND,
    bold: true,
  });
  slide.addText("INDEX", {
    x: MARGIN,
    y: 0.52,
    w: 8,
    h: 0.45,
    fontSize: 28,
    bold: true,
    color: NAVY,
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: MARGIN,
    y: 1.02,
    w: 1.4,
    h: 0.06,
    fill: { color: ORANGE },
  });

  const perCol = Math.max(5, Math.ceil(entries.length / 2));
  const rowH = Math.min(1.05, 5.5 / perCol);
  entries.forEach(({ label, page }, i) => {
    const col = i < perCol ? 0 : 1;
    const row = i % perCol;
    const x = MARGIN + col * 6.3;
    const y = 1.3 + row * rowH;
    const h = rowH - 0.17;
    slide.addShape(pptx.ShapeType.rect, {
      x,
      y,
      w: 5.95,
      h,
      fill: { color: i % 2 ? BAND : LIGHT },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x,
      y,
      w: h,
      h,
      fill: { color: BRAND },
    });
    slide.addText(String(i + 1), {
      x,
      y,
      w: h,
      h,
      fontSize: 22,
      bold: true,
      color: WHITE,
      align: "center",
      valign: "middle",
    });
    slide.addText(label, {
      x: x + h + 0.17,
      y,
      w: 3.9,
      h,
      fontSize: 16,
      bold: true,
      color: NAVY,
      valign: "middle",
    });
    slide.addText(`Page ${page}`, {
      x: x + 4.65,
      y,
      w: 1.15,
      h,
      fontSize: 12,
      color: MUTED,
      align: "right",
      valign: "middle",
    });
  });
  footer(slide, meta.page, meta.total, meta.client);
}

/** Client-facing caption: drop notes that are instructions to portal users (import / fill / regenerate / menu paths). */
export function clientCaption(note?: string | null): string {
  const t = String(note || "").trim();
  if (!t) return "";
  const internal = /(→|\bimport\b|\bload\b .*template|\bfill (in|weekly)\b|regenerate|wpr maker|sync registers|edit data labels|attach progress|placeholder|not duplicated|same kpis as|rollup from published|from the week sheet|under finance|\bsap\b.*iso|iso \d)/i;
  // Keep only sentences that read as report content.
  const kept = t
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => sentence && !internal.test(sentence))
    .join(" ")
    .trim();
  return kept;
}

function colWidths(headers: string[], totalW: number): number[] {
  const weights = headers.map((h, i) => {
    const s = String(h || "").toLowerCase();
    if (/^(sr|no\.?|#|s\.?\s*no)/.test(s)) return 0.55;
    if (/date|cast|week|status|result|grade|avg|mpa|qty|%|c\d/.test(s)) return 0.85;
    if (/desc|item|activity|name|drawing|title|location|remark|observation/.test(s)) return 1.9;
    if (i === 1 && headers.length > 3) return 1.55;
    return 1;
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => (w / sum) * totalW);
}

function chunkRows(rows: (string | number | null)[][], size: number) {
  if (!rows.length) return [[] as (string | number | null)[][]];
  const out: (string | number | null)[][][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

function addSignOffStrip(
  pptx: PptxDeck,
  slide: PptxSlide,
  signatures: { path: string; role: string; url?: string }[] | undefined,
  projectCode?: string
) {
  const order = ["pmc", "client", "contractor"] as const;
  order.forEach((role, i) => {
    const hit = (signatures || []).find((s) => s.role.toLowerCase().includes(role));
    const x = MARGIN + i * 4.15;
    slide.addText(`${role.toUpperCase()} sign`, {
      x,
      y: 6.42,
      w: 3.9,
      h: 0.16,
      fontSize: 8,
      color: MUTED,
      bold: true,
    });
    const resolved = hit ? resolvePhotoPath(hit.url || hit.path, projectCode) : undefined;
    if (resolved) {
      try {
        slide.addImage({ path: resolved, x, y: 6.58, w: 3.6, h: 0.42 });
        return;
      } catch {
        /* line fallback */
      }
    }
    slide.addShape(pptx.ShapeType.rect, { x, y: 6.88, w: 3.2, h: 0.015, fill: { color: "C5CAD3" } });
  });
}

const DATE_HEADER = /date|dated|raised|cast|received|issued|occurrence|resolved/i;

/** Excel date serials (e.g. 45974) imported from client workbooks → 06-11-2025 under date columns. */
function cellText(header: string, v: string | number | null | undefined): string {
  if (typeof v === "number" && DATE_HEADER.test(header) && v > 30000 && v < 60000 && Number.isInteger(v)) {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    return `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
  }
  if (typeof v === "number" && !Number.isInteger(v)) return String(Math.round(v * 100) / 100);
  return String(v ?? "");
}

function tableSlide(
  pptx: PptxDeck,
  opts: {
    title: string;
    notes?: string;
    headers: string[];
    rows: (string | number | null)[][];
    client?: string;
    page: number;
    total: number;
    partLabel?: string;
    signatures?: { path: string; role: string; url?: string }[];
    projectCode?: string;
  }
) {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };
  brandBar(pptx, slide);
  addSharnamLogo(slide);
  slide.addText(opts.client || "Sharnam PMC", {
    x: MARGIN,
    y: 0.2,
    w: 8,
    h: 0.26,
    fontSize: 11,
    color: BRAND,
    bold: true,
  });
  const title = opts.partLabel ? `${opts.title}  ·  ${opts.partLabel}` : opts.title;
  slide.addText(title, {
    x: MARGIN,
    y: 0.48,
    w: CONTENT_W - 1.6,
    h: 0.4,
    fontSize: 20,
    bold: true,
    color: NAVY,
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: MARGIN,
    y: 0.92,
    w: 1.55,
    h: 0.055,
    fill: { color: ORANGE },
  });

  let y = 1.12;
  const caption = clientCaption(opts.notes);
  if (caption) {
    slide.addText(caption, {
      x: MARGIN,
      y,
      w: CONTENT_W,
      h: 0.38,
      fontSize: 10,
      color: MUTED,
    });
    y += 0.42;
  }

  const headers = opts.headers.length ? opts.headers : ["Item", "Detail"];
  const body = opts.rows.length ? opts.rows : [headers.map((_, i) => (i === 0 ? "No entries recorded for this reporting week." : ""))];
  const colW = colWidths(headers, CONTENT_W);
  const tableRows = [
    headers.map((h) => ({
      text: h,
      options: { bold: true, fill: { color: NAVY_XL }, color: WHITE, fontSize: 9, align: "center" },
    })),
    ...body.map((r, ri) =>
      headers.map((h, i) => ({
        text: cellText(h, r[i]),
        options: {
          fontSize: 9,
          color: INK,
          fill: { color: ri % 2 ? BAND : WHITE },
        },
      }))
    ),
  ];
  slide.addTable(tableRows, {
    x: MARGIN,
    y,
    w: CONTENT_W,
    colW,
    border: { type: "solid", color: "D6DEE8", pt: 0.5 },
    fontFace: "Calibri",
    valign: "middle",
  });
  if (opts.signatures) addSignOffStrip(pptx, slide, opts.signatures, opts.projectCode);
  footer(slide, opts.page, opts.total, opts.client);
}

/**
 * Local (uploads/…) paths need to be resolved to on-disk absolute paths so
 * pptxgenjs can inline them.  Remote URLs pass through untouched.
 */
function resolvePhotoPath(p: string, projectCode?: string): string | undefined {
  if (!p) return undefined;
  const raw = p.includes(" — ") ? p.split(" — ").pop()!.trim() : p.trim();
  if (/^https?:\/\//i.test(raw) || /^data:/i.test(raw)) return raw;

  const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
  const candidates: string[] = [];

  const odMatch = raw.match(/^\/uploads\/onedrive\/([^/]+)\/(.+)$/);
  if (odMatch) {
    candidates.push(path.join(UPLOAD_DIR, "onedrive", odMatch[1], odMatch[2]));
  }
  if (projectCode && !raw.startsWith("/uploads")) {
    candidates.push(path.join(UPLOAD_DIR, "onedrive", projectCode, raw.replace(/^\/+/, "")));
  }
  if (path.isAbsolute(raw)) {
    candidates.push(raw);
  } else {
    candidates.push(path.join(process.cwd(), raw.replace(/^\/+/, "")));
    candidates.push(path.join(UPLOAD_DIR, raw.replace(/^\/+/, "")));
  }

  for (const abs of candidates) {
    try {
      if (fs.existsSync(abs)) return abs;
    } catch {
      /* try next */
    }
  }
  return undefined;
}

/**
 * 4-photo grid per slide for progress-pictures section — makes actual site
 * photos land on the deck instead of URLs shown as table text.  Falls back
 * to the caption-only tableSlide if no photos resolve.
 */
function photoGridSlide(
  pptx: PptxDeck,
  opts: {
    title: string;
    captions: string[];
    photos: string[];
    client?: string;
    page: number;
    total: number;
    partLabel?: string;
  }
) {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };
  brandBar(pptx, slide);
  addSharnamLogo(slide);
  slide.addText(opts.client || "Sharnam PMC", {
    x: MARGIN, y: 0.2, w: 8, h: 0.26, fontSize: 11, color: BRAND, bold: true,
  });
  const title = opts.partLabel ? `${opts.title}  ·  ${opts.partLabel}` : opts.title;
  slide.addText(title, {
    x: MARGIN, y: 0.48, w: CONTENT_W - 1.6, h: 0.4, fontSize: 20, bold: true, color: NAVY,
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: MARGIN, y: 0.92, w: 1.55, h: 0.055, fill: { color: ORANGE },
  });

  // 1 photo: full width · 2: side by side · 3–4: 2 × 2 grid. Only real photos are placed.
  const n = Math.min(4, opts.photos.length);
  const gap = 0.22;
  const capH = 0.28;
  const originY = 1.15;
  const areaH = 6.85 - originY;
  const cols = n === 1 ? 1 : 2;
  const rows = n <= 2 ? 1 : 2;
  const cellW = (CONTENT_W - gap * (cols - 1)) / cols;
  const cellH = (areaH - rows * capH - gap * (rows - 1)) / rows;

  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN + col * (cellW + gap);
    const y = originY + row * (cellH + capH + gap);
    slide.addImage({ path: opts.photos[i], x, y, w: cellW, h: cellH, sizing: { type: "contain", w: cellW, h: cellH } });
    if (opts.captions[i]) {
      slide.addText(opts.captions[i], {
        x, y: y + cellH + 0.02, w: cellW, h: 0.22, fontSize: 9, color: INK,
      });
    }
  }

  footer(slide, opts.page, opts.total, opts.client);
}

function siteImageSlide(
  pptx: PptxDeck,
  meta: {
    client?: string;
    projectName?: string;
    location?: string;
    photo?: string;
    projectCode?: string;
    page: number;
    total: number;
  }
) {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };
  brandBar(pptx, slide);
  addSharnamLogo(slide);
  slide.addText(meta.client || "Sharnam PMC", {
    x: MARGIN,
    y: 0.2,
    w: 8,
    h: 0.26,
    fontSize: 11,
    color: BRAND,
    bold: true,
  });
  slide.addText("Site Location", {
    x: MARGIN,
    y: 0.48,
    w: CONTENT_W - 1.6,
    h: 0.4,
    fontSize: 20,
    bold: true,
    color: NAVY,
  });
  const photo = meta.photo ? resolvePhotoPath(meta.photo, meta.projectCode) : undefined;
  if (photo) {
    try {
      slide.addImage({ path: photo, x: MARGIN, y: 1.12, w: CONTENT_W, h: 5.7, sizing: { type: "contain", w: CONTENT_W, h: 5.7 } });
      footer(slide, meta.page, meta.total, meta.client);
      return;
    } catch {
      /* fall back to project details panel */
    }
  }
  slide.addShape(pptx.ShapeType.rect, {
    x: MARGIN,
    y: 1.12,
    w: CONTENT_W,
    h: 5.7,
    fill: { color: LIGHT },
  });
  slide.addText(
    [meta.projectName || "Project site", meta.location || ""].filter(Boolean).join("\n"),
    {
      x: MARGIN + 0.4,
      y: 3.1,
      w: CONTENT_W - 0.8,
      h: 1.6,
      fontSize: 16,
      color: MUTED,
      align: "center",
    }
  );
  footer(slide, meta.page, meta.total, meta.client);
}

/** How many data rows fit per content slide (matches dense Arvind tables). */
const ROWS_PER: Partial<Record<string, number>> = {
  milestones: 10,
  drawingRegister: 12,
  quality: 9,
  plannedVsActual: 12,
  valueAddition: 12,
  weeklyExecuted: 10,
  progressPictures: 8,
  cashflow: 14,
  hindrance: 12,
  risk: 12,
  legal: 12,
  communicationMatrix: 12,
  prTracker: 12,
  invoiceTracker: 12,
  capex: 12,
  cubeTest: 12,
  safety: 10,
  manpowerHistogram: 14,
  materialStock: 12,
  stakeholders: 12,
  designStatus: 12,
  procurement: 12,
  projectDashboard: 12,
  criticalAreas: 10,
  mobilisation: 10,
  brief: 12,
  index: 20,
};

/** Cap pages to the real deck — never pad empty slides. */
function slidesFor(key: string, natural: number): number {
  const cap: Record<string, number> = {
    milestones: 6,
    quality: 2,
    plannedVsActual: 3,
    weeklyExecuted: 3,
    progressPictures: 2,
    drawingRegister: 2,
    safety: 1,
    hindrance: 2,
    risk: 2,
    prTracker: 2,
    materialStock: 1,
  };
  const max = cap[key] ?? 2;
  return Math.min(Math.max(natural, 1), max);
}

/** Saved snapshots can still hold fill-in placeholders ("[Upload photo 1]", wpr-demo/…) — never send those to a client. */
function cleanSections(sections: WprPackInput["sections"], projectCode?: string): WprPackInput["sections"] {
  const placeholder = /\[(upload|add|insert)[^\]]*\]|wpr-demo\/|\(awaiting data\)/i;
  const out: WprPackInput["sections"] = {};
  for (const [key, sec] of Object.entries(sections || {})) {
    if (!sec) continue;
    let rows = (sec.rows || []).filter((r) => !r.some((c) => placeholder.test(String(c ?? ""))));
    let photos = sec.photos;
    if (photos) {
      const real = photos.filter((ph) => ph && !placeholder.test(ph) && resolvePhotoPath(ph, projectCode));
      rows = key === "progressPictures" || key === "weeklyExecuted" ? (sec.rows || []).filter((_, i) => photos![i] && real.includes(photos![i])) : rows;
      photos = real;
    }
    (out as any)[key] = { ...sec, rows, photos };
  }
  return out;
}

function ensureSection(pack: WprPackInput, key: keyof typeof DEFAULT_WPR_TITLES): WprSection {
  const sec = pack.sections[key];
  if (sec) return sec;
  return {
    title: PPTX_TITLES[key] || DEFAULT_WPR_TITLES[key],
    headers: ["Item", "Status"],
    rows: [],
  };
}

type PlanItem =
  | { type: "cover" }
  | { type: "index" }
  | { type: "divider"; title: string; no: string }
  | { type: "siteImage" }
  | { type: "section"; key: keyof typeof DEFAULT_WPR_TITLES; chunk: number; chunks: number }
  | { type: "photos"; key: keyof typeof DEFAULT_WPR_TITLES; chunk: number; chunks: number }
  | { type: "chart"; key: WprChartSlideKey };

type NarrativeItem =
  | { kind: "divider"; title: string }
  | { kind: "siteImage" }
  | { kind: "section"; key: keyof typeof DEFAULT_WPR_TITLES; index?: string };

/** Deck order (SPDC WPR_50). Dividers and `index` labels feed the INDEX slide in this same order. */
const NARRATIVE: NarrativeItem[] = [
  { kind: "divider", title: "Project Brief" },
  { kind: "section", key: "brief" },
  { kind: "siteImage" },
  { kind: "section", key: "stakeholders", index: "Project Stakeholders" },
  { kind: "section", key: "mobilisation", index: "Mobilisation Plan" },
  { kind: "section", key: "communicationMatrix" },
  { kind: "section", key: "projectDashboard" },
  { kind: "section", key: "criticalAreas" },
  { kind: "section", key: "capex" },
  { kind: "section", key: "prTracker" },
  { kind: "section", key: "invoiceTracker" },
  { kind: "section", key: "hindrance" },
  { kind: "section", key: "risk", index: "Risk Register" },
  { kind: "section", key: "legal" },
  { kind: "section", key: "drawingRegister" },
  { kind: "section", key: "designStatus" },
  { kind: "section", key: "procurement", index: "Procurement Status" },
  { kind: "divider", title: "Project Progress" },
  { kind: "section", key: "milestones" },
  { kind: "section", key: "manpowerHistogram" },
  { kind: "section", key: "weeklyExecuted" },
  { kind: "section", key: "cashflow" },
  { kind: "divider", title: "Weekly Quality Update" },
  { kind: "section", key: "quality" },
  { kind: "section", key: "cubeTest" },
  { kind: "divider", title: "Weekly Safety Update" },
  { kind: "section", key: "safety" },
  { kind: "divider", title: "Weekly Planned Vs. Actual" },
  { kind: "section", key: "plannedVsActual" },
  { kind: "section", key: "valueAddition" },
  { kind: "section", key: "materialStock" },
  { kind: "divider", title: "Project Progress Pictures" },
  { kind: "section", key: "progressPictures" },
];

/** Photo slides per section (4 photos each); sections not listed never get photo slides. */
const PHOTO_SLIDES_MAX: Partial<Record<string, number>> = {
  mobilisation: 1,
  weeklyExecuted: 2,
  progressPictures: 3,
};

/**
 * Photos that actually exist on disk (or are remote URLs), with their captions.
 * Missing files are dropped so the client deck never shows empty "(No photo)" boxes.
 */
function sectionPhotos(pack: WprPackInput, key: keyof typeof DEFAULT_WPR_TITLES): { path: string; caption: string }[] {
  const sec = pack.sections[key];
  if (!sec?.photos?.length) return [];
  const out: { path: string; caption: string }[] = [];
  sec.photos.forEach((p, i) => {
    const resolved = resolvePhotoPath(p, pack.header.projectCode);
    if (!resolved) return;
    // progressPictures rows are [#, caption, path] or [caption]; other sections' rows are not photo captions.
    let caption = "";
    if (key === "progressPictures") {
      const r = sec.rows?.[i] || [];
      caption = String((r.length > 1 ? r[1] : r[0]) ?? "");
    }
    out.push({ path: resolved, caption });
  });
  return out;
}

function buildPlan(pack: WprPackInput): { plan: PlanItem[]; index: IndexEntry[] } {
  const plan: PlanItem[] = [{ type: "cover" }, { type: "index" }];
  const index: IndexEntry[] = [];

  for (const n of NARRATIVE) {
    if (n.kind === "divider") {
      // Divider number is its own page in this deck (WPR_50 prints the page, e.g. "21").
      const page = plan.length + 1;
      plan.push({ type: "divider", title: n.title, no: String(page).padStart(2, "0") });
      index.push({ label: n.title, page });
      continue;
    }
    if (n.kind === "siteImage") {
      plan.push({ type: "siteImage" });
      continue;
    }
    if (n.index) index.push({ label: n.index, page: plan.length + 1 });
    const sec = ensureSection(pack, n.key);
    const natural = Math.max(1, chunkRows(sec.rows || [], ROWS_PER[n.key] || 12).length);
    const photoChunks = Math.min(PHOTO_SLIDES_MAX[n.key] ?? 0, Math.ceil(sectionPhotos(pack, n.key).length / 4));
    // Progress Pictures rows are only captions — the photos are the content.
    const tableChunks = n.key === "progressPictures" && photoChunks ? 0 : slidesFor(n.key, natural);
    for (let i = 0; i < tableChunks; i++) {
      plan.push({ type: "section", key: n.key, chunk: i, chunks: tableChunks });
    }
    for (let i = 0; i < photoChunks; i++) {
      plan.push({ type: "photos", key: n.key, chunk: i, chunks: photoChunks });
    }
    if (pack.charts) {
      for (const ck of CHART_AFTER[n.key] || []) {
        plan.push({ type: "chart", key: ck });
      }
    }
  }
  return { plan, index };
}

/** Week bounds are built at local 00:00 / 23:59 — format in the same zone so neither end shifts a day. */
function fmtReportDate(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

/**
 * Opt-in only: the reference-deck fill patches the cover and a couple of tables, every other
 * slide keeps the reference week's pasted content — wrong data for any other week or project.
 */
export function wprTemplateFillEnabled(): boolean {
  return process.env.WPR_PPTX_MODE === "template";
}

/** Index entries: every section divider with the page it starts on. */
function indexEntries(plan: PlanItem[]): { label: string; page: number }[] {
  return plan.flatMap((p, i) => (p.type === "divider" ? [{ label: p.title, page: i + 1 }] : []));
}

export async function buildWprPptx(pack: WprPackInput): Promise<Buffer> {
  if (wprTemplateFillEnabled()) {
    try {
      const { buildWprPptxFromTemplate, wprTemplateAvailable } = await import("./wprPptxTemplate.js");
      if (wprTemplateAvailable()) {
        return await buildWprPptxFromTemplate(pack);
      }
    } catch (err) {
      console.warn("[wpr] template PPTX export failed — using generated deck:", err instanceof Error ? err.message : err);
    }
  }
  return buildWprPptxGenerated(pack);
}

async function buildWprPptxGenerated(pack: WprPackInput): Promise<Buffer> {
  const rangeStart = pack.header.weekStart?.slice(0, 10) || new Date().toISOString().slice(0, 10);
  const rangeEnd = pack.header.weekEnd?.slice(0, 10) || rangeStart;
  const charts =
    pack.charts ?? mergeWprChartsForExport(pack.sections, null, rangeStart, rangeEnd);
  const fullPack: WprPackInput = { ...pack, charts, sections: cleanSections(pack.sections, pack.header.projectCode) };

  const pptx = createPptx();
  // Original SPDC WPR_50 is Office widescreen 13.33 × 7.5" (LAYOUT_WIDE).
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Sharnam PMC";
  // pptxgenjs writes company into docProps/app.xml without XML escaping — a raw "&" makes Office reject the file.
  pptx.company = "Sharnam Project Development Consultants &amp; Co.";
  pptx.subject = `WPR ${fullPack.header.reportNumber || fullPack.header.projectCode || ""}`;
  pptx.title = `Weekly Progress Report — ${fullPack.header.projectName || "Project"}`;

  const client = fullPack.header.clientName || fullPack.header.projectName || "Project";
  const weekStartLabel = fmtReportDate(fullPack.header.weekStart);
  const weekLabel = fmtReportDate(fullPack.header.weekEnd) || "—";
  const weekRange = weekStartLabel ? `(${weekStartLabel} to ${weekLabel})` : weekLabel;
  const reportNo = fullPack.header.reportNumber || "—";
  const { plan, index: indexEntries } = buildPlan(fullPack);
  const total = plan.length;
  let page = 0;

  for (const item of plan) {
    page += 1;
    if (item.type === "cover") {
      const slide = pptx.addSlide();
      slide.background = { color: WHITE };
      slide.addShape(pptx.ShapeType.rect, {
        x: 0,
        y: 0,
        w: SLIDE_W,
        h: SLIDE_H,
        fill: { color: NAVY },
      });
      slide.addShape(pptx.ShapeType.rect, {
        x: 0,
        y: 0,
        w: 0.22,
        h: SLIDE_H,
        fill: { color: ORANGE },
      });
      addSharnamLogo(slide, 11.4, 0.28, 1.5, 0.48);
      slide.addText("WEEKLY PROGRESS REPORT", {
        x: 0.7,
        y: 1.55,
        w: 12,
        h: 0.7,
        fontSize: 32,
        bold: true,
        color: WHITE,
      });
      slide.addText(fullPack.header.clientName || fullPack.header.projectName || "Project", {
        x: 0.7,
        y: 2.3,
        w: 12,
        h: 0.7,
        fontSize: 28,
        bold: true,
        color: ORANGE,
      });
      slide.addShape(pptx.ShapeType.rect, {
        x: 0.7,
        y: 3.15,
        w: 2.2,
        h: 0.06,
        fill: { color: BRAND },
      });
      slide.addText(`REPORT NO.  ${reportNo}`, {
        x: 0.7,
        y: 3.45,
        w: 12,
        h: 0.42,
        fontSize: 20,
        bold: true,
        color: WHITE,
      });
      slide.addText(weekRange, {
        x: 0.7,
        y: 3.95,
        w: 12,
        h: 0.38,
        fontSize: 16,
        color: "D6DEE8",
      });
      slide.addText(
        [
          fullPack.header.projectName || "",
          `Contractor  ${fullPack.header.contractorName || "—"}`,
          `PMC  ${fullPack.header.pmc || "Sharnam Project Development Consultants & Co."}`,
        ]
          .filter(Boolean)
          .join("   ·   "),
        { x: 0.7, y: 5.85, w: 12, h: 0.4, fontSize: 13, color: "B8C4D0" }
      );
      footer(slide, page, total, client, "B8C4D0");
      continue;
    }

    if (item.type === "index") {
      indexSlide(pptx, indexEntries, { client, page, total });
      continue;
    }

    if (item.type === "divider") {
      dividerSlide(pptx, item.title, item.no, { client, page, total });
      continue;
    }

    if (item.type === "siteImage") {
      siteImageSlide(pptx, {
        client,
        projectName: fullPack.header.projectName,
        location: fullPack.header.location,
        photo: fullPack.sections.brief?.photos?.[0],
        projectCode: fullPack.header.projectCode,
        page,
        total,
      });
      continue;
    }

    if (item.type === "chart" && fullPack.charts) {
      renderWprChartSlide(pptx, item.key, fullPack.charts, { client, page, total });
      continue;
    }

    if (item.type === "photos") {
      const sec = ensureSection(fullPack, item.key);
      const photos = sectionPhotos(fullPack, item.key).slice(item.chunk * 4, item.chunk * 4 + 4);
      photoGridSlide(pptx, {
        title: `${PPTX_TITLES[item.key] || sec.title || DEFAULT_WPR_TITLES[item.key]}${item.key === "progressPictures" ? "" : " · Photographs"}`,
        captions: photos.map((p) => p.caption),
        photos: photos.map((p) => p.path),
        client,
        page,
        total,
        partLabel: item.chunks > 1 ? `Part ${item.chunk + 1} of ${item.chunks}` : undefined,
      });
      continue;
    }

    if (item.type !== "section") continue;

    const sec = ensureSection(fullPack, item.key);

    const per = ROWS_PER[item.key] || 12;
    const parts = chunkRows(sec.rows || [], per);
    // When we force maxChunks > natural (e.g. milestones pad), repeat last / show empty note
    const rows = parts[Math.min(item.chunk, parts.length - 1)] || [];
    const showEmpty =
      item.chunk >= parts.length
        ? []
        : rows;
    const signKeys = item.key === "brief" || item.key === "projectDashboard";
    tableSlide(pptx, {
      title: PPTX_TITLES[item.key] || sec.title || DEFAULT_WPR_TITLES[item.key],
      notes: item.chunk === 0 ? clientFacingNote(sec.notes) : undefined,
      headers: sec.headers || ["Item", "Detail"],
      rows: showEmpty,
      client,
      page,
      total,
      partLabel: item.chunks > 1 ? `Part ${item.chunk + 1} of ${item.chunks}` : undefined,
      signatures: signKeys && item.chunk === item.chunks - 1 ? fullPack.packExtras?.signatures : undefined,
      projectCode: fullPack.header.projectCode,
    });
  }

  const out = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return Buffer.from(out);
}

export function estimateWprSlideCount(pack: WprPackInput): number {
  return buildPlan(pack).plan.length;
}
