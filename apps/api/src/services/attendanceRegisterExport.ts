import ExcelJS from "exceljs";
import { attendanceSiteMinutes, formatIstDateKey, SPDC_PMC_NAME } from "@sharnam/shared";
import { sharnamLogoPath } from "./brandedExport.js";

const NAVY = "FF1E3A5F";
const BLUE_DAY = "FFDBEAFE";
const BLUE_HEADER = "FF2563EB";
const WEEKEND = "FFF1F5F9";
const WHITE = "FFFFFFFF";
const THIN = { style: "thin" as const, color: { argb: "FF94A3B8" } };
const BOX = { top: THIN, left: THIN, bottom: THIN, right: THIN };

export type AttendanceExportRow = {
  id: string;
  date: Date;
  status: string;
  checkIn?: string | null;
  checkOut?: string | null;
  inLat?: number | null;
  inLng?: number | null;
  inAccuracy?: number | null;
  outLat?: number | null;
  outLng?: number | null;
  outAccuracy?: number | null;
  inSiteName?: string | null;
  outSiteName?: string | null;
  inGeofenceOk?: boolean;
  outGeofenceOk?: boolean;
  inPhotoUrl?: string | null;
  outPhotoUrl?: string | null;
  notes?: string | null;
  projectId?: string | null;
  user: { fullName: string; email?: string | null };
};

export type LeaveExportRow = {
  fromDate: Date;
  toDate: Date;
  days: number;
  halfDay: boolean;
  status: string;
  reason?: string | null;
  user: { fullName: string };
  leaveType?: { name?: string | null; code?: string | null } | null;
};

function paintHeader(cell: ExcelJS.Cell, fill = NAVY) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
  cell.font = { bold: true, color: { argb: WHITE }, size: 10 };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.border = BOX;
}

function stampBrand(sheet: ExcelJS.Worksheet, title: string, subtitle: string, lastCol: number) {
  sheet.mergeCells(1, 1, 1, lastCol);
  const t = sheet.getCell(1, 1);
  t.value = title;
  t.font = { bold: true, size: 14, color: { argb: WHITE } };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  t.alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 28;

  sheet.mergeCells(2, 1, 2, lastCol);
  const s = sheet.getCell(2, 1);
  s.value = `${SPDC_PMC_NAME} · ${subtitle}`;
  s.font = { size: 9, color: { argb: "FF334155" } };
  s.alignment = { vertical: "middle" };
  sheet.getRow(2).height = 18;

  try {
    const logo = sharnamLogoPath();
    if (logo) {
      const wb = sheet.workbook;
      const id = wb.addImage({ filename: logo, extension: "png" });
      sheet.addImage(id, { tl: { col: lastCol - 1.2, row: 0.1 }, ext: { width: 72, height: 34 } });
    }
  } catch {
    /* logo optional */
  }
}

function dayKey(d: Date) {
  return formatIstDateKey(d);
}

function noteForDay(r: AttendanceExportRow) {
  const parts: string[] = [];
  if (r.checkIn) parts.push(`In ${r.checkIn}`);
  if (r.checkOut) parts.push(`Out ${r.checkOut}`);
  if (r.inLat != null && r.inLng != null) parts.push(`InGPS ${r.inLat.toFixed(5)},${r.inLng.toFixed(5)}`);
  if (r.outLat != null && r.outLng != null) parts.push(`OutGPS ${r.outLat.toFixed(5)},${r.outLng.toFixed(5)}`);
  if (r.inGeofenceOk || r.outGeofenceOk) parts.push("GeoOK");
  if (r.inPhotoUrl) parts.push("InPhoto");
  if (r.outPhotoUrl) parts.push("OutPhoto");
  if (r.notes) parts.push(r.notes);
  return parts.join(" · ");
}

function cellLabel(r: AttendanceExportRow) {
  const mins = attendanceSiteMinutes(r.checkIn, r.checkOut);
  const hrs = mins != null ? `${Math.round((mins / 60) * 10) / 10}h` : "";
  return [`${r.status?.[0] || "P"}`, r.checkIn || "—", r.checkOut || "—", hrs].filter(Boolean).join("\n");
}

/**
 * Branded monthly attendance workbook:
 * - Month calendar (blue day cells + notes) — one block per employee
 * - Daily log with full GPS / geo / photo flags
 * - Leave in range
 */
