import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, PageHeader, TextArea } from "../components/ui";
import { BrandMark } from "../components/Brand";

type Item = { id: string; itemCode?: string; description: string; section?: string; instruction?: string };

const UNLOCK_KEY = (projectId: string) => `sharnam_drawing_unlock_${projectId}`;

/**
 * Full-window Drawing Check Master fill (opened from Upload drawing).
 * Same pattern as QI/Safety checklist fill — complete → unlock → return to upload.
 */
export default function DrawingPreCheckPage() {
  const { id: projectId } = useParams();
  const { token } = useAuth();
  const [template, setTemplate] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, { answer: string; remarks: string }>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ unlockToken: string; name: string } | null>(null);

  useEffect(() => {
    if (!projectId) return;
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
    if (!template || !projectId) return;
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
      try {
        localStorage.setItem(UNLOCK_KEY(projectId), res.unlockToken);
      } catch {
        /* ignore */
      }
      try {
        window.opener?.postMessage(
          { type: "sharnam-drawing-unlock", projectId, unlockToken: res.unlockToken },
          window.location.origin
        );
      } catch {
        /* ignore */
      }
      setDone({ unlockToken: res.unlockToken, name: res.template?.name || template.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checklist failed");
    } finally {
      setBusy(false);
    }
  }

  const items: Item[] = template?.items || [];
  const answered = items.filter((i) => answers[i.id]?.answer).length;

  return (
    <div className="min-h-screen bg-sand">
      <header className="sticky top-0 z-30 bg-ink text-white border-b border-white/10">
        <div className="max-w-4xl mx-auto px-5 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <BrandMark size="sm" tagTone="dark" compact showTag={false} />
            <span className="text-sm truncate">Drawing Check Master · fill before upload</span>
          </div>
          <Badge tone="warn">
            {answered}/{items.length}
          </Badge>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-8 space-y-6">
        {done ? (
          <Card className="!p-8 text-center space-y-4">
            <div className="text-sm font-semibold uppercase tracking-wider text-brand">Unlocked</div>
            <h1 className="font-display text-2xl text-ink">Checklist complete</h1>
            <p className="text-steel-muted text-sm max-w-md mx-auto">
              “{done.name}” is done. Return to the Drawings tab — the upload dialog should open. You can close this window.
            </p>
            <div className="flex flex-wrap gap-2 justify-center pt-2">
              <Button type="button" onClick={() => window.close()}>
                Close window
              </Button>
              <Link to={`/projects/${projectId}/drawings?upload=1`}>
                <Button type="button" variant="secondary">
                  Back to Drawings
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <>
            <PageHeader
              eyebrow="Drawings · pre-upload"
              title={template?.name || "Drawing Check Master"}
              subtitle="Fill Yes / No / N.A. like Quality and Safety forms. When you submit, upload unlocks in the other window."
            />
            {error && <p className="text-sm text-danger bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}
            {!template && !error && <p className="text-sm text-steel-muted">Loading checklist…</p>}
            {template && (
              <form className="space-y-4" onSubmit={submit}>
                {items.map((item) => (
                  <Card key={item.id} className="!p-5 space-y-3">
                    <div className="font-medium text-ink leading-relaxed">
                      {item.itemCode && <span className="font-mono text-brand mr-2">{item.itemCode}</span>}
                      {item.description}
                    </div>
                    {item.instruction && <p className="text-xs text-steel-muted">{item.instruction}</p>}
                    <div className="flex flex-wrap gap-2">
                      {["Yes", "No", "N.A."].map((ans) => {
                        const on = answers[item.id]?.answer === ans;
                        return (
                          <button
                            key={ans}
                            type="button"
                            onClick={() =>
                              setAnswers((prev) => ({
                                ...prev,
                                [item.id]: { ...(prev[item.id] || { remarks: "" }), answer: ans },
                              }))
                            }
                            className={`rounded-full px-4 py-2 text-sm font-semibold border ${
                              on
                                ? ans === "Yes"
                                  ? "bg-brand text-white border-brand"
                                  : ans === "No"
                                    ? "bg-mark text-white border-mark"
                                    : "bg-warn text-white border-warn"
                                : "bg-white border-line text-steel-muted"
                            }`}
                          >
                            {ans}
                          </button>
                        );
                      })}
                    </div>
                    <TextArea
                      rows={2}
                      placeholder="Comment (optional)"
                      value={answers[item.id]?.remarks || ""}
                      onChange={(e) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [item.id]: { answer: prev[item.id]?.answer || "", remarks: e.target.value },
                        }))
                      }
                    />
                  </Card>
                ))}
                <Button type="submit" disabled={busy || answered < items.length} className="w-full sm:w-auto">
                  {busy ? "Submitting…" : "Submit & unlock upload"}
                </Button>
              </form>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export { UNLOCK_KEY };
