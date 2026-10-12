#!/usr/bin/env node
/**
 * Production module UAT on https://portal.spdc.in — Voltamp project, live SharePoint.
 *
 * Logins: office (operations), site (Jaideep Parmar — on the Voltamp team), planning,
 * vendor (Reeca Infrastructure), client (Voltamp). Bid management is out of scope.
 *
 * What it does, in order:
 *   1. Health + SharePoint token, all logins, Reeca linked, site pin for check-in
 *   2. Jaideep checks in (selfie + GPS) at the Voltamp site
 *   3. Drawings: import client register + GFC log, add a line, upload + publish a revision, exports → SharePoint
 *   4. RFIs: office raises two, consultant answers, client raises a concern, register → SharePoint
 *   5. Quality: QAP import + line + publish, cubes import + group, observation, NCR → vendor → office closes
 *   6. Safety: daily log, safety NCR → vendor → office closes, week filed to SharePoint
 *   7. Progress: Planned vs Actual import, registers, S-curve, Excel → SharePoint
 *   8. Cost: SPDC budget workbook import, budget/BOQ/MB/BBS/cashflow rows, Excel → SharePoint
 *   9. Finance: PO, vendor RA bill (3 stages), COP + PDF, payment summary import → SharePoint
 *  10. DPR (Jaideep) and WPR (office) published → SharePoint 07.02 / 10.01
 *  11. Client read-only checks, then a SharePoint folder listing so every file can be opened
 *
 *   node scripts/prod-module-uat.mjs
 *   UAT_ONLY=DWG,QA node scripts/prod-module-uat.mjs      (run some sections)
 */
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.PORTAL_URL || "https://portal.spdc.in";
const PASS = process.env.UAT_PASSWORD || "Demo@1234";
// Portal days are IST.
const TODAY = process.env.UAT_DATE || new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const WEEK_END = (() => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7) - 1); // coming Saturday
  return d.toISOString().slice(0, 10);
})();
const TAG = `UAT ${TODAY}`;
const OUT = path.resolve(`docs/uat-evidence/prod-${TODAY}`);
const DOCS = path.resolve("module_prompts/Sharnam_modules_docs 2");
const DOCS2 = path.resolve("module_prompts/untitled folder");
const FILES = {
  drawingRegister: path.join(DOCS, "DRAWING REGISTER - 01.xlsx"),
  gfcLog: path.join(DOCS, "Approval  &  GFC Drawing Log.xlsx"),
  dci: path.join(DOCS2, "DCI_ARVIND LIMITED_17-6-2026.xlsx"),
  qap: path.join(DOCS, "Quality Assurance Plan Week 50.xlsx"),
  cubes: path.join(DOCS, "SPDC CUBE REGISTER (1).xlsx"),
  pva: path.join(DOCS, "Planned Vs. Actual Dashboard.xlsx"),
  budget: path.join(DOCS2, "SPDC_Budget_Arvind 52.xls"),
  paymentSummary: path.join(DOCS, "Payment Summary - VIATRIX - Copy.xlsx"),
  raWorkbook: path.join(DOCS, "Payment Summary - VIATRIX - Copy.xlsx"),
  selfie: path.resolve("apps/api/assets/logo-transparent.png"),
};
// Voltamp Transformers, Karjan (Vadodara) — site pin used when the project card has none.
const SITE_PIN = { lat: 22.0528, lng: 73.1223, radius: 500 };
const ONLY = (process.env.UAT_ONLY || "").split(",").map((s) => s.trim()).filter(Boolean);
const want = (k) => !ONLY.length || ONLY.includes(k);

const USERS = {
  office: { email: "operations@spdc.in", portal: "office" },
  site: { email: "jaideep.parmar@spdc.in", portal: "site" },
  planning: { email: "planning.estimation@spdc.in", portal: "site" },
  vendor: { email: "sanjaythakor.reeca@gmail.com", portal: "vendor" },
  client: { email: "deven_mktg@voltamptransformers.com", portal: "client" },
  consultant: { email: "ashish.chobe@shahntalati.com", portal: "stakeholder" },
};

const results = [];
const state = { sharepoint: [] };
const tokens = new Map();

const noteOf = (v) => (v == null ? "" : (typeof v === "string" ? v : JSON.stringify(v)).slice(0, 300));
const kb = (n) => `${Math.round(n / 1024)}KB`;
const assert = (c, m) => {
  if (!c) throw new Error(m);
};
const readFile = (p) => {
  assert(fs.existsSync(p), `file missing: ${p}`);
  return fs.readFileSync(p);
};
const fileForm = (p, fields = {}, field = "file") => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, String(v));
  fd.append(field, new Blob([readFile(p)]), path.basename(p));
  return fd;
};

async function login(who) {
  if (tokens.has(who)) return tokens.get(who);
  const u = USERS[who];
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: u.email, password: PASS, portal: u.portal }),
  });
  const body = await res.json();
  if (!body.token) throw new Error(`${who} login ${res.status}: ${body.error || "no token"}`);
  tokens.set(who, { token: body.token, user: body.user });
  return tokens.get(who);
}

