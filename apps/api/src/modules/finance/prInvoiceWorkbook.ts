import { prisma } from "../../prisma.js";
import { workbookBuffer } from "../../services/brandedExport.js";

const ddmmyyyy = (d: Date | null) =>
  d ? `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}` : "";

/** PR Tracker + Invoice Processing Tracker in the client's column order, on the SPDC branded letterhead. */
export async function buildPrInvoiceWorkbook(projectId: string): Promise<Buffer> {
  const [project, prs, invoices] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { code: true } }),
    prisma.progressPurchaseRequisition.findMany({ where: { projectId }, orderBy: { srNo: "asc" } }),
    prisma.progressInvoiceTracker.findMany({ where: { projectId }, orderBy: { srNo: "asc" } }),
  ]);
  return workbookBuffer(
    [
      {
        name: "PR Tracker",
        chart: { title: "PR amount (₹)", category: "PR No", values: "Amount" },
        rows: [
          ["Sr No", "PR Type", "PR No", "Discipline", "Qty", "Unit", "Rate", "Amount", "Material Code", "PO"],
          ...prs.map((r) => [r.srNo, r.prType, r.prNumber, r.discipline, r.qty, r.unit, r.rate, r.amount, r.materialCode, r.poNumber]),
        ],
      },
      {
        name: "Invoice Processing Tracker",
        chart: { title: "Invoice value (₹, excl. GST)", category: "Invoice No", values: "Invoice Rise (Excl. GST)" },
        rows: [
          ["Sr No", "Name of Work", "Invoice No", "PO", "Vendor", "Invoice Date", "Invoice Rise (Excl. GST)", "COP Status"],
          ...invoices.map((r) => [
            r.srNo,
            r.workName,
            r.invoiceNumber,
            r.poNumber,
            r.vendorName,
            ddmmyyyy(r.invoiceDate),
            r.amountExclGst,
            r.copStatus,
          ]),
        ],
      },
    ],
    { title: "PR Tracker & Invoice Processing", projectCode: project?.code || projectId }
  );
}
