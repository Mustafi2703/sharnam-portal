/**
 * Communication matrix logo smoke test — no database needed.
 *
 *   npx tsx scripts/matrix-logo-smoke.mts
 *
 * Builds TECHNICAL + COMMERCIAL Excel, HTML and PDF from in-memory bundles with a PNG client logo, a JPEG client logo
 * and no client logo, then checks: two images in xl/media, anchors in column 0 (Sharnam) and column 8 (client) with the
 * aspect ratio kept, two <img in the HTML header, and a PDF with the logos embedded.
 * Output: /tmp/matrix-logo-smoke/ (macOS `sips` makes the JPEG fixture and renders the first PDF page).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import JSZip from "jszip";
import { imagePixelSize, sniffLogoExt } from "../apps/api/src/services/clientLogo.ts";
import {
  matrixLogoFromBuffer,
  renderMatrixHtml,
  renderMatrixPdf,
  renderMatrixXlsx,
  type MatrixBundle,
  type MatrixLogos,
  type MatrixRow,
} from "../apps/api/src/services/matrixExport.ts";
import { sharnamLogoPath } from "../apps/api/src/services/brandedExport.ts";

const sharnamFile = sharnamLogoPath();
if (!sharnamFile) throw new Error("Sharnam logo file not found");
const sharnamLogo = matrixLogoFromBuffer(fs.readFileSync(sharnamFile));
const loadMatrixLogosFromBuffers = (client: Buffer | null): MatrixLogos => ({ sharnam: sharnamLogo, client: matrixLogoFromBuffer(client) });

const OUT = "/tmp/matrix-logo-smoke";
fs.mkdirSync(OUT, { recursive: true });

function crc32(buf: Buffer) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

/** Solid-band RGB PNG, so the fixture is a real decodable image. */
function makePng(width: number, height: number, rgb: [number, number, number], band: [number, number, number]) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const px = y > height * 0.35 && y < height * 0.65 ? band : rgb;
      raw.set(px, y * (width * 3 + 1) + 1 + x * 3);
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const wideLogoPng = makePng(480, 160, [20, 90, 170], [240, 180, 20]);
const squarePngFile = path.join(OUT, "fixture-square.png");
const jpegFile = path.join(OUT, "fixture-square.jpg");
fs.writeFileSync(squarePngFile, makePng(300, 300, [160, 30, 40], [255, 255, 255]));
execFileSync("sips", ["-s", "format", "jpeg", squarePngFile, "--out", jpegFile], { stdio: "ignore" });
const squareLogoJpeg = fs.readFileSync(jpegFile);

function rows(kind: string, people: number): MatrixRow[] {
  const out: MatrixRow[] = [];
  const orgs = ["VOLTAMP TRANSFORMERS LIMITED", "SHARNAM PROJECT DEVELOPMENT CONSULTANTS & CO.", "DESIGN CONSULTANT", "MAIN CONTRACTOR"];
  let n = 0;
  for (const org of orgs) {
    out.push({ id: `s-${org}`, isSectionHeader: true, orgName: org });
    for (let i = 0; i < people; i++) {
      n += 1;
      out.push({
        id: `p-${n}`,
        personName: `Mr. Person ${n}`,
        designation: kind === "TECHNICAL" ? "Project Engineer" : "Purchase Head",
        company: org,
        spoc: `Mr. Person ${n}`,
        mobile: "98250 00000",
        email: `person${n}@example.com`,
        mailRole: i === 0 ? "TO" : "CC",
        officeAddress: "Makarpura Road,\nVadodara 390 014, Gujarat",
      });
    }
  }
  return out;
}

const project = {
  id: "smoke",
  name: "Construction of Transformer Plant Expansion",
  clientName: "Voltamp Transformers Limited",
  designConsultant: "Shah & Talati",
  pmcName: null,
};

type Case = { label: string; client: Buffer | null };
const cases: Case[] = [
  { label: "png", client: wideLogoPng },
  { label: "jpeg", client: squareLogoJpeg },
  { label: "none", client: null },
];

let failures = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) failures += 1;
};

check(sniffLogoExt(wideLogoPng) === "png" && sniffLogoExt(squareLogoJpeg) === "jpeg", "sniffLogoExt reads PNG and JPEG bytes");
const jpegSize = imagePixelSize(squareLogoJpeg);
check(jpegSize?.width === 300 && jpegSize?.height === 300, `JPEG pixel size from SOF marker = ${JSON.stringify(jpegSize)}`);
check(sniffLogoExt(Buffer.from("RIFF0000WEBPVP8 ")) === null, "WebP bytes are rejected");

const at = new Date("2026-10-20T10:00:00+05:30");

