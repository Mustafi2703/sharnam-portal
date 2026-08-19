import { Input, TextArea } from "./ui";
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
          {formatUiText("Receive & issue — three signatures from photo storage")}
        </p>
        <span className="rounded-full border border-line bg-paper px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-steel-muted">
          Optional
        </span>
      </div>
      <p className="text-xs text-steel-muted leading-relaxed">
        Upload PDF/DWG without this block. Pick client, PMC, and site engineer signatures from project photo storage (Photos module).
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
        <div className="space-y-2">
          <Input placeholder="Client signatory name" value={value.clientSignName} onChange={(e) => set({ clientSignName: e.target.value })} />
          <PhotoSignaturePicker
            projectId={projectId}
            token={token}
            label="Client signature"
            selectedPhotoId={value.clientSignPhotoId}
            existingUrl={existingClientSignUrl}
            onSelect={(id) => set({ clientSignPhotoId: id })}
          />
        </div>
        <div className="space-y-2">
          <Input placeholder="PMC signatory name" value={value.pmcSignName} onChange={(e) => set({ pmcSignName: e.target.value })} />
          <PhotoSignaturePicker
            projectId={projectId}
            token={token}
            label="PMC signature"
            selectedPhotoId={value.pmcSignPhotoId}
            existingUrl={existingPmcSignUrl}
            onSelect={(id) => set({ pmcSignPhotoId: id })}
          />
        </div>
        <div className="space-y-2">
          <Input
            placeholder="Site engineer name"
            value={value.siteEngineerSignName}
            onChange={(e) => set({ siteEngineerSignName: e.target.value })}
          />
          <PhotoSignaturePicker
            projectId={projectId}
            token={token}
            label="Site engineer signature"
            selectedPhotoId={value.siteEngineerSignPhotoId}
            existingUrl={existingSiteEngineerSignUrl}
            onSelect={(id) => set({ siteEngineerSignPhotoId: id })}
          />
        </div>
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
