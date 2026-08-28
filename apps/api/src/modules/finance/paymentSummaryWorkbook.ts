/**
 * Payment Summary - VIATRIX - Copy.xlsx — import / export RA bills + material invoices.
 */
import fs from "fs";
import path from "path";
import {
  FINANCE_PACKAGES,
  packageForRaBill,
  resolveFinancePackage,
  type FinancePackage,
} from "./disciplines.js";
import XLSX from "../../lib/xlsx.js";
import { prisma } from "../../prisma.js";
import { workbookBuffer, type SheetSpec } from "../../services/brandedExport.js";

function s(v: unknown, max = 500) {
  const t = String(v ?? "").trim();
  return t ? t.slice(0, max) : "";
}

function num(v: unknown): number {
  const n = typeof v === "string" ? Number(v.replace(/,/g, "")) : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(v: unknown): Date | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === "number" && v > 40000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setUTCDate(epoch.getUTCDate() + Math.floor(v));
    return epoch;
  }
  const t = s(v, 40);
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(d: Date | null | undefined) {
  if (!d) return "";
  return d.toLocaleDateString("en-GB");
}

export function resolvePaymentSummaryPath(): string | null {
  const candidates = [
    process.env.SHARNAM_EXCEL_ROOT
      ? path.join(process.env.SHARNAM_EXCEL_ROOT, "Payment Summary - VIATRIX - Copy.xlsx")
      : "",
    path.join(process.cwd(), "module_prompts", "Sharnam_modules_docs 2", "Payment Summary - VIATRIX - Copy.xlsx"),
    path.join(process.cwd(), "seed", "data", "Payment Summary - VIATRIX - Copy.xlsx"),
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const CIVIL_RA_HEADERS = [
  "Sr. No.",
  "Description of Goods",
  "Tax Invoice No.",
  "Invoice Date",
  "Against bill Raised",
  "Price Variation of material",
  "Total Invoice value without GST",
  "Steel advance 85% adjusted as per consumption",
  "Total Invoice value withGST",
  "Retentions (5%)",
  "Net Amount Payable Against This Bill With Advanced Amount",
];

const MATERIAL_HEADERS = [
  "Sr. No.",
  "Recieved Date",
  "Description of Goods",
  "Tax Invoice No.",
  "Invoice Date",
  "Total Invoice value without GST",
  "Total Invoice value with GST",
];

/** Import Payment Summary workbook into RA bills + material invoice lines (per project, Viatrix format). */
export async function importPaymentSummaryWorkbook(
  projectId: string,
  buffer: Buffer,
  replace = false,
  disciplineFilter?: string
) {
  const filterPkg = disciplineFilter ? resolveFinancePackage(disciplineFilter) : null;
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  let raImported = 0;
  let materialImported = 0;

  if (replace && (!filterPkg || filterPkg.billKind === "material")) {
    await prisma.financeMaterialInvoice.deleteMany({
      where: {
        projectId,
        ...(filterPkg ? { sheetCategory: filterPkg.sheetName } : {}),
      },
    });
  }

  for (const sheetName of wb.SheetNames) {
    const pkg =
      FINANCE_PACKAGES.find((p) => p.sheetName.toLowerCase() === sheetName.trim().toLowerCase()) ??
      resolveFinancePackage(sheetName);
    if (!pkg) continue;
    if (filterPkg && pkg.key !== filterPkg.key) continue;
    if (/summary/i.test(sheetName)) continue;

    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[sheetName], {
      header: 1,
      defval: "",
    }) as unknown[][];

    if (pkg.billKind === "ra") {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const desc = s(row[1]);
        if (!desc || /description/i.test(desc)) continue;
        if (!/^RA-/i.test(desc) && !num(row[4])) continue;

        const against = num(row[4]);
        const priceVar = num(row[5]);
        const withoutGst = num(row[6]) || against - priceVar;
        const advanceAdj = num(row[7]);
        const withGst = num(row[8]) || withoutGst * 1.18;
        const retention = num(row[9]);
        const net = num(row[10]) || withGst - advanceAdj - retention;

        const existing = await prisma.raBill.findFirst({
          where: { projectId, raNumber: desc, discipline: pkg.discipline },
        });
        if (existing) {
          await prisma.raBill.update({
            where: { id: existing.id },
            data: {
              invoiceNumber: s(row[2]) || null,
              invoiceDate: parseDate(row[3]),
              againstBillRaised: against,
              priceVariation: priceVar,
              totalInvoiceWithoutGst: withoutGst,
              totalInvoiceWithGst: withGst,
              gstAmount: Math.max(0, withGst - withoutGst),
              advanceAdjusted: advanceAdj,
              retentionAmount: retention,
              netAmountPayable: net,
              description: `Imported from Payment Summary · ${sheetName}`,
            },
          });
        } else {
          const prev = await prisma.raBill.aggregate({
            where: { projectId, discipline: pkg.discipline },
            _sum: { totalInvoiceWithoutGst: true },
          });
          const previousBillTotal = prev._sum?.totalInvoiceWithoutGst || 0;
          await prisma.raBill.create({
            data: {
              projectId,
              raNumber: desc,
              invoiceNumber: s(row[2]) || null,
              invoiceDate: parseDate(row[3]),
              againstBillRaised: against,
              priceVariation: priceVar,
              totalInvoiceWithoutGst: withoutGst,
              totalInvoiceWithGst: withGst,
              gstAmount: Math.max(0, withGst - withoutGst),
              advanceAdjusted: advanceAdj,
              retentionAmount: retention,
              netAmountPayable: net,
              previousBillTotal,
              cumulativeBillTotal: previousBillTotal + withoutGst,
              discipline: pkg.discipline,
              status: "Submitted",
              description: `Imported from Payment Summary · ${sheetName}`,
            },
          });
        }
        raImported++;
      }
      continue;
    }

    if (pkg.billKind === "material") {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const desc = s(row[2] ?? row[1]);
        if (!desc || /description/i.test(desc) || /^total$/i.test(desc)) continue;
        const invNo = s(row[3] ?? row[4]);
        const withoutGst = num(row[5] ?? row[4]);
        const withGst = num(row[6] ?? row[5]);
        if (!withoutGst && !withGst && !invNo) continue;

        await prisma.financeMaterialInvoice.create({
          data: {
            projectId,
            sheetCategory: pkg.sheetName,
            srNo: s(row[0]) || String(materialImported + 1),
            receivedDate: parseDate(row[1]),
            description: desc,
            taxInvoiceNo: invNo || null,
            invoiceDate: parseDate(row[4] ?? row[3]),
            amountWithoutGst: withoutGst,
            amountWithGst: withGst || withoutGst * 1.18,
            gstAmount: Math.max(0, (withGst || withoutGst * 1.18) - withoutGst),
            netPayable: withGst || withoutGst * 1.18,
            againstBillRaised: withoutGst,
          },
        });
        materialImported++;
      }
    }
  }

  return { raImported, materialImported, sheets: wb.SheetNames.length };
}

