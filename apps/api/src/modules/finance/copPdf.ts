/**
 * Certificate of Payment — Sharnam-branded A4 PDF in the client's COP format (Viatrix "Certificate of
 * Payment": particulars block, certified-to-date, sections A–H with Previous / This bill / Cumulative,
 * amount in words, signatures). Drawn with pdfkit, so it renders on any server without a converter.
 *
 *   buildCopPdf([id])        one certificate
 *   buildCopPdf(ids, opts)   a register page (by discipline) followed by one page per certificate
 */
import { createRequire } from "node:module";
import type { PrismaClient } from "@prisma/client";
import { sharnamLogoPath } from "../../services/brandedExport.js";
import { amountInWordsInr } from "./copWorkbook.js";
import { loadCopView, type CopLines, type CopView } from "./copDefaults.js";

const require = createRequire(import.meta.url);
const PDFDocument = require("pdfkit") as typeof import("pdfkit");
type Doc = InstanceType<typeof PDFDocument>;

/** Sharnam brand (BRAND.md): logo teal + orange accent on warm light paper. */
const C = {
  teal: "#0b6a78",
  tealDark: "#08505b",
  tealTint: "#e7f1f2",
  orange: "#e4632a",
  orangeTint: "#fdeee6",
  sand: "#f7f4ee",
  ink: "#1d2327",
  muted: "#5b6770",
  grid: "#c9d3d6",
};
const COMPANY = "Sharnam Project Development Consultants & Co.";
const PAGE = { w: 595.28, h: 841.89, m: 30 };

