/**
 * New-project UAT with screenshot evidence — see docs/UAT_EVIDENCE_PLAN.md for the IDs.
 *   node scripts/uat-evidence/run.mjs            (UAT_BASE=http://localhost:4555 by default)
 * Creates SPDC-UAT-01 (or reuses it), then works through every module as office, site, vendor and client.
 */
import fs from "node:fs";
import path from "node:path";
import { BASE, OUT, call, evidence, finish, open, step } from "./lib.mjs";

const OFFICE = "operations@spdc.in";
const SITE = "hitesh.rajput@spdc.in";
const PLANNING = "planning.estimation@spdc.in";
const VENDOR = "site@bhavanainfra.demo";
const CLIENT = "projects@arvind.demo";
const CODE = process.env.UAT_PROJECT || "SPDC-UAT-01";
const today = new Date().toISOString().slice(0, 10);
const only = (process.env.UAT_ONLY || "").split(",").filter(Boolean);
const want = (section) => !only.length || only.includes(section);
const state = {};
const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

async function projectId() {
  if (state.projectId) return state.projectId;
  const list = await call(OFFICE, "GET", "/api/projects");
  const p = (list.body || []).find((x) => x.code === CODE);
  if (p) state.projectId = p.id;
  return state.projectId;
}

// ── A. Project setup ────────────────────────────────────────────────────────────────────────────
async function sectionA() {
  await step("A1", "New project created", OFFICE, async (page) => {
    if (!(await projectId())) {
      state.createdNow = true;
      await open(page, "/crm/setup");
      await page.getByPlaceholder("Project code").fill(CODE);
      await page.getByPlaceholder("Project name").fill("UAT Warehouse — Sanand");
      await page.getByPlaceholder("Site / city").fill("Sanand, Ahmedabad");
      await page.getByPlaceholder("PMC name").fill("SPDC");
      await page.locator('form button[type="submit"]').first().click();
      await page.waitForTimeout(2500);
    }
    ok(await projectId(), "project not created");
    await open(page, `/projects/${await projectId()}`);
    await evidence("A1", "New project created", OFFICE, page);
  });

  await step("A2", "Team vendor and client assigned", OFFICE, async (page) => {
    const id = await projectId();
    const users = (await call(OFFICE, "GET", "/api/users")).body;
    const byEmail = (e) => (Array.isArray(users) ? users : users.users || []).find((u) => u.email === e)?.id;
    const assignments = [SITE, PLANNING].map((e) => ({ userId: byEmail(e) })).filter((a) => a.userId);
    const m = await call(OFFICE, "POST", `/api/projects/${id}/members`, { assignments });
    ok(m.status < 300, `members ${m.status} ${JSON.stringify(m.body).slice(0, 120)}`);
    const v = await call(OFFICE, "POST", `/api/vendors/project/${id}/assign`, {
      vendorId: (await call(OFFICE, "GET", "/api/vendors")).body.find((x) => x.name === "Bhavana Infra")?.id,
      tradeRole: "Civil contractor",
      packages: ["Civil", "MEP"],
    });
    ok(v.status < 300, `vendor assign ${v.status} ${JSON.stringify(v.body).slice(0, 120)}`);
    // Client: the project card's client company + login email links the client portal to this project.
    // A running project (Arvind) keeps its own card — only a project created by this run is filled in.
    const c = !state.createdNow ? { status: 200, body: {} } : await call(OFFICE, "PATCH", `/api/projects/${id}/settings`, {
      clientName: "Arvind Limited",
      clientEmail: CLIENT,
      clientContactName: "Arvind projects team",
      startDate: today,
      endDate: new Date(Date.now() + 240 * 86400000).toISOString().slice(0, 10),
    });
    ok(c.status < 300, `client link ${c.status} ${JSON.stringify(c.body).slice(0, 120)}`);
    await open(page, `/projects/${id}/setup`);
    await evidence("A2", "Team vendor and client assigned", OFFICE, page, { full: true });
  });

  // Site staff clock in (selfie + GPS at the site) before the project tools open for them.
  for (const [sid, who] of [["A3", SITE], ["A3b", PLANNING]]) {
    await step(sid, "Site check-in selfie and GPS", who, async (page) => {
      const id = await projectId();
      const today0 = await call(who, "GET", "/api/hrm/attendance/today");
      if (!today0.body?.checkIn) {
        const fd = new FormData();
        fd.append("kind", "in");
        fd.append("lat", "22.9915");
        fd.append("lng", "72.3836");
        fd.append("accuracy", "12");
        fd.append("projectId", id);
        fd.append("selfie", new Blob([fs.readFileSync(path.resolve("apps/api/assets/logo-transparent.png"))], { type: "image/png" }), "selfie.png");
        const r = await call(who, "POST", "/api/hrm/attendance/punch", undefined, { form: fd });
        ok(r.status < 300, `punch ${r.status} ${JSON.stringify(r.body).slice(0, 160)}`);
      }
      await open(page, "/attendance");
      await evidence(sid, "Site check-in selfie and GPS", who, page);
    });
  }
}

const sections = { A: sectionA };
const extra = await import("./sections.mjs").catch(() => ({}));
Object.assign(sections, extra.sections || {});
for (const [k, fn] of Object.entries(sections)) if (want(k)) await fn({ state, projectId, today, ok, users: { OFFICE, SITE, PLANNING, VENDOR, CLIENT } });
const failed = await finish();
fs.writeFileSync(path.join(OUT, "state.json"), JSON.stringify(state, null, 2));
console.log(`base ${BASE} · evidence in ${OUT}`);
process.exit(failed ? 1 : 0);
