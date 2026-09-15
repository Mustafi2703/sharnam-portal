#!/usr/bin/env node
/**
 * Two-project UAT on portal.spdc.in — does NOT touch Voltamp.
 * A) Sanika cold storage — CRM award + setup + bid + comparative
 * B) Direct project setup — packages + bid + comparative
 * C) HRMS onboarding smoke
 */
const BASE = process.env.PORTAL_URL || "https://portal.spdc.in";
const EMAIL = process.env.UAT_EMAIL || "operations@spdc.in";
const PASS = process.env.UAT_PASS || "Demo@1234";

const PACKAGES = [
  "Civil & Structural (CCV)",
  "Electrical Lab",
  "Admin Building",
  "Security",
  "Cooling Tower",
  "Weigh Bridge",
  "U.G Tank + Pump Room",
  "Entrance Gate",
];

const DISC_KEYS = ["CCV", "ELE_LAB", "ADMIN", "SECURITY", "COOLING_TOWER", "WEIGH_BRIDGE", "UG_TANK", "ENTRANCE_GATE"];

async function login() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASS, portal: "office" }),
  });
  const body = await r.json();
  if (!body.token) throw new Error(`Login failed: ${body.error || r.status}`);
  return body.token;
}

function hdr(token) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function j(path, token, opts = {}) {
  const r = await fetch(`${BASE}${path}`, { ...opts, headers: { ...hdr(token), ...(opts.headers || {}) } });
  const text = await r.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: r.status, body };
}

async function ensureSanikaProject(token) {
  const quotes = await j("/api/crm/quotations", token);
  const sanika = (quotes.body || []).find((q) => q.quotationNo === "SPDC/26-27/INQ/79");
  if (!sanika) throw new Error("Sanika quotation not found");

  const award = await j(`/api/crm/quotations/${sanika.id}/award`, { method: "POST", token, body: "{}" });
  let project = award.body?.project;
  let projectId = award.body?.projectId || sanika.awardedProjectId;

  if (!project && projectId) {
    const p = await j(`/api/projects/${projectId}`, token);
    project = p.body?.id ? p.body : null;
  }

  if (!project) {
    const created = await j("/api/projects", token, {
      method: "POST",
      body: JSON.stringify({
        code: "SPDC-530-SANIKA",
        name: "Sanika Agrotech Cold Storage Unit, Kanadwadi",
        clientName: sanika.clientName,
        clientAddress: sanika.clientAddress || "Kanadwadi, Miraj, Sangli",
        location: "Kanadwadi, Miraj, Sangli, Maharashtra",
        status: "Planning",
        workPackages: PACKAGES,
      }),
    });
    if (!created.body?.id) throw new Error(`Sanika project create failed: ${JSON.stringify(created.body)}`);
    project = created.body;
    projectId = project.id;
    console.log("  Sanika: created Planning project (orphan award recovery)", project.code);
  } else {
    console.log("  Sanika: using project", project.code, project.status);
    await j(`/api/projects/${projectId}/settings`, token, {
      method: "PATCH",
      body: JSON.stringify({ workPackages: PACKAGES }),
    });
  }
  return { project, sanikaId: sanika.id };
}

async function ensureDirectProject(token) {
  const code = "SPDC-UAT-DIRECT-01";
  const list = await j("/api/projects", token);
  let project = (list.body || []).find((p) => p.code === code);
  if (!project) {
    const created = await j("/api/projects", token, {
      method: "POST",
      body: JSON.stringify({
        code,
        name: "UAT Direct Setup — Cold Storage BOQ Test",
        clientName: "SPDC Internal UAT",
        location: "Vadodara",
        status: "Planning",
        workPackages: PACKAGES,
      }),
    });
    if (!created.body?.id) throw new Error(`Direct project failed: ${JSON.stringify(created.body)}`);
    project = created.body;
    console.log("  Direct: created", project.code);
  } else {
    console.log("  Direct: reusing", project.code);
    await j(`/api/projects/${project.id}/settings`, token, {
      method: "PATCH",
      body: JSON.stringify({ workPackages: PACKAGES }),
    });
  }
  return project;
}

