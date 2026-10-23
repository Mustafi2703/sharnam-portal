import { useState } from "react";
import { Button, Input, TextArea } from "./ui";
import { SignaturePad } from "./SignaturePad";
import { formatUiText } from "../lib/formatUiText";
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
          {formatUiText("Receive and issue")}
        </p>
        <span className="rounded-full border border-line bg-paper px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-steel-muted">
          One signature
        </span>
      </div>
      <p className="text-xs text-steel-muted leading-relaxed">
        One signature is enough. The Drawing Check already has the SPDC project team sign. Add that same sign here if you want it on the register, or leave it blank.
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

      <SignBox
        title="Signature"
        name={value.pmcSignName}
        namePlaceholder="Name of the person signing"
        onName={(pmcSignName) => set({ pmcSignName })}
        file={value.pmcSignFile || null}
        onFile={(pmcSignFile) => set({ pmcSignFile, ...(pmcSignFile ? { pmcSignPhotoId: null } : {}) })}
        photoId={value.pmcSignPhotoId}
        onPhoto={(pmcSignPhotoId) => set({ pmcSignPhotoId, ...(pmcSignPhotoId ? { pmcSignFile: null } : {}) })}
        existingUrl={existingPmcSignUrl || existingClientSignUrl || existingSiteEngineerSignUrl}
        projectId={projectId}
        token={token}
      />

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
