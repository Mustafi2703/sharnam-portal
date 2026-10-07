import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Button } from "./ui";

/**
 * Files a module export in the project's SharePoint ISO folder (live copy + weekly copy). `path` is the
 * same API path the Download button uses; `module` picks the ISO folder (boq, mb, cashflow, qap, safety …).
 */
export function SaveToSharePointButton({
  projectId,
  path,
  module,
  fileName,
  label = "Save to SharePoint",
  className = "",
}: {
  projectId: string;
  path: string;
  module: string;
  fileName?: string;
  label?: string;
  className?: string;
}) {
  const { token, user } = useAuth();
  const [state, setState] = useState<{ busy?: boolean; url?: string; error?: string }>({});
  if (!user || user.role === "vendor" || user.role === "client") return null;

  async function save() {
    setState({ busy: true });
    try {
      const out = await api<{ url?: string; sharePointUrl?: string; path: string }>(`/api/projects/${projectId}/save-export`, {
        method: "POST",
        token,
        body: JSON.stringify({ path, module, fileName }),
      });
      setState({ url: out.sharePointUrl || out.url || out.path });
    } catch (err) {
      setState({ error: err instanceof Error ? err.message : "Save failed" });
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <Button type="button" variant="secondary" className={`!text-xs ${className}`} disabled={state.busy} onClick={() => void save()}>
        {state.busy ? "Saving…" : label}
      </Button>
      {state.url && (
        <a
          href={state.url.startsWith("http") ? state.url : undefined}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] font-semibold text-emerald-700"
          title={state.url}
        >
          Saved ✓
        </a>
      )}
      {state.error && <span className="text-[11px] text-red-700" title={state.error}>Not saved</span>}
    </span>
  );
}
