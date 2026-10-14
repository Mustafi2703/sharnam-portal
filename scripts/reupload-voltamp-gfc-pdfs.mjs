#!/usr/bin/env node
/**
 * Replace Voltamp GFC revision PDFs with a real multi-page drawing so the portal
 * viewer and markup editor open (PATCH /api/drawings/revision/:id/file).
 *
 *   node scripts/reupload-voltamp-gfc-pdfs.mjs
 */
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.PORTAL_URL || "https://portal.spdc.in";
const PASS = process.env.UAT_PASSWORD || "Demo@1234";
const PDF = path.resolve("scripts/uat-assets/sample-gfc-drawing.pdf");

async function login(email, portal) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASS, portal }),
  });
  const body = await res.json();
  if (!body.token) throw new Error(`login ${res.status}: ${JSON.stringify(body)}`);
  return body.token;
}

async function call(token, method, url, { form, timeoutMs = 240000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${url}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      body: form || undefined,
      signal: ctrl.signal,
    });
    const type = res.headers.get("content-type") || "";
    const buf = Buffer.from(await res.arrayBuffer());
    let body = null;
    if (/json/i.test(type)) {
      try {
        body = JSON.parse(buf.toString("utf8"));
      } catch {
        body = null;
      }
    }
    return { status: res.status, body, bytes: buf.length, type };
  } finally {
    clearTimeout(t);
  }
}

const pdfBuf = fs.readFileSync(PDF);
console.log(`PDF ${path.basename(PDF)} · ${pdfBuf.length} bytes · ${BASE}`);

const site = await login("jaideep.parmar@spdc.in", "site");
const projects = (await call(site, "GET", "/api/projects")).body || [];
const p = projects.find((x) => /voltamp/i.test(`${x.code} ${x.name}`));
if (!p) throw new Error("Voltamp project not found");
console.log("project", p.code);

const drawings = (await call(site, "GET", `/api/drawings/project/${p.id}`)).body;
const rows = Array.isArray(drawings) ? drawings : drawings?.drawings || [];
let ok = 0;
let fail = 0;

for (const d of rows) {
  const revs = [...(d.revisions || [])].filter((r) => r.id);
  if (!revs.length) {
    console.log(`${d.drawingNumber}: no revisions`);
    fail++;
    continue;
  }
  for (const rev of revs) {
    const fd = new FormData();
    fd.append("pdf", new Blob([pdfBuf], { type: "application/pdf" }), `${d.drawingNumber}_${rev.revisionNumber || "R0"}.pdf`);
    fd.append("fileRole", "pdf");
    fd.append("note", "Multi-page GFC for portal viewer and markup");
    const r = await call(site, "PATCH", `/api/drawings/revision/${rev.id}/file`, { form: fd });
    if (r.status >= 400) {
      console.log(`  ${d.drawingNumber} ${rev.revisionNumber}: FAIL ${r.status} ${r.body?.error || ""}`);
      fail++;
      continue;
    }
    const pdf = await call(site, "GET", `/api/drawings/revision/${rev.id}/pdf`);
    const pass = pdf.status === 200 && pdf.bytes > 1000;
    console.log(`  ${d.drawingNumber} ${rev.revisionNumber}: replace ${r.status} · viewer ${pdf.status} ${pdf.bytes}B ${pass ? "✅" : "❌"}`);
    if (pass) ok++;
    else fail++;
  }
}

console.log(`\n${ok} PDF viewers OK · ${fail} failed`);
process.exit(fail ? 1 : 0);
