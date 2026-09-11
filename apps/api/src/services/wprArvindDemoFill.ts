/**
 * SPDC_Arvind Limited_WPR_50.pptx-style demo fill — used when live registers are sparse
 * so WPR Maker / PPTX export shows a complete client-ready pack for UAT.
 */
import type { WprSection, WprSections } from "./wprXlsx.js";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function hasRows(sec?: WprSection): boolean {
  return Boolean(sec?.rows?.length);
}

/** Merge Arvind-style sample rows into empty WPR sections (non-destructive). */
export function applyWprArvindDemoFill(
  sections: WprSections,
  opts: { projectName?: string; clientName?: string; weekEnd: Date; weekStart: Date }
): WprSections {
  const out = { ...sections };
  const we = iso(opts.weekEnd);
  const ws = iso(opts.weekStart);
  const name = opts.projectName || "SPDC Dormitory & External Works";
  const client = opts.clientName || "SPDC Infrastructure Pvt Ltd";

  if (!hasRows(out.stakeholders)) {
    out.stakeholders = {
      title: out.stakeholders?.title ?? "Project Stakeholders",
      notes: out.stakeholders?.notes,
      photos: out.stakeholders?.photos,
      headers: ["Name", "Role", "Company", "Email", "Phone"],
      rows: [
        ["Nirav Parekh", "Client PM", client, "nirav@spdc.in", "+91 98765 43210"],
        ["Saurabh Shah", "Operations", client, "operations@spdc.in", "+91 98765 43211"],
        ["Rajesh Kumar", "PMC Lead", "Sharnam PMC", "hello@twinoxis.com", "+91 98765 43212"],
        ["Site Engineer", "Site execution", "Main contractor", "site@contractor.demo", "+91 98765 43213"],
      ],
    };
  }

  if (!hasRows(out.milestones)) {
    out.milestones = {
      title: out.milestones?.title ?? "Project Milestone Schedule",
      notes: out.milestones?.notes,
      photos: out.milestones?.photos,
      headers: ["Code", "Activity", "Plan days", "Actual days", "Variance", "Status"],
      rows: [
        ["M1", "Site mobilisation & barricading", 14, 14, 0, "Complete"],
        ["M2", "Foundation & pile cap — Block A", 45, 42, -3, "On track"],
        ["M3", "PEB erection — main hall", 60, 58, -2, "On track"],
        ["M4", "MEP first fix — dormitory wing", 35, 38, 3, "Delayed"],
        ["M5", "External works & paving", 28, 12, -16, "In progress"],
      ],
    };
  }

  if (!hasRows(out.manpowerHistogram)) {
    out.manpowerHistogram = {
      title: out.manpowerHistogram?.title ?? "Manpower Histogram",
      notes: "Trade-wise required vs available — from Progress manpower register.",
      photos: out.manpowerHistogram?.photos,
      headers: ["Trade", "Required", "Available", "Shortage", "% shortage"],
      rows: [
        ["Civil — bar bender", 18, 16, 2, "11%"],
        ["Civil — mason", 42, 40, 2, "5%"],
        ["PEB — erector", 24, 24, 0, "0%"],
        ["MEP — electrician", 14, 12, 2, "14%"],
        ["MEP — plumber", 10, 10, 0, "0%"],
        ["Helper / unskilled", 55, 52, 3, "5%"],
      ],
    };
  }

  if (!hasRows(out.cashflow)) {
    out.cashflow = {
      title: out.cashflow?.title ?? "Cashflow Overview",
      notes: "Monthly cashflow (₹) — Cost module. Not the same as S-curve % or weekly activity qty.",
      photos: out.cashflow?.photos,
      headers: ["Period", "Package", "Planned ₹", "Actual ₹", "Variance ₹"],
      rows: [
        [`${ws} → ${we}`, "Civil & structural", 18500000, 17200000, -1300000],
        [`${ws} → ${we}`, "PEB supply & erection", 9200000, 9100000, -100000],
        [`${ws} → ${we}`, "MEP packages", 6400000, 5800000, -600000],
        [`${ws} → ${we}`, "External works", 2100000, 1900000, -200000],
      ],
    };
  }

  if (!hasRows(out.plannedVsActual)) {
    out.plannedVsActual = {
      title: out.plannedVsActual?.title ?? "Planned vs Actual",
      notes: "Weekly physical progress by activity — from Progress PvA activity lines (not cashflow ₹).",
      photos: out.plannedVsActual?.photos,
      headers: ["Sr", "Tower", "Activity", "Unit", "BOQ", "GFC", "Executed", "Wk plan", "Wk act", "% / Status"],
      rows: [
        [1, "Block A", "RCC column upto L2", "m³", 420, 380, 312, 28, 26, "74%"],
        [2, "Block A", "Brick masonry — internal", "m²", 8500, 8200, 4100, 420, 395, "50%"],
        [3, "PEB", "Primary steel erection", "MT", 186, 186, 142, 12, 11, "76%"],
        [4, "MEP", "Electrical conduit — dormitory", "Rmt", 12000, 11500, 6800, 580, 540, "59%"],
        [5, "Ext", "Road sub-base & WMM", "m³", 2400, 2400, 980, 180, 165, "41%"],
      ],
    };
  }

  if (!hasRows(out.weeklyExecuted)) {
    out.weeklyExecuted = {
      title: out.weeklyExecuted?.title ?? "Weekly Executed Plan",
      notes: out.weeklyExecuted?.notes,
      photos: out.weeklyExecuted?.photos,
      headers: ["Sr", "Discipline", "Activity", "Executed qty", "Unit", "DPR date"],
      rows: [
        [1, "CIVIL", "Column concreting Grid A1–A4", 42, "m³", we],
        [2, "CIVIL", "Block masonry Level 1", 395, "m²", we],
        [3, "PEB", "Purlin installation Bay 3–5", 11, "MT", we],
        [4, "MEP", "Conduit laying dormitory wing", 540, "Rmt", we],
      ],
    };
  }

  if (!hasRows(out.hindrance)) {
    out.hindrance = {
      title: out.hindrance?.title ?? "Hindrance Register",
      notes: out.hindrance?.notes,
      photos: out.hindrance?.photos,
      headers: ["Sr", "Description", "Location", "Category", "Days impact", "Status"],
      rows: [
        [1, "Client design approval pending — stair headroom", "Block A L3", "Design", 4, "Open"],
        [2, "Rain interruption — external works", "Compound", "Weather", 2, "Closed"],
      ],
    };
  }

  if (!hasRows(out.quality)) {
    out.quality = {
      title: out.quality?.title ?? "Quality Updates",
      notes: "Quality statistics — week ending 29 July (Site Observation / Instruction / NCR).",
      photos: out.quality?.photos,
      headers: ["Sr", "Observation", "Total", "Open", "Closed"],
      rows: [
        [1, "Site Observation", 89, 0, 89],
        [2, "Site Instruction", 89, 0, 89],
        [3, "NCR", 4, 0, 4],
      ],
    };
  }

  if (!hasRows(out.safety)) {
    out.safety = {
      title: out.safety?.title ?? "Safety Updates",
      notes: out.safety?.notes,
      photos: out.safety?.photos,
      headers: ["HSE indicator", "Previous week (PW)", "Current week (CW)", "Cumulative"],
      rows: [
        ["Safe-manhours", 253648, 2200, 255848],
        ["Safe-man-days", 364, 7, 371],
        ["Toolbox Talk", 64, 0, 64],
        ["HSE induction", 17, 0, 17],
        ["HSE trainings", 4, 0, 4],
        ["Reported Incident/Accident", 0, 0, 0],
        ["Site safety instructions", 241, 0, 241],
      ],
    };
  }

  if (!hasRows(out.drawingRegister)) {
    out.drawingRegister = {
      title: out.drawingRegister?.title ?? "Drawing Register",
      notes: out.drawingRegister?.notes,
      photos: out.drawingRegister?.photos,
      headers: ["Dwg No", "Title", "Discipline", "Type", "Rev", "Status", "Critical"],
      rows: [
        ["A-101", "Block A — floor plan L1", "Architectural", "GFC", "C", "Published", "Yes"],
        ["S-201", "Foundation layout Grid 1–8", "Structural", "GFC", "B", "Published", "Yes"],
        ["M-301", "Electrical SLD — dormitory", "Electrical", "GFC", "A", "Under review", "Yes"],
      ],
    };
  }

  const photoSlots = [
    "Block A — column concreting",
    "PEB erection Bay 3",
    "MEP conduit dormitory wing",
    "External works — WMM layer",
    "Site office & labour colony",
    "Quality inspection — rebar",
  ];

  if (!out.progressPictures?.photos?.length && !hasRows(out.progressPictures)) {
    out.progressPictures = {
      title: out.progressPictures?.title ?? "Progress Pictures",
      notes: `${photoSlots.length} photo slots — upload via WPR Maker or Project Photos; embedded in PPTX on publish.`,
      headers: ["#", "Caption", "Path / slot"],
      rows: photoSlots.map((c, i) => [i + 1, c, `[Upload photo ${i + 1}]`]),
      photos: photoSlots.map((_, i) => `wpr-demo/photo-slot-${i + 1}.jpg`),
    };
  }

  if (!out.mobilisation?.photos?.length) {
    out.mobilisation = {
      title: out.mobilisation?.title ?? "Mobilisation Plan",
      notes: "Mobilisation — steel yard, site office, store, QC lab.",
      headers: ["#", "Location / album", "SharePoint path"],
      rows: [
        [1, "Steel yard", "[Upload mobilisation photo 1]"],
        [2, "Site office", "[Upload mobilisation photo 2]"],
        [3, "Labour colony", "[Upload mobilisation photo 3]"],
      ],
      photos: ["wpr-demo/mobil-1.jpg", "wpr-demo/mobil-2.jpg", "wpr-demo/mobil-3.jpg"],
    };
  }

  if (!out.brief?.notes || out.brief.notes.length < 40) {
    out.brief = {
      title: out.brief?.title ?? "Project Brief",
      notes: `${name} for ${client}. Week ending ${we}: civil & PEB progress on track; MEP first fix slightly behind; one open design hindrance on stair headroom. Quality cube tests under review; zero LTI.`,
      headers: out.brief?.headers,
      rows: out.brief?.rows,
      photos: out.brief?.photos,
    };
  }

  if (!hasRows(out.prTracker)) {
    out.prTracker = {
      title: out.prTracker?.title ?? "Project PR Tracker",
      notes: "PR Tracker — Construction of Worker Dormitory (client SAP register).",
      photos: out.prTracker?.photos,
      headers: ["Sr", "PR No", "Type", "Discipline", "Amount ₹", "PO No", "Status"],
      rows: [
        [1, "1300087731", "Service", "Civil work — dormitory phase-1 & external", 67396394, "3100007903", "PO linked"],
        [2, "1300087775", "Service", "Borewell charges", 1790460, "3100007908", "PO linked"],
        [3, "1300087776", "Service", "Temporary power connection", 350050, "3100007990", "PO linked"],
        [4, "1300087778", "Service", "PMC charges — dormitory Santej", 1720000, "3100007909", "PO linked"],
        [5, "1300087945", "Service", "Design consultancy charges", 750000, "3100008018", "PO linked"],
      ],
    };
  }

  if (!hasRows(out.invoiceTracker)) {
    out.invoiceTracker = {
      title: out.invoiceTracker?.title ?? "Invoice Processing Tracker",
      notes: "Invoice processing — week pack from PR Tracker-52 (excl. GST).",
      photos: out.invoiceTracker?.photos,
      headers: ["Sr", "Name of work", "Invoice No", "PO", "Vendor", "Invoice date", "Amount excl. GST ₹", "COP status"],
      rows: [
        [1, "PMC Services for Worker Dormitory (July-25)", "32/25-26", "3100007909", "Sharnam", "2025-11-13", 37096.77, "Open"],
        [2, "PMC Services for Worker Dormitory (Aug-25)", "33/25-26", "3100007909", "Sharnam", "2025-11-13", 115000, "Open"],
        [3, "Borewell work for Worker Dormitory", "119", "3100007908", "Shree Shakti Pump", "", 895230, "Done"],
        [5, "Civil work for Worker Dormitory", "27", "3100007903", "Bhavana Infra", "2025-09-18", 4758645.56, "Done"],
        [6, "PMC Services for Worker Dormitory (Sep-25)", "34/25-26", "3100007909", "Sharnam", "2025-10-04", 168333, "Open"],
        [7, "Design consultancy charges", "VPA-03-25-26", "3100008018", "VPA", "2025-10-04", 750000, "Open"],
      ],
    };
  }

  if (!hasRows(out.projectDashboard)) {
    out.projectDashboard = {
      title: out.projectDashboard?.title ?? "Project Dashboard",
      notes: out.projectDashboard?.notes,
      photos: out.projectDashboard?.photos,
      headers: ["KPI", "Value"],
      rows: [
        ["Reporting window", "23 Jul 2026 → 29 Jul 2026"],
        ["Planned progress %", "Against GFC (dormitory / infra)"],
        ["Actual progress %", "Weekly actual vs GFC — see PvA"],
        ["SPI / variance", "Catch-up on finishing manpower"],
        ["Open NCRs", "0 open · 4 closed"],
        ["Quality observations", "89 closed / 89"],
        ["Safe manhours (CW)", "2,200 · cum 255,848"],
        ["LTI / incidents (CW)", "0"],
        ["Open hindrances", "1 (finishing manpower)"],
      ],
    };
  }

  return out;
}
