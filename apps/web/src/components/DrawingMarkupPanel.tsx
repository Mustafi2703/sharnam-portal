import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api, apiBase, mediaUrl } from "../api";
import PdfMarkup from "./PdfMarkup";
import { Badge, Button } from "./ui";

type Markup = {
  id: string;
  note?: string | null;
  pageNumbers?: string | null;
  fileUrl: string;
  fileName: string;
  sharePointUrl?: string | null;
  createdByName?: string | null;
  createdAt: string;
};

type State = {
  drawing: { id: string; drawingNumber: string; title: string; currentRev: string } | null;
  revision: { id: string; revisionNumber: string } | null;
  markups: Markup[];
};

/**
 * Drawing markup for an RFI or a design coordination issue: open the linked drawing's PDF, draw shapes / clouds /
 * notes, save — the markup PDF is filed to SharePoint and listed here. Also opens the drawing in SharePoint.
 */
export function DrawingMarkupPanel({
  projectId,
  targetType,
  targetId,
  drawingId,
  token,
  canMarkup = true,
}: {
  projectId: string;
  targetType: "rfi" | "coordination";
  targetId: string;
  drawingId?: string | null;
  token: string | null | undefined;
  canMarkup?: boolean;
}) {
  const [state, setState] = useState<State | null>(null);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  const [pdf, setPdf] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const q = new URLSearchParams({ targetType, targetId });
    if (drawingId) q.set("drawingId", drawingId);
    try {
      setState(await api<State>(`/api/drawings/project/${projectId}/markups?${q}`, { token: token ?? null }));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not load markups");
    }
  }, [projectId, targetType, targetId, drawingId, token]);

  useEffect(() => {
    setState(null);
    setMsg("");
    void load();
  }, [load]);

  async function startMarkup() {
    if (!state?.revision) return;
    setBusy("open");
    setMsg("Opening the drawing PDF…");
    try {
      const res = await fetch(`${apiBase()}/api/drawings/revision/${state.revision.id}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || `Could not open the PDF (${res.status})`);
      const blob = await res.blob();
      setPdf(new File([blob], `${state.drawing?.drawingNumber || "drawing"}.pdf`, { type: "application/pdf" }));
      setNote("");
      setOpen(true);
      setMsg("");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not open the PDF");
    } finally {
      setBusy("");
    }
  }

  async function openInSharePoint() {
    if (!state?.revision) return;
    const win = window.open("about:blank", "_blank");
    setBusy("sp");
    try {
      const r = await api<{ webUrl: string }>(`/api/drawings/revision/${state.revision.id}/sharepoint-link`, { token: token ?? null, timeoutMs: 120_000 });
      if (win) win.location.href = r.webUrl;
      else window.location.href = r.webUrl;
    } catch (err) {
      win?.close();
      setMsg(err instanceof Error ? err.message : "Could not open SharePoint");
    } finally {
      setBusy("");
    }
  }

  async function save(pages: { pageNumber: number; file: File }[]) {
    if (!pages.length) {
      setMsg("Draw on at least one page first.");
      return;
    }
    setBusy("save");
    try {
      const fd = new FormData();
      pages.forEach((p) => fd.append("files", p.file));
      fd.append("pageNumbers", JSON.stringify(pages.map((p) => p.pageNumber)));
      fd.append("targetType", targetType);
      fd.append("targetId", targetId);
      if (state?.drawing) fd.append("drawingId", state.drawing.id);
      if (state?.revision) fd.append("revisionId", state.revision.id);
      fd.append("note", note);
      const out = await api<{ sharePointError?: string | null }>(`/api/drawings/project/${projectId}/markups`, {
        method: "POST",
        token: token ?? null,
        body: fd,
        timeoutMs: 180_000,
      });
      setOpen(false);
      setPdf(null);
      setMsg(
        out.sharePointError
          ? `Markup saved on the portal, but SharePoint did not accept it: ${out.sharePointError}`
          : `Markup saved (${pages.length} page${pages.length === 1 ? "" : "s"}) and filed to SharePoint.`
      );
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not save the markup");
    } finally {
      setBusy("");
    }
  }

  if (!state) return <div className="text-xs text-steel-muted">Loading drawing markup…</div>;

  return (
    <div className="rounded-xl border border-line bg-white p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-steel-muted">Drawing markup</span>
        {state.drawing ? (
          <Badge tone="neutral">
            {state.drawing.drawingNumber} · {state.revision?.revisionNumber || state.drawing.currentRev}
          </Badge>
        ) : null}
        <div className="ml-auto flex flex-wrap gap-2">
          {state.revision ? (
            <>
              {canMarkup ? (
                <Button type="button" className="!text-xs" disabled={Boolean(busy)} onClick={() => void startMarkup()}>
                  {busy === "open" ? "Opening…" : "Mark up drawing"}
                </Button>
              ) : null}
              <Button type="button" variant="secondary" className="!text-xs" disabled={Boolean(busy)} onClick={() => void openInSharePoint()}>
                {busy === "sp" ? "Opening…" : "Open drawing in SharePoint"}
              </Button>
            </>
          ) : null}
        </div>
      </div>
      {!state.drawing ? (
        <p className="text-xs text-steel-muted">Link a GFC drawing to mark it up.</p>
      ) : !state.revision ? (
        <p className="text-xs text-steel-muted">The linked drawing has no PDF yet — upload it on the GFC log to mark it up.</p>
      ) : null}
      {msg ? <p className="text-xs">{msg}</p> : null}
      {state.markups.length ? (
        <ul className="divide-y divide-line text-sm">
          {state.markups.map((m) => (
            <li key={m.id} className="py-2 flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate" title={m.fileName}>{m.fileName}</div>
                <div className="text-[11px] text-steel-muted">
                  {m.createdByName || "—"} · {new Date(m.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  {m.pageNumbers ? ` · page ${m.pageNumbers}` : ""}
                </div>
                {m.note ? <div className="text-xs mt-1 whitespace-pre-wrap">{m.note}</div> : null}
              </div>
              <div className="flex gap-2 shrink-0">
                {m.sharePointUrl ? (
                  <a href={m.sharePointUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-brand">
                    SharePoint ↗
                  </a>
                ) : null}
                <a href={mediaUrl(m.fileUrl)} target="_blank" rel="noreferrer" className="text-xs font-semibold text-brand">
                  PDF
                </a>
              </div>
            </li>
          ))}
        </ul>
      ) : state.revision ? (
        <p className="text-xs text-steel-muted">No markups yet.</p>
      ) : null}

      {open && pdf
        ? createPortal(
            <div className="fixed inset-0 z-[1000] bg-black/60 flex items-stretch justify-center p-2 sm:p-4" role="dialog" aria-modal="true">
              <div className="bg-paper rounded-xl shadow-xl w-full max-w-[1700px] flex flex-col overflow-hidden">
                <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-line bg-white">
                  <div className="font-semibold text-sm">
                    Mark up {state.drawing?.drawingNumber} · {state.revision?.revisionNumber}
                  </div>
                  <span className="text-xs text-steel-muted">Box, Cloud, Arrow, Circle, Line, Pen and Text — your drawing is kept as you move between pages.</span>
                </div>
                <div className="flex-1 overflow-auto p-3 space-y-3">
                  <label className="block text-xs font-semibold text-steel-muted">
                    Notes (printed on the markup PDF)
                    <textarea
                      className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
                      rows={2}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="What needs to change, where, and why"
                    />
                  </label>
                  <PdfMarkup
                    src={pdf}
                    autoKeep
                    busy={busy === "save"}
                    saveLabel={busy === "save" ? "Saving to SharePoint…" : "Save markup to SharePoint"}
                    onCancel={() => {
                      setOpen(false);
                      setPdf(null);
                    }}
                    onSave={(pages) => void save(pages)}
                  />
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
