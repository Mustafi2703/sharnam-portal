import { useState } from "react";
import { Button, Input, TextArea } from "./ui";
import { SignaturePad } from "./SignaturePad";
import { formatUiText } from "../lib/formatUiText";
import { resolveDrawingFileUrl } from "../lib/drawingPreview";
import { PhotoSignaturePicker } from "./PhotoSignaturePicker";
import type { DrawingIssueDraft } from "../lib/drawingIssueFields";

export function DrawingIssueFields({
  projectId,
  token,
  value,
  onChange,
  existingClientSignUrl,
  existingPmcSignUrl,
  existingSiteEngineerSignUrl,
}: {
  projectId: string;
  token?: string | null;
  value: DrawingIssueDraft;
  onChange: (next: DrawingIssueDraft) => void;
  existingClientSignUrl?: string | null;
  existingPmcSignUrl?: string | null;
  existingSiteEngineerSignUrl?: string | null;
}) {
  const set = (patch: Partial<DrawingIssueDraft>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-line bg-sand/15 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-steel-muted">
          {formatUiText("Receive & issue — client, PMC and site engineer signatures")}
        </p>
        <span className="rounded-full border border-line bg-paper px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-steel-muted">
          Optional
        </span>
      </div>
      <p className="text-xs text-steel-muted leading-relaxed">
        Optional. For each signatory, draw or upload the signature here, or pick one already in project photo storage. If the client is not available, PMC can sign on their behalf.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-xs font-mono uppercase tracking-wider text-steel-muted">
            {formatUiText("Date of receiving")}
          </span>
          <Input className="mt-1.5" type="date" value={value.receivedDate} onChange={(e) => set({ receivedDate: e.target.value })} />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-mono uppercase tracking-wider text-steel-muted">
            {formatUiText("Total copies received")}
          </span>
          <Input
            className="mt-1.5"
            type="number"
            min={0}
            value={value.copiesReceived}
            onChange={(e) => set({ copiesReceived: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-mono uppercase tracking-wider text-steel-muted">
            {formatUiText("Issued to contractor")}
          </span>
          <Input
            className="mt-1.5"
            type="date"
            value={value.issuedToContractorAt}
            onChange={(e) => set({ issuedToContractorAt: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-mono uppercase tracking-wider text-steel-muted">
            {formatUiText("Issued to client")}
          </span>
          <Input
            className="mt-1.5"
            type="date"
            value={value.issuedToClientAt}
            onChange={(e) => set({ issuedToClientAt: e.target.value })}
          />
        </label>
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        <SignBox
          title={value.clientSignedByPmc ? "Client (PMC signs on behalf)" : "Client signature"}
          name={value.clientSignName}
          namePlaceholder={value.clientSignedByPmc ? "PMC person signing for the client" : "Client signatory name"}
          onName={(clientSignName) => set({ clientSignName })}
          file={value.clientSignFile || null}
          onFile={(clientSignFile) => set({ clientSignFile, ...(clientSignFile ? { clientSignPhotoId: null } : {}) })}
          photoId={value.clientSignPhotoId}
          onPhoto={(clientSignPhotoId) => set({ clientSignPhotoId, ...(clientSignPhotoId ? { clientSignFile: null } : {}) })}
          existingUrl={existingClientSignUrl}
          projectId={projectId}
          token={token}
          extra={
            <label className="flex items-start gap-2 text-xs text-steel-muted">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={!!value.clientSignedByPmc}
                onChange={(e) =>
                  set({
                    clientSignedByPmc: e.target.checked,
                    clientSignName: e.target.checked ? value.clientSignName || value.pmcSignName : value.clientSignName,
                  })
                }
              />
              <span>Client not available — PMC signs on behalf (recorded as PMC on behalf of client).</span>
            </label>
          }
        />
        <SignBox
          title="PMC signature"
          name={value.pmcSignName}
          namePlaceholder="PMC signatory name"
          onName={(pmcSignName) => set({ pmcSignName })}
          file={value.pmcSignFile || null}
          onFile={(pmcSignFile) => set({ pmcSignFile, ...(pmcSignFile ? { pmcSignPhotoId: null } : {}) })}
          photoId={value.pmcSignPhotoId}
          onPhoto={(pmcSignPhotoId) => set({ pmcSignPhotoId, ...(pmcSignPhotoId ? { pmcSignFile: null } : {}) })}
          existingUrl={existingPmcSignUrl}
          projectId={projectId}
          token={token}
        />
        <SignBox
          title="Site engineer signature"
          name={value.siteEngineerSignName}
          namePlaceholder="Site engineer name"
          onName={(siteEngineerSignName) => set({ siteEngineerSignName })}
          file={value.siteEngineerSignFile || null}
          onFile={(siteEngineerSignFile) =>
            set({ siteEngineerSignFile, ...(siteEngineerSignFile ? { siteEngineerSignPhotoId: null } : {}) })
          }
          photoId={value.siteEngineerSignPhotoId}
          onPhoto={(siteEngineerSignPhotoId) =>
            set({ siteEngineerSignPhotoId, ...(siteEngineerSignPhotoId ? { siteEngineerSignFile: null } : {}) })
          }
          existingUrl={existingSiteEngineerSignUrl}
          projectId={projectId}
          token={token}
        />
      </div>

      {(existingClientSignUrl || existingPmcSignUrl || existingSiteEngineerSignUrl) && (
        <div className="flex flex-wrap gap-3 text-xs text-steel-muted">
          {existingClientSignUrl && (
            <img src={resolveDrawingFileUrl(existingClientSignUrl)} alt="Client on file" className="h-10 border rounded" />
          )}
          {existingPmcSignUrl && (
            <img src={resolveDrawingFileUrl(existingPmcSignUrl)} alt="PMC on file" className="h-10 border rounded" />
          )}
          {existingSiteEngineerSignUrl && (
            <img src={resolveDrawingFileUrl(existingSiteEngineerSignUrl)} alt="Site engineer on file" className="h-10 border rounded" />
          )}
        </div>
      )}

      <TextArea placeholder="Remarks" rows={2} value={value.remarks} onChange={(e) => set({ remarks: e.target.value })} />
    </div>
  );
}


/** One signatory: name + either a drawn/uploaded signature or a pick from project photo storage. */
function SignBox({
  title,
  name,
  namePlaceholder,
  onName,
  file,
  onFile,
  photoId,
  onPhoto,
  existingUrl,
  projectId,
  token,
  extra,
}: {
  title: string;
  name: string;
  namePlaceholder: string;
  onName: (v: string) => void;
  file: File | null;
  onFile: (f: File | null) => void;
  photoId: string | null;
  onPhoto: (id: string | null) => void;
  existingUrl?: string | null;
  projectId: string;
  token?: string | null;
  extra?: React.ReactNode;
}) {
  const [mode, setMode] = useState<"draw" | "photo">(photoId ? "photo" : "draw");
  return (
    <div className="space-y-2 rounded-lg border border-line bg-paper p-3">
      <Input placeholder={namePlaceholder} value={name} onChange={(e) => onName(e.target.value)} aria-label={namePlaceholder} />
      <div className="flex gap-1" role="tablist" aria-label={`${title} source`}>
        <Button
          type="button"
          variant={mode === "draw" ? "primary" : "secondary"}
          className="!py-1 !px-2.5 !text-xs"
          onClick={() => setMode("draw")}
        >
          Draw / upload
        </Button>
        <Button
          type="button"
          variant={mode === "photo" ? "primary" : "secondary"}
          className="!py-1 !px-2.5 !text-xs"
          onClick={() => setMode("photo")}
        >
          From photo storage
        </Button>
      </div>
      {mode === "draw" ? (
        <SignaturePad onCapture={onFile} label={title} personName={name} height={120} />
      ) : (
        <PhotoSignaturePicker
          projectId={projectId}
          token={token}
          label={title}
          selectedPhotoId={photoId}
          existingUrl={existingUrl}
          onSelect={(id) => onPhoto(id)}
        />
      )}
      {file ? <p className="text-[11px] text-emerald-700 font-semibold">Signature ready · {file.name.slice(0, 40)}</p> : null}
      {extra}
    </div>
  );
}
