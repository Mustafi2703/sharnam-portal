import { useEffect, useMemo, useState } from "react";
import {
  CHECKLIST_FILLED_MESSAGE,
  IN_PAGE_OVERLAY_CLOSE,
  IN_PAGE_OVERLAY_EVENT,
  closeInPageOverlay,
  type InPageOverlay,
} from "../lib/inPageOverlay";
import { checklistFillUrl, normalizeFillFamily } from "../lib/checklistFillWindow";
import { DRAWING_UNLOCK_MESSAGE, drawingCheckUrl } from "../lib/drawingCheckWindow";

const FAMILY_LOG: Record<string, string> = {
  QualityInspection: "quality/checklist-logs",
  SiteExecution: "quality/site-checklist-logs",
  Safety: "safety/checklist-logs",
  ActivityInspection: "inspection/checklist-logs",
  DrawingCheck: "drawings/checklist-logs",
};

function overlayTitle(o: InPageOverlay) {
  if (o.kind === "checklist-fill") return "Fill checklist";
  if (o.kind === "checklist-log") return "Checklist fill log";
  return "Drawing check";
}

function overlaySrc(o: InPageOverlay) {
  if (o.kind === "checklist-fill") {
    const q = new URLSearchParams();
    q.set("family", normalizeFillFamily(o.family));
    q.set("embed", "1");
    if (o.resumeDraft) q.set("resume", "1");
    if (o.submissionId) q.set("submission", o.submissionId);
    return `${checklistFillUrl(o.projectId, o.assignmentId, o.family).split("?")[0]}?${q.toString()}`;
  }
  if (o.kind === "checklist-log") {
    const family = normalizeFillFamily(o.family);
    const tail = FAMILY_LOG[family] || "quality/checklist-logs";
    return `/projects/${o.projectId}/${tail}?embed=1`;
  }
  const base = drawingCheckUrl(o.projectId, o.mode);
  return `${base}${base.includes("?") ? "&" : "?"}embed=1`;
}

export function InPageOverlayHost() {
  const [stack, setStack] = useState<InPageOverlay[]>([]);

  useEffect(() => {
    const push = (detail: InPageOverlay) => setStack((cur) => [...cur, detail]);
    const pop = () => setStack((cur) => cur.slice(0, -1));

    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<InPageOverlay>).detail;
      if (detail) push(detail);
    };
    const onClose = () => pop();
    const onFilled = () => pop();
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data;
      if (!data || typeof data !== "object") return;
      if (data.type === IN_PAGE_OVERLAY_EVENT && data.detail) {
        push(data.detail as InPageOverlay);
        return;
      }
      if (data.type === IN_PAGE_OVERLAY_CLOSE) {
        pop();
        return;
      }
      if (data.type === CHECKLIST_FILLED_MESSAGE || data.type === DRAWING_UNLOCK_MESSAGE) {
        pop();
      }
    };

    window.addEventListener(IN_PAGE_OVERLAY_EVENT, onOpen);
    window.addEventListener(IN_PAGE_OVERLAY_CLOSE, onClose);
    window.addEventListener(CHECKLIST_FILLED_MESSAGE, onFilled);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener(IN_PAGE_OVERLAY_EVENT, onOpen);
      window.removeEventListener(IN_PAGE_OVERLAY_CLOSE, onClose);
      window.removeEventListener(CHECKLIST_FILLED_MESSAGE, onFilled);
      window.removeEventListener("message", onMessage);
    };
  }, []);

  const overlay = stack[stack.length - 1] || null;

  useEffect(() => {
    if (!overlay) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeInPageOverlay();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [overlay]);

  const src = useMemo(() => (overlay ? overlaySrc(overlay) : ""), [overlay]);
  if (!overlay) return null;

  return (
    <div className="in-page-overlay" role="dialog" aria-modal="true" aria-label={overlayTitle(overlay)}>
      <button type="button" className="in-page-overlay__backdrop" aria-label="Close" onClick={() => closeInPageOverlay()} />
      <div className="in-page-overlay__panel">
        <div className="in-page-overlay__bar">
          <strong>{overlayTitle(overlay)}</strong>
          <button type="button" className="in-page-overlay__close" onClick={() => closeInPageOverlay()}>
            {stack.length > 1 ? "Back" : "Close"}
          </button>
        </div>
        <iframe title={overlayTitle(overlay)} src={src} className="in-page-overlay__frame" />
      </div>
    </div>
  );
}
