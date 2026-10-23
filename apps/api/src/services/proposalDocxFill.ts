/**
 * Write proposal form fields into the SPDC PMC proposal .docx.
 * The master file is a filled Arvind sample (no {{tokens}}). Cover, letter,
 * document control, and the footer quotation number are replaced from the form.
 * {{TOKEN}} placeholders are filled too when a future template adds them.
 */
import fs from "fs";
import JSZip from "jszip";
import { resolveProposalDocxPath } from "./proposalTemplate.js";

export type ProposalDocFields = {
  clientName: string;
  quotationNo: string;
  referenceBy?: string | null;
  clientAddress?: string | null;
  scopeSummary?: string | null;
  quotationDate?: Date | string | null;
  status?: string | null;
  revisionNo?: number;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const SAMPLE_QUOTATION_NO = "SPDC/26-27/INQ/78";
const EM = "\u2014";
const EN = "\u2013";

function escapeXml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function decodeXmlText(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function ordinal(n: number) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  if (n % 10 === 1) return `${n}st`;
  if (n % 10 === 2) return `${n}nd`;
  if (n % 10 === 3) return `${n}rd`;
  return `${n}th`;
}

function proposalDate(input: Date | string | null | undefined): Date {
  if (!input) return new Date();
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function dateParts(input: Date | string | null | undefined) {
  const d = proposalDate(input);
  return {
    day: ordinal(d.getUTCDate()),
    month: MONTHS[d.getUTCMonth()] || "January",
    year: d.getUTCFullYear(),
    monthIndex: d.getUTCMonth(),
    y: d.getUTCFullYear(),
  };
}

function scopeTitle(scope: string | null | undefined, clientName: string) {
  const line = String(scope || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)[0];
  if (!line) return clientName || "Project";
  return line.length > 90 ? `${line.slice(0, 87).trimEnd()}…` : line;
}

/** Replace every visible phrase in one pass, including text Word split across <w:t> runs. */
function replaceAllVisibleText(xml: string, phrase: string, replacement: string): string {
  if (!phrase || phrase === replacement) return xml;
  const re = /<w:t(\s[^>]*)?>([^<]*)<\/w:t>/g;
  const nodes: { start: number; end: number; text: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    nodes.push({ start: match.index, end: match.index + match[0].length, text: decodeXmlText(match[2] || "") });
  }
  if (!nodes.length) return xml;
  const joined = nodes.map((n) => n.text).join("");
  if (!joined.includes(phrase)) return xml;

  const outText = nodes.map(() => "");
  const lens = nodes.map((n) => n.text.length);
  let read = 0;
  let node = 0;
  let nodePos = 0;

  function advanceNode() {
    while (node < nodes.length && nodePos >= lens[node]) {
      node += 1;
      nodePos = 0;
    }
  }

  function copyUntil(pos: number) {
    while (read < pos && node < nodes.length) {
      advanceNode();
      if (node >= nodes.length) break;
      const room = lens[node] - nodePos;
      if (room <= 0) {
        node += 1;
        nodePos = 0;
        continue;
      }
      const take = Math.min(room, pos - read);
      outText[node] += joined.slice(read, read + take);
      read += take;
      nodePos += take;
    }
  }

  function consumeUntil(pos: number) {
    while (read < pos && node < nodes.length) {
      advanceNode();
      if (node >= nodes.length) break;
      const room = lens[node] - nodePos;
      if (room <= 0) {
        node += 1;
        nodePos = 0;
        continue;
      }
      const take = Math.min(room, pos - read);
      read += take;
      nodePos += take;
    }
  }

  while (read < joined.length && node < nodes.length) {
    const at = joined.indexOf(phrase, read);
    if (at < 0) {
      copyUntil(joined.length);
      break;
    }
    copyUntil(at);
    advanceNode();
    if (node < nodes.length) outText[node] += replacement;
    consumeUntil(at + phrase.length);
  }

  let out = "";
  let last = 0;
  nodes.forEach((n, i) => {
    out += xml.slice(last, n.start);
    const open = xml.slice(n.start, xml.indexOf(">", n.start) + 1);
    out += `${open}${escapeXml(outText[i] ?? "")}</w:t>`;
    last = n.end;
  });
  out += xml.slice(last);
  return out;
}

function paragraphPlain(p: string) {
  const bits = p.match(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g) || [];
  return bits
    .map((node) => decodeXmlText(node.replace(/<w:t(?:\s[^>]*)?>/, "").replace(/<\/w:t>$/, "")))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function setParagraphText(p: string, text: string) {
  let seen = false;
  return p.replace(/<w:t(\s[^>]*)?>[^<]*<\/w:t>/g, (_full, attrs: string) => {
    const space = attrs && String(attrs).includes("xml:space") ? attrs : ' xml:space="preserve"';
    if (seen) return `<w:t${space}></w:t>`;
    seen = true;
    return `<w:t${space}>${escapeXml(text)}</w:t>`;
  });
}

function replaceExactParagraph(xml: string, matchText: string, newText: string, times = 1) {
  const re = /<w:p[ >][\s\S]*?<\/w:p>/g;
  let count = 0;
  return xml.replace(re, (p) => {
    if (count >= times) return p;
    if (paragraphPlain(p) !== matchText) return p;
    count += 1;
    return setParagraphText(p, newText);
  });
}

function insertAfterExactParagraph(xml: string, matchText: string, newText: string, times: number) {
  const re = /<w:p[ >][\s\S]*?<\/w:p>/g;
  let count = 0;
  return xml.replace(re, (p) => {
    if (count >= times) return p;
    if (paragraphPlain(p) !== matchText) return p;
    count += 1;
    return p + setParagraphText(p, newText);
  });
}

function tokenKeyFromDocxPlaceholder(raw: string) {
  return raw.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function replacePlaceholderRuns(xml: string, tokens: Record<string, string>) {
  const re = /\{(?:<[^>]+>)*\{([\s\S]*?)\}(?:<[^>]+>)*\}/g;
  return xml.replace(re, (match, rawKey: string) => {
    const key = tokenKeyFromDocxPlaceholder(rawKey);
    if (!key || key.includes("{")) return match;
    if (Object.prototype.hasOwnProperty.call(tokens, key)) return escapeXml(tokens[key] ?? "");
    return match;
  });
}

function applyProposalFields(xml: string, fields: ProposalDocFields, insertCoverLines: boolean) {
  const clientName = fields.clientName.trim();
  const quotationNo = fields.quotationNo.trim();
  const referenceBy = fields.referenceBy?.trim() || "";
  const scope = fields.scopeSummary?.trim() || "";
  const status = fields.status?.trim() || "";
  const rev = Math.max(0, fields.revisionNo ?? 0);
  const title = scopeTitle(scope, clientName || "Project");
  const hasDate = fields.quotationDate != null && String(fields.quotationDate).trim() !== "";
  const parts = dateParts(fields.quotationDate);
  const datePlain = `${parts.day} ${parts.month} ${parts.year}`;
  const dateComma = `${parts.day} ${parts.month}, ${parts.year}`;
  const fyStart = parts.monthIndex >= 3 ? parts.y : parts.y - 1;
  const fyEnd = String((fyStart + 1) % 100).padStart(2, "0");

  let out = xml;
  if (insertCoverLines && referenceBy) {
    out = insertAfterExactParagraph(out, SAMPLE_QUOTATION_NO, `Reference by: ${referenceBy}`, 2);
  }
  if (insertCoverLines && scope) {
    out = insertAfterExactParagraph(out, "Manufacturing Facility", `Scope: ${scope}`, 1);
    out = replaceExactParagraph(out, "Manufacturing Facility", title, 1);
  }

  const tokens: Record<string, string> = {
    CLIENT_NAME: clientName,
    clientName,
    QUOTATION_NO: quotationNo,
    quotationNo,
    REFERENCE_BY: referenceBy,
    referenceBy,
    CLIENT_ADDRESS: fields.clientAddress?.trim() || "",
    clientAddress: fields.clientAddress?.trim() || "",
    SCOPE: scope,
    scopeSummary: scope,
    STATUS: status,
    status,
    QUOTATION_DATE: hasDate ? datePlain : "",
    quotationDate: hasDate ? datePlain : "",
  };
  out = replacePlaceholderRuns(out, tokens);

  const pairs: [string, string][] = [];
  if (scope) {
    pairs.push(
      [`PMC Proposal ${EM} Manufacturing Facility at Satej`, `Proposal ${EM} ${title}`],
      ["Manufacturing Facility at Satej , Vadodara", title],
      ["Manufacturing Facility at Satej , Ahmedabad", title],
    );
  }
  if (clientName) {
    pairs.push(
      ["Arvind Limited,  Satej", clientName],
      ["Arvind Limited", clientName],
      ["Arvind limited", clientName],
      ["Soham Shah", clientName],
    );
  }
  if (fields.clientAddress !== undefined) {
    pairs.push(["Santej Road, Taluka, near Khatrej, Kalol, Gujarat 382722", fields.clientAddress?.trim() || "—"]);
  }
  if (quotationNo) pairs.push([SAMPLE_QUOTATION_NO, quotationNo]);
  if (hasDate) {
    pairs.push(["29th July,  2026", dateComma], ["29th July 2026", datePlain]);
    pairs.push([`PROPOSAL  2026 ${EN} 27`, `PROPOSAL  ${fyStart} ${EN} ${fyEnd}`]);
  }
  if (status) {
    pairs.push([`Confidential ${EM} Commercial`, status], [`R1 ${EM} For Client`, `R${rev} ${EM} ${status}`]);
  }
  for (const [from, to] of pairs) out = replaceAllVisibleText(out, from, to);
  return out;
}

export async function fillProposalDocx(template: Buffer, fields: ProposalDocFields): Promise<Buffer> {
  const zip = await JSZip.loadAsync(template);
  const names = Object.keys(zip.files).filter((n) => /^word\/(document|header\d+|footer\d+)\.xml$/.test(n));
  for (const name of names) {
    const file = zip.file(name);
    if (!file) continue;
    const xml = await file.async("string");
    zip.file(name, applyProposalFields(xml, fields, name === "word/document.xml"));
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

export async function fillProposalDocxBuffer(fields: ProposalDocFields): Promise<Buffer> {
  return fillProposalDocx(fs.readFileSync(resolveProposalDocxPath()), fields);
}
