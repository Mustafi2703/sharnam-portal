import { Link } from "react-router-dom";

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
}

type Summary = {
  vendorLabels: string[];
  sectionTotals: { section: string; title: string; totals: Record<string, number> }[];
  grandTotals: Record<string, number>;
  lowestVendor?: string;
};

export function ComparativeStatementPanel({
  summary,
  summarySheetId,
  masterSheetId,
  hideSheetLinks,
}: {
  summary: Summary | null | undefined;
  summarySheetId?: string | null;
  masterSheetId?: string | null;
  hideSheetLinks?: boolean;
}) {
  if (!summary?.vendorLabels?.length) {
    return (
      <div className="rounded-xl border border-dashed border-line p-4 text-sm text-steel-muted">
        Comparative statement loads from the R2 <strong>summary</strong> tab after bid package is created. Open master BOQ
        sheet for line-by-line vendor rates.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!hideSheetLinks && (
      <div className="flex flex-wrap gap-2">
        {summarySheetId && (
          <Link to={`/custom-sheets/${summarySheetId}`} className="text-xs font-semibold text-brand">
            Open summary sheet (R2 tab) →
          </Link>
        )}
        {masterSheetId && (
          <Link to={`/custom-sheets/${masterSheetId}`} className="text-xs font-semibold text-brand">
            Open master BOQ compare →
          </Link>
        )}
      </div>
      )}

      <div className="rounded-xl border border-line overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-brand-soft/60 text-left">
            <tr>
              <th className="p-2 font-semibold">Section</th>
              <th className="p-2 font-semibold">Description</th>
              {summary.vendorLabels.map((v) => (
                <th key={v} className="p-2 font-semibold text-right whitespace-nowrap">
                  {v}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary.sectionTotals.map((row, i) => (
              <tr key={i} className="border-t border-line">
                <td className="p-2 font-mono">{row.section}</td>
                <td className="p-2">{row.title}</td>
                {summary.vendorLabels.map((v) => (
                  <td key={v} className="p-2 text-right tabular-nums">
                    {formatINR(row.totals[v] || 0)}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t-2 border-brand bg-sand/40 font-semibold">
              <td className="p-2" colSpan={2}>
                Grand total (tender)
              </td>
              {summary.vendorLabels.map((v) => (
                <td key={v} className="p-2 text-right tabular-nums">
                  {formatINR(summary.grandTotals[v] || 0)}
                  {summary.lowestVendor === v && (
                    <span className="block text-[10px] text-ok font-bold">L1</span>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
