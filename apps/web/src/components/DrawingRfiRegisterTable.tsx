import {
  SPDC_RFI_REGISTER_COLUMNS,
  buildSpdcRegisterRow,
  registerStatusCellClass,
  slaStatusCellClass,
  type DrawingRfiRow,
} from "../lib/rfiRegisterColumns";

type Props = {
  rows: DrawingRfiRow[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
};

export function DrawingRfiRegisterTable({ rows, activeId, onSelect }: Props) {
  if (!rows.length) {
    return (
      <p className="text-sm text-steel-muted py-10 text-center border border-line rounded-lg bg-sand/20">
        No RFIs in the register yet — use Ask (PMC RFI) or Request checklist fill to add a row.
      </p>
    );
  }

  return (
    <div className="sheet-register flex flex-col flex-1 min-h-0 overflow-hidden register-panel-fill border border-line rounded-lg bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-line bg-procore-navy text-white flex flex-wrap justify-between gap-2 shrink-0">
        <div>
          <div className="text-sm font-semibold">RFI register</div>
          <div className="text-[11px] text-white/70 font-mono">SPDC_RFI_Form_and_Register.xlsx · 04_RFI_REGISTER</div>
        </div>
        <span className="text-xs font-mono bg-white/10 px-2 py-1 rounded">{rows.length} rows</span>
      </div>
      <div className="sheet-register__scroll register-sheet-viewport flex-1 min-h-0 overflow-auto">
        <table className="w-full text-[11px] min-w-[2400px]">
          <thead className="bg-sand text-left text-[10px] uppercase tracking-wide text-steel-muted sticky top-0 z-10">
            <tr>
              {SPDC_RFI_REGISTER_COLUMNS.map((col) => (
                <th key={col} className="px-2 py-2 whitespace-nowrap font-semibold">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const cells = buildSpdcRegisterRow(row);
              const active = row.id === activeId;
              return (
                <tr
                  key={row.id}
                  className={`border-t border-line ${active ? "bg-brand-soft/50" : "hover:bg-sand/40"} ${onSelect ? "cursor-pointer" : ""}`}
                  onClick={() => onSelect?.(row.id)}
                >
                  {SPDC_RFI_REGISTER_COLUMNS.map((col) => {
                    const val = cells[col] || "—";
                    const cls =
                      col === "SLA STATUS"
                        ? slaStatusCellClass(val)
                        : col === "STATUS"
                          ? registerStatusCellClass(val)
                          : col === "RFI NO"
                            ? "font-mono font-semibold text-brand"
                            : "";
                    return (
                      <td
                        key={col}
                        className={`px-2 py-2 align-top max-w-[220px] ${cls}`}
                        title={val.length > 48 ? val : undefined}
                      >
                        <span className="line-clamp-3">{val}</span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
