export type CubeRow = {
  id: string;
  srNo?: string | null;
  castDate?: string | null;
  description: string;
  grade?: string | null;
  cubeWeight?: number | null;
  testDate7?: string | null;
  testDate28?: string | null;
  load7?: number | null;
  load28?: number | null;
  strength7?: number | null;
  strength28?: number | null;
  strength?: number | null;
  avgStrength?: number | null;
  result?: string | null;
  testAgency?: string | null;
};

export type CubeGroup = {
  key: string;
  srNo: string;
  castDate?: string | null;
  description: string;
  grade?: string | null;
  testDate7?: string | null;
  testDate28?: string | null;
  testAgency?: string | null;
  specimens: CubeRow[];
  avgStrength?: number | null;
  result?: string | null;
};

function fmtDay(v?: string | null) {
  if (!v) return "";
  return v.slice(0, 10);
}

export function groupCubeRows(rows: CubeRow[]): CubeGroup[] {
  const map = new Map<string, CubeGroup>();

  for (const row of rows) {
    const sr = (row.srNo || "").replace(/-([23])$/, "") || "—";
    const cast = fmtDay(row.castDate);
    const key = `${sr}|${cast}|${row.description}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        srNo: sr,
        castDate: row.castDate,
        description: row.description,
        grade: row.grade,
        testDate7: row.testDate7,
        testDate28: row.testDate28,
        testAgency: row.testAgency,
        specimens: [],
        avgStrength: null,
        result: null,
      });
    }
    const g = map.get(key)!;
    g.specimens.push(row);
    if (row.testDate7) g.testDate7 = row.testDate7;
    if (row.testDate28) g.testDate28 = row.testDate28;
    if (row.testAgency) g.testAgency = row.testAgency;
    if (row.avgStrength != null) g.avgStrength = row.avgStrength;
    if (row.result && /pass|fail/i.test(row.result)) g.result = row.result;
  }

  return Array.from(map.values()).sort((a, b) => {
    const sa = Number(a.srNo) || 0;
    const sb = Number(b.srNo) || 0;
    return sa - sb || a.description.localeCompare(b.description);
  });
}

export function fmtCubeDate(v?: string | null) {
  if (!v) return "";
  return new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function specimenPhase(c: CubeRow): "7D" | "28D" | "CUBE" {
  const has7 = c.load7 != null || c.strength7 != null;
  const has28 = c.load28 != null || c.strength28 != null;
  if (has7 && !has28) return "7D";
  if (has28 && !has7) return "28D";
  return "CUBE";
}

/** Keep imported 6-row (3×7D + 3×28D) groups in age order; new date entries stay 3 cubes. */
export function orderCubeSpecimens(rows: CubeRow[]): CubeRow[] {
  const d7 = rows.filter((r) => specimenPhase(r) === "7D");
  const d28 = rows.filter((r) => specimenPhase(r) === "28D");
  const rest = rows.filter((r) => specimenPhase(r) === "CUBE");
  if (d7.length || d28.length) return [...d7, ...d28, ...rest];
  return rows;
}
