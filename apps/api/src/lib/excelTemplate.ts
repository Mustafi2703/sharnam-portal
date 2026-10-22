import type ExcelJS from "exceljs";

/**
 * ExcelJS shares one style object between template cells that have the same style id.
 * Painting one cell (e.g. a navy section band or a green "OK" status) then repaints every
 * cell sharing that object — the "colour bleed" seen in filled SPDC templates.
 * Call right after loading a template so every cell owns its style.
 */
export function detachSharedStyles(wb: ExcelJS.Workbook) {
  for (const ws of wb.worksheets) {
    ws.eachRow({ includeEmpty: true }, (row) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        const st = cell.style || {};
        cell.style = {
          ...st,
          font: st.font ? { ...st.font } : st.font,
          fill: st.fill ? ({ ...st.fill } as ExcelJS.Fill) : st.fill,
          border: st.border ? { ...st.border } : st.border,
          alignment: st.alignment ? { ...st.alignment } : st.alignment,
        } as Partial<ExcelJS.Style>;
      });
    });
  }
}

/** Replace formulas with the last calculated result so helper sheets can be removed. */
export function freezeSheetFormulas(ws: ExcelJS.Worksheet) {
  ws.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      const v = cell.value;
      if (v && typeof v === "object" && "formula" in v) {
        const result = (v as ExcelJS.CellFormulaValue).result;
        cell.value = result == null || result === "" ? null : result;
      }
    });
  });
}

/**
 * A single-record download keeps only the named form sheet.
 * Read-me, control, register, dashboard, legend, and sample sheets are removed,
 * and defined names that pointed at them are dropped so Excel does not repair them back in.
 */
export function keepOnlySheets(wb: ExcelJS.Workbook, names: string[]) {
  const keep = new Set(names.map((n) => n.toLowerCase()));
  for (const ws of [...wb.worksheets]) {
    if (!keep.has(ws.name.toLowerCase())) wb.removeWorksheet(ws.id);
  }
  for (const ws of wb.worksheets) ws.state = "visible";
  const kept = new Set(wb.worksheets.map((w) => w.name.toLowerCase()));
  const defined = wb.definedNames as { model?: { name: string; ranges?: string[] }[] };
  if (Array.isArray(defined?.model)) {
    defined.model = defined.model.filter((entry) => {
      const ranges = entry.ranges || [];
      return ranges.every((range) => {
        if (!String(range).includes("!")) return true;
        const sheet = String(range).split("!")[0].replace(/^'|'$/g, "").toLowerCase();
        return kept.has(sheet);
      });
    });
  }
  wb.views = [{ x: 0, y: 0, width: 0, height: 0, activeTab: 0, firstSheet: 0, visibility: "visible" }];
}
