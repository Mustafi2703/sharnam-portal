import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../../api";
import { FilePickButton } from "../../../components/FilePickButton";

const STAGES = [
  { key: "Submitted" as const, label: "Submission", uploadLabel: "Upload submission" },
  { key: "Corrected" as const, label: "Corrected", uploadLabel: "Upload corrected" },
  { key: "Certified" as const, label: "Certified", uploadLabel: "Upload certified" },
];

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
  uploadedAt: string;
};

function openWorkbook(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * RA bill file row — three workbook slots (Submission / Corrected / Certified) plus extra docs.
 * No status badges: upload a file per slot, then open the SharePoint sheet directly.
 */
export function RaBillWorkbookSlots({
  raBillId,
  raNumber,
  token,
  canWrite,
  compact = false,
  onChange,
}: {
  raBillId: string;
  raNumber: string;
  token: string | null;
  canWrite: boolean;
  compact?: boolean;
  onChange?: () => void;
}) {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [busyStage, setBusyStage] = useState<string | null>(null);
  const [busyDocs, setBusyDocs] = useState(false);
  const [msg, setMsg] = useState("");
  const pendingStage = useRef<(typeof STAGES)[number]["key"] | null>(null);
  const stageInputRef = useRef<HTMLInputElement | null>(null);

  const reload = useCallback(async () => {
    const [revs, atts] = await Promise.all([
      api<Revision[]>(`/api/finance/ra/${raBillId}/revisions`, { token }).catch(() => []),
      api<Attachment[]>(`/api/finance/ra/${raBillId}/attachments`, { token }).catch(() => []),
    ]);
    setRevisions(revs);
    setAttachments(atts.filter((a) => a.fileName));
  }, [raBillId, token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function latestForStage(stage: string) {
    return revisions.find((r) => r.stage === stage);
  }

  async function uploadStage(stage: (typeof STAGES)[number]["key"], file: File) {
    setBusyStage(stage);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("stage", stage);
      fd.append("file", file);
      await api(`/api/finance/ra/${raBillId}/stage`, { method: "POST", token, body: fd });
      setMsg(`${stage} workbook filed on SharePoint`);
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
      await api(`/api/finance/ra/${raBillId}/attachments`, { method: "POST", token, body: fd });
      setMsg(`${files.length} document(s) filed`);
      await reload();
      onChange?.();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusyDocs(false);
    }
  }

  const extraDocs = attachments.filter((a) => !revisions.some((r) => r.fileName === a.fileName));

  return (
    <div className={`ra-bill-files ${compact ? "ra-bill-files--compact" : ""}`}>
      <div className="ra-bill-files__stages">
        {STAGES.map((s) => {
          const rev = latestForStage(s.key);
          const url = rev?.sharePointUrl || rev?.fileUrl;
          return (
            <div key={s.key} className="ra-bill-files__slot">
              <div className="ra-bill-files__slot-label">{s.label}</div>
              {url ? (
                <button
                  type="button"
                  className="ra-bill-files__open"
                  title={rev?.fileName || "Open workbook in SharePoint"}
                  onClick={() => openWorkbook(url)}
                >
                  Open sheet ↗
                </button>
              ) : canWrite ? (
                <FilePickButton
                  accept=".xlsx,.xls,.xlsm,.pdf,.doc,.docx"
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
        {extraDocs.slice(0, compact ? 2 : 5).map((a) => {
          const url = a.sharePointUrl || a.fileUrl;
          if (!url) return null;
          return (
            <button
              key={a.id}
              type="button"
              className="ra-bill-files__doc-link"
              title={a.fileName}
              onClick={() => openWorkbook(url)}
            >
              {a.fileName}
            </button>
          );
        })}
      </div>
      {msg && <div className="ra-bill-files__msg">{msg}</div>}
      <input ref={stageInputRef} type="file" hidden aria-hidden />
    </div>
  );
}
