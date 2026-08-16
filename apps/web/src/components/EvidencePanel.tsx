/**
 * EvidencePanel — mobile-first photo · PDF · signature block.
 * Used in DPR maker, WPR maker, Upload Lab, and site check-in flows.
 */
import { useState } from "react";
import { Button, Input } from "./ui";
import { PhotoCapture } from "./PhotoCapture";
import { FilePickButton } from "./FilePickButton";
import { SignaturePad } from "./SignaturePad";
import PdfMarkup from "./PdfMarkup";

export type EvidenceItem = {
  path: string;
  caption?: string;
  takenAt?: string | null;
  kind?: "photo" | "signature" | "pdf";
};

type Props = {
  title?: string;
  folderHint?: string;
  photos: EvidenceItem[];
  attachments: EvidenceItem[];
  signatures: EvidenceItem[];
  busy?: boolean;
  onUploadPhotos: (files: File[], caption: string) => Promise<void>;
  onUploadAttachment: (file: File) => Promise<void>;
  onUploadSignature: (file: File, role: string) => Promise<void>;
  onRemovePhoto: (index: number) => void;
  onRemoveAttachment: (index: number) => void;
  onRemoveSignature: (index: number) => void;
};

export function EvidencePanel({
  title = "Evidence & sign-off",
  folderHint,
  photos,
  attachments,
  signatures,
  busy,
  onUploadPhotos,
  onUploadAttachment,
  onUploadSignature,
  onRemovePhoto,
  onRemoveAttachment,
  onRemoveSignature,
}: Props) {
  const [caption, setCaption] = useState("");
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [pdfDraft, setPdfDraft] = useState<File | null>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  async function commitPhotos() {
    if (!pendingPhotos.length) return;
    setUploadingPhotos(true);
    try {
      await onUploadPhotos(pendingPhotos, caption);
      setPendingPhotos([]);
      setCaption("");
    } finally {
      setUploadingPhotos(false);
    }
  }

  async function onPickAttachment(files: File[]) {
    const file = files[0];
    if (!file) return;
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      setPdfDraft(file);
      return;
    }
    await onUploadAttachment(file);
  }

  return (
    <div className="evidence-panel space-y-4">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-widest text-steel-muted">{title}</h3>
        {folderHint && (
          <p className="text-xs text-steel-muted mt-0.5 font-mono break-all">{folderHint}</p>
        )}
      </div>

      {/* Photos */}
      <section className="evidence-panel__block">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-steel-muted">
            Site photos ({photos.length})
          </h4>
        </div>
        <PhotoCapture
          onChange={setPendingPhotos}
          multiple
          buttonSize="md"
          captureFacing="environment"
          hint="Tap Camera on your phone — rear lens opens. Add a caption, then upload."
        />
        {pendingPhotos.length > 0 && (
          <div className="mt-3 space-y-2">
            <Input
              placeholder="Caption (optional)"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
            <Button
              type="button"
              disabled={busy || uploadingPhotos}
              onClick={() => void commitPhotos()}
              className="w-full sm:w-auto photo-capture__upload-btn"
            >
              {uploadingPhotos ? "Uploading…" : `Upload ${pendingPhotos.length} photo(s)`}
            </Button>
          </div>
        )}
        {photos.length > 0 && (
          <ul className="mt-3 text-xs divide-y max-h-48 overflow-y-auto overscroll-y-contain">
            {photos.map((p, i) => (
              <li key={i} className="py-2 flex justify-between gap-2 items-start">
                <div className="min-w-0">
                  <div className="font-mono truncate">{p.path}</div>
                  {p.caption && <div className="text-steel-muted">{p.caption}</div>}
                </div>
                <button type="button" className="text-danger shrink-0 min-h-[44px] min-w-[44px]" onClick={() => onRemovePhoto(i)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* PDF */}
      <section className="evidence-panel__block">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-steel-muted mb-2">
          PDF / documents ({attachments.length})
        </h4>
        <div className="flex flex-wrap gap-2">
          <FilePickButton
            accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
            disabled={busy}
            onPick={(files) => void onPickAttachment(files)}
          >
            Upload file
          </FilePickButton>
          <FilePickButton
            accept=".pdf,application/pdf"
            disabled={busy}
            onPick={(files) => files[0] && setPdfDraft(files[0])}
          >
            PDF + markup
          </FilePickButton>
        </div>
        {pdfDraft && (
          <div className="markup-modal" role="dialog" aria-modal="true" aria-label="PDF markup">
            <div className="markup-modal__backdrop" onClick={() => setPdfDraft(null)} />
            <div className="markup-modal__panel">
              <div className="markup-modal__head">
                <span className="font-semibold text-sm truncate">{pdfDraft.name}</span>
                <button type="button" className="markup-modal__close" onClick={() => setPdfDraft(null)}>
                  Close
                </button>
              </div>
              <div className="markup-modal__body">
                <PdfMarkup
                  src={pdfDraft}
                  saveLabel="Save marked pages & upload"
                  onCancel={() => setPdfDraft(null)}
                  onSave={async (pages) => {
                    for (const page of pages) {
                      await onUploadAttachment(page.file);
                    }
                    setPdfDraft(null);
                  }}
                />
              </div>
            </div>
          </div>
        )}
        {attachments.length > 0 && (
          <ul className="mt-3 text-xs divide-y max-h-40 overflow-y-auto">
            {attachments.map((p, i) => (
              <li key={i} className="py-2 flex justify-between gap-2">
                <span className="font-mono truncate">{p.path}</span>
                <button type="button" className="text-danger shrink-0 min-h-[44px] min-w-[44px]" onClick={() => onRemoveAttachment(i)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Signatures */}
      <section className="evidence-panel__block">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-steel-muted mb-2">
          Sign-off ({signatures.length})
        </h4>
        <div className="grid md:grid-cols-3 gap-3">
          <SignaturePad label="Site engineer" personName="Site engineer" height={130} onCapture={(f) => f && onUploadSignature(f, "site_engineer")} />
          <SignaturePad label="PMC" personName="PMC" height={130} onCapture={(f) => f && onUploadSignature(f, "pmc")} />
          <SignaturePad label="Contractor" personName="Contractor" height={130} onCapture={(f) => f && onUploadSignature(f, "contractor")} />
        </div>
        {signatures.length > 0 && (
          <ul className="mt-3 text-xs divide-y max-h-32 overflow-y-auto">
            {signatures.map((p, i) => (
              <li key={i} className="py-2 flex justify-between gap-2">
                <span className="font-mono truncate">{p.path}</span>
                <button type="button" className="text-danger shrink-0 min-h-[44px] min-w-[44px]" onClick={() => onRemoveSignature(i)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
