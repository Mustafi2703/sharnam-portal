/**
 * Native Excel charts for generated workbooks.
 *
 * ExcelJS (and SheetJS) drop charts when they re-save a workbook, so every template-based export lost the
 * client's charts (DPR S-curve, WPR client pack …). This module works on the finished .xlsx package:
 *
 *   restoreTemplateCharts(template, out) — copy each chart of the template onto the same-named sheet of the
 *                                          output, with its style / colour parts.
 *   addCharts(out, specs)               — add new bar / line / pie charts that read ranges of a sheet.
 *
 * Every chart's cached values are refreshed from the output cells (so previews show today's numbers) and the
 * workbook is flagged to recalculate on open (so formula-driven series are current in Excel).
 */
import JSZip from "jszip";
import XLSX, { type WorkBook } from "./xlsx.js";

const NS = {
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  drawingRel: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing",
  chartRel: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart",
  chartStyleRel: "http://schemas.microsoft.com/office/2011/relationships/chartStyle",
  chartColorRel: "http://schemas.microsoft.com/office/2011/relationships/chartColorStyle",
  xdr: "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing",
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  c: "http://schemas.openxmlformats.org/drawingml/2006/chart",
};
const CT = {
  drawing: "application/vnd.openxmlformats-officedocument.drawing+xml",
  chart: "application/vnd.openxmlformats-officedocument.drawingml.chart+xml",
  chartStyle: "application/vnd.ms-office.chartstyle+xml",
  chartColors: "application/vnd.ms-office.chartcolorstyle+xml",
};

type Rel = { id: string; type: string; target: string; mode?: string };

const unesc = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const attr = (tag: string, name: string) => {
  const m = tag.match(new RegExp(`\\s${name.replace(":", "\\:")}="([^"]*)"`));
  return m ? unesc(m[1]) : undefined;
};

function parseRels(xml: string | undefined): Rel[] {
  if (!xml) return [];
  return [...xml.matchAll(/<Relationship\b[^>]*\/?>/g)].map((m) => ({
    id: attr(m[0], "Id") || "",
    type: attr(m[0], "Type") || "",
    target: attr(m[0], "Target") || "",
    mode: attr(m[0], "TargetMode"),
  }));
}

function relsXml(rels: Rel[]): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    rels
      .map((r) => `<Relationship Id="${esc(r.id)}" Type="${esc(r.type)}" Target="${esc(r.target)}"${r.mode ? ` TargetMode="${esc(r.mode)}"` : ""}/>`)
      .join("") +
    "</Relationships>"
  );
}

