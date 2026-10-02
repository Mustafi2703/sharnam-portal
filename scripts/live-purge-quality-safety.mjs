/**
 * Live: clear Quality + Safety for Voltamp (or --code) on portal.spdc.in.
 * Requires the purge-quality-safety endpoint (deploy main first).
 *
 *   node scripts/live-purge-quality-safety.mjs
 *   node scripts/live-purge-quality-safety.mjs --code "OTHER/CODE"
 */
const BASE = process.env.PORTAL_URL || "https://portal.spdc.in";
const EMAIL = process.env.UAT_EMAIL || "operations@spdc.in";
const PASS = process.env.UAT_PASS || "Demo@1234";
const DEFAULT_CODE = "SHAR/SNT/26-27/Voltamp Transformers Ltd.";

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
  const args = process.argv.slice(2);
  const codeIdx = args.indexOf("--code");
  const code = codeIdx >= 0 ? args[codeIdx + 1] : DEFAULT_CODE;

  console.log("Portal:", BASE);
  console.log("Target:", code);

  const login = await req("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASS, portal: "office" }),
  });
  if (!login.body?.token) {
    console.error("Login failed:", login.body);
    process.exit(1);
  }
  const h = { Authorization: `Bearer ${login.body.token}`, "Content-Type": "application/json" };

  const projects = await req("/api/projects", { headers: h });
  const list = Array.isArray(projects.body) ? projects.body : projects.body?.projects || [];
  const project = list.find((p) => String(p.code).toUpperCase() === code.toUpperCase());
  if (!project) {
    console.error("Project not found");
    process.exit(1);
  }

  const purge = await req(`/api/projects/${project.id}/purge-quality-safety`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({ confirmCode: project.code }),
  });
  if (purge.status === 404) {
    console.error("Endpoint not deployed yet — push/deploy main, then re-run this script.");
    console.error("Or use Projects → Clear Quality · Safety after deploy.");
    process.exit(2);
  }
  if (purge.status !== 200) {
    console.error("Purge failed:", purge.status, purge.body);
    process.exit(1);
  }
  console.log("✓ Quality + Safety cleared for", project.code);
  console.log(purge.body);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
