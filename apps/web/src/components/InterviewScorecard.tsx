import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Button } from "./ui";

type Param = {
  code: string;
  category: string;
  parameter: string;
  probe: string;
  weights: Record<string, number>;
};

type Framework = { roles: string[]; params: Param[]; rounds: string[] };

const ROUND_LABEL: Record<string, string> = {
  R1: "R1 – HR Screening",
  R2: "R2 – Technical",
  R3: "R3 – Management",
};

/** SPDC/HR/F-INT-01 — one round, weights by position, scores 1–5. */
export function InterviewScorecard({
  token,
  positionHint,
  roundHint,
  onSave,
}: {
  token: string;
  positionHint?: string;
  roundHint?: string;
  onSave: (scorecard: { position: string; round: string; scores: Record<string, number[]> }) => Promise<void>;
}) {
  const [framework, setFramework] = useState<Framework | null>(null);
  const [position, setPosition] = useState(positionHint || "");
  const [round, setRound] = useState(roundHint?.startsWith("R3") ? "R3" : roundHint?.startsWith("R1") ? "R1" : "R2");
  const [scores, setScores] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Framework>("/api/hrm/interview-framework", { token }).then(setFramework).catch(() => setFramework(null));
  }, [token]);

  useEffect(() => {
    if (framework && !position) setPosition(framework.roles[0] || "");
  }, [framework, position]);

  const lines = useMemo(() => {
    if (!framework || !position) return [];
    return framework.params.filter((p) => (p.weights[position] || 0) > 0);
  }, [framework, position]);

  const preview = useMemo(() => {
    const weighted = lines.reduce((acc, p) => {
      const n = Number(scores[p.code]);
      if (!n) return acc;
      return { sum: acc.sum + (n / 5) * p.weights[position], w: acc.w + p.weights[position] };
    }, { sum: 0, w: 0 });
    const percent = weighted.w ? (weighted.sum / weighted.w) * 100 : 0;
    const grade = percent >= 85 ? "A" : percent >= 75 ? "B" : percent >= 65 ? "C" : "D";
    return { percent, grade };
  }, [lines, scores, position]);

  if (!framework) return <p className="text-xs text-steel-muted">Loading SPDC scorecard…</p>;

  return (
    <div className="md:col-span-4 space-y-2">
      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-xs">
          Position
          <select className="mt-1 block border border-line rounded px-2 py-1" value={position} onChange={(e) => setPosition(e.target.value)}>
            {framework.roles.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Round
          <select className="mt-1 block border border-line rounded px-2 py-1" value={round} onChange={(e) => setRound(e.target.value)}>
            {framework.rounds.map((r) => (
              <option key={r} value={r}>{ROUND_LABEL[r] || r}</option>
            ))}
          </select>
        </label>
        <span className="text-xs text-steel-muted pb-1">
          Score {preview.percent.toFixed(1)}% · Grade {preview.grade}
        </span>
      </div>
      <div className="max-h-64 overflow-auto border border-line rounded">
        <table className="w-full text-xs">
          <thead className="bg-sand/50 sticky top-0">
            <tr>
              <th className="text-left px-2 py-1">Parameter</th>
              <th className="text-left px-2 py-1">Weight</th>
              <th className="text-left px-2 py-1">Score 1–5</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((p) => (
              <tr key={p.code} className="border-t border-line">
                <td className="px-2 py-1">
                  <span className="font-mono text-[10px] text-steel-muted mr-1">{p.code}</span>
                  {p.parameter}
                  <div className="text-[10px] text-steel-muted">{p.category}</div>
                </td>
                <td className="px-2 py-1">{p.weights[position]}%</td>
                <td className="px-2 py-1">
                  <input
                    type="number"
                    min={1}
                    max={5}
                    className="w-16 border border-line rounded px-1 py-0.5"
                    value={scores[p.code] || ""}
                    onChange={(e) => setScores({ ...scores, [p.code]: e.target.value })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          const payload: Record<string, number[]> = {};
          for (const [code, raw] of Object.entries(scores)) {
            const n = Number(raw);
            if (n >= 1 && n <= 5) payload[code] = [n];
          }
          void onSave({ position, round, scores: payload }).finally(() => setBusy(false));
        }}
      >
        Save scorecard
      </Button>
    </div>
  );
}
