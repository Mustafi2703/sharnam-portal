import { Link } from "react-router-dom";
import { api } from "../api";
import { Badge, Button } from "./ui";
import { packageClass, delayClass as regDelayClass, disciplineClass } from "../lib/registerTableTheme";
import { uniqSorted } from "../lib/masterDrawingRegister";

function fmtDay(d?: string | Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function delayClass(days: number | null | undefined) {
  return regDelayClass(days);
}

export function MasterDrawingRegisterTable({
  lines,
  filteredLines,
  projectId,
  canEdit,
  token,
  onLinePatched,
  filterPackage,
  filterBuilding,
  filterDiscipline,
  filterCritical,
  onFilterPackage,
  onFilterBuilding,
  onFilterDiscipline,
  onFilterCritical,
  onClearFilters,
}: {
  lines: any[];
  filteredLines: any[];
  projectId: string;
  canEdit?: boolean;
  token?: string | null;
  onLinePatched?: () => void | Promise<void>;
  filterPackage: string;
  filterBuilding: string;
  filterDiscipline: string;
  filterCritical: string;
  onFilterPackage: (v: string) => void;
  onFilterBuilding: (v: string) => void;
  onFilterDiscipline: (v: string) => void;
  onFilterCritical: (v: string) => void;
  onClearFilters: () => void;
}) {
  const packageOptions = ["All", ...uniqSorted(lines.map((l) => l.projectPackage))];
  const buildingOptions = ["All", ...uniqSorted(lines.map((l) => l.building))];
  const disciplineOptions = ["All", ...uniqSorted(lines.map((l) => l.discipline))];

  const filtersActive =
    filterPackage !== "All" || filterBuilding !== "All" || filterDiscipline !== "All" || filterCritical !== "All";

  return (
    <div className="sheet-register">
      <div className="px-4 py-3 border-b border-line bg-procore-navy text-white flex flex-wrap justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Master Drawing Register</div>
          <div className="text-[11px] text-white/70">DRAWING REGISTER - 01.xlsx · Master sheet</div>
        </div>
        <Badge tone="neutral">{filteredLines.length} / {lines.length} lines</Badge>
      </div>

      <div className="sheet-register__filter-bar px-4 py-3 border-b border-line space-y-3">
        <p className="reg-filter-label text-[10px] font-mono uppercase tracking-wider">Filter table</p>
        <div className="flex flex-wrap gap-1.5">
          {packageOptions.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onFilterPackage(p)}
              className={`reg-filter-pill ${filterPackage === p ? "is-active" : p !== "All" ? packageClass(p) : ""}`}
            >
              {p === "All" ? "All packages" : p}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            className="reg-filter-select"
            value={filterBuilding}
            onChange={(e) => onFilterBuilding(e.target.value)}
            aria-label="Filter by building"
          >
            {buildingOptions.map((b) => (
              <option key={b} value={b}>
                {b === "All" ? "All buildings" : b}
              </option>
            ))}
          </select>
          <select
            className="reg-filter-select"
            value={filterDiscipline}
            onChange={(e) => onFilterDiscipline(e.target.value)}
            aria-label="Filter by discipline"
          >
            {disciplineOptions.map((d) => (
              <option key={d} value={d}>
                {d === "All" ? "All disciplines" : d}
              </option>
            ))}
          </select>
          <select
            className="reg-filter-select"
            value={filterCritical}
            onChange={(e) => onFilterCritical(e.target.value)}
            aria-label="Filter by critical"
          >
            <option value="All">All critical</option>
            <option value="Yes">Critical only</option>
            <option value="No">Non-critical</option>
          </select>
          {filtersActive && (
            <Button type="button" variant="ghost" className="!text-xs !py-1" onClick={onClearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      </div>

      <div className="sheet-register__scroll">
        <table className="sheet-register__table min-w-[1800px]">
          <thead>
            <tr>
              <th>Sr</th>
              <th>Package</th>
              <th>Building</th>
              <th>Discipline</th>
              <th>Drawing no.</th>
              <th>Drawing title</th>
              <th>Type</th>
              <th>Consultant</th>
              <th>Rev</th>
              <th>Rev date</th>
              <th>Rev description</th>
              <th>Latest</th>
              <th>Planned</th>
              <th>Actual</th>
              <th>Delay</th>
              <th>Delay resp.</th>
              <th>Issued to</th>
              <th>Issue date</th>
              <th>Copies</th>
              <th>Critical</th>
              <th>Remarks</th>
              <th>GFC</th>
            </tr>
          </thead>
          <tbody>
            {filteredLines.map((r) => (
              <tr key={r.id}>
                <td className="font-mono text-xs">{r.srNo ?? "—"}</td>
                <td>
                  {r.projectPackage ? (
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${packageClass(r.projectPackage)}`}>
                      {r.projectPackage}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="text-xs">{r.building || "—"}</td>
                <td>{r.discipline ? <span className={disciplineClass(r.discipline)}>{r.discipline}</span> : "—"}</td>
                <td className="font-mono text-xs font-semibold text-brand">
                  {String(r.drawingNumber || "").replace(/\s·\s*\d+$/, "")}
                </td>
                <td className="max-w-[12rem]">{r.drawingTitle}</td>
                <td className="max-w-[9rem] text-xs">{r.drawingType || "—"}</td>
                <td className="max-w-[9rem] text-xs">{r.consultantName || "—"}</td>
                <td className="font-mono">{r.revisionNumber || "—"}</td>
                <td className="text-xs whitespace-nowrap">{fmtDay(r.revisionDate)}</td>
                <td className="max-w-[10rem] text-xs">{r.revisionDescription || "—"}</td>
                <td>{r.latestRevision || "—"}</td>
                <td className="text-xs whitespace-nowrap">
                  {canEdit ? (
                    <input
                      type="date"
                      className="text-xs border border-line rounded px-1 py-0.5 bg-white"
                      defaultValue={r.plannedSubmissionDate ? new Date(r.plannedSubmissionDate).toISOString().slice(0, 10) : ""}
                      onBlur={async (e) => {
                        const v = e.target.value;
                        const prev = r.plannedSubmissionDate
                          ? new Date(r.plannedSubmissionDate).toISOString().slice(0, 10)
                          : "";
                        if (v === prev) return;
                        await api(`/api/drawings/register-lines/${r.id}`, {
                          method: "PATCH",
                          token,
                          body: JSON.stringify({ plannedSubmissionDate: v || null }),
                        });
                        await onLinePatched?.();
                      }}
                    />
                  ) : (
                    fmtDay(r.plannedSubmissionDate)
                  )}
                </td>
                <td className="text-xs whitespace-nowrap">{fmtDay(r.actualSubmissionDate)}</td>
                <td className={`text-xs font-mono ${delayClass(r.submissionDelayDays)}`}>
                  {r.submissionDelayDays != null ? r.submissionDelayDays : "—"}
                </td>
                <td className="max-w-[8rem] text-xs">{r.delayResponsibility || "—"}</td>
                <td className="max-w-[8rem] text-xs">{r.issuedTo || "—"}</td>
                <td className="text-xs whitespace-nowrap">{fmtDay(r.issueDate)}</td>
                <td className="font-mono">{r.copiesCount ?? "—"}</td>
                <td>
                  {/yes/i.test(r.criticalDrawing || "") ? (
                    <Badge tone="warn">Yes</Badge>
                  ) : (
                    <span className="text-steel-muted text-xs">No</span>
                  )}
                </td>
                <td className="max-w-[10rem] text-xs">{r.remarks || "—"}</td>
                <td>
                  {r.drawing?.id ? (
                    <Badge tone="ok">Linked</Badge>
                  ) : (
                    <Link to={`/projects/${projectId}/drawings?upload=1`} className="text-xs font-semibold text-brand">
                      Upload
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {!filteredLines.length && (
              <tr>
                <td colSpan={22} className="empty">
                  {lines.length ? "No lines match filters." : "No lines — add above or run seed."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
