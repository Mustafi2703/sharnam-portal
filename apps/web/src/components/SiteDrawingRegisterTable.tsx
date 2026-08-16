import { Link } from "react-router-dom";
import { resolveDrawingFileUrl } from "../lib/drawingPreview";
import {
  SITE_REGISTER_ISSUE_ROWS,
  SITE_REGISTER_REV_SLOTS,
} from "../lib/drawingIssueFields";
import { gfcRevisionForSlot } from "../lib/gfcRegister";
import { formatUiText } from "../lib/formatUiText";

function fmtDay(d?: string | Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function cellForRow(rev: any | undefined, rowKey: (typeof SITE_REGISTER_ISSUE_ROWS)[number]["key"]) {
  if (!rev) return "—";
  if (rowKey === "receivedDate") return fmtDay(rev.receivedDate || rev.actualDate);
  if (rowKey === "copiesReceived") return rev.copiesReceived != null ? String(rev.copiesReceived) : "—";
  if (rowKey === "issuedToContractorAt") return fmtDay(rev.issuedToContractorAt);
  if (rowKey === "issuedToClientAt") return fmtDay(rev.issuedToClientAt);
  if (rowKey === "contractorSign") {
    if (rev.contractorSignUrl) {
      return (
        <img
          src={resolveDrawingFileUrl(rev.contractorSignUrl)}
          alt={rev.contractorSignName || "Contractor signature"}
          className="h-8 max-w-[80px] object-contain border border-line rounded bg-white mx-auto"
        />
      );
    }
    return rev.contractorSignName || "—";
  }
  if (rowKey === "clientSign") {
    if (rev.clientSignUrl) {
      return (
        <img
          src={resolveDrawingFileUrl(rev.clientSignUrl)}
          alt={rev.clientSignName || "Client signature"}
          className="h-8 max-w-[80px] object-contain border border-line rounded bg-white mx-auto"
        />
      );
    }
    return rev.clientSignName || "—";
  }
  return "—";
}

/** Client Site Drawing Register matrix — receive & issue × R0–R6 per drawing */
export function SiteDrawingRegisterTable({
  drawings,
  projectId,
}: {
  drawings: any[];
  projectId: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] min-w-[1400px] border-collapse sheet-register__table">
        <thead>
          <tr className="bg-procore-navy text-white">
            <th className="px-2 py-2 text-left">Sr</th>
            <th className="px-2 py-2 text-left">Details of drawing</th>
            <th className="px-2 py-2 text-left">Discipline</th>
            <th className="px-2 py-2 text-left">Drawing no.</th>
            <th className="px-2 py-2 text-left min-w-[180px]">Receive &amp; issue details</th>
            {SITE_REGISTER_REV_SLOTS.map((r) => (
              <th key={r} className="px-2 py-2 text-center">
                {r}
              </th>
            ))}
            <th className="px-2 py-2 text-left">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {drawings.map((d, sr) =>
            SITE_REGISTER_ISSUE_ROWS.map((row, rowIdx) => (
              <tr key={`${d.id}-${row.key}`} className="border-t border-line hover:bg-sand/30">
                {rowIdx === 0 && (
                  <>
                    <td className="px-2 py-1 align-top font-mono" rowSpan={SITE_REGISTER_ISSUE_ROWS.length}>
                      {sr + 1}
                    </td>
                    <td className="px-2 py-1 align-top" rowSpan={SITE_REGISTER_ISSUE_ROWS.length}>
                      <div className="font-medium">{d.title}</div>
                      <Link to={`/projects/${projectId}/drawings`} className="text-brand text-[10px] font-semibold">
                        GFC log →
                      </Link>
                    </td>
                    <td className="px-2 py-1 align-top" rowSpan={SITE_REGISTER_ISSUE_ROWS.length}>
                      {d.discipline}
                    </td>
                    <td className="px-2 py-1 align-top font-mono font-semibold text-brand" rowSpan={SITE_REGISTER_ISSUE_ROWS.length}>
                      {d.drawingNumber}
                    </td>
                  </>
                )}
                <td className="px-2 py-1 text-steel-muted whitespace-nowrap">{formatUiText(row.label)}</td>
                {SITE_REGISTER_REV_SLOTS.map((slot) => {
                  const rev = gfcRevisionForSlot(d.revisions || [], slot);
                  return (
                    <td key={slot} className="px-2 py-1 text-center align-middle">
                      {cellForRow(rev, row.key)}
                    </td>
                  );
                })}
                {rowIdx === 0 && (
                  <td className="px-2 py-1 align-top text-xs" rowSpan={SITE_REGISTER_ISSUE_ROWS.length}>
                    {gfcRevisionForSlot(d.revisions || [], d.currentRev || "R0")?.issueRemarks || d.remarks || "—"}
                  </td>
                )}
              </tr>
            ))
          )}
          {!drawings.length && (
            <tr>
              <td colSpan={5 + SITE_REGISTER_REV_SLOTS.length + 1} className="px-4 py-8 text-center text-steel-muted">
                No drawings — add GFC register lines first.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
