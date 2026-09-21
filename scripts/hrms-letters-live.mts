/**
 * Live smoke: create + generate all HRMS letter kinds on portal.spdc.in (real DB + SharePoint).
 *
 *   PORTAL_API_URL=https://portal.spdc.in npm run hrms:letters-live
 */
import JSZip from "jszip";

const API = (process.env.PORTAL_API_URL || process.env.WEB_ORIGIN || "https://portal.spdc.in").replace(/\/$/, "");
const PASS = process.env.SEED_PASSWORD || "Demo@1234";
/** Live portal blocks @sharnam.demo — use real HR desk login. */
const HR_EMAIL = process.env.HR_LIVE_EMAIL || "anushka.jha@spdc.in";

const KINDS = [
  "Offer",
  "Appointment",
  "Confirmation",
  "Promotion",
  "NdaJoining",
  "NdaPostEmployment",
  "Warning",
  "Experience",
  "AssetReturn",
  "Relieving",
  "Exit",
] as const;

type Json = Record<string, unknown>;

async function req(path: string, opts: { method?: string; token?: string; body?: unknown } = {}) {
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
  let json: Json | null = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text, buf, contentType: res.headers.get("content-type") || "" };
}

function tokenKeyFromDocxPlaceholder(raw: string): string {
  return raw.replace(/<[^>]+>/g, "").trim();
}

async function unfilledInDocx(buf: Buffer): Promise<string[]> {
  const zip = await JSZip.loadAsync(buf);
  const left = new Set<string>();
  for (const k of Object.keys(zip.files)) {
    if (!/^word\/(document|header\d*|footer\d*)\.xml$/.test(k)) continue;
    const xml = await zip.file(k)!.async("string");
    for (const m of xml.matchAll(/\{\{((?:[^{}]|<[^>]*>)*?)\}\}/g)) {
      left.add(tokenKeyFromDocxPlaceholder(m[1]));
    }
  }
  return [...left].sort();
}

function letterData(kind: string) {
  const oldCtc = 840000;
  const newCtc = 1020000;
  const base = {
    candidateName: "Riya Shah",
    empCode: "EMP-RIYASHAH",
    location: "Ahmedabad — Arvind dormitory",
    reportingManager: "Rajesh Mehta",
    fixedCtcAnnual: oldCtc,
    ctcAnnual: oldCtc,
    joinDate: "2026-04-01",
    projectName: "Arvind Dormitory — Ahmedabad",
    clientName: "Arvind Limited",
    gender: "Female",
    pan: "ABCPR1234F",
    address: "Flat 402, Sharnam Heights, Vadodara — 390007",
    phone: "9876500123",
    reason: "Resignation accepted after notice period.",
    issueInBrief: "Repeated delay in submission of daily progress reports.",
    impact: "Client escalation on milestone slippage.",
    correctiveAction: "Submit DPR by 7 PM daily.",
    assets: "Dell laptop, company mobile, ID card",
    serials: "DL-88421, MB-99201",
    offerRefNo: "SPDC/HR/OF/26-FLOW-RIYA",
    appointmentRefNo: "SPDC/HR/OL/26-27/FLOW",
    fatherOrSpouseName: "Rajesh Shah",
    age: "28",
    bankName: "HDFC Bank",
  };
  if (kind === "Promotion") {
    return { ...base, fixedCtcAnnual: newCtc, ctcAnnual: newCtc, newCtc, previousCtc: oldCtc, previousDesignation: "Site Engineer", newDesignation: "Senior Site Engineer" };
  }
  if (kind === "Relieving" || kind === "Exit" || kind === "NdaPostEmployment") {
    return { ...base, effectiveDate: "2026-12-31" };
  }
  return base;
}