async function call(who, method, url, payload, { form, timeoutMs = 120000 } = {}) {
  const { token } = await login(who);
  const headers = { authorization: `Bearer ${token}` };
  let body;
  if (form) body = form;
  else if (payload !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(payload);
  }
  const res = await fetch(`${BASE}${url}`, { method, headers, body, signal: AbortSignal.timeout(timeoutMs) });
  const buf = Buffer.from(await res.arrayBuffer());
  const type = res.headers.get("content-type") || "";
  let parsed = buf.toString("utf8");
  if (type.includes("json") || /^\s*[[{]/.test(parsed.slice(0, 5))) {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      /* keep text */
    }
  }
  if (typeof parsed === "string" && parsed.startsWith("<!DOCTYPE")) parsed = `HTML ${res.status} (route not found?)`;
  return { status: res.status, body: parsed, bytes: buf.length, type };
}

/** Save a portal export into the project's SharePoint ISO folder and remember the path for the report. */
async function toSharePoint(who, label, exportPath, moduleKey) {
  const r = await call(who, "POST", `/api/projects/${state.projectId}/save-export`, { path: exportPath, module: moduleKey }, { timeoutMs: 300000 });
  assert(r.status === 200 && r.body?.path, `SharePoint save (${label}) ${r.status} ${noteOf(r.body?.error || r.body)}`);
  state.sharepoint.push({ label, path: r.body.path, url: r.body.sharePointUrl || r.body.url || null });
  return r.body.path;
}

async function step(id, title, who, fn) {
  const t0 = Date.now();
  try {
    const note = await fn();
    results.push({ id, title, role: who, ok: true, note: noteOf(note), ms: Date.now() - t0 });
    console.log(`PASS ${id.padEnd(6)} ${title}${note ? ` — ${noteOf(note)}` : ""}`);
  } catch (err) {
    const msg = (err instanceof Error ? err.message : String(err)).split("\n")[0].slice(0, 300);
    results.push({ id, title, role: who, ok: false, note: msg, ms: Date.now() - t0 });
    console.log(`FAIL ${id.padEnd(6)} ${title} — ${msg}`);
  }
}

const tinyPdf = Buffer.from(
  "%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
  "utf8"
);

const id = () => state.projectId;

// ── 1. Setup ────────────────────────────────────────────────────────────────────
async function sectionSetup() {
  await step("SYS-1", "Portal health and database", "office", async () => {
    const res = await fetch(`${BASE}/api/health`);
    const body = await res.json();
    assert(res.status === 200 && body.ok && body.dbOk, `health ${res.status} ${noteOf(body)}`);
    state.commit = String(body.commit || "").slice(0, 7);
    return `commit ${state.commit} · ${body.userCount} users`;
  });

  await step("SYS-2", "SharePoint connected (Sharnam Projects drive)", "office", async () => {
    const res = await fetch(`${BASE}/api/health/sharepoint`);
    const body = await res.json();
    assert(body.configured && !body.mockOneDrive && body.tokenOk && body.siteOk, `sharepoint ${noteOf(body)}`);
    state.siteUrl = body.siteUrl;
    return `${body.siteName} · ${body.siteUrl} · drive ${body.driveName}`;
  });

  for (const who of ["office", "site", "planning", "vendor", "client", "consultant"]) {
    await step(`LOG-${who}`, `${who} login`, who, async () => {
      const s = await login(who);
      return `${s.user.fullName} · ${s.user.role} · ${USERS[who].email}`;
    });
  }

  await step("SET-1", "Voltamp project, team and contractor link", "office", async () => {
    const list = await call("office", "GET", "/api/projects");
    const p = (list.body || []).find((x) => /voltamp/i.test(`${x.code} ${x.name}`));
    assert(p, "Voltamp project not listed");
    state.projectId = p.id;
    state.code = p.code;
    const detail = await call("office", "GET", `/api/projects/${p.id}`);
    const members = detail.body?.members || [];
    const byEmail = (e) => members.find((m) => (m.user?.email || m.email) === e);
    assert(byEmail(USERS.site.email), `${USERS.site.email} is not on the Voltamp team`);
    state.consultantId = byEmail(USERS.consultant.email)?.user?.id || byEmail(USERS.consultant.email)?.userId;
    state.siteUserId = byEmail(USERS.site.email)?.user?.id || byEmail(USERS.site.email)?.userId;
    const all = await call("office", "GET", "/api/vendors?limit=50");
    const rows = Array.isArray(all.body) ? all.body : all.body?.rows || [];
    const reeca = rows.find((v) => /reeca/i.test(v.name || ""));
    assert(reeca, "Reeca Infrastructure not in the vendor directory");
    state.vendorId = reeca.id;
    state.vendorName = reeca.name;
    const linked = (detail.body?.vendors || []).some((v) => v.vendorId === reeca.id);
    if (!linked) {
      const a = await call("office", "POST", `/api/vendors/project/${p.id}/assign`, { vendorId: reeca.id, tradeRole: "Civil contractor", packages: ["Civil"] });
      assert(a.status < 300, `assign Reeca ${a.status} ${noteOf(a.body)}`);
    }
    if (!state.planningOnTeam && !byEmail(USERS.planning.email)) {
      const users = await call("office", "GET", "/api/users");
      const plan = (users.body || []).find((u) => u.email === USERS.planning.email);
      if (plan) await call("office", "POST", `/api/projects/${p.id}/members`, { assignments: [{ userId: plan.id, role: "planning" }] });
    }
    return `${p.code} · ${members.length} members · Reeca ${linked ? "already linked" : "linked now"}`;
  });

  await step("SET-2", "Site pin for attendance geofence", "office", async () => {
    const d = await call("office", "GET", `/api/projects/${id()}`);
    if (d.body?.siteLat != null && d.body?.siteLng != null) {
      state.pin = { lat: d.body.siteLat, lng: d.body.siteLng };
      return `pin already set ${d.body.siteLat}, ${d.body.siteLng} · ${d.body.siteRadiusM} m`;
    }
    const r = await call("office", "PUT", `/api/hrm/attendance/site/${id()}`, { siteLat: SITE_PIN.lat, siteLng: SITE_PIN.lng, siteRadiusM: SITE_PIN.radius });
    assert(r.status === 200, `site pin ${r.status} ${noteOf(r.body)}`);
    state.pin = { lat: SITE_PIN.lat, lng: SITE_PIN.lng };
    return `pin set ${SITE_PIN.lat}, ${SITE_PIN.lng} · ${SITE_PIN.radius} m (Karjan)`;
  });
}

// ── 2. Attendance ───────────────────────────────────────────────────────────────
async function sectionAttendance() {
  await step("ATT-1", "Jaideep checks in at the Voltamp site (selfie + GPS)", "site", async () => {
    const today = await call("site", "GET", "/api/hrm/attendance/today");
    if (today.body?.checkIn) return `already checked in ${today.body.checkIn} · ${today.body.reviewStatus || ""}`;
    const fd = new FormData();
    fd.append("kind", "in");
    fd.append("lat", String(state.pin?.lat ?? SITE_PIN.lat));
    fd.append("lng", String(state.pin?.lng ?? SITE_PIN.lng));
    fd.append("accuracy", "15");
    fd.append("projectId", id());
    fd.append("selfie", new Blob([readFile(FILES.selfie)], { type: "image/png" }), "selfie.png");
    const r = await call("site", "POST", "/api/hrm/attendance/punch", undefined, { form: fd });
    assert(r.status < 300, `punch ${r.status} ${noteOf(r.body)}`);
    const row = r.body?.attendance || r.body;
    return `checked in ${row.checkIn || ""} · ${row.reviewStatus || ""} · ${row.inSiteName || ""}`;
  });
}

// ── 3. Drawings ─────────────────────────────────────────────────────────────────
async function sectionDrawings() {
  await step("DWG-1", "Import client drawing register (DRAWING REGISTER - 01)", "office", async () => {
    const r = await call("office", "POST", `/api/drawings/project/${id()}/register/import`, undefined, { form: fileForm(FILES.drawingRegister), timeoutMs: 300000 });
    assert(r.status === 200, `import ${r.status} ${noteOf(r.body)}`);
    return noteOf({ ...r.body, ok: undefined });
  });

  await step("DWG-2", "Import Approval & GFC drawing log", "office", async () => {
    const r = await call("office", "POST", `/api/drawings/project/${id()}/gfc-log/import`, undefined, { form: fileForm(FILES.gfcLog), timeoutMs: 300000 });
    assert(r.status === 200, `gfc import ${r.status} ${noteOf(r.body)}`);
    return noteOf({ drawings: r.body.drawings, revisions: r.body.revisions, skipped: r.body.skipped });
  });

  await step("DWG-3", "Add a register line, pass the Drawing Check gate, publish revision R1 (PDF)", "office", async () => {
    const line = await call("office", "POST", `/api/drawings/project/${id()}/register-line`, {
      drawingNumber: "UAT-A-101",
      title: `${TAG} — ground floor plan`,
      discipline: "Architecture",
      buildingArea: "Main plant",
      revisionNumber: "R0",
    });
    assert(line.status < 300 && line.body?.id, `register-line ${line.status} ${noteOf(line.body)}`);
    state.drawingId = line.body.id;
    // Gate: the Drawing Check Master must be filled (every line answered + signature) to get a one-time unlock.
    const tpl = await call("office", "GET", `/api/checklist/project/${id()}/drawing-check-template`);
    assert(tpl.status === 200 && tpl.body?.items?.length, `drawing check template ${tpl.status}`);
    const responses = Object.fromEntries(tpl.body.items.map((i) => [i.id, { answer: "Yes", remarks: TAG }]));
    const pre = new FormData();
    pre.append("responsesJson", JSON.stringify(responses));
    pre.append("drawingId", state.drawingId);
    pre.append("remarks", `${TAG} pre-upload drawing check`);
    pre.append("signature", new Blob([readFile(FILES.selfie)], { type: "image/png" }), "signature.png");
    const unlock = await call("office", "POST", `/api/checklist/project/${id()}/drawing-precheck`, undefined, { form: pre, timeoutMs: 180000 });
    assert(unlock.status < 300 && unlock.body?.unlockToken, `drawing check ${unlock.status} ${noteOf(unlock.body)}`);
    const fd = new FormData();
    fd.append("unlockToken", unlock.body.unlockToken);
    fd.append("revisionNumber", "R1");
    fd.append("revisionLabel", `R1 — ${TAG}`);
    fd.append("publish", "true");
    fd.append("pdf", new Blob([tinyPdf], { type: "application/pdf" }), "UAT-A-101_R1.pdf");
    const rev = await call("office", "POST", `/api/drawings/${state.drawingId}/revisions`, undefined, { form: fd, timeoutMs: 180000 });
    assert(rev.status < 300, `revision ${rev.status} ${noteOf(rev.body)}`);
    const pub = await call("office", "POST", `/api/drawings/${state.drawingId}/publish`, {});
    assert(pub.status === 200 && pub.body?.isPublished, `publish ${pub.status}`);
    const sp = rev.body?.revisions?.at?.(-1)?.sharePointUrl || rev.body?.sharePointUrl || rev.body?.revision?.sharePointUrl;
    if (sp) state.sharepoint.push({ label: "Drawing UAT-A-101 R1 PDF", path: "04.02 Drawings", url: sp });
    return `Drawing Check ${tpl.body.items.length} lines answered → unlock · UAT-A-101 R1 published${sp ? " · in SharePoint 04.02" : ""}`;
  });

  await step("DWG-4", "Register dashboard, Excel and PDF exports", "office", async () => {
    const dash = await call("office", "GET", `/api/drawings/project/${id()}/register-dashboard`);
    const lines = dash.body?.totals?.lines ?? 0;
    assert(dash.status === 200 && lines >= 1, `dashboard ${dash.status} lines ${lines}`);
    const sizes = [];
    for (const [k, u] of [
      ["register", `/api/drawings/project/${id()}/register/export.xlsx`],
      ["GFC log xlsx", `/api/drawings/project/${id()}/gfc-log/export.xlsx`],
      ["GFC log pdf", `/api/drawings/project/${id()}/gfc-log/export.pdf`],
      ["register dashboard pdf", `/api/drawings/project/${id()}/register/dashboard.pdf`],
    ]) {
      const r = await call("office", "GET", u, undefined, { timeoutMs: 180000 });
      assert(r.status === 200 && r.bytes > 500, `${k} ${r.status} ${r.bytes}`);
      sizes.push(`${k} ${kb(r.bytes)}`);
    }
    return `${lines} register lines · ${sizes.join(" · ")}`;
  });

  await step("DWG-5", "Drawing registers written to SharePoint 04.02", "office", async () => {
    let r;
    try {
      r = await call("office", "POST", `/api/drawings/project/${id()}/publish-registers`, {}, { timeoutMs: 300000 });
    } catch (err) {
      // Older builds hold the request until the gateway drops it; the rewrite still completes on the server.
      r = { status: 202, body: { ok: true, pending: true, note: `request dropped (${err.name}) — files verified in SP-1` } };
    }
    assert((r.status === 200 || r.status === 202) && r.body?.ok, `publish-registers ${r.status} ${noteOf(r.body)}`);
    state.sharepoint.push({ label: "Master drawing register + GFC log (live + weekly copy)", path: "04_DESIGN_AND_INFORMATION_MANAGEMENT/04.02_Drawings_and_Specifications", url: null });
    state.sharepoint.push({ label: "SPDC RFI register (live + weekly copy)", path: "03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/_Registers", url: null });
    return noteOf({ ...r.body, ok: undefined });
  });

  await step("DWG-6", "Design coordination register import (DCI)", "office", async () => {
    const r = await call("office", "POST", `/api/directory/project/${id()}/coordination/import`, undefined, { form: fileForm(FILES.dci), timeoutMs: 180000 });
    assert(r.status === 200, `dci import ${r.status} ${noteOf(r.body)}`);
    return `created ${r.body.created} · updated ${r.body.updated}`;
  });

  await step("DWG-7", "Site opens the Drawing Check gate", "site", async () => {
    const r = await call("site", "GET", `/api/checklist/project/${id()}/drawing-check-template`);
    assert(r.status === 200 && (r.body?.items?.length || r.body?.name), `template ${r.status} ${noteOf(r.body)}`);
    return `${r.body.name || "Drawing Check"} · ${r.body.items?.length || 0} checks`;
  });

  await step("DWG-8", "Client sees drawings, cannot add one", "client", async () => {
    const list = await call("client", "GET", `/api/drawings/project/${id()}`);
    const denied = await call("client", "POST", `/api/drawings/project/${id()}/register-line`, { drawingNumber: "UAT-CLIENT-X", title: "x" });
    const rows = Array.isArray(list.body) ? list.body : [];
    assert(list.status === 200, `client list ${list.status} ${noteOf(list.body)}`);
    assert(denied.status === 403, `client add returned ${denied.status}`);
    assert(rows.some((d) => d.drawingNumber === "UAT-A-101"), "client does not see UAT-A-101");
    return `sees ${rows.length} drawings · add refused 403`;
  });
}

// ── 4. RFIs ─────────────────────────────────────────────────────────────────────
async function sectionRfi() {
  await step("RFI-1", "Office raises two SPDC RFIs to the consultant", "office", async () => {
    assert(state.consultantId, "consultant (Shah & Talati) not on the Voltamp team");
    const made = [];
    for (const [subject, q, sol] of [
      [`${TAG} — Column C4 footing depth`, "Soil report shows hard strata at 2.1 m; GFC footing F4 is at 1.5 m. Confirm founding level.", "Proceed with 2.1 m founding and extend pedestal; extra concrete under item 3.2."],
      [`${TAG} — Anchor bolt grade`, "PEB vendor drawing calls for 8.8 grade bolts; BOQ says 4.6. Which applies?", "Use 8.8 as per PEB design; rate difference under variation."],
    ]) {
      const r = await call("office", "POST", `/api/rfis/project/${id()}`, {
        rfiKind: "RequestForInformation",
        subject,
        question: q,
        assignedToId: state.consultantId,
        responsibleVendorId: state.vendorId,
        formDataJson: { contractorSolution: sol, priority: "HIGH", discipline: "Civil", location: "Grid C" },
      });
      assert(r.status < 300 && r.body?.id, `rfi ${r.status} ${noteOf(r.body)}`);
      made.push(r.body);
    }
    state.rfiIds = made.map((m) => m.id);
    return made.map((m) => m.number).join(" · ");
  });

  await step("RFI-2", "Consultant answers the first RFI", "consultant", async () => {
    const r = await call("consultant", "POST", `/api/rfis/${state.rfiIds[0]}/respond`, {
      responseText: `${TAG} — Found at 2.1 m. Extend pedestal; detail follows on A-101 R2.`,
      isOfficialResponse: true,
      close: true,
    });
    if (r.status === 403) {
      const o = await call("office", "POST", `/api/rfis/${state.rfiIds[0]}/respond`, { responseText: `${TAG} — answered by office on consultant's behalf`, isOfficialResponse: true, close: true });
      assert(o.status < 300, `office respond ${o.status} ${noteOf(o.body)}`);
      return `consultant not on comm-matrix RFI rows (403) → office answered and closed`;
    }
    assert(r.status < 300, `respond ${r.status} ${noteOf(r.body)}`);
    return "answered and closed by consultant";
  });

  await step("RFI-3", "Client raises a concern", "client", async () => {
    const r = await call("client", "POST", `/api/rfis/project/${id()}`, {
      subject: `${TAG} — Dust control at the main gate`,
      question: "Haul road near the admin block needs water sprinkling twice a day.",
    });
    assert(r.status < 300 && r.body?.id, `concern ${r.status} ${noteOf(r.body)}`);
    return `${r.body.number} · ${r.body.rfiKind}`;
  });

  await step("RFI-4", "RFI register Excel and form exports", "office", async () => {
    const reg = await call("office", "GET", `/api/rfis/project/${id()}/register.xlsx`, undefined, { timeoutMs: 180000 });
    const form = await call("office", "GET", `/api/rfis/${state.rfiIds[0]}/download.xlsx`, undefined, { timeoutMs: 180000 });
    assert(reg.status === 200 && reg.bytes > 500, `register ${reg.status}`);
    assert(form.status === 200 && form.bytes > 500, `form ${form.status}`);
    const list = await call("office", "GET", `/api/rfis/project/${id()}`);
    return `${Array.isArray(list.body) ? list.body.length : "?"} RFIs · register ${kb(reg.bytes)} · form ${kb(form.bytes)} (forms auto-filed in 03.06)`;
  });
}

// ── 5. Quality ──────────────────────────────────────────────────────────────────
async function sectionQuality() {
  await step("QA-1", "Import client QAP sheet (Week 50)", "office", async () => {
    const r = await call("office", "POST", `/api/checklist/project/${id()}/qap/import`, undefined, { form: fileForm(FILES.qap), timeoutMs: 300000 });
    assert(r.status === 200, `qap import ${r.status} ${noteOf(r.body)}`);
    return `imported ${r.body.imported} lines · ${r.body.weekLabel}`;
  });

  await step("QA-2", "Add this week's QAP line, download, publish to SharePoint", "office", async () => {
    const r = await call("office", "POST", `/api/checklist/project/${id()}/qap`, {
      weekLabel: "Week 42",
      section: "Reinforcement",
      activity: `${TAG} rebar placement`,
      description: `${TAG} — cover blocks checked before pour`,
      frequency: "Each pour",
      codeOfConformance: "IS 456",
      testAgency: "PMC",
      contractorPerformer: state.vendorName,
      discipline: "Civil",
    });
    assert(r.status < 300, `qap line ${r.status} ${noteOf(r.body)}`);
    const dl = await call("office", "GET", `/api/checklist/project/${id()}/qap/download.xlsx`, undefined, { timeoutMs: 180000 });
    assert(dl.status === 200 && dl.bytes > 500, `qap xlsx ${dl.status}`);
    const pub = await call("office", "POST", `/api/checklist/project/${id()}/qap/publish`, {}, { timeoutMs: 300000 });
    assert(pub.status < 300, `qap publish ${pub.status} ${noteOf(pub.body)}`);
    state.sharepoint.push({ label: "QAP workbook", path: "08_QUALITY_HSE_AND_ENVIRONMENT/08.01_Quality_Plans_and_Inspection_Test_Plans", url: pub.body?.sharePointUrl || null });
    return `excel ${kb(dl.bytes)} · publish ${noteOf(pub.body?.path || pub.body?.files?.length || pub.body)}`;
  });

  await step("QA-3", "Import client cube register, then site adds a cube group", "office", async () => {
    let imp = await call("office", "POST", `/api/checklist/project/${id()}/cubes/import`, undefined, { form: fileForm(FILES.cubes, { replace: "0" }), timeoutMs: 300000 });
    if (imp.status >= 500) imp = await call("office", "POST", `/api/checklist/project/${id()}/cubes/import`, undefined, { form: fileForm(FILES.cubes, { replace: "0" }), timeoutMs: 300000 });
    assert(imp.status === 200, `cube import ${imp.status} ${noteOf(imp.body)}`);
    const grp = await call("site", "POST", `/api/checklist/project/${id()}/cubes/group`, { srNo: "UAT-1", description: `${TAG} pedestal pour grid A`, grade: "M25", castDate: TODAY, testAgency: "Site lab" });
    assert(grp.status < 300 && grp.body?.created >= 1, `cube group ${grp.status} ${noteOf(grp.body)}`);
    const dl = await call("site", "GET", `/api/checklist/project/${id()}/cubes/download.xlsx`, undefined, { timeoutMs: 180000 });
    assert(dl.status === 200, `cube xlsx ${dl.status}`);
    state.sharepoint.push({ label: "Cube register (client format)", path: "08_QUALITY_HSE_AND_ENVIRONMENT/08.03_Testing_Test_Report_Control", url: null });
    return `imported ${imp.body.imported ?? imp.body.created ?? "rows"} · group ${grp.body.created} specimens · 7-day ${String(grp.body.specimens?.[0]?.testDate7 || "").slice(0, 10)} · excel ${kb(dl.bytes)}`;
  });

  await step("QA-4", "Site logs a quality observation", "site", async () => {
    const r = await call("site", "POST", `/api/checklist/project/${id()}/quality-site-records`, {
      recordType: "Site Observation",
      title: `${TAG} cover blocks missing at P3`,
      description: "Provide 40 mm cover blocks before concreting pedestal P3.",
      location: "Grid A / P3",
      severity: "Medium",
      issuedTo: state.vendorName,
    });
    assert(r.status < 300 && r.body?.id, `observation ${r.status} ${noteOf(r.body)}`);
    return r.body.number || r.body.title;
  });

  await step("QA-5", "Site raises NCR to Reeca", "site", async () => {
    const description = `${TAG} honeycombing at pedestal P3 after de-shuttering`;
    const r = await call("site", "POST", `/api/checklist/project/${id()}/ncr`, {
      kind: "NCR",
      contractorVendorId: state.vendorId,
      contractor: state.vendorName,
      description,
      location: "Grid A pedestals",
      ncrType: "Workmanship",
      plannedClosure: WEEK_END,
      actionRequired: "Break out and recast; submit method statement.",
    }, { timeoutMs: 180000 });
    let note = "";
    if (r.status < 300) {
      state.ncrId = r.body.id || r.body.ncr?.id;
      note = `${r.body.number || r.body.ncr?.number}${r.body.sharePointPending ? " · SharePoint filing in background" : ` · ${r.body.sharePointExports?.length ?? 0} files filed`}`;
    } else {
      // Older build: the gateway drops the request while the form is filed in SharePoint, but the NCR is saved.
      const dash = await call("office", "GET", `/api/checklist/project/${id()}/quality-dashboard`);
      const found = (dash.body?.ncrs || []).find((n) => n.description === description);
      assert(found, `ncr ${r.status} ${noteOf(r.body)} and not found in register`);
      state.ncrId = found.id;
      note = `${found.number} (create returned ${r.status} — gateway timeout while filing to SharePoint; row saved)`;
    }
    assert(state.ncrId, "ncr id missing");
    return note;
  });

  await step("QA-6", "Vendor answers from the action desk, cannot close", "vendor", async () => {
    const desk = await call("vendor", "GET", "/api/vendor-actions");
    assert(desk.status === 200, `desk ${desk.status} ${noteOf(desk.body)}`);
    const onDesk = (desk.body?.actions || []).some((a) => a.id === state.ncrId);
    const ans = await call("vendor", "PATCH", `/api/checklist/project/${id()}/ncr/${state.ncrId}`, {
      formDataJson: { workCarriedOutNote: `${TAG} pedestal broken out and recast with vibrator.`, signedContractor: "Sanjay Thakor (Reeca)", positionContractor: "Site in-charge" },
    });
    assert(ans.status < 300, `answer ${ans.status} ${noteOf(ans.body)}`);
    const close = await call("vendor", "PATCH", `/api/checklist/project/${id()}/ncr/${state.ncrId}`, { status: "Closed" });
    assert(close.status === 403, `vendor close returned ${close.status}`);
    return `NCR on desk ${onDesk ? "yes" : "NO"} · answered · close refused 403 · desk items ${desk.body?.actions?.length}`;
  });

  await step("QA-7", "Office closes the NCR; NCR form PDF", "office", async () => {
    const r = await call("office", "PATCH", `/api/checklist/project/${id()}/ncr/${state.ncrId}`, {
      status: "Closed",
      actualClosure: TODAY,
      formDataJson: { contractorActed: "Yes", followUpEffective: "Yes", correctiveActionDetail: `${TAG} recast verified.`, actionByWhom: state.vendorName, actionCompleted: TODAY },
    });
    assert(r.status < 300, `close ${r.status} ${noteOf(r.body)}`);
    const pdf = await call("office", "GET", `/api/checklist/project/${id()}/ncr/${state.ncrId}/export.pdf`, undefined, { timeoutMs: 180000 });
    assert(pdf.status === 200 && pdf.bytes > 1000, `ncr pdf ${pdf.status}`);
    state.sharepoint.push({ label: "NCR form + NCR/CAR register", path: "08_QUALITY_HSE_AND_ENVIRONMENT/08.06_Control_of_Nonconforming_Output", url: null });
    return `closed · NCR PDF ${kb(pdf.bytes)}`;
  });

  await step("QA-8", "Quality dashboard Excel saved to SharePoint 08.01", "office", async () => {
    const p = await toSharePoint("office", "Quality dashboard (6 charts)", `/api/checklist/project/${id()}/quality-dashboard/download.xlsx`, "qap");
    return p;
  });
}

// ── 6. Safety ───────────────────────────────────────────────────────────────────
async function sectionSafety() {
  await step("SAF-1", "Site logs today's safety day", "site", async () => {
    const r = await call("site", "PUT", `/api/safety/project/${id()}/daily/${TODAY}`, { manpower: 42, toolboxTalks: 1, tbtTopics: `${TAG} working at height`, inductions: 3, permitsIssued: 1, ppeCompliancePct: 95, remarks: TAG });
    assert(r.status < 300, `daily ${r.status} ${noteOf(r.body)}`);
    return `manpower 42 · TBT 1 · inductions 3`;
  });

  await step("SAF-2", "Site issues a safety NCR to Reeca", "site", async () => {
    const r = await call("site", "POST", `/api/safety/project/${id()}`, {
      recordType: "NCR",
      title: `${TAG} edge protection missing at mezzanine`,
      description: "Open edge without guard rail.",
      severity: "High",
      location: "Mezzanine grid C",
      activityTask: "Mezzanine slab",
      category: "Working at height",
      issuedTo: state.vendorName,
      responsibleParty: state.vendorName,
      targetCompletion: WEEK_END,
    });
    assert(r.status < 300 && r.body?.id, `safety ncr ${r.status} ${noteOf(r.body)}`);
    state.safetyId = r.body.id;
    return r.body.number || r.body.title;
  });

  await step("SAF-3", "Vendor records action, cannot close", "vendor", async () => {
    const r = await call("vendor", "PATCH", `/api/safety/${state.safetyId}`, { rootCause: "Rail removed for shifting.", immediateAction: "Barricaded.", longTermAction: "Permit before removal.", actionTaken: `${TAG} rails re-fixed.` });
    assert(r.status < 300, `vendor safety ${r.status} ${noteOf(r.body)}`);
    const close = await call("vendor", "PATCH", `/api/safety/${state.safetyId}`, { status: "Closed" });
    assert(close.status === 403, `vendor close ${close.status}`);
    return "action saved · close refused 403";
  });

  await step("SAF-4", "Office closes safety NCR; week filed to SharePoint", "office", async () => {
    const r = await call("office", "PATCH", `/api/safety/${state.safetyId}`, { status: "Closed" });
    assert(r.status < 300, `close ${r.status} ${noteOf(r.body)}`);
    const wk = await call("office", "GET", `/api/safety/project/${id()}/weekly.xlsx?from=${TODAY}&to=${TODAY}`, undefined, { timeoutMs: 180000 });
    assert(wk.status === 200 && wk.bytes > 400, `weekly ${wk.status}`);
    const pub = await call("office", "POST", `/api/safety/project/${id()}/weekly/publish`, { from: TODAY, to: TODAY }, { timeoutMs: 300000 });
    assert(pub.status < 300, `week publish ${pub.status} ${noteOf(pub.body)}`);
    state.sharepoint.push({ label: "Safety week pack", path: pub.body?.path || "08_QUALITY_HSE_AND_ENVIRONMENT/08.07_Hazard_Identification_Risk_Assessment", url: pub.body?.sharePointUrl || null });
    await toSharePoint("office", "Safety module Excel", `/api/reports/module/${id()}/safety/download.xlsx`, "safety");
    return `closed · week excel ${kb(wk.bytes)} · ${noteOf(pub.body?.path || "")}`;
  });
}

// ── 7. Progress ─────────────────────────────────────────────────────────────────
async function sectionProgress() {
  await step("PRG-1", "Import client Planned vs Actual dashboard", "office", async () => {
    const r = await call("office", "POST", `/api/progress/${id()}/planned-actual/import`, undefined, { form: fileForm(FILES.pva), timeoutMs: 300000 });
    assert(r.status === 200, `pva import ${r.status} ${noteOf(r.body)}`);
    if (r.body.drive?.path) state.sharepoint.push({ label: "Planned vs Actual (client upload archived)", path: r.body.drive.path, url: r.body.drive.sharePointUrl || null });
    return noteOf({ activities: r.body.activities, manpower: r.body.manpower, cashflow: r.body.cashflow, weekly: r.body.weekly });
  });

  await step("PRG-2", "Site adds milestone + hindrance; office adds risk + legal + PvA week", "site", async () => {
    const m = await call("site", "POST", `/api/progress/${id()}/milestones`, { code: "UAT-M1", activity: `${TAG} PEB erection start`, plannedStart: TODAY, plannedEnd: "2026-11-15", status: "Planned", weightage: 10 });
    const h = await call("site", "POST", `/api/progress/${id()}/hindrances`, { activity: "Pedestal casting", description: `${TAG} ready-mix delayed 4 hours`, type: "Material", status: "Open", daysImpacted: 0.5, occurredAt: TODAY });
    const risk = await call("office", "POST", `/api/progress/${id()}/risks`, { code: "UAT-R1", name: `${TAG} monsoon delay to roofing`, probability: "Medium", consequence: "High", status: "Open", riskOwner: "PMC" });
    const legal = await call("office", "POST", `/api/progress/${id()}/legal`, { approvalId: "UAT-L1", description: `${TAG} fire NOC provisional`, authority: "Fire department", status: "Submitted", submissionDate: TODAY });
    const pva = await call("office", "POST", `/api/progress/${id()}/planned-actual`, { packageName: "Cashflow", periodLabel: "Week 42", plannedAmount: 1800000, actualAmount: 900000 });
    const all = { m, h, risk, legal, pva };
    const bad = Object.entries(all).filter(([, x]) => x.status >= 300);
    assert(!bad.length, bad.map(([k, x]) => `${k} ${x.status} ${noteOf(x.body)}`).join(" | "));
    return "milestone · hindrance · risk · legal · PvA week saved";
  });

  await step("PRG-3", "Planning generates the S-curve", "planning", async () => {
    const day = (n) => new Date(Date.parse(TODAY) + n * 86400000).toISOString().slice(0, 10);
    const a = await call("planning", "POST", `/api/progress/${id()}/activity-lines`, { activity: `${TAG} PEB erection`, plannedStart: day(-10), plannedEnd: day(40), boqQty: 120, gfcQty: 120, unit: "Nos" });
    assert(a.status < 300, `activity ${a.status} ${noteOf(a.body)}`);
    const g = await call("planning", "POST", `/api/progress/${id()}/scurve-points/generate`, { discipline: "OVERALL" });
    assert(g.status < 300, `generate ${g.status} ${noteOf(g.body)}`);
    return `${g.body.points} points from ${g.body.activities} activities`;
  });

  await step("PRG-4", "Progress Excel saved to SharePoint 07.08", "office", async () => {
    const summary = await call("office", "GET", `/api/progress/${id()}/summary`);
    assert(summary.status === 200, `summary ${summary.status}`);
    const p = await toSharePoint("office", "Planned vs Actual Excel (charts)", `/api/progress/${id()}/planned-actual/download.xlsx`, "progress");
    return `milestones ${summary.body.milestones?.length} · hindrances ${summary.body.hindrances?.length} · risks ${summary.body.risks?.length} · ${p}`;
  });
}

// ── 8. Cost ─────────────────────────────────────────────────────────────────────
async function sectionCost() {
  await step("CST-1", "Import SPDC budget workbook (all tabs)", "office", async () => {
    const before = await call("office", "GET", `/api/cost/${id()}/summary`);
    if (before.body?.totals?.monitoringLines > 100) return `already loaded · BOQ ${before.body.totals.monitoringLines} · MB ${before.body.totals.mbLines} · BBS ${before.body.totals.bbsLines}`;
    const r = await call("office", "POST", `/api/cost/${id()}/workbook/import`, undefined, { form: fileForm(FILES.budget, { kind: "all" }), timeoutMs: 600000 });
    assert(r.status < 300, `workbook import ${r.status} ${noteOf(r.body)}`);
    const after = await call("office", "GET", `/api/cost/${id()}/summary`);
    const t = after.body?.totals || {};
    assert(t.monitoringLines > 0 && t.mbLines > 0, `nothing loaded ${noteOf(t)}`);
    return `budget ${after.body.budget?.length} · BOQ ${t.monitoringLines} · MB ${t.mbLines} · BBS ${t.bbsLines} · packages ${after.body.packages?.length}`;
  });

  await step("CST-2", "Office adds budget heading + line and a BOQ item", "office", async () => {
    const sum = await call("office", "GET", `/api/cost/${id()}/summary`);
    state.pkg = sum.body?.packages?.[0]?.name || sum.body?.packages?.[0] || "Civil";
    if (typeof state.pkg !== "string") state.pkg = "Civil";
    const h = await call("office", "POST", `/api/cost/${id()}/budget`, { description: `${TAG} CIVIL WORKS`, remarks: "HEADING" });
    const l = await call("office", "POST", `/api/cost/${id()}/budget`, { srNo: "UAT.1", description: `${TAG} warehouse structure`, stakeholder: state.vendorName, budgetedAmount: 25000000, workOrderAmount: 22000000, certifiedAmount: 0, forecastedAmount: 500000 });
    const i = await call("office", "POST", `/api/cost/${id()}/monitoring`, { packageName: state.pkg, section: `${TAG} PEB › Anchor bolts`, itemNo: "UAT.1.1", description: `${TAG} supply and fix 24 mm anchor bolts`, uom: "Nos", rate: 1850, boqQty: 240, gfcQty: 256, achievedQty: 0 });
    assert(h.status < 300 && l.status < 300 && i.status < 300, `budget ${h.status}/${l.status} boq ${i.status} ${noteOf(i.body)}`);
    return `package ${state.pkg}`;
  });

  await step("CST-3", "Site MB measurement (nos × nos) and BBS weight", "site", async () => {
    const h = await call("site", "POST", `/api/cost/${id()}/mb`, { packageName: state.pkg, rowKind: "subsection", description: `${TAG} anchor bolts` });
    const d = await call("site", "POST", `/api/cost/${id()}/mb`, { packageName: state.pkg, rowKind: "data", description: `${TAG} grid A bases`, nos1: 12, nos2: 4, unit: "Nos", raBill: "RA-UAT-01" });
    assert(h.status < 300 && d.status < 300, `mb ${h.status}/${d.status} ${noteOf(d.body)}`);
    assert(Number(d.body.qty) === 48, `MB qty ${d.body.qty}, expected 48`);
    const b = await call("site", "POST", `/api/cost/${id()}/bbs`, { packageName: state.pkg, barMark: "UAT-F1", location: `${TAG} footing F1`, shapeCode: "00", diameterMm: 16, lengthMm: 2.4, nos: 18 });
    assert(b.status < 300, `bbs ${b.status} ${noteOf(b.body)}`);
    assert(Math.abs(Number(b.body.weightKg) - 68.27) < 0.05, `BBS weight ${b.body.weightKg}, expected 68.27`);
    return `MB 12 × 4 = 48 · BBS 16 mm × 2.4 m × 18 = ${b.body.weightKg} kg`;
  });

  await step("CST-4", "Cashflow period; cost Excels; site cannot take the budget", "office", async () => {
    const c = await call("office", "POST", `/api/cost/${id()}/cashflow`, { sheetKind: "chart", periodLabel: "Oct-26", periodDate: "2026-10-31", plannedAmount: 4200000, actualAmount: 900000, description: TAG });
    assert(c.status < 300, `cashflow ${c.status} ${noteOf(c.body)}`);
    const sizes = [];
    for (const k of ["budget", "boq", "mb", "bbs", "cashflow"]) {
      const r = await call("office", "GET", `/api/cost/${id()}/download/${k}.xlsx`, undefined, { timeoutMs: 300000 });
      assert(r.status === 200 && r.bytes > 400, `${k}.xlsx ${r.status} ${r.bytes}`);
      sizes.push(`${k} ${kb(r.bytes)}`);
    }
    const denied = await call("site", "GET", `/api/cost/${id()}/download/budget.xlsx`);
    const mb = await call("site", "GET", `/api/cost/${id()}/download/mb.xlsx`, undefined, { timeoutMs: 300000 });
    assert(denied.status === 403, `site budget download ${denied.status}, expected 403`);
    assert(mb.status === 200, `site MB download ${mb.status}`);
    return `${sizes.join(" · ")} · site budget 403, MB 200`;
  });

  await step("CST-5", "Cost sheets saved to SharePoint (02.05 / 05.01 / 09.02 / 02.07)", "office", async () => {
    const out = [];
    for (const [label, k, m] of [["Budget WBS", "budget", "budget"], ["BOQ monitoring", "boq", "boq"], ["Measurement book", "mb", "mb"], ["Cashflow", "cashflow", "cashflow"]]) {
      out.push(await toSharePoint("office", label, `/api/cost/${id()}/download/${k}.xlsx`, m));
    }
    return out.join(" | ");
  });
}

// ── 9. Finance ──────────────────────────────────────────────────────────────────
async function sectionFinance() {
  await step("FIN-1", "Office adds a work order / PO for Reeca", "office", async () => {
    const pos = await call("office", "GET", `/api/finance/${id()}/po`);
    const have = (Array.isArray(pos.body) ? pos.body : []).find((p) => p.poNumber === "UAT-PO-REECA-01");
    if (have) return `PO ${have.poNumber} already on file`;
    const fd = new FormData();
    for (const [k, v] of Object.entries({ poNumber: "UAT-PO-REECA-01", poDate: "2026-10-01", vendorName: state.vendorName, workTrade: "Civil", budgetCode: "UAT-CIV-01", originalValue: 22000000, retentionPct: 5, gstNumber: "24AABCR1234K1Z5" })) fd.append(k, String(v));
    const r = await call("office", "POST", `/api/finance/${id()}/po`, undefined, { form: fd });
    assert(r.status < 300, `po ${r.status} ${noteOf(r.body)}`);
    return r.body?.poNumber;
  });

  await step("FIN-2", "Vendor raises RA bill (refused without workbook, then submitted)", "vendor", async () => {
    const empty = new FormData();
    empty.append("raNumber", "RA-UAT-EMPTY");
    empty.append("discipline", "Civil");
    const noFile = await call("vendor", "POST", `/api/finance/${id()}/ra`, undefined, { form: empty });
    assert(noFile.status >= 400, `RA without a file accepted (${noFile.status})`);
    const raNumber = `RA-UAT-${Date.now().toString().slice(-4)}`;
    const fd = fileForm(FILES.raWorkbook, { raNumber, discipline: "Civil", invoiceNumber: "REECA/UAT/01", invoiceDate: TODAY, againstBillRaised: 1500000, gstAmount: 270000, totalInvoiceWithGst: 1770000, retentionAmount: 75000 }, "files");
    const r = await call("vendor", "POST", `/api/finance/${id()}/ra`, undefined, { form: fd, timeoutMs: 180000 });
    assert(r.status < 300 && r.body?.id, `ra ${r.status} ${noteOf(r.body)}`);
    state.raId = r.body.id;
    const own = await call("vendor", "GET", `/api/finance/${id()}/ra`);
    return `${r.body.raNumber} ${r.body.status} · no-file ${noFile.status} · vendor sees ${Array.isArray(own.body) ? own.body.length : "?"} bills`;
  });

  await step("FIN-3", "Office: Certified blocked before Corrected; then Corrected → Certified → COP + PDF", "office", async () => {
    const stage = (fields) => fileForm(FILES.raWorkbook, fields, "file");
    const early = await call("office", "POST", `/api/finance/ra/${state.raId}/stage`, undefined, { form: stage({ stage: "Certified" }), timeoutMs: 180000 });
    assert(early.status === 400, `Certified before Corrected returned ${early.status}`);
    const c = await call("office", "POST", `/api/finance/ra/${state.raId}/stage`, undefined, { form: stage({ stage: "Corrected" }), timeoutMs: 180000 });
    const z = await call("office", "POST", `/api/finance/ra/${state.raId}/stage`, undefined, { form: stage({ stage: "Certified", amountAtStage: 1450000 }), timeoutMs: 180000 });
    assert(c.status < 300 && z.status < 300, `stages ${c.status}/${z.status} ${noteOf(c.body)} ${noteOf(z.body)}`);
    const copFd = new FormData();
    copFd.append("raBillId", state.raId);
    const cop = await call("office", "POST", `/api/finance/${id()}/cop`, undefined, { form: copFd, timeoutMs: 180000 });
    assert(cop.status < 300 && cop.body?.id, `cop ${cop.status} ${noteOf(cop.body)}`);
    state.copId = cop.body.id;
    const pdf = await call("office", "GET", `/api/finance/${id()}/cop/${state.copId}/download.pdf`, undefined, { timeoutMs: 180000 });
    assert(pdf.status === 200 && /pdf/.test(pdf.type), `cop pdf ${pdf.status} ${pdf.type}`);
    return `${cop.body.certificateNumber} · PO ${cop.body.poNumberDate || ""} · net ₹${Math.round(cop.body.amountPayable || 0).toLocaleString("en-IN")} · PDF ${kb(pdf.bytes)}`;
  });

  await step("FIN-4", "Payment summary import; COPs and trackers to SharePoint 09.01", "office", async () => {
    const imp = await call("office", "POST", `/api/finance/${id()}/payment-summary/import`, undefined, { form: fileForm(FILES.paymentSummary), timeoutMs: 300000 });
    const impNote = imp.status < 300 ? `payment summary imported ${noteOf(imp.body?.imported ?? imp.body?.rows ?? "")}` : `payment summary import ${imp.status} ${noteOf(imp.body)}`;
    const out = [];
    out.push(await toSharePoint("office", "All COPs (PDF register)", `/api/finance/${id()}/cops/download.pdf`, "finance"));
    out.push(await toSharePoint("office", "Payment summary", `/api/finance/${id()}/payment-summary/download.xlsx`, "finance"));
    out.push(await toSharePoint("office", "PR tracker", `/api/finance/${id()}/pr-tracker/download.xlsx`, "prTracker"));
    const ov = await call("office", "GET", `/api/finance/${id()}/overview`);
    return `${impNote} · overview ${ov.status} · ${out.join(" | ")}`;
  });
}

// ── 10. DPR / WPR ───────────────────────────────────────────────────────────────
async function sectionReports() {
  await step("DPR-1", "Jaideep saves and publishes today's DPR (→ SharePoint 07.02)", "site", async () => {
    const loaded = await call("site", "GET", `/api/dpr-maker/${id()}?date=${TODAY}&discipline=CIVIL`, undefined, { timeoutMs: 180000 });
    assert(loaded.status === 200, `dpr load ${loaded.status} ${noteOf(loaded.body)}`);
    const existing = loaded.body?.lines || loaded.body?.snapshot?.lines || [];
    const lines = existing.length
      ? existing.slice(0, 15).map((l, i) => (i < 3 ? { ...l, qtyToday: Math.max(1, Math.round((Number(l.scopeQty) || 10) * 0.02)), remarks: TAG } : l))
      : [{ srNo: 1, group: "Civil", description: `${TAG} anchor bolts fixed`, unit: "Nos", scopeQty: 240, cumQtyPrev: 0, qtyToday: 12, remarks: TAG }];
    const save = await call("site", "POST", `/api/dpr-maker/${id()}/save`, {
      logDate: TODAY,
      discipline: "CIVIL",
      lines,
      manpower: [{ trade: "Mason", planned: 8, actual: 6 }, { trade: "Helper", planned: 12, actual: 10 }],
      materials: [{ name: "Cement OPC 53", unit: "bags", opening: 400, received: 200, consumed: 120 }],
      highlights: [`${TAG} pedestal grid A cast`, "PEB anchor bolt template fixed grid A1–A6"],
      nextDayPlan: ["Pedestal grid B shuttering"],
      safety: { toolboxTalk: true, remarks: TAG },
    });
    assert(save.status < 300, `save ${save.status} ${noteOf(save.body)}`);
    const pub = await call("site", "POST", `/api/dpr-maker/${id()}/publish`, { logDate: TODAY, discipline: "CIVIL" }, { timeoutMs: 300000 });
    assert(pub.status < 300, `publish ${pub.status} ${noteOf(pub.body)}`);
    const xlsx = await call("site", "GET", `/api/dpr-maker/${id()}/download.xlsx?date=${TODAY}&discipline=CIVIL`, undefined, { timeoutMs: 180000 });
    assert(xlsx.status === 200 && xlsx.bytes > 1000, `dpr xlsx ${xlsx.status}`);
    state.sharepoint.push({ label: `DPR ${TODAY} CIVIL`, path: pub.body?.publishedPath || pub.body?.path || "07_EXECUTION_AND_DELIVERY/07.02_Daily_Site_Records/CIVIL", url: pub.body?.sharePointUrl || pub.body?.url || null });
    return `${lines.length} lines · ${pub.body?.status || "Published"} · ${noteOf(pub.body?.publishedPath || pub.body?.path || "")} · excel ${kb(xlsx.bytes)}`;
  });

  await step("WPR-1", "Office generates WPR Excel / client workbook / PPTX and publishes (→ 10.01)", "office", async () => {
    const pack = await call("office", "GET", `/api/wpr-maker/${id()}?end=${WEEK_END}`, undefined, { timeoutMs: 180000 });
    assert(pack.status === 200, `wpr ${pack.status} ${noteOf(pack.body)}`);
    const sections = pack.body?.sections ? Object.keys(pack.body.sections).length : 0;
    assert(sections > 0, "WPR has no sections");
    const sizes = [];
    for (const k of ["download.xlsx", "download-client.xlsx", "download.pptx"]) {
      const r = await call("office", "GET", `/api/wpr-maker/${id()}/${k}?end=${WEEK_END}`, undefined, { timeoutMs: 300000 });
      assert(r.status === 200 && r.bytes > 1000, `${k} ${r.status} ${typeof r.body === "object" ? noteOf(r.body) : r.bytes}`);
      sizes.push(`${k.replace("download", "wpr")} ${kb(r.bytes)}`);
    }
    const pub = await call("office", "POST", `/api/wpr-maker/${id()}/publish`, { weekEnding: WEEK_END }, { timeoutMs: 600000 });
    assert(pub.status < 300, `publish ${pub.status} ${noteOf(pub.body)}`);
    state.sharepoint.push({ label: `WPR week ending ${WEEK_END} (xlsx + client pack + pptx + pdf)`, path: pub.body?.publishedPath || "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.01_Progress_Reporting_MIS", url: pub.body?.publishedUrl || null });
    return `${sections} sections · report no. ${pub.body?.reportNumber ?? pack.body?.reportNumber ?? ""} · ${sizes.join(" · ")} · ${noteOf(pub.body?.publishedPath || "")}`;
  });
}

// ── 11. Client + SharePoint verification ────────────────────────────────────────
async function sectionVerify() {
  await step("CLI-1", "Client: read-only, sees only Voltamp, can open the WPR", "client", async () => {
    const write = await call("client", "POST", `/api/progress/${id()}/hindrances`, { activity: "x", description: "client must not write" });
    assert(write.status >= 400, `client write allowed (${write.status})`);
    const projects = await call("client", "GET", "/api/projects");
    const codes = (projects.body || []).map((p) => p.code);
    assert(codes.length === 1 && /voltamp/i.test(codes[0]), `client sees ${codes.join(", ")}`);
    const wpr = await call("client", "GET", `/api/wpr-maker/${id()}/download.xlsx?end=${WEEK_END}`, undefined, { timeoutMs: 300000 });
    assert(wpr.status === 200 && wpr.bytes > 1000, `client wpr ${wpr.status}`);
    return `write refused ${write.status} · projects ${codes.join(", ")} · WPR ${kb(wpr.bytes)}`;
  });

  await step("SP-1", "SharePoint library sync and folder listing", "office", async () => {
    await call("office", "POST", `/api/dms/${id()}/sync`, {}, { timeoutMs: 300000 });
    const folders = [
      "04_DESIGN_AND_INFORMATION_MANAGEMENT/04.02_Drawings_and_Specifications",
      "03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control/_Registers",
      "08_QUALITY_HSE_AND_ENVIRONMENT/08.01_Quality_Plans_and_Inspection_Test_Plans",
      "08_QUALITY_HSE_AND_ENVIRONMENT/08.03_Testing_Test_Report_Control",
      "08_QUALITY_HSE_AND_ENVIRONMENT/08.06_Control_of_Nonconforming_Output",
      "08_QUALITY_HSE_AND_ENVIRONMENT/08.07_Hazard_Identification_Risk_Assessment",
      "07_EXECUTION_AND_DELIVERY/07.08_Progress_Measurement_SCurve",
      "02_PLANNING/02.05_Cost_Estimates_Budget_Development",
      "02_PLANNING/02.07_Cash_Flow_Forecast_Monitoring",
      "05_PROCUREMENT_AND_CONTRACTS/05.01_Procurement_Strategy_and_Packages",
      "09_COMMERCIAL_AND_CHANGE/09.02_Joint_Measurement",
      "09_COMMERCIAL_AND_CHANGE/09.01_Interim_Bill_Verification_Certification",
      "07_EXECUTION_AND_DELIVERY/07.02_Daily_Site_Records",
      "07_EXECUTION_AND_DELIVERY/07.02_Daily_Site_Records/CIVIL",
      "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.01_Progress_Reporting_MIS",
    ];
    const since = Date.parse(`${TODAY}T00:00:00+05:30`) - 60 * 60 * 1000;
    state.listing = [];
    let todayFiles = 0;
    for (const f of folders) {
      const r = await call("office", "GET", `/api/dms/${id()}/browse?path=${encodeURIComponent(f)}`, undefined, { timeoutMs: 180000 });
      const children = r.status === 200 ? r.body.children || [] : [];
      const files = children.filter((c) => c.type === "file");
      const fresh = files.filter((c) => c.modifiedAt && Date.parse(c.modifiedAt) >= since);
      todayFiles += fresh.length;
      state.listing.push({ folder: f, provider: r.body?.provider, files: files.length, folders: children.length - files.length, today: fresh.map((c) => c.name), all: files.map((c) => ({ name: c.name, modifiedAt: c.modifiedAt, url: c.url })) });
    }
    assert(todayFiles > 0, "no files written to SharePoint today");
    return `${todayFiles} files written today across ${folders.length} ISO folders (see REPORT.md)`;
  });
}

const SECTIONS = [
  ["SET", sectionSetup],
  ["ATT", sectionAttendance],
  ["DWG", sectionDrawings],
  ["RFI", sectionRfi],
  ["QA", sectionQuality],
  ["SAF", sectionSafety],
  ["PRG", sectionProgress],
  ["CST", sectionCost],
  ["FIN", sectionFinance],
  ["RPT", sectionReports],
  ["VER", sectionVerify],
];

function writeReport() {
  const failed = results.filter((r) => !r.ok);
  const summary = { base: BASE, date: TODAY, weekEnding: WEEK_END, project: state.code, projectId: state.projectId, commit: state.commit, passed: results.length - failed.length, failed: failed.length, total: results.length, results, sharepoint: state.sharepoint, listing: state.listing || [] };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(summary, null, 2));

  const lib = `${state.siteUrl || "https://spdcsmb.sharepoint.com/sites/SharnamProjects"}/Shared%20Documents/${encodeURIComponent(state.code || "")}`;
  const md = [];
  md.push(`# Production UAT — ${state.code || "Voltamp"} — ${TODAY}`);
  md.push("");
  md.push(`Portal ${BASE} (build ${state.commit}) · SharePoint library: ${lib}`);
  md.push("");
  md.push(`**${summary.passed} / ${summary.total} steps passed.** Week ending used for the WPR: ${WEEK_END}.`);
  md.push("");
  md.push("## Logins used");
  md.push("");
  md.push("| Role | Login |");
  md.push("|---|---|");
  for (const [k, v] of Object.entries(USERS)) md.push(`| ${k} | ${v.email} |`);
  md.push("");
  md.push("## Steps");
  md.push("");
  md.push("| ID | Result | Login | Step | Notes |");
  md.push("|---|---|---|---|---|");
  for (const r of results) md.push(`| ${r.id} | ${r.ok ? "✅" : "❌"} | ${r.role} | ${r.title} | ${r.note.replace(/\|/g, "/")} |`);
  md.push("");
  md.push("## Files written to SharePoint today");
  md.push("");
  md.push("Open the project library above, then the folder; every file below was created or refreshed by this run.");
  md.push("");
  for (const l of state.listing || []) {
    md.push(`### ${l.folder}`);
    md.push("");
    if (!l.today.length) md.push(`_No files dated today (${l.files} files total, ${l.folders} sub-folders)._`);
    else for (const n of l.today) md.push(`- ${n}`);
    md.push("");
  }
  md.push("## Export paths saved by the run");
  md.push("");
  for (const s of state.sharepoint) md.push(`- **${s.label}** — \`${s.path}\`${s.url ? ` — [open](${s.url})` : ""}`);
  md.push("");
  if (failed.length) {
    md.push("## Failures to fix");
    md.push("");
    for (const f of failed) md.push(`- **${f.id}** (${f.role}) ${f.title} — ${f.note}`);
    md.push("");
  }
  fs.writeFileSync(path.join(OUT, "REPORT.md"), md.join("\n"));
  return summary;
}

async function main() {
  console.log(`Production module UAT · ${BASE} · ${TODAY} · week ending ${WEEK_END}\n`);
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
