import { Input, TextArea } from "./ui";
import { SignaturePad } from "./SignaturePad";
import { formatUiText } from "../lib/formatUiText";
import { resolveDrawingFileUrl } from "../lib/drawingPreview";
import type { DrawingIssueDraft } from "../lib/drawingIssueFields";

export function DrawingIssueFields({
  value,
  onChange,
  existingContractorSignUrl,
  existingClientSignUrl,
}: {
  value: DrawingIssueDraft;
  onChange: (next: DrawingIssueDraft) => void;
  existingContractorSignUrl?: string | null;
  existingClientSignUrl?: string | null;
}) {
  const set = (patch: Partial<DrawingIssueDraft>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-line bg-sand/15 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-steel-muted">
          {formatUiText("Site drawing register — receive & issue (this revision)")}
        </p>
        <span className="rounded-full border border-line bg-paper px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-steel-muted">
          Optional
        </span>
      </div>
      <p className="text-xs text-steel-muted leading-relaxed">
        Fill when the physical drawing is received or issued on site. You can upload PDF/DWG without this block.
        Signature pads and dates sync to the Site register tab when saved. Client to confirm exact workflow during UAT.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-xs font-mono uppercase tracking-wider text-steel-muted">
            {formatUiText("Date of receiving")}
          </span>
          <Input
            className="mt-1.5"
            type="date"
            value={value.receivedDate}
            onChange={(e) => set({ receivedDate: e.target.value })}
          />
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

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Input
            placeholder="Contractor receiver name"
            value={value.contractorSignName}
            onChange={(e) => set({ contractorSignName: e.target.value })}
          />
          {existingContractorSignUrl && !value.contractorSignature && (
            <img
              src={resolveDrawingFileUrl(existingContractorSignUrl)}
              alt="Contractor signature on file"
              className="h-12 border border-line rounded bg-white object-contain"
            />
          )}
          <SignaturePad
            label="Contractor receiver signature"
            personName={value.contractorSignName || "Contractor"}
            onCapture={(file) => set({ contractorSignature: file })}
          />
        </div>
        <div className="space-y-2">
          <Input
            placeholder="Client receiver name"
            value={value.clientSignName}
            onChange={(e) => set({ clientSignName: e.target.value })}
          />
          {existingClientSignUrl && !value.clientSignature && (
            <img
              src={resolveDrawingFileUrl(existingClientSignUrl)}
              alt="Client signature on file"
              className="h-12 border border-line rounded bg-white object-contain"
            />
          )}
          <SignaturePad
            label="Client receiver signature"
            personName={value.clientSignName || "Client"}
            onCapture={(file) => set({ clientSignature: file })}
          />
        </div>
      </div>

      <TextArea
        placeholder="Remarks"
        rows={2}
        value={value.remarks}
        onChange={(e) => set({ remarks: e.target.value })}
      />
    </div>
  );
}
