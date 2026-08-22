/**
 * Live test: master register lines + GFC list + meeting + RFI email on production/local API.
 *
 *   API_BASE=https://portal.spdc.in npx tsx apps/api/scripts/test-drawings-module-live.ts
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const API = (process.env.API_BASE || process.env.WEB_ORIGIN || "http://localhost:4000").replace(/\/$/, "");
const EMAIL = process.env.TEST_EMAIL || "baibhabmustafi@gmail.com";
const PASS = process.env.SEED_PASSWORD || "Demo@1234";

async function api<T>(path: string, opts: { method?: string; token?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: opts.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${opts.method || "GET"} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return json as T;
}

async function main() {
  console.log(`API: ${API}`);

  const login = await api<{ token: string }>("/api/auth/login", {
    method: "POST",
    body: { email: "admin@sharnam.demo", password: PASS },
  });
  const token = login.token;

  const projects = await api<{ id: string; code: string }[]>("/api/projects", { token });
  const project = projects.find((p) => p.code === "SPDC-DEMO-01") || projects[0];
  if (!project) throw new Error("No project found");
  console.log(`Project: ${project.code} (${project.id})`);

  const before = await api<{ totals: { lines: number }; lines: unknown[] }>(
    `/api/drawings/project/${project.id}/register-dashboard`,
    { token }
  );
  console.log(`Master register lines before: ${before.totals.lines}`);

  const testLines = [
    {
      srNo: 901,
      projectPackage: "Package A",
      building: "Tower 1",
      discipline: "Architecture",
      drawingNumber: `TEST-AR-${Date.now().toString().slice(-4)}`,
      drawingTitle: "Portal test — typical floor plan",
      drawingType: "Good For Construction (GFC)",
      consultantName: "Sharnam Test Consultants",
      revisionNumber: "R0",
      revisionDate: "2026-08-20",
      latestRevision: "Yes",
      plannedSubmissionDate: "2026-08-15",
      actualSubmissionDate: "2026-08-20",
      delayResponsibility: "Consultant",
      issuedTo: "Main Contractor",
      issueDate: "2026-08-21",
      copiesCount: 2,
      criticalDrawing: "No",
      remarks: "Drawings module live test — master register",
    },
    {
      srNo: 902,
      projectPackage: "Package B",
      building: "Tower 2",
      discipline: "Structural",
      drawingNumber: `TEST-ST-${Date.now().toString().slice(-4)}`,
      drawingTitle: "Portal test — foundation layout",
      drawingType: "Good For Construction (GFC)",
      consultantName: "Struct Design Co",
      revisionNumber: "R0",
      criticalDrawing: "Yes",
      remarks: "Critical path test line",
    },
  ];

  const created: string[] = [];
  for (const line of testLines) {
    const row = await api<{ drawingNumber: string }>(`/api/drawings/project/${project.id}/register-lines`, {
      method: "POST",
      token,
      body: line,
    });
    created.push(row.drawingNumber);
    console.log(`✓ Master line saved: ${row.drawingNumber}`);
  }

  const after = await api<{ totals: { lines: number; gfc: number; critical: number } }>(
    `/api/drawings/project/${project.id}/register-dashboard`,
    { token }
  );
  console.log(`Master register after: ${after.totals.lines} lines (${after.totals.gfc} GFC, ${after.totals.critical} critical)`);

  const gfc = await api<unknown[]>(`/api/drawings/project/${project.id}`, { token });
  console.log(`GFC register drawings: ${gfc.length}`);

  const meeting = await api<{ id: string; title: string }>(`/api/comms/meetings/${project.id}`, {
    method: "POST",
    token,
    body: {
      title: `Drawings module test meeting — ${new Date().toLocaleDateString("en-GB")}`,
      meetingDate: new Date(Date.now() + 86400000).toISOString(),
      location: "Teams / Site office",
      status: "Agenda",
      attendeeEmails: `${EMAIL},hello@twinoxis.com`,
    },
  });
  console.log(`✓ Meeting created: ${meeting.title} (${meeting.id})`);

  console.log(
    JSON.stringify(
      {
        ok: true,
        api: API,
        project: project.code,
        masterLinesAdded: created,
        registerTotals: after.totals,
        gfcCount: gfc.length,
        meetingId: meeting.id,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error("Test failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
