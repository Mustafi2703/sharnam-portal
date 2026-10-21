/**
 * Checks KPI RAG rules and that each mapped subject has its own loader.
 * With a database, also prints live figures for the first project that has subjects.
 *   npx tsx scripts/audit-kpi-check.mts
 */
import dotenv from "dotenv";
import path from "path";
import XLSX from "xlsx";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

const { applyDatabaseUrl } = await import("../apps/api/src/resolveDatabaseUrl.ts");
applyDatabaseUrl();

const scoring = await import("../apps/api/src/modules/audit-kpi/scoring.ts");
const sources = await import("../apps/api/src/modules/audit-kpi/subjectSources.ts");

const green = scoring.subjectRag({
  recordsCount: 4,
  openCount: 1,
  closedCount: 3,
  overdueCount: 0,
  oldestOpenDays: 5,
  kraScore: null,
});
assert(green === "GREEN", `blank KRA with oldest 5 should be GREEN, got ${green}`);

const amber = scoring.subjectRag({
  recordsCount: 4,
  openCount: 1,
  closedCount: 3,
  overdueCount: 0,
  oldestOpenDays: 5,
  kraScore: 0.6,
});
assert(amber === "AMBER", `KRA 0.6 should be AMBER, got ${amber}`);

const pass = scoring.roleKraResult([4, 3, 4, 3]);
assert(pass.result === "PASS" && pass.kraAverage === 3.5, `4,3,4,3 should pass at 3.5, got ${pass.kraAverage} ${pass.result}`);

assert(scoring.kpiRag(">= 90%", "85") === "AMBER", "85 against >= 90% should be AMBER");
assert(scoring.kpiRag(">= 90%", "70") === "RED", "70 against >= 90% should be RED");
assert(scoring.kpiRag("100%", "100") === "GREEN", "100% at 100 should be GREEN");
assert(scoring.kpiRag("100%", "95") === "AMBER", "100% at 95 should be AMBER");
assert(scoring.kpiRag("0", "0") === "GREEN", "target 0 at 0 should be GREEN");
assert(scoring.kpiRag("0", "1") === "RED", "target 0 at 1 should be RED");
assert(scoring.kpiRag("<= 14", "14") === "GREEN", "<= 14 at 14 should be GREEN");
assert(scoring.kpiRag("<= 14", "21") === "AMBER", "<= 14 at 21 should be AMBER");
assert(scoring.kpiRag("<= 14", "22") === "RED", "<= 14 at 22 should be RED");
assert(scoring.kpiRag("Falling", "3") === null, "Falling stays typed");
assert(scoring.kpiRag("Weekly", "1") === null, "Weekly stays typed");
assert(scoring.kpiRag("Divergence < 5%", "2") === null, "Divergence stays typed");

const wb = XLSX.readFile(path.join(process.cwd(), "docs/MASTER_KPI_DASHBOARD.xlsx"));
const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets["06_ROLE_KRA"], { header: 1, defval: "" });
const targets = new Set<string>();
for (const row of rows) {
  const code = String(row[0] || "").trim();
  if (/^K\d+$/i.test(code)) targets.add(String(row[2] || "").trim());
}
for (const target of targets) {
  const rag = scoring.kpiRag(target, "0");
  const typed = ["Falling", "Rising then stable", "Within contingency", "Weekly", "Divergence < 5%"];
  if (typed.includes(target)) assert(rag === null, `${target} should stay typed`);
  else assert(rag === "GREEN" || rag === "AMBER" || rag === "RED", `${target} did not produce a RAG`);
}
console.log(`kpiRag checked ${targets.size} targets from 06_ROLE_KRA`);

const loaders = Object.values(sources.SUBJECT_SOURCES).map((source) => source.load);
assert(new Set(loaders).size === loaders.length, "two subjects share a loader");
assert(!sources.SUBJECT_SOURCES["10.19_QMS_SCOPE"], "QMS scope must not be refreshed");
assert(sources.SUBJECT_SOURCES["08.06_NCR"]?.model === "QualityNcr", "NCR subject must read QualityNcr");
const ncrUsers = Object.values(sources.SUBJECT_SOURCES).filter((source) => source.model === "QualityNcr");
assert(ncrUsers.length === 1 && ncrUsers[0].code === "08.06_NCR", "QualityNcr is used by more than one subject");
console.log(`subject map has ${Object.keys(sources.SUBJECT_SOURCES).length} codes`);

try {
  const { prisma } = await import("../apps/api/src/prisma.ts");
  const project = await prisma.project.findFirst({
    where: { kpiSubjects: { some: {} } },
    select: { id: true, code: true },
    orderBy: { code: "asc" },
  });
  if (!project) {
    console.log("No project with KPI subjects. Rule checks passed.");
  } else {
    console.log(`Figures for ${project.code}`);
    const today = new Date();
    for (const [code, source] of Object.entries(sources.SUBJECT_SOURCES)) {
      const figures = await source.load(project.id, today);
      console.log(
        `${code} ${source.model} records=${figures.records} open=${figures.open} closed=${figures.closed} overdue=${figures.overdue} oldest=${figures.oldestOpenDays ?? "-"}`
      );
    }
  }
  await prisma.$disconnect();
} catch (err) {
  console.warn("Database figures skipped:", err instanceof Error ? err.message : err);
}

console.log("audit-kpi checks passed");
