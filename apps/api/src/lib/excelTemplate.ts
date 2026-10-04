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
