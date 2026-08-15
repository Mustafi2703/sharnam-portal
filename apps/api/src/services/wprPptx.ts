/**
 * WPR PPTX generator — slide deck aligned to SPDC_Arvind Limited_WPR_50.pptx section list.
 */
import pptxgenImport from "pptxgenjs";
import {
  DEFAULT_WPR_TITLES,
  SECTION_ORDER,
  type WprPackInput,
  type WprSection,
} from "./wprXlsx.js";

const BRAND = "0F766E";
const DARK = "1A1D26";

type PptxSlide = {
  background: { color: string };
  addText: (text: string | string[], opts: Record<string, unknown>) => void;
  addShape: (type: string, opts: Record<string, unknown>) => void;
  addTable: (rows: unknown[], opts: Record<string, unknown>) => void;
};

type PptxDeck = {
  layout: string;
  author: string;
  company: string;
  subject: string;
  ShapeType: { rect: string };
  addSlide: () => PptxSlide;
  write: (opts: { outputType: "nodebuffer" }) => Promise<Buffer | Uint8Array>;
};

function createPptx(): PptxDeck {
  const Ctor = pptxgenImport as unknown as new () => PptxDeck;
  return new Ctor();
}

function addSectionSlide(pptx: PptxDeck, sec: WprSection | undefined, fallbackTitle: string) {
  if (!sec) return;
  const slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };
  slide.addText(sec.title || fallbackTitle, {
    x: 0.5,
    y: 0.35,
    w: 9,
    h: 0.6,
    fontSize: 22,
    bold: true,
    color: DARK,
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.5,
    y: 0.95,
    w: 1.2,
    h: 0.06,
    fill: { color: BRAND },
  });
  if (sec.notes) {
    slide.addText(sec.notes, {
      x: 0.5,
      y: 1.1,
      w: 9,
      h: 0.8,
      fontSize: 11,
      color: "5C6578",
    });
  }
  const headers = sec.headers?.length ? sec.headers : ["Item", "Detail"];
  const rows = sec.rows?.length
    ? sec.rows.map((r) => r.map((c) => String(c ?? "")))
    : [["(No rows — fill in WPR Maker)", ""]];
  const tableRows = [
    headers.map((h) => ({
      text: h,
      options: { bold: true, fill: { color: "F0F2F5" }, color: DARK, fontSize: 9 },
    })),
    ...rows.slice(0, 12).map((r) =>
      r.map((c) => ({ text: c, options: { fontSize: 9, color: DARK } }))
    ),
  ];
  slide.addTable(tableRows, {
    x: 0.5,
    y: sec.notes ? 2.0 : 1.2,
    w: 9,
    colW: headers.map(() => 9 / headers.length),
    border: { type: "solid", color: "E2E5EB", pt: 0.5 },
  });
  slide.addText("Sharnam PMC · शरणम्", {
    x: 0.5,
    y: 5.2,
    w: 4,
    h: 0.3,
    fontSize: 8,
    color: "5C6578",
  });
}

export async function buildWprPptx(pack: WprPackInput): Promise<Buffer> {
  const pptx = createPptx();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "Sharnam PMC";
  pptx.company = "Sharnam Project Development Consultants & Co.";
  pptx.subject = `WPR ${pack.header.projectCode || ""}`;

  const cover = pptx.addSlide();
  cover.background = { color: DARK };
  cover.addText("Weekly Progress Report", {
    x: 0.6,
    y: 1.4,
    w: 8.8,
    h: 0.8,
    fontSize: 32,
    bold: true,
    color: "FFFFFF",
  });
  cover.addText(pack.header.projectName || "Project", {
    x: 0.6,
    y: 2.3,
    w: 8.8,
    h: 0.5,
    fontSize: 18,
    color: "99F6E4",
  });
  cover.addText(
    [
      `Week ending: ${pack.header.weekEnd ? new Date(pack.header.weekEnd).toLocaleDateString("en-IN") : "—"}`,
      `Client: ${pack.header.clientName || "—"}`,
      `Contractor: ${pack.header.contractorName || "—"}`,
      `PMC: ${pack.header.pmc || "Sharnam PMC"}`,
    ].join("\n"),
    { x: 0.6, y: 3.1, w: 8.8, h: 1.5, fontSize: 12, color: "E2E5EB" }
  );

  for (const key of SECTION_ORDER) {
    if (key === "cover") continue;
    addSectionSlide(pptx, pack.sections[key], DEFAULT_WPR_TITLES[key]);
  }

  const out = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return Buffer.from(out);
}