async function main() {
  console.log("Live HRMS letters test →", API);

  const health = await req("/api/health");
  const commit = String(health.json?.commit || "").slice(0, 7);
  console.log(`Health: ok=${health.json?.ok} dbOk=${health.json?.dbOk} commit=${commit} mockOneDrive=${health.json?.mockOneDrive}`);

  const login = await req("/api/auth/login", {
    method: "POST",
    body: { email: HR_EMAIL, password: PASS, allowedRoles: ["admin", "office", "hr"], portal: "hr" },
  });
  if (!login.json?.token) {
    console.error("Login failed:", login.status, login.text.slice(0, 200));
    process.exit(1);
  }
  const token = login.json.token as string;

  const staff = await req("/api/hrm/employees", { token });
  const riya = (staff.json as any[])?.find((e) => e.email === "riya.shah@sharnam.demo" || e.fullName?.includes("Riya"));
  const employeeUserId = riya?.id || null;
  console.log(`Staff: ${riya?.fullName || "Riya Shah (manual)"} id=${employeeUserId || "—"}`);

  let failed = 0;
  const results: Array<{ kind: string; ok: boolean; detail: string }> = [];

  for (const kind of KINDS) {
    const refNo = `SPDC/HR/LIVE/${kind}/${Date.now().toString().slice(-4)}`;
    const create = await req("/api/hrm/hrms-documents", {
      method: "POST",
      token,
      body: {
        kind,
        refNo,
        employeeUserId,
        employeeName: "Riya Shah",
        candidateEmail: "riya.shah@sharnam.demo",
        designation: kind === "Promotion" ? "Senior Site Engineer" : "Site Engineer",
        department: "Projects",
        effectiveDate: kind === "Promotion" ? "2026-09-01" : "2026-04-01",
        data: letterData(kind),
      },
    });

    if (create.status !== 201 || !create.json?.id) {
      failed++;
      const detail = create.json?.error || create.text.slice(0, 120);
      results.push({ kind, ok: false, detail: `create ${create.status}: ${detail}` });
      console.log(`${kind.padEnd(18)} ❌ create — ${detail}`);
      continue;
    }

    const id = create.json.id as string;
    const gen = await req(`/api/hrm/hrms-documents/${id}/generate`, { method: "POST", token });
    if (gen.status !== 200) {
      failed++;
      results.push({ kind, ok: false, detail: `generate ${gen.status}: ${gen.json?.error || gen.text.slice(0, 80)}` });
      console.log(`${kind.padEnd(18)} ❌ generate — ${gen.json?.error || gen.text.slice(0, 80)}`);
      continue;
    }

    const preview = await req(`/api/hrm/hrms-documents/${id}/preview`, { token });
    const hasName = preview.text.includes("Riya Shah");
    const docxUrl = String(gen.json?.generatedDocxUrl || gen.json?.sharePointUrl || "");
    let unfilled: string[] = [];
    let docxOk = false;

    if (docxUrl) {
      const docxPath = docxUrl.startsWith("http") ? docxUrl : `${API}${docxUrl.startsWith("/") ? "" : "/"}${docxUrl}`;
      try {
        const dl = await fetch(docxPath, {
          headers: docxUrl.startsWith("http") && !docxUrl.includes(API) ? {} : { Authorization: `Bearer ${token}` },
        });
        if (dl.ok) {
          const buf = Buffer.from(await dl.arrayBuffer());
          if (buf.length > 1000 && buf[0] === 0x50) {
            unfilled = await unfilledInDocx(buf);
            docxOk = unfilled.length === 0;
          }
        }
      } catch (e) {
        unfilled = [`download failed: ${e instanceof Error ? e.message : e}`];
      }
    }

    const onSharePoint = Boolean(gen.json?.sharePointUrl);
    const ok = hasName && !!docxUrl && (docxOk || (onSharePoint && unfilled.length === 0));
    if (!ok) failed++;
    const detail = [
      hasName ? "preview✓" : "preview missing name",
      docxUrl ? "docx✓" : "no docx",
      docxOk ? "tokens✓" : unfilled.length ? `${unfilled.length} unfilled` : "docx check skipped",
      gen.json?.sharePointUrl ? "SP✓" : "local only",
    ].join(" · ");
    results.push({ kind, ok, detail });
    console.log(`${kind.padEnd(18)} ${ok ? "✅" : "⚠️"} ${detail}`);
    if (unfilled.length && !docxOk) console.log(`   unfilled: ${unfilled.slice(0, 5).join(", ")}${unfilled.length > 5 ? "…" : ""}`);
  }

  const needDeploy = commit < "b6610a4";
  console.log(`\nServer commit: ${commit}${needDeploy ? " — REDEPLOY needed (push b6610a4+ for NDA letters + new docx fill)" : " — latest HR letter stack"}`);
  if (failed) {
    console.error(`\n${failed}/${KINDS.length} letter kind(s) failed on live.`);
    if (needDeploy) console.error("Run Hostinger deploy from main, then: npm run hrms:sync-formats && npm run hrms:letters-live");
    process.exit(1);
  }
  console.log(`\nAll ${KINDS.length} letter kinds passed on live portal.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
