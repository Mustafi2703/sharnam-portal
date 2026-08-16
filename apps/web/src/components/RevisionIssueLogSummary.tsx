import { resolveDrawingFileUrl } from "../lib/drawingPreview";
import { formatUiText } from "../lib/formatUiText";

function fmtDay(d?: string | Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Site receive & issue block — shown on GFC upload log for office review / UAT */
export function RevisionIssueLogSummary({ rev }: { rev: any }) {
  const hasIssue =
    rev?.receivedDate ||
    rev?.copiesReceived != null ||
    rev?.issuedToContractorAt ||
    rev?.issuedToClientAt ||
    rev?.contractorSignUrl ||
    rev?.clientSignUrl ||
    rev?.contractorSignName ||
    rev?.clientSignName ||
    rev?.issueRemarks;

  if (!hasIssue) {
    return (
      <p className="text-[11px] text-steel-muted mt-2 italic">
        {formatUiText("No receive/issue record — add dates and signatures when uploading or updating this revision.")}
      </p>
    );
  }

  return (
    <div className="mt-2 pt-2 border-t border-line/60 space-y-2">
      <p className="text-[10px] font-mono uppercase tracking-wider text-steel-muted">
        {formatUiText("Site register — receive & issue")}
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-1 text-[11px]">
        <div>
          <span className="text-steel-muted">Received · </span>
          {fmtDay(rev.receivedDate || rev.actualDate)}
        </div>
        <div>
          <span className="text-steel-muted">Copies · </span>
          {rev.copiesReceived != null ? rev.copiesReceived : "—"}
        </div>
        <div>
          <span className="text-steel-muted">Issued contractor · </span>
          {fmtDay(rev.issuedToContractorAt)}
        </div>
        <div>
          <span className="text-steel-muted">Issued client · </span>
          {fmtDay(rev.issuedToClientAt)}
        </div>
      </div>
      <div className="flex flex-wrap gap-4 items-end">
        <div className="text-[11px]">
          <div className="text-steel-muted mb-1">
            {formatUiText("Contractor signature")}
            {rev.contractorSignName ? ` · ${rev.contractorSignName}` : ""}
          </div>
          {rev.contractorSignUrl ? (
            <img
              src={resolveDrawingFileUrl(rev.contractorSignUrl)}
              alt={rev.contractorSignName || "Contractor signature"}
              className="h-10 max-w-[120px] object-contain border border-line rounded bg-white"
            />
          ) : (
            <span className="text-steel-muted">—</span>
          )}
        </div>
        <div className="text-[11px]">
          <div className="text-steel-muted mb-1">
            {formatUiText("Client signature")}
            {rev.clientSignName ? ` · ${rev.clientSignName}` : ""}
          </div>
          {rev.clientSignUrl ? (
            <img
              src={resolveDrawingFileUrl(rev.clientSignUrl)}
              alt={rev.clientSignName || "Client signature"}
              className="h-10 max-w-[120px] object-contain border border-line rounded bg-white"
            />
          ) : (
            <span className="text-steel-muted">—</span>
          )}
        </div>
      </div>
      {rev.issueRemarks && (
        <p className="text-[11px] text-steel-muted">
          <span className="font-semibold text-ink">Remarks · </span>
          {rev.issueRemarks}
        </p>
      )}
    </div>
  );
}
