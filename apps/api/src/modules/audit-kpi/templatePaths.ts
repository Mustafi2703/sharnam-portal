import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/** Workbook directory. AUDIT_KPI_TEMPLATE_DIR wins; otherwise docs/ next to the repo root. */
export function auditKpiTemplateDir() {
  if (process.env.AUDIT_KPI_TEMPLATE_DIR) return process.env.AUDIT_KPI_TEMPLATE_DIR;
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../docs");
}

export function auditKpiTemplatePaths() {
  const dir = auditKpiTemplateDir();
  return {
    dir,
    auditPack: path.join(dir, "SITE_AUDIT_Pack.xlsx"),
    kpiPack: path.join(dir, "MASTER_KPI_DASHBOARD.xlsx"),
  };
}

/** Fail at startup when the packs the seeder reads are not on disk. */
export function assertAuditKpiTemplates() {
  const paths = auditKpiTemplatePaths();
  const missing = [paths.auditPack, paths.kpiPack].filter((file) => !fs.existsSync(file));
  if (missing.length) {
    throw new Error(
      `Audit and KPI template workbooks missing: ${missing.join(", ")}. Set AUDIT_KPI_TEMPLATE_DIR or place the files in docs/.`
    );
  }
  return paths;
}
