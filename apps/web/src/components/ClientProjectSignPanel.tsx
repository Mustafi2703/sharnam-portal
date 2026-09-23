import { useCallback, useEffect, useState } from "react";
import { api, apiBase } from "../api";
import { WprSignOffPanel } from "./WprSignOffPanel";
import { Card } from "./ui";

function weekEndingIso(d = new Date()) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  x.setDate(x.getDate() + diff);
  return x.toISOString().slice(0, 10);
}

/** Client portal — upload client signature on the current weekly report pack (read-only desk). */
export function ClientProjectSignPanel({
  projectId,
  token,
  compact,
}: {
  projectId: string;
  token: string | null;
  compact?: boolean;
}) {
  const [weekEnding, setWeekEnding] = useState(weekEndingIso());
  const [signatures, setSignatures] = useState<{ path: string; role: string; url?: string }[]>([]);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const recent = await api<{ weekEnding?: string; packExtras?: { signatures?: { path: string; role: string; url?: string }[] } }>(
        `/api/wpr-maker/${projectId}/recent`,
        { token },
      );
      if (recent?.weekEnding) setWeekEnding(String(recent.weekEnding).slice(0, 10));
      setSignatures(recent?.packExtras?.signatures || []);
    } catch {
      setSignatures([]);
    }
  }, [projectId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onUpload(file: File, role: string) {
    if (!token) return;
    setMsg("");
    const fd = new FormData();
    fd.append("signature", file);
    fd.append("role", role);
    fd.append("weekEnding", weekEnding);
    try {
      const res = await fetch(`${apiBase()}/api/wpr-maker/${projectId}/signature`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setMsg("Client signature saved on the weekly report pack.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    }
  }

  return (
    <Card className={compact ? "!p-3 space-y-2" : "!p-4 space-y-3 border-brand/25 bg-brand-soft/15"}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">Your signature</p>
        <p className="text-xs text-steel-muted mt-1 leading-relaxed">
          Read-only portal — upload your sign when SPDC shares a weekly report or checklist for sign-off. Week ending{" "}
          <strong className="text-ink">{weekEnding}</strong>.
        </p>
      </div>
      <WprSignOffPanel
        title="Weekly report · client sign"
        roles={["client"]}
        signatures={signatures.filter((s) => s.role?.toLowerCase().includes("client"))}
        onUpload={onUpload}
        onRemove={() => undefined}
        resolveUrl={(ref) => (ref.startsWith("http") ? ref : `${apiBase()}${ref.startsWith("/") ? ref : `/uploads/${ref}`}`)}
      />
      {msg ? <p className="text-xs text-brand font-medium">{msg}</p> : null}
    </Card>
  );
}
