/** Evidence sections B–G (see docs/UAT_EVIDENCE_PLAN.md). Each step: act as the right login, then screenshot. */
import fs from "node:fs";
import path from "node:path";
import { call, evidence, open, step } from "./lib.mjs";

const fileForm = (name, bytes, extra = {}) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(extra)) fd.append(k, String(v));
  fd.append(name === "files" ? "files" : "file", new Blob([bytes]), "workbook.xlsx");
  return fd;
};

// ── B. Cost ─────────────────────────────────────────────────────────────────────────────────────
async function sectionB({ projectId, ok, users: { OFFICE, SITE } }) {
  const id = await projectId();
  await step("B1", "SPDC budget workbook uploaded", OFFICE, async (page) => {
    const sum = await call(OFFICE, "GET", `/api/cost/${id}/summary`);
    let note = `${sum.body?.totals?.monitoringLines || 0} BOQ lines already`;
    if (!(sum.body?.totals?.monitoringLines > 0)) {
      // Office uploads the client's SPDC budget workbook — every tab (Budget, Monitoring, MB, BBS, rates).
      const buf = fs.readFileSync(path.resolve("seed/data/SPDC_Budget_Arvind 52.xls"));
      const fd = new FormData();
      fd.append("kind", "all");
      fd.append("file", new Blob([buf]), "SPDC_Budget_UAT.xls");
      const r = await call(OFFICE, "POST", `/api/cost/${id}/workbook/import`, undefined, { form: fd });
      ok(r.status < 300, `workbook import ${r.status} ${JSON.stringify(r.body).slice(0, 160)}`);
      note = JSON.stringify(r.body).slice(0, 220);
    }
    const after = (await call(OFFICE, "GET", `/api/cost/${id}/summary`)).body;
    ok(after.totals.monitoringLines > 0 && after.totals.mbLines > 0, "BOQ / MB not loaded");
    note = `budget ${after.budget.length} · BOQ ${after.totals.monitoringLines} · MB ${after.totals.mbLines} · BBS ${after.totals.bbsLines} · packages ${after.packages.length}`;
    await open(page, `/projects/${id}/cost?tab=monitoring&pkg=Civil%20Dormitory`);
    await evidence("B1", "SPDC budget workbook uploaded", OFFICE, page, { note });
  });

  await step("B2", "Budget WBS heading and line", OFFICE, async (page) => {
    const h = await call(OFFICE, "POST", `/api/cost/${id}/budget`, { description: "A — UAT CIVIL WORKS", remarks: "HEADING" });
    const l = await call(OFFICE, "POST", `/api/cost/${id}/budget`, {
      srNo: "A.1",
      description: "Warehouse structure — RCC and PEB",
      stakeholder: "Bhavana Infra",
      budgetedAmount: 42500000,
      workOrderAmount: 39800000,
      certifiedAmount: 0,
      forecastedAmount: 1200000,
    });
    ok(h.status < 300 && l.status < 300, `budget ${h.status}/${l.status}`);
    await open(page, `/projects/${id}/cost?tab=budget`);
    await evidence("B2", "Budget WBS heading and line", OFFICE, page);
  });

  await step("B3", "BOQ section subsection item", OFFICE, async (page) => {
    await open(page, `/projects/${id}/cost?tab=monitoring&pkg=Civil%20Dormitory`);
    // UI: the sheet's own + Section / + Subsection buttons
    // UI: + Section opens the "Add monitoring section" form
    await page.getByRole("button", { name: "+ Section", exact: true }).first().click();
    await page.getByPlaceholder(/Section heading/i).fill("UAT SECTION — PEB WAREHOUSE");
    await page.getByRole("button", { name: /^Add section$/i }).click();
    await page.waitForTimeout(1500);
    const item = await call(OFFICE, "POST", `/api/cost/${id}/monitoring`, {
      packageName: "Civil Dormitory",
      section: "UAT SECTION — PEB WAREHOUSE › Anchor bolts",
      itemNo: "U.1.1",
      description: "Supply and fix 24 mm anchor bolts with template",
      uom: "Nos",
      rate: 1850,
      boqQty: 240,
      gfcQty: 256,
      achievedQty: 120,
    });
    ok(item.status < 300, `monitoring item ${item.status} ${JSON.stringify(item.body).slice(0, 100)}`);
    await open(page, `/projects/${id}/cost?tab=monitoring&pkg=Civil%20Dormitory`);
    await page.getByText("U.1.1").first().scrollIntoViewIfNeeded().catch(() => {});
    await evidence("B3", "BOQ section subsection item", OFFICE, page);
  });

  await step("B4", "MB heading and measurement", SITE, async (page) => {
    const h = await call(SITE, "POST", `/api/cost/${id}/mb`, { packageName: "Dormitory Civil", rowKind: "subsection", description: "UAT — Anchor bolts, grid A–C" });
    const d = await call(SITE, "POST", `/api/cost/${id}/mb`, {
      packageName: "Dormitory Civil",
      rowKind: "data",
      description: "Grid A column bases",
      nos1: 12,
      nos2: 4,
      unit: "Nos",
      raBill: "RA-UAT-01",
    });
    ok(h.status < 300 && d.status < 300, `mb ${h.status}/${d.status} ${JSON.stringify(d.body).slice(0, 100)}`);
    ok(Number(d.body.qty) === 48, `MB qty computed ${d.body.qty}, expected 48`);
    await open(page, `/projects/${id}/cost?tab=mb&pkg=Dormitory%20Civil`);
    await page.getByText("Grid A column bases").first().scrollIntoViewIfNeeded().catch(() => {});
    await evidence("B4", "MB heading and measurement", SITE, page, { note: "qty 12 × 4 = 48 computed" });
  });

  await step("B5", "BBS bar row", SITE, async (page) => {
    const b = await call(SITE, "POST", `/api/cost/${id}/bbs`, {
      packageName: "Dormitory Civil",
      barMark: "F1-B1",
      location: "Footing F1",
      shapeCode: "00",
      diameterMm: 16,
      lengthMm: 2.4, // cutting length in metres, as in the client's BBS sheet
      nos: 18,
    });
    ok(b.status < 300, `bbs ${b.status} ${JSON.stringify(b.body).slice(0, 120)}`);
    ok(Math.abs(b.body.weightKg - 68.27) < 0.05, `weight ${b.body.weightKg} kg, expected 68.27 (16² / 162 × 43.2 m)`);
    await open(page, `/projects/${id}/cost?tab=bbs&pkg=Dormitory%20Civil`);
    await evidence("B5", "BBS bar row", SITE, page, { note: `16 mm × 2.4 m × 18 = 43.2 m → ${b.body.weightKg} kg` });
  });

  await step("B6", "Cashflow period", OFFICE, async (page) => {
    const c = await call(OFFICE, "POST", `/api/cost/${id}/cashflow`, {
      sheetKind: "chart",
      periodLabel: "Oct-26",
      periodDate: "2026-10-31",
      plannedAmount: 4200000,
      actualAmount: 3650000,
      description: "UAT month",
    });
    ok(c.status < 300, `cashflow ${c.status}`);
    await open(page, `/projects/${id}/cost?tab=cashflow`);
    await evidence("B6", "Cashflow period", OFFICE, page);
  });

  await step("B7", "Cost sheet downloads branded", OFFICE, async (page) => {
    const kinds = ["budget", "boq", "mb", "bbs", "cashflow", "rates"];
    const sizes = [];
    for (const k of kinds) {
      const r = await call(OFFICE, "GET", `/api/cost/${id}/download/${k}.xlsx`);
      ok(r.status === 200, `${k}.xlsx ${r.status}`);
      sizes.push(`${k} ${Math.round(r.bytes / 1024)}KB`);
    }
    await open(page, `/projects/${id}/cost?tab=budget`);
    await evidence("B7", "Cost sheet downloads branded", OFFICE, page, { note: sizes.join(" · ") });
  });

  await step("B8", "Cost sheets saved to SharePoint", OFFICE, async (page) => {
    await open(page, `/projects/${id}/cost?tab=monitoring&pkg=Civil%20Dormitory`);
    const btn = page.getByRole("button", { name: /Publish to SharePoint/i }).first();
    ok(await btn.count(), "no Publish to SharePoint button on the BOQ sheet");
    await btn.click();
    await page.waitForTimeout(2500);
    const saved = [];
    for (const [k, m] of [["budget", "budget"], ["mb", "mb"], ["cashflow", "cashflow"]]) {
      const r = await call(OFFICE, "POST", `/api/projects/${id}/save-export`, { path: `/api/cost/${id}/download/${k}.xlsx`, module: m });
      ok(r.status === 200, `save ${k} ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
      saved.push(r.body.path);
    }
    await evidence("B8", "Cost sheets saved to SharePoint", OFFICE, page, { note: saved.join(" | ") });
  });
}

// ── C. Finance ──────────────────────────────────────────────────────────────────────────────────
async function sectionC({ state, projectId, ok, users: { OFFICE, VENDOR } }) {
  const id = await projectId();
  const wb = fs.readFileSync(path.resolve("module_prompts/Sharnam_modules_docs 2/Viatrix_RA BILL_COP.xlsm"));
  const form = (fields, fileField) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, String(v));
    if (fileField) fd.append(fileField, new Blob([wb]), "RA-bill-workbook.xlsm");
    return fd;
  };

  await step("C1", "Work order PO added", OFFICE, async (page) => {
    const pos = (await call(OFFICE, "GET", `/api/finance/${id}/po`)).body || [];
    if (!pos.some((p) => p.poNumber === "UAT-PO-001")) {
      const r = await call(OFFICE, "POST", `/api/finance/${id}/po`, undefined, {
        form: form({ poNumber: "UAT-PO-001", poDate: "2026-09-01", vendorName: "Bhavana Infra", workTrade: "Civil", budgetCode: "UAT-CIV-01", originalValue: 39800000, retentionPct: 5, gstNumber: "24AAHFB1234K1Z5" }),
      });
      ok(r.status < 300, `po ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
    }
    await open(page, `/projects/${id}/finance?tab=cop`);
    await page.getByText("Work orders / POs").first().scrollIntoViewIfNeeded();
    await evidence("C1", "Work order PO added", OFFICE, page);
  });

  await step("C2", "Vendor raises RA bill stage 1", VENDOR, async (page) => {
    const noFile = await call(VENDOR, "POST", `/api/finance/${id}/ra`, undefined, { form: form({ raNumber: "RA-UAT-X", discipline: "Civil" }) });
    ok(noFile.status >= 400, `RA without a workbook was accepted (${noFile.status})`);
    const r = await call(VENDOR, "POST", `/api/finance/${id}/ra`, undefined, {
      form: form({ raNumber: `RA-UAT-${Date.now().toString().slice(-4)}`, discipline: "Civil", invoiceNumber: "BI/UAT/01", invoiceDate: "2026-10-05", againstBillRaised: 2400000, gstAmount: 432000, totalInvoiceWithGst: 2832000, retentionAmount: 120000 }, "files"),
    });
    ok(r.status < 300, `ra ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
    state.raId = r.body.id;
    await open(page, `/projects/${id}/finance?tab=ra`);
    await evidence("C2", "Vendor raises RA bill stage 1", VENDOR, page, { note: `${r.body.raNumber} · ${r.body.status} · refused without workbook (${noFile.status})` });
  });

  await step("C3", "Office checks and certifies RA bill", OFFICE, async (page) => {
    const early = await call(OFFICE, "POST", `/api/finance/ra/${state.raId}/stage`, undefined, { form: form({ stage: "Certified" }, "file") });
    ok(early.status === 400, `Certified before Corrected allowed (${early.status})`);
    const c = await call(OFFICE, "POST", `/api/finance/ra/${state.raId}/stage`, undefined, { form: form({ stage: "Corrected" }, "file") });
    const z = await call(OFFICE, "POST", `/api/finance/ra/${state.raId}/stage`, undefined, { form: form({ stage: "Certified", amountAtStage: 2350000 }, "file") });
    ok(c.status === 201 && z.status === 201, `stages ${c.status}/${z.status}`);
    await open(page, `/projects/${id}/finance?tab=ra`);
    await evidence("C3", "Office checks and certifies RA bill", OFFICE, page, { note: "order enforced: Certified before Corrected → 400" });
  });

  await step("C4", "RA bill raised from BOQ", OFFICE, async (page) => {
    const pk = (await call(OFFICE, "GET", `/api/finance/${id}/ra/from-boq/packages`)).body;
    const el = pk.find((p) => p.packageName === "Electric" && p.billableItems) || pk.find((p) => p.billableItems);
    ok(el, "no billable BOQ package");
    const lines = (await call(OFFICE, "GET", `/api/finance/${id}/ra/from-boq/lines?package=${encodeURIComponent(el.packageName)}`)).body.lines;
    const qty = Object.fromEntries(lines.map((l, i) => [l.lineId, i < 4 ? l.thisQty : 0]));
    const r = await call(OFFICE, "POST", `/api/finance/${id}/ra/from-boq`, { packageName: el.packageName, raNumber: `RA-BOQ-${Date.now().toString().slice(-4)}`, vendorName: "Bhavana Infra", invoiceNumber: "BI/UAT/02", qty });
    ok(r.status === 201, `from-boq ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
    state.boqRaId = r.body.id;
    await open(page, `/projects/${id}/finance?tab=ra`);
    await page.getByRole("button", { name: "From BOQ" }).click();
    await page.locator("select").filter({ hasText: "BOQ package…" }).selectOption(el.packageName);
    await page.waitForTimeout(1500);
    await evidence("C4", "RA bill raised from BOQ", OFFICE, page, { note: `${r.body.raNumber} · ${el.packageName} → ${r.body.discipline} · ${r.body.lines.length} items · ₹${Math.round(r.body.againstBillRaised).toLocaleString("en-IN")}` });
  });

  await step("C5", "COP generated and filled", OFFICE, async (page) => {
    const d = (await call(OFFICE, "GET", `/api/finance/${id}/cop/defaults?raBillId=${state.raId}`)).body;
    ok(d.poNumberDate && d.panNumber && d.budgetCode, `defaults incomplete ${JSON.stringify(d).slice(0, 160)}`);
    const c = await call(OFFICE, "POST", `/api/finance/${id}/cop`, undefined, { form: form({ raBillId: state.raId }) });
    ok(c.status === 201, `cop ${c.status} ${JSON.stringify(c.body).slice(0, 120)}`);
    state.copId = c.body.id;
    await open(page, `/projects/${id}/finance?tab=cop&raBillId=${state.raId}`);
    await page.waitForTimeout(1200);
    await evidence("C5", "COP generated and filled", OFFICE, page, { note: `${c.body.certificateNumber} · PO ${c.body.poNumberDate} · PAN ${c.body.panNumber} · net ₹${Math.round(c.body.amountPayable).toLocaleString("en-IN")}` });
  });

  await step("C6", "COP PDF and SharePoint", OFFICE, async (page) => {
    const one = await call(OFFICE, "GET", `/api/finance/${id}/cop/${state.copId}/download.pdf`);
    const all = await call(OFFICE, "GET", `/api/finance/${id}/cops/download.pdf`);
    ok(one.status === 200 && /pdf/.test(one.type) && all.status === 200, `pdf ${one.status}/${all.status}`);
    const sv = await call(OFFICE, "POST", `/api/projects/${id}/save-export`, { path: `/api/finance/${id}/cops/download.pdf`, module: "finance" });
    ok(sv.status === 200, `save ${sv.status}`);
    // The certificate itself, rendered in the browser's PDF viewer is not scriptable — screenshot the register row.
    await open(page, `/projects/${id}/finance?tab=cop`);
    await page.getByText("Certificate of Payment · register").first().scrollIntoViewIfNeeded();
    await evidence("C6", "COP PDF and SharePoint", OFFICE, page, { note: `COP PDF ${Math.round(one.bytes / 1024)}KB · all COPs ${Math.round(all.bytes / 1024)}KB · saved ${sv.body.path}` });
  });

  await step("C7", "Payment summary and trackers", OFFICE, async (page) => {
    const out = [];
    for (const [u, m] of [[`/api/finance/${id}/payment-summary/download.xlsx`, "finance"], [`/api/finance/${id}/pr-tracker/download.xlsx`, "prTracker"]]) {
      const r = await call(OFFICE, "GET", u);
      ok(r.status === 200, `${u} ${r.status}`);
      const sv = await call(OFFICE, "POST", `/api/projects/${id}/save-export`, { path: u, module: m });
      ok(sv.status === 200, `save ${u} ${sv.status}`);
      out.push(sv.body.path);
    }
    await open(page, `/projects/${id}/finance?tab=bills&discipline=civil`);
    await evidence("C7", "Payment summary and trackers", OFFICE, page, { note: out.join(" | ") });
  });
}

// ── D. Quality ──────────────────────────────────────────────────────────────────────────────────
async function sectionD({ state, projectId, ok, today, users: { OFFICE, SITE, VENDOR } }) {
  const id = await projectId();
  const vendorId = (await call(OFFICE, "GET", "/api/vendors")).body.find((v) => v.name === "Bhavana Infra")?.id;

  await step("D1", "QAP row added", OFFICE, async (page) => {
    const r = await call(OFFICE, "POST", `/api/checklist/project/${id}/qap`, {
      weekLabel: "Week 01",
      section: "Reinforcement",
      activity: "Rebar placement — anchor bolt pedestals",
      frequency: "Each pour",
      codeOfConformance: "IS 456 / IS 2502",
      testAgency: "PMC",
      contractorPerformer: "Bhavana Infra",
      discipline: "Civil",
    });
    ok(r.status < 300, `qap ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
    const dl = await call(OFFICE, "GET", `/api/checklist/project/${id}/qap/download.xlsx`);
    ok(dl.status === 200, `qap download ${dl.status}`);
    await open(page, `/projects/${id}/qap`);
    await evidence("D1", "QAP row added", OFFICE, page);
  });

  await step("D2", "Cube set recorded", SITE, async (page) => {
    const r = await call(SITE, "POST", `/api/checklist/project/${id}/cubes`, { srNo: "1", description: "Pedestal P1–P6", grade: "M25", castDate: today, cubeWeight: 8.4, load: 640, strength: 28.4, result: "Pending 28-day" });
    ok(r.status < 300, `cube ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
    await open(page, `/projects/${id}/inspections?sheet=cube-test`);
    await evidence("D2", "Cube set recorded", SITE, page);
  });

  await step("D3", "Site observation logged daily", SITE, async (page) => {
    const r = await call(SITE, "POST", `/api/checklist/project/${id}/quality-site-records`, {
      recordType: "Site Observation",
      title: "Cover blocks missing at pedestal P3",
      description: "Provide 40 mm cover blocks before concreting.",
      location: "Grid A / P3",
      severity: "Medium",
      issuedTo: "Bhavana Infra",
    });
    ok(r.status < 300, `observation ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
    await open(page, `/projects/${id}/inspections?sheet=site-observation`);
    await evidence("D3", "Site observation logged daily", SITE, page);
  });

  await step("D4", "NCR and CAR raised to vendor", SITE, async (page) => {
    const mk = (kind, desc) =>
      call(SITE, "POST", `/api/checklist/project/${id}/ncr`, {
        kind,
        contractorVendorId: vendorId,
        contractor: "Bhavana Infra",
        description: desc,
        location: "Grid A pedestals",
        ncrType: "Workmanship",
        plannedClosure: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
        actionRequired: "Break and recast honeycombed pedestal; submit method statement.",
      });
    const n = await mk("NCR", "Honeycombing in pedestal P3 after de-shuttering");
    const c = await mk("CAR", "Repeat cover-block omissions — corrective action plan required");
    ok(n.status < 300 && c.status < 300, `ncr ${n.status} car ${c.status} ${JSON.stringify(n.body).slice(0, 120)}`);
    state.ncrId = n.body.id || n.body.ncr?.id;
    state.carId = c.body.id || c.body.ncr?.id;
    await open(page, `/projects/${id}/inspections?sheet=car-register`);
    await evidence("D4", "NCR and CAR raised to vendor", SITE, page, { note: `${n.body.number || n.body.ncr?.number} · ${c.body.number || c.body.ncr?.number}` });
  });

  await step("D5", "Vendor answers NCR from action desk", VENDOR, async (page) => {
    await open(page, `/projects/${id}/actions`);
    await evidence("D5a", "Vendor action desk before response", VENDOR, page);
    const r = await call(VENDOR, "PATCH", `/api/checklist/project/${id}/ncr/${state.ncrId}`, {
      formDataJson: { workCarriedOutNote: "Pedestal P3 broken out and recast on 08-Oct with vibrator; cube set taken.", signedContractor: "R. Patel (Bhavana Infra)", positionContractor: "Site in-charge" },
    });
    ok(r.status < 300, `vendor response ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
    await open(page, `/projects/${id}/actions`);
    await evidence("D5", "Vendor answers NCR from action desk", VENDOR, page, { note: "NCR moves to With PMC" });
  });

  await step("D6", "Vendor cannot close NCR", VENDOR, async (page) => {
    const r = await call(VENDOR, "PATCH", `/api/checklist/project/${id}/ncr/${state.ncrId}`, { status: "Closed" });
    ok(r.status === 403, `vendor close returned ${r.status}`);
    await open(page, `/projects/${id}/ncr-form/quality/${state.ncrId}`);
    await evidence("D6", "Vendor cannot close NCR", VENDOR, page, { note: `refused: ${r.body.error}` });
  });

  await step("D7", "Office verifies and closes NCR", OFFICE, async (page) => {
    const r = await call(OFFICE, "PATCH", `/api/checklist/project/${id}/ncr/${state.ncrId}`, {
      status: "Closed",
      actualClosure: today,
      formDataJson: {
        contractorActed: "Yes",
        followUpEffective: "Yes",
        pursueFurtherCosts: "No",
        siteSetupModification: "No",
        correctiveActionDetail: "Recast verified; 7-day cube 19.2 MPa.",
        actionByWhom: "Bhavana Infra",
        actionCompleted: today,
      },
    });
    ok(r.status < 300, `close ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
    await open(page, `/projects/${id}/ncr-form/quality/${state.ncrId}`);
    await evidence("D7", "Office verifies and closes NCR", OFFICE, page, { full: true });
  });

  await step("D8", "Quality Excel saved to SharePoint", OFFICE, async (page) => {
    const sv = await call(OFFICE, "POST", `/api/projects/${id}/save-export`, { path: `/api/reports/module/${id}/quality/download.xlsx`, module: "qap" });
    ok(sv.status === 200, `save ${sv.status} ${JSON.stringify(sv.body).slice(0, 120)}`);
    await open(page, `/projects/${id}/inspections`);
    await evidence("D8", "Quality Excel saved to SharePoint", OFFICE, page, { note: sv.body.path });
  });
}

// ── E. Safety ───────────────────────────────────────────────────────────────────────────────────
async function sectionE({ state, projectId, ok, today, users: { OFFICE, SITE, VENDOR } }) {
  const id = await projectId();
  await step("E1", "Safety daily log", SITE, async (page) => {
    const r = await call(SITE, "PUT", `/api/safety/project/${id}/daily/${today}`, { manpower: 64, toolboxTalks: 1, tbtTopics: "Working at height", inductions: 6, permitsIssued: 2, ppeCompliancePct: 96, remarks: "UAT day" });
    ok(r.status < 300, `daily ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
    await open(page, `/projects/${id}/safety`);
    await evidence("E1", "Safety daily log", SITE, page);
  });

  await step("E2", "Safety NCR issued to vendor", SITE, async (page) => {
    const r = await call(SITE, "POST", `/api/safety/project/${id}`, {
      recordType: "NCR",
      title: "Edge protection missing on mezzanine",
      description: "Open edge at mezzanine level without guard rail.",
      severity: "High",
      location: "Mezzanine grid C",
      activityTask: "Mezzanine slab works",
      category: "Working at height",
      issuedTo: "Bhavana Infra",
      responsibleParty: "Bhavana Infra",
      targetCompletion: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
    });
    ok(r.status < 300, `safety ncr ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
    state.safetyId = r.body.id;
    const other = await call(SITE, "POST", `/api/safety/project/${id}`, { recordType: "Observation", title: "Housekeeping — other contractor", issuedTo: "M/s NK Infra", responsibleParty: "M/s NK Infra" });
    state.otherSafetyId = other.body.id;
    await open(page, `/projects/${id}/safety?sheet=ncr-summary`);
    await evidence("E2", "Safety NCR issued to vendor", SITE, page);
  });

  await step("E3", "Vendor records safety action", VENDOR, async (page) => {
    const r = await call(VENDOR, "PATCH", `/api/safety/${state.safetyId}`, {
      rootCause: "Guard rail removed for material shifting and not re-fixed.",
      immediateAction: "Area barricaded; work stopped.",
      longTermAction: "Permit for rail removal; supervisor sign-off before shift end.",
      actionTaken: "Guard rails re-fixed at 1.1 m with toe board.",
    });
    ok(r.status < 300, `vendor safety ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
    await open(page, `/projects/${id}/actions`);
    await evidence("E3", "Vendor records safety action", VENDOR, page);
  });

  await step("E4", "Vendor cannot close or edit others", VENDOR, async (page) => {
    const close = await call(VENDOR, "PATCH", `/api/safety/${state.safetyId}`, { status: "Closed" });
    const other = await call(VENDOR, "PATCH", `/api/safety/${state.otherSafetyId}`, { actionTaken: "x" });
    ok(close.status === 403 && other.status === 403, `close ${close.status} other ${other.status}`);
    await open(page, `/projects/${id}/ncr-form/safety/${state.safetyId}`);
    await evidence("E4", "Vendor cannot close or edit others", VENDOR, page, { note: `close → ${close.status} · other company → ${other.status}` });
  });

  await step("E5", "Office closes safety NCR", OFFICE, async (page) => {
    const r = await call(OFFICE, "PATCH", `/api/safety/${state.safetyId}`, { status: "Closed" });
    ok(r.status < 300, `close ${r.status} ${JSON.stringify(r.body).slice(0, 160)}`);
    await open(page, `/projects/${id}/ncr-form/safety/${state.safetyId}`);
    await evidence("E5", "Office closes safety NCR", OFFICE, page, { full: true });
  });

  await step("E6", "Safety week Excel and SharePoint", OFFICE, async (page) => {
    const wk = await call(OFFICE, "GET", `/api/safety/project/${id}/weekly.xlsx?from=${today}&to=${today}`);
    ok(wk.status === 200, `weekly ${wk.status}`);
    const pub = await call(OFFICE, "POST", `/api/safety/project/${id}/weekly/publish`, { from: today, to: today });
    const sv = await call(OFFICE, "POST", `/api/projects/${id}/save-export`, { path: `/api/reports/module/${id}/safety/download.xlsx`, module: "safety" });
    ok(pub.status < 300 && sv.status === 200, `publish ${pub.status} save ${sv.status}`);
    await open(page, `/projects/${id}/safety`);
    await evidence("E6", "Safety week Excel and SharePoint", OFFICE, page, { note: `${pub.body.path || ""} | ${sv.body.path}` });
  });
}

// ── F. Progress ─────────────────────────────────────────────────────────────────────────────────
async function sectionF({ projectId, ok, today, users: { OFFICE, SITE, PLANNING } }) {
  const id = await projectId();
  await step("F1", "DPR daily published", SITE, async (page) => {
    const d = (await call(SITE, "GET", `/api/dpr-maker/${id}?date=${today}&discipline=Civil`)).body;
    const lines = (d.lines || d.snapshot?.lines || []).slice(0, 15).map((l, i) => (i < 3 ? { ...l, qtyToday: Math.max(1, Math.round((Number(l.scopeQty) || 10) * 0.02)) } : l));
    const sv = await call(SITE, "POST", `/api/dpr-maker/${id}/save`, { logDate: today, discipline: "Civil", lines, highlights: "Pedestals P1–P6 cast", manpower: d.manpower || [] });
    ok(sv.status < 300, `dpr save ${sv.status} ${JSON.stringify(sv.body).slice(0, 160)}`);
    const pub = await call(SITE, "POST", `/api/dpr-maker/${id}/publish`, { logDate: today, discipline: "Civil" });
    const x = await call(SITE, "GET", `/api/dpr-maker/${id}/download.xlsx?date=${today}&discipline=Civil`);
    ok(x.status === 200, `dpr xlsx ${x.status}`);
    await open(page, `/projects/${id}/dpr-maker?date=${today}&discipline=Civil`);
    await evidence("F1", "DPR daily published", SITE, page, { note: `${lines.length} lines · publish ${pub.status} · xlsx ${Math.round(x.bytes / 1024)}KB` });
  });

  await step("F2", "Planned vs Actual weekly", OFFICE, async (page) => {
    const r = await call(OFFICE, "POST", `/api/progress/${id}/planned-actual`, { packageName: "Cashflow", periodLabel: "Week 01", plannedAmount: 1800000, actualAmount: 1520000 });
    const sv = await call(OFFICE, "POST", `/api/projects/${id}/save-export`, { path: `/api/progress/${id}/planned-actual/download.xlsx`, module: "progress" });
    ok(sv.status === 200, `save ${sv.status} ${JSON.stringify(sv.body).slice(0, 120)}`);
    await open(page, `/projects/${id}/progress?tab=planned-actual`);
    await evidence("F2", "Planned vs Actual weekly", OFFICE, page, { note: `entry ${r.status} · ${sv.body.path}` });
  });

  await step("F3", "Progress registers", SITE, async (page) => {
    const m = await call(SITE, "POST", `/api/progress/${id}/milestones`, { code: "M1", activity: "PEB erection start", plannedStart: today, plannedEnd: today, status: "Planned", weightage: 10 });
    const h = await call(SITE, "POST", `/api/progress/${id}/hindrances`, { activity: "Pedestal casting", description: "Ready-mix supply delayed 4 hours", type: "Material", status: "Open", daysImpacted: 0.5, occurredAt: today });
    const r = await call(OFFICE, "POST", `/api/progress/${id}/risks`, { code: "R1", name: "Monsoon delay to roofing", probability: "Medium", consequence: "High", status: "Open", riskOwner: "PMC" });
    const l = await call(OFFICE, "POST", `/api/progress/${id}/legal`, { approvalId: "L1", description: "Fire NOC — provisional", authority: "Fire dept.", status: "Submitted", submissionDate: today });
    ok([m, h, r, l].every((x) => x.status < 300), `milestone ${m.status} hindrance ${h.status} risk ${r.status} legal ${l.status}`);
    await open(page, `/projects/${id}/progress?tab=hindrance`);
    await evidence("F3", "Progress registers", SITE, page, { note: "milestone + hindrance (site) · risk + legal (office)" });
  });

  await step("F4", "S-curve generated", PLANNING, async (page) => {
    // Planner schedules activities (Planned vs Actual) — the S-curve baseline is generated from their dates.
    const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
    for (const [a, s0, e0, q] of [["PEB erection", -20, 40, 120], ["Roof sheeting", 20, 70, 6400]]) {
      const r = await call(PLANNING, "POST", `/api/progress/${id}/activity-lines`, { activity: a, plannedStart: day(s0), plannedEnd: day(e0), boqQty: q, gfcQty: q, unit: "Nos" });
      ok(r.status < 300, `activity ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
    }
    const g = await call(PLANNING, "POST", `/api/progress/${id}/scurve-points/generate`, { discipline: "OVERALL" });
    ok(g.status < 300, `generate ${g.status} ${JSON.stringify(g.body).slice(0, 140)}`);
    await open(page, `/projects/${id}/progress?tab=scurve`);
    await evidence("F4", "S-curve generated", PLANNING, page, { note: `${g.body.points} monthly points from ${g.body.activities} activities` });
  });

  await step("F5", "WPR weekly pack", OFFICE, async (page) => {
    const sizes = [];
    for (const k of ["download.xlsx", "download-client.xlsx", "download.pptx"]) {
      const r = await call(OFFICE, "GET", `/api/wpr-maker/${id}/${k}?weekEnding=${today}`);
      ok(r.status === 200, `${k} ${r.status} ${typeof r.body === "object" ? JSON.stringify(r.body).slice(0, 120) : ""}`);
      sizes.push(`${k} ${Math.round(r.bytes / 1024)}KB`);
    }
    await open(page, `/projects/${id}/wpr-maker`);
    await evidence("F5", "WPR weekly pack", OFFICE, page, { note: sizes.join(" · ") });
  });
}

// ── G. Logins and dashboards ────────────────────────────────────────────────────────────────────
async function sectionG({ projectId, ok, users: { OFFICE, SITE, VENDOR, CLIENT } }) {
  const id = await projectId();
  await step("G1", "Site employee home", SITE, async (page) => {
    await open(page, `/projects/${id}`);
    await evidence("G1", "Site employee home", SITE, page);
  });
  await step("G1b", "Site employee measurement access", SITE, async (page) => {
    const budget = await call(SITE, "GET", `/api/cost/${id}/download/budget.xlsx`);
    const mb = await call(SITE, "GET", `/api/cost/${id}/download/mb.xlsx`);
    ok(budget.status === 403 && mb.status === 200, `budget ${budget.status} (expect 403) · mb ${mb.status}`);
    await open(page, `/projects/${id}/cost?tab=mb&pkg=Dormitory%20Civil`);
    await evidence("G1b", "Site employee measurement access", SITE, page, { note: "MB/BBS open · budget refused 403" });
  });
  await step("G2", "Contractor home and action desk", VENDOR, async (page) => {
    await open(page, "/vendor-desk");
    await evidence("G2a", "Contractor home", VENDOR, page);
    const a = (await call(VENDOR, "GET", "/api/vendor-actions")).body;
    ok(a.actions?.length, "no actions for vendor");
    await open(page, "/vendor-actions");
    await evidence("G2", "Contractor home and action desk", VENDOR, page, { full: true, note: `your action ${a.counts.contractor} · with PMC ${a.counts.pmc} · closed ${a.counts.done}` });
  });
  await step("G3", "Client read-only desk", CLIENT, async (page) => {
    const w = await call(CLIENT, "POST", `/api/progress/${id}/hindrances`, { activity: "x", description: "client write" });
    ok(w.status >= 400, `client write allowed (${w.status})`);
    await open(page, `/projects/${id}`);
    await evidence("G3", "Client read-only desk", CLIENT, page, { note: `write refused ${w.status}` });
  });
  for (const [gid, mod, url] of [
    ["G4a", "Project overview", `/projects/${id}`],
    ["G4b", "Cost dashboard", `/projects/${id}/hub/cost`],
    ["G4c", "Finance overview", `/projects/${id}/finance?tab=overview`],
    ["G4d", "Quality dashboard", `/projects/${id}/inspections`],
    ["G4e", "Safety dashboard", `/projects/${id}/safety`],
    ["G4f", "Progress dashboard", `/projects/${id}/progress`],
  ]) {
    await step(gid, mod, OFFICE, async (page) => {
      await open(page, url);
      await evidence(gid, mod, OFFICE, page, { full: true });
    });
  }
}

// ── H. HR and design consultant ─────────────────────────────────────────────────────────────────
async function sectionH({ ok }) {
  const HR = "anushka.jha@spdc.in";
  const DES = "ak@consultant.demo";
  for (const [hid, title, url] of [
    ["H1", "HR attendance review", "/hrm/attendance"],
    ["H2", "HR leave desk", "/hrm/leave"],
    ["H3", "HR expense vouchers", "/hrm/vouchers"],
    ["H4", "HR payroll", "/hrm/payroll"],
  ]) {
    await step(hid, title, HR, async (page) => {
      await open(page, url);
      ok(!/\/login/.test(page.url()), `redirected to ${page.url()}`);
      await evidence(hid, title, HR, page);
    });
  }
  await step("H5", "Consultant RFI register", DES, async (page) => {
    const projects = (await call(DES, "GET", "/api/projects")).body;
    const arvind = (Array.isArray(projects) ? projects : []).find((p) => p.code === "SPDC-ARVIND-01");
    ok(arvind, "consultant does not see SPDC-ARVIND-01");
    await open(page, `/projects/${arvind.id}/rfis`);
    await evidence("H5", "Consultant RFI register", DES, page);
  });
  await step("H6", "Consultant design coordination", DES, async (page) => {
    const arvind = ((await call(DES, "GET", "/api/projects")).body || []).find((p) => p.code === "SPDC-ARVIND-01");
    await open(page, `/projects/${arvind.id}/drawings/coordination`);
    await evidence("H6", "Consultant design coordination", DES, page);
  });
}

export const sections = { B: sectionB, C: sectionC, D: sectionD, E: sectionE, F: sectionF, G: sectionG, H: sectionH };
