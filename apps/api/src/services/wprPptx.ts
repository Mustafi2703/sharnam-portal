/**
 * WPR PPTX — full deck aligned to SPDC_Arvind Limited_WPR_50.pptx (~61 slides).
 * Built with pptxgenjs from live WPR pack data (same approach as DPR Excel fill).
 */
import pptxgenImport from "pptxgenjs";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_WPR_TITLES,
  type WprPackInput,
  type WprSection,
} from "./wprXlsx.js";

const BRAND = "0F766E";
const DARK = "1A1D26";
const MUTED = "5C6578";
const LIGHT = "F0F2F5";
const WHITE = "FFFFFF";

type PptxSlide = {
  background: { color: string };
  addText: (text: string | string[] | unknown, opts: Record<string, unknown>) => void;
  addShape: (type: string, opts: Record<string, unknown>) => void;
  addTable: (rows: unknown[], opts: Record<string, unknown>) => void;
  addImage: (opts: Record<string, unknown>) => void;
};

type PptxDeck = {
  layout: string;
  author: string;
  company: string;
  subject: string;
  title: string;
  ShapeType: { rect: string };
  addSlide: () => PptxSlide;
  write: (opts: { outputType: "nodebuffer" }) => Promise<Buffer | Uint8Array>;
};

function createPptx(): PptxDeck {
  const Ctor = pptxgenImport as unknown as new () => PptxDeck;
  return new Ctor();
}

function footer(slide: PptxSlide, page: number, total: number, client?: string) {
  slide.addText(client || "Sharnam PMC", {
    x: 0.4,
    y: 5.15,
    w: 5,
    h: 0.25,
    fontSize: 8,
    color: MUTED,
  });
  slide.addText(`${page} / ${total}`, {
    x: 8.2,
    y: 5.15,
    w: 1.4,
    h: 0.25,
    fontSize: 8,
    color: MUTED,
    align: "right",
  });
}

function brandBar(pptx: PptxDeck, slide: PptxSlide) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 10,
    h: 0.08,
    fill: { color: BRAND },
  });
}

function dividerSlide(
  pptx: PptxDeck,
  title: string,
  pageNo: string,
  meta: { client?: string; page: number; total: number }
) {
  const slide = pptx.addSlide();
  slide.background = { color: DARK };
  brandBar(pptx, slide);
  slide.addText(pageNo, {
    x: 0.6,
    y: 1.6,
    w: 8.8,
    h: 0.5,
    fontSize: 14,
    color: "99F6E4",
  });
  slide.addText(title, {
    x: 0.6,
    y: 2.2,
    w: 8.8,
    h: 1,
    fontSize: 36,
    bold: true,
    color: WHITE,
  });
  slide.addText(meta.client || "Sharnam PMC · Weekly Progress Report", {
    x: 0.6,
    y: 3.5,
    w: 8.8,
    h: 0.4,
    fontSize: 14,
    color: "E2E5EB",
  });
  footer(slide, meta.page, meta.total, meta.client);
}

function chunkRows(rows: (string | number | null)[][], size: number) {
  if (!rows.length) return [[] as (string | number | null)[][]];
  const out: (string | number | null)[][][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
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
  }
) {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };
  brandBar(pptx, slide);
  slide.addText(opts.client || "Sharnam PMC", {
    x: 0.4,
    y: 0.18,
    w: 5,
    h: 0.28,
    fontSize: 10,
    color: BRAND,
    bold: true,
  });
  const title = opts.partLabel ? `${opts.title}  ·  ${opts.partLabel}` : opts.title;
  slide.addText(title, {
    x: 0.4,
    y: 0.45,
    w: 9.2,
    h: 0.4,
    fontSize: 18,
    bold: true,
    color: DARK,
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.4,
    y: 0.88,
    w: 1.1,
    h: 0.05,
    fill: { color: BRAND },
  });

  let y = 1.05;
  if (opts.notes) {
    slide.addText(opts.notes, {
      x: 0.4,
      y,
      w: 9.2,
      h: 0.45,
      fontSize: 10,
      color: MUTED,
    });
    y += 0.5;
  }

  const headers = opts.headers.length ? opts.headers : ["Item", "Detail"];
  const body = opts.rows.length ? opts.rows : [["(No rows — fill in WPR Maker / sync registers)", ""]];
  const colW = headers.map(() => 9.2 / headers.length);
  const tableRows = [
    headers.map((h) => ({
      text: h,
      options: { bold: true, fill: { color: LIGHT }, color: DARK, fontSize: 8 },
    })),
    ...body.map((r) =>
      headers.map((_, i) => ({
        text: String(r[i] ?? ""),
        options: { fontSize: 8, color: DARK },
      }))
    ),
  ];
  slide.addTable(tableRows, {
    x: 0.4,
    y,
    w: 9.2,
    colW,
    border: { type: "solid", color: "E2E5EB", pt: 0.5 },
    fontFace: "Calibri",
  });
  footer(slide, opts.page, opts.total, opts.client);
}