export async function syncPaymentSummaryTemplate(projectId: string) {
  const p = resolvePaymentSummaryPath();
  if (!p) throw new Error("Payment Summary - VIATRIX - Copy.xlsx not found in module_prompts or seed/data");
  const buf = fs.readFileSync(p);
  return importPaymentSummaryWorkbook(projectId, buf, true);
}

export async function buildPaymentSummaryWorkbook(projectId: string): Promise<Buffer> {
  const [project, ras, materials, pos] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.raBill.findMany({ where: { projectId }, orderBy: [{ invoiceDate: "asc" }, { raNumber: "asc" }] }),
    prisma.financeMaterialInvoice.findMany({ where: { projectId }, orderBy: [{ sheetCategory: "asc" }, { receivedDate: "asc" }] }),
    prisma.purchaseOrder.findMany({ where: { projectId } }),
  ]);
  if (!project) throw new Error("Project not found");

  const sheets: SheetSpec[] = [];

  const raPackages = FINANCE_PACKAGES.filter((p) => p.billKind === "ra");
  for (const pkg of raPackages) {
    const pkgRas = ras.filter((r) => packageForRaBill(r).key === pkg.key);
    if (!pkgRas.length && pkg.key !== "civil") continue;
    sheets.push({
      name: pkg.sheetName.slice(0, 31),
      rows: [
        ["Sharnam Project Development Consultants & Co. — Payment Summary"],
        [pkg.sheetName.toUpperCase()],
        [],
        CIVIL_RA_HEADERS,
        [],
        ...pkgRas.map((r, idx) => [
          idx + 1,
          r.raNumber,
          r.invoiceNumber || "",
          fmtDate(r.invoiceDate),
          r.againstBillRaised,
          r.priceVariation,
          r.totalInvoiceWithoutGst,
          r.advanceAdjusted,
          r.totalInvoiceWithGst,
          r.retentionAmount,
          r.netAmountPayable,
        ]),
      ],
    });
  }

  // Summary Civil — all RA disciplines rolled up
  const civilPos = pos.filter((p) => /civil|structural|factory/i.test(`${p.packageName ?? ""} ${p.workTrade ?? ""}`));
  const civilRas = ras.filter((r) => packageForRaBill(r).billKind === "ra");
  const totalOriginal = (civilPos.length ? civilPos : pos).reduce((s, p) => s + p.originalValue, 0);
  const totalBilled = civilRas.reduce((s, r) => s + r.totalInvoiceWithoutGst, 0);
  const totalPrev = civilRas.reduce((s, r) => s + r.previousBillTotal, 0) / Math.max(1, civilRas.length);
  sheets.push({
    name: "Summary Civil",
    rows: [
      ["SUMMARY OF COST"],
      [`PROJECT NAME: ${project.name}`, "", "", "", "RA BILL:", civilRas.length],
      [`Name of Contractor : ${pos[0]?.vendorName || "Contractor"}`, "", "", "", "DATE:", fmtDate(new Date())],
      [],
      ["SR. NO.", "DESCRIPTION", "AMOUNT AS PER PO", "PREVIOUS BILL", "THIS BILL", "TOTAL BILL"],
      ["TENDER ITEM"],
      [1, "FACTORY BUILDING", totalOriginal, totalPrev, totalBilled - totalPrev, totalBilled],
      [],
      ["PO SUMMARY"],
      ["PO No", "Vendor", "Trade", "Original", "Billed w/o GST", "Net Payable", "Balance"],
      ...(civilPos.length ? civilPos : pos).map((p) => {
        const poRa = civilRas.filter((r) => r.purchaseOrderId === p.id);
        const billed = poRa.reduce((n, r) => n + r.totalInvoiceWithoutGst, 0);
        const net = poRa.reduce((n, r) => n + r.netAmountPayable, 0);
        return [p.poNumber, p.vendorName, p.workTrade || "", p.originalValue, billed, net, Math.max(0, (p.amendedValue || p.originalValue) - billed)];
      }),
    ],
  });

  const materialPackages = FINANCE_PACKAGES.filter((p) => p.billKind === "material");
  for (const pkg of materialPackages) {
    const lines = materials.filter((m) => resolveFinancePackage(m.sheetCategory)?.key === pkg.key);
    if (!lines.length) continue;
    sheets.push(buildMaterialSheet(pkg, lines));
  }

  const orphanMaterials = materials.filter((m) => {
    const k = resolveFinancePackage(m.sheetCategory)?.key;
    return !materialPackages.some((p) => p.key === k);
  });
  if (orphanMaterials.length) {
    sheets.push(buildMaterialSheet({ key: "other", label: "Other", billKind: "material", discipline: "Other", sheetName: "Other", hubModule: "finance" }, orphanMaterials));
  }

  if (!materials.length && !ras.length) {
    sheets.push({
      name: "Material Invoices",
      rows: [[], ["No bill lines — add under Finance by discipline or import Payment Summary."]],
    });
  }

  return workbookBuffer(sheets, {
    title: "Payment Summary",
    projectCode: project.code,
  });
}

function buildMaterialSheet(
  pkg: FinancePackage,
  lines: Array<{
    srNo: string | null;
    receivedDate: Date | null;
    invoiceDate: Date | null;
    description: string;
    taxInvoiceNo: string | null;
    amountWithoutGst: number;
    amountWithGst: number;
  }>
): SheetSpec {
  return {
    name: pkg.sheetName.slice(0, 31),
    rows: [
      ["Sharnam Project Development Consultants & Co. — Payment Summary"],
      [pkg.sheetName],
      [],
      MATERIAL_HEADERS,
      [],
      ...lines.map((m, idx) => [
        m.srNo || idx + 1,
        fmtDate(m.receivedDate || m.invoiceDate),
        m.description,
        m.taxInvoiceNo || "",
        fmtDate(m.invoiceDate),
        m.amountWithoutGst,
        m.amountWithGst,
      ]),
    ],
  };
}
