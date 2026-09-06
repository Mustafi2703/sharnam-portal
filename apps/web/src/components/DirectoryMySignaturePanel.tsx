/**
 * My signature — any portal role uploads personal + company sign-off PNG to DMS.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { SignaturePad } from "./SignaturePad";
import { Badge, Button, Card } from "./ui";

type Slot = {
  key: string;
  kind: "member" | "vendor";
  id: string;
  name: string;
  role: string;
  signatureUrl?: string | null;
};

type Props = {
  projectId: string;
  token?: string | null;
  compact?: boolean;
};

export function DirectoryMySignaturePanel({ projectId, token, compact }: Props) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    if (!token) return;
    const data = await api<{
      member: {
        id: string;
        name: string;
        role: string;
        signatureUrl?: string | null;
        canEdit?: boolean;
      } | null;
      vendors: Array<{
        id: string;
        name: string;
        partyType: string;
        signatureUrl?: string | null;
        canEdit?: boolean;
      }>;
    }>(`/api/directory/project/${projectId}/signatures/me`, { token });
    const rows: Slot[] = [];
    if (data.member) {
      rows.push({
        key: `m-${data.member.id}`,
        kind: "member",
        id: data.member.id,
        name: data.member.name,
        role: data.member.role,
        signatureUrl: data.member.signatureUrl,
      });
    }
    for (const v of data.vendors || []) {
      rows.push({
        key: `v-${v.id}`,
        kind: "vendor",
        id: v.id,
        name: v.name,
        role: v.partyType || "Company",
        signatureUrl: v.signatureUrl,
      });
    }
    setSlots(rows);
  };

  useEffect(() => {
    void load();
  }, [projectId, token]);

  async function save(slot: Slot) {
    if (!pendingFile || !token) return;
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("signature", pendingFile);
      const path =
        slot.kind === "member"
          ? `/api/directory/project/${projectId}/members/${slot.id}/signature`
          : `/api/directory/project/${projectId}/vendors/${slot.id}/signature`;
      await api(path, { method: "POST", token, body: fd });
      setMsg("Signature saved to DMS — will appear on branded Excel exports.");
      setOpenKey(null);
      setPendingFile(null);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  if (!slots.length) return null;

  const missing = slots.filter((s) => !s.signatureUrl).length;

  return (
    <Card className={`!p-4 ${missing ? "border-brand/40 bg-brand-soft/30" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="font-semibold text-sm">{compact ? "My sign-off" : "Your signatures"}</h3>
          <p className="text-xs text-steel-muted mt-1">
            Draw or upload PNG — stored in project DMS and used on checklist / RFI / report exports.
            {missing > 0 && (
              <span className="text-brand font-semibold">
                {" "}
                {missing} signature{missing > 1 ? "s" : ""} still needed.
              </span>
            )}
          </p>
        </div>
        <Link to={`/projects/${projectId}/directory`} className="text-xs font-semibold text-brand shrink-0">
          Full register →
        </Link>
      </div>

      {msg && <p className="text-xs text-brand bg-brand-soft px-3 py-2 rounded-lg mb-3">{msg}</p>}

      <ul className="space-y-3">
        {slots.map((s) => (
          <li key={s.key} className="border border-line rounded-xl p-3 bg-paper">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium text-sm">{s.name}</div>
                <Badge tone="neutral" className="mt-1">
                  {s.kind === "member" ? "Personal" : s.role}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {s.signatureUrl ? (
                  <img
                    src={s.signatureUrl}
                    alt="Signature"
                    className="h-10 w-24 object-contain rounded border border-line bg-white"
                  />
                ) : (
                  <span className="text-xs text-steel-muted">Not uploaded</span>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  className="!py-1 !px-2 !text-xs"
                  onClick={() => {
                    setOpenKey(openKey === s.key ? null : s.key);
                    setPendingFile(null);
                  }}
                >
                  {s.signatureUrl ? "Update" : "Add"}
                </Button>
              </div>
            </div>
            {openKey === s.key && (
              <div className="mt-3 pt-3 border-t border-line">
                <SignaturePad
                  label="Draw or upload signature"
                  personName={s.name}
                  height={120}
                  onCapture={setPendingFile}
                />
                <div className="flex gap-2 mt-2">
                  <Button type="button" disabled={!pendingFile || busy} onClick={() => save(s)}>
                    {busy ? "Saving…" : "Save to DMS"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setOpenKey(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
