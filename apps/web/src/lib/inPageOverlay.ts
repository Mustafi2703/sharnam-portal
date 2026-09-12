/** In-page overlay (modal) — checklist fill / log / drawing check. Not a browser popup. */

export const IN_PAGE_OVERLAY_EVENT = "sharnam-in-page-overlay";
export const IN_PAGE_OVERLAY_CLOSE = "sharnam-in-page-overlay-close";
export const CHECKLIST_FILLED_MESSAGE = "sharnam-checklist-filled";

export type InPageOverlay =
  | {
      kind: "checklist-fill";
      projectId: string;
      assignmentId: string;
      family: string;
      resumeDraft?: boolean;
      submissionId?: string | null;
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
