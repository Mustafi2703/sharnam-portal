import { useState } from "react";
import { api } from "../api";
import { Button } from "./ui";

/** Admin / office only: remove an RFI (or inspection request) from the portal log. SharePoint copies are removed by hand. */
export function RfiDeleteButton({
  rfi,
  token,
  role,
  onDeleted,
  className = "",
}: {
  rfi: { id: string; number?: string | null; subject?: string | null };
  token?: string | null;
  role?: string | null;
  onDeleted: () => void | Promise<void>;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (role !== "admin" && role !== "office") return null;

  const run = async () => {
    const label = [rfi.number, rfi.subject].filter(Boolean).join(" — ") || "this record";
    const ok = window.confirm(
      `Delete ${label}?\n\nIt is removed from the portal log and its responses are deleted. This cannot be undone.\nAny copies already filed in SharePoint stay there until you delete them manually.`
    );
    if (!ok) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/rfis/${rfi.id}`, { method: "DELETE", token });
      await onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col gap-1">
      <Button type="button" variant="danger" className={`!text-xs ${className}`} disabled={busy} onClick={() => void run()}>
        {busy ? "Deleting…" : "Delete"}
      </Button>
      {error ? <span className="text-[11px] text-red-700">{error}</span> : null}
    </span>
  );
}
