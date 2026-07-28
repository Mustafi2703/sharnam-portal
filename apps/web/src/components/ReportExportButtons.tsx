import { useState } from "react";
import { Button } from "./ui";
import { downloadAuthFile, exportPaths, type ExportModule } from "../lib/downloadReport";
import { useAuth } from "../auth";

/** Excel + branded PDF (HTML print) downloads for dashboard / module sections */
export function ReportExportButtons({
  projectId,
  kind,
  label = "Export",
  compact = false,
}: {
  projectId?: string | null;
  kind: ExportModule;
  label?: string;
  compact?: boolean;
}) {
  const { token } = useAuth();
  const [busy, setBusy] = useState<"xlsx" | "pdf" | null>(null);
  const [msg, setMsg] = useState("");

  if (!projectId) return null;

  const paths = exportPaths(projectId, kind);

  async function run(fmt: "xlsx" | "pdf") {
    setBusy(fmt);
    setMsg("");
    try {
      if (fmt === "xlsx") {
        await downloadAuthFile(paths.xlsx, token, paths.xlsxName);
        setMsg("Excel downloaded — share with client.");
      } else {
        await downloadAuthFile(paths.html, token, paths.htmlName);
        setMsg("Report downloaded — open and Print → Save as PDF (Sharnam logo included).");
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Download failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={compact ? "inline-flex flex-col items-end gap-1" : "space-y-2"}>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" disabled={!!busy} className="!text-xs !py-1.5" onClick={() => void run("xlsx")}>
          {busy === "xlsx" ? "…" : `${label} Excel`}
        </Button>
        <Button type="button" disabled={!!busy} className="!text-xs !py-1.5" onClick={() => void run("pdf")}>
          {busy === "pdf" ? "…" : `${label} PDF`}
        </Button>
      </div>
      {msg && <p className="text-[11px] text-steel-muted max-w-xs text-right">{msg}</p>}
    </div>
  );
}
