import type { HrLetterTable } from "@sharnam/shared";
import { Button } from "../../components/ui";

type Props = {
  spec: HrLetterTable;
  rows: string[][];
  onChange: (rows: string[][]) => void;
};

const CELL = "w-full bg-transparent px-2 py-1.5 text-[12px] text-ink outline-none focus:bg-sky-50";

/** Editable grid for a multi-row table in an SPDC letter (assets, KRAs, cheques, projects…). */
export default function LetterTableEditor({ spec, rows, onChange }: Props) {
  const fixed = Boolean(spec.fixedRows);
  const setCell = (r: number, c: number, value: string) =>
    onChange(rows.map((row, i) => (i === r ? row.map((v, j) => (j === c ? value : v)) : row)));
  const addRow = () => onChange([...rows, spec.columns.map(() => "")]);
  const removeRow = (r: number) => {
    const next = rows.filter((_, i) => i !== r);
    onChange(next.length ? next : [spec.columns.map(() => "")]);
  };
  const total = spec.columns.reduce((n, c) => n + (c.width || 1), 0) + (fixed ? 3 : 0);

  return (
    <div className="space-y-1.5" data-preserve-case>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-steel-muted uppercase font-mono">{spec.label}</p>
        {!fixed && (
          <Button type="button" variant="secondary" onClick={addRow}>
            Add row
          </Button>
        )}
      </div>
      {spec.hint && <p className="text-[11px] text-steel-muted">{spec.hint}</p>}
      <div className="overflow-x-auto rounded border border-line">
        <table className="w-full table-fixed border-collapse text-left">
          <colgroup>
            <col style={{ width: "2.5rem" }} />
            {fixed && <col style={{ width: `${(3 / total) * 100}%` }} />}
            {spec.columns.map((c) => (
              <col key={c.label} style={{ width: `${((c.width || 1) / total) * 100}%` }} />
            ))}
            {!fixed && <col style={{ width: "4.5rem" }} />}
          </colgroup>
          <thead className="bg-[#445469] text-white">
            <tr>
              <th className="px-2 py-1.5 text-[11px] font-semibold">No.</th>
              {fixed && <th className="px-2 py-1.5 text-[11px] font-semibold">Item</th>}
              {spec.columns.map((c) => (
                <th key={c.label} className="border-l border-white/20 px-2 py-1.5 text-[11px] font-semibold">
                  {c.label}
                </th>
              ))}
              {!fixed && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className="border-t border-line align-top">
                <td className="px-2 py-1.5 text-[12px] text-steel-muted">{r + 1}</td>
                {fixed && <td className="px-2 py-1.5 text-[12px] text-ink">{spec.fixedRows![r]}</td>}
                {spec.columns.map((c, j) => (
                  <td key={c.label} className="border-l border-line p-0">
                    <input
                      className={CELL}
                      type={c.type === "date" ? "date" : "text"}
                      value={row[j] ?? ""}
                      aria-label={`${c.label} row ${r + 1}`}
                      onChange={(e) => setCell(r, j, e.target.value)}
                    />
                  </td>
                ))}
                {!fixed && (
                  <td className="border-l border-line px-1 py-1 text-center">
                    <button type="button" className="text-[11px] text-red-700 hover:underline" onClick={() => removeRow(r)}>
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
