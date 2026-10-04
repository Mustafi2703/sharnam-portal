const API_BASE = import.meta.env.VITE_API_URL || "";

/** Authenticated blob download (Excel / HTML client packs) */
/** A failed download; shown as a short notice when the caller does not handle it. */
export class DownloadError extends Error {}

let downloadNoticeInstalled = false;
function installDownloadNotice() {
  if (downloadNoticeInstalled || typeof window === "undefined") return;
  downloadNoticeInstalled = true;
  window.addEventListener("unhandledrejection", (event) => {
    if (!(event.reason instanceof DownloadError)) return;
    event.preventDefault();
    const note = document.createElement("div");
    note.setAttribute("role", "alert");
    note.textContent = event.reason.message;
    note.style.cssText =
      "position:fixed;right:16px;bottom:16px;z-index:9999;max-width:min(420px,calc(100vw - 32px));padding:10px 14px;border-radius:10px;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;font:600 13px/1.4 system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.12)";
    document.body.appendChild(note);
    setTimeout(() => note.remove(), 6000);
  });
}

export async function downloadAuthFile(path: string, token: string | null, filename: string) {
  installDownloadNotice();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = text;
    try {
      const parsed = JSON.parse(text) as { error?: string; message?: string };
      message = parsed.error || parsed.message || text;
    } catch {
      /* plain-text error */
    }
    if (res.status === 404 && /^No .+ to export/i.test(message)) {
      message = `${message.replace(/ to export$/i, "")} yet — nothing to download.`;
    }
    throw new DownloadError(message || `Download failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type ExportModule =
  | "rfis"
  | "comms"
  | "quality"
  | "safety"
  | "drawings"
  | "progress"
  | "cost"
  | "analytics";

export function exportPaths(projectId: string, kind: ExportModule) {
  if (kind === "analytics") {
    return {
      xlsx: `/api/reports/analytics/${projectId}/download.xlsx`,
      html: `/api/reports/analytics/${projectId}/download.html`,
      xlsxName: `Sharnam-Analytics.xlsx`,
      htmlName: `Sharnam-Analytics.html`,
    };
  }
  return {
    xlsx: `/api/reports/module/${projectId}/${kind}/download.xlsx`,
    html: `/api/reports/module/${projectId}/${kind}/download.html`,
    xlsxName: `Sharnam-${kind}.xlsx`,
    htmlName: `Sharnam-${kind}.html`,
  };
}
