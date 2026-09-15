#!/usr/bin/env node
/** Live end-to-end API walk — CRM bids, packages, HRMS letter regenerate */
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

async function main() {
  const login = await req("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASS, portal: "office" }),
  });
  if (!login.body?.token) throw new Error("login failed");
  const h = { Authorization: `Bearer ${login.body.token}`, "Content-Type": "application/json" };

  const projects = await req("/api/projects", { headers: h });
  const proj = projects.body?.[0];
  if (!proj) throw new Error("no project");
  console.log("PROJECT", proj.code, proj.id);

  const pkgSave = await req(`/api/projects/${proj.id}/settings`, {
    method: "PATCH",
    headers: h,
    body: JSON.stringify({ workPackages: PACKAGES }),
  });
  console.log("SAVE PACKAGES", pkgSave.status, pkgSave.body?.workPackages ? "ok" : pkgSave.body);

  const disc = await req(`/api/projects/${proj.id}/bid-disciplines`, { headers: h });
  console.log("BID DISCIPLINES source", disc.body?.source, "count", disc.body?.disciplines?.length);
  console.log(" labels:", disc.body?.disciplines?.map((d) => d.label).join(" | "));

  const docs = await req("/api/hrm/hrms-documents?kind=Appointment", { headers: h });
  const ravi = (docs.body || []).find((d) => d.refNo?.includes("7431"));
  if (ravi) {
    const regen = await req(`/api/hrm/hrms-documents/${ravi.id}/generate`, { method: "POST", headers: h, body: "{}" });
    console.log("REGEN RAVI LETTER", regen.status, regen.body?.generatedDocxUrl?.slice(-20), "xlsx-annex", regen.body?.dataJson?.includes("annexureXlsxUrl"));
  }

  const vendors = await req("/api/vendors?limit=5", { headers: h });
  const vendorList = Array.isArray(vendors.body) ? vendors.body : vendors.body?.rows || [];
  const vendor = vendorList.find((v) => v.email) || vendorList[0];
  if (vendor) {
    const keys = (disc.body?.disciplines || []).slice(0, 3).map((d) => d.key);
    const bid = await req("/api/crm/bid-packages", {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        projectId: proj.id,
        title: `UAT Bid — ${proj.code}`,
        disciplineKeys: keys.length ? keys : ["CCV", "ELE_LAB", "ADMIN"],
        vendorIds: [vendor.id],
      }),
    });
    console.log("CREATE BID", bid.status, bid.body?.id || bid.body?.error);
  }

  const bids = await req(`/api/crm/bid-packages?projectId=${proj.id}`, { headers: h });
  console.log("BID PACKAGES NOW", Array.isArray(bids.body) ? bids.body.length : bids.body);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