/**
 * Local (uploads/…) paths need to be resolved to on-disk absolute paths so
 * pptxgenjs can inline them.  Remote URLs pass through untouched.
 */
function resolvePhotoPath(p: string): string | undefined {
  if (!p) return undefined;
  if (/^https?:\/\//i.test(p) || /^data:/i.test(p)) return p;
  try {
    const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p.replace(/^\/+/, ""));
    return fs.existsSync(abs) ? abs : undefined;
  } catch {
    return undefined;
  }
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
  slide.addText(opts.client || "Sharnam PMC", {
    x: 0.4, y: 0.18, w: 5, h: 0.28, fontSize: 10, color: BRAND, bold: true,
  });
  const title = opts.partLabel ? `${opts.title}  ·  ${opts.partLabel}` : opts.title;
  slide.addText(title, {
    x: 0.4, y: 0.45, w: 9.2, h: 0.4, fontSize: 18, bold: true, color: DARK,
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.4, y: 0.88, w: 1.1, h: 0.05, fill: { color: BRAND },
  });

  // 2 × 2 grid inside the 9.2 × 4.05 content area starting y = 1.0.
  const cellW = 4.5;
  const cellH = 1.95;
  const gap = 0.2;
  const originY = 1.0;

  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.4 + col * (cellW + gap);
    const y = originY + row * (cellH + gap + 0.25); // extra 0.25 for caption
    const src = opts.photos[i] ? resolvePhotoPath(opts.photos[i]) : undefined;
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
      x, y: y + cellH + 0.02, w: cellW, h: 0.22, fontSize: 9, color: DARK,
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
  slide.addText(meta.client || "Sharnam PMC", {
    x: 0.4,
    y: 0.18,
    w: 5,
    h: 0.28,
    fontSize: 10,
    color: BRAND,
    bold: true,
  });
  slide.addText("Site location / Google Earth view", {
    x: 0.4,
    y: 0.45,
    w: 9.2,
    h: 0.4,
    fontSize: 18,
    bold: true,
    color: DARK,
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.4,
    y: 1.1,
    w: 9.2,
    h: 3.5,
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
      x: 0.8,
      y: 2.2,
      w: 8.4,
      h: 1.5,
      fontSize: 14,
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
  weeklyExecuted: 10,
  progressPictures: 8,
  cashflow: 14,
  hindrance: 12,
  risk: 12,
  legal: 12,
  communicationMatrix: 12,
  prTracker: 12,
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

/** Fixed multi-slide counts matching SPDC_Arvind Limited_WPR_50.pptx layout. */
function slidesFor(key: string, natural: number): number {
  const fixed: Record<string, number> = {
    milestones: 13,
    quality: 10,
    plannedVsActual: 3,
    weeklyExecuted: 3,
    progressPictures: 2,
    drawingRegister: 2,
    safety: 2,
  };
  if (fixed[key] != null) return fixed[key];
  return Math.min(Math.max(natural, 1), 4);
}

function ensureSection(pack: WprPackInput, key: keyof typeof DEFAULT_WPR_TITLES): WprSection {
  const sec = pack.sections[key];
  if (sec) return sec;
  return {
    title: DEFAULT_WPR_TITLES[key],
    headers: ["Item", "Status"],
    rows: [["(Awaiting data)", "Open"]],
    notes: "Populate via WPR Maker sync from portal registers.",
  };
}

type PlanItem =
  | { type: "cover" }
  | { type: "divider"; title: string; no: string }
  | { type: "siteImage" }
  | { type: "section"; key: keyof typeof DEFAULT_WPR_TITLES; chunk: number; chunks: number };

function buildPlan(pack: WprPackInput): PlanItem[] {
  const plan: PlanItem[] = [{ type: "cover" }];

  const narrative: Array<
    | { kind: "divider"; title: string; no: string }
    | { kind: "siteImage" }
    | { kind: "section"; key: keyof typeof DEFAULT_WPR_TITLES }
  > = [
    { kind: "section", key: "index" },
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
      useChunks = Math.max(1, Math.ceil(sec.photos.length / 4));
    } else {
      useChunks = slidesFor(n.key, natural);
    }
    for (let i = 0; i < useChunks; i++) {
      plan.push({ type: "section", key: n.key, chunk: i, chunks: useChunks });
    }
  }
  return plan;
}

export async function buildWprPptx(pack: WprPackInput): Promise<Buffer> {
  const pptx = createPptx();
  // LAYOUT_16x9 = 10.0 × 5.625" — matches every hard-coded coordinate in this
  // file (x 0.4 → w 9.2, footer y 5.15).  LAYOUT_WIDE (13.33 × 7.5") pushed
  // all content into the top-left quadrant, leaving the right and bottom of
  // each slide empty and causing prints / photos to look truncated.
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "Sharnam PMC";
  pptx.company = "Sharnam Project Development Consultants & Co.";
  pptx.subject = `WPR ${pack.header.reportNumber || pack.header.projectCode || ""}`;
  pptx.title = `Weekly Progress Report — ${pack.header.projectName || "Project"}`;

  const client = pack.header.clientName || pack.header.projectName || "Project";
  const weekLabel = pack.header.weekEnd
    ? new Date(pack.header.weekEnd).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
  const reportNo = pack.header.reportNumber || "—";
  const plan = buildPlan(pack);
  const total = plan.length;
  let page = 0;

  for (const item of plan) {
    page += 1;
    if (item.type === "cover") {
      const slide = pptx.addSlide();
      slide.background = { color: DARK };
      brandBar(pptx, slide);
      slide.addText("WEEKLY PROGRESS REPORT", {
        x: 0.6,
        y: 1.3,
        w: 8.8,
        h: 0.55,
        fontSize: 14,
        color: "99F6E4",
        bold: true,
      });
      slide.addText(pack.header.projectName || "Project", {
        x: 0.6,
        y: 1.9,
        w: 8.8,
        h: 0.7,
        fontSize: 28,
        bold: true,
        color: WHITE,
      });
      slide.addText(
        [
          `REPORT NO.  ${reportNo}`,
          `Week ending  ${weekLabel}`,
          `Client  ${pack.header.clientName || "—"}`,
          `Contractor  ${pack.header.contractorName || "—"}`,
          `PMC  ${pack.header.pmc || "Sharnam Project Development Consultants & Co."}`,
        ].join("\n"),
        { x: 0.6, y: 2.9, w: 8.8, h: 1.6, fontSize: 13, color: "E2E5EB" }
      );
      slide.addText("Generated from Sharnam Portal · live registers", {
        x: 0.6,
        y: 4.8,
        w: 8.8,
        h: 0.3,
        fontSize: 10,
        color: MUTED,
      });
      footer(slide, page, total, client);
      continue;
    }

    if (item.type === "divider") {
      dividerSlide(pptx, item.title, item.no, { client, page, total });
      continue;
    }

    if (item.type === "siteImage") {
      siteImageSlide(pptx, {
        client,
        projectName: pack.header.projectName,
        location: pack.header.location,
        page,
        total,
      });
      continue;
    }

    const sec = ensureSection(pack, item.key);

    // Progress-pictures: render a proper 4-photo grid per slide when the
    // section carries any photo paths.  Falls back to the caption-only
    // tableSlide when photos array is empty (keeps prior behaviour).
    if (item.key === "progressPictures" && sec.photos && sec.photos.length) {
      const perSlide = 4;
      const start = item.chunk * perSlide;
      const photos = sec.photos.slice(start, start + perSlide);
      const captions = (sec.rows || []).slice(start, start + perSlide).map((r) => String(r?.[0] ?? ""));
      if (photos.length) {
        photoGridSlide(pptx, {
          title: sec.title || DEFAULT_WPR_TITLES[item.key],
          captions,
          photos,
          client,
          page,
          total,
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
    tableSlide(pptx, {
      title: sec.title || DEFAULT_WPR_TITLES[item.key],
      notes: item.chunk === 0 ? sec.notes : undefined,
      headers: sec.headers || ["Item", "Detail"],
      rows: showEmpty,
      client,
      page,
      total,
      partLabel: item.chunks > 1 ? `Part ${item.chunk + 1} of ${item.chunks}` : undefined,
    });
  }

  const out = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return Buffer.from(out);
}

export function estimateWprSlideCount(pack: WprPackInput): number {
  return buildPlan(pack).length;
}
