import { useCallback, useEffect, useState } from "react";
import { api, apiBase } from "../../../api";
import { FilePickButton } from "../../../components/FilePickButton";

const COP_STAGES = [
  { key: "Draft" as const, label: "Draft / XLSX" },
  { key: "Certified" as const, label: "Certified" },
  { key: "Signed" as const, label: "Signed" },
  { key: "Paid" as const, label: "Payment proof" },
];

const RA_STAGES = ["Submitted", "Corrected", "Certified"] as const;

type Revision = {
  id: string;
  stage: string;
  revisionNo: number;
  fileName: string | null;
  fileUrl: string | null;
  sharePointUrl: string | null;
  uploadedAt: string;
};

type Attachment = {
  id: string;
  fileName: string;
  fileUrl: string | null;
  sharePointUrl: string | null;
  kind?: string;
  uploadedAt: string;
};

type Trail = {
  cop: {
    id: string;
    certificateNumber: string;
    status: string;
    attachmentUrl: string | null;
    raBill: { id: string; raNumber: string } | null;
  };
  copRevisions: Revision[];
  copAttachments: Attachment[];
  raRevisions: Revision[];
};

function openDoc(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * COP document panel — staged uploads (Draft → Certified → Signed → Paid),
 * system links (XLSX / Print), linked RA workbook trail, and extra attachments.
 */
export function CopDocumentSlots({
  copId,
  certificateNumber,
  projectId,
  raBillId,
  raNumber,
  token,
  canWrite,
  compact = false,
  onChange,
}: {
  copId: string;
  certificateNumber: string;
  projectId: string;
  raBillId?: string | null;
  raNumber?: string | null;
  token: string | null;
  canWrite: boolean;
  compact?: boolean;
  onChange?: () => void;
}) {
  const [trail, setTrail] = useState<Trail | null>(null);
  const [busyStage, setBusyStage] = useState<string | null>(null);
  const [busyDocs, setBusyDocs] = useState(false);
  const [msg, setMsg] = useState("");

  const reload = useCallback(async () => {
    const data = await api<Trail>(`/api/finance/cop/${copId}/document-trail`, { token }).catch(() => null);
    setTrail(data);
  }, [copId, token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function latestCopStage(stage: string) {
    return trail?.copRevisions.find((r) => r.stage === stage);
  }

  function latestRaStage(stage: string) {
    return trail?.raRevisions.find((r) => r.stage === stage);
  }

  async function uploadStage(stage: (typeof COP_STAGES)[number]["key"], file: File) {
    setBusyStage(stage);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("stage", stage);
      fd.append("file", file);
      await api(`/api/finance/cop/${copId}/stage`, { method: "POST", token, body: fd });
      setMsg(`${stage} document filed on SharePoint`);
      await reload();
      onChange?.();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusyStage(null);
    }
  }

  async function uploadDocs(files: File[]) {
    if (!files.length) return;
    setBusyDocs(true);
    setMsg("");
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      await api(`/api/finance/cop/${copId}/attachments`, { method: "POST", token, body: fd });
      setMsg(`${files.length} document(s) filed`);
      await reload();
      onChange?.();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusyDocs(false);
    }
  }

  const xlsxUrl = `${apiBase()}/api/finance/${projectId}/cop/${copId}/download.xlsx?token=${encodeURIComponent(token || "")}`;
  const printUrl = `${apiBase()}/api/finance/${projectId}/cop/${copId}/print.html?token=${encodeURIComponent(token || "")}`;
  const dmsUrl = trail?.cop.attachmentUrl || latestCopStage("Draft")?.sharePointUrl || latestCopStage("Draft")?.fileUrl;

  const extraDocs =
    trail?.copAttachments.filter(
      (a) => !trail.copRevisions.some((r) => r.fileName === a.fileName)
    ) || [];

  return (
    <div className={`ra-bill-files cop-doc-files ${compact ? "ra-bill-files--compact" : ""}`}>
      <div className="cop-doc-files__system flex flex-wrap gap-1 mb-1.5">
        <a href={xlsxUrl} className="ra-bill-files__open !inline-flex" title="Download Sharnam Viatrix XLSX">
          XLSX ↓
        </a>
        <button type="button" className="ra-bill-files__open" onClick={() => openDoc(printUrl)}>
          Print ↗
        </button>
        {dmsUrl && (
          <button type="button" className="ra-bill-files__open" onClick={() => openDoc(dmsUrl)} title="Open DMS / SharePoint copy">
            DMS ↗
          </button>
        )}
      </div>

      <div className="ra-bill-files__stages">
        {COP_STAGES.map((s) => {
          const rev = latestCopStage(s.key);
          const url = rev?.sharePointUrl || rev?.fileUrl;
          return (
            <div key={s.key} className="ra-bill-files__slot">
              <div className="ra-bill-files__slot-label">{s.label}</div>
              {url ? (
                <button type="button" className="ra-bill-files__open" title={rev?.fileName || s.label} onClick={() => openDoc(url)}>
                  Open ↗
                </button>
              ) : canWrite ? (
                <FilePickButton
                  accept=".xlsx,.xls,.xlsm,.pdf,.doc,.docx,image/*"
                  variant="secondary"
                  className="!text-[10px] !py-1 !px-2"
                  disabled={busyStage === s.key}
                  onPick={(files) => {
                    const file = files[0];
                    if (file) void uploadStage(s.key, file);
                  }}
                >
                  {busyStage === s.key ? "…" : "Upload"}
                </FilePickButton>
              ) : (
                <span className="text-[10px] text-steel-muted">—</span>
              )}
              {rev?.fileName && (
                <div className="ra-bill-files__fname" title={rev.fileName}>
                  {rev.fileName}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(raBillId || trail?.cop.raBill) && (
        <div className="cop-doc-files__ra mt-2 pt-2 border-t border-line/60">
          <div className="text-[9px] uppercase tracking-wide text-steel-muted mb-1">
            Linked RA · {raNumber || trail?.cop.raBill?.raNumber || "—"}
          </div>
          <div className="ra-bill-files__stages">
            {RA_STAGES.map((stage) => {
              const rev = latestRaStage(stage);
              const url = rev?.sharePointUrl || rev?.fileUrl;
              const label = stage === "Submitted" ? "Submission" : stage;
              return (
                <div key={stage} className="ra-bill-files__slot">
                  <div className="ra-bill-files__slot-label">{label}</div>
                  {url ? (
                    <button type="button" className="ra-bill-files__open" title={rev?.fileName || label} onClick={() => openDoc(url)}>
                      Open ↗
                    </button>
                  ) : (
                    <span className="text-[10px] text-steel-muted">—</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="ra-bill-files__docs">
        {canWrite && (
          <FilePickButton
            accept=".xlsx,.xls,.xlsm,.pdf,.doc,.docx,image/*"
            multiple
            variant="ghost"
            className="!text-[10px] !py-1 !px-2"
            disabled={busyDocs}
            onPick={(files) => void uploadDocs(files)}
          >
            {busyDocs ? "…" : "+ More docs"}
          </FilePickButton>
        )}
        {extraDocs.slice(0, compact ? 2 : 4).map((a) => {
          const url = a.sharePointUrl || a.fileUrl;
          if (!url) return null;
          return (
            <button key={a.id} type="button" className="ra-bill-files__doc-link" title={a.fileName} onClick={() => openDoc(url)}>
              {a.fileName}
            </button>
          );
        })}
      </div>
      {msg && <div className="ra-bill-files__msg">{msg}</div>}
    </div>
  );
}
