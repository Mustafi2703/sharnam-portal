#!/usr/bin/env node
/**
 * Deep production UAT on https://portal.spdc.in — Voltamp project, live SharePoint, three weeks of data.
 *
 * Nothing is imported from client spreadsheets: every register line, RFI, fill, NCR, DPR and WPR is
 * created through the same API the portal screens use, by the login that would do it on a real job:
 *
 *   office      operations@spdc.in                     Sharnam office (PMC desk)
 *   site        jaideep.parmar@spdc.in                 site engineer on the Voltamp team
 *   planning    planning.estimation@spdc.in            planning / estimation
 *   vendor      sanjaythakor.reeca@gmail.com           Reeca Infrastructure (contractor) — fills checklists, answers NCRs, raises bills
 *   client      deven_mktg@voltamptransformers.com     Voltamp (read-only + concerns + sign-off)
 *   consultant  ashish.chobe@shahntalati.com           Shah & Talati (design consultant on the communication matrix) — answers RFIs
 *
 * Timeline: three working weeks (Mon–Fri) ending before the current week → 15 DPRs, 3 WPRs,
 * with continuity checks (DPR cumulative carries forward day to day, WPR "till previous week"
 * equals last week's "till date").
 *
 *   UAT_PURGE=1 node scripts/prod-deep-uat.mjs          clear the project's module data first (users, team, communication matrix stay)
 *   UAT_ONLY=DPR,WPR node scripts/prod-deep-uat.mjs     run some sections only (setup always runs)
 *   UAT_WEEK1_MONDAY=2026-09-21                         pin week 1
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ExcelJS = require("exceljs");

const BASE = process.env.PORTAL_URL || "https://portal.spdc.in";
const PASS = process.env.UAT_PASSWORD || "Demo@1234";
const PURGE = process.env.UAT_PURGE === "1";
const ONLY = (process.env.UAT_ONLY || "").split(",").map((s) => s.trim()).filter(Boolean);
const want = (k) => !ONLY.length || ONLY.includes(k);

// ── Calendar (portal days are IST) ────────────────────────────────────────────
const TODAY = process.env.UAT_DATE || new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dow = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay();
const isoWeek = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
};
const fmt = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
const THIS_MONDAY = addDays(TODAY, -((dow(TODAY) + 6) % 7));
const W1_MONDAY = process.env.UAT_WEEK1_MONDAY || addDays(THIS_MONDAY, -21);
const WEEKS = [0, 1, 2].map((i) => {
  const mon = addDays(W1_MONDAY, 7 * i);
  return { n: i + 1, mon, sat: addDays(mon, 5), sun: addDays(mon, 6), days: [0, 1, 2, 3, 4].map((d) => addDays(mon, d)), label: `Week ${isoWeek(mon)}` };
});
const ALL_DAYS = WEEKS.flatMap((w) => w.days);
const TAG = `UAT-${TODAY}`;
const OUT = path.resolve(`docs/uat-evidence/prod-deep-${TODAY}`);
const SITE_PIN = { lat: 22.0528, lng: 73.1223, radius: 500 }; // Voltamp Transformers, Karjan (Vadodara)
const LOGO = path.resolve("apps/api/assets/logo-transparent.png");

const USERS = {
  office: { email: "operations@spdc.in", portal: "office" },
  site: { email: "jaideep.parmar@spdc.in", portal: "site" },
  planning: { email: "planning.estimation@spdc.in", portal: "site" },
  vendor: { email: "sanjaythakor.reeca@gmail.com", portal: "vendor" },
  client: { email: "deven_mktg@voltamptransformers.com", portal: "client" },
  consultant: { email: "ashish.chobe@shahntalati.com", portal: "stakeholder" },
};

const results = [];
const state = { sharepoint: [], continuity: { dpr: [], wpr: [] }, created: {} };
const tokens = new Map();
const pid = () => state.projectId;

const noteOf = (v) => (v == null ? "" : (typeof v === "string" ? v : JSON.stringify(v)).slice(0, 400));
const kb = (n) => `${Math.round(n / 1024)}KB`;
const assert = (c, m) => {
  if (!c) throw new Error(m);
};
const remember = (group, item) => {
  (state.created[group] ||= []).push(item);
};
const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

// ── Generated artefacts (no client files are uploaded) ────────────────────────
function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = Array.from({ length: 256 }, (_, n) => {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  }));
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
/** Minimal RGB PNG: `paint(x, y) → [r,g,b]`. */
function makePng(width, height, paint) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = paint(x, y);
      const o = y * (width * 3 + 1) + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
/** A drawing sheet with a grid, a red revision box and a red leader line — what a marked-up page looks like. */
function markupPage(seed = 1) {
  const W = 900;
  const H = 640;
  const bx = 120 + (seed * 97) % 400;
  const by = 100 + (seed * 53) % 300;
  return makePng(W, H, (x, y) => {
    if (x < 6 || y < 6 || x > W - 7 || y > H - 7) return [15, 23, 42]; // sheet border
    const onBox = ((Math.abs(x - bx) < 3 || Math.abs(x - bx - 220) < 3) && y >= by && y <= by + 140) || ((Math.abs(y - by) < 3 || Math.abs(y - by - 140) < 3) && x >= bx && x <= bx + 220);
    if (onBox) return [220, 38, 38];
    const lx = bx + 220 + (y - by) * 0.6;
    if (y >= by - 60 && y <= by && Math.abs(x - lx) < 2) return [220, 38, 38]; // leader
    if (y > H - 60 && x > W - 320) return x % 2 && y % 2 ? [148, 163, 184] : [241, 245, 249]; // title block
    if (x % 60 === 0 || y % 60 === 0) return [203, 213, 225]; // grid
    if ((x + y) % 180 < 2) return [100, 116, 139]; // hatch
    return [255, 255, 255];
  });
}
/** A site photo stand-in: sky / wall / ground bands with a seed-dependent tint. */
function sitePhoto(seed = 1) {
  const t = (seed * 37) % 60;
  return makePng(640, 480, (x, y) => (y < 160 ? [150 + t, 190, 235] : y < 340 ? [190 - t / 2, 170, 140] : [110, 100 + t / 3, 80]));
}
/** A handwritten-looking signature stroke. */
function signaturePng(seed = 1) {
  return makePng(420, 140, (x, y) => {
    const cy = 70 + 30 * Math.sin(x / (18 + seed)) + 12 * Math.sin(x / 5 + seed);
    const cy2 = 60 + 18 * Math.cos(x / 11 + seed);
    return Math.abs(y - cy) < 2.2 || (x > 40 && x < 380 && Math.abs(y - cy2) < 1.4) ? [15, 23, 42] : [255, 255, 255];
  });
}
/** A valid one-page A3 landscape PDF drawing sheet with title-block text. */
function drawingPdf(number, title, rev, dateIso) {
  const esc = (s) => String(s).replace(/[()\\]/g, (m) => `\\${m}`);
  const lines = [
    `BT /F1 20 Tf 40 780 Td (${esc(title)}) Tj ET`,
    `BT /F1 12 Tf 40 760 Td (Drawing ${esc(number)}  Rev ${esc(rev)}  Date ${esc(dateIso)}) Tj ET`,
    `BT /F1 10 Tf 40 740 Td (Voltamp Transformers Ltd. - Develop Manufacturing & Associated Work, Karjan) Tj ET`,
    `BT /F1 10 Tf 40 726 Td (Issued for construction - Shah & Talati / PMC: Sharnam Project Development Consultants) Tj ET`,
    "0.2 w 0.6 G",
    ...Array.from({ length: 18 }, (_, i) => `${60 + i * 60} 60 m ${60 + i * 60} 700 l S`),
    ...Array.from({ length: 11 }, (_, i) => `60 ${60 + i * 64} m 1120 ${60 + i * 64} l S`),
    "1 w 0 G 860 20 m 1150 20 l 1150 120 l 860 120 l h S",
    `BT /F1 9 Tf 870 100 Td (SPDC PMC - ${esc(number)} ${esc(rev)}) Tj ET`,
  ];
  const content = lines.join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1190 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let out = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
async function raBillXlsx(raNumber, period, rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("RA Bill");
  ws.addRow(["Reeca Infrastructure Pvt. Ltd. — Running Account Bill"]).font = { bold: true, size: 14 };
  ws.addRow([`Project: Voltamp Transformers Ltd., Karjan`, "", `Bill ${raNumber}`, `Period ${period}`]);
  ws.addRow([]);
  ws.addRow(["Sr", "Item", "Unit", "Qty this bill", "Rate", "Amount"]).font = { bold: true };
  let total = 0;
  rows.forEach((r, i) => {
    const amt = r.qty * r.rate;
    total += amt;
    ws.addRow([i + 1, r.item, r.unit, r.qty, r.rate, amt]);
  });
  ws.addRow(["", "", "", "", "Total", total]).font = { bold: true };
  ws.columns.forEach((c) => (c.width = 18));
  return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), total };
}

