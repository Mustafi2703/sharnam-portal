/**
 * Authenticate on portal.spdc.in and smoke the screens testers will click.
 *
 *   npm run test:portal-live
 *   PORTAL_API_URL=https://portal.spdc.in npm run test:portal-live
 */
const API = (process.env.PORTAL_API_URL || process.env.WEB_ORIGIN || "https://portal.spdc.in").replace(/\/$/, "");
const PASS = process.env.SEED_PASSWORD || "Demo@1234";

type Step = { ok: boolean; name: string; detail: string };

async function req(
  path: string,
  opts: { method?: string; token?: string; body?: unknown } = {}
): Promise<{ status: number; json: any; text: string; bytes: number; contentType: string }> {
  const res = await fetch(`${API}${path}`, {
    method: opts.method || "GET",
    headers: {
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const text = buf.toString("utf8");
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text, bytes: buf.length, contentType: res.headers.get("content-type") || "" };
}

async function login(email: string, allowedRoles?: string[]) {
  const r = await req("/api/auth/login", {
    method: "POST",
    body: { email, password: PASS, ...(allowedRoles ? { allowedRoles, portal: "office" } : {}) },
  });
  return { email, status: r.status, token: r.json?.token as string | undefined, error: r.json?.error || r.text.slice(0, 160) };
}

function pickProject(list: { id: string; code: string }[]) {
  return (
    list.find((p) => p.code === "SPDC-ARVIND-NTX") ||
    list.find((p) => p.code === "SPDC-ARVIND-01") ||
    list.find((p) => p.code === "SPDC-UAT-LIVE") ||
    list.find((p) => p.code === "SPDC-DEMO-01") ||
    list[0]
  );
}

async function main() {
  const steps: Step[] = [];
  console.log("Live API", API);

  const health = await req("/api/health");
  steps.push({
    ok: health.status === 200 && health.json?.ok === true && health.json?.dbOk === true,
    name: "GET /api/health",
    detail: `dbOk=${health.json?.dbOk} users=${health.json?.userCount} commit=${health.json?.commit}`,
  });

  const office = await login("office@sharnam.demo", ["admin", "office"]);
  steps.push({
    ok: Boolean(office.token),
    name: "POST /api/auth/login office",
    detail: office.token ? "token" : office.error,
  });

  const admin = await login("admin@sharnam.demo");
  steps.push({
    ok: Boolean(admin.token),
    name: "POST /api/auth/login admin",
    detail: admin.token ? "token" : admin.error,
  });

  const site = await login("site@sharnam.demo", ["site_employee"]);
  steps.push({
    ok: Boolean(site.token),
    name: "POST /api/auth/login site",
    detail: site.token ? "token" : site.error,
  });

  const vendor = await login("vendor@sharnam.demo", ["vendor"]);
  steps.push({
    ok: Boolean(vendor.token),
    name: "POST /api/auth/login vendor",
    detail: vendor.token ? "token" : vendor.error,
  });

  const client = await login("baibhabmustafi@gmail.com", ["client"]);
  const clientAlt = client.token ? client : await login("client@sharnam.demo", ["client"]);
  steps.push({
    ok: Boolean(clientAlt.token),
    name: "POST /api/auth/login client",
    detail: clientAlt.token ? client.email : clientAlt.error,
  });

  const token = office.token || admin.token;
  if (!token) {
    for (const s of steps) console.log(`${s.ok ? "PASS" : "FAIL"} | ${s.name} | ${s.detail}`);
    process.exit(1);
  }

  const me = await req("/api/auth/me", { token });
  steps.push({
    ok: me.status === 200 && Boolean(me.json?.email || me.json?.user?.email),
    name: "GET /api/auth/me",
    detail: String(me.json?.email || me.json?.user?.email || me.text.slice(0, 120)),
  });

  const projects = await req("/api/projects", { token });
  const list = Array.isArray(projects.json) ? projects.json : [];
  const codes = list.map((p: { code: string }) => p.code).join(", ");
  steps.push({
    ok: projects.status === 200 && list.length > 0,
    name: "GET /api/projects",
    detail: `${list.length} · ${codes}`,
  });

  const project = pickProject(list);
  if (!project) {
    steps.push({ ok: false, name: "Pick project", detail: "empty" });
  } else {
    const id = project.id;
    const weekEnd = project.code === "SPDC-ARVIND-01" ? "2026-07-29" : "2026-09-07";
    const dprDate = weekEnd;

    const setup = await req(`/api/projects/${id}/setup-status`, { token });
    steps.push({
      ok: setup.status === 200,
      name: `GET /api/projects/:id/setup-status (${project.code})`,
      detail: setup.status === 200 ? `checks ${setup.json?.checks?.length ?? "ok"}` : setup.text.slice(0, 160),
    });

    const drawings = await req(`/api/drawings/project/${id}`, { token });
    const dwg = Array.isArray(drawings.json) ? drawings.json : [];
    steps.push({
      ok: drawings.status === 200,
      name: `GET /api/drawings/project/:id`,
      detail: `${dwg.length} drawings · ${dwg.filter((d: { isPublished?: boolean }) => d.isPublished).length} published`,
    });

    const fills = await req(`/api/checklist/project/${id}/submissions`, { token });
    steps.push({
      ok: fills.status === 200,
      name: `GET /api/checklist/project/:id/submissions`,
      detail: Array.isArray(fills.json) ? `${fills.json.length} fills` : fills.text.slice(0, 160),
    });

    const dpr = await req(`/api/dpr-maker/${id}?date=${dprDate}&discipline=CIVIL`, { token });
    steps.push({
      ok: dpr.status === 200,
      name: `GET /api/dpr-maker/:id CIVIL ${dprDate}`,
      detail: dpr.status === 200 ? `status ${dpr.json?.status || "loaded"}` : dpr.text.slice(0, 160),
    });

    const dprX = await req(`/api/dpr-maker/${id}/download.xlsx?date=${dprDate}&discipline=CIVIL`, { token });
    steps.push({
      ok: dprX.status === 200 && dprX.bytes > 800,
      name: `GET /api/dpr-maker/:id/download.xlsx`,
      detail: `${dprX.status} ${dprX.bytes}b ${dprX.contentType}`,
    });

    const wpr = await req(`/api/wpr-maker/${id}?end=${weekEnd}`, { token });
    const sectionCount = wpr.json?.sections ? Object.keys(wpr.json.sections).length : 0;
    steps.push({
      ok: wpr.status === 200 && sectionCount > 0,
      name: `GET /api/wpr-maker/:id?end=${weekEnd}`,
      detail: wpr.status === 200 ? `${sectionCount} sections` : wpr.text.slice(0, 160),
    });

    const wprX = await req(`/api/wpr-maker/${id}/download.xlsx?end=${weekEnd}`, { token });
    steps.push({
      ok: wprX.status === 200 && wprX.bytes > 800,
      name: `GET /api/wpr-maker/:id/download.xlsx`,
      detail: `${wprX.status} ${wprX.bytes}b ${wprX.contentType}`,
    });

    const ras = await req(`/api/finance/${id}/ra`, { token });
    steps.push({
      ok: ras.status === 200,
      name: `GET /api/finance/:id/ra`,
      detail: Array.isArray(ras.json) ? `${ras.json.length} RA` : ras.text.slice(0, 160),
    });

    const cops = await req(`/api/finance/${id}/cop`, { token });
    steps.push({
      ok: cops.status === 200,
      name: `GET /api/finance/:id/cop`,
      detail: Array.isArray(cops.json) ? `${cops.json.length} COP` : cops.text.slice(0, 160),
    });

    const rfis = await req(`/api/rfis/project/${id}`, { token });
    steps.push({
      ok: rfis.status === 200 || rfis.status === 404,
      name: `GET RFIs`,
      detail: `${rfis.status} ${Array.isArray(rfis.json) ? rfis.json.length + " rows" : rfis.text.slice(0, 80)}`,
    });
  }

  if (clientAlt.token && project) {
    const clientDraw = await req(`/api/drawings/project/${project.id}`, { token: clientAlt.token });
    steps.push({
      ok: clientDraw.status === 200 || clientDraw.status === 403,
      name: "Client GET drawings",
      detail: `${clientDraw.status}`,
    });
  }

  let failed = 0;
  for (const s of steps) {
    console.log(`${s.ok ? "PASS" : "FAIL"} | ${s.name} | ${s.detail}`);
    if (!s.ok) failed += 1;
  }
  console.log(`\n${steps.length - failed}/${steps.length} passed on ${API}`);
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