export async function buildAttendanceRegisterWorkbook(opts: {
  from: Date;
  to: Date;
  attendance: AttendanceExportRow[];
  leave: LeaveExportRow[];
  filterName?: string | null;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sharnam Portal";
  wb.created = new Date();

  const fromKey = dayKey(opts.from);
  const toKey = dayKey(opts.to);
  const subtitle = `${fromKey} → ${toKey}${opts.filterName ? ` · ${opts.filterName}` : " · All staff"}`;

  /* ── Month calendar ── */
  const cal = wb.addWorksheet("Month calendar", {
    views: [{ state: "frozen", ySplit: 3 }],
  });
  stampBrand(cal, "SPDC Attendance · Monthly calendar", subtitle, 8);
  cal.getCell(3, 1).value =
    "Blue cells = day recorded (Present / punch). Notes column holds GPS, photos, and HR notes for that employee’s month.";
  cal.mergeCells(3, 1, 3, 8);
  cal.getCell(3, 1).font = { size: 9, italic: true, color: { argb: "FF64748B" } };

  const byUser = new Map<string, AttendanceExportRow[]>();
  for (const row of opts.attendance) {
    const name = row.user.fullName || row.user.email || "Employee";
    const list = byUser.get(name) || [];
    list.push(row);
    byUser.set(name, list);
  }

  let rowPtr = 5;
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const year = opts.from.getFullYear();
  const month = opts.from.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const first = new Date(year, month, 1);
  const startPad = (first.getDay() + 6) % 7;

  if (byUser.size === 0) {
    cal.getCell(rowPtr, 1).value = "No attendance punches in this range yet.";
  }

  for (const [empName, rows] of byUser) {
    const byDate = new Map(rows.map((r) => [dayKey(r.date), r]));

    cal.mergeCells(rowPtr, 1, rowPtr, 8);
    const nameCell = cal.getCell(rowPtr, 1);
    nameCell.value = empName;
    nameCell.font = { bold: true, size: 11, color: { argb: WHITE } };
    nameCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE_HEADER } };
    nameCell.alignment = { vertical: "middle" };
    cal.getRow(rowPtr).height = 22;
    rowPtr += 1;

    for (let c = 0; c < 7; c++) {
      const cell = cal.getCell(rowPtr, c + 1);
      cell.value = weekdays[c];
      paintHeader(cell, NAVY);
    }
    cal.getCell(rowPtr, 8).value = "Notes (this week / day detail)";
    paintHeader(cal.getCell(rowPtr, 8), NAVY);
    rowPtr += 1;

    const cells: { day: number | null; key: string | null }[] = [];
    for (let i = 0; i < startPad; i++) cells.push({ day: null, key: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month, d);
      cells.push({ day: d, key: dayKey(dt) });
    }
    while (cells.length % 7 !== 0) cells.push({ day: null, key: null });

    for (let i = 0; i < cells.length; i += 7) {
      const week = cells.slice(i, i + 7);
      const noteBits: string[] = [];
      for (let c = 0; c < 7; c++) {
        const slot = week[c];
        const cell = cal.getCell(rowPtr, c + 1);
        cell.border = BOX;
        cell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
        if (!slot?.day || !slot.key) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: WHITE } };
          cell.value = "";
          continue;
        }
        const rec = byDate.get(slot.key);
        const weekend = c >= 5;
        if (rec) {
          cell.value = `${slot.day}\n${cellLabel(rec)}`;
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE_DAY } };
          cell.font = { size: 8, color: { argb: NAVY }, bold: true };
          noteBits.push(`${slot.day}: ${noteForDay(rec)}`);
        } else {
          cell.value = String(slot.day);
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: weekend ? WEEKEND : WHITE },
          };
          cell.font = { size: 9, color: { argb: "FF94A3B8" } };
        }
      }
      const notesCell = cal.getCell(rowPtr, 8);
      notesCell.value = noteBits.join("\n") || "";
      notesCell.border = BOX;
      notesCell.alignment = { wrapText: true, vertical: "top" };
      notesCell.font = { size: 8 };
      cal.getRow(rowPtr).height = Math.max(48, 14 + noteBits.length * 12);
      rowPtr += 1;
    }

    const monthNotes = rows
      .map((r) => `${dayKey(r.date)}: ${noteForDay(r)}`)
      .join("\n");
    cal.mergeCells(rowPtr, 1, rowPtr, 8);
    cal.getCell(rowPtr, 1).value = monthNotes ? `Month notes · ${empName}\n${monthNotes}` : `Month notes · ${empName} · none`;
    cal.getCell(rowPtr, 1).font = { size: 8, color: { argb: "FF334155" } };
    cal.getCell(rowPtr, 1).alignment = { wrapText: true, vertical: "top" };
    cal.getRow(rowPtr).height = Math.min(120, 20 + rows.length * 12);
    rowPtr += 2;
  }

  cal.getColumn(1).width = 12;
  for (let c = 2; c <= 7; c++) cal.getColumn(c).width = 12;
  cal.getColumn(8).width = 48;

  /* ── Daily log ── */
  const log = wb.addWorksheet("Daily log", {
    views: [{ state: "frozen", ySplit: 3 }],
  });
  const logHeaders = [
    "Date",
    "Employee",
    "Status",
    "Check-in",
    "Check-out",
    "Hours",
    "In site",
    "In GPS",
    "In ±m",
    "In geo OK",
    "In photo",
    "Out site",
    "Out GPS",
    "Out ±m",
    "Out geo OK",
    "Out photo",
    "Notes",
  ];
  stampBrand(log, "SPDC Attendance · Daily log", subtitle, logHeaders.length);
  logHeaders.forEach((h, i) => {
    const cell = log.getCell(3, i + 1);
    cell.value = h;
    paintHeader(cell);
  });
  log.getRow(3).height = 28;

  opts.attendance.forEach((r, idx) => {
    const row = log.getRow(4 + idx);
    const mins = attendanceSiteMinutes(r.checkIn, r.checkOut);
    const hours = mins != null ? Math.round((mins / 60) * 100) / 100 : "";
    const values = [
      dayKey(r.date),
      r.user.fullName,
      r.status,
      r.checkIn || "",
      r.checkOut || "",
      hours,
      r.inSiteName || "",
      r.inLat != null && r.inLng != null ? `${r.inLat},${r.inLng}` : "",
      r.inAccuracy != null ? Math.round(r.inAccuracy) : "",
      r.inGeofenceOk ? "Yes" : "No",
      r.inPhotoUrl ? "Yes" : "No",
      r.outSiteName || "",
      r.outLat != null && r.outLng != null ? `${r.outLat},${r.outLng}` : "",
      r.outAccuracy != null ? Math.round(r.outAccuracy) : "",
      r.outGeofenceOk ? "Yes" : "No",
      r.outPhotoUrl ? "Yes" : "No",
      r.notes || noteForDay(r),
    ];
    values.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v as string | number;
      cell.border = BOX;
      cell.font = { size: 9 };
      if (r.status === "Present" || r.checkIn) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE_DAY } };
      }
    });
  });

  const logWidths = [12, 22, 10, 10, 10, 8, 14, 22, 8, 10, 10, 14, 22, 8, 10, 10, 40];
  logWidths.forEach((w, i) => {
    log.getColumn(i + 1).width = w;
  });

  /* ── Leave ── */
  const leaveSheet = wb.addWorksheet("Leave");
  stampBrand(leaveSheet, "SPDC Attendance · Leave in range", subtitle, 8);
  ["From", "To", "Employee", "Leave type", "Days", "Half/Full", "Status", "Reason"].forEach((h, i) => {
    const cell = leaveSheet.getCell(3, i + 1);
    cell.value = h;
    paintHeader(cell);
  });
  opts.leave.forEach((l, idx) => {
    const row = leaveSheet.getRow(4 + idx);
    const values = [
      dayKey(l.fromDate),
      dayKey(l.toDate),
      l.user.fullName,
      l.leaveType?.name || l.leaveType?.code || "",
      l.days,
      l.halfDay ? "Half" : "Full",
      l.status,
      l.reason || "",
    ];
    values.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v as string | number;
      cell.border = BOX;
      cell.font = { size: 9 };
    });
  });
  [12, 12, 22, 16, 8, 10, 12, 36].forEach((w, i) => {
    leaveSheet.getColumn(i + 1).width = w;
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