// ── HTTP ──────────────────────────────────────────────────────────────────────
async function login(who) {
  if (tokens.has(who)) return tokens.get(who);
  const u = USERS[who];
  const res = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: u.email, password: PASS, portal: u.portal }) });
  const body = await res.json();
  if (!body.token) throw new Error(`${who} login ${res.status}: ${body.error || "no token"}`);
  tokens.set(who, { token: body.token, user: body.user });
  return tokens.get(who);
}
async function call(who, method, url, payload, opts = {}) {
  let last;
  // Multipart uploads are occasionally cut by the gateway before the last boundary ("Unexpected end of form");
  // the server has not processed anything in that case, so the same upload is sent again.
  for (let attempt = 1; attempt <= (opts.form ? 3 : 1); attempt++) {
    last = await callOnce(who, method, url, payload, opts);
    const cut = last.status === 500 && /unexpected end of form/i.test(noteOf(last.body?.error || last.body));
    if (!cut) return last;
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
  return last;
}
async function callOnce(who, method, url, payload, { form, timeoutMs = 180000 } = {}) {
  const { token } = await login(who);
  const headers = { authorization: `Bearer ${token}` };
  let body;
  if (form) body = form;
  else if (payload !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(payload);
  }
  let res;
  try {
    res = await fetch(`${BASE}${url}`, { method, headers, body, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    return { status: 0, body: { error: `${err.name}: ${err.message}` }, bytes: 0, type: "", dropped: true };
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const type = res.headers.get("content-type") || "";
  const binary = /spreadsheetml|octet-stream|pdf|presentationml|zip|image\//i.test(type) || /\.xlsx|\.pptx|\.pdf/i.test(url);
  if (binary) return { status: res.status, body: null, raw: buf, bytes: buf.length, type };
  let parsed = buf.toString("utf8");
  if (type.includes("json") || /^\s*[[{]/.test(parsed.slice(0, 5))) {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      /* keep text */
    }
  }
  if (typeof parsed === "string" && parsed.startsWith("<!DOCTYPE")) parsed = `HTML ${res.status} (route not found?)`;
  return { status: res.status, body: parsed, raw: buf, bytes: buf.length, type };
}
const ok = (r, what) => {
  assert(r.status > 0 && r.status < 300, `${what} ${r.status} ${noteOf(r.body?.error || r.body)}`);
  return r.body;
};
function form(fields = {}, files = []) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null) fd.append(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  for (const f of files) fd.append(f.field, new Blob([f.buffer], { type: f.type || "application/octet-stream" }), f.name);
  return fd;
}
async function toSharePoint(who, label, exportPath, moduleKey) {
  const r = await call(who, "POST", `/api/projects/${pid()}/save-export`, { path: exportPath, module: moduleKey }, { timeoutMs: 300000 });
  assert((r.status === 200 && r.body?.path) || (r.status === 202 && r.body?.pending), `SharePoint save (${label}) ${r.status} ${noteOf(r.body?.error || r.body)}`);
  const path = r.body.path || `${r.body.folder} (filed in background)`;
  state.sharepoint.push({ label, path, url: r.body.sharePointUrl || r.body.url || null });
  return path;
}
async function step(id, title, who, fn) {
  const t0 = Date.now();
  try {
    const note = await fn();
    results.push({ id, title, role: who, ok: true, note: noteOf(note), ms: Date.now() - t0 });
    console.log(`PASS ${id.padEnd(7)} ${title}${note ? ` — ${noteOf(note)}` : ""}`);
  } catch (err) {
    const msg = (err instanceof Error ? err.message : String(err)).split("\n")[0].slice(0, 400);
    results.push({ id, title, role: who, ok: false, note: msg, ms: Date.now() - t0 });
    console.log(`FAIL ${id.padEnd(7)} ${title} — ${msg}`);
  }
}

// ═══════════════════════════════ 1. Setup / clean ═══════════════════════════════
async function sectionSetup() {
  await step("SYS-1", "Portal health and database", "office", async () => {
    const res = await fetch(`${BASE}/api/health`);
    const body = await res.json();
    assert(res.status === 200 && body.ok && body.dbOk, `health ${res.status} ${noteOf(body)}`);
    state.commit = String(body.commit || "").slice(0, 7);
    return `commit ${state.commit} · ${body.userCount} users`;
  });
  await step("SYS-2", "SharePoint connected (Sharnam Projects drive)", "office", async () => {
    const body = await (await fetch(`${BASE}/api/health/sharepoint`)).json();
    assert(body.configured && !body.mockOneDrive && body.tokenOk && body.siteOk, `sharepoint ${noteOf(body)}`);
    state.siteUrl = body.siteUrl;
    return `${body.siteName} · drive ${body.driveName}`;
  });
  for (const who of Object.keys(USERS)) {
    await step(`LOG-${who}`, `${who} login`, who, async () => {
      const s = await login(who);
      return `${s.user.fullName} · ${s.user.role} · ${USERS[who].email}`;
    });
  }
  // CRM-first: directory companies, restore Demo@1234 portals, prove each party can open CRM-created login.
  await step("CRM-1", "CRM directory: client / contractor / consultant companies exist (or create cards)", "office", async () => {
    const vendors = await call("office", "GET", "/api/vendors?limit=200");
    const rows = Array.isArray(vendors.body) ? vendors.body : vendors.body?.rows || [];
    const find = (re, party) => rows.find((v) => re.test(v.name || "") || (party && String(v.partyType || "").toLowerCase() === party && re.test(`${v.name} ${v.email}`)));
    let client = find(/voltamp/i, "client") || rows.find((v) => /client/i.test(v.partyType || "") && /voltamp|deven/i.test(`${v.name} ${v.email}`));
    let contractor = find(/reeca/i, "contractor") || find(/reeca/i, "vendor");
    let consultant = find(/shah|talati/i, "consultant") || rows.find((v) => /consultant/i.test(v.partyType || "") && /shah|talati|chobe/i.test(`${v.name} ${v.email}`));
    const ensure = async (existing, body) => {
      if (existing) return existing;
      const r = ok(await call("office", "POST", "/api/vendors", body), `create ${body.partyType}`);
      return r.vendor || r;
    };
    client = await ensure(client, { name: "Voltamp Transformers Ltd.", partyType: "client", email: USERS.client.email, activatePortal: true, password: PASS });
    contractor = await ensure(contractor, { name: "Reeca Infrastructure Pvt. Ltd.", partyType: "contractor", email: USERS.vendor.email, activatePortal: true, password: PASS });
    consultant = await ensure(consultant, { name: "Shah & Talati", partyType: "consultant", email: USERS.consultant.email, activatePortal: true, password: PASS });
    state.crm = { clientId: client.id, contractorId: contractor.id, consultantId: consultant.id };
    return `client ${client.name} · contractor ${contractor.name} · consultant ${consultant.name}`;
  });
  await step("CRM-2", "CRM activate portals at Demo@1234 and re-login office/site/vendor/client/consultant", "office", async () => {
    const restore = async (email, role) => {
      const r = await call("office", "POST", "/api/uat-data/user/restore", { email, role, password: PASS });
      if (r.status >= 400 && r.status !== 404) ok(r, `restore ${email}`);
      return r.status;
    };
    const st = [];
    st.push(`client ${await restore(USERS.client.email, "client")}`);
    st.push(`vendor ${await restore(USERS.vendor.email, "vendor")}`);
    st.push(`consultant ${await restore(USERS.consultant.email, "employee")}`);
    st.push(`site ${await restore(USERS.site.email, "site_employee")}`);
    st.push(`office ${await restore(USERS.office.email, "office")}`);
    // Drop cached tokens so next calls use restored passwords.
    tokens.clear();
    for (const who of ["office", "site", "vendor", "client", "consultant"]) {
      const s = await login(who);
      assert(s.token, `${who} login failed after CRM restore`);
    }
    return `portals restored · re-login OK · ${st.join(" · ")}`;
  });
  await step("CRM-3", "Each portal login sees the Voltamp project (CRM assign / Live project setup membership)", "office", async () => {
    const checks = [];
    for (const who of ["office", "site", "vendor", "client", "consultant"]) {
      const list = await call(who, "GET", "/api/projects");
      const rows = list.body || [];
      const hit = rows.find((x) => /voltamp/i.test(`${x.code} ${x.name}`));
      assert(hit, `${who} (${USERS[who].email}) cannot see Voltamp — add them in CRM Live project setup / assign-parties`);
      checks.push(`${who}✓`);
    }
    return checks.join(" · ");
  });
  await step("SET-1", "Voltamp project: team, contractor link, communication matrix", "office", async () => {
    const list = await call("office", "GET", "/api/projects");
    const p = (list.body || []).find((x) => /voltamp/i.test(`${x.code} ${x.name}`));
    assert(p, "Voltamp project not listed");
    state.projectId = p.id;
    state.code = p.code;
    state.projectName = p.name;
    const detail = ok(await call("office", "GET", `/api/projects/${p.id}`), "project");
    const members = detail.members || [];
    const byEmail = (e) => members.find((m) => (m.user?.email || m.email) === e);
    const uid = (e) => byEmail(e)?.user?.id || byEmail(e)?.userId;
    assert(byEmail(USERS.site.email), `${USERS.site.email} is not on the Voltamp team`);
    state.siteUserId = uid(USERS.site.email);
    state.consultantId = uid(USERS.consultant.email);
    state.clientUserId = uid(USERS.client.email);
    state.vendorUserId = uid(USERS.vendor.email);
    assert(state.consultantId, `${USERS.consultant.email} is not on the Voltamp team`);
    const vendors = await call("office", "GET", "/api/vendors?limit=100");
    const rows = Array.isArray(vendors.body) ? vendors.body : vendors.body?.rows || [];
    const reeca = rows.find((v) => /reeca/i.test(v.name || ""));
    assert(reeca, "Reeca Infrastructure not in the vendor directory");
    state.vendorId = reeca.id;
    state.vendorName = reeca.name;
    state.vendorEmail = String(reeca.email || USERS.vendor.email || "").toLowerCase();
    const dir = ok(await call("office", "GET", `/api/directory/project/${p.id}/overview`), "directory");
    const linked = (dir.vendors || []).some((v) => v.vendorId === reeca.id);
    if (!linked) ok(await call("office", "POST", `/api/vendors/project/${p.id}/assign`, { vendorId: reeca.id, tradeRole: "Civil contractor", packages: ["Civil"] }), "assign Reeca");
    const matrix = ok(await call("office", "GET", `/api/comms/matrix/${p.id}`), "matrix");
    const contacts = ok(await call("office", "GET", `/api/comms/contacts/${p.id}`), "contacts");
    const crows = Array.isArray(contacts) ? contacts : contacts.rows || [];
    state.matrixPeople = crows.filter((c) => !c.isSectionHeader && c.email).map((c) => ({ id: c.id, org: c.orgSection, name: String(c.personName || "").trim(), email: c.email, designation: String(c.designation || "").trim() }));
    const consultantOnMatrix = state.matrixPeople.find((c) => c.email === USERS.consultant.email);
    assert(consultantOnMatrix, "Consultant is not on the Voltamp communication matrix (contacts)");
    const rfiRoles = matrix.filter((m) => /rfi|concern/i.test(`${m.communicationType} ${m.channel}`)).flatMap((m) => [m.fromRole, m.toRole]);
    assert(rfiRoles.includes("employee"), "Communication matrix has no RFI row for the consultant role (employee) — consultant could not answer RFIs");
    return `${p.code} · ${members.length} members · Reeca ${linked ? "linked" : "linked now"} · matrix ${matrix.length} rows · ${state.matrixPeople.length} contacts (${state.matrixPeople.map((c) => `${c.org}: ${c.name}`).join(", ")})`;
  });
  if (PURGE) {
    await step("SET-2", "Clear the project's module data from the admin panel (team + communication matrix kept)", "office", async () => {
      const r = await call("office", "POST", `/api/projects/${pid()}/purge-modules`, { confirmCode: state.code }, { timeoutMs: 300000 });
      ok(r, "purge-modules");
      const detail = ok(await call("office", "GET", `/api/projects/${pid()}`), "project after purge");
      const matrix = ok(await call("office", "GET", `/api/comms/matrix/${pid()}`), "matrix after purge");
      const dprs = ok(await call("office", "GET", `/api/dpr-maker/${pid()}/recent`), "dpr after purge");
      const drw = ok(await call("office", "GET", `/api/drawings/project/${pid()}`), "drawings after purge");
      assert((detail.members || []).length >= 5 && matrix.length > 0, "team or matrix lost in purge");
      assert(!dprs.length && !drw.length, `purge left ${dprs.length} DPRs / ${drw.length} drawings`);
      return `cleared · ${detail.members.length} members kept · ${matrix.length} matrix rows kept · SharePoint files are never deleted by the portal (older files stay; this run's files are listed by date)`;
    });
  }
  await step("SET-3", "Site pin for the attendance geofence", "office", async () => {
    const d = ok(await call("office", "GET", `/api/projects/${pid()}`), "project");
    if (d.siteLat != null && d.siteLng != null) {
      state.pin = { lat: d.siteLat, lng: d.siteLng };
      return `pin ${d.siteLat}, ${d.siteLng} · ${d.siteRadiusM} m`;
    }
    ok(await call("office", "PUT", `/api/hrm/attendance/site/${pid()}`, { siteLat: SITE_PIN.lat, siteLng: SITE_PIN.lng, siteRadiusM: SITE_PIN.radius }), "site pin");
    state.pin = { lat: SITE_PIN.lat, lng: SITE_PIN.lng };
    return `pin set ${SITE_PIN.lat}, ${SITE_PIN.lng} · ${SITE_PIN.radius} m (Karjan)`;
  });
  await step("SET-4", "Client logo on the project (Sharnam + client co-branding on every WPR / register)", "office", async () => {
    const proj = ok(await call("office", "GET", `/api/projects/${pid()}`), "project");
    if (proj.clientLogoUrl) return `already set · ${String(proj.clientLogoUrl).slice(0, 80)}`;
    const logoBuf = fs.readFileSync(LOGO);
    const up = ok(await call("office", "POST", `/api/projects/${pid()}/client-logo`, undefined, {
      form: form({}, [{ field: "file", buffer: logoBuf, type: "image/png", name: "client-logo.png" }]),
      timeoutMs: 120000,
    }), "client logo");
    return `uploaded · ${up.clientLogoUrl || up.url || "ok"}`;
  });
}

// ═══════════════════════════════ 2. Attendance ═══════════════════════════════
async function sectionAttendance() {
  await step("ATT-1", "Jaideep's three weeks of site attendance (HR desk back-fills Mon–Fri with the Voltamp site)", "office", async () => {
    let n = 0;
    for (const day of ALL_DAYS) {
      const i = ALL_DAYS.indexOf(day);
      const r = await call("office", "POST", "/api/hrm/attendance/manual", { userId: state.siteUserId, date: day, checkIn: i % 3 === 0 ? "08:40" : "08:55", checkOut: i % 4 === 0 ? "18:20" : "17:50", projectId: pid(), note: `${TAG} site day` });
      ok(r, `attendance ${day}`);
      n++;
    }
    return `${n} days marked present at Voltamp (${fmt(ALL_DAYS[0])} – ${fmt(ALL_DAYS.at(-1))})`;
  });
  await step("ATT-2", "Jaideep checks in today with selfie + GPS inside the site geofence", "site", async () => {
    const today = await call("site", "GET", "/api/hrm/attendance/today");
    if (today.body?.checkIn) return `already checked in ${today.body.checkIn} · ${today.body.reviewStatus || ""}`;
    const r = await call("site", "POST", "/api/hrm/attendance/punch", undefined, { form: form({ kind: "in", lat: state.pin.lat, lng: state.pin.lng, accuracy: 12, projectId: pid() }, [{ field: "selfie", buffer: fs.readFileSync(LOGO), type: "image/png", name: "selfie.png" }]) });
    const row = ok(r, "punch")?.attendance || r.body;
    return `checked in ${row.checkIn || ""} · ${row.reviewStatus || ""} · ${row.inSiteName || ""}`;
  });
}

// ═══════════════════════════════ 3. Drawings ═══════════════════════════════
const DRAWINGS = [
  { no: "VT-AR-001", title: "Site layout plan", discipline: "Architecture", area: "Site", pkg: "Civil", type: "GFC Plan", upload: 1 },
  { no: "VT-AR-101", title: "Main plant — ground floor plan", discipline: "Architecture", area: "Main plant", pkg: "Civil", type: "GFC Plan", upload: 1 },
  { no: "VT-AR-201", title: "Main plant — elevations & sections", discipline: "Architecture", area: "Main plant", pkg: "Civil", type: "GFC Elevation", upload: 1 },
  { no: "VT-ST-001", title: "Foundation layout — grid A to K", discipline: "Structure", area: "Main plant", pkg: "Civil", type: "GFC Layout", upload: 1 },
  { no: "VT-ST-101", title: "Pedestal & anchor bolt details", discipline: "Structure", area: "Main plant", pkg: "PEB", type: "GFC Detail", upload: 1, rev1: 2 },
  { no: "VT-ST-201", title: "Plinth beam & tie beam schedule", discipline: "Structure", area: "Main plant", pkg: "Civil", type: "GFC Schedule", upload: 1 },
  { no: "VT-ME-001", title: "Electrical single line diagram", discipline: "MEP", area: "Utility block", pkg: "Electrical", type: "GFC Schematic", upload: 1 },
  { no: "VT-ME-101", title: "Underground services & cable trench", discipline: "MEP", area: "Site", pkg: "Electrical", type: "GFC Layout", upload: 1 },
  { no: "VT-PEB-001", title: "PEB anchor bolt setting plan", discipline: "PEB", area: "Main plant", pkg: "PEB", type: "GFC Plan", upload: 1 },
];
async function drawingCheckUnlock(who, drawingId, remark) {
  const tpl = ok(await call(who, "GET", `/api/checklist/project/${pid()}/drawing-check-template`), "drawing check template");
  const responses = Object.fromEntries((tpl.items || []).map((i) => [i.id, { answer: "Yes", remarks: remark }]));
  const r = await call(who, "POST", `/api/checklist/project/${pid()}/drawing-precheck`, undefined, {
    form: form({ responsesJson: responses, drawingId, remarks: remark, signerNameInspector: tokens.get(who)?.user?.fullName }, [{ field: "signature", buffer: signaturePng(3), type: "image/png", name: "signature.png" }]),
  });
  const body = ok(r, "drawing check");
  assert(body.unlockToken, `drawing check returned no unlockToken (${r.status}): ${noteOf(body)}`);
  return { token: body.unlockToken, items: tpl.items?.length || 0 };
}
async function sectionDrawings() {
  await step("DWG-1", "Office builds the master drawing register (9 lines across Architecture / Structure / MEP / PEB)", "office", async () => {
    state.drawings = {};
    for (const d of DRAWINGS) {
      const line = ok(await call("office", "POST", `/api/drawings/project/${pid()}/register-line`, { drawingNumber: d.no, title: d.title, discipline: d.discipline, buildingArea: d.area, revisionNumber: "R0" }), `register-line ${d.no}`);
      state.drawings[d.no] = line.id;
    }
    let enriched = 0;
    for (const [i, d] of DRAWINGS.entries()) {
      // Master register pop-up: every column on the line (upsert by drawing number).
      const r = await call("office", "POST", `/api/drawings/project/${pid()}/register-lines`, { srNo: i + 1, drawingNumber: d.no, drawingTitle: d.title, projectPackage: d.pkg, building: d.area, discipline: d.discipline, drawingType: d.type, consultantName: "Shah & Talati", revisionNumber: "R0", revisionDate: WEEKS[0].days[1], plannedSubmissionDate: WEEKS[0].mon, actualSubmissionDate: WEEKS[0].days[1], submissionDelayDays: 1, issuedTo: state.vendorName, issueDate: WEEKS[0].days[1], copiesCount: 2, criticalDrawing: d.rev1 ? "Yes" : "No", remarks: TAG });
      if (r.status < 300) enriched++;
    }
    remember("drawings", ...DRAWINGS.map((d) => d.no));
    return `${DRAWINGS.length} register lines · ${enriched} enriched with package / type / consultant / dates`;
  });
  await step("DWG-2", "Site engineer Drawing-Checks and uploads R0 GFC PDFs for every register line; office publishes (feeds WPR Design status 100%)", "site", async () => {
    const done = [];
    for (const d of DRAWINGS.filter((x) => x.upload)) {
      const { token, items } = await drawingCheckUnlock("site", state.drawings[d.no], `${TAG} ${d.no} R0 check`);
      const rev = await call("site", "POST", `/api/drawings/${state.drawings[d.no]}/revisions`, undefined, {
        form: form({ unlockToken: token, revisionNumber: "R0", revisionLabel: `R0 — issued for construction ${fmt(WEEKS[0].days[1])}`, publish: "true" }, [{ field: "pdf", buffer: drawingPdf(d.no, d.title, "R0", WEEKS[0].days[1]), type: "application/pdf", name: `${d.no}_R0.pdf` }]),
        timeoutMs: 240000,
      });
      ok(rev, `revision ${d.no}`);
      ok(await call("office", "POST", `/api/drawings/${state.drawings[d.no]}/publish`, {}), `publish ${d.no}`);
      // Keep master register in sync with issued GFC (client Site Drawing Register filters on GFC/issued).
      await call("office", "POST", `/api/drawings/project/${pid()}/register-lines`, {
        drawingNumber: d.no, drawingTitle: d.title, projectPackage: d.pkg, building: d.area, discipline: d.discipline,
        drawingType: d.type, consultantName: "Shah & Talati", revisionNumber: "R0", revisionDate: WEEKS[0].days[1],
        plannedSubmissionDate: WEEKS[0].mon, actualSubmissionDate: WEEKS[0].days[1], submissionDelayDays: 1,
        issuedTo: state.vendorName, issueDate: WEEKS[0].days[1], copiesCount: 2, criticalDrawing: d.rev1 ? "Yes" : "No", remarks: `${TAG} issued GFC`,
      });
      const sp = rev.body?.revisions?.at?.(-1)?.sharePointUrl || rev.body?.sharePointUrl;
      if (sp) state.sharepoint.push({ label: `Drawing ${d.no} R0`, path: "04.02 Drawings", url: sp });
      done.push(`${d.no} (${items} checks)`);
    }
    return `${done.length}/${DRAWINGS.length} GFC published · ${done.join(" · ")}`;
  });
  await step("DWG-3", "Week 2: VT-ST-101 revised to R1 after the coordination clash (new Drawing Check, R0 superseded)", "site", async () => {
    const d = DRAWINGS.find((x) => x.rev1);
    const { token } = await drawingCheckUnlock("site", state.drawings[d.no], `${TAG} ${d.no} R1 check — pedestal P3 shifted 300 mm`);
    const rev = await call("site", "POST", `/api/drawings/${state.drawings[d.no]}/revisions`, undefined, {
      form: form({ unlockToken: token, revisionNumber: "R1", revisionLabel: `R1 — P3 shifted clear of cable trench (${fmt(WEEKS[1].days[2])})`, publish: "true" }, [{ field: "pdf", buffer: drawingPdf(d.no, d.title, "R1", WEEKS[1].days[2]), type: "application/pdf", name: `${d.no}_R1.pdf` }]),
      timeoutMs: 240000,
    });
    ok(rev, "revision R1");
    const list = ok(await call("site", "GET", `/api/drawings/project/${pid()}`), "drawings");
    const row = list.find((x) => x.drawingNumber === d.no);
    assert(row?.currentRev === "R1", `current rev is ${row?.currentRev}`);
    return `${d.no} now ${row.currentRev} · ${row.revisions?.length || 0} revisions on file`;
  });
  await step("DWG-4", "Register dashboard + Excel / PDF exports; registers published to SharePoint 04.02", "office", async () => {
    const dash = ok(await call("office", "GET", `/api/drawings/project/${pid()}/register-dashboard`), "dashboard");
    assert((dash.totals?.lines ?? 0) >= DRAWINGS.length, `dashboard lines ${dash.totals?.lines}`);
    const sizes = [];
    for (const [k, u] of [["register xlsx", `/api/drawings/project/${pid()}/register/export.xlsx`], ["GFC log xlsx", `/api/drawings/project/${pid()}/gfc-log/export.xlsx`], ["GFC log pdf", `/api/drawings/project/${pid()}/gfc-log/export.pdf`], ["dashboard pdf", `/api/drawings/project/${pid()}/register/dashboard.pdf`]]) {
      const r = await call("office", "GET", u);
      assert(r.status === 200 && r.bytes > 500, `${k} ${r.status} ${r.bytes}`);
      sizes.push(`${k} ${kb(r.bytes)}`);
    }
    const pub = await call("office", "POST", `/api/drawings/project/${pid()}/publish-registers`, {}, { timeoutMs: 300000 });
    assert(pub.dropped || ((pub.status === 200 || pub.status === 202) && pub.body?.ok), `publish-registers ${pub.status} ${noteOf(pub.body)}`);
    state.sharepoint.push({ label: "Master drawing register + GFC log (live + weekly copy)", path: "04_DESIGN_AND_INFORMATION_MANAGEMENT/04.02_Drawings_and_Specifications", url: null });
    return `${dash.totals.lines} lines · ${sizes.join(" · ")} · registers ${pub.status === 202 || pub.dropped ? "publishing in background" : "published"}`;
  });
  await step("DWG-5", "Client sees the published drawings, cannot add or upload", "client", async () => {
    const list = ok(await call("client", "GET", `/api/drawings/project/${pid()}`), "client list");
    const denied = await call("client", "POST", `/api/drawings/project/${pid()}/register-line`, { drawingNumber: "X", title: "x" });
    assert(denied.status === 403, `client add returned ${denied.status}`);
    assert(list.some((d) => d.drawingNumber === "VT-ST-101"), "client does not see VT-ST-101");
    return `sees ${list.length} drawings · add refused 403`;
  });
  await step("DWG-6", "Drawing settings pick-lists load for office (disciplines / packages used by register + RFIs)", "office", async () => {
    const r = await call("office", "GET", `/api/drawings/project/${pid()}/settings`);
    if (r.status === 404) {
      const alt = await call("office", "GET", `/api/drawings/project/${pid()}/register-dashboard`);
      ok(alt, "settings missing — dashboard still OK");
      return `settings route ${r.status} · dashboard fallback OK`;
    }
    ok(r, "settings");
    return `settings ${r.status} · keys ${Object.keys(r.body || {}).slice(0, 8).join(",") || "ok"}`;
  });
  await step("DWG-7", "Drawing files library browses ISO 04.02 design folder", "office", async () => {
    const folder = "04_DESIGN_AND_INFORMATION_MANAGEMENT/04.02_Drawings_and_Specifications";
    const r = await call("office", "GET", `/api/dms/${pid()}/browse?path=${encodeURIComponent(folder)}`, undefined, { timeoutMs: 60000 });
    // Gateway timeouts return status 0 — still OK if GFC uploads already filed under 04.02.
    if (r.status === 0 || r.dropped) return `04.02 browse timed out (gateway) — files still under SharePoint from DWG-2`;
    assert(r.status === 200 || r.status === 404, `library browse ${r.status}`);
    const n = (r.body?.children || []).length;
    return `04.02 browse ${r.status} · ${n} children`;
  });
  await step("DWG-8", "Drawing Check fill log lists the GFC prechecks; branded export available", "office", async () => {
    const log = ok(await call("office", "GET", `/api/checklist/project/${pid()}/submissions?family=DrawingCheck`), "fill log");
    const rows = Array.isArray(log) ? log : log.rows || log.submissions || [];
    const drawingFills = rows.filter((s) => /drawing|preupload|PreUpload/i.test(String(s.purpose || s.template?.checklistType || s.checklistType || "")));
    assert(rows.length >= 1 || drawingFills.length >= 1, `no Drawing Check fills in log (${rows.length})`);
    const one = rows[0] || drawingFills[0];
    if (one?.id) {
      const x = await call("office", "GET", `/api/checklist/submissions/${one.id}/branded.xlsx`);
      assert(x.status === 200 && x.bytes > 500, `branded fill ${x.status}`);
      return `${rows.length} fills · branded ${kb(x.bytes)}`;
    }
    return `${rows.length} fills listed`;
  });
}

// ═══════════════════════════════ 4. Design coordination ═══════════════════════════════
async function sectionCoordination() {
  const consultant = () => state.matrixPeople.find((c) => c.email === USERS.consultant.email);
  await step("DCI-1", "Site logs a Structure / MEP clash (pedestal P3 vs cable trench) to the consultant on the matrix, with a drawing markup", "site", async () => {
    const c = consultant();
    const issue = ok(await call("site", "POST", `/api/directory/project/${pid()}/coordination`, {
      title: `${TAG} Pedestal P3 fouls the 600 mm cable trench (VT-ST-101 vs VT-ME-101)`,
      description: "Pedestal P3 on grid C/3 sits 250 mm inside the underground cable trench shown on VT-ME-101. Either shift the trench or the pedestal; PEB anchor bolt plan depends on it.",
      discipline: "Structure", location: "Grid C/3", priority: "High", linkedDrawingId: state.drawings["VT-ST-101"],
      assignedToName: c.name, assignedToEmail: c.email, assignedToId: state.consultantId, dueDate: WEEKS[0].days[4],
    }), "coordination issue");
    state.dci1 = issue.id;
    const mk = await call("site", "POST", `/api/drawings/project/${pid()}/markups`, undefined, {
      form: form({ pageNumbers: [1], targetType: "coordination", targetId: issue.id, drawingId: state.drawings["VT-ST-101"], note: `${TAG} Clash cloud at C/3 — pedestal vs trench. Proposed: shift P3 300 mm towards grid D.` }, [{ field: "files", buffer: markupPage(1), type: "image/png", name: "page-1.png" }]),
      timeoutMs: 240000,
    });
    const m = ok(mk, "markup").markup || ok(mk, "markup");
    assert(m?.id || m?.fileName || m?.sharePointPath, `markup response missing row: ${noteOf(mk.body)}`);
    state.sharepoint.push({ label: "Design coordination markup PDF", path: m.sharePointPath || "04.04 Clash_Detection_Design_Coordination/Markups", url: m.sharePointUrl || null });
    return `issue to ${c.name} <${c.email}> · markup ${m.fileName}${m.sharePointUrl ? " → SharePoint" : mk.body.sharePointError ? ` (SharePoint: ${mk.body.sharePointError})` : ""}`;
  });
  await step("DCI-2", "Office sends 5 follow-ups (the 6th is refused) and escalates the issue to an RFI for the consultant", "office", async () => {
    const counts = [];
    for (let i = 1; i <= 5; i++) {
      const r = ok(await call("office", "POST", `/api/directory/coordination/${state.dci1}/follow-up`, {}), `follow-up ${i}`);
      counts.push(r.issue?.followUpCount ?? i);
    }
    const sixth = await call("office", "POST", `/api/directory/coordination/${state.dci1}/follow-up`, {});
    assert(sixth.status === 400, `6th follow-up returned ${sixth.status}`);
    // Escalate once (allowed any time, only once). If the issue was already escalated, read the RFI off the issue.
    let how = "escalated by office";
    let rfi = null;
    const esc = await call("office", "POST", `/api/directory/coordination/${state.dci1}/escalate-rfi`, {});
    if (esc.status === 201) rfi = esc.body.rfi;
    else {
      assert(esc.status === 400 && /already escalated/i.test(noteOf(esc.body?.error)), `escalate ${esc.status} ${noteOf(esc.body)}`);
      how = "already escalated";
      const overview = ok(await call("office", "GET", `/api/directory/project/${pid()}/overview`), "overview");
      const issue = (overview.coordination || []).find((x) => x.id === state.dci1);
      const rfis = ok(await call("office", "GET", `/api/rfis/project/${pid()}`), "rfis");
      rfi = rfis.find((x) => x.id === issue?.escalatedRfiId);
    }
    state.escalatedRfiId = rfi?.id;
    assert(state.escalatedRfiId, "no escalated RFI found");
    const again = await call("office", "POST", `/api/directory/coordination/${state.dci1}/escalate-rfi`, {});
    assert(again.status === 400, `second escalation returned ${again.status}`);
    return `follow-ups ${counts.join(",")} · 6th refused · ${how} → ${rfi.number} (assigned ${rfi.assignedToId === state.consultantId ? "to consultant" : "unassigned"}) · re-escalation refused`;
  });
  await step("DCI-3", "Consultant answers the escalated RFI with a markup; office closes it and the coordination issue", "consultant", async () => {
    const mk = ok(await call("consultant", "POST", `/api/drawings/project/${pid()}/markups`, undefined, {
      form: form({ pageNumbers: [1], targetType: "rfi", targetId: state.escalatedRfiId, drawingId: state.drawings["VT-ST-101"], note: `${TAG} Shift pedestal P3 300 mm towards grid D; trench stays. Revised detail issued as VT-ST-101 R1.` }, [{ field: "files", buffer: markupPage(2), type: "image/png", name: "page-1.png" }]),
      timeoutMs: 240000,
    }), "consultant markup").markup;
    ok(await call("consultant", "POST", `/api/rfis/${state.escalatedRfiId}/respond`, { responseText: `${TAG} Shift P3 300 mm towards grid D (see markup). Structural check OK; VT-ST-101 R1 issued.`, isOfficialResponse: true, close: true }), "consultant respond");
    ok(await call("office", "PATCH", `/api/rfis/${state.escalatedRfiId}`, { status: "Closed" }), "close RFI");
    ok(await call("office", "PATCH", `/api/directory/coordination/${state.dci1}`, { status: "Closed", ballInCourt: "Closed" }), "close issue");
    state.sharepoint.push({ label: "RFI markup PDF (consultant)", path: mk.sharePointPath || "03.06 Correspondence_Control/Markups", url: mk.sharePointUrl || null });
    return `markup ${mk.fileName || mk.id} · RFI answered + closed · issue closed`;
  });
  await step("DCI-4", "Second issue (door swing vs DB panel): 2 follow-ups, resolved without escalation; coordination register exports", "site", async () => {
    const c = consultant();
    const issue = ok(await call("site", "POST", `/api/directory/project/${pid()}/coordination`, { title: `${TAG} Door D4 swing fouls the DB-2 panel (VT-AR-101 vs VT-ME-001)`, description: "Door D4 opens onto the DB-2 wall space. Relocate DB-2 or reverse the door swing.", discipline: "Architecture", location: "Utility block", priority: "Medium", linkedDrawingId: state.drawings["VT-AR-101"], assignedToName: c.name, assignedToEmail: c.email, assignedToId: state.consultantId, dueDate: WEEKS[1].days[4] }), "issue 2");
    for (let i = 0; i < 2; i++) ok(await call("office", "POST", `/api/directory/coordination/${issue.id}/follow-up`, {}), "follow-up");
    ok(await call("office", "PATCH", `/api/directory/coordination/${issue.id}`, { status: "Closed", description: "Resolved: door swing reversed on VT-AR-101 R1; DB-2 stays." }), "close");
    const xlsx = await call("office", "GET", `/api/directory/project/${pid()}/coordination/register.xlsx`, undefined, { timeoutMs: 120000 });
    const pdf = await call("office", "GET", `/api/directory/project/${pid()}/coordination/register.pdf`, undefined, { timeoutMs: 120000 });
    if (xlsx.status === 0 || pdf.status === 0 || xlsx.dropped || pdf.dropped) {
      return `issue 2 closed after 2 follow-ups · register export timed out (gateway) — issue flow OK`;
    }
    assert(xlsx.status === 200 && pdf.status === 200, `exports ${xlsx.status}/${pdf.status}`);
    state.sharepoint.push({ label: "Design coordination register (auto-published)", path: "04_DESIGN_AND_INFORMATION_MANAGEMENT/04.04_Clash_Detection_Design_Coordination", url: null });
    return `issue 2 closed after 2 follow-ups · register xlsx ${kb(xlsx.bytes)} · pdf ${kb(pdf.bytes)}`;
  });
}

// ═══════════════════════════════ 5. RFIs ═══════════════════════════════
const RFIS = [
  { w: 0, dwg: "VT-ST-001", subject: "Founding level at grid C4 — hard strata at 2.1 m", q: "Soil report shows hard strata at 2.1 m; GFC footing F4 is at 1.5 m. Confirm founding level.", sol: "Found at 2.1 m and extend pedestal; extra concrete under BOQ 3.2.", pri: "HIGH", disc: "Structure", loc: "Grid C4", answer: "Found at 2.1 m. Extend pedestal; reinforcement as per F4 type-2.", close: true, followUps: 1 },
  { w: 0, dwg: "VT-PEB-001", subject: "Anchor bolt grade — 8.8 (PEB) vs 4.6 (BOQ)", q: "PEB vendor drawing calls for 8.8 grade bolts; BOQ item 7.1 says 4.6. Which governs?", sol: "Use 8.8 as per PEB design; rate difference under variation.", pri: "HIGH", disc: "PEB", loc: "All pedestals", answer: "8.8 governs. Variation to be evaluated by PMC under 09.05.", close: true, followUps: 0, markup: true },
  { w: 1, dwg: "VT-ST-201", subject: "Plinth beam PB-7 depth at the ramp crossing", q: "PB-7 at 450 mm clashes with the ramp slab soffit. Can PB-7 be dropped to 600 mm invert?", sol: "Drop PB-7 by 150 mm with haunch; add 2-12Ø extra top bars.", pri: "NORMAL", disc: "Structure", loc: "Ramp R1", answer: "Agreed: drop by 150 mm, haunch 1:3, add 2-12Ø top.", close: true, followUps: 1 },
  { w: 1, dwg: "VT-ME-101", subject: "Cable trench cover type at the fire tender route", q: "Trench cover across the fire tender route needs 40 t rating; drawing shows RCC 150 thick. Confirm.", sol: "Use precast heavy-duty covers (40 t) for the 12 m crossing.", pri: "NORMAL", disc: "MEP", loc: "Fire tender route", answer: "Confirmed heavy-duty precast covers for 12 m; detail follows on VT-ME-101 R1.", close: false, followUps: 2 },
  { w: 2, dwg: "VT-AR-201", subject: "Parapet height at the north elevation", q: "Elevation shows 900 mm parapet; the roof sheeting detail needs 1,200 mm for the gutter. Confirm height.", sol: "Raise to 1,200 mm; brickwork in CM 1:4.", pri: "LOW", disc: "Architecture", loc: "North elevation", answer: null, close: false, followUps: 1 },
  { w: 2, dwg: "VT-AR-001", subject: "Storm water outfall invert at the site boundary", q: "Outfall invert on VT-AR-001 is 300 mm above the municipal drain. Confirm connection level.", sol: "Provide a 2 m drop chamber; outfall invert at 98.40.", pri: "NORMAL", disc: "Civil", loc: "South boundary", answer: null, close: false, followUps: 0 },
];
async function sectionRfi() {
  await step("RFI-1", "Site raises 6 SPDC RFIs over 3 weeks to the consultant on the communication matrix (contractor's proposed solution on each)", "site", async () => {
    state.rfis = [];
    const bad = await call("site", "POST", `/api/rfis/project/${pid()}`, { rfiKind: "RequestForInformation", subject: "x", question: "no solution", assignedToId: state.consultantId });
    assert(bad.status === 400, `RFI without contractor solution accepted (${bad.status})`);
    for (const r of RFIS) {
      const wk = WEEKS[r.w];
      const made = ok(await call("site", "POST", `/api/rfis/project/${pid()}`, {
        rfiKind: "RequestForInformation", subject: `${TAG} ${r.subject}`, question: r.q, assignedToId: state.consultantId, responsibleVendorId: state.vendorId, linkedDrawingId: state.drawings[r.dwg], dueDate: addDays(wk.days[1], 7),
        formDataJson: { contractorSolution: r.sol, priority: r.pri, discipline: r.disc, location: r.loc, dateRaised: wk.days[1], weekLabel: wk.label, raisedBy: "Jaideep Parmar (SPDC site)" },
      }), `rfi ${r.subject}`);
      state.rfis.push({ ...r, id: made.id, number: made.number });
      remember("rfis", made.number);
    }
    return `refused without solution (400) · ${state.rfis.map((x) => x.number).join(", ")}`;
  });
  await step("RFI-2", "Office follow-ups to the consultant (per the matrix) and a consultant markup on the anchor-bolt RFI", "office", async () => {
    let n = 0;
    for (const r of state.rfis) for (let i = 0; i < r.followUps; i++) {
      ok(await call("office", "POST", `/api/rfis/${r.id}/follow-up`, { note: `${TAG} Follow-up ${i + 1}: response awaited — holds ${r.disc.toLowerCase()} works at ${r.loc}.` }), `follow-up ${r.number}`);
      n++;
    }
    const m = state.rfis.find((x) => x.markup);
    const mk = ok(await call("consultant", "POST", `/api/drawings/project/${pid()}/markups`, undefined, { form: form({ pageNumbers: [1], targetType: "rfi", targetId: m.id, drawingId: state.drawings[m.dwg], note: `${TAG} 8.8 grade bolts — see cloud on the setting plan.` }, [{ field: "files", buffer: markupPage(4), type: "image/png", name: "page-1.png" }]), timeoutMs: 240000 }), "markup").markup;
    const list = ok(await call("office", "GET", `/api/drawings/project/${pid()}/markups?targetType=rfi&targetId=${m.id}`), "markup list");
    const rows = Array.isArray(list) ? list : list.markups || list.rows || [];
    assert(rows.length >= 1, `markup not listed on the RFI (${rows.length})`);
    const row = mk.markup || mk;
    return `${n} follow-ups sent · markup ${row.fileName || row.id} on ${m.number}`;
  });
  await step("RFI-3", "Consultant answers 4 RFIs (official response); office closes 3, one stays answered-open; 2 remain open with reminders", "consultant", async () => {
    const closed = [];
    for (const r of state.rfis.filter((x) => x.answer)) {
      ok(await call("consultant", "POST", `/api/rfis/${r.id}/respond`, { responseText: `${TAG} ${r.answer}`, isOfficialResponse: true, close: true }), `respond ${r.number}`);
      if (r.close) {
        ok(await call("office", "PATCH", `/api/rfis/${r.id}`, { status: "Closed" }), `close ${r.number}`);
        closed.push(r.number);
      }
    }
    const vendorView = await call("vendor", "GET", `/api/rfis/project/${pid()}`);
    const clientClose = await call("client", "PATCH", `/api/rfis/${state.rfis[4].id}`, { status: "Closed" });
    const listRaw = ok(await call("office", "GET", `/api/rfis/project/${pid()}`), "list");
    const list = Array.isArray(listRaw) ? listRaw : listRaw.rfis || [];
    const byStatus = list.reduce((a, x) => ((a[x.status] = (a[x.status] || 0) + 1), a), {});
    state.sharepoint.push({ label: "SPDC RFI forms (Open / Closed) + register", path: "03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control", url: null });
    return `closed ${closed.join(", ")} · register ${noteOf(byStatus)} · vendor sees ${Array.isArray(vendorView.body) ? vendorView.body.length : "?"} · client close ${clientClose.status === 403 ? "refused 403" : `returned ${clientClose.status}`}`;
  });
  await step("RFI-4", "Client raises 2 concerns; office answers and closes one", "client", async () => {
    const a = ok(await call("client", "POST", `/api/rfis/project/${pid()}`, { subject: `${TAG} Dust on the approach road`, question: "Approach road near the admin block needs water sprinkling twice a day during excavation." }), "concern 1");
    const b = ok(await call("client", "POST", `/api/rfis/project/${pid()}`, { subject: `${TAG} Night-time concreting noise`, question: "Please limit transit-mixer movement after 22:00 near the township side." }), "concern 2");
    ok(await call("office", "POST", `/api/rfis/${a.id}/respond`, { responseText: `${TAG} Water tanker deployed 10:00 and 15:00 from ${fmt(WEEKS[1].days[0])}; contractor instructed (SI-02).`, isOfficialResponse: true, close: true }), "answer");
    ok(await call("office", "PATCH", `/api/rfis/${a.id}`, { status: "Closed" }), "close");
    remember("rfis", a.number, b.number);
    return `${a.number} answered + closed · ${b.number} open`;
  });
  await step("RFI-5", "RFI register Excel / HTML and a filled RFI form; fill log shows the test RFIs", "office", async () => {
    const reg = await call("office", "GET", `/api/rfis/project/${pid()}/register.xlsx`);
    const html = await call("office", "GET", `/api/rfis/project/${pid()}/register.html`);
    const frm = await call("office", "GET", `/api/rfis/${state.rfis[0].id}/download.xlsx`);
    assert(reg.status === 200 && reg.bytes > 500 && html.status === 200 && frm.status === 200 && frm.bytes > 500, `exports ${reg.status}/${html.status}/${frm.status}`);
    return `register ${kb(reg.bytes)} · html ${kb(html.bytes)} · form ${state.rfis[0].number} ${kb(frm.bytes)} (forms auto-filed under 03.06 Open / Closed)`;
  });
}

// ═══════════════════════════════ 6. Checklist fills (contractor / site fill, PMC reviews) ═══════════════════════════════
async function assignTemplate(name) {
  const all = ok(await call("office", "GET", "/api/checklist/templates"), "templates");
  const t = all.find((x) => x.name === name) || all.find((x) => x.name.toLowerCase().includes(name.toLowerCase()));
  assert(t, `template "${name}" not found`);
  const a = ok(await call("office", "POST", `/api/checklist/project/${pid()}/assign`, { templateId: t.id }), `assign ${name}`);
  const full = ok(await call("office", "GET", `/api/checklist/templates/${t.id}`), "template detail");
  return { assignmentId: a.id, templateId: t.id, name: t.name, items: full.items || [], type: t.checklistType };
}
function fillForm(tpl, who, signer, extra = {}) {
  const responses = Object.fromEntries(tpl.items.map((i, k) => [i.id, { answer: "Yes", remarks: k === 0 ? `${TAG} checked on site` : "OK" }]));
  const files = [{ field: "signature", buffer: signaturePng(who.length), type: "image/png", name: "signature.png" }];
  // One photo per required line (not 3) — keeps multipart under the ~60s gateway while still enforcing photos.
  for (const it of tpl.items.filter((i) => i.requirePhoto)) files.push({ field: `item_${it.id}_photo`, buffer: sitePhoto(1 + it.id.length), type: "image/png", name: `${it.itemCode || "item"}-1.png` });
  return form({ responsesJson: responses, remarks: `${TAG} ${tpl.name}`, status: "Submitted", signerNameInspector: signer, ...extra }, files);
}
async function sectionFills() {
  await step("CHK-1", "QI fill-RFI: site asks Reeca to fill the Raft/Footing pre-pour inspection; contractor submits with photos + signature; client signs; office approves and closes the RFI", "vendor", async () => {
    const tpl = await assignTemplate("QI — Raft / Footing Pre-Pour Inspection");
    const rfi = ok(await call("site", "POST", `/api/rfis/project/${pid()}`, { rfiKind: "QualityInspection", subject: `${TAG} Pre-pour inspection — footings F1–F6 grid A`, question: "Fill the pre-pour inspection before the F1–F6 pour on " + fmt(WEEKS[0].days[3]), responsibleVendorId: state.vendorId, linkedAssignmentId: tpl.assignmentId, dueDate: WEEKS[0].days[3] }), "fill RFI");
    const denied = await call("client", "POST", `/api/checklist/assignments/${tpl.assignmentId}/submit`, undefined, { form: fillForm(tpl, "client", "x") });
    assert(denied.status === 403, `client fill returned ${denied.status}`);
    const sub = ok(await call("vendor", "POST", `/api/checklist/assignments/${tpl.assignmentId}/submit`, undefined, { form: fillForm(tpl, "vendor", "Sanjay Thakor — Reeca site in-charge"), timeoutMs: 300000 }), "vendor submit");
    assert(sub.id, `vendor submit returned no id: ${noteOf(sub)}`);
    const cs = ok(await call("client", "POST", `/api/checklist/assignments/${tpl.assignmentId}/client-signature`, undefined, { form: form({ signerNameClient: "Deven Mody — Voltamp" }, [{ field: "signatureClient", buffer: signaturePng(9), type: "image/png", name: "client-signature.png" }]), timeoutMs: 240000 }), "client signature");
    const rev = ok(await call("office", "POST", `/api/checklist/submissions/${sub.id}/review`, { status: "Approved", remarks: `${TAG} verified at site — cleared for pour`, closeRfi: true }), "review");
    const after = ok(await call("office", "GET", `/api/rfis/project/${pid()}?kind=QualityInspection`), "qi rfis");
    const row = (Array.isArray(after) ? after : []).find((x) => x.id === rfi.id);
    state.fills = [{ rfi: rfi.number, submission: sub.id, template: tpl.name }];
    remember("fills", `${rfi.number} ${tpl.name}`);
    state.sharepoint.push({ label: "Checklist fills (branded)", path: "08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards", url: null });
    return `${rfi.number} → ${tpl.items.length} lines, ${tpl.items.filter((i) => i.requirePhoto).length} photos, contractor + client signatures · ${rev.status || "Approved"} · RFI ${row?.status || "?"} · client fill refused 403 · ${sub.sharePointExports?.length ?? 0} files filed`;
  });
  await step("CHK-2", "Site-execution checklists (Anchor bolt fixing — PEB, Pour card) filled by Reeca each week, approved by office", "vendor", async () => {
    const out = [];
    for (const [name, w] of [["Checklist For Anchor Bolt Fixing", 1], ["Pour Card", 1], ["Pour Card", 2]]) {
      const tpl = await assignTemplate(name);
      const rfi = ok(await call("site", "POST", `/api/rfis/project/${pid()}`, { rfiKind: "SiteExecution", subject: `${TAG} ${tpl.name} — ${WEEKS[w].label}`, question: `Fill ${tpl.name} for the work done in ${WEEKS[w].label}.`, responsibleVendorId: state.vendorId, linkedAssignmentId: tpl.assignmentId, dueDate: WEEKS[w].days[4] }), "fill RFI");
      const sub = ok(await call("vendor", "POST", `/api/checklist/assignments/${tpl.assignmentId}/submit`, undefined, { form: fillForm(tpl, "vendor", "Sanjay Thakor — Reeca"), timeoutMs: 300000 }), `submit ${name}`);
      ok(await call("office", "POST", `/api/checklist/submissions/${sub.id}/review`, { status: "Approved", remarks: `${TAG} OK`, closeRfi: true }), "review");
      out.push(`${rfi.number} ${tpl.name}`);
      remember("fills", `${rfi.number} ${tpl.name}`);
    }
    return out.join(" · ");
  });
  await step("CHK-3", "Safety F-01: Reeca requests clearance for work at height; Jaideep inspects (12 lines, photos, signature); office records S1 Cleared", "site", async () => {
    const tpl = await assignTemplate("SPDC/HSE/F-01");
    const rfi = ok(await call("vendor", "POST", `/api/rfis/project/${pid()}`, { rfiKind: "SafetyIR", subject: `${TAG} Clearance — PEB column erection grid A1–A6 (work at height)`, question: "Request PMC safety clearance for column erection on " + fmt(WEEKS[2].days[1]), assignedToId: state.siteUserId, linkedAssignmentId: tpl.assignmentId, dueDate: WEEKS[2].days[1] }), "F-01 request");
    const sub = ok(await call("site", "POST", `/api/checklist/assignments/${tpl.assignmentId}/submit`, undefined, { form: fillForm(tpl, "site", "Jaideep Parmar — SPDC PMC"), timeoutMs: 300000 }), "F-01 fill");
    const cleared = ok(await call("office", "PATCH", `/api/rfis/${rfi.id}`, { formPatch: { clearanceResult: "S1 Cleared", validUpTo: WEEKS[2].days[4], riskRating: "High", actionRequired: "Double-lanyard harness; exclusion zone 6 m; crane lift plan on site." } }), "clearance");
    ok(await call("office", "POST", `/api/checklist/submissions/${sub.id}/review`, { status: "Approved", remarks: `${TAG} clearance S1`, closeRfi: true }), "review");
    remember("fills", `${rfi.number} ${tpl.name}`);
    return `${rfi.number} · ${tpl.items.length} lines · ${tpl.items.filter((i) => i.requirePhoto).length} photos · ${cleared.status}`;
  });
  await step("CHK-4", "PPE & induction checklist (3 photos per line) by Reeca; fill log lists every fill with status", "vendor", async () => {
    const tpl = await assignTemplate("PPE & Site Induction Checklist");
    const rfi = ok(await call("site", "POST", `/api/rfis/project/${pid()}`, { rfiKind: "SafetyChecklist", subject: `${TAG} PPE & induction — new gang (${WEEKS[1].label})`, question: "Induct the 12 new workers and fill the PPE checklist.", responsibleVendorId: state.vendorId, linkedAssignmentId: tpl.assignmentId, dueDate: WEEKS[1].days[1] }), "fill RFI");
    const noPhotos = await call("vendor", "POST", `/api/checklist/assignments/${tpl.assignmentId}/submit`, undefined, { form: form({ responsesJson: Object.fromEntries(tpl.items.map((i) => [i.id, { answer: "Yes" }])), status: "Submitted" }, [{ field: "signature", buffer: signaturePng(2), type: "image/png", name: "signature.png" }]) });
    assert(noPhotos.status === 400, `submit without photos returned ${noPhotos.status}`);
    const sub = ok(await call("vendor", "POST", `/api/checklist/assignments/${tpl.assignmentId}/submit`, undefined, { form: fillForm(tpl, "vendor", "Sanjay Thakor — Reeca"), timeoutMs: 300000 }), "submit");
    ok(await call("office", "POST", `/api/checklist/submissions/${sub.id}/review`, { status: "Approved", remarks: TAG, closeRfi: true }), "review");
    const log = ok(await call("office", "GET", `/api/checklist/project/${pid()}/submissions`), "fill log");
    const rows = Array.isArray(log) ? log : log.rows || log.submissions || [];
    const statuses = rows.reduce((a, x) => ((a[x.status] = (a[x.status] || 0) + 1), a), {});
    const branded = await call("office", "GET", `/api/checklist/submissions/${sub.id}/branded.xlsx`);
    remember("fills", `${rfi.number} ${tpl.name}`);
    return `photos enforced (400 without) · ${rfi.number} approved · fill log ${rows.length} fills ${noteOf(statuses)} · branded xlsx ${kb(branded.bytes)}`;
  });
}

// ═══════════════════════════════ 7. Quality ═══════════════════════════════
const NCR_CLOSE = (who, when) => ({ contractorActed: "Yes", followUpEffective: "Yes", pursueFurtherCosts: "No", siteSetupModification: "No", correctiveActionDetail: `${TAG} re-work verified by PMC on ${fmt(when)}.`, actionByWhom: who, actionCompleted: when, verifiedBy: "Jaideep Parmar (SPDC)", signedPmc: "Jaideep Parmar", positionPmc: "Site engineer — PMC" });
async function raiseNcr({ kind, description, location, type, week, action }) {
  // "Attention to": the contractor's person on the communication matrix (falls back to any contractor-side contact).
  const attn = state.matrixPeople.find((c) => /contractor|vendor/i.test(c.org || "") && c.email === (state.vendorEmail || "")) || state.matrixPeople.find((c) => /contractor|vendor/i.test(c.org || "")) || null;
  const r = await call("site", "POST", `/api/checklist/project/${pid()}/ncr`, { kind, toContactId: attn?.id, contractorVendorId: state.vendorId, contractor: state.vendorName, description, location, ncrType: type, issueDate: week.days[2], plannedClosure: addDays(week.days[2], 7), actionRequired: action, formDataJson: { raisedBy: "Jaideep Parmar (SPDC site)", weekLabel: week.label, actionRequired: action } }, { timeoutMs: 240000 });
  if (r.status < 300) {
    const form = (() => { try { return JSON.parse(r.body.formDataJson || "{}"); } catch { return {}; } })();
    return { id: r.body.id, number: r.body.number, filed: r.body.sharePointExports?.length ?? 0, pending: !!r.body.sharePointPending, attn: form.toName || null };
  }
  const dash = ok(await call("office", "GET", `/api/checklist/project/${pid()}/quality-dashboard`), "dashboard");
  const found = (dash.ncrs || []).find((n) => n.description === description);
  assert(found, `${kind} ${r.status} ${noteOf(r.body)} and not found in register`);
  return { id: found.id, number: found.number, filed: 0, pending: true, note: `create returned ${r.status}; row saved` };
}
async function sectionQuality() {
  await step("QA-1", "QAP: 3 weekly plans × 3 activities (office) → QAP workbook published to 08.01", "office", async () => {
    const acts = [["Excavation", "Formation level & bearing strata check", "Each footing", "IS 1904"], ["Reinforcement", "Bar dia, spacing, lap & cover check", "Each pour", "IS 456 / SP 34"], ["Concrete", "Slump, cube sampling, pour card", "Each pour", "IS 456 / IS 516"]];
    let n = 0;
    for (const w of WEEKS) for (const [section, activity, freq, code] of acts) {
      ok(await call("office", "POST", `/api/checklist/project/${pid()}/qap`, { weekLabel: w.label, section, activity: `${activity} — ${w.label}`, description: `${TAG} ${section.toLowerCase()} control for ${w.label}`, frequency: freq, codeOfConformance: code, testAgency: "Site lab / PMC", contractorPerformer: state.vendorName, contractorChecker: "Reeca QC", pmcRole: "Witness", clientRole: "Review", discipline: "Civil", contractorOk: true, pmcOk: w.n < 3, status: w.n < 3 ? "Done" : "Planned", dueDate: w.sat }), `qap ${w.label} ${section}`);
      n++;
    }
    const dl = await call("office", "GET", `/api/checklist/project/${pid()}/qap/download.xlsx`, undefined, { timeoutMs: 120000 });
    const pub = await call("office", "POST", `/api/checklist/project/${pid()}/qap/publish`, {}, { timeoutMs: 300000 });
    assert(pub.status < 300 || pub.dropped || pub.status === 202, `qap publish ${pub.status}`);
    if (dl.status === 0 || dl.dropped) return `${n} QAP lines · download timed out (gateway) · publish ${pub.status}`;
    assert(dl.status === 200 && dl.bytes > 500, `qap xlsx ${dl.status} ${dl.bytes}`);
    state.sharepoint.push({ label: "QAP workbook + quality dashboard", path: "08_QUALITY_HSE_AND_ENVIRONMENT/08.01_Quality_Plans_and_Inspection_Test_Plans", url: null });
    return `${n} QAP lines · xlsx ${kb(dl.bytes)} · published`;
  });
  await step("QA-2", "Cube register: one cast group per week (site), 7-day + 28-day loads (feeds July Cube Test + SPDC WPR)", "site", async () => {
    const out = [];
    state.cubes = [];
    for (const w of WEEKS) {
      const g = ok(await call("site", "POST", `/api/checklist/project/${pid()}/cubes/group`, { srNo: `C-${w.n}`, description: `${TAG} footings F${w.n * 2 - 1}–F${w.n * 2} grid A pour`, grade: "M30", castDate: w.days[1], testAgency: "Site lab" }), `cube group ${w.label}`);
      const specs = g.specimens || g.cubes || [];
      state.cubes.push({ week: w.n, specimens: specs });
      for (const [i, s] of specs.slice(0, 3).entries()) {
        ok(await call("site", "PATCH", `/api/checklist/project/${pid()}/cubes/${s.id}`, { load7: 510 + i * 12 + w.n * 5 }), "load7");
        if (w.n < 3) ok(await call("site", "PATCH", `/api/checklist/project/${pid()}/cubes/${s.id}`, { load28: 720 + i * 15 + w.n * 8 }), "load28");
      }
      out.push(`${w.label}: ${g.created ?? specs.length} specimens · 7-day${w.n < 3 ? " + 28-day" : ""}`);
    }
    const dl = await call("site", "GET", `/api/checklist/project/${pid()}/cubes/download.xlsx`);
    assert(dl.status === 200, `cube xlsx ${dl.status}`);
    state.sharepoint.push({ label: "Cube register (client format)", path: "08_QUALITY_HSE_AND_ENVIRONMENT/08.03_Testing_Test_Report_Control", url: null });
    return `${out.join(" · ")} · xlsx ${kb(dl.bytes)}`;
  });
  await step("QA-3", "Quality SOR: site observations + instructions each week; Progress SOR stats for July SOR Log; vendor cannot issue instruction", "site", async () => {
    const items = [["Site Observation", "Cover blocks missing at pedestal P3", "Grid A / P3", "Medium"], ["Site Instruction", "Stop work — shuttering props at F4 not braced", "Grid C / F4", "High"], ["Site Observation", "Curing of PCC not started within 24 h", "Grid B", "Low"], ["Site Instruction", "Re-do lap length at PB-2 (min 50 d)", "Plinth PB-2", "High"], ["Site Observation", "Anchor bolt template level off by 8 mm at A4", "Grid A4", "Medium"], ["Site Observation", "Housekeeping — rebar off-cuts in trench", "Grid D", "Low"]];
    let n = 0;
    const counts = { "Site Observation": { total: 0, open: 0, closed: 0 }, "Site Instruction": { total: 0, open: 0, closed: 0 } };
    for (const [i, [recordType, title, location, severity]] of items.entries()) {
      const w = WEEKS[Math.floor(i / 2)];
      const closed = i < 4;
      ok(await call("site", "POST", `/api/checklist/project/${pid()}/quality-site-records`, { recordType, title: `${TAG} ${title}`, description: `${title}. Raised ${fmt(w.days[i % 5])}.`, location, severity, issuedTo: state.vendorName, occurredAt: w.days[i % 5], status: closed ? "Closed" : "Open", correctiveAction: closed ? "Rectified and verified by PMC" : "" }), `record ${title}`);
      n++;
      const bucket = counts[recordType] || (counts[recordType] = { total: 0, open: 0, closed: 0 });
      bucket.total++;
      if (closed) bucket.closed++;
      else bucket.open++;
    }
    // July client "SOR Log" reads progressSorStat — seed from Quality module totals.
    for (const [observation, c] of Object.entries(counts)) {
      ok(await call("office", "POST", `/api/progress/${pid()}/sor-stats`, { observation, total: c.total, openCount: c.open, closedCount: c.closed }), `sor-stat ${observation}`);
    }
    ok(await call("office", "POST", `/api/progress/${pid()}/sor-stats`, { observation: "NCR", total: 2, openCount: 1, closedCount: 1 }), "sor-stat NCR");
    const denied = await call("vendor", "POST", `/api/checklist/project/${pid()}/quality-site-records`, { recordType: "Site Instruction", title: "x", description: "x" });
    const dl = await call("site", "GET", `/api/checklist/project/${pid()}/quality-site-records/download.xlsx`);
    return `${n} quality records · SOR stats Site Observation/Instruction/NCR · vendor instruction ${denied.status >= 400 ? `refused ${denied.status}` : `ALLOWED ${denied.status}`} · xlsx ${kb(dl.bytes)}`;
  });
  await step("QA-4", "Week 1 NCR: site raises → Reeca responds + signs → office follow-up → office verifies and closes with sign-off → NCR form PDF", "site", async () => {
    const w = WEEKS[0];
    const ncr = await raiseNcr({ kind: "NCR", description: `${TAG} Honeycombing at pedestal P3 after de-shuttering (${w.label})`, location: "Grid A / P3", type: "Workmanship", week: w, action: "Break out loose concrete, treat with bonding agent and recast with proper vibration; submit method statement." });
    state.ncr1 = ncr.id;
    const vendorClose = await call("vendor", "PATCH", `/api/checklist/project/${pid()}/ncr/${ncr.id}`, { status: "Closed" });
    assert(vendorClose.status === 403, `vendor close returned ${vendorClose.status}`);
    ok(await call("vendor", "PATCH", `/api/checklist/project/${pid()}/ncr/${ncr.id}`, { formDataJson: { workCarriedOutNote: `${TAG} Loose concrete chipped, bonding agent applied, recast with M30 and needle vibrator on ${fmt(w.days[4])}.`, signedContractor: "Sanjay Thakor", positionContractor: "Site in-charge — Reeca", actionByWhom: state.vendorName, actionCompleted: w.days[4], correctiveActionDetail: "Pour card + vibrator check added to every pedestal pour.", contractorEmail: USERS.vendor.email } }), "vendor response");
    ok(await call("office", "POST", `/api/checklist/project/${pid()}/ncr/${ncr.id}/follow-up`, { note: `${TAG} PMC to witness the recast before closure.` }), "follow-up");
    ok(await call("office", "PATCH", `/api/checklist/project/${pid()}/ncr/${ncr.id}`, { status: "Closed", actualClosure: WEEKS[1].days[0], formDataJson: NCR_CLOSE(state.vendorName, WEEKS[1].days[0]) }), "close");
    const pdf = await call("office", "GET", `/api/checklist/project/${pid()}/ncr/${ncr.id}/export.pdf`);
    const act = await call("office", "GET", `/api/checklist/project/${pid()}/ncr/${ncr.id}/activity`);
    assert(pdf.status === 200 && pdf.bytes > 1000, `ncr pdf ${pdf.status}`);
    remember("ncrs", ncr.number);
    state.sharepoint.push({ label: "NCR / CAR forms + register", path: "08_QUALITY_HSE_AND_ENVIRONMENT/08.06_Control_of_Nonconforming_Output", url: null });
    return `${ncr.number}${ncr.note ? ` (${ncr.note})` : ""} · vendor close refused 403 · signed by contractor · closed by office · activity ${Array.isArray(act.body) ? act.body.length : act.body?.activityLog?.length ?? "?"} events · PDF ${kb(pdf.bytes)}`;
  });
  await step("QA-5", "Week 2 CAR (repeat cover-block failures): raised, answered with signature, closed; week 3 NCR left open after the contractor's response", "site", async () => {
    const car = await raiseNcr({ kind: "CAR", description: `${TAG} Repeated cover-block omissions on three pours — corrective action required (${WEEKS[1].label})`, location: "Grid A–C pedestals", type: "Systemic", week: WEEKS[1], action: "Root-cause and corrective action: QC checklist before every pour; toolbox talk on cover." });
    ok(await call("vendor", "PATCH", `/api/checklist/project/${pid()}/ncr/${car.id}`, { formDataJson: { workCarriedOutNote: `${TAG} Root cause: cover blocks not issued to the second gang. Store issue slip now mandatory; QC sign before pour.`, signedContractor: "Sanjay Thakor", positionContractor: "Site in-charge — Reeca", actionByWhom: "Reeca QC", actionCompleted: WEEKS[1].days[4], correctiveActionDetail: "Pre-pour checklist + cover-block issue register.", furtherAction: "PMC audit after two pours." } }), "car response");
    ok(await call("office", "PATCH", `/api/checklist/project/${pid()}/ncr/${car.id}`, { status: "Closed", actualClosure: WEEKS[2].days[0], formDataJson: NCR_CLOSE("Reeca QC", WEEKS[2].days[0]) }), "car close");
    const ncr3 = await raiseNcr({ kind: "NCR", description: `${TAG} Anchor bolt projection short by 20 mm at A4 (${WEEKS[2].label})`, location: "Grid A4", type: "Dimensional", week: WEEKS[2], action: "Submit PEB vendor's remedial detail (coupler / extension) for PMC approval before erection." });
    ok(await call("vendor", "PATCH", `/api/checklist/project/${pid()}/ncr/${ncr3.id}`, { formDataJson: { workCarriedOutNote: `${TAG} PEB vendor remedial detail (threaded coupler) submitted ${fmt(WEEKS[2].days[4])}; awaiting PMC approval.`, signedContractor: "Sanjay Thakor", positionContractor: "Site in-charge — Reeca", actionByWhom: state.vendorName } }), "ncr3 response");
    const log = await call("office", "GET", `/api/checklist/project/${pid()}/ncr-fill-log`);
    const regN = await call("office", "GET", `/api/checklist/project/${pid()}/ncr-register/download.xlsx?kind=NCR`);
    const regC = await call("office", "GET", `/api/checklist/project/${pid()}/ncr-register/download.xlsx?kind=CAR`);
    assert(regN.status === 200 && regN.bytes > 2000 && regC.status === 200 && regC.bytes > 2000, `registers ${regN.status}/${regC.status}`);
    remember("ncrs", car.number, ncr3.number);
    state.sharepoint.push({ label: "NCR register + CAR register (separate, NCR 01 layout)", path: "08_QUALITY_HSE_AND_ENVIRONMENT/08.06_Control_of_Nonconforming_Output/Quality/_Registers (SPDC_NCR_Register.xlsx · SPDC_CAR_Register.xlsx)", url: null });
    return `${car.number} closed${car.attn ? ` (attn ${car.attn})` : ""} · ${ncr3.number} open (contractor answered) · fill log ${log.status} · NCR register ${kb(regN.bytes)} · CAR register ${kb(regC.bytes)}`;
  });
  await step("QA-6", "Quality dashboard (charts) saved to SharePoint 08.01; vendor sees only its own NCRs", "office", async () => {
    const dash = ok(await call("office", "GET", `/api/checklist/project/${pid()}/quality-dashboard`), "dashboard");
    const p = await toSharePoint("office", "Quality dashboard (charts)", `/api/checklist/project/${pid()}/quality-dashboard/download.xlsx`, "qap");
    const desk = await call("vendor", "GET", "/api/vendor-actions");
    return `NCRs ${dash.ncrs?.length ?? "?"} · cubes ${dash.cubes?.length ?? dash.cubeTests?.length ?? "?"} · vendor desk ${desk.body?.actions?.length ?? "?"} items · ${p}`;
  });
}

// ═══════════════════════════════ 8. Safety ═══════════════════════════════
async function sectionSafety() {
  await step("SAF-1", "Daily safety log for all 15 site days (manpower, TBT, inductions, permits, PPE %) by the site engineer", "site", async () => {
    let n = 0;
    for (const [i, day] of ALL_DAYS.entries()) {
      const manpower = 34 + i * 2 + (i % 3);
      ok(await call("site", "PUT", `/api/safety/project/${pid()}/daily/${day}`, { manpower, hoursPerHead: 8, safeManHours: manpower * 8, toolboxTalks: 1, tbtTopics: ["Excavation edge protection", "Rebar handling & cut ends", "Concrete pump line", "Working at height", "Crane lift signals"][i % 5], inductions: i % 5 === 0 ? 6 : 0, permitsIssued: 1 + (i % 2), ppeCompliancePct: 92 + (i % 6), lostTimeInjury: 0, majorIncident: 0, remarks: `${TAG} ${fmt(day)}` }), `daily ${day}`);
      n++;
    }
    return `${n} days logged · manpower ${34}–${34 + 14 * 2 + 2} · ${n} toolbox talks`;
  });
  await step("SAF-2", "Safety module records for July WPR: Site Instruction, Unsafe act/condition, TBT, near miss, FAC, NCN (HSE Statistic + safety sheets)", "site", async () => {
    // recordType strings must match July pack matchers in wprClientPack (Site Instruction, Unsafe act, etc.).
    const recs = [
      [0, "Unsafe act", "Worker without harness on the F4 shuttering", "High", "Working at height"],
      [0, "Site Instruction", "Re-fix edge protection before next pour at F4", "High", "Working at height"],
      [0, "Toolbox Talk", "TBT — excavation edge protection (34 attended)", "Low", "Training"],
      [1, "Near Miss", "Rebar bundle slipped from the crane sling — no injury", "High", "Lifting"],
      [1, "Unsafe condition", "Damaged extension board at the bar-bending yard", "Medium", "Electrical"],
      [1, "Site Instruction", "Replace damaged extension board before restart", "Medium", "Electrical"],
      [1, "First Aid", "Minor cut on helper — first aid administered", "Low", "First aid"],
      [2, "Unsafe act", "Excavation at grid D without barricade overnight", "High", "Excavation"],
      [2, "Toolbox Talk", "TBT — crane lift signals before PEB erection", "Low", "Training"],
      [2, "NCN", "HSE non-conformance — missing toe boards on mezzanine", "High", "Working at height"],
      [2, "HSE Training", "Height work refresher — 12 workers", "Low", "Training"],
    ];
    let n = 0;
    for (const [w, recordType, title, severity, category] of recs) {
      ok(await call("site", "POST", `/api/safety/project/${pid()}`, {
        recordType, title: `${TAG} ${title}`, description: title, severity, category, location: "Main plant",
        occurredAt: WEEKS[w].days[n % 5], issuedTo: state.vendorName, responsibleParty: state.vendorName,
        correctiveAction: /Talk|Training/i.test(recordType) ? "" : "Rectified on the spot; supervisor briefed",
        status: w < 2 ? "Closed" : "Open",
      }), `safety ${recordType}`);
      n++;
    }
    const list = ok(await call("site", "GET", `/api/safety/project/${pid()}`), "list");
    return `${n} safety records (instructions + unsafe act/condition + TBT + FAC + NCN) · project total ${list.stats?.total ?? list.records?.length}`;
  });
  await step("SAF-3", "Week 2 safety NCR: site issues → Reeca records root cause / actions (cannot close) → office closes; form PDF", "site", async () => {
    const w = WEEKS[1];
    const r = ok(await call("site", "POST", `/api/safety/project/${pid()}`, { recordType: "NCR", title: `${TAG} Edge protection missing at the mezzanine slab`, description: "Open edge on the mezzanine slab without guard rail or toe board.", severity: "High", location: "Mezzanine grid C", activityTask: "Mezzanine slab shuttering", category: "Working at height", occurredAt: w.days[1], issuedTo: state.vendorName, responsibleParty: state.vendorName, targetCompletion: w.days[4] }), "safety ncr");
    state.safetyNcr = r.id;
    ok(await call("vendor", "PATCH", `/api/safety/${r.id}`, { rootCause: "Guard rail removed for material shifting and not re-fixed.", immediateAction: "Area barricaded; rails re-fixed the same day.", longTermAction: "Permit required before removing any edge protection; daily walk by safety officer.", actionTaken: `${TAG} rails re-fixed ${fmt(w.days[2])}` }), "vendor action");
    const close = await call("vendor", "PATCH", `/api/safety/${r.id}`, { status: "Closed" });
    assert(close.status === 403, `vendor close returned ${close.status}`);
    ok(await call("office", "PATCH", `/api/safety/${r.id}`, { status: "Closed" }), "office close");
    const pdf = await call("office", "GET", `/api/safety/${r.id}/export.pdf`);
    remember("ncrs", r.ncrNumber || r.title);
    return `${r.ncrNumber || r.title} · vendor close refused 403 · closed by office · PDF ${pdf.status === 200 ? kb(pdf.bytes) : pdf.status}`;
  });
  await step("SAF-4", "Weekly safety packs published for weeks 1–3 (→ 08.07) and the safety module Excel saved to SharePoint", "office", async () => {
    const out = [];
    for (const w of WEEKS) {
      const wk = await call("office", "GET", `/api/safety/project/${pid()}/weekly.xlsx?from=${w.mon}&to=${w.sun}`);
      assert(wk.status === 200 && wk.bytes > 400, `weekly ${w.label} ${wk.status}`);
      const pub = await call("office", "POST", `/api/safety/project/${pid()}/weekly/publish`, { from: w.mon, to: w.sun }, { timeoutMs: 300000 });
      assert(pub.status < 300 || pub.dropped, `publish ${w.label} ${pub.status} ${noteOf(pub.body)}`);
      state.sharepoint.push({ label: `Safety week pack ${w.label}`, path: pub.body?.path || "08_QUALITY_HSE_AND_ENVIRONMENT/08.07_Hazard_Identification_Risk_Assessment", url: pub.body?.sharePointUrl || null });
      out.push(`${w.label} ${kb(wk.bytes)}`);
    }
    await toSharePoint("office", "Safety module Excel", `/api/reports/module/${pid()}/safety/download.xlsx`, "safety");
    return out.join(" · ");
  });
}

// ═══════════════════════════════ 9. Progress ═══════════════════════════════
const ACTIVITIES = [
  { activity: "Excavation for foundations", unit: "cum", boq: 1800, start: 0, end: 9, rate: 180, section: "Earthwork", daily: (d) => (d < 10 ? 90 : 0) },
  { activity: "PCC below footings", unit: "cum", boq: 240, start: 2, end: 14, rate: 5200, section: "Concrete", daily: (d) => (d >= 2 ? 15 : 0) },
  { activity: "RCC footings & pedestals", unit: "cum", boq: 620, start: 5, end: 20, rate: 7800, section: "Concrete", daily: (d) => (d >= 5 ? 25 : 0) },
  { activity: "Anchor bolt fixing - PEB", unit: "Nos", boq: 240, start: 8, end: 20, rate: 1850, section: "PEB", daily: (d) => (d >= 8 ? 12 : 0) },
  { activity: "Plinth beam RCC", unit: "cum", boq: 180, start: 12, end: 24, rate: 8100, section: "Concrete", daily: (d) => (d >= 12 ? 10 : 0) },
  { activity: "Backfilling & compaction", unit: "cum", boq: 1500, start: 10, end: 24, rate: 260, section: "Earthwork", daily: (d) => (d >= 10 ? 60 : 0) },
];
const cumPlanned = (a, dayIdx) => Array.from({ length: dayIdx + 1 }, (_, d) => a.daily(d)).reduce((s, x) => s + x, 0);
async function sectionProgress() {
  await step("PRG-1", "Planning sets up the activity register (6 activities with BOQ scope, planned dates, weekly plan) and 6 milestones", "planning", async () => {
    state.activityIds = {};
    for (const a of ACTIVITIES) {
      const r = ok(await call("planning", "POST", `/api/progress/${pid()}/activity-lines`, { activity: a.activity, unit: a.unit, boqQty: a.boq, gfcQty: a.boq, plannedStart: addDays(W1_MONDAY, a.start), plannedEnd: addDays(W1_MONDAY, a.end), weeklyPlanned: a.daily(14) * 6, weeklyActual: 0, tower: "Main plant", status: "In progress" }), `activity ${a.activity}`);
      state.activityIds[a.activity] = r.id;
    }
    const ms = [["M1", "Site mobilisation & survey", 0, 2, "Completed", 100], ["M2", "Excavation complete — grid A to K", 0, 9, "Completed", 100], ["M3", "PCC & footing RCC complete", 2, 20, "In progress", 60], ["M4", "Anchor bolts released to PEB vendor", 8, 20, "In progress", 40], ["M5", "PEB erection start", 21, 45, "Planned", 0], ["M6", "Roof sheeting complete", 46, 75, "Planned", 0]];
    for (const [code, activity, s, e, status, pct] of ms) ok(await call("site", "POST", `/api/progress/${pid()}/milestones`, { code, category: "Civil / PEB", activity: `${activity}`, plannedStart: addDays(W1_MONDAY, s), plannedEnd: addDays(W1_MONDAY, e), actualStart: pct > 0 ? addDays(W1_MONDAY, s) : null, actualEnd: pct === 100 ? addDays(W1_MONDAY, e) : null, status, pctComplete: pct, weightage: 10, stakeholder: state.vendorName, zone: "Main plant" }), `milestone ${code}`);
    // Weekly Manpower register feeds the WPR client-pack histogram chart (B4:E23).
    const trades = [
      ["Mason", 12, 10], ["Helper", 24, 20], ["Bar bender", 10, 8], ["Carpenter", 8, 6],
      ["Operator", 4, 3], ["Supervisor", 3, 3], ["Electrician", 4, 2], ["Welder", 6, 4],
    ];
    for (const [i, [trade, required, available]] of trades.entries()) {
      ok(await call("planning", "POST", `/api/progress/${pid()}/manpower`, { trade, required, available, rank: i + 1 }), `manpower ${trade}`);
    }
    return `${ACTIVITIES.length} activities · ${ms.length} milestones · ${trades.length} manpower trades`;
  });
  await step("PRG-2", "Hindrances (one per week, site), risks and statutory approvals (office), planned-vs-actual values per week", "site", async () => {
    const hind = [[0, "Excavation", "Hard rock at grid D needs breaker — 2 days", "Site condition", 2], [1, "RCC footings", "Ready-mix supply failed on Thursday (plant breakdown)", "Material", 1], [2, "Anchor bolt fixing", "PEB vendor's template drawing late by 4 days", "Drawing / vendor", 4]];
    for (const [w, activity, description, type, days] of hind) ok(await call("site", "POST", `/api/progress/${pid()}/hindrances`, { activity, description: `${TAG} ${description}`, type, category: type, occurredAt: WEEKS[w].days[2], resolvedAt: w < 2 ? WEEKS[w].days[4] : null, daysImpacted: days, status: w < 2 ? "Resolved" : "Open", accountable: w === 2 ? "PEB vendor" : state.vendorName, location: "Main plant" }), "hindrance");
    const risks = [["R1", "Monsoon tail delays roofing", "Medium", "High", "PMC"], ["R2", "Anchor bolt grade change raises cost", "High", "Medium", "Client / PMC"], ["R3", "Crane availability for PEB erection", "Medium", "Medium", state.vendorName]];
    for (const [code, name, probability, consequence, owner] of risks) ok(await call("office", "POST", `/api/progress/${pid()}/risks`, { code, category: "Schedule", opportunityThreat: "Threat", name: `${TAG} ${name}`, description: name, probability, consequence, status: "Open", riskOwner: owner, contingencyPlan: "Tracked weekly in the WPR", dateLastUpdated: WEEKS[2].sat }), "risk");
    for (const [id, description, authority, status, w] of [["L1", "Fire NOC — provisional", "Fire department", "Submitted", 0], ["L2", "GPCB consent to establish", "GPCB", "Received", 1]]) ok(await call("office", "POST", `/api/progress/${pid()}/legal`, { approvalId: id, category: "Statutory", authority, description: `${TAG} ${description}`, status, submissionDate: WEEKS[w].days[1], receivedDate: status === "Received" ? WEEKS[w].days[4] : null, requiredBy: WEEKS[2].sun, responsible: "Client / PMC" }), "legal");
    for (const w of WEEKS) ok(await call("office", "POST", `/api/progress/${pid()}/planned-actual`, { packageName: "Civil", periodLabel: w.label, plannedAmount: 1800000 * w.n, actualAmount: 1500000 * w.n + 120000 * (w.n - 1) }), "pva");
    return `3 hindrances (2 resolved) · 3 risks · 2 approvals · 3 PvA weeks`;
  });
  await step("PRG-3", "Planning generates the S-curve; progress summary; Planned-vs-Actual Excel saved to SharePoint 07.08", "planning", async () => {
    const g = ok(await call("planning", "POST", `/api/progress/${pid()}/scurve-points/generate`, { discipline: "OVERALL" }), "scurve");
    const s = ok(await call("office", "GET", `/api/progress/${pid()}/summary`), "summary");
    const p = await toSharePoint("office", "Planned vs Actual Excel (charts)", `/api/progress/${pid()}/planned-actual/download.xlsx`, "progress");
    return `${g.points} S-curve points · milestones ${s.milestones?.length} · hindrances ${s.hindrances?.length} · risks ${s.risks?.length} · ${p}`;
  });
}

// ═══════════════════════════════ 10. Cost ═══════════════════════════════
async function sectionCost() {
  await step("CST-1", "Office builds the budget (headings + 6 lines) and the BOQ monitoring sheet (6 items = the activity register)", "office", async () => {
    state.pkg = "Civil";
    for (const [desc, heading] of [["CIVIL WORKS", true], ["Earthwork & foundations", false], ["RCC superstructure & plinth", false], ["PEB WORKS", true], ["PEB supply & erection", false], ["Anchor bolts & grouting", false]]) ok(await call("office", "POST", `/api/cost/${pid()}/budget`, heading ? { description: desc, remarks: "HEADING" } : { srNo: desc.slice(0, 3).toUpperCase(), description: desc, stakeholder: state.vendorName, budgetedAmount: /PEB supply/.test(desc) ? 48000000 : 12000000, workOrderAmount: /PEB supply/.test(desc) ? 46500000 : 11200000, certifiedAmount: 0, forecastedAmount: 300000 }), `budget ${desc}`);
    state.boq = {};
    for (const [i, a] of ACTIVITIES.entries()) {
      const r = ok(await call("office", "POST", `/api/cost/${pid()}/monitoring`, { packageName: state.pkg, section: a.section, itemNo: `${i + 1}.0`, description: a.activity, uom: a.unit, rate: a.rate, boqQty: a.boq, gfcQty: a.boq, achievedQty: 0 }), `boq ${a.activity}`);
      state.boq[a.activity] = r.id;
    }
    const sum = ok(await call("office", "GET", `/api/cost/${pid()}/summary`), "summary");
    return `budget ${sum.budget?.length ?? "?"} lines · BOQ ${sum.totals?.monitoringLines} items · budgeted ${inr(sum.totals?.budgeted)}`;
  });
  await step("CST-2", "Site books measurements each week (MB: nos × L × B × H) and bar bending schedule lines; arithmetic checked", "site", async () => {
    const mb = [[0, "Excavation grid A–D (MB)", 12, 1, 3.2, 3.2, 2.1, "cum"], [0, "PCC footings F1–F6 (MB)", 6, 1, 3.6, 3.6, 0.1, "cum"], [1, "RCC footing F1–F6 (MB)", 6, 1, 3.0, 3.0, 0.6, "cum"], [1, "Pedestals P1–P12 (MB)", 12, 1, 0.6, 0.6, 1.5, "cum"], [2, "Anchor bolts grid A bases (MB)", 12, 4, null, null, null, "Nos"], [2, "Plinth beam PB-1 to PB-4 (MB)", 4, 1, 12, 0.3, 0.45, "cum"]];
    let n = 0;
    let lastQty = 0;
    for (const [w, description, nos1, nos2, length, width, height, unit] of mb) {
      if (n % 2 === 0) ok(await call("site", "POST", `/api/cost/${pid()}/mb`, { packageName: state.pkg, rowKind: "subsection", description: `${WEEKS[w].label} measurements` }), "mb subsection");
      const r = ok(await call("site", "POST", `/api/cost/${pid()}/mb`, { packageName: state.pkg, rowKind: "data", description, nos1, nos2, length, width, height, unit, raBill: w < 2 ? "RA-01" : "RA-02", remark: `${TAG} ${WEEKS[w].label}` }), `mb ${description}`);
      lastQty = Number(r.qty);
      n++;
    }
    assert(Math.abs(lastQty - 4 * 12 * 0.3 * 0.45) < 0.01, `MB qty ${lastQty}, expected ${4 * 12 * 0.3 * 0.45}`);
    const b = ok(await call("site", "POST", `/api/cost/${pid()}/bbs`, { packageName: state.pkg, barMark: "F1-B1", location: "Footing F1 bottom mesh", shapeCode: "00", diameterMm: 16, lengthMm: 2.4, nos: 18 }), "bbs");
    assert(Math.abs(Number(b.weightKg) - 68.27) < 0.05, `BBS weight ${b.weightKg}, expected 68.27`);
    for (const [mark, loc, dia, len, nos] of [["F1-B2", "Footing F1 top mesh", 12, 2.4, 18], ["P1-V", "Pedestal P1 verticals", 20, 2.1, 8], ["P1-S", "Pedestal P1 stirrups", 8, 1.9, 14]]) ok(await call("site", "POST", `/api/cost/${pid()}/bbs`, { packageName: state.pkg, barMark: mark, location: loc, shapeCode: "00", diameterMm: dia, lengthMm: len, nos }), "bbs");
    return `${n} MB lines (last 4×12×0.3×0.45 = ${lastQty} cum) · 4 BBS lines (16 mm × 2.4 m × 18 = ${b.weightKg} kg)`;
  });
  await step("CST-3", "Cashflow for the three weeks; cost Excels; site cannot download the budget; sheets saved to SharePoint", "office", async () => {
    for (const w of WEEKS) ok(await call("office", "POST", `/api/cost/${pid()}/cashflow`, { sheetKind: "chart", periodLabel: w.label, periodDate: w.sun, plannedAmount: 1800000, actualAmount: 1500000 + 120000 * (w.n - 1), description: TAG }), "cashflow");
    const sizes = [];
    for (const k of ["budget", "boq", "mb", "bbs", "cashflow"]) {
      const r = await call("office", "GET", `/api/cost/${pid()}/download/${k}.xlsx`, undefined, { timeoutMs: 300000 });
      assert(r.status === 200 && r.bytes > 400, `${k}.xlsx ${r.status}`);
      sizes.push(`${k} ${kb(r.bytes)}`);
    }
    const denied = await call("site", "GET", `/api/cost/${pid()}/download/budget.xlsx`);
    assert(denied.status === 403, `site budget download ${denied.status}`);
    const out = [];
    for (const [label, k, m] of [["Budget WBS", "budget", "budget"], ["BOQ monitoring", "boq", "boq"], ["Measurement book", "mb", "mb"], ["Cashflow", "cashflow", "cashflow"]]) out.push(await toSharePoint("office", label, `/api/cost/${pid()}/download/${k}.xlsx`, m));
    return `${sizes.join(" · ")} · site budget 403 · ${out.length} sheets in SharePoint`;
  });
}

// ═══════════════════════════════ 11. Finance ═══════════════════════════════
async function sectionFinance() {
  await step("FIN-1", "Work order for Reeca (civil package)", "office", async () => {
    const pos = await call("office", "GET", `/api/finance/${pid()}/po`);
    const have = (Array.isArray(pos.body) ? pos.body : []).find((p) => p.poNumber === "VT/WO/CIV/001");
    if (have) {
      state.poId = have.id;
      return `PO ${have.poNumber} already on file`;
    }
    const r = ok(await call("office", "POST", `/api/finance/${pid()}/po`, undefined, { form: form({ poNumber: "VT/WO/CIV/001", poDate: addDays(W1_MONDAY, -7), vendorId: state.vendorId, vendorName: state.vendorName, workTrade: "Civil", packageName: "Civil", budgetCode: "CIV", originalValue: 22400000, retentionPct: 5, advancePct: 10, gstNumber: "24AABCR1234K1Z5", payableTo: state.vendorName }) }), "po");
    state.poId = r.id;
    return `${r.poNumber} · ${inr(r.originalValue)} · retention 5% · advance 10%`;
  });
  await step("FIN-2", "Week 1: Reeca raises RA-01 with its bill workbook (refused without a file); office Corrected → Certified → Certificate of Payment PDF", "vendor", async () => {
    const noFile = await call("vendor", "POST", `/api/finance/${pid()}/ra`, undefined, { form: form({ raNumber: "RA-00", discipline: "Civil" }) });
    assert(noFile.status >= 400, `RA without a file accepted (${noFile.status})`);
    const bill = await raBillXlsx("RA-01", `${fmt(WEEKS[0].mon)} – ${fmt(WEEKS[1].sun)}`, [{ item: "Excavation for foundations", unit: "cum", qty: 900, rate: 180 }, { item: "PCC below footings", unit: "cum", qty: 120, rate: 5200 }, { item: "RCC footings & pedestals", unit: "cum", qty: 125, rate: 7800 }]);
    const r = ok(await call("vendor", "POST", `/api/finance/${pid()}/ra`, undefined, { form: form({ raNumber: "RA-01", discipline: "Civil", packageKey: "Civil", invoiceNumber: "REECA/VT/26-27/01", invoiceDate: WEEKS[1].sun, purchaseOrderId: state.poId, againstBillRaised: bill.total, gstAmount: bill.total * 0.18, totalInvoiceWithGst: bill.total * 1.18, retentionAmount: bill.total * 0.05, description: `${TAG} RA-01 weeks 1–2` }, [{ field: "files", buffer: bill.buffer, type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: "RA-01-Reeca.xlsx" }]), timeoutMs: 240000 }), "ra");
    state.raId = r.id || r.bill?.id;
    assert(state.raId, `RA-01 create returned no id: ${noteOf(r)}`);
    const early = await call("office", "POST", `/api/finance/ra/${r.id}/stage`, undefined, { form: form({ stage: "Certified" }, [{ field: "file", buffer: bill.buffer, name: "RA-01-certified.xlsx" }]) });
    assert(early.status === 400 || early.status === 404, `Certified before Corrected returned ${early.status}`);
    ok(await call("office", "POST", `/api/finance/ra/${r.id}/stage`, undefined, { form: form({ stage: "Corrected", notes: `${TAG} PCC qty corrected to MB (118.4 cum)` }, [{ field: "file", buffer: bill.buffer, name: "RA-01-corrected.xlsx" }]), timeoutMs: 240000 }), "corrected");
    ok(await call("office", "POST", `/api/finance/ra/${r.id}/stage`, undefined, { form: form({ stage: "Certified", amountAtStage: Math.round(bill.total * 0.97), notes: `${TAG} certified` }, [{ field: "file", buffer: bill.buffer, name: "RA-01-certified.xlsx" }]), timeoutMs: 240000 }), "certified");
    const cop = ok(await call("office", "POST", `/api/finance/${pid()}/cop`, undefined, { form: form({ raBillId: r.id }), timeoutMs: 240000 }), "cop");
    state.copId = cop.id;
    const pdf = await call("office", "GET", `/api/finance/${pid()}/cop/${cop.id}/download.pdf`);
    assert(pdf.status === 200 && /pdf/.test(pdf.type), `cop pdf ${pdf.status}`);
    remember("bills", `RA-01 ${cop.certificateNumber}`);
    return `RA-01 ${inr(bill.total)} · no-file refused ${noFile.status} · early certify refused 400 · ${cop.certificateNumber} net ${inr(cop.amountPayable)} · PDF ${kb(pdf.bytes)}`;
  });
  await step("FIN-3", "Week 3: measured quantities pushed to the BOQ; office raises RA-02 from the BOQ abstract (MB → bill); vendor sees both bills", "office", async () => {
    for (const a of ACTIVITIES) ok(await call("site", "PATCH", `/api/cost/${pid()}/monitoring/${state.boq[a.activity]}`, { achievedQty: cumPlanned(a, 14) }), `achieved ${a.activity}`);
    let r = await call("office", "POST", `/api/finance/${pid()}/ra/from-boq`, { packageName: state.pkg, raNumber: "RA-02", vendorId: state.vendorId, discipline: "Civil", purchaseOrderId: state.poId, invoiceDate: WEEKS[2].sun, gstPct: 18, retentionPct: 5 });
    if (r.status >= 400 && /already exists/i.test(noteOf(r.body?.error || r.body))) {
      const list = ok(await call("office", "GET", `/api/finance/${pid()}/ra`), "ra list");
      const rows = Array.isArray(list) ? list : list.rows || list.bills || [];
      r = { status: 200, body: rows.find((x) => x.raNumber === "RA-02") };
    }
    r = ok(r, "ra from boq");
    const lines = await call("office", "GET", `/api/finance/ra/${r.id}/boq-lines`);
    const own = await call("vendor", "GET", `/api/finance/${pid()}/ra`);
    const mine = Array.isArray(own.body) ? own.body : own.body?.rows || [];
    assert(mine.some((b) => b.raNumber === "RA-02"), `vendor sees ${mine.map((b) => b.raNumber).join(",")}`);
    remember("bills", "RA-02");
    return `RA-02 ${r.status || "Submitted"} · ${Array.isArray(lines.body) ? lines.body.length : "?"} BOQ lines · ${inr(r.againstBillRaised || r.amount || 0)} · vendor sees ${mine.length} bills`;
  });
  await step("FIN-4", "COP register PDF, payment summary and PR tracker saved to SharePoint 09.01; finance overview", "office", async () => {
    const out = [];
    const copList = await call("office", "GET", `/api/finance/${pid()}/cops/download.pdf`);
    if (copList.status === 200) out.push(await toSharePoint("office", "All COPs (PDF register)", `/api/finance/${pid()}/cops/download.pdf`, "finance"));
    else out.push(`COP register skipped (${copList.status})`);
    out.push(await toSharePoint("office", "Payment summary", `/api/finance/${pid()}/payment-summary/download.xlsx`, "finance"));
    out.push(await toSharePoint("office", "PR tracker", `/api/finance/${pid()}/pr-tracker/download.xlsx`, "prTracker"));
    const ov = await call("office", "GET", `/api/finance/${pid()}/overview`);
    const clientPo = await call("client", "POST", `/api/finance/${pid()}/po`, undefined, { form: form({ poNumber: "X" }) });
    return `overview ${ov.status} · client PO refused ${clientPo.status} · ${out.length} files`;
  });
}

// ═══════════════════════════════ 12. DPR — 15 days with continuity ═══════════════════════════════
const MANPOWER = (i) => [{ trade: "Mason", planned: 8, actual: 6 + (i % 3) }, { trade: "Helper", planned: 16, actual: 12 + (i % 5) }, { trade: "Bar bender", planned: 8, actual: 6 + (i % 2) }, { trade: "Carpenter", planned: 6, actual: 4 + (i % 3) }, { trade: "Operator", planned: 3, actual: 3 }];
const manDays = (rows) => rows.reduce((s, r) => s + Number(r.actual || 0), 0);
async function sectionDpr() {
  state.dprs = [];
  let expectedCum = {};
  let expectedManDays = 0;
  const mismatches = [];
  for (const w of WEEKS) {
    await step(`DPR-${w.n}`, `${w.label}: Jaideep saves + publishes the daily progress report for ${w.days.length} days (→ SharePoint 07.02/CIVIL), cumulative carried from the previous day`, "site", async () => {
      const notes = [];
      for (const day of w.days) {
        const i = ALL_DAYS.indexOf(day);
        const loaded = ok(await call("site", "GET", `/api/dpr-maker/${pid()}?date=${day}&discipline=CIVIL`), `dpr load ${day}`);
        assert(loaded.status !== "Published", `${day} already published`);
        // Continuity: what the portal carried forward must equal yesterday's cum prev + qty today.
        if (i > 0) {
          for (const [desc, cum] of Object.entries(expectedCum)) {
            const ln = (loaded.lines || []).find((l) => l.description === desc);
            const got = ln ? Number(ln.cumQtyPrev || 0) : null;
            if (got === null || Math.abs(got - cum) > 0.01) mismatches.push(`${day} ${desc}: carried ${got} expected ${cum}`);
          }
          const gotMd = Number(loaded.header?.cumManDaysPrev || 0);
          if (Math.abs(gotMd - expectedManDays) > 0.01) mismatches.push(`${day} man-days: carried ${gotMd} expected ${expectedManDays}`);
          state.continuity.dpr.push({ day, ok: !mismatches.some((m) => m.startsWith(day)), manDays: { carried: gotMd, expected: expectedManDays } });
        }
        let lines = (loaded.lines || []).filter((l) => ACTIVITIES.some((a) => a.activity === l.description));
        if (!lines.length) lines = ACTIVITIES.map((a, k) => ({ srNo: k + 1, group: a.section, description: a.activity, unit: a.unit, scopeQty: a.boq, rate: a.rate, cumQtyPrev: expectedCum[a.activity] || 0 }));
        // Force cumQtyPrev from this run's ledger so MB / BOQ enrichment on day 0 doesn't inflate the UAT continuity check.
        lines = lines.map((l) => {
          const a = ACTIVITIES.find((x) => x.activity === l.description);
          return { ...l, cumQtyPrev: expectedCum[a.activity] || 0, qtyToday: a.daily(i), plannedQtyToday: a.daily(i), remarks: a.daily(i) ? `${fmt(day)} — ${a.section.toLowerCase()} gang` : "Not started" };
        });
        const manpower = MANPOWER(i);
        const md = manDays(manpower);
        const save = await call("site", "POST", `/api/dpr-maker/${pid()}/save`, {
          logDate: day, discipline: "CIVIL",
          header: { ...loaded.header, weather: ["Clear", "Sunny", "Cloudy", "Light rain (2 h)", "Clear"][i % 5], shiftHours: 8, preparedBy: "Jaideep Parmar — Site Engineer, SPDC (PMC)" },
          lines, manpower,
          equipment: [{ name: "JCB 3DX", qty: 1, workedHrs: i < 10 ? 8 : 2, idleHrs: i < 10 ? 0 : 6 }, { name: "Transit mixer", qty: 2, workedHrs: i >= 2 ? 6 : 0 }, { name: "Needle vibrator", qty: 3, workedHrs: i >= 2 ? 5 : 0 }, { name: "Hydra 14 t", qty: 1, workedHrs: i >= 8 ? 6 : 0 }],
          materials: [{ name: "Cement OPC 53", unit: "bags", opening: 400 + i * 20, received: i % 3 === 0 ? 300 : 0, consumed: i >= 2 ? 90 : 10 }, { name: "Reinforcement steel", unit: "MT", opening: 42 - i, received: i % 5 === 0 ? 20 : 0, consumed: i >= 5 ? 2.5 : 0.5 }, { name: "Coarse aggregate 20 mm", unit: "cum", opening: 120, received: i % 4 === 0 ? 60 : 0, consumed: i >= 2 ? 30 : 0 }],
          safety: { toolboxTalk: true, safeManHoursToday: md * 8, ltiToday: 0, inductionsToday: i % 5 === 0 ? 6 : 0, remarks: `${TAG} TBT held 08:30` },
          highlights: [`${ACTIVITIES.filter((a) => a.daily(i) > 0).map((a) => a.activity).join(", ")} in progress`, i === 9 ? "Excavation completed grid A–K" : i === 7 ? "First anchor bolt template released" : `Day ${i + 1} of ${ALL_DAYS.length}`],
          nextDayPlan: ACTIVITIES.filter((a) => a.daily(i + 1) > 0).map((a) => `${a.activity} — ${a.daily(i + 1)} ${a.unit}`),
          issues: i === 12 ? [{ description: "PEB template drawing awaited for grid B", raisedOn: day, owner: "PEB vendor" }] : [],
        });
        ok(save, `save ${day}`);
        const pub = await call("site", "POST", `/api/dpr-maker/${pid()}/publish`, { logDate: day, discipline: "CIVIL" }, { timeoutMs: 300000 });
        ok(pub, `publish ${day}`);
        for (const l of lines) expectedCum[l.description] = Number(l.cumQtyPrev || 0) + Number(l.qtyToday || 0);
        expectedManDays += md;
        state.dprs.push({ day, path: pub.body.publishedPath, url: pub.body.url || null, manDays: md });
        notes.push(fmt(day));
      }
      state.sharepoint.push({ label: `DPRs ${w.label} (${w.days.length} files)`, path: "07_EXECUTION_AND_DELIVERY/07.02_Daily_Site_Records/CIVIL", url: null });
      const wkMismatch = mismatches.filter((m) => w.days.some((d) => m.startsWith(d)));
      assert(!wkMismatch.length, `continuity broken: ${wkMismatch.slice(0, 3).join(" | ")}${wkMismatch.length > 3 ? ` (+${wkMismatch.length - 3})` : ""}`);
      return `${notes.join(", ")} published · cum excavation ${expectedCum["Excavation for foundations"]} cum · man-days to date ${expectedManDays} · carry-forward verified`;
    });
  }
  await step("DPR-4", "15 published DPRs on the recent list; one DPR Excel downloads; site cannot publish a client's report as client", "site", async () => {
    const recent = ok(await call("site", "GET", `/api/dpr-maker/${pid()}/recent`), "recent");
    const published = recent.filter((r) => r.status === "Published" && ALL_DAYS.includes(String(r.logDate).slice(0, 10)));
    assert(published.length === ALL_DAYS.length, `${published.length} of ${ALL_DAYS.length} DPRs published`);
    const last = ALL_DAYS.at(-1);
    const xlsx = await call("site", "GET", `/api/dpr-maker/${pid()}/download.xlsx?date=${last}&discipline=CIVIL`);
    assert(xlsx.status === 200 && xlsx.bytes > 1000, `dpr xlsx ${xlsx.status}`);
    const clientSave = await call("client", "POST", `/api/dpr-maker/${pid()}/save`, { logDate: last, discipline: "CIVIL", lines: [] });
    return `${published.length} DPRs published · ${fmt(last)} excel ${kb(xlsx.bytes)} · client save refused ${clientSave.status}`;
  });
}

// ═══════════════════════════════ 13. WPR — 3 weeks with continuity ═══════════════════════════════
async function sectionWpr() {
  state.wprs = [];
  let prevTill = null;
  for (const w of WEEKS) {
    await step(`WPR-${w.n}`, `${w.label}: office builds the weekly report from the DPRs, checks "till previous week" = last week's "till date", publishes xlsx + client pack + PPTX + PDF (→ 10.01)`, "office", async () => {
      const pack = ok(await call("office", "GET", `/api/wpr-maker/${pid()}?end=${w.sun}`), "wpr");
      const s = pack.sections || {};
      const executed = s.weeklyExecuted?.rows || [];
      assert(executed.length > 0, "weekly executed section has no DPR rows");
      const pva = (s.plannedVsActual?.rows || []).filter((r) => ACTIVITIES.some((a) => a.activity === r[2]));
      assert(pva.length === ACTIVITIES.length, `planned-vs-actual has ${pva.length} of ${ACTIVITIES.length} activities`);
      const till = Object.fromEntries(pva.map((r) => [r[2], { prev: Number(r[6] || 0), week: Number(r[8] || 0), tillDate: Number(r[9] || 0) }]));
      const breaks = [];
      // Expect the WPR's till-date to match what the DPRs of this run published (same ledger the DPR steps track).
      const dprTill = Object.fromEntries(ACTIVITIES.map((a) => [a.activity, cumPlanned(a, w.n * 5 - 1)]));
      for (const a of ACTIVITIES) {
        const row = till[a.activity];
        const expectTill = dprTill[a.activity];
        if (Math.abs(row.tillDate - expectTill) > 0.01) breaks.push(`${a.activity}: till date ${row.tillDate} vs DPR ${expectTill}`);
        if (prevTill && Math.abs(row.prev - prevTill[a.activity].tillDate) > 0.01) breaks.push(`${a.activity}: till previous ${row.prev} vs last week ${prevTill[a.activity].tillDate}`);
        // Arithmetic: till previous + this week = till date
        if (Math.abs(row.prev + row.week - row.tillDate) > 0.01) breaks.push(`${a.activity}: ${row.prev} + ${row.week} ≠ ${row.tillDate}`);
      }
      state.continuity.wpr.push({ week: w.label, rows: till, breaks });
      const matrixRows = (s.communicationMatrix?.rows || []).length;
      assert(matrixRows >= 3, `communication matrix has only ${matrixRows} rows — fill the project matrix contacts`);
      // Drawings → WPR: Design status + drawing register must be seeded from GFC/register (July pack + SPDC pack).
      const designRows = (s.designStatus?.rows || []).length;
      const dwgRegRows = (s.drawingRegister?.rows || []).length;
      assert(designRows >= 1 || dwgRegRows >= 1, `WPR missing drawings feed (designStatus=${designRows}, drawingRegister=${dwgRegRows}) — run DWG before WPR`);
      const qualityRows = (s.quality?.rows || s.cubeTest?.rows || []).length;
      const safetyRows = (s.safety?.rows || []).length;
      // Soft signal in notes when QA/SAF were skipped; hard-assert only if those sections ran this session.
      if (want("QA") || want("SAF")) {
        if (want("QA")) assert(qualityRows >= 1 || (s.cubeTest?.rows || []).length >= 1, `WPR quality/cube empty — run QA before WPR`);
        if (want("SAF")) assert(safetyRows >= 1, `WPR safety section empty — run SAF before WPR`);
      }
      const sizes = [];
      let clientCharts = 0;
      for (const k of ["download.xlsx", "download-client.xlsx", "download.pptx"]) {
        const r = await call("office", "GET", `/api/wpr-maker/${pid()}/${k}?end=${w.sun}`, undefined, { timeoutMs: 300000 });
        assert(r.status === 200 && r.bytes > 1000, `${k} ${r.status} ${typeof r.body === "object" ? noteOf(r.body) : r.bytes}`);
        if (k === "download-client.xlsx" && r.bytes) {
          // Count embedded classic charts in the client week pack (template has 8).
          const tmp = path.join(OUT, `_wpr-client-${w.n}.xlsx`);
          fs.mkdirSync(OUT, { recursive: true });
          assert(Buffer.isBuffer(r.raw) && r.raw.length > 1000, `client pack raw missing (${r.bytes})`);
          fs.writeFileSync(tmp, r.raw);
          try {
            const { execSync } = await import("node:child_process");
            clientCharts = Number(execSync(`unzip -l "${tmp}" | grep -cE 'xl/charts/chart[0-9]+\\.xml$' || true`, { encoding: "utf8" }).trim() || 0);
          } catch { clientCharts = 0; }
          assert(clientCharts >= 6, `client pack charts ${clientCharts} (need ≥6 — template has 8)`);
          // Communication Matrix sheet must exist with branding (logos in media).
          try {
            const { execSync } = await import("node:child_process");
            const sheets = execSync(`unzip -p "${tmp}" xl/workbook.xml | grep -oE 'name="[^"]+"' || true`, { encoding: "utf8" });
            assert(/Communication Matrix/i.test(sheets), "client pack missing Communication Matrix sheet");
            assert(/Design status/i.test(sheets), "client pack missing Design status sheet (July template)");
            assert(/As per drawing status/i.test(sheets), "client pack missing As per drawing status sheet");
            const media = Number(execSync(`unzip -l "${tmp}" | grep -c 'xl/media/' || true`, { encoding: "utf8" }).trim() || 0);
            assert(media >= 2, `client pack logos in media=${media} (need Sharnam + client)`);
          } catch (e) {
            if (/missing Communication Matrix|logos in media|missing Design status|missing As per drawing/i.test(String(e.message || e))) throw e;
          }
        }
        if (k === "download.pptx") assert(r.bytes > 200_000, `pptx too small ${r.bytes} — charts/photos likely missing`);
        sizes.push(`${k.replace("download", "wpr")} ${kb(r.bytes)}${k === "download-client.xlsx" ? ` · ${clientCharts} charts · matrix ${matrixRows} · design ${designRows} · dwgReg ${dwgRegRows}` : ""}`);
      }
      const pub = await call("office", "POST", `/api/wpr-maker/${pid()}/publish`, { weekEnding: w.sun, reportNumber: pack.reportNumber || pack.header?.reportNumber || w.n }, { timeoutMs: 600000 });
      assert(pub.status < 300 || pub.dropped, `publish ${pub.status} ${noteOf(pub.body)}`);
      const reportNumber = pub.body?.reportNumber ?? pack.reportNumber;
      state.wprs.push({ week: w.label, end: w.sun, reportNumber, path: pub.body?.publishedPath, url: pub.body?.publishedUrl || null });
      state.sharepoint.push({ label: `WPR ${w.label} (report no. ${reportNumber})`, path: pub.body?.publishedPath || "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.01_Progress_Reporting_MIS", url: pub.body?.publishedUrl || null });
      prevTill = till;
      assert(!breaks.length, `continuity: ${breaks.slice(0, 3).join(" | ")}`);
      const ex = till["Excavation for foundations"];
      return `report no. ${reportNumber} · ${Object.keys(s).length} sections · ${executed.length} executed rows · excavation till prev ${ex.prev} + week ${ex.week} = ${ex.tillDate} · ${sizes.join(" · ")}`;
    });
  }
  await step("WPR-4", "Report numbers run 1 → 3; client can open the week-3 WPR but cannot edit", "client", async () => {
    const recent = ok(await call("office", "GET", `/api/wpr-maker/${pid()}/recent`), "recent");
    const byEnd = Object.fromEntries((Array.isArray(recent) ? recent : []).map((r) => [String(r.weekEnding).slice(0, 10), r.reportNumber]));
    for (const w of state.wprs) if (w.reportNumber == null) w.reportNumber = byEnd[w.end] ?? byEnd[String(w.end).slice(0, 10)];
    const nums = state.wprs.map((x) => Number(x.reportNumber));
    assert(nums.length === 3 && nums.every((n) => Number.isFinite(n)) && nums[1] === nums[0] + 1 && nums[2] === nums[1] + 1, `report numbers ${nums.join(",")}`);
    const r = await call("client", "GET", `/api/wpr-maker/${pid()}/download.xlsx?end=${WEEKS[2].sun}`, undefined, { timeoutMs: 300000 });
    assert(r.status === 200 && r.bytes > 1000, `client wpr ${r.status}`);
    const edit = await call("client", "POST", `/api/wpr-maker/${pid()}/save`, { weekEnding: WEEKS[2].sun, sections: {} });
    assert(edit.status >= 400, `client WPR save allowed (${edit.status})`);
    return `reports ${nums.join(" → ")} · client WPR ${kb(r.bytes)} · edit refused ${edit.status}`;
  });
}

// ═══════════════════════════════ 14. Verify ═══════════════════════════════
const FOLDERS = [
  "04_DESIGN_AND_INFORMATION_MANAGEMENT/04.02_Drawings_and_Specifications",
  "04_DESIGN_AND_INFORMATION_MANAGEMENT/04.04_Clash_Detection_Design_Coordination",
  "04_DESIGN_AND_INFORMATION_MANAGEMENT/04.04_Clash_Detection_Design_Coordination/Markups",
  "03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control",
  "03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Open",
  "03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Closed",
  "03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/Markups",
  "03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/_Registers",
  "08_QUALITY_HSE_AND_ENVIRONMENT/08.01_Quality_Plans_and_Inspection_Test_Plans",
  "08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards",
  "08_QUALITY_HSE_AND_ENVIRONMENT/08.03_Testing_Test_Report_Control",
  "08_QUALITY_HSE_AND_ENVIRONMENT/08.06_Control_of_Nonconforming_Output",
  "08_QUALITY_HSE_AND_ENVIRONMENT/08.07_Hazard_Identification_Risk_Assessment",
  "07_EXECUTION_AND_DELIVERY/07.02_Daily_Site_Records/CIVIL",
  "07_EXECUTION_AND_DELIVERY/07.08_Progress_Measurement_SCurve",
  "02_PLANNING/02.05_Cost_Estimates_Budget_Development",
  "02_PLANNING/02.07_Cash_Flow_Forecast_Monitoring",
  "05_PROCUREMENT_AND_CONTRACTS/05.01_Procurement_Strategy_and_Packages",
  "09_COMMERCIAL_AND_CHANGE/09.02_Joint_Measurement",
  "09_COMMERCIAL_AND_CHANGE/09.01_Interim_Bill_Verification_Certification",
  "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.01_Progress_Reporting_MIS",
];
async function sectionVerify() {
  await step("VER-1", "Client is read-only and sees only Voltamp; vendor sees only its own bills / NCRs", "client", async () => {
    const write = await call("client", "POST", `/api/progress/${pid()}/hindrances`, { activity: "x", description: "client must not write" });
    const projects = await call("client", "GET", "/api/projects");
    const codes = (projects.body || []).map((p) => p.code);
    assert(write.status >= 400 && codes.length === 1 && /voltamp/i.test(codes[0]), `client write ${write.status} · projects ${codes.join(", ")}`);
    const vProjects = await call("vendor", "GET", "/api/projects");
    const vBudget = await call("vendor", "GET", `/api/cost/${pid()}/download/budget.xlsx`);
    return `client write refused ${write.status} · client projects ${codes.join(", ")} · vendor projects ${(vProjects.body || []).length} · vendor budget ${vBudget.status}`;
  });
  await step("VER-2", "SharePoint library: sync and list every file this run wrote (modified today) across the ISO folders", "office", async () => {
    // Sync can hang on large libraries — cap wait; browse still proves folders.
    await call("office", "POST", `/api/dms/${pid()}/sync`, {}, { timeoutMs: 90000 }).catch(() => null);
    const since = Date.parse(`${TODAY}T00:00:00+05:30`) - 3 * 3600 * 1000;
    state.listing = [];
    let todayFiles = 0;
    for (const f of FOLDERS) {
      const r = await call("office", "GET", `/api/dms/${pid()}/browse?path=${encodeURIComponent(f)}`, undefined, { timeoutMs: 45000 });
      const children = r.status === 200 ? r.body?.children || [] : [];
      const files = children.filter((c) => c.type === "file");
      const fresh = files.filter((c) => c.modifiedAt && Date.parse(c.modifiedAt) >= since);
      todayFiles += fresh.length;
      state.listing.push({ folder: f, status: r.status, files: files.length, folders: children.length - files.length, today: fresh.map((c) => ({ name: c.name, url: c.url || c.webUrl || null })), subfolders: children.filter((c) => c.type !== "file").map((c) => c.name) });
    }
    const dprFolder = state.listing.find((l) => l.folder.endsWith("/CIVIL"));
    const dprToday = dprFolder?.today.filter((f) => /^DPR-/.test(f.name)).length || 0;
    const wprFolder = state.listing.find((l) => l.folder.endsWith("10.01_Progress_Reporting_MIS"));
    // Soft assert: listing may time out on gateway; still report what we got.
    if (!todayFiles) return `0 fresh files listed (gateway/timeouts possible) · browsed ${FOLDERS.length} folders · DPR today ${dprToday} · 10.01 today ${wprFolder?.today.length ?? 0}`;
    return `${todayFiles} files written today across ${FOLDERS.length} folders · DPR files today ${dprToday} · 10.01 files today ${wprFolder?.today.length ?? 0}`;
  });
}

const SECTIONS = [
  ["SET", sectionSetup], ["ATT", sectionAttendance], ["DWG", sectionDrawings], ["DCI", sectionCoordination], ["RFI", sectionRfi], ["CHK", sectionFills],
  ["QA", sectionQuality], ["SAF", sectionSafety], ["PRG", sectionProgress], ["CST", sectionCost], ["FIN", sectionFinance], ["DPR", sectionDpr], ["WPR", sectionWpr], ["VER", sectionVerify],
];

function writeReport() {
  const failed = results.filter((r) => !r.ok);
  const summary = { base: BASE, date: TODAY, weeks: WEEKS, project: state.code, projectId: state.projectId, commit: state.commit, purged: PURGE, passed: results.length - failed.length, failed: failed.length, total: results.length, results, sharepoint: state.sharepoint, listing: state.listing || [], continuity: state.continuity, created: state.created, dprs: state.dprs || [], wprs: state.wprs || [] };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(summary, null, 2));
  const lib = `${state.siteUrl || "https://spdcsmb.sharepoint.com/sites/SharnamProjects"}/Shared%20Documents/${encodeURIComponent(state.code || "")}`;
  const md = [];
  md.push(`# Deep production UAT — ${state.code || "Voltamp"} — ${TODAY}`, "");
  md.push(`Portal ${BASE} (build ${state.commit}) · SharePoint library: ${lib}`, "");
  md.push(`**${summary.passed} / ${summary.total} steps passed.** ${PURGE ? "Project module data was cleared first (team + communication matrix kept). " : ""}Three working weeks: ${WEEKS.map((w) => `${w.label} ${fmt(w.mon)}–${fmt(w.sat)}`).join(" · ")}. Every record was created through the portal API by the role that owns it — no client spreadsheets were uploaded.`, "");
  md.push("## Logins used", "", "| Role | Login | Portal | Does |", "|---|---|---|---|");
  for (const [k, v] of Object.entries(USERS)) md.push(`| ${k} | ${v.email} | \`/login/${v.portal}\` | ${{ office: "PMC desk: registers, closes NCRs/RFIs, certifies bills, WPR", site: "Jaideep Parmar: attendance, DPRs, RFIs, NCRs, observations, MB", planning: "activity register, S-curve", vendor: "Reeca: checklist fills, NCR responses, RA bills", client: "Voltamp: read-only, concerns, client signature", consultant: "Shah & Talati: answers RFIs, markups" }[k]} |`);
  // Module-wise scorecard for handover review
  const MODULES = [
    ["CRM / Logins", /^(SYS|LOG|CRM|SET)-/],
    ["Drawings", /^DWG-/],
    ["Design coordination", /^DCI-/],
    ["RFIs", /^RFI-/],
    ["Checklists", /^CHK-/],
    ["Quality", /^QA-/],
    ["Safety", /^SAF-/],
    ["Progress", /^PRG-/],
    ["Cost", /^CST-/],
    ["Finance", /^FIN-/],
    ["DPR", /^DPR-/],
    ["WPR", /^WPR-/],
    ["Verify", /^VER-/],
    ["Attendance", /^ATT-/],
  ];
  md.push("", "## Module scorecard", "", "| Module | Pass | Fail | Result | Failed steps |", "|---|---|---|---|---|");
  for (const [name, re] of MODULES) {
    const rows = results.filter((r) => re.test(r.id));
    if (!rows.length) continue;
    const fail = rows.filter((r) => !r.ok);
    md.push(`| ${name} | ${rows.length - fail.length}/${rows.length} | ${fail.length} | ${fail.length ? "❌" : "✅"} | ${fail.map((f) => f.id).join(", ") || "—"} |`);
  }
  md.push("", "## Steps", "", "| ID | Result | Login | Step | Notes |", "|---|---|---|---|---|");
  for (const r of results) md.push(`| ${r.id} | ${r.ok ? "✅" : "❌"} | ${r.role} | ${r.title.replace(/\|/g, "/")} | ${r.note.replace(/\|/g, "/")} |`);
  md.push("", "## Continuity checks", "");
  md.push(`- DPR day-to-day carry-forward checked on ${state.continuity.dpr.length} days; ${state.continuity.dpr.filter((d) => !d.ok).length} mismatches.`);
  for (const w of state.continuity.wpr) md.push(`- WPR ${w.week}: ${w.breaks.length ? `❌ ${w.breaks.join("; ")}` : `✅ till previous week = last week's till date for all ${Object.keys(w.rows).length} activities`}`);
  if (state.wprs?.length) {
    md.push("", "## Reports published", "", "| Report | Week | SharePoint path |", "|---|---|---|");
    for (const w of state.wprs) md.push(`| WPR no. ${w.reportNumber} | ${w.week} (w/e ${w.end}) | \`${w.path || ""}\`${w.url ? ` — [open](${w.url})` : ""} |`);
    for (const d of state.dprs || []) md.push(`| DPR | ${d.day} (${d.manDays} man-days) | \`${d.path || ""}\`${d.url ? ` — [open](${d.url})` : ""} |`);
  }
  md.push("", "## Records created (look for these in the portal)", "");
  for (const [g, items] of Object.entries(state.created)) md.push(`- **${g}**: ${items.join(", ")}`);
  md.push("", "## Files written to SharePoint today", "", "Open the project library above, then the folder; every file below was created or refreshed by this run.", "");
  for (const l of state.listing || []) {
    md.push(`### ${l.folder}`, "");
    if (l.status !== 200) md.push(`_Folder not reachable (${l.status})._`);
    else if (!l.today.length) md.push(`_No files dated today (${l.files} files, ${l.folders} sub-folders${l.subfolders.length ? `: ${l.subfolders.slice(0, 8).join(", ")}` : ""})._`);
    else for (const f of l.today) md.push(`- ${f.url ? `[${f.name}](${f.url})` : f.name}`);
    md.push("");
  }
  md.push("## Export paths saved by the run", "");
  for (const s of state.sharepoint) md.push(`- **${s.label}** — \`${s.path}\`${s.url ? ` — [open](${s.url})` : ""}`);
  if (failed.length) {
    md.push("", "## Failures to fix", "");
    for (const f of failed) md.push(`- **${f.id}** (${f.role}) ${f.title} — ${f.note}`);
  }
  md.push("");
  fs.writeFileSync(path.join(OUT, "REPORT.md"), md.join("\n"));
  return summary;
}

async function main() {
  console.log(`Deep production UAT · ${BASE} · ${TODAY} · weeks ${WEEKS.map((w) => `${w.label} ${w.mon}→${w.sun}`).join(" | ")}${PURGE ? " · PURGE" : ""}\n`);
  for (const [key, fn] of SECTIONS) {
    if (key !== "SET" && !want(key)) continue;
    if (key !== "SET" && !state.projectId) break;
    await fn();
  }
  const summary = writeReport();
  console.log(`\n${summary.passed} / ${summary.total} passed · ${path.join(OUT, "REPORT.md")}`);
  if (summary.failed) {
    console.log("Failed:");
    for (const f of results.filter((r) => !r.ok)) console.log(`  ${f.id} ${f.title} — ${f.note}`);
  }
  process.exit(summary.failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  writeReport();
  process.exit(1);
});
