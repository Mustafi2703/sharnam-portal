import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Card } from "./ui";
import { RegisterFilterBar } from "./RegisterFilterBar";

export type SorSummaryRow = {
  label: string;
  total: number;
  open: number;
  closed: number;
  closureRate: number;
};

export type SorEntryRow = {
  id: string;
  date: string;
  type: string;
  reference: string;
  description: string;
  location?: string | null;
  status: string;
  source?: string;
};

type Props = {
  projectId: string;
  summary: SorSummaryRow[];
  entries: SorEntryRow[];
};

const TYPE_OPTIONS = ["Site Observation", "Site Instruction", "NCR", "CAR"];

/** SOR Log — summary totals + dated register for DPR quality block. */
export function SorLogPanel({ projectId, summary, entries }: Props) {
  const [filters, setFilters] = useState<Record<string, string>>({
    type: "All",
    status: "All",
    from: "",
    to: "",
    q: "",
  });

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filters.type !== "All" && e.type !== filters.type) return false;
      if (filters.status !== "All" && e.status !== filters.status) return false;
      if (filters.from && e.date < filters.from) return false;
      if (filters.to && e.date > filters.to) return false;
      if (filters.q) {
        const hay = `${e.reference} ${e.description} ${e.location || ""}`.toLowerCase();
        if (!hay.includes(filters.q.toLowerCase())) return false;
      }
      return true;
    });
  }, [entries, filters]);

  return (
    <Card padding={false} className="flex flex-col register-panel-fill">
      <div className="px-4 py-3 border-b border-line bg-sand/40 shrink-0">
        <h3 className="font-semibold text-sm text-left">SOR Log — Site Observation Register</h3>
        <p className="text-xs text-steel-muted mt-1 text-left">
          Summary from Quality Dashboard.xlsx plus live dated lines (site observation, site instruction, NCR, CAR) — feeds DPR Quality section.
          Quality forms stay here; use{" "}
          <Link to={`/projects/${projectId}/comms`} className="text-brand font-semibold">
            Comms → Comm log
          </Link>{" "}
          only for meeting / communication entries.
        </p>
      </div>

      {summary.length > 0 && (
        <div className="overflow-x-auto shrink-0 border-b border-line">
          <table className="sheet-register__table min-w-[28rem] w-full text-xs">
            <thead>
              <tr>
                <th className="text-left">Observation type</th>
                <th className="text-left">Total</th>
                <th className="text-left">Open</th>
                <th className="text-left">Closed</th>
                <th className="text-left">Closure rate</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((r, i) => (
                <tr key={i}>
                  <td className="text-left font-medium">{r.label}</td>
                  <td className="text-left font-mono tabular-nums">{r.total}</td>
                  <td className="text-left tabular-nums">{r.open}</td>
                  <td className="text-left tabular-nums">{r.closed}</td>
                  <td className="text-left font-mono tabular-nums">{(r.closureRate * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RegisterFilterBar
        fields={[
          { key: "type", label: "Type", type: "select", options: TYPE_OPTIONS },
          { key: "status", label: "Status", type: "select", options: ["Open", "Closed"] },
          { key: "from", label: "From date", type: "date" },
          { key: "to", label: "To date", type: "date" },
          { key: "q", label: "Search", type: "text", placeholder: "Reference, location…" },
        ]}
        values={filters}
        onChange={(k, v) => setFilters({ ...filters, [k]: v })}
        onClear={() => setFilters({ type: "All", status: "All", from: "", to: "", q: "" })}
      />

      <div className="sheet-register overflow-auto register-sheet-viewport">
        <table className="sheet-register__table min-w-[52rem] w-full text-xs">
          <thead className="sticky top-0 z-10 bg-white shadow-sm">
            <tr>
              <th className="text-left">Date</th>
              <th className="text-left">Type</th>
              <th className="text-left">Reference</th>
              <th className="text-left min-w-[14rem]">Description</th>
              <th className="text-left">Location</th>
              <th className="text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id}>
                <td className="text-left whitespace-nowrap font-mono">{e.date}</td>
                <td className="text-left font-medium">{e.type}</td>
                <td className="text-left font-mono text-[10px]">{e.reference}</td>
                <td className="text-left align-top max-w-md">{e.description}</td>
                <td className="text-left">{e.location || "—"}</td>
                <td className="text-left">
                  <Badge tone={e.status === "Open" ? "warn" : "ok"}>{e.status}</Badge>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={6} className="empty text-left p-4">
                  No dated SOR lines match filters — log site observation / instruction under Quality module tabs, or raise NCR/CAR.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-line text-[10px] text-steel-muted shrink-0">
        Showing {filtered.length} of {entries.length} dated lines · sorted newest first
      </div>
    </Card>
  );
}
