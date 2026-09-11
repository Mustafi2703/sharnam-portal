import ExcelJS from "exceljs";
import { prisma } from "../../prisma.js";

export async function buildPrInvoiceWorkbook(projectId: string): Promise<Buffer> {
  const [prs, invoices] = await Promise.all([
    prisma.progressPurchaseRequisition.findMany({ where: { projectId }, orderBy: { srNo: "asc" } }),
    prisma.progressInvoiceTracker.findMany({ where: { projectId }, orderBy: { srNo: "asc" } }),
  ]);
  const wb = new ExcelJS.Workbook();
  const pr = wb.addWorksheet("PR Tracker");
  pr.addRow(["PR Tracker", "", "", "", "", "", "", "", "", ""]);
  pr.addRow(["Sr No", "PR Type", "PR No", "Discipline", "Qty", "Unit", "Rate", "Amount", "Material Code", "PO"]);
  for (const r of prs) {
    pr.addRow([r.srNo, r.prType, r.prNumber, r.discipline, r.qty, r.unit, r.rate, r.amount, r.materialCode, r.poNumber]);
  }
  const inv = wb.addWorksheet("Invoice Processing Tracker");
  inv.addRow(["Invoice Processing Tracker"]);
  inv.addRow(["Sr No", "Name of Work", "Invoice No", "PO", "Vendor", "Invoice Date", "Invoice Rise (Excl. GST)", "COP Status"]);
  for (const r of invoices) {
    inv.addRow([
      r.srNo,
      r.workName,
      r.invoiceNumber,
      r.poNumber,
      r.vendorName,
      r.invoiceDate,
      r.amountExclGst,
      r.copStatus,
    ]);
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
