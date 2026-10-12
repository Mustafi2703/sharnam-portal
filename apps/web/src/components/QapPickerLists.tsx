import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { QAP_PICKERS, type QapPickerKey } from "@sharnam/shared";
import { useAuth } from "../auth";
import { useQapSettings } from "../lib/qapSettings";

type Row = Partial<Record<QapPickerKey | "activity", string | null | undefined>>;

/** <datalist id="qap-pick-<column>"> suggestions: this project's QAP pick-lists (QAP settings) plus anything already used. */
export function QapPickerLists({ rows = [] }: { rows?: Row[] }) {
  const { id } = useParams();
  const { token } = useAuth();
  const { data } = useQapSettings(id, token);
  const lists = useMemo(() => {
    const out: [string, string[]][] = [];
    for (const key of Object.keys(QAP_PICKERS) as QapPickerKey[]) {
      const seen = new Set<string>(data?.pickers?.[key] || (QAP_PICKERS[key] as readonly string[]));
      for (const r of rows) {
        const v = String((key === "section" ? r.section || r.activity : r[key]) || "").trim();
        if (v && v.length <= 80) seen.add(v);
      }
      out.push([key, [...seen]]);
    }
    return out;
  }, [rows, data]);

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
