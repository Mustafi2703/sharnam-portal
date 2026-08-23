const API_BASE = import.meta.env.VITE_API_URL || "";

/** Authenticated blob download (Excel / HTML client packs) */
export async function downloadAuthFile(path: string, token: string | null, filename: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Download failed (${res.status})`);
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
  | "auditKpi"
  | "cost"
  | "analytics"
  | "dpr"
  | "wpr";

export function exportPaths(projectId: string, kind: ExportModule) {
  if (kind === "analytics") {
    return {
      xlsx: `/api/reports/analytics/${projectId}/download.xlsx`,
      html: `/api/reports/analytics/${projectId}/download.html`,
      xlsxName: `Sharnam-Analytics.xlsx`,
      htmlName: `Sharnam-Analytics.html`,
    };
  }
  if (kind === "dpr") {
    return {
      xlsx: `/api/reports/dpr/${projectId}/download.xlsx`,
      html: `/api/reports/dpr/${projectId}/download.html`,
      xlsxName: `DPR.xlsx`,
      htmlName: `DPR.html`,
    };
  }
  if (kind === "wpr") {
    return {
      xlsx: `/api/reports/wpr/${projectId}/download.xlsx`,
      html: `/api/reports/wpr/${projectId}/download.html`,
      xlsxName: `WPR.xlsx`,
      htmlName: `WPR.html`,
    };
  }
  return {
    xlsx: `/api/reports/module/${projectId}/${kind}/download.xlsx`,
    html: `/api/reports/module/${projectId}/${kind}/download.html`,
    xlsxName: `Sharnam-${kind}.xlsx`,
    htmlName: `Sharnam-${kind}.html`,
  };
}
