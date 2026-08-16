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
  menu = false,
}: {
  projectId?: string | null;
  kind: ExportModule;
  label?: string;
  compact?: boolean;
  /** Vertical stack for overflow / export menus */
  menu?: boolean;
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
    <div className={menu ? "flex flex-col gap-1 w-full" : compact ? "inline-flex flex-col items-end gap-1" : "space-y-2"}>
      <div className={menu ? "flex flex-col gap-1 w-full" : "flex flex-wrap gap-2"}>
        <Button
          type="button"
          variant={menu ? "ghost" : "secondary"}
          disabled={!!busy}
          className={menu ? "w-full !justify-start !text-sm !py-2" : "!text-xs !py-1.5"}
          onClick={() => void run("xlsx")}
        >
          {busy === "xlsx" ? "…" : `${label} Excel`}
        </Button>
        <Button
          type="button"
          variant={menu ? "ghost" : undefined}
          disabled={!!busy}
          className={menu ? "w-full !justify-start !text-sm !py-2" : "!text-xs !py-1.5"}
          onClick={() => void run("pdf")}
        >
          {busy === "pdf" ? "…" : `${label} PDF`}
        </Button>
      </div>
      {msg && !menu && <p className="text-[11px] text-steel-muted max-w-xs text-right">{msg}</p>}
      {msg && menu && <p className="text-[11px] text-steel-muted px-2 py-1">{msg}</p>}
    </div>
  );
}
