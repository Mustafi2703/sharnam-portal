/**
 * Project directory sign-off register — draw or upload PNG signatures stored in DMS.
 */
import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { SignaturePad } from "./SignaturePad";
import { Badge, Button, Card } from "./ui";

type MemberRow = {
  id: string;
  role?: string;
  signatoryTitle?: string | null;
  signatureUrl?: string | null;
  signatureUpdatedAt?: string | null;
  user?: { id?: string; fullName?: string; email?: string; role?: string };
};

type VendorRow = {
  id: string;
  tradeRole?: string | null;
  signatoryName?: string | null;
  signatureUrl?: string | null;
  signatureUpdatedAt?: string | null;
  vendor?: { name?: string; partyType?: string; primaryContactName?: string | null; email?: string | null };
};

type Props = {
  projectId: string;
  token?: string | null;
  members: MemberRow[];
  vendors: VendorRow[];
  canEditAll?: boolean;
  currentUserId?: string;
  onSaved?: () => void;
};

const DMS_FOLDER = "01.03_Organisation_and_Authority/Directory_Signatures";

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function DirectorySignOffRegister({
  projectId,
  token,
  members,
  vendors,
  canEditAll,
  currentUserId,
  onSaved,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  async function uploadMember(memberId: string) {
    if (!pendingFile || !token) return;
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("signature", pendingFile);
      await api(`/api/directory/project/${projectId}/members/${memberId}/signature`, {
        method: "POST",
        token,
        body: fd,
      });
      setMsg("Signature saved to DMS.");
      setOpenId(null);
      setPendingFile(null);
      onSaved?.();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadVendor(projectVendorId: string) {
    if (!pendingFile || !token) return;
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("signature", pendingFile);
      await api(`/api/directory/project/${projectId}/vendors/${projectVendorId}/signature`, {
        method: "POST",
        token,
        body: fd,
      });
      setMsg("Company signatory saved to DMS.");
      setOpenId(null);
      setPendingFile(null);
      onSaved?.();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const rows = [
    ...members.map((m) => ({
      key: `m-${m.id}`,
      id: m.id,
      kind: "member" as const,
      name: m.user?.fullName || "—",
      email: m.user?.email,
      role: m.signatoryTitle || m.role || m.user?.role || "Member",
      signatureUrl: m.signatureUrl,
      updatedAt: m.signatureUpdatedAt,
      canEdit: canEditAll || m.user?.id === currentUserId,
    })),
    ...vendors.map((v) => ({
      key: `v-${v.id}`,
      id: v.id,
      kind: "vendor" as const,
      name: v.signatoryName || v.vendor?.primaryContactName || v.vendor?.name || "—",
      email: v.vendor?.email,
      role: v.tradeRole || v.vendor?.partyType || "Party",
      signatureUrl: v.signatureUrl,
      updatedAt: v.signatureUpdatedAt,
      canEdit: !!canEditAll,
    })),
  ];

  return (
    <Card className="!p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold text-sm">Sign-off register</h3>
          <p className="text-xs text-steel-muted mt-1 max-w-xl">
            Maintain each person&apos;s signature here. PNG files are stored in DMS under{" "}
            <span className="font-mono text-[10px]">{DMS_FOLDER}</span> and used automatically in branded checklist
            Excel exports when a fill-specific signature is not present.
          </p>
        </div>
        <Link to={`/projects/${projectId}/dms`} className="text-sm font-semibold text-brand shrink-0">
          Open DMS →
        </Link>
      </div>

      {msg && <p className="text-xs text-brand bg-brand-soft px-3 py-2 rounded-lg mb-3">{msg}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-steel-muted border-b border-line">
              <th className="py-2 pr-3 font-semibold">Name</th>
              <th className="py-2 pr-3 font-semibold">Role</th>
              <th className="py-2 pr-3 font-semibold">Signature</th>
              <th className="py-2 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.key}>
                <tr className="border-b border-line/60 align-middle">
                  <td className="py-2.5 pr-3">
                    <div>{r.name}</div>
                    {r.email && <div className="text-[10px] font-mono text-steel-muted">{r.email}</div>}
                  </td>
                  <td className="py-2.5 pr-3">
                    <Badge tone="neutral">{r.role}</Badge>
                  </td>
                  <td className="py-2.5 pr-3">
                    {r.signatureUrl ? (
                      <div className="flex items-center gap-2">
                        <img
                          src={r.signatureUrl}
                          alt={`${r.name} signature`}
                          className="h-10 w-24 object-contain rounded border border-line bg-white"
                        />
                        {r.updatedAt && (
                          <span className="text-[10px] text-steel-muted">Updated {fmtDate(r.updatedAt)}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-steel-muted text-xs">Not uploaded</span>
                    )}
                  </td>
                  <td className="py-2.5">
                    {r.canEdit ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="!py-1 !px-2 !text-xs"
                        onClick={() => {
                          setOpenId(openId === r.key ? null : r.key);
                          setPendingFile(null);
                          setMsg("");
                        }}
                      >
                        {r.signatureUrl ? "Update" : "Add signature"}
                      </Button>
                    ) : (
                      <span className="text-[10px] text-steel-muted">—</span>
                    )}
                  </td>
                </tr>
                {openId === r.key && r.canEdit && (
                  <tr>
                    <td colSpan={4} className="pb-4 pt-1">
                      <SignaturePad
                        label="Draw or upload signature PNG"
                        personName={r.name}
                        height={140}
                        onCapture={setPendingFile}
                      />
                      <div className="flex gap-2 mt-2">
                        <Button
                          type="button"
                          disabled={!pendingFile || busy}
                          onClick={() => (r.kind === "member" ? uploadMember(r.id) : uploadVendor(r.id))}
                        >
                          {busy ? "Saving…" : "Save to DMS"}
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setOpenId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-steel-muted text-sm">
                  Assign people and parties above — then add their signatures here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
