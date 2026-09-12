import { openInPageOverlay } from "./inPageOverlay";

/** Open Drawing Check Master in an on-page popup (same overlay as QI / Safety fill). */

export const DRAWING_UNLOCK_MESSAGE = "sharnam-drawing-unlock";

export function drawingUnlockStorageKey(projectId: string) {
  return `sharnam_drawing_unlock_${projectId}`;
}

export function drawingCheckUrl(projectId: string, mode?: "register" | "revision") {
  const q = mode === "revision" ? "?mode=revision" : "";
  return `/projects/${projectId}/drawings/precheck${q}`;
}

export function openDrawingCheckWindow(projectId: string, mode?: "register" | "revision") {
  openInPageOverlay({ kind: "drawing-check", projectId, mode });
  return window;
}

export function notifyDrawingUnlock(projectId: string, unlockToken: string) {
  const payload = { type: DRAWING_UNLOCK_MESSAGE, projectId, unlockToken };
  try {
    window.opener?.postMessage(payload, window.location.origin);
  } catch {
    /* ignore */
  }
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(payload, window.location.origin);
    }
  } catch {
    /* ignore */
  }
}

export function isDrawingUnlockMessage(
  data: unknown,
  projectId: string
): data is { type: string; projectId: string; unlockToken: string } {
  if (!data || typeof data !== "object") return false;
  const msg = data as { type?: unknown; projectId?: unknown; unlockToken?: unknown };
  return (
    msg.type === DRAWING_UNLOCK_MESSAGE &&
    msg.projectId === projectId &&
    typeof msg.unlockToken === "string" &&
    msg.unlockToken.length > 0
  );
}