/** "xl/worksheets/sheet1.xml" + "../drawings/drawing1.xml" → "xl/drawings/drawing1.xml" */
function resolvePart(fromPart: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = fromPart.split("/").slice(0, -1);
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

function relsPathOf(part: string): string {
  const i = part.lastIndexOf("/");
  return `${part.slice(0, i)}/_rels/${part.slice(i + 1)}.rels`;
}

function relativeTarget(fromPart: string, toPart: string): string {
  const from = fromPart.split("/").slice(0, -1);
  const to = toPart.split("/");
  let i = 0;
  while (i < from.length && from[i] === to[i]) i++;
  return [...Array(from.length - i).fill(".."), ...to.slice(i)].join("/");
}

class Pkg {
  constructor(public zip: JSZip) {}
  static async open(buf: Buffer | Uint8Array) {
    return new Pkg(await JSZip.loadAsync(buf));
  }
  async read(path: string): Promise<string | undefined> {
    const f = this.zip.file(path);
    return f ? f.async("string") : undefined;
  }
  write(path: string, content: string) {
    this.zip.file(path, content);
  }
  nextName(dir: string, base: string, ext: string): string {
    let n = 1;
    const taken = new Set(Object.keys(this.zip.files));
    while (taken.has(`${dir}/${base}${n}.${ext}`)) n++;
    return `${dir}/${base}${n}.${ext}`;
  }
  async rels(part: string) {
    return parseRels(await this.read(relsPathOf(part)));
  }
  async addRel(part: string, type: string, target: string): Promise<string> {
    const rels = await this.rels(part);
    let n = rels.length + 1;
    while (rels.some((r) => r.id === `rId${n}`)) n++;
    const id = `rId${n}`;
    rels.push({ id, type, target });
    this.write(relsPathOf(part), relsXml(rels));
    return id;
  }
  async addContentType(part: string, contentType: string) {
    const path = "[Content_Types].xml";
    let xml = (await this.read(path)) || "";
    if (xml.includes(`PartName="/${part}"`)) return;
    xml = xml.replace("</Types>", `<Override PartName="/${part}" ContentType="${contentType}"/></Types>`);
    this.write(path, xml);
  }
  /** Sheet name → worksheet part path. */
  async sheetParts(): Promise<Map<string, string>> {
    const wb = (await this.read("xl/workbook.xml")) || "";
    const rels = await this.rels("xl/workbook.xml");
    const out = new Map<string, string>();
    for (const m of wb.matchAll(/<sheet\b[^>]*\/?>/g)) {
      const name = attr(m[0], "name");
      const rid = attr(m[0], "r:id");
      const rel = rels.find((r) => r.id === rid);
      if (name && rel) out.set(name, resolvePart("xl/workbook.xml", rel.target));
    }
    return out;
  }
  async generate(): Promise<Buffer> {
    return Buffer.from(await this.zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  }
}

/** Elements that must follow <drawing> inside <worksheet> (schema order). */
const AFTER_DRAWING = ["legacyDrawing", "legacyDrawingHF", "drawingHF", "picture", "oleObjects", "controls", "webPublishItems", "tableParts", "extLst"];

/** The sheet's drawing part, created (and linked from the sheet) if it has none. */
async function ensureSheetDrawing(pkg: Pkg, sheetPart: string): Promise<string> {
  let sheet = (await pkg.read(sheetPart)) || "";
  const existing = sheet.match(/<drawing\b[^>]*r:id="([^"]+)"/);
  if (existing) {
    const rel = (await pkg.rels(sheetPart)).find((r) => r.id === existing[1]);
    if (rel) return resolvePart(sheetPart, rel.target);
  }
  const drawingPart = pkg.nextName("xl/drawings", "drawing", "xml");
  pkg.write(
    drawingPart,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="${NS.xdr}" xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:c="${NS.c}"></xdr:wsDr>`
  );
  await pkg.addContentType(drawingPart, CT.drawing);
  const rid = await pkg.addRel(sheetPart, NS.drawingRel, relativeTarget(sheetPart, drawingPart));
  if (!/<worksheet\b[^>]*xmlns:r=/.test(sheet)) sheet = sheet.replace(/<worksheet\b/, `<worksheet xmlns:r="${NS.r}"`);
  const tag = `<drawing r:id="${rid}"/>`;
  const after = AFTER_DRAWING.map((n) => sheet.search(new RegExp(`<${n}[\\s>/]`))).filter((i) => i >= 0);
  const at = after.length ? Math.min(...after) : sheet.lastIndexOf("</worksheet>");
  sheet = sheet.slice(0, at) + tag + sheet.slice(at);
  pkg.write(sheetPart, sheet);
  return drawingPart;
}

let frameId = 9000;

/** Append a chart anchor (whose <c:chart r:id> is rewritten) and the chart part to a drawing. */
async function attachChart(
  pkg: Pkg,
  drawingPart: string,
  anchorXml: string,
  chartXml: string,
  extraNamespaces: Record<string, string> = {},
  styleParts: { type: string; content: string }[] = []
) {
  const chartPart = pkg.nextName("xl/charts", "chart", "xml");
  const num = chartPart.match(/chart(\d+)\.xml$/)![1];
  for (const sp of styleParts) {
    const isStyle = sp.type === NS.chartStyleRel;
    const part = pkg.nextName("xl/charts", isStyle ? "style" : "colors", "xml");
    pkg.write(part, sp.content);
    await pkg.addContentType(part, isStyle ? CT.chartStyle : CT.chartColors);
    await pkg.addRel(chartPart, sp.type, relativeTarget(chartPart, part));
  }
  pkg.write(chartPart, chartXml);
  await pkg.addContentType(chartPart, CT.chart);
  const rid = await pkg.addRel(drawingPart, NS.chartRel, relativeTarget(drawingPart, chartPart));

  let drawing = (await pkg.read(drawingPart)) || "";
  const rootMatch = drawing.match(/<xdr:wsDr\b[^>]*>/);
  if (!rootMatch) throw new Error(`Unexpected drawing part ${drawingPart}`);
  let root = rootMatch[0];
  const needed: Record<string, string> = { xdr: NS.xdr, a: NS.a, r: NS.r, c: NS.c, ...extraNamespaces };
  for (const [pfx, uri] of Object.entries(needed)) {
    if (!new RegExp(`xmlns:${pfx}=`).test(root)) root = root.replace(/>$/, ` xmlns:${pfx}="${uri}">`);
  }
  const anchor = anchorXml
    .replace(/(<c:chart\b[^>]*\br:id=")[^"]*(")/, `$1${rid}$2`)
    .replace(/(<xdr:cNvPr\b[^>]*\bid=")\d+(")/, `$1${++frameId}$2`)
    .replace(/(<xdr:cNvPr\b[^>]*\bname=")([^"]*)(")/, `$1$2 ${num}$3`);
  drawing = drawing.replace(rootMatch[0], root);
  drawing = drawing.includes("</xdr:wsDr>")
    ? drawing.replace("</xdr:wsDr>", `${anchor}</xdr:wsDr>`)
    : drawing.replace(/<xdr:wsDr\b([^>]*)\/>/, `<xdr:wsDr$1>${anchor}</xdr:wsDr>`);
  pkg.write(drawingPart, drawing);
  return chartPart;
}

/** Tell Excel to recalculate every formula (and chart) when the file is opened. */
async function setFullCalcOnLoad(pkg: Pkg) {
  let wb = (await pkg.read("xl/workbook.xml")) || "";
  if (/<calcPr\b/.test(wb)) {
    wb = wb.replace(/<calcPr\b([^>]*?)(\/?)>/, (_m, attrs: string, slash: string) => {
      const a = attrs.replace(/\sfullCalcOnLoad="[^"]*"/, "");
      return `<calcPr${a} fullCalcOnLoad="1"${slash}>`;
    });
  } else {
    const later = ["oleSize", "customWorkbookViews", "pivotCaches", "smartTagPr", "smartTagTypes", "webPublishing", "fileRecoveryPr", "webPublishObjects", "extLst"]
      .map((n) => wb.search(new RegExp(`<${n}[\\s>/]`)))
      .filter((i) => i >= 0);
    const at = later.length ? Math.min(...later) : wb.lastIndexOf("</workbook>");
    wb = wb.slice(0, at) + '<calcPr fullCalcOnLoad="1"/>' + wb.slice(at);
  }
  pkg.write("xl/workbook.xml", wb);
}

/**
 * Drop cached results of formula cells. A template's formulas still carry the template's sample results;
 * viewers that do not recalculate (previews, LibreOffice by default) would show those instead of the filled
 * inputs. Without a cached value every viewer computes the formula.
 */
async function stripFormulaResults(pkg: Pkg) {
  for (const part of (await pkg.sheetParts()).values()) {
    const xml = await pkg.read(part);
    if (!xml || !xml.includes("<f")) continue;
    const next = xml.replace(/<c\b([^>]*)>(<f\b[^>]*\/>|<f\b[^>]*>[\s\S]*?<\/f>)<v>[\s\S]*?<\/v>/g, (_m, attrs: string, f: string) => {
      // t="str"/"e"/"b" described the cached result; leave the type off so the computed value decides it.
      return `<c${attrs.replace(/\st="(?:str|e|b)"/, "")}>${f}`;
    });
    if (next !== xml) pkg.write(part, next);
  }
}

/** Values of a 1-D range like 'Sheet A'!$B$3:$B$9 from the output workbook (formula results where cached). */
function rangeValues(book: WorkBook, ref: string, skipFormulas = false): (string | number | null)[] | null {
  const m = ref.trim().match(/^(?:'((?:[^']|'')+)'|([^!]+))!\$?([A-Z]+)\$?(\d+)(?::\$?([A-Z]+)\$?(\d+))?$/);
  if (!m) return null;
  const sheetName = (m[1] ?? m[2]).replace(/''/g, "'");
  const ws = book.Sheets[sheetName];
  if (!ws) return null;
  const s = XLSX.utils.decode_cell(`${m[3]}${m[4]}`);
  const e = m[5] ? XLSX.utils.decode_cell(`${m[5]}${m[6]}`) : s;
  const out: (string | number | null)[] = [];
  for (let r = s.r; r <= e.r; r++) {
    for (let c = s.c; c <= e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      const v = skipFormulas && cell?.f ? null : cell?.v;
      out.push(v == null || v === "" ? null : typeof v === "number" ? v : v instanceof Date ? v.getTime() : String(v));
    }
  }
  return out;
}

/** Rewrite each <c:numRef>/<c:strRef> cache from the output workbook's cells. */
function refreshChartCaches(chartXml: string, book: WorkBook, skipFormulas = false): string {
  return chartXml.replace(
    /<c:(num|str)Ref>\s*<c:f>([^<]*)<\/c:f>\s*(?:<c:(?:num|str)Cache>[\s\S]*?<\/c:(?:num|str)Cache>)?/g,
    (whole, kind: string, f: string) => {
      const vals = rangeValues(book, unesc(f), skipFormulas);
      if (!vals) return whole;
      const fmt = whole.match(/<c:formatCode>([^<]*)<\/c:formatCode>/)?.[1] ?? "General";
      const pts = vals
        .map((v, i) => {
          if (v == null) return "";
          if (kind === "num") {
            const n = typeof v === "number" ? v : Number(v);
            return Number.isFinite(n) ? `<c:pt idx="${i}"><c:v>${n}</c:v></c:pt>` : "";
          }
          return `<c:pt idx="${i}"><c:v>${esc(String(v))}</c:v></c:pt>`;
        })
        .join("");
      const cache =
        kind === "num"
          ? `<c:numCache><c:formatCode>${fmt}</c:formatCode><c:ptCount val="${vals.length}"/>${pts}</c:numCache>`
          : `<c:strCache><c:ptCount val="${vals.length}"/>${pts}</c:strCache>`;
      return `<c:${kind}Ref><c:f>${f}</c:f>${cache}`;
    }
  );
}

const ANCHOR_RE = /<mc:AlternateContent\b[\s\S]*?<\/mc:AlternateContent>|<xdr:(twoCellAnchor|oneCellAnchor|absoluteAnchor)\b[\s\S]*?<\/xdr:\1>/g;

/**
 * Copy every chart of the template onto the same-named sheets of the generated workbook.
 * Sheets missing from the output are skipped. Returns the output unchanged if the template has no charts.
 */
export async function restoreTemplateCharts(
  template: Buffer | Uint8Array,
  out: Buffer | Uint8Array,
  opts: { recalc?: boolean; blanksAsGap?: boolean } = {}
): Promise<Buffer> {
  const tpl = await Pkg.open(template);
  const pkg = await Pkg.open(out);
  const recalc = opts.recalc ?? true;
  const book = XLSX.read(out, { type: "buffer", cellFormula: true });
  const tplSheets = await tpl.sheetParts();
  const outSheets = await pkg.sheetParts();
  let added = 0;

  for (const [name, tplSheetPart] of tplSheets) {
    const outSheetPart = outSheets.get(name);
    if (!outSheetPart) continue;
    const tplSheetXml = (await tpl.read(tplSheetPart)) || "";
    const drawingRid = tplSheetXml.match(/<drawing\b[^>]*r:id="([^"]+)"/)?.[1];
    if (!drawingRid) continue;
    const dRel = (await tpl.rels(tplSheetPart)).find((r) => r.id === drawingRid);
    if (!dRel) continue;
    const tplDrawingPart = resolvePart(tplSheetPart, dRel.target);
    const tplDrawing = (await tpl.read(tplDrawingPart)) || "";
    const tplDrawingRels = await tpl.rels(tplDrawingPart);
    const rootNs: Record<string, string> = {};
    for (const m of (tplDrawing.match(/<xdr:wsDr\b[^>]*>/)?.[0] || "").matchAll(/xmlns:(\w+)="([^"]+)"/g)) rootNs[m[1]] = m[2];

    for (const am of tplDrawing.matchAll(ANCHOR_RE)) {
      const anchor = am[0];
      if (!/<c:chart\b/.test(anchor) || /<cx:chart\b/.test(anchor)) continue; // classic charts only
      const chartRid = anchor.match(/<c:chart\b[^>]*\br:id="([^"]+)"/)?.[1];
      const cRel = tplDrawingRels.find((r) => r.id === chartRid);
      if (!cRel) continue;
      const tplChartPart = resolvePart(tplDrawingPart, cRel.target);
      let chartXml = (await tpl.read(tplChartPart)) || "";
      if (!chartXml) continue;
      const styleParts: { type: string; content: string }[] = [];
      for (const r of await tpl.rels(tplChartPart)) {
        if (r.type === NS.chartStyleRel || r.type === NS.chartColorRel) {
          const content = await tpl.read(resolvePart(tplChartPart, r.target));
          if (content) styleParts.push({ type: r.type, content });
        }
      }
      // Embedded workbook / user shapes / external data are not carried over.
      chartXml = chartXml
        .replace(/<c:externalData\b[\s\S]*?(?:\/>|<\/c:externalData>)/g, "")
        .replace(/<c:userShapes\b[^>]*\/>/g, "");
      chartXml = refreshChartCaches(chartXml, book, recalc);
      if (opts.blanksAsGap) chartXml = chartXml.replace(/<c:dispBlanksAs val="zero"\/>/, '<c:dispBlanksAs val="gap"/>');
      const drawingPart = await ensureSheetDrawing(pkg, outSheetPart);
      await attachChart(pkg, drawingPart, anchor, chartXml, rootNs, styleParts);
      added++;
    }
  }
  if (!added && !recalc) return Buffer.from(out);
  if (recalc) await stripFormulaResults(pkg);
  await setFullCalcOnLoad(pkg);
  return pkg.generate();
}

/* ─────────────────────────────── generated charts ─────────────────────────────── */

export type ChartSeriesSpec = {
  /** Series name shown in the legend. */
  name: string;
  /** 1-D range of values, e.g. "B5:B20" on the chart's data sheet. */
  values: string;
  color?: string;
};

export type ChartSpec = {
  /** Sheet the chart is drawn on. */
  sheet: string;
  /** Sheet the ranges point at (defaults to `sheet`). */
  dataSheet?: string;
  type: "bar" | "column" | "line" | "pie";
  title: string;
  /** 1-D range of category labels, e.g. "A5:A20". */
  categories: string;
  series: ChartSeriesSpec[];
  /** Anchor: top-left cell (0-based col/row) and size in columns/rows. */
  at: { col: number; row: number; cols?: number; rows?: number };
  /** Number format for values, e.g. "0%" or "#,##0". */
  numFmt?: string;
  stacked?: boolean;
};

/** SPDC palette — navy, orange, teal, steel, gold, plum. */
export const SPDC_CHART_COLORS = ["1E3A5F", "E97132", "0F766E", "64748B", "C9A227", "7C3AED", "2563EB", "B91C1C"];

const quoteSheet = (s: string) => `'${s.replace(/'/g, "''")}'`;
const absRange = (sheet: string, r: string) => {
  const [a, b] = r.split(":");
  const abs = (x: string) => x.replace(/^([A-Z]+)(\d+)$/, "$$$1$$$2");
  return `${quoteSheet(sheet)}!${abs(a)}${b ? `:${abs(b)}` : ""}`;
};

function chartXmlFor(spec: ChartSpec): string {
  const data = spec.dataSheet || spec.sheet;
  const cat = absRange(data, spec.categories);
  const fmt = esc(spec.numFmt || "General");
  const seriesXml = spec.series
    .map((s, i) => {
      const color = s.color || SPDC_CHART_COLORS[i % SPDC_CHART_COLORS.length];
      const fill =
        spec.type === "line"
          ? `<c:spPr><a:ln w="28575" cap="rnd"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:round/></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></c:spPr></c:marker>`
          : spec.type === "pie"
            ? ""
            : `<c:spPr><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></c:spPr><c:invertIfNegative val="0"/>`;
      const pieColors =
        spec.type === "pie"
          ? Array.from({ length: 24 }, (_, k) => `<c:dPt><c:idx val="${k}"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="${SPDC_CHART_COLORS[k % SPDC_CHART_COLORS.length]}"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr></c:dPt>`).join("")
          : "";
      const labels =
        spec.type === "pie"
          ? `<c:dLbls><c:numFmt formatCode="0%" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr><c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="1"/><c:showBubbleSize val="0"/></c:dLbls>`
          : "";
      return (
        `<c:ser><c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:v>${esc(s.name)}</c:v></c:tx>${fill}${pieColors}${labels}` +
        `<c:cat><c:strRef><c:f>${esc(cat)}</c:f></c:strRef></c:cat>` +
        `<c:val><c:numRef><c:f>${esc(absRange(data, s.values))}</c:f><c:numCache><c:formatCode>${fmt}</c:formatCode><c:ptCount val="0"/></c:numCache></c:numRef></c:val>` +
        (spec.type === "line" ? `<c:smooth val="0"/>` : "") +
        `</c:ser>`
      );
    })
    .join("");
  const axisText = `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="800"><a:solidFill><a:srgbClr val="5C6578"/></a:solidFill></a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr>`;
  const axes =
    spec.type === "pie"
      ? ""
      : `<c:axId val="5001"/><c:axId val="5002"/></c:${spec.type === "line" ? "lineChart" : "barChart"}>` +
        `<c:catAx><c:axId val="5001"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${spec.type === "bar" ? "l" : "b"}"/><c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:solidFill><a:srgbClr val="D6DEE8"/></a:solidFill></a:ln></c:spPr>${axisText}<c:crossAx val="5002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>` +
        `<c:valAx><c:axId val="5002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${spec.type === "bar" ? "b" : "l"}"/><c:majorGridlines><c:spPr><a:ln><a:solidFill><a:srgbClr val="EEF2F7"/></a:solidFill></a:ln></c:spPr></c:majorGridlines><c:numFmt formatCode="${fmt}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr>${axisText}<c:crossAx val="5001"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`;
  const plot =
    spec.type === "pie"
      ? `<c:pieChart><c:varyColors val="1"/>${seriesXml}<c:firstSliceAng val="0"/></c:pieChart>`
      : spec.type === "line"
        ? `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${seriesXml}<c:marker val="1"/>${axes}`
        : `<c:barChart><c:barDir val="${spec.type === "bar" ? "bar" : "col"}"/><c:grouping val="${spec.stacked ? "stacked" : "clustered"}"/><c:varyColors val="0"/>${seriesXml}<c:gapWidth val="80"/>${spec.stacked ? '<c:overlap val="100"/>' : '<c:overlap val="-10"/>'}${axes}`;
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<c:chartSpace xmlns:c="${NS.c}" xmlns:a="${NS.a}" xmlns:r="${NS.r}"><c:roundedCorners val="0"/>` +
    `<c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1100" b="1"><a:solidFill><a:srgbClr val="1E3A5F"/></a:solidFill></a:defRPr></a:pPr><a:r><a:rPr lang="en-US" sz="1100" b="1"><a:solidFill><a:srgbClr val="1E3A5F"/></a:solidFill></a:rPr><a:t>${esc(spec.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>` +
    `<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${plot}<c:spPr><a:noFill/></c:spPr></c:plotArea>` +
    `<c:legend><c:legendPos val="b"/><c:overlay val="0"/>${axisText}</c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>` +
    `<c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="D6DEE8"/></a:solidFill></a:ln></c:spPr>` +
    `</c:chartSpace>`
  );
}