const money = (n: number) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.round((n || 0) * 100) / 100);
const dt = (d: Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";
/** Built-in PDF fonts are WinAnsi — no ₹ or minus sign. */
const safe = (v: unknown) =>
  String(v ?? "")
    .replace(/₹\s*/g, "Rs. ")
    .replace(/[\u2212\u2013]/g, "-")
    .replace(/[^\x09\x0a\x0d\x20-\x7e\u00a0-\u00ff\u2014\u2018\u2019\u201c\u201d\u2022\u2026]/g, "");
const dash = (v: unknown) => {
  const t = safe(v).trim();
  return t ? t : "-";
};

/** Text cut to fit one line of `w` points in the current font (pdfkit wraps at "/" even with lineBreak off). */
function fit(doc: Doc, text: string, w: number) {
  if (doc.widthOfString(text) <= w) return text;
  let t = text;
  while (t.length > 1 && doc.widthOfString(`${t}…`) > w) t = t.slice(0, -1);
  return `${t}…`;
}

/** Registration ticks from the logo — the brand's corner marks. */
function ticks(doc: Doc, x: number, y: number, w: number, h: number) {
  const L = 10;
  doc.save().lineWidth(1.6);
  doc.strokeColor(C.teal).moveTo(x, y + L).lineTo(x, y).lineTo(x + L, y).stroke();
  doc.strokeColor(C.orange).moveTo(x + w - L, y + h).lineTo(x + w, y + h).lineTo(x + w, y + h - L).stroke();
  doc.restore();
}

function letterhead(doc: Doc, title: string, sub: string) {
  const { m, w } = PAGE;
  const logo = sharnamLogoPath();
  if (logo) {
    try {
      // The logo PNG carries generous padding — crop it into the masthead.
      doc.save().rect(m, 18, 120, 52).clip();
      doc.image(logo, m - 14, 8, { width: 148 });
      doc.restore();
    } catch {
      /* logo optional */
    }
  }
  doc.fillColor(C.teal).font("Helvetica-Bold").fontSize(14).text(COMPANY, m + 130, 24, { width: w - 2 * m - 130, align: "right" });
  doc
    .fillColor(C.muted)
    .font("Helvetica")
    .fontSize(8)
    .text("Project Management Consultancy  |  Ahmedabad, India  |  info@sharnamgroup.com  |  www.sharnamgroup.com", m + 130, 44, {
      width: w - 2 * m - 130,
      align: "right",
    });
  doc.rect(m, 74, w - 2 * m, 2.2).fill(C.orange);
  doc.rect(m, 76.2, w - 2 * m, 0.8).fill(C.teal);
  // Title band
  doc.rect(m, 84, w - 2 * m, 24).fill(C.teal);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(13).text(title, m, 90.5, { width: w - 2 * m, align: "center", characterSpacing: 1.2 });
  doc.fillColor(C.tealDark).font("Helvetica").fontSize(8.5).text(sub, m, 113, { width: w - 2 * m, align: "center" });
  return 128;
}

function footer(doc: Doc, left: string, page: number, pages: number) {
  const { m, w, h } = PAGE;
  doc.rect(m, h - 34, w - 2 * m, 0.8).fill(C.teal);
  doc.fillColor(C.muted).font("Helvetica").fontSize(7);
  doc.text(left, m, h - 28, { width: w - 2 * m - 80, lineBreak: false });
  doc.text(`Page ${page} of ${pages}`, w - m - 80, h - 28, { width: 80, align: "right", lineBreak: false });
  doc
    .fillColor(C.teal)
    .fontSize(6.5)
    .text(`${COMPANY} — controlled document. Please retain a signed copy of this Certificate of Payment for records.`, m, h - 19, {
      width: w - 2 * m,
      align: "center",
      lineBreak: false,
    });
}

/** Rounded discipline chip. */
function chip(doc: Doc, text: string, x: number, y: number) {
  doc.font("Helvetica-Bold").fontSize(8);
  const tw = doc.widthOfString(text) + 14;
  doc.roundedRect(x, y, tw, 14, 7).fill(C.orange);
  doc.fillColor("#ffffff").text(text, x, y + 3.5, { width: tw, align: "center", lineBreak: false });
  return tw;
}

function certificatePage(doc: Doc, v: CopView) {
  const { m, w } = PAGE;
  const { header: hd, history: h, cop, project } = v;
  const W = w - 2 * m;
  let y = letterhead(doc, "CERTIFICATE OF PAYMENT", safe(`${project.code} — ${project.name}${project.clientName ? `  |  Client: ${project.clientName}` : ""}`));

  // Reference strip: certificate no · date · discipline chip · status
  doc.rect(m, y, W, 22).fill(C.sand);
  doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(9).text(`Ref  ${safe(hd.certificateNumber)}`, m + 8, y + 7, { lineBreak: false });
  doc.font("Helvetica").text(`Date  ${dt(hd.certificateDate)}`, m + 220, y + 7, { lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(8).fillColor(C.muted).text("DISCIPLINE", m + 330, y + 7.5, { lineBreak: false });
  chip(doc, safe(v.discipline).toUpperCase(), m + 380, y + 4);
  doc.font("Helvetica-Bold").fontSize(8).fillColor(C.teal).text(cop.status.toUpperCase(), m + W - 90, y + 7.5, { width: 82, align: "right", lineBreak: false });
  y += 28;

  // Particulars — the client's 2 × 7 block
  const pairs: [string, string, string, string][] = [
    ["Contractor / Supplier", dash(hd.contractor), "Work / Trade", dash(hd.workTrade)],
    ["Certificate Type", dash(hd.certificateType), "Certificate No.", dash(hd.certificateNumber)],
    ["Budget Code", dash(hd.budgetCode), "Certificate Date", dt(hd.certificateDate)],
    ["W.O. / P.O. No. & Date", dash(hd.poNumberDate), "Payable to", dash(hd.payableTo)],
    ["Original W.O. Value (Rs.)", hd.originalWoValue ? money(hd.originalWoValue) : "-", "PAN", dash(hd.panNumber)],
    ["WO Amendment No.", dash(hd.amendmentNo), "GST No.", dash(hd.gstNumber)],
    ["Amended WO Value (Rs.)", hd.amendedWoValue ? money(hd.amendedWoValue) : "-", "Invoice No. & Date", dash(hd.invoiceNoDate)],
  ];
  const lw = 118;
  const vw = W / 2 - lw;
  const rh = 17;
  for (const [a, b, c, d] of pairs) {
    doc.rect(m, y, lw, rh).fill(C.tealTint);
    doc.rect(m + W / 2, y, lw, rh).fill(C.tealTint);
    doc.rect(m, y, W, rh).lineWidth(0.5).stroke(C.grid);
    for (const x of [m + lw, m + W / 2, m + W / 2 + lw]) doc.moveTo(x, y).lineTo(x, y + rh).stroke(C.grid);
    doc.fillColor(C.tealDark).font("Helvetica-Bold").fontSize(7.5);
    doc.text(a, m + 5, y + 5, { width: lw - 8, lineBreak: false, ellipsis: true });
    doc.text(c, m + W / 2 + 5, y + 5, { width: lw - 8, lineBreak: false });
    doc.fillColor(C.ink).font("Helvetica").fontSize(8.5);
    doc.text(fit(doc, b, vw - 10), m + lw + 5, y + 4.5, { width: vw - 8, lineBreak: false });
    doc.text(fit(doc, d, vw - 10), m + W / 2 + lw + 5, y + 4.5, { width: vw - 8, lineBreak: false });
    y += rh;
  }
  y += 8;

  // Certified to date
  const cw = W / 3;
  const boxes: [string, number, boolean][] = [
    ["Previous Total Amount Certified", h.previous.totalB, false],
    ["Amount Now Certified", h.current.totalB, false],
    ["Total Amount Certified", h.cumulative.totalB, true],
  ];
  boxes.forEach(([label, val, strong], i) => {
    const x = m + i * cw;
    doc.rect(x + (i ? 3 : 0), y, cw - 3, 34).fill(strong ? C.teal : C.sand);
    doc.fillColor(strong ? "#ffffff" : C.muted).font("Helvetica-Bold").fontSize(7).text(label.toUpperCase(), x + 10, y + 6, { width: cw - 20, lineBreak: false });
    doc.fillColor(strong ? "#ffffff" : C.ink).font("Helvetica-Bold").fontSize(12).text(`Rs. ${money(val)}`, x + 10, y + 17, { width: cw - 20, lineBreak: false });
  });
  y += 42;

  // Sections A–H
  const cols = [m, m + 24, m + 200, m + 276, m + 363, m + 450, m + W];
  const heads = ["Sr.", "Description", "Remarks", "Previous Bills (Rs.)", "This Bill (Rs.)", "Cumulative (Rs.)"];
  doc.rect(m, y, W, 20).fill(C.tealDark);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7.5);
  heads.forEach((t, i) => doc.text(t, cols[i] + 4, y + 6.5, { width: cols[i + 1] - cols[i] - 8, align: i >= 3 ? "right" : "left", lineBreak: false }));
  y += 20;

  type Row = { sr?: string; label: string; key?: keyof CopLines; remark?: string; kind: "section" | "item" | "total" | "grand" };
  const pct = (n: number) => (h.current.totalB ? `${Math.round((n / h.current.totalB) * 1000) / 10}% of certified` : "");
  const rows: Row[] = [
    { sr: "A", label: "Amount Raised", key: "raised", remark: v.ra ? `Raised - ${v.ra.raNumber}` : "Raised", kind: "item" },
    { label: "Total (A)", key: "raised", kind: "total" },
    { sr: "B", label: "Amount Certified", kind: "section" },
    { sr: "1", label: "Against bill raised", key: "against", kind: "item" },
    { sr: "2", label: "Extra works", key: "extra", kind: "item" },
    { sr: "3", label: "Secured advance against material", key: "securedAdvance", kind: "item" },
    { sr: "4", label: "Price variation of material", key: "priceVariation", kind: "item" },
    { label: "Total (B)", key: "totalB", kind: "total" },
    { sr: "C", label: "Recoveries and Debits", kind: "section" },
    { sr: "1", label: "Recoveries", key: "recoveries", kind: "item" },
    { sr: "2", label: "Mobilisation / material advance adjusted", key: "mobilisationAdvance", kind: "item" },
    { sr: "3", label: "Adhoc payment paid", key: "adhoc", kind: "item" },
    { sr: "4", label: "Other debits", key: "other", kind: "item" },
    { label: "Total (C)", key: "totalC", kind: "total" },
    { sr: "D", label: "Total Certified Amount after Recoveries  (D = B - C)", key: "totalD", kind: "total" },
    { sr: "E", label: "Retention", key: "retention", remark: pct(h.current.retention), kind: "item" },
    { label: "Total (E)", key: "totalE", kind: "total" },
    { sr: "F", label: "Total Certified Amount after Retention  (F = D - E)", key: "totalF", kind: "total" },
    { sr: "G", label: "Add GST as per tax invoice", key: "gst", remark: pct(h.current.gst), kind: "item" },
    { label: "Total (G)", key: "totalG", kind: "total" },
    { sr: "H", label: "Net Amount Payable against this Bill  (H = F + G)", key: "totalH", kind: "grand" },
  ];
  for (const r of rows) {
    const rhh = r.kind === "grand" ? 20 : 14.5;
    const fill = r.kind === "section" ? C.sand : r.kind === "total" ? C.tealTint : r.kind === "grand" ? C.orange : null;
    if (fill) doc.rect(m, y, W, rhh).fill(fill);
    doc.rect(m, y, W, rhh).lineWidth(0.4).stroke(C.grid);
    // Long total labels run across the remarks column.
    for (let i = 1; i < cols.length - 1; i++) {
      if (i === 2 && !r.remark && (r.kind === "total" || r.kind === "grand")) continue;
      doc.moveTo(cols[i], y).lineTo(cols[i], y + rhh).stroke(C.grid);
    }
    const bold = r.kind !== "item";
    const color = r.kind === "grand" ? "#ffffff" : r.kind === "section" ? C.tealDark : C.ink;
    const ty = y + (rhh - 8) / 2 + 0.5;
    doc.fillColor(color).font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(r.kind === "grand" ? 8.5 : 7.8);
    if (r.sr) doc.text(r.sr, cols[0] + 4, ty, { width: 18, align: "center", lineBreak: false });
    doc.text(r.label, cols[1] + 4, ty, { width: (r.remark ? cols[2] : cols[3]) - cols[1] - 8, lineBreak: false, ellipsis: true });
    if (r.remark) doc.font("Helvetica-Oblique").fontSize(7).text(r.remark, cols[2] + 4, ty + 0.5, { width: cols[3] - cols[2] - 8, lineBreak: false, ellipsis: true });
    if (r.key) {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(r.kind === "grand" ? 8.5 : 7.8).fillColor(color);
      const vals = [h.previous[r.key], h.current[r.key], h.cumulative[r.key]];
      vals.forEach((n, i) => doc.text(money(n), cols[3 + i] + 4, ty, { width: cols[4 + i] - cols[3 + i] - 8, align: "right", lineBreak: false }));
    }
    y += rhh;
  }

  // Amount in words
  y += 6;
  doc.rect(m, y, W, 22).fill(C.orangeTint);
  doc.rect(m, y, 3, 22).fill(C.orange);
  doc.fillColor(C.muted).font("Helvetica-Bold").fontSize(7).text("RS. (IN WORDS)", m + 10, y + 7.5, { lineBreak: false });
  doc
    .fillColor(C.ink)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(`Rupees ${amountInWordsInr(h.current.totalH)} only`, m + 90, y + 6.5, { width: W - 100, lineBreak: false, ellipsis: true });
  y += 30;

  if (cop.remarks) {
    doc.fillColor(C.muted).font("Helvetica-Oblique").fontSize(7.5).text(`PMC remarks: ${safe(cop.remarks)}`, m, y, { width: W, lineBreak: false, ellipsis: true });
    y += 12;
  }

  // Signatures
  const sy = Math.max(y + 34, PAGE.h - 110);
  const sw = (W - 24) / 3;
  const signs: [string, string][] = [
    [`For ${COMPANY}`, "Prepared & checked by (PMC)"],
    ["For Client", "Authorised signatory"],
    [`For ${hd.contractor}`, "Received by (Contractor)"],
  ];
  signs.forEach(([who, role], i) => {
    const x = m + i * (sw + 12);
    doc.fillColor(C.tealDark).font("Helvetica-Bold").fontSize(7.5).text(safe(who), x, sy - 30, { width: sw, lineBreak: false, ellipsis: true });
    doc.moveTo(x, sy).lineTo(x + sw, sy).lineWidth(0.8).stroke(C.teal);
    doc.fillColor(C.muted).font("Helvetica").fontSize(7.5).text(role, x, sy + 4, { width: sw, lineBreak: false });
  });
  ticks(doc, m - 12, 12, W + 24, PAGE.h - 54);
}

function registerPage(doc: Doc, views: CopView[], scope: string) {
  const { m, w } = PAGE;
  const W = w - 2 * m;
  const p = views[0].project;
  let y = letterhead(doc, "CERTIFICATES OF PAYMENT — REGISTER", `${p.code} — ${p.name}  |  ${scope}  |  ${views.length} certificate(s)`);

  // Totals by discipline
  const by = new Map<string, { n: number; certified: number; net: number }>();
  for (const v of views) {
    const g = by.get(v.discipline) || { n: 0, certified: 0, net: 0 };
    g.n += 1;
    g.certified += v.history.current.totalB;
    g.net += v.history.current.totalH;
    by.set(v.discipline, g);
  }
  let x = m;
  for (const [disc, g] of by) {
    const bw = Math.min(170, (W - (by.size - 1) * 8) / by.size);
    if (x + bw > m + W + 1) {
      x = m;
      y += 50;
    }
    doc.rect(x, y, bw, 42).fill(C.sand);
    doc.rect(x, y, 3, 42).fill(C.orange);
    doc.fillColor(C.tealDark).font("Helvetica-Bold").fontSize(8).text(`${safe(disc).toUpperCase()}  ·  ${g.n} COP`, x + 10, y + 6, { width: bw - 14, lineBreak: false });
    doc.fillColor(C.ink).font("Helvetica-Bold").fontSize(10).text(`Rs. ${money(g.net)}`, x + 10, y + 19, { width: bw - 14, lineBreak: false });
    doc.fillColor(C.muted).font("Helvetica").fontSize(7).text(`net payable  |  certified Rs. ${money(g.certified)}`, x + 10, y + 32, { width: bw - 14, lineBreak: false });
    x += bw + 8;
  }
  y += 54;

  const cols = [m, m + 112, m + 164, m + 274, m + 330, m + 384, m + 458, m + W];
  const heads = ["Certificate No.", "Date", "Contractor", "Discipline", "RA bill", "Certified (Rs.)", "Net payable (Rs.)"];
  const head = () => {
    doc.rect(m, y, W, 18).fill(C.tealDark);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7.5);
    heads.forEach((t, i) => doc.text(t, cols[i] + 4, y + 5.5, { width: cols[i + 1] - cols[i] - 8, align: i >= 5 ? "right" : "left", lineBreak: false }));
    y += 18;
  };
  head();
  views.forEach((v, i) => {
    if (y > PAGE.h - 70) {
      doc.addPage();
      y = letterhead(doc, "CERTIFICATES OF PAYMENT — REGISTER", `${p.code} — ${p.name}  |  ${scope} (continued)`);
      head();
    }
    if (i % 2) doc.rect(m, y, W, 15).fill(C.sand);
    doc.rect(m, y, W, 15).lineWidth(0.4).stroke(C.grid);
    const cells = [
      safe(v.header.certificateNumber),
      dt(v.header.certificateDate),
      safe(v.header.contractor),
      safe(v.discipline),
      v.ra?.raNumber || "-",
      money(v.history.current.totalB),
      money(v.history.current.totalH),
    ];
    doc.fillColor(C.ink).font("Helvetica").fontSize(7.5);
    cells.forEach((t, j) => {
      const cw = cols[j + 1] - cols[j] - 8;
      doc.text(fit(doc, t, cw), cols[j] + 4, y + 4.5, { width: cw + 2, align: j >= 5 ? "right" : "left", lineBreak: false });
    });
    y += 15;
  });
  const tot = views.reduce((a, v) => ({ c: a.c + v.history.current.totalB, n: a.n + v.history.current.totalH }), { c: 0, n: 0 });
  doc.rect(m, y, W, 17).fill(C.teal);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8);
  doc.text("Total", cols[0] + 4, y + 5, { lineBreak: false });
  doc.text(money(tot.c), cols[5] + 4, y + 5, { width: cols[6] - cols[5] - 8, align: "right", lineBreak: false });
  doc.text(money(tot.n), cols[6] + 4, y + 5, { width: cols[7] - cols[6] - 8, align: "right", lineBreak: false });
  ticks(doc, m - 12, 12, W + 24, PAGE.h - 54);
}

/**
 * One certificate, or a register + every certificate (ids in order). `scope` labels the register
 * ("All disciplines", "MEP" …). Returns null when no COP is found.
 */
export async function buildCopPdf(prisma: PrismaClient, copIds: string[], opts?: { scope?: string }): Promise<Buffer | null> {
  const views = (await Promise.all(copIds.map((id) => loadCopView(prisma, id)))).filter((v): v is CopView => !!v);
  if (!views.length) return null;
  const single = views.length === 1 && !opts?.scope;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 0,
      bufferPages: true,
      info: {
        Title: single ? `Certificate of Payment ${views[0].header.certificateNumber}` : `Certificates of Payment — ${views[0].project.code}`,
        Author: COMPANY,
        Subject: "Certificate of Payment",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    if (!single) registerPage(doc, views, opts?.scope || "All disciplines");
    views.forEach((v, i) => {
      if (!single || i) doc.addPage();
      certificatePage(doc, v);
    });
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      footer(doc, `${views[0].project.code}  |  Generated ${dt(new Date())} from the Sharnam portal`, i + 1, range.count);
    }
    doc.end();
  });
}