async function xlsxChecks(file: string, buf: Buffer, logos: MatrixLogos, sheets: number) {
  const zip = await JSZip.loadAsync(buf);
  const media = Object.keys(zip.files).filter((f) => f.startsWith("xl/media/") && !zip.files[f].dir);
  const expectImages = logos.client ? 2 : 1;
  check(media.length === expectImages, `${file}: xl/media holds ${media.length} image(s) [${media.join(", ")}]`);
  for (let s = 1; s <= sheets; s++) {
    const rels = await zip.file(`xl/drawings/_rels/drawing${s}.xml.rels`)?.async("string");
    const targets = [...(rels || "").matchAll(/Target="([^"]+)"/g)].map((m) => m[1]);
    check(targets.length === expectImages, `${file}: drawing${s} links ${targets.join(", ")}`);
    const xml = await zip.file(`xl/drawings/drawing${s}.xml`)?.async("string");
    if (!xml) {
      check(false, `${file}: xl/drawings/drawing${s}.xml missing`);
      continue;
    }
    const anchors = [...xml.matchAll(/<xdr:oneCellAnchor[^>]*>[\s\S]*?<xdr:col>(\d+)<\/xdr:col><xdr:colOff>(\d+)<\/xdr:colOff><xdr:row>(\d+)<\/xdr:row><xdr:rowOff>(\d+)<\/xdr:rowOff>[\s\S]*?<xdr:ext cx="(\d+)" cy="(\d+)"/g)].map(
      (m) => ({ col: +m[1], colOffPx: Math.round(+m[2] / 9525), row: +m[3], rowOffPx: Math.round(+m[4] / 9525), w: Math.round(+m[5] / 9525), h: Math.round(+m[6] / 9525) }),
    );
    console.log(`      drawing${s} anchors: ${JSON.stringify(anchors)}`);
    const cols = anchors.map((a) => a.col).sort((a, b) => a - b);
    check(JSON.stringify(cols) === JSON.stringify(logos.client ? [0, 8] : [0]), `${file}: drawing${s} anchors in columns ${cols.join(", ")}`);
    const srcs = [logos.sharnam, logos.client].filter(Boolean);
    anchors
      .sort((a, b) => a.col - b.col)
      .forEach((a, i) => {
        const src = srcs[i]!;
        const want = src.width / src.height;
        const got = a.w / a.h;
        check(Math.abs(got - want) / want < 0.03, `${file}: drawing${s} image ${i + 1} aspect ${got.toFixed(2)} vs source ${want.toFixed(2)}`);
      });
  }
}

for (const c of cases) {
  const logos = loadMatrixLogosFromBuffers(c.client);
  const bundles: MatrixBundle[] = ["TECHNICAL", "COMMERCIAL"].map((kind) => ({ project, rows: rows(kind, kind === "TECHNICAL" ? 12 : 3), matrixKind: kind }));
  for (const bundle of bundles) {
    const base = `${c.label}-${bundle.matrixKind.toLowerCase()}`;
    const xlsx = await renderMatrixXlsx([bundle], logos, at);
    fs.writeFileSync(path.join(OUT, `${base}.xlsx`), xlsx);
    await xlsxChecks(`${base}.xlsx`, xlsx, logos, 1);

    const html = renderMatrixHtml(bundle, logos, at);
    fs.writeFileSync(path.join(OUT, `${base}.html`), html);
    const head = html.slice(html.indexOf('<div class="head">'), html.indexOf("<table>"));
    const imgs = [...head.matchAll(/<img src="(data:image\/(png|jpeg);base64,[^"]+)"/g)];
    check(imgs.length === (c.client ? 2 : 1), `${base}.html: ${imgs.length} <img in header (data:image/${imgs.map((m) => m[2]).join(", ")})`);
    const sharnamFirst = head.indexOf('class="logo brand"') < head.indexOf('class="banner"') && head.indexOf('class="banner"') < head.indexOf('class="logo client"');
    check(sharnamFirst, `${base}.html: Sharnam left, banner middle, client right`);
    if (!c.client) check(head.includes(project.clientName), `${base}.html: client name shown when there is no logo`);
    else check(!head.includes(`fallback">${project.clientName}`), `${base}.html: no client-name text beside the client logo`);

    const pdf = await renderMatrixPdf(bundle, logos, at);
    fs.writeFileSync(path.join(OUT, `${base}.pdf`), pdf);
    const text = pdf.toString("latin1");
    const pages = (text.match(/\/Type \/Page\b/g) || []).length;
    const images = (text.match(/\/Subtype \/Image/g) || []).length;
    check(text.startsWith("%PDF") && images >= (c.client ? 2 : 1), `${base}.pdf: ${pages} page(s), ${images} image XObject(s), ${pdf.length} bytes`);
  }
  const both = await renderMatrixXlsx(bundles, logos, at);
  fs.writeFileSync(path.join(OUT, `${c.label}-both.xlsx`), both);
  await xlsxChecks(`${c.label}-both.xlsx`, both, logos, 2);
}

for (const name of ["png-technical", "jpeg-commercial"]) {
  try {
    execFileSync("sips", ["-s", "format", "png", path.join(OUT, `${name}.pdf`), "--out", path.join(OUT, `${name}-page1.png`)], { stdio: "ignore" });
    console.log(`      rendered ${OUT}/${name}-page1.png`);
  } catch {
    console.log(`      could not render ${name}.pdf (sips)`);
  }
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
