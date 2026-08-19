import { Link } from "react-router-dom";
import { Badge } from "./ui";
import { resolveDrawingFileUrl } from "../lib/drawingPreview";
import {
  SITE_REGISTER_ISSUE_ROWS,
  SITE_REGISTER_REV_SLOTS,
} from "../lib/drawingIssueFields";
import { gfcRevisionForSlot, normalizeRevNumber } from "../lib/gfcRegister";
import { disciplineClass } from "../lib/registerTableTheme";
import { formatUiText } from "../lib/formatUiText";

function fmtDay(d?: string | Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function cellHasData(rev: any | undefined, rowKey: (typeof SITE_REGISTER_ISSUE_ROWS)[number]["key"]) {
  if (!rev) return false;
  if (rowKey === "receivedDate") return !!(rev.receivedDate || rev.actualDate);
  if (rowKey === "copiesReceived") return rev.copiesReceived != null;
  if (rowKey === "issuedToContractorAt") return !!rev.issuedToContractorAt;
  if (rowKey === "issuedToClientAt") return !!rev.issuedToClientAt;
  if (rowKey === "clientSign") return !!(rev.clientSignUrl || rev.clientSignName);
  if (rowKey === "pmcSign") return !!(rev.pmcSignUrl || rev.pmcSignName);
  if (rowKey === "siteEngineerSign") return !!(rev.siteEngineerSignUrl || rev.siteEngineerSignName);
  return false;
}

function signCell(rev: any, urlKey: string, nameKey: string, alt: string) {
  if (rev[urlKey]) {
    return (
      <img
        src={resolveDrawingFileUrl(rev[urlKey])}
        alt={rev[nameKey] || alt}
        className="site-register__signature"
      />
    );
  }
  return rev[nameKey] || "—";
}

function cellForRow(rev: any | undefined, rowKey: (typeof SITE_REGISTER_ISSUE_ROWS)[number]["key"]) {
  if (!rev || !cellHasData(rev, rowKey)) {
    return <span className="site-register__empty">—</span>;
  }
  if (rowKey === "receivedDate") return fmtDay(rev.receivedDate || rev.actualDate);
  if (rowKey === "copiesReceived") return rev.copiesReceived != null ? String(rev.copiesReceived) : "—";
  if (rowKey === "issuedToContractorAt") return fmtDay(rev.issuedToContractorAt);
  if (rowKey === "issuedToClientAt") return fmtDay(rev.issuedToClientAt);
  if (rowKey === "clientSign") return signCell(rev, "clientSignUrl", "clientSignName", "Client signature");
  if (rowKey === "pmcSign") return signCell(rev, "pmcSignUrl", "pmcSignName", "PMC signature");
  if (rowKey === "siteEngineerSign") return signCell(rev, "siteEngineerSignUrl", "siteEngineerSignName", "Site engineer signature");
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
    <div className="sheet-register site-register">
      <div className="site-register__head px-4 py-3 border-b border-line flex flex-wrap justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Site Drawing Register</div>
          <div className="text-[11px] site-register__sub">
            Receive &amp; issue matrix R0–R6 · dates, copies, signatures from GFC uploads
          </div>
        </div>
        <Badge tone="neutral">{drawings.length} drawings</Badge>
      </div>

      <div className="site-register__legend">
        <span className="site-register__legend-item">
          <i className="site-register__swatch site-register__swatch--current" aria-hidden />
          Current revision
        </span>
        <span className="site-register__legend-item">
          <i className="site-register__swatch site-register__swatch--data" aria-hidden />
          Has receive / issue data
        </span>
        <span className="site-register__legend-item">
          <i className="site-register__swatch site-register__swatch--empty" aria-hidden />
          Not filled yet
        </span>
      </div>

      <div className="sheet-register__scroll">
        <table className="sheet-register__table site-register__table min-w-[1500px]">
          <thead>
            <tr>
              <th className="site-register__col-fixed">Sr</th>
              <th className="site-register__col-fixed site-register__col-wide">Details of drawing</th>
              <th className="site-register__col-fixed">Discipline</th>
              <th className="site-register__col-fixed">Drawing no.</th>
              <th className="site-register__col-label">Receive &amp; issue details</th>
              {SITE_REGISTER_REV_SLOTS.map((r, i) => (
                <th key={r} className={`site-register__rev-head site-register__rev-head--${i}`}>
                  {r}
                </th>
              ))}
              <th>Remarks</th>
            </tr>
          </thead>
          {drawings.map((d, sr) => (
            <tbody key={d.id} className="site-register__drawing-block">
              {SITE_REGISTER_ISSUE_ROWS.map((row, rowIdx) => (
                <tr key={`${d.id}-${row.key}`} className="site-register__row">
                  {rowIdx === 0 && (
                    <>
                      <td className="site-register__col-fixed font-mono align-top" rowSpan={SITE_REGISTER_ISSUE_ROWS.length}>
                        {sr + 1}
                      </td>
                      <td className="site-register__col-fixed site-register__col-wide align-top" rowSpan={SITE_REGISTER_ISSUE_ROWS.length}>
                        <div className="font-medium text-ink">{d.title}</div>
                        <Link to={`/projects/${projectId}/drawings`} className="site-register__link text-[10px] font-semibold">
                          GFC log →
                        </Link>
                      </td>
                      <td className="site-register__col-fixed align-top" rowSpan={SITE_REGISTER_ISSUE_ROWS.length}>
                        <span className={disciplineClass(d.discipline)}>{d.discipline}</span>
                      </td>
                      <td className="site-register__col-fixed align-top font-mono font-semibold site-register__drawing-no" rowSpan={SITE_REGISTER_ISSUE_ROWS.length}>
                        {String(d.drawingNumber || "").replace(/\s·\s*\d+$/, "")}
                      </td>
                    </>
                  )}
                  <td className="site-register__col-label">{formatUiText(row.label)}</td>
                  {SITE_REGISTER_REV_SLOTS.map((slot, slotIdx) => {
                    const rev = gfcRevisionForSlot(d.revisions || [], slot);
                    const isCurrent = normalizeRevNumber(d.currentRev) === normalizeRevNumber(slot);
                    const hasData = cellHasData(rev, row.key);
                    return (
                      <td
                        key={slot}
                        className={[
                          "site-register__rev-cell",
                          `site-register__rev-cell--${slotIdx}`,
                          isCurrent && "is-current",
                          hasData && "has-data",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {cellForRow(rev, row.key)}
                      </td>
                    );
                  })}
                  {rowIdx === 0 && (
                    <td className="align-top text-xs site-register__remarks" rowSpan={SITE_REGISTER_ISSUE_ROWS.length}>
                      {gfcRevisionForSlot(d.revisions || [], d.currentRev || "R0")?.issueRemarks || d.remarks || (
                        <span className="site-register__empty">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          ))}
          {!drawings.length && (
            <tbody>
              <tr>
                <td colSpan={5 + SITE_REGISTER_REV_SLOTS.length + 1} className="empty">
                  No drawings — upload on GFC register first.
                </td>
              </tr>
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}
