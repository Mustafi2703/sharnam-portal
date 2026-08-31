import { Link } from "react-router-dom";
import { RegisterEmptyRow, RegisterSheetFrame } from "./RegisterSheetFrame";

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
}

export type ComparativeSummary = {
  vendorLabels: string[];
  sectionTotals: { section: string; title: string; totals: Record<string, number> }[];
  grandTotals: Record<string, number>;
  lowestVendor?: string;
};

type Props = {
  summary: ComparativeSummary | null | undefined;
  summarySheetId?: string | null;
  masterSheetId?: string | null;
  revisionLabel?: string;
  title?: string;
};

/** Excel-style comparative statement — matches R2 summary tab layout. */
export function CrmComparativeRegister({
  summary,
  summarySheetId,
  masterSheetId,
  revisionLabel = "R2",
  title = "Comparative statement",
}: Props) {
  if (!summary?.vendorLabels?.length) {
    return (
      <RegisterSheetFrame title={title} sheetLabel={`Comparative Statement · ${revisionLabel} · summary tab`} rowCount={0}>
        <table className="sheet-register__table min-w-[640px]">
          <tbody>
            <RegisterEmptyRow
              colSpan={4}
              message="Upload vendor BOQs and click Refresh comparative — section totals appear here like the R2 summary sheet."
            />
          </tbody>
        </table>
      </RegisterSheetFrame>
    );
  }

  const colSpan = 2 + summary.vendorLabels.length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3 text-xs">
        {summarySheetId && (
          <Link to={`/custom-sheets/${summarySheetId}`} className="font-semibold text-brand">
            Open summary sheet (R2 tab) →
          </Link>
        )}
        {masterSheetId && (
          <Link to={`/custom-sheets/${masterSheetId}`} className="font-semibold text-brand">
            Open master BOQ compare →
          </Link>
        )}
        {summary.lowestVendor && (
          <span className="text-steel-muted">
            L1 vendor: <strong className="text-ok">{summary.lowestVendor}</strong> ·{" "}
            {formatINR(summary.grandTotals[summary.lowestVendor] || 0)}
          </span>
        )}
      </div>

      <RegisterSheetFrame
        title={title}
        sheetLabel={`Comparative Statement - ${revisionLabel}.xlsx · summary`}
        rowCount={summary.sectionTotals.length + 1}
        className="min-h-[200px]"
      >
        <table className="sheet-register__table min-w-[720px]">
          <thead>
            <tr>
              <th className="w-16">Sec</th>
              <th className="min-w-[200px]">Description</th>
              {summary.vendorLabels.map((v) => (
                <th key={v} className="text-right min-w-[120px]">
                  {v}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary.sectionTotals.map((row, i) => (
              <tr key={`${row.section}-${i}`}>
                <td className="font-mono text-xs">{row.section}</td>
                <td className="font-medium">{row.title}</td>
                {summary.vendorLabels.map((v) => {
                  const val = row.totals[v] || 0;
                  const isLowestInRow =
                    summary.vendorLabels.length > 1 &&
                    val > 0 &&
                    val === Math.min(...summary.vendorLabels.map((lbl) => row.totals[lbl] || Infinity));
                  return (
                    <td
                      key={v}
                      className={`text-right font-mono text-xs tabular-nums ${isLowestInRow ? "bg-ok/10 font-semibold text-ok" : ""}`}
                    >
                      {formatINR(val)}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="bg-brand/10 font-semibold border-t-2 border-brand">
              <td colSpan={2} className="uppercase text-[10px] tracking-wide">
                Grand total (tender)
              </td>
              {summary.vendorLabels.map((v) => (
                <td key={v} className="text-right font-mono tabular-nums">
                  {formatINR(summary.grandTotals[v] || 0)}
                  {summary.lowestVendor === v && (
                    <span className="block text-[10px] text-ok font-bold">L1</span>
                  )}
                </td>
              ))}
            </tr>
            {!summary.sectionTotals.length && <RegisterEmptyRow colSpan={colSpan} message="No section totals yet." />}
          </tbody>
        </table>
      </RegisterSheetFrame>
    </div>
  );
}
