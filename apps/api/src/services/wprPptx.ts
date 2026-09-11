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

const INDEX_ITEMS = [
  "Project Brief",
  "Project Stakeholders",
  "Mobilisation Plan",
  "Risk Register",
  "Procurement Tracker",
  "Weekly Safety Update",
  "Weekly Quality Update",
  "Project Progress",
  "Weekly Planned Vs. Actual",
  "Project Progress Pictures",
];

function indexSlide(
  pptx: PptxDeck,
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

  INDEX_ITEMS.forEach((label, i) => {
    const col = i < 5 ? 0 : 1;
    const row = i % 5;
    const x = MARGIN + col * 6.3;
    const y = 1.3 + row * 1.05;
    slide.addShape(pptx.ShapeType.rect, {
      x,
      y,
      w: 5.95,
      h: 0.88,
      fill: { color: i % 2 ? BAND : LIGHT },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x,
      y,
      w: 0.88,
      h: 0.88,
      fill: { color: BRAND },
    });
    slide.addText(String(i + 1), {
      x,
      y,
      w: 0.88,
      h: 0.88,
      fontSize: 22,
      bold: true,
      color: WHITE,
      align: "center",
      valign: "middle",
    });
    slide.addText(label, {
      x: x + 1.05,
      y,
      w: 4.7,
      h: 0.88,
      fontSize: 16,
      bold: true,
      color: NAVY,
      valign: "middle",
    });
  });
  footer(slide, meta.page, meta.total, meta.client);
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
  if (opts.notes) {
    slide.addText(opts.notes, {
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
  const body = opts.rows.length ? opts.rows : [["(No rows — fill in WPR Maker / sync registers)", ""]];
  const colW = colWidths(headers, CONTENT_W);
  const tableRows = [
    headers.map((h) => ({
      text: h,
      options: { bold: true, fill: { color: NAVY_XL }, color: WHITE, fontSize: 9, align: "center" },
    })),
    ...body.map((r, ri) =>
      headers.map((_, i) => ({
        text: String(r[i] ?? ""),
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
    projectCode?: string;
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

  const cellW = 6.05;
  const cellH = 2.55;
  const gap = 0.22;
  const originY = 1.15;

  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN + col * (cellW + gap);
    const y = originY + row * (cellH + gap + 0.28);
    const src = opts.photos[i] ? resolvePhotoPath(opts.photos[i], opts.projectCode) : undefined;
    if (src) {
      slide.addImage({ path: src, x, y, w: cellW, h: cellH, sizing: { type: "contain", w: cellW, h: cellH } });
    } else {
      slide.addShape(pptx.ShapeType.rect, {
        x, y, w: cellW, h: cellH,
        fill: { color: LIGHT },
        line: { color: "E2E5EB", width: 0.5 },
      });
      slide.addText("(No photo)", {
        x, y, w: cellW, h: cellH, fontSize: 10, color: MUTED, align: "center", valign: "middle",
      });
    }
    slide.addText(opts.captions[i] || `Photo ${i + 1}`, {
      x, y: y + cellH + 0.02, w: cellW, h: 0.22, fontSize: 9, color: INK,
    });
  }

  footer(slide, opts.page, opts.total, opts.client);
}

function siteImageSlide(
  pptx: PptxDeck,
  meta: { client?: string; projectName?: string; location?: string; page: number; total: number }
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
  slide.addText("Site location / Google Earth view", {
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
    y: 1.12,
    w: CONTENT_W,
    h: 5.7,
    fill: { color: LIGHT },
  });
  slide.addText(
    [
      meta.projectName || "Project site",
      meta.location || "Attach Google Earth / site photo in WPR Maker photos",
      "",
      "Placeholder — portal photos appear on Progress Pictures slides.",
    ].join("\n"),
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

function ensureSection(pack: WprPackInput, key: keyof typeof DEFAULT_WPR_TITLES): WprSection {
  const sec = pack.sections[key];
  if (sec) return sec;
  return {
    title: PPTX_TITLES[key] || DEFAULT_WPR_TITLES[key],
    headers: ["Item", "Status"],
    rows: [["(Awaiting data)", "Open"]],
    notes: "Populate via WPR Maker sync from portal registers.",
  };
}

type PlanItem =
  | { type: "cover" }
  | { type: "index" }
  | { type: "divider"; title: string; no: string }
  | { type: "siteImage" }
  | { type: "section"; key: keyof typeof DEFAULT_WPR_TITLES; chunk: number; chunks: number }
  | { type: "chart"; key: WprChartSlideKey };

function buildPlan(pack: WprPackInput): PlanItem[] {
  const plan: PlanItem[] = [{ type: "cover" }, { type: "index" }];

  const narrative: Array<
    | { kind: "divider"; title: string; no: string }
    | { kind: "siteImage" }
    | { kind: "section"; key: keyof typeof DEFAULT_WPR_TITLES }
  > = [
    { kind: "divider", title: "Project Brief", no: "03" },
    { kind: "section", key: "brief" },
    { kind: "siteImage" },
    { kind: "section", key: "stakeholders" },
    { kind: "section", key: "mobilisation" },
    { kind: "section", key: "communicationMatrix" },
    { kind: "section", key: "projectDashboard" },
    { kind: "section", key: "criticalAreas" },
    { kind: "section", key: "capex" },
    { kind: "section", key: "prTracker" },
    { kind: "section", key: "invoiceTracker" },
    { kind: "section", key: "hindrance" },
    { kind: "section", key: "risk" },
    { kind: "section", key: "legal" },
    { kind: "section", key: "drawingRegister" },
    { kind: "section", key: "designStatus" },
    { kind: "section", key: "procurement" },
    { kind: "divider", title: "Project Progress", no: "21" },
    { kind: "section", key: "milestones" },
    { kind: "section", key: "manpowerHistogram" },
    { kind: "section", key: "weeklyExecuted" },
    { kind: "section", key: "cashflow" },
    { kind: "divider", title: "Weekly Quality Update", no: "40" },
    { kind: "section", key: "quality" },
    { kind: "section", key: "cubeTest" },
    { kind: "divider", title: "Weekly Safety Update", no: "51" },
    { kind: "section", key: "safety" },
    { kind: "divider", title: "Weekly Planned Vs. Actual", no: "54" },
    { kind: "section", key: "plannedVsActual" },
    { kind: "section", key: "valueAddition" },
    { kind: "section", key: "materialStock" },
    { kind: "divider", title: "Project Progress Pictures", no: "59" },
    { kind: "section", key: "progressPictures" },
  ];

  for (const n of narrative) {
    if (n.kind === "divider") {
      plan.push({ type: "divider", title: n.title, no: n.no });
      continue;
    }
    if (n.kind === "siteImage") {
      plan.push({ type: "siteImage" });
      continue;
    }
    const sec = ensureSection(pack, n.key);
    const natural = Math.max(1, chunkRows(sec.rows || [], ROWS_PER[n.key] || 12).length);
    // Progress-pictures: 4 photos per slide when photos are provided, so the
    // slide count grows/shrinks with the actual photo pack instead of being
    // capped at the fixed 2 (which either padded blank slides or dropped
    // photos past the cap when the client supplied more than 8).
    let useChunks: number;
    if (n.key === "progressPictures" && sec.photos && sec.photos.length) {
      useChunks = Math.max(1, Math.min(2, Math.ceil(sec.photos.length / 4)));
    } else if (n.key === "weeklyExecuted" && sec.photos && sec.photos.length) {
      useChunks = Math.max(1, Math.min(3, Math.ceil(sec.photos.length / 2)));
    } else {
      useChunks = slidesFor(n.key, natural);
    }
    for (let i = 0; i < useChunks; i++) {
      plan.push({ type: "section", key: n.key, chunk: i, chunks: useChunks });
    }
    if (pack.charts) {
      for (const ck of CHART_AFTER[n.key] || []) {
        plan.push({ type: "chart", key: ck });
      }
    }
  }
  return plan;
}

export async function buildWprPptx(pack: WprPackInput): Promise<Buffer> {
  const rangeStart = pack.header.weekStart?.slice(0, 10) || new Date().toISOString().slice(0, 10);
  const rangeEnd = pack.header.weekEnd?.slice(0, 10) || rangeStart;
  const charts =
    pack.charts ?? mergeWprChartsForExport(pack.sections, null, rangeStart, rangeEnd);
  const fullPack: WprPackInput = { ...pack, charts };

  const pptx = createPptx();
  // Original SPDC WPR_50 is Office widescreen 13.33 × 7.5" (LAYOUT_WIDE).
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Sharnam PMC";
  pptx.company = "Sharnam Project Development Consultants & Co.";
  pptx.subject = `WPR ${fullPack.header.reportNumber || fullPack.header.projectCode || ""}`;
  pptx.title = `Weekly Progress Report — ${fullPack.header.projectName || "Project"}`;

  const client = fullPack.header.clientName || fullPack.header.projectName || "Project";
  const weekStartLabel = fullPack.header.weekStart
    ? new Date(fullPack.header.weekStart).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "";
  const weekLabel = fullPack.header.weekEnd
    ? new Date(fullPack.header.weekEnd).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "—";
  const weekRange = weekStartLabel ? `(${weekStartLabel} to ${weekLabel})` : weekLabel;
  const reportNo = fullPack.header.reportNumber || "—";
  const plan = buildPlan(fullPack);
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
      indexSlide(pptx, { client, page, total });
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
        page,
        total,
      });
      continue;
    }

    if (item.type === "chart" && fullPack.charts) {
      renderWprChartSlide(pptx, item.key, fullPack.charts, { client, page, total });
      continue;
    }

    if (item.type !== "section") continue;

    const sec = ensureSection(fullPack, item.key);

    // Progress-pictures: render a proper 4-photo grid per slide when the
    // section carries any photo paths.  Falls back to the caption-only
    // tableSlide when photos array is empty (keeps prior behaviour).
    const photoPer = item.key === "progressPictures" ? 4 : item.key === "weeklyExecuted" ? 2 : 0;
    if (photoPer && sec.photos && sec.photos.length) {
      const start = item.chunk * photoPer;
      const photos = sec.photos.slice(start, start + photoPer);
      const captions = (sec.rows || []).slice(start, start + photoPer).map((r) => String(r?.[0] ?? r?.[1] ?? ""));
      if (photos.length) {
        photoGridSlide(pptx, {
          title: PPTX_TITLES[item.key] || sec.title || DEFAULT_WPR_TITLES[item.key],
          captions,
          photos,
          client,
          page,
          total,
          projectCode: fullPack.header.projectCode,
          partLabel: item.chunks > 1 ? `Part ${item.chunk + 1} of ${item.chunks}` : undefined,
        });
        continue;
      }
    }

    const per = ROWS_PER[item.key] || 12;
    const parts = chunkRows(sec.rows || [], per);
    // When we force maxChunks > natural (e.g. milestones pad), repeat last / show empty note
    const rows = parts[Math.min(item.chunk, parts.length - 1)] || [];
    const showEmpty =
      item.chunk >= parts.length
        ? [["(Continuation — add more rows in registers)", ""]]
        : rows;
    const signKeys = item.key === "brief" || item.key === "projectDashboard";
    tableSlide(pptx, {
      title: PPTX_TITLES[item.key] || sec.title || DEFAULT_WPR_TITLES[item.key],
      notes: item.chunk === 0 ? sec.notes : undefined,
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
  return buildPlan(pack).length;
}
