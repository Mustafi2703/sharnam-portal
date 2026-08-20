import { useMemo } from "react";
import { Badge, Button, Card } from "./ui";

export type HiraRecord = {
  id: string;
  ncrNumber?: string | null;
  title?: string | null;
  activityTask?: string | null;
  category?: string | null;
  description?: string | null;
  location?: string | null;
  contributingFactors?: string | null;
  rootCause?: string | null;
  correctiveAction?: string | null;
  longTermAction?: string | null;
  timeImpact?: string | null;
  costImpact?: string | null;
  issuedTo?: string | null;
  severity?: string | null;
  status?: string | null;
};

function scoreClass(score: number | null) {
  if (score == null) return "";
  if (score >= 15) return "hira-score-critical";
  if (score >= 8) return "hira-score-high";
  if (score >= 4) return "hira-score-medium";
  return "hira-score-low";
}

function parseScore(v?: string | null): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type Props = {
  rows: HiraRecord[];
  activeId?: string | null;
  onSelect: (id: string) => void;
  canEdit?: boolean;
  busy?: boolean;
  onLoadTemplate?: () => void;
};

/** SPDC Safety Dashboard.xlsx · HIRA — activity, risk ID, hazard, P×I, controls, residual. */
export function HiraRegisterTable({ rows, activeId, onSelect, canEdit, busy, onLoadTemplate }: Props) {
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const ca = a.category || "";
      const cb = b.category || "";
      if (ca !== cb) return ca.localeCompare(cb);
      return (a.ncrNumber || "").localeCompare(b.ncrNumber || "", undefined, { numeric: true });
    });
  }, [rows]);

  const bands = useMemo(() => {
    let last = "";
    return sorted.map((r) => {
      const key = r.category || r.activityTask || "";
      const show = key !== last;
      last = key;
      return { row: r, showBand: show, band: key };
    });
  }, [sorted]);

  return (
    <Card padding={false} className="flex flex-col max-h-[min(72vh,56rem)] min-h-[22rem] overflow-hidden">
      <div className="px-4 py-3 border-b border-line bg-sand/40 shrink-0 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-sm text-left">HIRA register — Safety Dashboard.xlsx</h3>
          <p className="text-xs text-steel-muted mt-0.5">
            {sorted.length} risk {sorted.length === 1 ? "line" : "lines"} · Probability × Impact · residual after control
          </p>
        </div>
        {canEdit && onLoadTemplate && (
          <Button type="button" variant="secondary" className="!text-xs" disabled={busy} onClick={onLoadTemplate}>
            Load HIRA from Safety Dashboard
          </Button>
        )}
      </div>
      <div className="sheet-register overflow-auto flex-1 min-h-0">
        <table className="hira-register__table min-w-[72rem] w-full">
          <thead>
            <tr className="bg-brand text-white">
              <th rowSpan={2} className="text-left">Sr</th>
              <th rowSpan={2} className="text-left">Activity</th>
              <th rowSpan={2} className="text-left">Risk ID</th>
              <th rowSpan={2} className="text-left">Hazard</th>
              <th rowSpan={2} className="text-left">Consequence</th>
              <th rowSpan={2} className="text-center">Legal</th>
              <th colSpan={3} className="text-center">Risk analysis</th>
              <th rowSpan={2} className="text-left">Control measure</th>
              <th colSpan={3} className="text-center">Residual risk</th>
              <th rowSpan={2} className="text-left">Remarks</th>
            </tr>
            <tr className="bg-brand text-white text-[10px]">
              <th className="text-center">P</th>
              <th className="text-center">I</th>
              <th className="text-center">Sev</th>
              <th className="text-center">P</th>
              <th className="text-center">I</th>
              <th className="text-center">Sev</th>
            </tr>
          </thead>
          <tbody>
            {bands.map(({ row, showBand, band }) => {
              const hazard = (row.description || "").split(" · ")[0] || row.title || "—";
              const consequence = row.location || (row.description || "").split(" · ")[1] || "—";
              const analysis = (row.rootCause || "").match(/P\s+(\d+)\s*×\s*I\s+(\d+)\s*=\s*(\d+)/i);
              const residual = (row.longTermAction || "").match(/P\s+(\d+)\s*×\s*I\s+(\d+)\s*=\s*(\d+)/i);
              const p = analysis ? Number(analysis[1]) : null;
              const i = analysis ? Number(analysis[2]) : null;
              const sev = parseScore(row.timeImpact) ?? (analysis ? Number(analysis[3]) : null);
              const rp = residual ? Number(residual[1]) : null;
              const ri = residual ? Number(residual[2]) : null;
              const rsev = parseScore(row.costImpact) ?? (residual ? Number(residual[3]) : null);
              return (
                <tr
                  key={row.id}
                  className={`${activeId === row.id ? "hira-row-active" : ""} ${scoreClass(sev)}`}
                  onClick={() => onSelect(row.id)}
                >
                  <td className="font-mono">{showBand ? band || "·" : ""}</td>
                  <td className="font-semibold text-brand-dark">{showBand ? row.activityTask || "—" : ""}</td>
                  <td className="font-mono font-semibold">{row.ncrNumber || "—"}</td>
                  <td>{hazard}</td>
                  <td>{consequence}</td>
                  <td className="text-center">{row.contributingFactors || "—"}</td>
                  <td className="text-center tabular-nums">{p ?? "—"}</td>
                  <td className="text-center tabular-nums">{i ?? "—"}</td>
                  <td className={`text-center tabular-nums font-semibold ${scoreClass(sev)}`}>{sev ?? "—"}</td>
                  <td>{row.correctiveAction || "—"}</td>
                  <td className="text-center tabular-nums">{rp ?? "—"}</td>
                  <td className="text-center tabular-nums">{ri ?? "—"}</td>
                  <td className={`text-center tabular-nums font-semibold ${scoreClass(rsev)}`}>{rsev ?? "—"}</td>
                  <td>
                    {row.issuedTo || "—"}
                    {row.severity ? (
                      <span className="ml-1">
                        <Badge
                          tone={
                            row.severity === "Critical" || row.severity === "High"
                              ? "danger"
                              : row.severity === "Low"
                                ? "ok"
                                : "warn"
                          }
                        >
                          {row.severity}
                        </Badge>
                      </span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {!sorted.length && (
              <tr>
                <td colSpan={14} className="empty text-left p-4">
                  No HIRA lines — click <strong>Load HIRA from Safety Dashboard</strong> to import all risk IDs (A1–O5).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
