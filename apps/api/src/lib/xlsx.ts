/**
 * xlsx CJS/ESM interop for NodeNext builds.
 * `import * as XLSX from "xlsx"` breaks readFile on compiled ESM (Hostinger).
 */
import xlsxImport from "xlsx";

const XLSX = (xlsxImport as { default?: typeof xlsxImport }).default ?? xlsxImport;

export default XLSX;
export type { WorkBook, WorkSheet, CellObject } from "xlsx";
