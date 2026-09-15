#!/usr/bin/env node
/**
 * Live portal UAT run-through — deploy check, HRMS seed purge, module sanity, CRM/HRMS URLs.
 *
 *   node scripts/live-uat-runthrough.mjs
 */
const BASE = process.env.PORTAL_URL || "https://portal.spdc.in";
const EMAIL = process.env.UAT_EMAIL || "operations@spdc.in";
const PASS = process.env.UAT_PASS || "Demo@1234";
const VOLTAMP_CODE = "SHAR/SNT/26-27/Voltamp Transformers Ltd.";

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function login() {
  const r = await req("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASS, portal: "office" }),
  });
  if (!r.body?.token) throw new Error(`Login failed: ${JSON.stringify(r.body)}`);
  return r.body.token;
}

function hdr(token) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  SHARNAM LIVE UAT RUN-THROUGH");
  console.log("  Portal:", BASE);
  console.log("═══════════════════════════════════════════════════════\n");

  const health = await req("/api/health");
  const commit = health.body?.commit?.slice(0, 7) || "?";
  console.log("1) Deploy check");
  console.log("   commit:", commit, "| dbOk:", health.body?.dbOk, "| users:", health.body?.userCount);

  const token = await login();
  const h = hdr(token);

  console.log("\n2) HRMS seed purge");
  const purge = await req("/api/hrm/purge-seed-data", { method: "POST", headers: h, body: "{}" });
  if (purge.status === 404) {
    console.log("   ⚠ purge-seed-data not deployed yet — redeploy main, then re-run this script.");
  } else if (purge.status !== 200) {
    console.log("   ✗ purge failed", purge.status, purge.body?.error || purge.body);
  } else {
    console.log("   ✓ removed logins:", purge.body.loginsRemoved);
    console.log("     candidates:", purge.body.candidates, "| offers:", purge.body.offers);
    console.log("     requisitions:", purge.body.requisitions, "| hrms docs:", purge.body.hrmsDocuments);
    console.log("     leave rows:", purge.body.leaveRequests);
  }

  const projects = await req("/api/projects", { headers: h });
  const voltamp = (projects.body || []).find((p) => p.code === VOLTAMP_CODE);
  console.log("\n3) Voltamp module canvas");
  if (!voltamp) {
    console.log("   Voltamp project not found");
  } else {
    const reg = await req(`/api/drawings/project/${voltamp.id}/register-dashboard`, { headers: h });
    const lines = reg.body?.totals?.lines ?? reg.body?.lines?.length ?? 0;
    const bids = await req(`/api/crm/bid-packages?projectId=${voltamp.id}`, { headers: h });
    const bidCount = Array.isArray(bids.body) ? bids.body.length : 0;
    console.log("   drawing register lines:", lines, "| bid packages:", bidCount);
    console.log("   project home:", `${BASE}/projects/${voltamp.id}`);
  }

  console.log("\n4) CRM + HRMS browser walk (manual checklist)");
  console.log("   Office login:", EMAIL, "/", PASS);
  console.log("   ─ HRMS desk");
  console.log("     •", `${BASE}/hrm/users - confirm no @sharnam.demo rows`);
  console.log("     •", `${BASE}/hrm/recruitment - empty or your fresh requisition`);
  console.log("     •", `${BASE}/hrm/onboarding - no Riya Shah FLOW demo`);
  console.log("   ─ CRM desk");
  console.log("     •", `${BASE}/crm/setup - pick project, tick work packages only`);
  console.log("     •", `${BASE}/crm/bids - new bid flow (Overview / Comparative / Matrix / Manage)`);
  console.log("   ─ Project modules (Voltamp empty until you load templates)");
  if (voltamp) {
    console.log("     • Drawings:", `${BASE}/projects/${voltamp.id}/drawings/register`);
    console.log("     • Cost:", `${BASE}/projects/${voltamp.id}/cost`);
    console.log("     • Quality QAP:", `${BASE}/projects/${voltamp.id}/qap`);
  }
  console.log("\n5) Optional API UAT (creates Sanika + Direct test projects — skips Voltamp)");
  console.log("   node scripts/live-two-project-uat.mjs");

  const docs = await req("/api/hrm/hrms-documents", { headers: h });
  const cands = await req("/api/hrm/candidates", { headers: h });
  console.log("\n6) HRMS state after purge");
  console.log("   appointment/promotion letters:", (docs.body || []).length);
  for (const d of (docs.body || []).slice(0, 5)) console.log("     ·", d.refNo, d.employeeName);
  console.log("   candidates:", (cands.body || []).length);

  console.log("\nDONE — complete steps in section 4 in the browser.");
}

main().catch((e) => {
  console.error("UAT run-through failed:", e.message || e);
  process.exit(1);
});
