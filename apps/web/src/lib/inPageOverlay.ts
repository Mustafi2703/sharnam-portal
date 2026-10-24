/** In-page overlay (modal) — checklist fill / log / drawing check. Not a browser popup. */

export const IN_PAGE_OVERLAY_EVENT = "sharnam-in-page-overlay";
export const IN_PAGE_OVERLAY_CLOSE = "sharnam-in-page-overlay-close";
export const CHECKLIST_FILLED_MESSAGE = "sharnam-checklist-filled";
/** Embedded page -> host: unsaved-answers state, so the host can ask before closing. */
export const IN_PAGE_OVERLAY_GUARD = "sharnam-in-page-overlay-guard";
/** Host -> embedded page: save a draft, then close. */
export const IN_PAGE_OVERLAY_SAVE_AND_CLOSE = "sharnam-in-page-overlay-save-close";
/** Host window event fired whenever an overlay is removed from the stack. */
export const IN_PAGE_OVERLAY_DISMISSED = "sharnam-in-page-overlay-dismissed";

export type InPageOverlayGuard = { dirty: boolean; hasDraft: boolean; canSaveDraft: boolean };

export type InPageOverlayDismissed = {
  overlay: InPageOverlay;
  /** True when the overlay closed because the fill was submitted / unlocked. */
  submitted: boolean;
  hasDraft: boolean;
};

export type InPageOverlay =
  | {
      kind: "checklist-fill";
      projectId: string;
      assignmentId: string;
      family: string;
      resumeDraft?: boolean;
      submissionId?: string | null;
      drawingId?: string;
      revisionId?: string;
      rfi?: string;
      section?: string;
    }
  | {
      kind: "checklist-log";
      projectId: string;
      family: string;
    }
  | {
      kind: "drawing-check";
      projectId: string;
      mode?: "register" | "revision";
      drawingId?: string;
      revisionId?: string;
      revisionNumber?: string;
      discipline?: string;
    };

function postToParent(payload: Record<string, unknown>) {
  if (typeof window === "undefined") return false;
  if (!window.parent || window.parent === window) return false;
  try {
    window.parent.postMessage(payload, window.location.origin);
    return true;
  } catch {
    return false;
  }
}

export function openInPageOverlay(detail: InPageOverlay) {
  if (postToParent({ type: IN_PAGE_OVERLAY_EVENT, detail })) return;
  window.dispatchEvent(new CustomEvent(IN_PAGE_OVERLAY_EVENT, { detail }));
}

export function closeInPageOverlay() {
  if (postToParent({ type: IN_PAGE_OVERLAY_CLOSE })) return;
  window.dispatchEvent(new CustomEvent(IN_PAGE_OVERLAY_CLOSE));
}

/** Tell the host overlay whether this embedded page has unsaved answers. No-op outside an overlay. */
export function reportOverlayGuard(guard: InPageOverlayGuard) {
  postToParent({ type: IN_PAGE_OVERLAY_GUARD, guard });
}

/** Run `handler` when the host asks this embedded page to save a draft and close. Returns an unsubscribe. */
export function onOverlaySaveAndClose(handler: () => void) {
  const listener = (e: MessageEvent) => {
    if (e.origin !== window.location.origin) return;
    if (e.data && typeof e.data === "object" && e.data.type === IN_PAGE_OVERLAY_SAVE_AND_CLOSE) handler();
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}

export function notifyChecklistFilled(detail: {
  projectId?: string;
  assignmentId?: string;
  family?: string;
}) {
  const payload = { type: CHECKLIST_FILLED_MESSAGE, ...detail };
  try {
    window.opener?.postMessage(payload, window.location.origin);
  } catch {
    /* ignore */
  }
  postToParent(payload);
  window.dispatchEvent(new CustomEvent(CHECKLIST_FILLED_MESSAGE, { detail }));
}

/** Close the embed overlay, or the standalone window if this tab was popped out. */
export function closeEmbedOrWindow() {
  if (isEmbedView() || (window.parent && window.parent !== window)) {
    closeInPageOverlay();
    return;
  }
  if (window.opener && !window.opener.closed) {
    window.close();
    return;
  }
  closeInPageOverlay();
}

export function isEmbedView(search = typeof window !== "undefined" ? window.location.search : "") {
  return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("embed") === "1";
}
