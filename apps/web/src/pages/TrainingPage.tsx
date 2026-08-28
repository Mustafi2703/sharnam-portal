/**
 * In-app Training / How-to module.
 *
 * Single source of truth for "how do I use this tool?" — one entry per feature
 * with step-by-step walkthroughs, exact button labels, real internal links,
 * and role notes.  Anyone new to the portal can search the module they need
 * and follow the numbered steps to run a real workflow end-to-end.
 *
 * Content is grouped by module family (Get started · Projects · Drawings ·
 * DMS · Quality · Safety · Progress · Cost · Finance · Comms · CRM · HRMS ·
 * Reports · Master · Audit) and searchable across title, roles, and steps.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, Input, PageHeader } from "../components/ui";
import { useAuth } from "../auth";

type Role = "admin" | "office" | "site_employee" | "employee" | "vendor" | "client";

type Guide = {
  id: string;
  group:
    | "Get started"
    | "Projects"
    | "Drawings"
    | "DMS"
    | "Quality"
    | "Safety"
    | "Progress"
    | "Cost"
    | "Finance"
    | "Comms"
    | "CRM"
    | "HRMS"
    | "Reports"
    | "Master"
    | "Audit";
  title: string;
  who: Role[];
  when: string;
  steps: string[];
  tips?: string[];
  openTo?: string;
  openLabel?: string;
};

const G: Guide[] = [
  {
    id: "get-started-login",
    group: "Get started",
    title: "Log in to the right portal (Office / Site / Vendor / Client)",
    who: ["admin", "office", "site_employee", "employee", "vendor", "client"],
    when: "First time using Sharnam Portal on a new device.",
    steps: [
      "Open portal.spdc.in — you land on the login hub with four portal cards.",
      "Pick the card that matches your role: Office team, Site desk, Contractor / Vendor, or Client.",
      "Enter your email and password. The portal remembers the last portal you used and skips the hub next time.",
      "On first login you land on the Dashboard — the top nav shows Dashboard · Modules · Master setup (office roles only).",
    ],
    tips: [
      "Forgot password → ask the Office admin to reset it from Access · Users.",
      "If a page refuses to load, do a hard refresh (Ctrl / Cmd + Shift + R) — the portal ships new UI often.",
    ],
    openTo: "/login",
    openLabel: "Open login hub",
  },
  {
    id: "get-started-modules",
    group: "Get started",
    title: "Find a module fast (Workspace / top-nav Modules)",
    who: ["admin", "office", "site_employee", "employee"],
    when: "You need a tool but can't remember where it lives.",
    steps: [
      "Click Modules in the top nav to open the Workspace grid.",
      "Every module card has a one-line summary and a 'Open' link — hover to see the primary sub-tools.",
      "For project-scoped tools (Drawings, DMS, Quality, Safety, Progress, Cost, Finance, Comms, Reports, Closure), pick a project first from the project switcher in the top-right.",
      "Global tools (CRM, HRMS, Master setup, Audit, Custom sheets) don't need a project.",
    ],
    openTo: "/workspace",
    openLabel: "Open workspace",
  },
  {
    id: "projects-create",
    group: "Projects",
    title: "Create a new project (with folder tree + starter checklists)",
    who: ["admin", "office"],
    when: "A new PMC engagement starts.",
    steps: [
      "Modules → Projects → New project.",
      "Fill Code (SPDC-XXX), Name, Client, Location, Type — Code is used everywhere as the project handle.",
      "Save. The portal auto-creates the ISO document tree in DMS, seeds default drawing types, and creates an empty vendor list.",
      "Open the project and go through the module hub tiles to configure who has access, drop initial drawings, and pick BOQ / MB / BBS templates from the global Master.",
    ],
    tips: [
      "Only admin or office roles can create / archive projects.",
      "Change project settings any time — Project tools → Directory / Project email settings.",
    ],
    openTo: "/projects",
    openLabel: "Open projects list",
  },
  {
    id: "drawings-register",
    group: "Drawings",
    title: "Add a drawing to the register + upload the first revision",
    who: ["admin", "office", "site_employee"],
    when: "GFC or design drawing arrives from the consultant.",
    steps: [
      "Open the project → Drawings → Drawing register.",
      "Click 'Add drawing'. Fill Drawing No (uppercase, e.g. STR-101), Title, Discipline, Stage (Concept / Design / GFC / Issued / As-built).",
      "Save. The row appears with R0 and status 'Planned'.",
      "Click 'Upload revision' on that row → drop the PDF / DWG. Fill revision code (R1, R2 …) and notes. The file is stored under DMS / drawings / <drawingNo>.",
      "Latest revision badge updates on the row. Older revisions stay accessible from the revision history panel.",
    ],
    tips: [
      "Bulk pre-check large sets in Drawings → Pre-check to catch missing sheets before formal upload.",
      "Use the Master → Site/Final Index master to prepare a per-project drawing plan first — you can drop that XLSX in the register upload.",
    ],
  },
  {
    id: "drawings-coordination",
    group: "Drawings",
    title: "Design coordination — mark up conflicts across disciplines",
    who: ["admin", "office", "site_employee"],
    when: "Structural, MEP, PEB and Arch drawings need to be checked for clashes / RFIs.",
    steps: [
      "Open the project → Drawings → Coordination.",
      "Pick a base drawing (usually the ARC or STR plan) and any overlay disciplines.",
      "Use the shape palette (rectangle · circle · arrow · triangle) to mark clash zones. Every markup captures author, date, and discipline.",
      "Click 'Raise RFI' from a markup to push it into the project RFI register with the drawing snapshot attached.",
      "Track resolution status directly on the markup: Open · In discussion · Resolved.",
    ],
    tips: [
      "Coordination markups are separate from BBS shapes — BBS shapes are for bar-bending cost, coordination shapes are for design clash tracking.",
    ],
  },
  {
    id: "dms-tree",
    group: "DMS",
    title: "Document management — ISO folder tree + SharePoint sync",
    who: ["admin", "office", "site_employee"],
    when: "Any project document needs to be filed / shared with client or vendors.",
    steps: [
      "Open the project → DMS.",
      "The left pane shows the ISO 21500 folder tree (Correspondence · Drawings · Contracts · Quality · Safety · Reports · Closure).",
      "Right-click any folder → 'Upload files'. Multi-file drag-and-drop works.",
      "Every file gets a SharePoint URL (mock during dev, live after UAT) — click 'Open in SharePoint' to edit inline.",
      "Use the search bar (top of DMS) to find any file across the whole tree — searches filename, uploader, and revision code.",
    ],
    tips: [
      "Files uploaded from Cost (invoices), Finance (RA bills, COP), Drawings (revisions), and HRMS (letters) all land in the DMS tree automatically — never orphaned.",
    ],
  },
  {
    id: "quality-qi",
    group: "Quality",
    title: "Quality inspection (QI) — assign, fill, close a checklist",
    who: ["admin", "office", "site_employee"],
    when: "Any activity needs an inspection log (concrete pour, plaster, brickwork, MEP rough-in …).",
    steps: [
      "Project → Quality inspections.",
      "Click 'Assign checklist' → pick a QI template from the Quality checklist master → choose activity, structure, and inspector.",
      "The inspector opens the notification → fills each item (Pass / Fail / N-A / Photo).",
      "On any Fail, click 'Raise NCR' — the NCR form auto-fills with the failing item, drawing reference, and photos.",
      "Close the log when all items are addressed. The checklist status shows on the Inspection register with a Sharnam-branded PDF export.",
    ],
    tips: [
      "New template needed? Master → Checklists → QualityInspection → Add template — reused on every project.",
    ],
  },
  {
    id: "safety-hse",
    group: "Safety",
    title: "Safety (HSE) — seed the SPDC pack + run daily / weekly / monthly logs",
    who: ["admin", "office", "site_employee"],
    when: "Site safety officer starts a new project or refreshes the master.",
    steps: [
      "Master → Safety checklist master → 'Seed SPDC HSE pack' — creates F-01 · F-02 · F-03 forms with all 127 line items.",
      "Project → Safety → Assign checklist → pick the frequency (Daily walk / Weekly audit / Monthly review).",
      "Site officer fills the log on tablet or phone — Photo per item is one tap.",
      "Any Fail opens the NCR flow with root-cause and closure date. Closure evidence attaches back to the same log.",
      "Safety dashboard (Reports → Safety) shows open findings by severity, days-to-close, and offender count per contractor.",
    ],
  },
  {
    id: "progress-dpr",
    group: "Progress",
    title: "DPR maker — build the day's diary in 5 minutes",
    who: ["admin", "office", "site_employee"],
    when: "End of shift, site engineer captures the day's progress.",
    steps: [
      "Project → Progress → DPR maker.",
      "Header auto-fills project, date, weather. Adjust manpower per contractor (block already lists all your vendors).",
      "Add activity rows: pick from BOQ line, enter today's qty, cumulative auto-computes.",
      "Attach photos per activity (drag-drop). Add safety / quality observations from the drop-down bindings to open NCRs.",
      "Click 'Save + Export PDF' — Sharnam-branded PDF goes to DMS / Reports / DPRs and mails to the distribution list.",
    ],
    tips: [
      "Missing yesterday? The seed script (scripts/seed-week-of-dprs.mts) generates a demo week you can edit.",
      "Delay flag — if any activity qty is 0 for 2 consecutive days it's auto-flagged red on the WPR roll-up.",
    ],
  },
  {
    id: "progress-wpr",
    group: "Progress",
    title: "WPR maker — weekly progress PPTX with charts and prints",
    who: ["admin", "office"],
    when: "End of week, PMC compiles the weekly report for the client.",
    steps: [
      "Project → Progress → WPR maker.",
      "Pick the week (Monday–Sunday). Portal pulls all DPRs, quality logs, safety logs, RFIs, and cost movement for that window.",
      "Review the auto-drafted narrative — edit the executive summary, risks, and next-week plan inline.",
      "Click 'Export PPTX' — Sharnam letterhead, per-activity progress %, S-curve chart, safety heat-map, photo strip.",
    ],
    tips: [
      "S-curve is generated from your MS Project XML export — drop it in Reports → Import schedule to activate the curve.",
      "If charts render sideways, the chart orientation fix is being worked on — for now use 'Export PPTX (fallback)' which uses static images.",
    ],
  },
  {
    id: "cost-boq",
    group: "Cost",
    title: "Cost — attach a BOQ per structure",
    who: ["admin", "office"],
    when: "New project starts and MB / BBS quantities need to be tracked.",
    steps: [
      "Project → Cost → BOQ tab.",
      "Pick a structure (or 'Add structure' — Tower A, Podium, PEB …).",
      "Upload the BOQ XLSX. Portal maps each line to a Sharnam MB / BBS master row so quantities can flow into RA bills.",
      "Every line shows contracted qty, executed qty (from DPRs), and remaining %.",
    ],
    tips: [
      "MB / BBS masters live in Master → Global masters — upload once, reuse on every project.",
    ],
  },
  {
    id: "cost-invoices",
    group: "Cost",
    title: "Cost — upload contractor invoices (drive-first, SharePoint later)",
    who: ["admin", "office"],
    when: "A contractor sends invoices for the current billing cycle.",
    steps: [
      "Project → Cost → 'Upload contractor invoices' card.",
      "Pick the contractor from the drop-down and drag-drop one or more invoice files (PDF / XLSX — any format).",
      "Each file is stored to SharePoint (mock during dev), and a VendorBill row is created with status 'Uploaded'.",
      "The invoice will now appear as an 'Unbilled invoice' checkbox when you create the next RA bill in Finance.",
    ],
  },
  {
    id: "finance-ra-bill",
    group: "Finance",
    title: "Finance — create a RA bill and link the uploaded invoices",
    who: ["admin", "office"],
    when: "Contractor's monthly bill needs certification.",
    steps: [
      "Project → Finance → RA bills tab.",
      "'New RA bill' → pick contractor, period, and bill number.",
      "Tick the invoices under 'Link unbilled invoices' — those files carry through to the payment summary and COP.",
      "Enter Submitted amount, Corrected amount (after check), Certified amount (after PMC approval). Each stage is its own file upload — Submitted / Corrected / Certified sheets are preserved as revisions.",
      "Save. The RA bill shows in the register with a stage badge and 'XLSX' / 'Print' actions.",
    ],
    tips: [
      "Sharnam Payment Summary sheet is generated automatically per contractor — download from the Bill register card.",
      "Every revision is timestamped and logged in the audit trail — no bill file is ever lost.",
    ],
  },
  {
    id: "finance-cop",
    group: "Finance",
    title: "Finance — generate the Certificate of Payment (COP)",
    who: ["admin", "office"],
    when: "The certified RA bill amount needs a signed COP.",
    steps: [
      "Project → Finance → RA bill register → click 'COP' on the certified row.",
      "Portal fills the Viatrix COP template layout (all particulars) but stamps it with Sharnam letterhead, logo, footer band, and the filename Sharnam-COP-*.xlsx.",
      "Two outputs: 'XLSX' (editable, opens in Excel / SharePoint) and 'Print' (Sharnam-branded HTML, use browser 'Print → Save as PDF').",
      "Signed COP goes to DMS / Contracts / COPs and mails to the finance distribution list.",
    ],
  },
  {
    id: "comms-mom",
    group: "Comms",
    title: "Comms — meeting agenda → MoM → follow-up loop",
    who: ["admin", "office", "site_employee"],
    when: "Before / during / after any project meeting.",
    steps: [
      "Project → Communications → 'New meeting'. Add title, date, attendees (auto-suggested from project directory).",
      "Draft the agenda — one row per topic with owner. Save + email agenda → attendees get a Sharnam-branded HTML mail.",
      "During the meeting, log discussion notes and action items inline. Each action captures owner, due date, and status.",
      "Click 'Open MoM (print → PDF)' for a printable Sharnam-letterhead MoM, or 'Download MoM .xlsx' for editable.",
      "'Email MoM to attendees' pushes the MoM + open follow-ups from prior meetings to every action owner.",
    ],
    tips: [
      "Prior open action items auto-attach to the next MoM — nothing slips through the cracks.",
    ],
  },
  {
    id: "crm-leads",
    group: "CRM",
    title: "CRM — import leads from your master XLSX",
    who: ["admin", "office"],
    when: "Bulk-loading leads from an existing spreadsheet.",
    steps: [
      "Modules → CRM → 'Import leads'.",
      "Drop the XLSX (the SPDC 14-column layout — matches Data - July 2026.xlsx).",
      "The importer upserts by (Sr No, Source sheet) — re-uploading the same file updates instead of creating duplicates.",
      "Preview shows created / updated / skipped counts before commit.",
      "Manage each lead's pipeline stage (New → Qualified → Proposal → Negotiation → Converted / Lost) directly on the row.",
    ],
  },
  {
    id: "crm-bid",
    group: "CRM",
    title: "Bid management — vendor BOQ upload + PMC comparative",
    who: ["admin", "office", "vendor"],
    when: "PMC issues a bid package and wants to compare vendor quotes.",
    steps: [
      "Office: Modules → Bid management → 'New bid package'. Pick project, discipline set, and target vendors.",
      "Portal auto-emails each vendor a link to upload their BOQ (secure per-vendor link).",
      "Vendor: My bid uploads → drop BOQ XLSX → hit submit. Portal locks the file with timestamp.",
      "Office: Bid package → Comparative view — vendors side-by-side, best-price per line highlighted, tie-breaker notes inline.",
      "Award vendor and export the awarded BOQ back into the project Cost as the working contract.",
    ],
  },
  {
    id: "hrms-recruit",
    group: "HRMS",
    title: "HRMS — recruitment → interview → offer",
    who: ["admin", "office"],
    when: "New position needs to be filled.",
    steps: [
      "HRMS → Recruitment → 'New requisition' from the hiring department (auto-routed to HR for approval).",
      "Once approved, add candidates (paste résumé, upload PDF, or import from LinkedIn CSV).",
      "Schedule interviews → interviewer submits feedback + scorecard. HR sees ranked shortlist.",
      "Click 'Make offer' on the selected candidate — pick the CTC template, fill 12 salary inputs, portal generates Annexure I + offer letter (Sharnam letterhead).",
      "Candidate accepts (magic link email) → HRMS → Onboarding page auto-opens for document collection.",
    ],
  },
  {
    id: "hrms-onboard",
    group: "HRMS",
    title: "HRMS — onboarding, appointment letter, IT asset request",
    who: ["admin", "office"],
    when: "Accepted candidate is joining.",
    steps: [
      "HRMS → Onboarding → the candidate's task list is auto-populated (documents, medical, bank, PAN, Aadhaar, IT asset request, ID card).",
      "Trigger 'Generate appointment letter' — the SPDC_Letter_of_Appointment.docx template is filled and rendered as PDF + editable copy.",
      "Assign an employee code (auto-suggested from department).",
      "Once every task is ticked, click 'Onboard' — employee is added to Directory and gets portal access at their assigned role.",
    ],
  },
  {
    id: "hrms-attend",
    group: "HRMS",
    title: "HRMS — attendance and leave",
    who: ["admin", "office", "site_employee", "employee"],
    when: "Daily attendance / leave application.",
    steps: [
      "Employee: HRMS → Attendance → 'Punch in' (site punch also available on the Site desk mobile card).",
      "Leave → 'Apply for leave' → pick type, dates, reason → routes to reporting manager.",
      "HR: HRMS → Masters → set holidays, leave policies per band, and shift patterns.",
      "Payroll → month-end cycle uses attendance + leave + CTC to run payslips (Sharnam-branded).",
    ],
  },
  {
    id: "reports-pptx",
    group: "Reports",
    title: "Reports — DPR PDF, WPR PPTX, QPR, Safety dashboard",
    who: ["admin", "office"],
    when: "Any client / management review.",
    steps: [
      "Project → Reports → pick DPR / WPR / QPR / Safety.",
      "DPR — daily, one page per day, Sharnam header, activity table, photos, safety/quality observations.",
      "WPR — one PPTX per week, S-curve, progress %, risks, next-week plan.",
      "QPR — quarterly wrap-up: milestones hit, cost variance, KRA/KPI snapshot, HSE performance.",
      "Every report is stored in DMS / Reports / <type>/<date>.",
    ],
    tips: [
      "Chart-orientation and print completeness on WPR PPTX are being tightened this week — flag any specific page that looks wrong and it'll be fixed in the next patch.",
    ],
  },
  {
    id: "master-hub",
    group: "Master",
    title: "Master setup — the 7 global masters",
    who: ["admin", "office"],
    when: "First-time setup or when a company-wide template changes.",
    steps: [
      "Modules → Master setup → 'Global masters' tab.",
      "The three panels at the top let you manage MB sheets, BBS sheet templates, BBS shape codes (IS-2502), and the Site / Final drawing index.",
      "Below are cards for Drawing-check master, Quality (QI) checklist master, and Safety checklist master — each opens the shared checklist editor filtered to that family.",
      "Every master has: Seed defaults · Add row · Upload XLSX · Download Sharnam-branded XLSX · Print info sheet.",
    ],
    openTo: "/master",
    openLabel: "Open Master setup",
  },
  {
    id: "master-site-index",
    group: "Master",
    title: "Site / Final drawing index master",
    who: ["admin", "office"],
    when: "You want a starter drawing register the PMC picks from on every project.",
    steps: [
      "Master → Global masters → Site / Final drawing index master.",
      "First time: 'Seed starter pack' — loads ~20 typical civil / MEP / PEB / as-built rows.",
      "Add your own drawings inline (Sr / Drawing No / Title / Discipline / Stage) or upload your XLSX.",
      "'Print info sheet' → Sharnam-branded HTML for hard-copy. 'Download .xlsx' → editable branded workbook.",
      "On each project, the drawings team picks the relevant subset — nothing is missed because the master is the source of truth.",
    ],
  },
  {
    id: "audit-kpi",
    group: "Audit",
    title: "Audit KPI — site audits, findings, KRA/KPI dashboard",
    who: ["admin", "office"],
    when: "Weekly / monthly review with client or leadership.",
    steps: [
      "Project → Audit KPI.",
      "'Run refresh' pulls live values from RFIs, drawings, RA bills, checklists — no manual entry.",
      "Each KPI subject shows target, actual, trend arrow, and last-updated timestamp.",
      "Add site audit findings inline; findings link back to the source module (drawing / checklist / RFI).",
      "Export the dashboard for the QPR pack.",
    ],
  },
  {
    id: "audit-trail",
    group: "Audit",
    title: "Audit trail — who did what and when",
    who: ["admin", "office"],
    when: "Any dispute over a change (bill amount, drawing revision, checklist status …).",
    steps: [
      "Top nav → Audit trail (office admins only).",
      "Filter by module, action, user, or date range.",
      "Every row shows user, IP, entity, before → after values.",
      "Export CSV for compliance / client sharing.",
    ],
    openTo: "/audit",
    openLabel: "Open audit trail",
  },
];

const GROUPS: Guide["group"][] = [
  "Get started",
  "Projects",
  "Drawings",
  "DMS",
  "Quality",
  "Safety",
  "Progress",
  "Cost",
  "Finance",
  "Comms",
  "CRM",
  "HRMS",
  "Reports",
  "Master",
  "Audit",
];

const ROLE_LABEL: Record<Role, string> = {
  admin: "Office admin",
  office: "Office",
  site_employee: "Site",
  employee: "Employee",
  vendor: "Contractor",
  client: "Client",
};

export default function TrainingPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<Guide["group"] | "All">("All");
  const [roleOnly, setRoleOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return G.filter((g) => {
      if (group !== "All" && g.group !== group) return false;
      if (roleOnly && user && !g.who.includes(user.role as Role)) return false;
      if (!q) return true;
      const hay = [
        g.title,
        g.group,
        g.when,
        g.who.map((r) => ROLE_LABEL[r]).join(" "),
        g.steps.join(" "),
        (g.tips || []).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [query, group, roleOnly, user]);

  return (
    <div className="mx-auto max-w-6xl w-full py-6 px-4 sm:px-6 space-y-6">
      <PageHeader
        eyebrow="How to · in-app training"
        title="Sharnam Portal — Training & tool guides"
        subtitle="Every module explained step-by-step, with exact button labels, roles, and direct links. Search a module or paste any keyword to jump straight to the walkthrough."
      />

      <Card className="!p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Search — try 'RA bill', 'MoM', 'DPR', 'BBS shape', 'onboarding'…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-[280px] flex-1"
          />
          <label className="inline-flex items-center gap-2 text-sm text-steel-muted border border-line rounded-sm px-3 py-1.5">
            <input
              type="checkbox"
              checked={roleOnly}
              onChange={(e) => setRoleOnly(e.target.checked)}
            />
            Only my role ({user ? ROLE_LABEL[user.role as Role] || user.role : "guest"})
          </label>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(["All", ...GROUPS] as const).map((g) => (
            <Button
              key={g}
              type="button"
              variant={group === g ? "primary" : "ghost"}
              className="!text-xs !py-1 !px-2.5"
              onClick={() => setGroup(g)}
            >
              {g}
            </Button>
          ))}
        </div>

        <p className="text-xs text-steel-muted">
          {filtered.length} of {G.length} guides shown.
        </p>
      </Card>

      <div className="space-y-4">
        {GROUPS.filter((g) => filtered.some((x) => x.group === g)).map((g) => {
          const rows = filtered.filter((x) => x.group === g);
          return (
            <section key={g} className="space-y-3">
              <h2 className="font-display text-lg text-steel">
                {g}
                <span className="text-steel-muted text-sm font-mono ml-2">
                  ({rows.length})
                </span>
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {rows.map((r) => (
                  <Card key={r.id} className="!p-5 space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge tone="brand">{r.group}</Badge>
                        {r.who.map((role) => (
                          <Badge key={role} tone="neutral">
                            {ROLE_LABEL[role]}
                          </Badge>
                        ))}
                      </div>
                      <h3 className="font-display text-base leading-snug">{r.title}</h3>
                      <p className="text-xs text-steel-muted italic">Use when: {r.when}</p>
                    </div>

                    <ol className="text-sm space-y-1.5 list-decimal ml-5">
                      {r.steps.map((s, i) => (
                        <li key={i} className="text-steel">{s}</li>
                      ))}
                    </ol>

                    {r.tips && r.tips.length > 0 && (
                      <div className="text-xs bg-brand-soft border border-brand/20 rounded-sm p-2.5 space-y-1">
                        <div className="font-semibold text-brand uppercase tracking-wide text-[10px]">
                          Tips
                        </div>
                        {r.tips.map((t, i) => (
                          <div key={i} className="text-steel">• {t}</div>
                        ))}
                      </div>
                    )}

                    {r.openTo && (
                      <Link
                        to={r.openTo}
                        className="inline-block text-xs font-semibold text-brand hover:underline"
                      >
                        {r.openLabel || "Open"} →
                      </Link>
                    )}
                  </Card>
                ))}
              </div>
            </section>
          );
        })}

        {!filtered.length && (
          <Card className="!p-6 text-center text-steel-muted">
            No guides match your filters. Try clearing the search or picking another group.
          </Card>
        )}
      </div>

      <Card className="!p-5 text-sm text-steel-muted space-y-2 border-brand/30">
        <div className="font-semibold text-steel">Something missing?</div>
        <p>
          These guides are versioned with the app. If a tool changed and the steps look stale, or a
          feature is missing from the list, ping the PMC dev team — updates go live within the same
          deploy cycle.
        </p>
        <p>
          For anything not covered here, the raw workflow specs live in{" "}
          <code className="font-mono text-xs bg-paper px-1 py-0.5 rounded-sm">
            module_prompts/Sharnam_modules_docs 2/
          </code>{" "}
          in the source repo.
        </p>
      </Card>
    </div>
  );
}