function anchorXmlFor(spec: ChartSpec): string {
  const { col, row } = spec.at;
  const cols = spec.at.cols ?? 8;
  const rows = spec.at.rows ?? 16;
  return (
    `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
    `<xdr:to><xdr:col>${col + cols}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row + rows}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>` +
    `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="1" name="${esc(spec.title)}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>` +
    `<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${NS.c}"><c:chart xmlns:c="${NS.c}" xmlns:r="${NS.r}" r:id="rId0"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`
  );
}

/** Add native Excel charts (bar / column / line / pie) to sheets of a generated workbook. */
export async function addCharts(out: Buffer | Uint8Array, specs: ChartSpec[]): Promise<Buffer> {
  if (!specs.length) return Buffer.from(out);
  const pkg = await Pkg.open(out);
  const book = XLSX.read(out, { type: "buffer", cellFormula: false });
  const sheets = await pkg.sheetParts();
  let added = 0;
  for (const spec of specs) {
    const sheetPart = sheets.get(spec.sheet);
    if (!sheetPart || !spec.series.length) continue;
    const drawingPart = await ensureSheetDrawing(pkg, sheetPart);
    await attachChart(pkg, drawingPart, anchorXmlFor(spec), refreshChartCaches(chartXmlFor(spec), book));
    added++;
  }
  if (!added) return Buffer.from(out);
  await setFullCalcOnLoad(pkg);
  return pkg.generate();
}
