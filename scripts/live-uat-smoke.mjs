#!/usr/bin/env node
/** Live smoke test — portal.spdc.in CRM / bids / HRMS */
const BASE = process.env.PORTAL_URL || "https://portal.spdc.in";
const EMAIL = process.env.UAT_EMAIL || "operations@spdc.in";
const PASS = process.env.UAT_PASS || "Demo@1234";

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
  const health = await req("/api/health");
  console.log("DEPLOY", health.body?.commit?.slice(0, 7), "dbOk", health.body?.dbOk);

  const login = await req("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASS, portal: "office" }),
  });
  if (!login.body?.token) {
    console.error("LOGIN FAIL", login.body);
    process.exit(1);
  }
  const token = login.body.token;
  const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const staff = await req("/api/users?kind=staff", { headers: h });
  const emails = (staff.body || []).map((u) => u.email);
  console.log("STAFF", emails.length, "demo hidden", !emails.some((e) => e.includes("sharnam.demo")));

  const quotes = await req("/api/crm/quotations", { headers: h });
  console.log("QUOTATIONS", quotes.body?.length);

  const projects = await req("/api/projects", { headers: h });
  console.log("PROJECTS", projects.body?.length);
  const proj = projects.body?.[0];
  if (proj) {
    console.log("  active", proj.code, proj.status, proj.clientPhone ? "has-phone" : "no-phone");
    const bids = await req(`/api/crm/bid-packages?projectId=${proj.id}`, { headers: h });
    console.log("  BID PACKAGES", Array.isArray(bids.body) ? bids.body.length : bids.body);
    const disciplines = await req("/api/crm/comparative/disciplines", { headers: h });
    console.log("  DISCIPLINES", disciplines.body?.length ?? disciplines.status, disciplines.body?.map?.((d) => d.label)?.join(" | ")?.slice(0, 120));
  }

  const docs = await req("/api/hrm/hrms-documents?kind=Appointment", { headers: h });
  console.log("APPOINTMENT LETTERS", docs.body?.length);
  for (const d of (docs.body || []).slice(0, 2)) {
    const legacy = d.generatedDocxUrl?.includes(".xlsx");
    console.log(" ", d.refNo, d.employeeName, legacy ? "legacy-xlsx-as-docx" : d.generatedDocxUrl ? "has-docx" : "no-docx");
  }

  const purge = await req("/api/hrm/employees/purge-uat-logins", { method: "POST", headers: h, body: "{}" });
  console.log("PURGE-UAT endpoint", purge.status, purge.body?.removed ?? purge.body?.error);

  console.log("OK — live API smoke complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