async function setupBid(token, project, label) {
  const vendors = await j("/api/vendors?limit=30", token);
  const list = Array.isArray(vendors.body) ? vendors.body : vendors.body?.rows || [];
  const picks = list.filter((v) => v.name && !/voltamp/i.test(v.name)).slice(0, 3);
  if (picks.length < 2) throw new Error("Need at least 2 vendors for comparative test");
  const vendorNames = picks.map((v) => v.name);

  const existing = await j(`/api/crm/bid-packages?projectId=${project.id}`, token);
  let pkg = (existing.body || []).find((b) => b.title?.includes(label));
  if (!pkg) {
    const created = await j("/api/crm/bid-packages", token, {
      method: "POST",
      body: JSON.stringify({
        projectId: project.id,
        title: `${label} — R2 Comparative`,
        revisionLabel: "R2",
        vendorNames,
        disciplineKeys: DISC_KEYS,
      }),
    });
    if (!created.body?.id && !created.body?.package?.id) {
      throw new Error(`Bid create failed: ${JSON.stringify(created.body)}`);
    }
    pkg = created.body.package || created.body;
    console.log(`  Bid created: ${pkg.title} (${pkg.vendorBoqs?.length || "?"} slots)`);
  } else {
    console.log(`  Bid exists: ${pkg.title}`);
  }

  const pkgId = pkg.id;
  const seed = await j(`/api/crm/bid-packages/${pkgId}/seed-r2-boqs`, token, {
    method: "POST",
    body: JSON.stringify({ force: true }),
  });
  console.log(`  Seed R2 BOQs: ${seed.status}`, seed.body?.uploaded, "/", seed.body?.total);

  const recompute = await j(`/api/crm/bid-packages/${pkgId}/recompute`, token, { method: "POST", body: "{}" });
  console.log(`  Recompute comparative: ${recompute.status}`, recompute.body?.summary?.lowestVendor || recompute.body?.filledSlots);

  const detail = await j(`/api/crm/bid-packages/${pkgId}`, token);
  const slot = detail.body?.vendorBoqs?.[0];
  if (slot?.id) {
    const sheet = await j(`/api/crm/bid-packages/${pkgId}/vendor-boq/${slot.id}/sheet`, token);
    const headers = sheet.body?.headers || [];
    console.log(`  BOQ columns (${slot.discipline}):`, headers.slice(0, 6).join(" | "));
  }
  return pkgId;
}

async function hrmsOnboardingSmoke(token) {
  const candidates = await j("/api/hrm/candidates", token);
  const list = Array.isArray(candidates.body) ? candidates.body : [];
  const testEmail = "uat.onboard.test@spdc.in";
  let cand = list.find((c) => c.email === testEmail);
  if (!cand) {
    const created = await j("/api/hrm/candidates", token, {
      method: "POST",
      body: JSON.stringify({
        fullName: "UAT Onboard Test",
        email: testEmail,
        phone: "9999900001",
        location: "Vadodara",
      }),
    });
    cand = created.body;
    console.log("  Created candidate", cand?.fullName);
  }
  if (!cand?.id) return;

  const offers = await j("/api/hrm/offers", token);
  let offer = (offers.body || []).find((o) => o.candidateId === cand.id);
  if (!offer) {
    const created = await j("/api/hrm/offers", token, {
      method: "POST",
      body: JSON.stringify({
        candidateId: cand.id,
        designation: "Site Engineer",
        department: "Site",
        ctcAnnual: 600000,
        joiningDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        location: "SPDC Corporate Office, Vadodara",
      }),
    });
    offer = created.body;
    console.log("  Created offer", offer?.offerNo);
  }

  if (offer?.id && offer.status === "Draft") {
    await j(`/api/hrm/offers/${offer.id}/status`, token, {
      method: "PATCH",
      body: JSON.stringify({ status: "Accepted" }),
    });
  }
  console.log("  HRMS onboarding path ready — complete pre-join in UI for", testEmail);
}

async function main() {
  const health = await j("/api/health");
  console.log("PORTAL", BASE, "commit", health.body?.commit?.slice(0, 7));

  const token = await login();
  console.log("\n=== A) CRM AWARD PROJECT (Sanika) — not Voltamp ===");
  const { project: sanika } = await ensureSanikaProject(token);
  const discA = await j(`/api/projects/${sanika.id}/bid-disciplines`, token);
  console.log("  Packages/disciplines:", discA.body?.workPackages?.length, discA.body?.disciplines?.length);
  await setupBid(token, sanika, "Sanika UAT");

  console.log("\n=== B) DIRECT PROJECT SETUP — not Voltamp ===");
  const direct = await ensureDirectProject(token);
  const discB = await j(`/api/projects/${direct.id}/bid-disciplines`, token);
  console.log("  Packages/disciplines:", discB.body?.workPackages?.length, discB.body?.disciplines?.length);
  await setupBid(token, direct, "Direct UAT");

  console.log("\n=== C) HRMS ONBOARDING SMOKE ===");
  await hrmsOnboardingSmoke(token);

  console.log("\nDONE — Voltamp untouched. Test in browser:");
  console.log("  CRM setup:", `${BASE}/crm/setup?projectId=${sanika.id}`);
  console.log("  Direct setup:", `${BASE}/crm/setup?projectId=${direct.id}`);
  console.log("  Bid compare:", `${BASE}/crm/bids`);
  console.log("  HRMS onboarding:", `${BASE}/hrm/onboarding`);
}

main().catch((e) => {
  console.error("UAT FAILED:", e.message || e);
  process.exit(1);
});
