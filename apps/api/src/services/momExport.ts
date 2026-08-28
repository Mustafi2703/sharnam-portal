/**
 * Minutes of Meeting export — Sharnam letterhead print-HTML (browser → PDF)
 * and matching branded XLSX so the same MoM can travel by email / DMS.
 *
 * Layout mirrors the standard SPDC MoM one-pager:
 *   Header  · Sharnam logo · project · meeting no. / date / location / duration
 *   Attendees  · role · organisation · email
 *   Agenda     · numbered items as issued before the meeting
 *   MoM notes  · discussion + decisions per agenda item
 *   Action items · description · owner · due · priority · status
 *   Open follow-ups from prior meeting (rolled over)
 *   Signatories · PMC · Client · Contractor
 */

import fs from "fs";
import ExcelJS from "exceljs";
import { prisma } from "../prisma.js";
import { sharnamLogoDataUri, sharnamLogoPath } from "./brandedExport.js";

type MeetingItemRow = {
  id: string;
  category: string;
  description: string;
  priority: string;
  resolutionStatus: string;
  dueDate: Date | null;
  assignedTo: { fullName: string; email: string } | null;
};

type MeetingBundle = {
  meeting: {
    id: string;
    projectId: string;
    title: string;
    status: string;
    meetingDate: Date;
    location: string | null;
    durationMins: number;
    teamsJoinUrl: string | null;
    parentMeetingId: string | null;
    agendaNotes: string | null;
    project: { id: string; code: string; name: string; location: string | null } | null;
    items: MeetingItemRow[];
  };
  parentActions: MeetingItemRow[];
};

async function loadMeetingBundle(meetingId: string): Promise<MeetingBundle> {
  const raw = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      project: { select: { id: true, code: true, name: true, location: true } },
      items: {
        include: { assignedTo: { select: { fullName: true, email: true } } },
      },
    },
  });
  if (!raw) throw new Error("Meeting not found");

  const parentActionsRaw = raw.parentMeetingId
    ? await prisma.meetingItem.findMany({
        where: {
          meetingId: raw.parentMeetingId,
          category: { in: ["Action", "Follow-up"] },
          resolutionStatus: { in: ["Open", "InProgress", "Carried Over"] },
        },
        include: { assignedTo: { select: { fullName: true, email: true } } },
      })
    : [];

  const mapItem = (i: {
    id: string;
    category: string;
    description: string;
    priority: string;
    resolutionStatus: string;
    dueDate: Date | null;
    assignedTo: { fullName: string; email: string } | null;
  }): MeetingItemRow => ({
    id: i.id,
    category: i.category,
    description: i.description,
    priority: i.priority,
    resolutionStatus: i.resolutionStatus,
    dueDate: i.dueDate,
    assignedTo: i.assignedTo,
  });

  return {
    meeting: {
      id: raw.id,
      projectId: raw.projectId,
      title: raw.title,
      status: raw.status,
      meetingDate: raw.meetingDate,
      location: raw.location,
      durationMins: raw.durationMins,
      teamsJoinUrl: raw.teamsJoinUrl,
      parentMeetingId: raw.parentMeetingId,
      agendaNotes: raw.agendaNotes,
      project: raw.project,
      items: raw.items.map(mapItem),
    },
    parentActions: parentActionsRaw.map(mapItem),
  };
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function esc(s: string | number | null | undefined): string {
  return String(s ?? "").replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!
  );
}

/** Extract attendees from agenda notes when they were saved as JSON, else fallback to
 *  any users mentioned in item assignments so PMC / Client / Contractor rows still print. */
function resolveAttendees(bundle: MeetingBundle): { name: string; role: string; email: string }[] {
  const raw = bundle.meeting.agendaNotes || "";
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.attendees)) {
      return parsed.attendees
        .filter((a: unknown) => typeof a === "object" && a)
        .map((a: any) => ({
          name: String(a.name || a.fullName || a.email || "").trim(),
          role: String(a.role || a.designation || "").trim(),
          email: String(a.email || "").trim(),
        }))
        .filter((a: { name: string }) => a.name);
    }
  } catch {
    /* raw text notes — extract emails as attendees */
  }
  const emails = new Set<string>();
  const attendees: { name: string; role: string; email: string }[] = [];
  for (const it of bundle.meeting.items) {
    if (it.assignedTo?.email && !emails.has(it.assignedTo.email)) {
      emails.add(it.assignedTo.email);
      attendees.push({
        name: it.assignedTo.fullName || it.assignedTo.email,
        role: "Action owner",
        email: it.assignedTo.email,
      });
    }
  }
  return attendees;
}

