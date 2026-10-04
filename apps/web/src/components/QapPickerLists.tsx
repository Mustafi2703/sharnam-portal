import { useMemo } from "react";
import { QAP_PICKERS, type QapPickerKey } from "@sharnam/shared";

type Row = Partial<Record<QapPickerKey | "activity", string | null | undefined>>;

/** <datalist id="qap-pick-<column>"> suggestions: SPDC QAP values plus anything already used on this project. */
export function QapPickerLists({ rows = [] }: { rows?: Row[] }) {
  const lists = useMemo(() => {
    const out: [string, string[]][] = [];
    for (const key of Object.keys(QAP_PICKERS) as QapPickerKey[]) {
      const seen = new Set<string>(QAP_PICKERS[key] as readonly string[]);
      for (const r of rows) {
        const v = String((key === "section" ? r.section || r.activity : r[key]) || "").trim();
        if (v && v.length <= 80) seen.add(v);
      }
      out.push([key, [...seen]]);
    }
    return out;
  }, [rows]);

  return (
    <>
      {lists.map(([key, values]) => (
        <datalist key={key} id={`qap-pick-${key}`}>
          {values.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      ))}
    </>
  );
}
