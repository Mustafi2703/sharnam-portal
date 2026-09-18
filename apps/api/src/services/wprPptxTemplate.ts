/**
 * WPR PPTX — fill the client reference deck (SPDC_WPR_CLIENT_REFERENCE / WPR_50)
 * instead of rebuilding slides with pptxgenjs.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { WprHeader, WprPackInput, WprSection } from "./wprXlsx.js";

const require = createRequire(import.meta.url);
const { default: Automizer, ModifyTextHelper, modify } = require("pptx-automizer") as {
  default: new (params: Record<string, unknown>) => AutomizerChain;
  ModifyTextHelper: { setMultiText: (paragraphs: unknown[]) => unknown };
  modify: {
    setText: (text: string) => unknown;
    setTable: (data: { body: { label: string; values: (string | number)[] }[] }) => unknown;
  };
};
type AutomizerZip = {
  file: {
    (pattern: RegExp): Array<{ name: string; async: (type: string) => Promise<string> }> | null;
    (name: string, content: string): AutomizerZip;
  };
  generateAsync: (opts: { type: string; compression: string }) => Promise<Buffer>;
};

type AutomizerChain = {
  loadRoot: (name: string) => AutomizerChain;
  load: (name: string, label: string) => AutomizerChain;
  addSlide: (label: string, slideNum: number, cb: (slide: AutomizerSlide) => void) => AutomizerChain;
  getJSZip: () => Promise<AutomizerZip>;
};

type AutomizerSlide = {
  modifyElement: (name: string, mods: unknown[]) => void;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_FILENAME = "SPDC_WPR_CLIENT_REFERENCE.pptx";
const SLIDE_COUNT = 61;

/** Primary data slides — table fill when a native PowerPoint table is present. */
const TABLE_SLIDES: Record<number, keyof WprPackInput["sections"]> = {
  9: "communicationMatrix",
  12: "capex",
  13: "prTracker",
  14: "hindrance",
  15: "risk",
  16: "legal",
  19: "designStatus",
  20: "procurement",
  50: "cubeTest",
  52: "safety",
  58: "materialStock",
};

export function resolveWprPptxTemplate(): string | null {
  const candidates = [
    process.env.WPR_PPTX_TEMPLATE,
    path.resolve(process.cwd(), "templates", TEMPLATE_FILENAME),
    path.resolve(__dirname, "../../../templates", TEMPLATE_FILENAME),
    path.resolve(process.cwd(), "module_prompts/Sharnam_modules_docs 2/SPDC_Arvind Limited_WPR_50.pptx"),
  ].filter(Boolean) as string[];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* try next */
    }
  }
  return null;
}

function fmtWeekPart(d: string | undefined): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d.slice(0, 10);
  const day = dt.getDate();
  const suffix =
    day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th";
  const month = dt.toLocaleDateString("en-IN", { month: "long" });
  const year = dt.getFullYear();
  return `${String(day).padStart(2, "0")}${suffix} ${month} , ${year}`;
}

function weekRangeLabel(header: WprHeader): string {
  const start = fmtWeekPart(header.weekStart);
  const end = fmtWeekPart(header.weekEnd);
  if (start === "—" && end === "—") return "(Week ending —)";
  return `(${start} to ${end})`;
}

function sectionTableBody(sec: WprSection | undefined): { label: string; values: (string | number)[] }[] {
  if (!sec?.rows?.length) return [];
  const headers = sec.headers?.length ? sec.headers : ["Item", "Detail"];
  const width = Math.max(headers.length, ...sec.rows.map((r) => r.length));
  const body: { label: string; values: (string | number)[] }[] = [];
  body.push({
    label: "header",
    values: headers.concat(Array(Math.max(0, width - headers.length)).fill("")),
  });
  for (let i = 0; i < sec.rows.length; i++) {
    const row = sec.rows[i] || [];
    const values = row.map((c) => (c == null ? "" : c));
    while (values.length < width) values.push("");
    body.push({ label: `r${i}`, values: values.slice(0, width) });
  }
  return body.slice(0, 28);
}

function tryFillTable(slide: AutomizerSlide, sec: WprSection | undefined, shapeName = "Table 1") {
  const body = sectionTableBody(sec);
  if (body.length < 2) return;
  slide.modifyElement(shapeName, [modify.setTable({ body })]);
}

/** Replace demo client name across slide XML (keeps layout; only when demo name present). */
function patchClientNameInArchive(xml: string, clientName: string, demoClient = "Arvind Limited"): string {
  if (!clientName || clientName === demoClient) return xml;
  return xml.split(demoClient).join(clientName);
}

export async function buildWprPptxFromTemplate(pack: WprPackInput): Promise<Buffer> {
  const templatePath = resolveWprPptxTemplate();
  if (!templatePath) {
    throw new Error("WPR PPTX template not found — set WPR_PPTX_TEMPLATE or add templates/SPDC_WPR_CLIENT_REFERENCE.pptx");
  }

  const templateDir = path.dirname(templatePath);
  const templateFile = path.basename(templatePath);
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "sharnam-wpr-pptx-"));

  const client = pack.header.clientName || pack.header.projectName || "Project";
  const reportNo = String(pack.header.reportNumber ?? "—");
  const weekRange = weekRangeLabel(pack.header);

  const automizer = new Automizer({
    templateDir,
    outputDir,
    removeExistingSlides: true,
    compression: 6,
    continueOnError: true,
  });

  const pres = automizer.loadRoot(templateFile).load(templateFile, "wpr");

  for (let slideNum = 1; slideNum <= SLIDE_COUNT; slideNum++) {
    const sectionKey = TABLE_SLIDES[slideNum];
    pres.addSlide("wpr", slideNum, (slide) => {
      if (slideNum === 1) {
        slide.modifyElement("Text Placeholder 3", [modify.setText(client)]);
        slide.modifyElement("object 4", [
          ModifyTextHelper.setMultiText([
            {
              paragraph: {},
              textRuns: [
                { text: "REPORT NO. ", style: { isBold: true } },
                { text: reportNo, style: { isBold: true } },
              ],
            },
            {
              paragraph: {},
              textRuns: [{ text: weekRange, style: { isBold: true } }],
            },
          ]),
        ]);
      }
      if (sectionKey) {
        tryFillTable(slide, pack.sections[sectionKey], "Table 1");
      }
    });
  }

  const zip = await pres.getJSZip();
  const slideFiles = zip.file(/ppt\/slides\/slide\d+\.xml$/) || [];
  for (const entry of slideFiles) {
    const xml = await entry.async("string");
    const patched = patchClientNameInArchive(xml, client);
    if (patched !== xml) zip.file(entry.name, patched);
  }

  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  try {
    fs.rmSync(outputDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  return Buffer.from(buf);
}

export function wprTemplateAvailable(): boolean {
  return !!resolveWprPptxTemplate();
}
