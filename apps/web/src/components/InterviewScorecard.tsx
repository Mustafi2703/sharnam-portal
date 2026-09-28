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

type Framework = {
  roles: string[];
  params: Param[];
  rounds: string[];
  roundFocus?: Record<string, string[] | null>;
  roundNote?: Record<string, string>;
};

const ROUND_LABEL: Record<string, string> = {
  R1: "R1 – HR Screening",
  R2: "R2 – Technical",
  R3: "R3 – Management",
};

function roundId(round: string | null | undefined): "R1" | "R2" | "R3" {
  const raw = String(round || "");
  if (/^R1\b/i.test(raw) || /hr|screen/i.test(raw)) return "R1";
  if (/^R3\b/i.test(raw) || /manag/i.test(raw)) return "R3";
  return "R2";
}

/** SPDC/HR/F-INT-01 — one round, weights by position, scores 1–5. */
export function InterviewScorecard({
  token,
  positionHint,
  roundHint,
  saved,
  onSave,
}: {
  token: string;
  positionHint?: string;
  roundHint?: string;
  saved?: { position?: string; round?: string; scores?: Record<string, number[]> } | null;
  onSave: (scorecard: { position: string; round: string; scores: Record<string, number[]> }) => Promise<void>;
}) {
  const [framework, setFramework] = useState<Framework | null>(null);
  const [position, setPosition] = useState(saved?.position || positionHint || "");
  const [round, setRound] = useState(() => roundId(saved?.round || roundHint));
  const [scores, setScores] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {};
    for (const [code, vals] of Object.entries(saved?.scores || {})) {
      const n = Array.isArray(vals) ? vals[0] : vals;
      if (n) next[code] = String(n);
    }
    return next;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [savedNote, setSavedNote] = useState("");

  useEffect(() => {
    api<Framework>("/api/hrm/interview-framework", { token }).then(setFramework).catch(() => setFramework(null));
  }, [token]);

  useEffect(() => {
    setRound(roundId(saved?.round || roundHint));
  }, [saved?.round, roundHint]);

  useEffect(() => {
    if (!framework?.roles.length) return;
    if (framework.roles.includes(position)) return;
    const hint = positionHint && framework.roles.includes(positionHint) ? positionHint : framework.roles[0];
    if (hint) setPosition(hint);
  }, [framework, position, positionHint]);

  const lines = useMemo(() => {
    if (!framework || !position) return [];
    const focus = framework.roundFocus?.[round];
    return framework.params
      .filter((p) => !focus || focus.includes(p.code))
      .map((p) => ({ ...p, weight: p.weights[position] || 0 }));
  }, [framework, position, round]);

  const preview = useMemo(() => {
    const weighted = lines.reduce((acc, p) => {
      const n = Number(scores[p.code]);
      if (!n || !p.weight) return acc;
      return { sum: acc.sum + (n / 5) * p.weight, w: acc.w + p.weight };
    }, { sum: 0, w: 0 });
    const percent = weighted.w ? (weighted.sum / weighted.w) * 100 : 0;
    const grade = percent >= 85 ? "A" : percent >= 75 ? "B" : percent >= 65 ? "C" : "D";
    return { percent, grade };
  }, [lines, scores, position]);

  function save() {
    setBusy(true);
    setErr("");
    setSavedNote("");
    const payload: Record<string, number[]> = {};
    for (const [code, raw] of Object.entries(scores)) {
      if (!lines.some((p) => p.code === code && p.weight > 0)) continue;
      const n = Number(raw);
      if (n >= 1 && n <= 5) payload[code] = [n];
    }
    if (!Object.keys(payload).length) {
      setErr("Enter at least one score from 1 to 5, then save.");
      setBusy(false);
      return;
    }
    void onSave({ position, round, scores: payload })
      .then(() => setSavedNote(`Saved · ${preview.percent.toFixed(1)}% · Grade ${preview.grade}. The Excel file for this round is on SharePoint.`))
      .catch((e) => setErr(e instanceof Error ? e.message : "Scorecard was not saved"))
      .finally(() => setBusy(false));
  }

  if (!framework) return <p className="text-xs text-steel-muted">Loading SPDC scorecard…</p>;

  return (
    <div className="space-y-2 rounded-xl border border-line bg-paper p-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
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
            <select className="mt-1 block border border-line rounded px-2 py-1" value={round} onChange={(e) => setRound(roundId(e.target.value))}>
              {framework.rounds.map((r) => (
                <option key={r} value={r}>{ROUND_LABEL[r] || r}</option>
              ))}
            </select>
          </label>
          <span className="text-sm font-semibold pb-1">
            Score {preview.percent.toFixed(1)}% · Grade {preview.grade}
          </span>
        </div>
        <Button type="button" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save scorecard"}
        </Button>
      </div>
      <p className="text-xs rounded-lg border border-line bg-sand/40 px-3 py-2">
        {framework.roundNote?.[round] || ROUND_LABEL[round]}
        {" "}
        {lines.filter((p) => p.weight).length} competencies apply to this round.
      </p>
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
              <tr key={p.code} className={`border-t border-line ${p.weight ? "" : "opacity-50"}`}>
                <td className="px-2 py-1">
                  <span className="font-mono text-[10px] text-steel-muted mr-1">{p.code}</span>
                  {p.parameter}
                  <div className="text-[10px] text-steel-muted">{p.category}</div>
                </td>
                <td className="px-2 py-1">{p.weight ? `${p.weight}%` : "—"}</td>
                <td className="px-2 py-1">
                  <input
                    type="number"
                    min={1}
                    max={5}
                    disabled={!p.weight}
                    className="w-16 border border-line rounded px-1 py-0.5 disabled:bg-sand"
                    value={p.weight ? scores[p.code] || "" : ""}
                    onChange={(e) => setScores({ ...scores, [p.code]: e.target.value })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-steel-muted">
          Score this round, then Save. Each candidate and each round is its own Excel file on SharePoint. Compare ranks them after they are saved.
        </p>
        <Button type="button" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save scorecard"}
        </Button>
      </div>
      {err ? <p className="text-xs text-danger">{err}</p> : null}
      {savedNote ? <p className="text-xs font-medium text-brand-dark">{savedNote}</p> : null}
    </div>
  );
}
