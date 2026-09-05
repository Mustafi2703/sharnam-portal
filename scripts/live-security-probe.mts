/**
 * Live security probes — run against production before UAT handoff.
 *
 *   API_BASE=https://portal.spdc.in npx tsx scripts/live-security-probe.mts
 */
const API = (process.env.API_BASE || "https://portal.spdc.in").replace(/\/$/, "");
const PASS = process.env.SEED_PASSWORD || "Demo@1234";
const PROJECT = process.env.UAT_PROJECT || "SPDC-DEMO-01";

type R = { id: string; pass: boolean; severity: "critical" | "high" | "medium" | "low" | "info"; note: string };

const results: R[] = [];

function record(id: string, pass: boolean, severity: R["severity"], note: string) {
  results.push({ id, pass, severity, note });
  const mark = pass ? "PASS" : "FAIL";
  console.log(`${mark} [${severity}] ${id} — ${note}`);
}

async function raw(
  path: string,
  opts: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> } = {}
) {
  const res = await fetch(`${API}${path}`, {
    method: opts.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...opts.headers,
    },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { status: res.status, json, text, headers: res.headers };
}

async function login(email: string) {
  const { json } = await raw("/api/auth/login", { method: "POST", body: { email, password: PASS } });
  const token = (json as { token?: string })?.token;
  if (!token) throw new Error(`Login failed: ${email}`);
  return token;
}

async function main() {
  console.log(`\n=== Live security probe ===\nAPI: ${API}\n`);

  // S1 — unauthenticated sensitive routes
  for (const [id, path] of [
    ["S1a-noauth-projects", "/api/projects"],
    ["S1b-noauth-hrm-dash", "/api/hrm/dashboard"],
    ["S1c-noauth-pack-inv", "/api/checklist/pack-inventory"],
    ["S1d-noauth-cost", "/api/cost/cmsqixpod010n55hz8gk1bba5/summary"],
  ] as const) {
    const { status } = await raw(path);
    record(id, status === 401 || status === 403, status === 200 ? "critical" : "info", `GET ${path} → ${status}`);
  }

  const office = await login("admin@sharnam.demo");
  const client = await login("client@sharnam.demo");
  const vendor = await login("vendor@sharnam.demo");

  const projects = (await raw("/api/projects", { token: office })).json as { id: string; code: string }[];
  const p = projects.find((x) => x.code === PROJECT) || projects[0];
  if (!p) throw new Error("No project");
  const PID = p.id;

  // S2 — client cannot POST cost import
  {
    const { status } = await raw(`/api/cost/${PID}/sync-template`, { method: "POST", token: client });
    record("S2-client-cost-write", status === 403 || status === 401, status === 200 ? "critical" : "medium", `client POST sync-template → ${status}`);
  }

  // S3 — client cannot access pack inventory (office only)
  {
    const { status } = await raw("/api/checklist/pack-inventory", { token: client });
    record("S3-client-pack-inv", status === 403 || status === 401, status === 200 ? "high" : "medium", `client GET pack-inventory → ${status}`);
  }

  // S4 — vendor cannot access HR dashboard
  {
    const { status } = await raw("/api/hrm/dashboard", { token: vendor });
    record("S4-vendor-hrm", status === 403 || status === 401, status === 200 ? "high" : "medium", `vendor GET hrm/dashboard → ${status}`);
  }

  // S5 — uploads static: try listing /uploads (should not directory-list)
  {
    const res = await fetch(`${API}/uploads/`, { redirect: "manual" });
    const text = await res.text();
    const listsDir = res.status === 200 && /Index of|directory listing/i.test(text);
    record("S5-uploads-listing", !listsDir, listsDir ? "critical" : "info", `GET /uploads/ → ${res.status}${listsDir ? " (directory listing!)" : ""}`);
  }

  // S6 — CORS: evil origin should not reflect wide open
  {
    const res = await fetch(`${API}/api/health`, {
      headers: { Origin: "https://evil.example.com" },
    });
    const acao = res.headers.get("access-control-allow-origin") || "";
    const wideOpen = acao === "*" || acao === "https://evil.example.com";
    record(
      "S6-cors-origin",
      !wideOpen,
      wideOpen ? "high" : "info",
      `Origin evil.example.com → ACAO=${acao || "(none)"}`
    );
  }

  // S7 — invalid JWT rejected
  {
    const { status } = await raw("/api/projects", { token: "invalid.jwt.token" });
    record("S7-bad-jwt", status === 401 || status === 403, status === 200 ? "critical" : "info", `bad JWT → ${status}`);
  }

  // S8 — health should not leak secrets
  {
    const { json, text } = await raw("/api/health");
    const blob = JSON.stringify(json) + text;
    const leaks = /JWT_SECRET|DATABASE_URL|password|secret=/i.test(blob);
    record("S8-health-leak", !leaks, leaks ? "high" : "info", leaks ? "health response contains secret-like strings" : "no obvious secrets in /api/health");
  }

  // S9 — SQL injection probe on query param (should 400/404 not 500)
  {
    const { status } = await raw(`/api/dpr-maker/${PID}?date=' OR 1=1--&discipline=CIVIL`, { token: office });
    record("S9-sqli-date", status !== 500, status === 500 ? "medium" : "info", `malformed date query → ${status}`);
  }

  // S10 — checklist submit gate: site with no drawing on QI (if we can find assignment)
  {
    const templates = (await raw("/api/checklist/templates?type=QualityInspection", { token: office })).json as {
      id: string;
    }[];
    if (templates[0]) {
      const { status } = await raw(`/api/checklist/templates/${templates[0].id}/sync-pack`, {
        method: "POST",
        token: client,
      });
      record("S10-client-sync-pack", status === 403 || status === 401, status === 200 ? "high" : "medium", `client POST sync-pack → ${status}`);
    }
  }

  // S11 — rate limit info (informational — single burst)
  {
    const t0 = Date.now();
    const codes: number[] = [];
    for (let i = 0; i < 8; i++) {
      const { status } = await raw("/api/auth/login", {
        method: "POST",
        body: { email: "admin@sharnam.demo", password: "wrong-password" },
      });
      codes.push(status);
    }
    const has429 = codes.includes(429);
    record(
      "S11-auth-rate-limit",
      has429,
      has429 ? "info" : "low",
      `8 bad logins in ${Date.now() - t0}ms → statuses ${codes.join(",")}${has429 ? "" : " (no 429 — consider rate limit before UAT)"}`
    );
  }

  const failed = results.filter((r) => !r.pass);
  const critical = failed.filter((r) => r.severity === "critical" || r.severity === "high");

  console.log(`\n=== SECURITY SUMMARY: ${results.length - failed.length}/${results.length} passed ===`);
  if (critical.length) {
    console.log("\nCritical/High failures:");
    critical.forEach((f) => console.log(`  - ${f.id}: ${f.note}`));
  }
  if (failed.length && !critical.length) {
    console.log("\nNon-critical findings:");
    failed.forEach((f) => console.log(`  - [${f.severity}] ${f.id}: ${f.note}`));
  }

  process.exit(critical.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
