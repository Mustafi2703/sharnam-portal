/**
 * Walk the Arvind week the same way testers will in the UI:
 * login → setup status → drawings → fill log → DPR → WPR download → finance copies.
 */
import fs from "fs";
import path from "path";
import type { PrismaClient } from "@prisma/client";
import { ARVIND_DORM_CODE, ARVIND_NTX_CODE } from "./arvindSiteSeed.js";
import { runArvindWeekTest } from "./arvindWeekTest.js";
import { snapWeekEnding } from "./wprDemoSeed.js";

export type WalkStep = {
  role: string;
  step: string;
  screen: string;
  ok: boolean;
  detail: string;
};

type JobSpec = {
  code: string;
  label: string;
  weekEnd: string;
  dprDate: string;
};

const JOBS: JobSpec[] = [
  { code: ARVIND_NTX_CODE, label: "NTX", weekEnd: "2026-09-07", dprDate: "2026-09-07" },
  { code: ARVIND_DORM_CODE, label: "Dorm", weekEnd: "2026-07-29", dprDate: "2026-07-29" },
];

const PASSWORD = process.env.SEED_PASSWORD || "Demo@1234";

async function json<T>(
  base: string,
  token: string,
  url: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: T | null; text: string }> {
  const res = await fetch(`${base}${url}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let data: T | null = null;
  try {
    data = text ? (JSON.parse(text) as T) : null;
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data, text };
}

async function login(base: string, email: string) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const data = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
  return { ok: res.ok && Boolean(data.token), token: data.token || "", error: data.error || `${res.status}` };
}

export async function walkArvindWeekViaHttp(apiBase: string): Promise<WalkStep[]> {
  const steps: WalkStep[] = [];
  const office = await login(apiBase, "office@sharnam.demo");
  steps.push({
    role: "office",
    step: "Login office portal",
    screen: "/login",
    ok: office.ok,
    detail: office.ok ? "Token issued" : office.error,
  });
  if (!office.token) return steps;

  const projects = await json<{ id: string; code: string }[]>(apiBase, office.token, "/api/projects");
  steps.push({
    role: "office",
    step: "Project list",
    screen: "Dashboard / CRM projects",
    ok: projects.ok && Array.isArray(projects.data),
    detail: Array.isArray(projects.data) ? `${projects.data.length} projects` : projects.text.slice(0, 120),
  });

  for (const job of JOBS) {
    const project = (projects.data || []).find((p) => p.code === job.code);
    if (!project) {
      steps.push({
        role: "office",
        step: `Open ${job.code}`,
        screen: "Project home",
        ok: false,
        detail: "Project missing — run npm run db:seed-arvind-week-test",
      });
      continue;
    }

    const setup = await json<{ checks?: { ok: boolean }[] }>(
      apiBase,
      office.token,
      `/api/projects/${project.id}/setup-status`
    );
    const ready = (setup.data?.checks || []).filter((c) => c.ok).length;
    steps.push({
      role: "office",
      step: `${job.label} Complete setup status`,
      screen: "CRM / Project setup",
      ok: setup.ok,
      detail: setup.ok ? `${ready} checks green` : setup.text.slice(0, 120),
    });

    const drawings = await json<{ id: string; isPublished?: boolean }[]>(
      apiBase,
      office.token,
      `/api/drawings/project/${project.id}`
    );
    const published = (drawings.data || []).filter((d) => d.isPublished).length;
    steps.push({
      role: "office",
      step: `${job.label} published drawings`,
      screen: "Drawings register",
      ok: drawings.ok && published > 0,
      detail: drawings.ok ? `${published} published` : drawings.text.slice(0, 120),
    });

    const fills = await json<unknown[]>(
      apiBase,
      office.token,
      `/api/checklist/project/${project.id}/submissions?type=QualityInspection`
    );
    steps.push({
      role: "site / office",
      step: `${job.label} Quality fill log`,
      screen: "Quality → Fill Quality Checklist popup",
      ok: fills.ok && Array.isArray(fills.data) && fills.data.length > 0,
      detail: Array.isArray(fills.data) ? `${fills.data.length} logged fills` : fills.text.slice(0, 120),
    });

    const dpr = await json<{ status?: string }>(
      apiBase,
      office.token,
      `/api/dpr-maker/${project.id}?date=${job.dprDate}&discipline=CIVIL`
    );
    steps.push({
      role: "office",
      step: `${job.label} DPR ${job.dprDate} CIVIL`,
      screen: "Reports → DPR Maker",
      ok: dpr.ok,
      detail: dpr.ok ? `status ${dpr.data?.status || "loaded"}` : dpr.text.slice(0, 120),
    });

    const wpr = await json<{ sections?: Record<string, unknown>; publishedPath?: string }>(
      apiBase,
      office.token,
      `/api/wpr-maker/${project.id}?end=${job.weekEnd}`
    );
    const sectionCount = wpr.data?.sections ? Object.keys(wpr.data.sections).length : 0;
    steps.push({
      role: "office",
      step: `${job.label} WPR week ending ${job.weekEnd}`,
      screen: "Reports → WPR Maker",
      ok: wpr.ok && sectionCount > 0,
      detail: wpr.ok ? `${sectionCount} sections` : wpr.text.slice(0, 120),
    });

    const xlsx = await fetch(
      `${apiBase}/api/wpr-maker/${project.id}/download.xlsx?end=${job.weekEnd}`,
      { headers: { Authorization: `Bearer ${office.token}` } }
    );
    steps.push({
      role: "office",
      step: `${job.label} download WPR XLSX`,
      screen: "WPR Maker → XLSX",
      ok: xlsx.ok && Number(xlsx.headers.get("content-length") || "1") > 1000,
      detail: xlsx.ok ? `${xlsx.headers.get("content-type")} ${xlsx.headers.get("content-length") || "stream"}` : `${xlsx.status}`,
    });

    const ras = await json<unknown[]>(apiBase, office.token, `/api/finance/${project.id}/ra`);
    steps.push({
      role: "vendor / office",
      step: `${job.label} RA bills`,
      screen: "Finance → RA",
      ok: ras.ok && Array.isArray(ras.data) && ras.data.length > 0,
      detail: Array.isArray(ras.data) ? `${ras.data.length} RA rows` : ras.text.slice(0, 120),
    });

    const cops = await json<unknown[]>(apiBase, office.token, `/api/finance/${project.id}/cop`);
    steps.push({
      role: "office",
      step: `${job.label} COP register`,
      screen: "Finance → COP",
      ok: cops.ok && Array.isArray(cops.data),
      detail: Array.isArray(cops.data) ? `${cops.data.length} COP rows` : cops.text.slice(0, 120),
    });
  }

  const site = await login(apiBase, "site@sharnam.demo");
  steps.push({
    role: "site_employee",
    step: "Login site portal",
    screen: "/login",
    ok: site.ok,
    detail: site.ok ? "Token issued" : site.error,
  });

  const client = await login(apiBase, "baibhabmustafi@gmail.com");
  const clientFallback = client.ok ? client : await login(apiBase, "client@sharnam.demo");
  steps.push({
    role: "client",
    step: "Login client portal",
    screen: "/login/stakeholder",
    ok: clientFallback.ok,
    detail: clientFallback.ok ? "Client can view" : clientFallback.error,
  });

  return steps;
}

export async function walkArvindWeekFromDb(db: PrismaClient): Promise<WalkStep[]> {
  const steps: WalkStep[] = [];
  for (const job of JOBS) {
    const project = await db.project.findUnique({ where: { code: job.code } });
    if (!project) {
      steps.push({
        role: "office",
        step: job.code,
        screen: "Project",
        ok: false,
        detail: "Missing",
      });
      continue;
    }
    const drawings = await db.drawing.count({ where: { projectId: project.id, isPublished: true } });
    const fills = await db.checklistSubmission.count({
      where: { assignment: { projectId: project.id }, status: { in: ["Submitted", "Approved"] } },
    });
    const dprs = await db.dprSnapshot.count({
      where: { projectId: project.id, status: "Published" },
    });
    const weekEnd = snapWeekEnding(new Date(`${job.weekEnd}T12:00:00`));
    const wpr = await db.wprSnapshot.findFirst({
      where: { projectId: project.id, weekEnding: weekEnd },
    });
    const ras = await db.raBill.count({ where: { projectId: project.id } });
    const cops = await db.certificateOfPayment.count({ where: { projectId: project.id } });

    steps.push(
      {
        role: "office",
        step: `${job.label} published drawings`,
        screen: "Drawings",
        ok: drawings > 0,
        detail: `${drawings} published`,
      },
      {
        role: "site / office",
        step: `${job.label} checklist fills`,
        screen: "Fill log popup",
        ok: fills > 0,
        detail: `${fills} submitted`,
      },
      {
        role: "office",
        step: `${job.label} published DPRs`,
        screen: "DPR Maker",
        ok: dprs >= 7,
        detail: `${dprs} snapshots`,
      },
      {
        role: "office",
        step: `${job.label} published WPR`,
        screen: "WPR Maker",
        ok: Boolean(wpr?.publishedPath),
        detail: wpr?.publishedPath || "no file",
      },
      {
        role: "vendor / office",
        step: `${job.label} RA + COP`,
        screen: "Finance",
        ok: ras > 0,
        detail: `${ras} RA · ${cops} COP`,
      }
    );
  }
  return steps;
}

export async function runArvindWeekAppWalk(db: PrismaClient, apiBase?: string) {
  const seeded = await runArvindWeekTest(db);
  const dbSteps = await walkArvindWeekFromDb(db);
  let httpSteps: WalkStep[] = [];
  if (apiBase) {
    try {
      httpSteps = await walkArvindWeekViaHttp(apiBase);
    } catch (err) {
      httpSteps = [
        {
          role: "office",
          step: "HTTP walk",
          screen: apiBase,
          ok: false,
          detail: err instanceof Error ? err.message : "API walk failed",
        },
      ];
    }
  }

  const outDir = path.join(process.cwd(), "apps/api/uploads/_week-verify");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "walk-report.json"),
    JSON.stringify({ seeded: { ok: seeded.ok, ntx: seeded.ntx, dorm: seeded.dorm }, dbSteps, httpSteps }, null, 2)
  );

  const failed = [...dbSteps, ...httpSteps].filter((s) => !s.ok);
  return { seeded, dbSteps, httpSteps, ok: seeded.ok && failed.length === 0, outDir };
}
