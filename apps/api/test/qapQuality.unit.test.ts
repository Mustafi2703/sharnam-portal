import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import { expectedIrCount, parseQapFrequency } from "../../../packages/shared/src/qapFrequency.ts";
import { qapLineStatus } from "../../../packages/shared/src/qapLineStatus.ts";
import { canRaiseQualityIr, canSetResult, checkQualitySubmit } from "../src/services/qapSignoff.ts";

const CASES: [string, string][] = [
  ["Every foundation and trench", "perElement"],
  ["Each structure & Element", "perElement"],
  ["Each layer", "perElement"],
  ["Each structure", "perElement"],
  ["Each trench", "perElement"],
  ["Each Joint", "perElement"],
  ["Every consignment", "perLot"],
  ["Every lot", "perLot"],
  ["Once in every lot", "perLot"],
  ["Every Consignment", "perLot"],
  ["Every 200 cum", "perQuantity"],
  ["1 test / 500 sqm", "perQuantity"],
  ["1 test / 200 cum", "perQuantity"],
  ["1 test / 100 cum", "perQuantity"],
  ["1 test / 5000 no's", "perQuantity"],
  ["1 test / 50000 no's", "perQuantity"],
  ["Once in every source", "perSource"],
  ["Once Initial Start", "perSource"],
  ["Once established", "perSource"],
  ["Every layout", "perElement"],
  ["Every pour start", "perPour"],
  ["Once in month", "periodic"],
  ["Service agency due date", "dueDate"],
  ["As per requirement", "manual"],
  ["As per concreting item", "manual"],
  ["", "manual"],
  ["Something the sheet never used", "manual"],
];

test("parseQapFrequency maps Week 50 phrases and never throws", () => {
  for (const [text, kind] of CASES) {
    const parsed = parseQapFrequency(text);
    assert.equal(parsed.kind, kind, text || "(blank)");
  }
  assert.equal(expectedIrCount(parseQapFrequency("Every 200 cum"), { quantity: 450 }), 3);
  assert.equal(parseQapFrequency("Once in every source").kind, "perSource");
  assert.equal(expectedIrCount(parseQapFrequency("Not a real frequency"), {}), null);
});

test("workbook frequencies parse without throwing", async () => {
  const file = [
    "seed/data/Quality Assurance Plan Week 50.xlsx",
    "apps/api/checklist-templates/Quality Assurance Plan Week 50.xlsx",
  ]
    .map((p) => path.resolve(p))
    .find((p) => fs.existsSync(p));
  if (!file) return;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets[0];
  ws.eachRow((row) => {
    const text = String(row.getCell(4).value || "");
    if (!text || /frequency/i.test(text)) return;
    const parsed = parseQapFrequency(text);
    assert.ok(parsed.kind);
  });
});

test("qap line status comes from IRs, not from daily ticks", () => {
  assert.equal(qapLineStatus({ due: 1, weekEnded: false, irs: [] }), "Not started");
  assert.equal(
    qapLineStatus({
      due: 1,
      weekEnded: true,
      irs: [{ id: "1", result: "A", status: "Approved", final: true, createdAt: "2026-01-01" }],
    }),
    "Completed"
  );
  assert.equal(
    qapLineStatus({
      due: 1,
      irs: [{ id: "1", result: "C", status: "Rejected", final: false, createdAt: "2026-01-01" }],
    }),
    "Rejected - re-offer"
  );
  assert.equal(
    qapLineStatus({
      due: 3,
      weekEnded: true,
      irs: [{ id: "1", result: "A", status: "Approved", final: true, createdAt: "2026-01-01" }],
    }),
    "Overdue"
  );
});

test("sign-off rules", () => {
  const line = { isHeader: false, pmcRole: "Witness", clientRole: "Witness", contractorPerformer: "Site Engr", testAgency: "Site Lab" };
  const vendor = { id: "u1", role: "vendor", vendorId: "v1" };
  assert.equal(canRaiseQualityIr({ user: vendor, line: { ...line, isHeader: true }, assignments: [], onBehalf: false }).ok, false);
  assert.equal(
    canSetResult({ user: { id: "s1", role: "site_employee" }, line, assignments: [] }).ok,
    false
  );
  assert.equal(
    canSetResult({
      user: { id: "s1", role: "site_employee" },
      line,
      assignments: [{ roleLabel: "Witness", party: "PMC", userId: "s1" }],
    }).ok,
    true
  );
  const when = new Date(Date.now() + 30 * 3600000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const notice = checkQualitySubmit({
    line,
    form: {
      irType: "Site inspection",
      requiredDate: `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`,
      requiredTime: `${pad(when.getHours())}:${pad(when.getMinutes())}`,
      declA: true,
      declB: true,
      declC: true,
      declD: true,
      declE: true,
      declF: true,
      declG: true,
      verifiedBy: "QC",
    },
    submittedAt: new Date(),
    hasChecklist: true,
    attachedRecordKeys: [],
    requiredRecordKeys: [],
  });
  assert.equal(notice.ok, false);
});
