import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, TextArea } from "./ui";
import { BRAND_EN, BRAND_HI } from "./Brand";

type Item = { id: string; itemCode?: string; description: string; section?: string; instruction?: string };

/**
 * Modal overlay — Drawing Check Master fill before upload/revision.
 * Stays on the Drawings page (no popup window).
 */
export function DrawingCheckModal({
  open,
  projectId,
  mode = "register",
  contextLabel,
  onUnlocked,
  onClose,
}: {
  open: boolean;
  projectId: string;
  mode?: "register" | "revision";
  contextLabel?: string;
  onUnlocked: (token: string, meta: { templateName: string }) => void;
  onClose: () => void;
}) {
  const { token } = useAuth();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [template, setTemplate] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, { answer: string; remarks: string }>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !projectId) return;
    setLoading(true);
    setError("");
    setTemplate(null);
    api<{ name: string; items: Item[] }>(`/api/checklist/project/${projectId}/drawing-check-template`, { token })
      .then((t) => {
        setTemplate(t);
        const init: Record<string, { answer: string; remarks: string }> = {};
        (t.items || []).forEach((i: Item) => {
          init[i.id] = { answer: "", remarks: "" };
        });
        setAnswers(init);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load Drawing Check Master"))
      .finally(() => setLoading(false));
  }, [open, projectId, token]);

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>("button,textarea")?.focus();
  }, [open, loading]);

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
      onUnlocked(res.unlockToken, { templateName: res.template?.name || template.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checklist failed");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const items: Item[] = template?.items || [];
  const answered = items.filter((i) => answers[i.id]?.answer).length;
  const pct = items.length ? Math.round((answered / items.length) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#0A0C0F]/72 backdrop-blur-[2px]"
        aria-label="Close checklist"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="relative z-10 w-full sm:max-w-3xl max-h-[94dvh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-[var(--side-border,#2e3642)] bg-paper shadow-2xl overflow-hidden"
      >
        <header className="shrink-0 border-b border-line bg-[#1c222b] text-white">
          <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5">
            <span className="inline-flex rounded-md bg-white p-1.5 shrink-0">
              <img src="/logo.png" alt="" className="h-7 w-auto max-w-[6.5rem] object-contain" width={120} height={58} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.16em] text-teal-300 font-semibold">
                {BRAND_HI} · Drawing Check Master
              </p>
              <h2 id={titleId} className="font-display text-lg sm:text-xl tracking-tight truncate text-white">
                {mode === "revision" ? "Check before revision upload" : "Check before drawing upload"}
              </h2>
              {contextLabel && <p className="text-xs text-white/80 truncate mt-0.5">{contextLabel}</p>}
            </div>
            <Badge tone="warn">
              {answered}/{items.length || "—"}
            </Badge>
            <Button
              type="button"
              variant="ghost"
              className="!text-white !px-2 !py-1 hover:!bg-white/10"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
          <div className="h-1 bg-white/15">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${pct}%`,
                background: "linear-gradient(90deg, #0B6A78, #2EC4B6, #C45C26)",
              }}
            />
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-4 space-y-3 bg-paper text-ink">
          <p className="text-sm text-ink/80 leading-relaxed">
            Complete Yes / No / N.A. for each item. Upload stays on this page — no separate window.
          </p>

          {loading && <p className="text-sm text-ink/70 py-8 text-center">Loading checklist…</p>}
          {error && (
            <p className="text-sm text-danger border border-[color-mix(in_srgb,var(--color-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_10%,var(--color-paper))] rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          {!loading && template && (
            <form id="drawing-check-form" className="space-y-3" onSubmit={submit}>
              {items.map((item, idx) => {
                const ans = answers[item.id]?.answer;
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-4 transition ${
                      ans ? "border-brand/50 bg-brand-soft" : "border-line bg-sand"
                    }`}
                  >
                    <div className="flex gap-3">
                      <span className="shrink-0 h-7 w-7 rounded-lg bg-[#1c222b] text-white text-xs font-bold grid place-items-center">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1 space-y-2.5">
                        <div className="font-semibold text-ink leading-snug">
                          {item.itemCode && (
                            <span className="font-mono text-brand text-xs mr-2">{item.itemCode}</span>
                          )}
                          {item.description}
                        </div>
                        {item.instruction && <p className="text-xs text-ink/70">{item.instruction}</p>}
                        <div className="flex flex-wrap gap-2">
                          {(["Yes", "No", "N.A."] as const).map((a) => {
                            const on = ans === a;
                            const activeCls =
                              a === "Yes"
                                ? "bg-brand text-white border-brand"
                                : a === "No"
                                  ? "bg-mark text-white border-mark"
                                  : "bg-warn text-white border-warn";
                            return (
                              <button
                                key={a}
                                type="button"
                                onClick={() =>
                                  setAnswers((prev) => ({
                                    ...prev,
                                    [item.id]: { ...(prev[item.id] || { remarks: "" }), answer: a },
                                  }))
                                }
                                className={`rounded-full px-4 py-1.5 text-sm font-semibold border transition ${
                                  on ? activeCls : "bg-paper border-line text-ink hover:border-brand"
                                }`}
                              >
                                {a}
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
                      </div>
                    </div>
                  </div>
                );
              })}
            </form>
          )}
        </div>

        <footer className="shrink-0 border-t border-line bg-paper px-4 sm:px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-ink">
          <p className="text-xs text-ink/70">
            {BRAND_EN} · unlocks upload when all items answered
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="drawing-check-form"
              disabled={busy || loading || !template || answered < items.length}
            >
              {busy ? "Submitting…" : "Submit & continue to upload"}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