export function renderMomHtml(bundle: MeetingBundle): string {
  const { meeting, parentActions } = bundle;
  const agenda = meeting.items.filter((i) => i.category === "Agenda");
  const notes = meeting.items.filter((i) => i.category === "MoM");
  const actions = meeting.items.filter((i) => i.category === "Action" || i.category === "Follow-up");
  const attendees = resolveAttendees(bundle);

  const logo = sharnamLogoDataUri();

  const rows = (items: typeof meeting.items) =>
    items.length === 0
      ? `<tr><td colspan="5" class="empty">No items recorded.</td></tr>`
      : items
          .map(
            (it, idx) => `
            <tr>
              <td class="c num">${idx + 1}</td>
              <td>${esc(it.description)}</td>
              <td class="c">${esc(it.assignedTo?.fullName || "—")}</td>
              <td class="c">${fmtDate(it.dueDate)}</td>
              <td class="c">
                <span class="tag tag--${it.resolutionStatus.replace(/\s+/g, "").toLowerCase()}">${esc(it.resolutionStatus)}</span>
              </td>
            </tr>`
          )
          .join("");

  const attendeeRows = attendees.length
    ? attendees
        .map(
          (a, i) => `
          <tr>
            <td class="c num">${i + 1}</td>
            <td>${esc(a.name)}</td>
            <td>${esc(a.role || "—")}</td>
            <td>${esc(a.email || "—")}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="4" class="empty">Attendee list not captured — add via the MoM UI or set attendees in agendaNotes JSON.</td></tr>`;

  const openRows = parentActions.length
    ? parentActions
        .map(
          (it, idx) => `
          <tr>
            <td class="c num">${idx + 1}</td>
            <td>${esc(it.description)}</td>
            <td class="c">${esc(it.assignedTo?.fullName || "—")}</td>
            <td class="c">${fmtDate(it.dueDate)}</td>
            <td class="c"><span class="tag tag--carriedover">Carried over</span></td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="5" class="empty">No open follow-ups from prior MoM.</td></tr>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>MoM — ${esc(meeting.title)} — ${esc(meeting.project?.code || "")}</title>
<style>
  @page { size: A4; margin: 12mm 14mm; }
  body { font-family: "Inter", "Segoe UI", Arial, sans-serif; color: #111; font-size: 11px; line-height: 1.4; margin: 0; }
  .letterhead { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid #b28c3c; padding-bottom: 10px; margin-bottom: 12px; }
  .letterhead img { height: 52px; width: auto; }
  .letterhead .brand { flex: 1; }
  .letterhead h1 { margin: 0; font-size: 15px; letter-spacing: 0.3px; color: #b28c3c; }
  .letterhead .co { font-size: 10px; color: #444; margin-top: 2px; }
  .letterhead .doc { text-align: right; font-size: 10px; color: #555; }
  .letterhead .doc b { color: #111; font-size: 12px; }
  .band { background: #f7f2e6; border: 1px solid #e0d3ac; padding: 8px 10px; border-radius: 4px; margin-bottom: 12px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px 12px; font-size: 10.5px; }
  .band .k { color: #6b5a2e; font-weight: 600; font-size: 9.5px; letter-spacing: 0.4px; text-transform: uppercase; }
  h2 { color: #4a3a12; font-size: 12px; margin: 14px 0 6px; padding-bottom: 3px; border-bottom: 1px solid #d6c691; text-transform: uppercase; letter-spacing: 0.4px; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 6px; }
  th, td { border: 1px solid #d0c9b3; padding: 5px 7px; vertical-align: top; }
  th { background: #efe4c4; color: #4a3a12; font-weight: 700; font-size: 10px; text-align: left; }
  td.c { text-align: center; white-space: nowrap; }
  td.num { width: 24px; color: #6b5a2e; }
  .empty { text-align: center; color: #888; font-style: italic; }
  .tag { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 9.5px; font-weight: 600; }
  .tag--open { background: #fef3c7; color: #92400e; }
  .tag--inprogress { background: #dbeafe; color: #1e40af; }
  .tag--closed, .tag--completed { background: #d1fae5; color: #065f46; }
  .tag--carriedover { background: #fde68a; color: #7c2d12; }
  .signs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 18px; }
  .signs .b { border-top: 1px solid #333; padding-top: 4px; font-size: 10px; color: #333; text-align: center; }
  .footer { border-top: 1px solid #ddd; margin-top: 14px; padding-top: 6px; color: #666; font-size: 9.5px; display: flex; justify-content: space-between; }
</style>
</head>
<body>
  <div class="letterhead">
    ${logo ? `<img src="${logo}" alt="Sharnam" />` : ""}
    <div class="brand">
      <h1>Sharnam Project Development Consultants &amp; Co.</h1>
      <div class="co">Project management consultancy · Ahmedabad, India</div>
    </div>
    <div class="doc">
      <b>Minutes of Meeting</b><br/>
      Ref · ${esc(meeting.id.slice(0, 8).toUpperCase())}<br/>
      Status · ${esc(meeting.status)}
    </div>
  </div>

  <div class="band">
    <div><div class="k">Project</div>${esc(meeting.project?.code || "")} · ${esc(meeting.project?.name || "")}</div>
    <div><div class="k">Title</div>${esc(meeting.title)}</div>
    <div><div class="k">Date</div>${fmtDateTime(meeting.meetingDate)}</div>
    <div><div class="k">Duration</div>${esc(meeting.durationMins || 60)} min</div>
    <div><div class="k">Location</div>${esc(meeting.location || meeting.teamsJoinUrl || "—")}</div>
    <div><div class="k">Chaired by</div>Sharnam PMC</div>
    <div><div class="k">Prepared by</div>Sharnam PMC · Office</div>
    <div><div class="k">Distribution</div>Attendees · Client · Contractor</div>
  </div>

  <h2>Attendees</h2>
  <table>
    <thead><tr><th style="width:24px">#</th><th>Name</th><th style="width:22%">Role</th><th style="width:30%">Email</th></tr></thead>
    <tbody>${attendeeRows}</tbody>
  </table>

  <h2>Agenda</h2>
  <table>
    <thead><tr><th style="width:24px">#</th><th>Agenda item</th><th style="width:15%">Owner</th><th style="width:14%">Due</th><th style="width:12%">Status</th></tr></thead>
    <tbody>${rows(agenda)}</tbody>
  </table>

  <h2>Discussion &amp; Decisions</h2>
  <table>
    <thead><tr><th style="width:24px">#</th><th>Note</th><th style="width:15%">Owner</th><th style="width:14%">Due</th><th style="width:12%">Status</th></tr></thead>
    <tbody>${rows(notes)}</tbody>
  </table>

  <h2>Action Items</h2>
  <table>
    <thead><tr><th style="width:24px">#</th><th>Action</th><th style="width:15%">Owner</th><th style="width:14%">Due</th><th style="width:12%">Status</th></tr></thead>
    <tbody>${rows(actions)}</tbody>
  </table>

  <h2>Open Follow-ups from Prior Meeting</h2>
  <table>
    <thead><tr><th style="width:24px">#</th><th>Item</th><th style="width:15%">Owner</th><th style="width:14%">Due</th><th style="width:12%">Status</th></tr></thead>
    <tbody>${openRows}</tbody>
  </table>

  <div class="signs">
    <div class="b">Sharnam PMC</div>
    <div class="b">Client Representative</div>
    <div class="b">Main Contractor</div>
  </div>

  <div class="footer">
    <span>Generated ${fmtDateTime(new Date())}</span>
    <span>Sharnam Project Development Consultants &amp; Co. · Confidential</span>
  </div>
</body>
</html>`;
}

export async function buildMomXlsxBuffer(bundle: MeetingBundle): Promise<Buffer> {
  const { meeting } = bundle;
  const attendees = resolveAttendees(bundle);
  const agenda = meeting.items.filter((i) => i.category === "Agenda");
  const notes = meeting.items.filter((i) => i.category === "MoM");
  const actions = meeting.items.filter((i) => i.category === "Action" || i.category === "Follow-up");

  const wb = new ExcelJS.Workbook();
  wb.creator = "Sharnam PMC Portal";
  wb.created = new Date();

  const cover = wb.addWorksheet("Cover");
  cover.getColumn(1).width = 22;
  cover.getColumn(2).width = 58;
  const logoPath = sharnamLogoPath();
  if (logoPath && fs.existsSync(logoPath)) {
    try {
      const id = wb.addImage({ filename: logoPath, extension: "png" });
      cover.addImage(id, { tl: { col: 3.1, row: 0.2 }, ext: { width: 120, height: 60 } });
    } catch {
      /* logo optional */
    }
  }
  const rowsCover: (string | number)[][] = [
    ["Sharnam Project Development Consultants & Co.", ""],
    ["Minutes of Meeting", ""],
    [meeting.title, ""],
    ["Project", `${meeting.project?.code || ""} · ${meeting.project?.name || ""}`],
    ["Date", fmtDateTime(meeting.meetingDate)],
    ["Duration", `${meeting.durationMins || 60} min`],
    ["Location", meeting.location || meeting.teamsJoinUrl || "—"],
    ["Status", meeting.status],
    ["Prepared by", "Sharnam PMC · Office"],
    ["Generated", fmtDateTime(new Date())],
    ["", ""],
    ["Sheets", "Attendees · Agenda · Discussion · Actions · Open follow-ups"],
  ];
  rowsCover.forEach((r) => cover.addRow(r));
  cover.getRow(1).font = { bold: true, size: 13, color: { argb: "FFB28C3C" } };
  cover.getRow(2).font = { bold: true, size: 11 };
  cover.getRow(3).font = { italic: true, size: 11 };

  const write = (name: string, headers: string[], data: (string | number | null)[][]) => {
    const ws = wb.addWorksheet(name);
    ws.columns = headers.map((h) => ({ header: h, key: h, width: Math.max(12, Math.min(60, h.length + 4)) }));
    ws.getRow(1).font = { bold: true, color: { argb: "FF4A3A12" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFE4C4" } };
    data.forEach((r) => ws.addRow(r));
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  };

  write(
    "Attendees",
    ["#", "Name", "Role", "Email"],
    attendees.length
      ? attendees.map((a, i) => [i + 1, a.name, a.role || "—", a.email || "—"])
      : [[1, "—", "Not captured", "—"]]
  );

  const mapItems = (items: typeof meeting.items) =>
    items.length
      ? items.map((it, i) => [
          i + 1,
          it.description,
          it.assignedTo?.fullName || "—",
          it.dueDate ? fmtDate(it.dueDate) : "—",
          it.priority,
          it.resolutionStatus,
        ])
      : [[1, "No items", "—", "—", "—", "—"]];

  write("Agenda", ["#", "Item", "Owner", "Due", "Priority", "Status"], mapItems(agenda));
  write("Discussion", ["#", "Note", "Owner", "Due", "Priority", "Status"], mapItems(notes));
  write("Actions", ["#", "Action", "Owner", "Due", "Priority", "Status"], mapItems(actions));

  const openItems = bundle.parentActions.length
    ? bundle.parentActions.map((it, i) => [
        i + 1,
        it.description,
        it.assignedTo?.fullName || "—",
        it.dueDate ? fmtDate(it.dueDate) : "—",
        it.priority,
        "Carried Over",
      ])
    : [[1, "No open follow-ups from prior meeting", "—", "—", "—", "—"]];
  write("Open follow-ups", ["#", "Item", "Owner", "Due", "Priority", "Status"], openItems as (string | number | null)[][]);

  const ab = await wb.xlsx.writeBuffer();
  return Buffer.from(ab as ArrayBuffer);
}

export async function generateMomExport(meetingId: string): Promise<{
  html: string;
  xlsx: Buffer;
  filenameBase: string;
}> {
  const bundle = await loadMeetingBundle(meetingId);
  const html = renderMomHtml(bundle);
  const xlsx = await buildMomXlsxBuffer(bundle);
  const safe = `${bundle.meeting.project?.code || "MOM"}-${bundle.meeting.title.replace(/[^A-Za-z0-9]+/g, "-")}-${bundle.meeting.meetingDate.toISOString().slice(0, 10)}`;
  return { html, xlsx, filenameBase: safe.slice(0, 80) };
}
