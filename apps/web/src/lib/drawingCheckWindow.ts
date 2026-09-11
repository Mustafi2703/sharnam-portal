/** Open Drawing Check Master in a dedicated window (same pattern as QI / Safety fill). */

export const DRAWING_UNLOCK_MESSAGE = "sharnam-drawing-unlock";

export function drawingUnlockStorageKey(projectId: string) {
  return `sharnam_drawing_unlock_${projectId}`;
}

export function drawingCheckUrl(projectId: string, mode?: "register" | "revision") {
  const q = mode === "revision" ? "?mode=revision" : "";
  return `/projects/${projectId}/drawings/precheck${q}`;
}

export function openDrawingCheckWindow(projectId: string, mode?: "register" | "revision") {
  const url = `${window.location.origin}${drawingCheckUrl(projectId, mode)}`;
  return window.open(url, "sharnam-drawing-precheck", "width=1400,height=920,scrollbars=yes,resizable=yes");
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
