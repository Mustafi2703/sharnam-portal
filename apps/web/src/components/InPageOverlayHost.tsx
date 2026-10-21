import { useEffect, useMemo, useRef, useState } from "react";
import {
  CHECKLIST_FILLED_MESSAGE,
  IN_PAGE_OVERLAY_CLOSE,
  IN_PAGE_OVERLAY_DISMISSED,
  IN_PAGE_OVERLAY_EVENT,
  IN_PAGE_OVERLAY_GUARD,
  IN_PAGE_OVERLAY_SAVE_AND_CLOSE,
  closeInPageOverlay,
  type InPageOverlay,
  type InPageOverlayDismissed,
  type InPageOverlayGuard,
} from "../lib/inPageOverlay";
import { checklistFillUrl, normalizeFillFamily } from "../lib/checklistFillWindow";
import { DRAWING_UNLOCK_MESSAGE, drawingCheckUrl } from "../lib/drawingCheckWindow";
import { formatUiText } from "../lib/formatUiText";
import { Button } from "./ui";

const FAMILY_LOG: Record<string, string> = {
  QualityInspection: "quality/checklist-logs",
  SiteExecution: "quality/site-checklist-logs",
  Safety: "safety/checklist-logs",
  ActivityInspection: "inspection/checklist-logs",
  DrawingCheck: "drawings/checklist-logs",
};

const CLEAN_GUARD: InPageOverlayGuard = { dirty: false, hasDraft: false, canSaveDraft: false };

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
    if (o.drawingId) q.set("drawing", o.drawingId);
    if (o.revisionId) q.set("revision", o.revisionId);
    if (o.rfi) q.set("rfi", o.rfi);
    return `${checklistFillUrl(o.projectId, o.assignmentId, o.family).split("?")[0]}?${q.toString()}`;
  }
  if (o.kind === "checklist-log") {
    const family = normalizeFillFamily(o.family);
    const tail = FAMILY_LOG[family] || "quality/checklist-logs";
    return `/projects/${o.projectId}/${tail}?embed=1`;
  }
  const base = drawingCheckUrl(o.projectId, o.mode, {
    drawingId: o.drawingId,
    revisionId: o.revisionId,
    revisionNumber: o.revisionNumber,
    discipline: o.discipline,
  });
  return `${base}${base.includes("?") ? "&" : "?"}embed=1`;
}

export function InPageOverlayHost() {
  const [stack, setStack] = useState<InPageOverlay[]>([]);
  const stackRef = useRef<InPageOverlay[]>([]);
  stackRef.current = stack;
  const guardRef = useRef<InPageOverlayGuard>(CLEAN_GUARD);
  const [confirmClose, setConfirmClose] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const push = (detail: InPageOverlay) => {
      guardRef.current = CLEAN_GUARD;
      setConfirmClose(false);
      setStack((cur) => [...cur, detail]);
    };
    const pop = (submitted: boolean) => {
      const top = stackRef.current[stackRef.current.length - 1];
      const hasDraft = guardRef.current.hasDraft;
      guardRef.current = CLEAN_GUARD;
      setConfirmClose(false);
      setStack((cur) => cur.slice(0, -1));
      if (top) {
        const detail: InPageOverlayDismissed = { overlay: top, submitted, hasDraft };
        window.dispatchEvent(new CustomEvent(IN_PAGE_OVERLAY_DISMISSED, { detail }));
      }
    };
    /** Close unless the embedded page reported unsaved answers; then ask first. */
    const requestClose = () => {
      if (guardRef.current.dirty) {
        setConfirmClose(true);
        return;
      }
      pop(false);
    };

    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<InPageOverlay>).detail;
      if (detail) push(detail);
    };
    const onClose = () => requestClose();
    const onFilled = () => pop(true);
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data;
      if (!data || typeof data !== "object") return;
      if (data.type === IN_PAGE_OVERLAY_EVENT && data.detail) {
        push(data.detail as InPageOverlay);
        return;
      }
      if (data.type === IN_PAGE_OVERLAY_GUARD && data.guard && typeof data.guard === "object") {
        const g = data.guard as Partial<InPageOverlayGuard>;
        guardRef.current = { dirty: !!g.dirty, hasDraft: !!g.hasDraft, canSaveDraft: !!g.canSaveDraft };
        if (!g.dirty) setConfirmClose(false);
        return;
      }
      if (data.type === IN_PAGE_OVERLAY_CLOSE) {
        requestClose();
        return;
      }
      if (data.type === CHECKLIST_FILLED_MESSAGE || data.type === DRAWING_UNLOCK_MESSAGE) {
        pop(true);
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
      if (e.key !== "Escape") return;
      if (confirmClose) setConfirmClose(false);
      else closeInPageOverlay();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [overlay, confirmClose]);

  const src = useMemo(() => (overlay ? overlaySrc(overlay) : ""), [overlay]);
  if (!overlay) return null;

  function saveDraftAndClose() {
    setConfirmClose(false);
    iframeRef.current?.contentWindow?.postMessage({ type: IN_PAGE_OVERLAY_SAVE_AND_CLOSE }, window.location.origin);
  }

  function discardAndClose() {
    guardRef.current = { ...guardRef.current, dirty: false };
    setConfirmClose(false);
    closeInPageOverlay();
  }

  return (
    <div className="in-page-overlay" role="dialog" aria-modal="true" aria-label={overlayTitle(overlay)}>
      <button type="button" className="in-page-overlay__backdrop" aria-label="Close" onClick={() => closeInPageOverlay()} />
      <div className="in-page-overlay__panel">
        <div className="in-page-overlay__bar">
          <strong>{formatUiText(overlayTitle(overlay))}</strong>
          <button type="button" className="in-page-overlay__close" onClick={() => closeInPageOverlay()}>
            {stack.length > 1 ? "Back" : "Close"}
          </button>
        </div>
        <iframe ref={iframeRef} title={overlayTitle(overlay)} src={src} className="in-page-overlay__frame" />
      </div>
      {confirmClose ? (
        <div
          className="register-modal"
          style={{ zIndex: 240 }}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="overlay-close-title"
          onClick={() => setConfirmClose(false)}
        >
          <div className="register-modal__panel register-modal__panel--md" onClick={(e) => e.stopPropagation()}>
            <div className="register-modal__head">
              <h3 id="overlay-close-title" className="font-semibold text-ink text-base">
                {formatUiText("Close without saving?")}
              </h3>
            </div>
            <div className="register-modal__body">
              <p className="text-sm text-ink leading-relaxed">Your answers will be lost.</p>
            </div>
            <div className="register-modal__foot flex flex-wrap gap-2">
              {guardRef.current.canSaveDraft ? (
                <Button type="button" onClick={saveDraftAndClose}>
                  Save draft and close
                </Button>
              ) : null}
              <Button type="button" variant="danger" onClick={discardAndClose}>
                Discard
              </Button>
              <Button type="button" variant="secondary" onClick={() => setConfirmClose(false)} autoFocus>
                Keep editing
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
