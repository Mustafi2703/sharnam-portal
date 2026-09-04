/**
 * Live UAT smoke — run against Hostinger production before client handoff.
 *
 *   API_BASE=https://portal.spdc.in npx tsx scripts/live-uat-smoke.mts
 */
const API = (process.env.API_BASE || "https://portal.spdc.in").replace(/\/$/, "");
const PASS = process.env.SEED_PASSWORD || "Demo@1234";
const PROJECT_CODE = process.env.UAT_PROJECT || "SPDC-DEMO-01";

type Result = { id: string; pass: boolean; note: string; ms?: number };

const results: Result[] = [];

function record(id: string, pass: boolean, note: string, ms = 0) {
  results.push({ id, pass, note, ms });
  const mark = pass ? "PASS" : "FAIL";
  console.log(`${mark} | ${id} | ${note}${ms ? ` (${ms}ms)` : ""}`);
}

async function fetchJson<T>(
  path: string,
  opts: { method?: string; token?: string; body?: unknown; expectStatus?: number } = {}
): Promise<{ status: number; data: T; ms: number }> {
  const t0 = Date.now();
  const res = await fetch(`${API}${path}`, {
    method: opts.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data: T = null as T;
  try {
    data = text ? JSON.parse(text) : (null as T);
  } catch {
    data = { raw: text.slice(0, 200) } as T;
  }
  const ms = Date.now() - t0;
  const expect = opts.expectStatus ?? 200;
  if (res.status !== expect) {
    throw new Error(`${opts.method || "GET"} ${path} → ${res.status} (expected ${expect}): ${text.slice(0, 240)}`);
  }
  return { status: res.status, data, ms };
}

async function login(email: string): Promise<string> {
  const { data } = await fetchJson<{ token: string }>("/api/auth/login", {
    method: "POST",
    body: { email, password: PASS },
  });
  if (!data.token) throw new Error(`No token for ${email}`);
  return data.token;
}

async function main() {
  console.log(`\n=== Sharnam live UAT smoke ===\nAPI: ${API}\nProject: ${PROJECT_CODE}\n`);

  // 1 Health
  try {
    const { data, ms } = await fetchJson<{
      ok: boolean;
      dbOk: boolean;
      graphConfigured?: boolean;
      sharePointSiteUrlSet?: boolean;
      commit?: string;
    }>("/api/health");
    record(
      "H1-health",
      data.ok === true && data.dbOk === true,
      `dbOk=${data.dbOk} graph=${data.graphConfigured} sp=${data.sharePointSiteUrlSet} commit=${data.commit || "?"}`,
      ms
    );
  } catch (e) {
    record("H1-health", false, e instanceof Error ? e.message : String(e));
  }

  // 2 Auth roles
  const roleEmails: [string, string][] = [
    ["A1-office", "admin@sharnam.demo"],
    ["A2-site", "site@sharnam.demo"],
    ["A3-client", "client@sharnam.demo"],
    ["A4-vendor", "vendor@sharnam.demo"],
  ];
  let officeToken = "";
  for (const [id, email] of roleEmails) {
    try {
      const t0 = Date.now();
      officeToken = email === "admin@sharnam.demo" ? await login(email) : officeToken;
      const token = await login(email);
      if (email === "admin@sharnam.demo") officeToken = token;
      record(id, !!token, `login ${email}`, Date.now() - t0);
    } catch (e) {
      record(id, false, e instanceof Error ? e.message : String(e));
    }
  }
  if (!officeToken) {
    console.error("\nAborting — office login failed.\n");
    process.exit(1);
  }

  // 3 Project scope
  let projectId = "";
  try {
    const { data, ms } = await fetchJson<{ id: string; code: string }[]>("/api/projects", { token: officeToken });
    const p = data.find((x) => x.code === PROJECT_CODE) || data[0];
    if (!p) throw new Error("No projects");
    projectId = p.id;
    record("P1-project", true, `${p.code} (${p.id})`, ms);
  } catch (e) {
    record("P1-project", false, e instanceof Error ? e.message : String(e));
    process.exit(1);
  }

  // 4 Drawings + gate data
  try {
    const { data, ms } = await fetchJson<any[]>(`/api/drawings/project/${projectId}`, { token: officeToken });
    const pub = data.filter((d) => d.isPublished && (d.revisions?.length || 0) > 0);
    record("D1-drawings", pub.length > 0, `${data.length} drawings, ${pub.length} published with rev`, ms);
  } catch (e) {
    record("D1-drawings", false, e instanceof Error ? e.message : String(e));
  }

  // 5 Progress + S-curve
  try {
    const { data, ms } = await fetchJson<any>(`/api/progress/${projectId}/summary`, { token: officeToken });
    const act = data?.totals?.activityLines ?? 0;
    const boq = data?.totals?.boqLines ?? 0;
    record("PR1-progress-summary", act > 0 && boq > 0, `activityLines=${act} boqLines=${boq}`, ms);
  } catch (e) {
    record("PR1-progress-summary", false, e instanceof Error ? e.message : String(e));
  }

  try {
    const { data, ms } = await fetchJson<any[]>(`/api/progress/${projectId}/scurve-points`, { token: officeToken });
    record("PR2-scurve-points", Array.isArray(data) && data.length > 0, `points=${data?.length ?? 0}`, ms);
  } catch (e) {
    record("PR2-scurve-points", false, e instanceof Error ? e.message : String(e));
  }

  try {
    const { data, ms } = await fetchJson<{ connected: boolean; scurve: unknown[] }>(
      `/api/progress/${projectId}/ms-project/scurve`,
      { token: officeToken }
    );
    const pts = Array.isArray(data.scurve) ? data.scurve.length : 0;
    record("PR3-ms-project-scurve", data.connected && pts > 0, `connected=${data.connected} points=${pts}`, ms);
  } catch (e) {
    record("PR3-ms-project-scurve", false, e instanceof Error ? e.message : String(e));
  }

  // 6 Cost data flow
  try {
    const { data, ms } = await fetchJson<any>(`/api/cost/${projectId}/summary`, { token: officeToken });
    const st = data?.structures?.length ?? 0;
    const mon = data?.monitoring?.length ?? data?.totals?.monitoringLines ?? 0;
    record("C1-cost-summary", st >= 1 && mon >= 1, `structures=${st} monitoring=${mon}`, ms);
  } catch (e) {
    record("C1-cost-summary", false, e instanceof Error ? e.message : String(e));
  }

  // 7 DPR maker
  const dprDate = "2026-03-04";
  try {
    const { data, ms } = await fetchJson<any>(
      `/api/dpr-maker/${projectId}?date=${dprDate}&discipline=CIVIL`,
      { token: officeToken }
    );
    const lines = data?.lines?.length ?? data?.snapshot?.lines?.length ?? 0;
    record("DP1-dpr-load", !!data, `CIVIL ${dprDate} lines=${lines}`, ms);
  } catch (e) {
    record("DP1-dpr-load", false, e instanceof Error ? e.message : String(e));
  }

  try {
    const { ms } = await fetchJson<Blob>(
      `/api/dpr-maker/${projectId}/download.xlsx?date=${dprDate}&discipline=CIVIL`,
      { token: officeToken }
    );
    record("DP2-dpr-xlsx", true, "download.xlsx 200", ms);
  } catch (e) {
    record("DP2-dpr-xlsx", false, e instanceof Error ? e.message : String(e));
  }

  try {
    const { data, ms } = await fetchJson<any>(`/api/dpr-maker/${projectId}/verify-pack?date=${dprDate}`, {
      token: officeToken,
    });
    const ok = data?.overall?.ready ?? data?.ready ?? false;
    record("DP3-dpr-verify-pack", ok, JSON.stringify(data?.overall || data?.gaps?.slice?.(0, 2) || data).slice(0, 120), ms);
  } catch (e) {
    record("DP3-dpr-verify-pack", false, e instanceof Error ? e.message : String(e));
  }

  // 8 WPR maker
  const wprEnd = "2026-03-07";
  try {
    const { data, ms } = await fetchJson<any>(`/api/wpr-maker/${projectId}?end=${wprEnd}`, { token: officeToken });
    const sections = data?.sections ? Object.keys(data.sections).length : 0;
    record("W1-wpr-load", sections > 0, `weekEnd=${wprEnd} sections=${sections}`, ms);
  } catch (e) {
    record("W1-wpr-load", false, e instanceof Error ? e.message : String(e));
  }

  try {
    const { ms } = await fetchJson<Blob>(
      `/api/wpr-maker/${projectId}/download.xlsx?end=${wprEnd}&preset=week`,
      { token: officeToken }
    );
    record("W2-wpr-xlsx", true, "download.xlsx preset=week", ms);
  } catch (e) {
    record("W2-wpr-xlsx", false, e instanceof Error ? e.message : String(e));
  }

  try {
    const { data, ms } = await fetchJson<any[]>(`/api/wpr-maker/${projectId}/recent`, { token: officeToken });
    record("W3-wpr-recent", Array.isArray(data), `recent=${data?.length ?? 0}`, ms);
  } catch (e) {
    record("W3-wpr-recent", false, e instanceof Error ? e.message : String(e));
  }

  // 9 Checklists
  try {
    const { data, ms } = await fetchJson<any[]>(`/api/checklist/templates?type=QualityInspection`, {
      token: officeToken,
    });
    const withItems = data.filter((t) => (t._count?.items ?? t.items?.length ?? 0) > 6);
    record("CL1-templates", data.length > 0, `${data.length} QI templates, ${withItems.length} with >6 lines`, ms);
  } catch (e) {
    record("CL1-templates", false, e instanceof Error ? e.message : String(e));
  }

  try {
    await fetchJson(`/api/checklist/pack-inventory`, { token: officeToken });
    record("CL2-pack-inventory", true, "route exists (post-deploy)");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    record("CL2-pack-inventory", false, msg.includes("404") ? "NOT DEPLOYED — deploy latest API" : msg);
  }

  // 10 Client read-only
  try {
    const clientToken = await login("client@sharnam.demo");
    const { data, ms } = await fetchJson<any[]>(`/api/drawings/project/${projectId}`, { token: clientToken });
    record("R1-client-drawings", Array.isArray(data), `client sees ${data.length} drawings`, ms);
  } catch (e) {
    record("R1-client-drawings", false, e instanceof Error ? e.message : String(e));
  }

  // Summary
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);
  console.log(`\n=== SUMMARY: ${passed}/${results.length} passed ===\n`);
  if (failed.length) {
    console.log("Failed:");
    for (const f of failed) console.log(`  - ${f.id}: ${f.note}`);
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
