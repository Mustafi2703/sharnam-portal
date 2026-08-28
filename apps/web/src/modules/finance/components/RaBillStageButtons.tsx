import { useEffect, useRef, useState } from "react";
import { api } from "../../../api";

const STAGES: Array<{ key: "Submitted" | "Corrected" | "Certified"; label: string; hint: string }> = [
  { key: "Submitted", label: "+ Submitted", hint: "Contractor drops the first RA bill workbook" },
  { key: "Corrected", label: "+ Corrected", hint: "Upload the corrected workbook after PMC comments" },
  { key: "Certified", label: "+ Certified", hint: "Upload the certified copy — this locks the amount" },
];

type Revision = {
  id: string;
  stage: string;
  revisionNo: number;
  fileName: string | null;
  fileUrl: string | null;
  sharePointUrl: string | null;
  uploadedAt: string;
  uploadedBy?: { fullName?: string; email?: string } | null;
};

/**
 * PMC discipline for RA bills — one row per bill, three explicit stage buttons.
 * Each click opens a file picker and posts to /api/finance/ra/:id/stage which stores the file
 * on SharePoint / mock OneDrive and appends a RaBillRevision entry so the trail is full.
 * The link next to the buttons opens the latest file directly (SharePoint if configured).
 */
export function RaBillStageButtons({
  raBillId,
  raNumber,
  token,
  canWrite,
  onChange,
}: {
  raBillId: string;
  raNumber: string;
  token: string | null;
  canWrite: boolean;
  onChange?: () => void;
}) {
  const [busyStage, setBusyStage] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pendingStageRef = useRef<string | null>(null);

  async function reload() {
    try {
      const rows = await api<Revision[]>(`/api/finance/ra/${raBillId}/revisions`, { token });
      setRevisions(rows);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Load failed");
    }
  }

  useEffect(() => {
    if (open) void reload();
  }, [open, raBillId]);

  function pick(stage: "Submitted" | "Corrected" | "Certified") {
    pendingStageRef.current = stage;
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.click();
    }
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const stage = pendingStageRef.current;
    if (!file || !stage) return;
    setBusyStage(stage);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("stage", stage);
      fd.append("file", file);
      await api(`/api/finance/ra/${raBillId}/stage`, { method: "POST", token, body: fd });
      setMsg(`${stage} · ${file.name} — logged & filed on SharePoint`);
      await reload();
      onChange?.();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusyStage(null);
      pendingStageRef.current = null;
    }
  }

  const latest = revisions[0];

  return (
    <div className="flex flex-col gap-1 items-start">
      <div className="flex flex-wrap gap-1">
        {STAGES.map((s) => (
          <button
            key={s.key}
            type="button"
            title={s.hint}
            disabled={!canWrite || busyStage === s.key}
            onClick={() => pick(s.key)}
            className={`px-2 py-0.5 rounded border text-[10px] font-medium transition-colors ${
              s.key === "Certified"
                ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                : s.key === "Corrected"
                  ? "border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                  : "border-brand/40 text-brand hover:bg-brand/5 disabled:opacity-60"
            }`}
          >
            {busyStage === s.key ? "…" : s.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="px-2 py-0.5 rounded border border-line text-[10px] text-steel-muted hover:bg-sand"
        >
          {open ? "Hide log" : "Log"}
        </button>
      </div>
      {latest && (
        <a
          href={latest.sharePointUrl || latest.fileUrl || "#"}
          target="_blank"
          rel="noreferrer"
          className="text-[10px] text-brand underline truncate max-w-[200px]"
          title={latest.fileName || ""}
        >
          Latest ({latest.stage} R{latest.revisionNo}) →
        </a>
      )}
      {msg && <span className="text-[10px] text-steel-muted">{msg}</span>}
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.xlsm,.pdf,.doc,.docx,image/*"
        hidden
        onChange={onFileChosen}
      />
      {open && (
        <div className="mt-1 border border-line rounded bg-white shadow-sm w-72 max-h-56 overflow-auto text-[11px] p-2">
          <div className="font-semibold mb-1">
            {raNumber} · {revisions.length} revision{revisions.length === 1 ? "" : "s"}
          </div>
          {revisions.length === 0 && <div className="text-steel-muted">No uploads yet — click a stage button to add one.</div>}
          <ul className="space-y-1">
            {revisions.map((r) => (
              <li key={r.id} className="flex items-start gap-2 border-t border-line pt-1">
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                    r.stage === "Certified"
                      ? "bg-emerald-50 text-emerald-700"
                      : r.stage === "Corrected"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-brand/10 text-brand"
                  }`}
                >
                  {r.stage} R{r.revisionNo}
                </span>
                <div className="min-w-0 flex-1">
                  <a
                    href={r.sharePointUrl || r.fileUrl || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand underline truncate block"
                    title={r.fileName || ""}
                  >
                    {r.fileName || "file"}
                  </a>
                  <div className="text-steel-muted text-[10px]">
                    {new Date(r.uploadedAt).toLocaleString("en-IN")}
                    {r.uploadedBy?.fullName ? ` · ${r.uploadedBy.fullName}` : ""}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
