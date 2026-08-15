/** Seeded client demo projects — keep in sync with seed/pilotWeekDemo.ts + seed/seed.ts */

export const DEMO_PROJECT_CODES = ["SPDC-DEMO-01", "SPDC-PILOT-02"] as const;
export type DemoProjectCode = (typeof DEMO_PROJECT_CODES)[number];

/** Published DPR day on SPDC-DEMO-01 (seed/fullDemoPack.ts) */
export const DEMO_DPR_DATE = "2026-08-14";
/** Pilot week ending — WPR + 7 DPR days (seed/pilotWeekDemo.ts) */
export const PILOT_WEEK_END = "2026-08-16";

export type DemoProject = { id: string; code: string; name: string; status?: string };

export function sortDemoProjectsFirst<T extends { code: string; updatedAt?: string | Date }>(list: T[]): T[] {
  const rank = (code: string) => {
    const i = DEMO_PROJECT_CODES.indexOf(code as DemoProjectCode);
    return i >= 0 ? i : DEMO_PROJECT_CODES.length + 1;
  };
  return [...list].sort((a, b) => {
    const dr = rank(a.code) - rank(b.code);
    if (dr !== 0) return dr;
    return 0;
  });
}

export function findDemoProject(list: DemoProject[], code: DemoProjectCode) {
  return list.find((p) => p.code === code);
}

export function demoProjectLinks(projectId: string, code: string) {
  const base = `/projects/${projectId}`;
  const isPilot = code === "SPDC-PILOT-02";
  const dprDate = isPilot ? PILOT_WEEK_END : DEMO_DPR_DATE;
  return {
    home: base,
    dpr: `${base}/dpr-maker?date=${dprDate}`,
    wpr: `${base}/wpr-maker?end=${isPilot ? PILOT_WEEK_END : DEMO_DPR_DATE}`,
    progress: `${base}/progress`,
    finance: `${base}/cost`,
    reports: `${base}/reports`,
  };
}

export const DEMO_PROJECT_BLURBS: Record<DemoProjectCode, string> = {
  "SPDC-DEMO-01": "Main demo — one full DPR day (7 disciplines), finance RA/COP, quality & safety fills.",
  "SPDC-PILOT-02": "Pilot week — 7 published DPR days, WPR PPTX/XLSX, MS Project S-curve. Check format here.",
};
