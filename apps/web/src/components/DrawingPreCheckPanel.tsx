import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Button, Card } from "./ui";

type Item = { id: string; itemCode?: string; description: string; section?: string; instruction?: string };

/**
 * Step 1 before any drawing/revision upload — Drawing Check Master (from Excel).
 * On success returns unlockToken for the upload API.
 */
export function DrawingPreCheckPanel({
  projectId,
  onUnlocked,
  onCancel,
}: {
  projectId: string;
  onUnlocked: (token: string, meta: { templateName: string }) => void;
  onCancel?: () => void;
}) {
  const { token } = useAuth();
  const [template, setTemplate] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, { answer: string; remarks: string }>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ name: string; items: Item[] }>(`/api/checklist/project/${projectId}/drawing-check-template`, { token })
      .then((t) => {
        setTemplate(t);
        const init: Record<string, { answer: string; remarks: string }> = {};
        (t.items || []).forEach((i: Item) => {
          init[i.id] = { answer: "", remarks: "" };
        });
        setAnswers(init);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load Drawing Check Master"));
  }, [projectId, token]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!template) return;
    setBusy(true);
    setError("");
    try {
      const res = await api<{ unlockToken: string; template: { name: string } }>(
        `/api/checklist/project/${projectId}/drawing-precheck`,
        {
          method: "POST",
          token,
          body: JSON.stringify({ responsesJson: answers }),
        }
      );
      onUnlocked(res.unlockToken, { templateName: res.template.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checklist failed");
    } finally {
      setBusy(false);
    }
  }

  if (!template && !error) {
    return <p className="text-sm text-steel-muted py-6">Loading Drawing Check Master…</p>;
  }

  const items: Item[] = template?.items || [];
  const answered = items.filter((i) => answers[i.id]?.answer).length;

  return (
    <Card className="!p-0 overflow-hidden border-brand/40">
      <div className="px-4 py-3 bg-procore-navy text-white">
        <div className="text-sm font-semibold">Step 1 · Drawing Check Master</div>
        <div className="text-[11px] text-white/70">
          {template?.name || "Drawing review"} — complete before upload ({answered}/{items.length})
        </div>
      </div>
      <form className="p-4 space-y-3 max-h-[50vh] overflow-y-auto" onSubmit={submit}>
        {error && <p className="text-sm text-danger">{error}</p>}
        {items.map((item) => (
          <div key={item.id} className="border border-line rounded-sm p-3 bg-sand/40 space-y-2">
            <div className="text-sm font-medium">
              {item.itemCode ? `${item.itemCode}. ` : ""}
              {item.description}
            </div>
            {item.instruction && <p className="text-xs text-steel-muted">{item.instruction}</p>}
            <div className="flex flex-wrap gap-2">
              {["Yes", "No", "N.A."].map((a) => (
                <button
                  key={a}
                  type="button"
                  className={`px-3 py-1 text-xs font-semibold border rounded-sm ${
                    answers[item.id]?.answer === a ? "bg-brand text-white border-brand" : "bg-white border-line"
                  }`}
                  onClick={() => setAnswers((p) => ({ ...p, [item.id]: { ...(p[item.id] || { remarks: "" }), answer: a } }))}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 pt-2 sticky bottom-0 bg-paper py-2">
          {onCancel && (
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={busy || answered < items.length}>
            {busy ? "Saving…" : "Complete check · continue to upload"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
