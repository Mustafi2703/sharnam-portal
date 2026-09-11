import type { FormEvent, ReactNode } from "react";
import { Badge, Button, Card, Input, Select, TextArea } from "./ui";
import { FilePickButton } from "./FilePickButton";
import { SignaturePad } from "./SignaturePad";
import { StandaloneFormHeader } from "./StandaloneFormHeader";

export type ChecklistFillItem = {
  id: string;
  itemCode?: string;
  description: string;
  section?: string;
  instruction?: string;
  requirePhoto?: boolean;
};

export type ChecklistFillLine = {
  answer: string;
  remarks: string;
  photos: File[];
  docs: File[];
  evidenceLinks: string[];
};

export type ChecklistFillMeta = {
  reportNo: string;
  location: string;
  refDrawing: string;
  quantity: string;
};

export type ChecklistDrawingOption = {
  id: string;
  drawingNumber?: string;
  title?: string;
  currentRev?: string;
  isPublished?: boolean;
  revisions?: { id: string; revisionNumber?: string }[];
};

export const emptyChecklistLine = (): ChecklistFillLine => ({
  answer: "",
  remarks: "",
  photos: [],
  docs: [],
  evidenceLinks: [],
});

export const emptyChecklistMeta = (): ChecklistFillMeta => ({
  reportNo: "",
  location: "",
  refDrawing: "",
  quantity: "",
});

export function checklistFamilyLabel(family: string) {
  if (family === "QualityInspection") return "Quality inspection checklist";
  if (family === "Safety") return "Safety checklist";
  if (family === "ActivityInspection") return "Activity inspection";
  if (family === "DrawingCheck") return "Drawing check";
  return "Site execution checklist";
}

function FileList({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  if (!files.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {files.map((f, i) => (
        <li
          key={`${f.name}-${i}`}
          className="inline-flex items-center gap-1 rounded-md border border-line bg-sand px-2 py-1 text-[11px] text-ink"
        >
          <span className="max-w-[12rem] truncate">{f.name}</span>
          <button type="button" className="text-steel-muted hover:text-danger" onClick={() => onRemove(i)} aria-label={`Remove ${f.name}`}>
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}

type Props = {
  family: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  category?: string;
  items: ChecklistFillItem[];
  sections: string[];
  responses: Record<string, ChecklistFillLine>;
  onPatchLine: (itemId: string, patch: Partial<ChecklistFillLine>) => void;
  fillMeta: ChecklistFillMeta;
  onFillMeta: (meta: ChecklistFillMeta) => void;
  remarks: string;
  onRemarks: (value: string) => void;
  drawings?: ChecklistDrawingOption[];
  drawingId: string;
  revisionId: string;
  onDrawingId: (id: string) => void;
  onRevisionId: (id: string) => void;
  requireDrawing?: boolean;
  showDrawingPicker?: boolean;
  overallPhotos: File[];
  onOverallPhotos: (files: File[]) => void;
  onSignature: (file: File | null) => void;
  signerName?: string;
  minPhotos?: number;
  photoTotal: number;
  answered: number;
  canFill: boolean;
  draftId?: string | null;
  savingDraft?: boolean;
  submitting?: boolean;
  msg?: string;
  onSaveDraft?: () => void;
  onSubmit: (e: FormEvent) => void;
  onClose?: () => void;
  submitLabel?: string;
  headerActions?: ReactNode;
};

export function ChecklistFillForm({
  family,
  eyebrow,
  title,
  subtitle,
  category,
  items,
  sections,
  responses,
  onPatchLine,
  fillMeta,
  onFillMeta,
  remarks,
  onRemarks,
  drawings = [],
  drawingId,
  revisionId,
  onDrawingId,
  onRevisionId,
  requireDrawing = false,
  showDrawingPicker = true,
  overallPhotos,
  onOverallPhotos,
  onSignature,
  signerName,
  minPhotos = 0,
  photoTotal,
  answered,
  canFill,
  draftId,
  savingDraft,
  submitting,
  msg,
  onSaveDraft,
  onSubmit,
  onClose,
  submitLabel = "Submit checklist form",
  headerActions,
}: Props) {
  const familyLabel = checklistFamilyLabel(family);
  const answerPct = items.length ? Math.round((answered / items.length) * 100) : 0;
  const selectedDrawing = drawings.find((d) => d.id === drawingId);
  const revisions = selectedDrawing?.revisions || [];

  return (
    <div className="standalone-form-page standalone-form-page--paper">
      <StandaloneFormHeader
        variant="navy"
        eyebrow={eyebrow || familyLabel}
        title={title}
        subtitle={subtitle || familyLabel}
        metaRight={
          <>
            <Badge tone="brand">{familyLabel}</Badge>
            {draftId ? <Badge tone="warn">Draft</Badge> : null}
            <Badge tone="warn">
              {answered}/{items.length || "—"}
            </Badge>
          </>
        }
        actions={
          <>
            {headerActions}
            {onSaveDraft && (
              <Button type="button" variant="secondary" className="!text-xs" onClick={() => onSaveDraft()} disabled={savingDraft || !canFill}>
                {savingDraft ? "Saving…" : "Save draft"}
              </Button>
            )}
            <Button type="button" variant="ghost" className="!text-xs !text-white hover:!bg-white/10" onClick={onClose || (() => window.close())}>
              Close
            </Button>
          </>
        }
      />

      <main className="standalone-form-page__main space-y-5 portal-fill-layout">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            {category ? (
              <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-steel-muted">{category}</p>
            ) : null}
            <h1 className="font-display text-xl text-ink mt-0.5">{title}</h1>
            <p className="text-sm text-steel-muted mt-1">
              Yes / No / N.A. on every line. Photos and files are optional unless the template requires them.
              {minPhotos > 0 ? ` At least ${minPhotos} photos required (${photoTotal} attached).` : ""}
            </p>
          </div>
          <div className="text-right space-y-1">
            <div className="text-2xl font-display text-brand">
              {answered}/{items.length}
            </div>
            <div className="text-[11px] text-steel-muted font-mono uppercase">{answerPct}% answered</div>
            <div className="w-32 h-1.5 bg-line rounded-full overflow-hidden ml-auto">
              <div className="h-full bg-brand transition-all" style={{ width: `${answerPct}%` }} />
            </div>
          </div>
        </div>

        {msg ? <p className="text-sm rounded-lg px-3 py-2 bg-brand-soft text-brand-dark">{msg}</p> : null}

        {showDrawingPicker && (
          <Card className="!p-5">
            <h3 className="font-semibold text-sm mb-1">1. Drawing & revision</h3>
            <p className="text-xs text-steel-muted mb-3">
              {requireDrawing
                ? "Pick the published sheet this fill refers to."
                : "Optional — link a published sheet if this check is against an existing drawing."}
            </p>
            {drawings.length === 0 ? (
              <p className="text-sm text-steel-muted">No published drawings on this project yet.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="text-xs font-mono uppercase tracking-wider text-steel-muted">Drawing</span>
                  <Select
                    className="mt-1"
                    value={drawingId}
                    disabled={!canFill}
                    onChange={(e) => {
                      const next = e.target.value;
                      onDrawingId(next);
                      const first = drawings.find((d) => d.id === next)?.revisions?.[0]?.id || "";
                      onRevisionId(first);
                    }}
                  >
                    <option value="">{requireDrawing ? "Select drawing…" : "None — not linked"}</option>
                    {drawings.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.drawingNumber || d.id}
                        {d.title ? ` — ${d.title}` : ""}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="block text-sm">
                  <span className="text-xs font-mono uppercase tracking-wider text-steel-muted">Revision</span>
                  <Select
                    className="mt-1"
                    value={revisionId}
                    disabled={!canFill || !drawingId}
                    onChange={(e) => onRevisionId(e.target.value)}
                  >
                    <option value="">{drawingId ? "Select revision…" : "Pick a drawing first"}</option>
                    {revisions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.revisionNumber || r.id}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
            )}
          </Card>
        )}

        <Card className="!p-5">
          <h3 className="font-semibold text-sm mb-3">2. Sheet header (SPDC)</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="block text-sm">
              <span className="text-xs font-mono uppercase tracking-wider text-steel-muted">Report no.</span>
              <Input
                className="mt-1"
                placeholder="CL/CIV/104"
                value={fillMeta.reportNo}
                onChange={(e) => onFillMeta({ ...fillMeta, reportNo: e.target.value })}
                disabled={!canFill}
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs font-mono uppercase tracking-wider text-steel-muted">Location</span>
              <Input
                className="mt-1"
                placeholder="Grid C4 / Level +0.00"
                value={fillMeta.location}
                onChange={(e) => onFillMeta({ ...fillMeta, location: e.target.value })}
                disabled={!canFill}
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs font-mono uppercase tracking-wider text-steel-muted">Ref. drawing</span>
              <Input
                className="mt-1"
                placeholder={selectedDrawing?.drawingNumber || "SPDC-STR-104 Rev. 2"}
                value={fillMeta.refDrawing}
                onChange={(e) => onFillMeta({ ...fillMeta, refDrawing: e.target.value })}
                disabled={!canFill}
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs font-mono uppercase tracking-wider text-steel-muted">Quantity</span>
              <Input
                className="mt-1"
                placeholder="3.2 cum"
                value={fillMeta.quantity}
                onChange={(e) => onFillMeta({ ...fillMeta, quantity: e.target.value })}
                disabled={!canFill}
              />
            </label>
          </div>
        </Card>

        <form onSubmit={onSubmit} className="surface brand-frame p-5 sm:p-7 space-y-6">
          <div className="pb-4 border-b border-line flex flex-wrap gap-3 justify-between">
            <div>
              <div className="text-xs font-mono uppercase text-steel-muted">3. Checklist lines</div>
              <div className="font-semibold mt-1">Answer each line · photos, files, or SharePoint links</div>
            </div>
            <Input
              className="max-w-xs"
              value={remarks}
              onChange={(e) => onRemarks(e.target.value)}
              placeholder="Overall remarks"
              disabled={!canFill}
            />
          </div>

          <div className="space-y-8">
            {sections.map((section) => (
              <section key={section} className="space-y-4">
                <h3 className="font-mono text-[11px] uppercase tracking-[0.2em] text-mark">{section}</h3>
                {items
                  .filter((i) => (i.section || "General") === section)
                  .map((item, idx) => {
                    const line = responses[item.id] || emptyChecklistLine();
                    return (
                      <div key={item.id} className="border border-line bg-paper rounded-xl p-4 sm:p-5 space-y-3 text-ink">
                        <div className="flex gap-3">
                          <span className="shrink-0 h-7 w-7 rounded-lg bg-[#1c222b] text-white text-xs font-bold grid place-items-center">
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1 text-[15px] leading-relaxed font-semibold text-ink">
                            {item.itemCode && <span className="font-mono text-brand mr-2">{item.itemCode}</span>}
                            {item.description}
                          </div>
                        </div>
                        {item.instruction?.trim() && (
                          <p className="text-sm text-steel-muted bg-sand/50 border border-line rounded-lg px-3 py-2 leading-relaxed">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-brand block mb-1">
                              Instruction
                            </span>
                            {item.instruction}
                          </p>
                        )}
                        {item.requirePhoto && (
                          <p className="text-[11px] font-semibold text-amber-800">Photo required for this line</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {["Yes", "No", "N.A."].map((ans) => {
                            const on = line.answer === ans;
                            return (
                              <button
                                key={ans}
                                type="button"
                                disabled={!canFill}
                                onClick={() => onPatchLine(item.id, { answer: ans })}
                                className={`rounded-full px-4 py-2 text-sm font-semibold border ${
                                  on
                                    ? ans === "Yes"
                                      ? "bg-brand text-white border-brand"
                                      : ans === "No"
                                        ? "bg-danger text-white border-danger"
                                        : "bg-warn text-white border-warn"
                                    : "bg-sand border-line text-ink hover:border-brand"
                                }`}
                              >
                                {ans}
                              </button>
                            );
                          })}
                        </div>
                        <TextArea
                          rows={2}
                          placeholder="Comment for this checklist item (optional)"
                          value={line.remarks}
                          disabled={!canFill}
                          onChange={(e) => onPatchLine(item.id, { remarks: e.target.value })}
                        />
                        <div className="grid sm:grid-cols-2 gap-3 pt-1">
                          <label className="text-xs text-steel-muted block sm:col-span-2">
                            SharePoint / OneDrive evidence link (optional)
                            <Input
                              className="mt-1 !text-xs"
                              placeholder="https://…sharepoint.com/… or OneDrive link"
                              value={line.evidenceLinks[0] || ""}
                              disabled={!canFill}
                              onChange={(e) =>
                                onPatchLine(item.id, {
                                  evidenceLinks: e.target.value.trim() ? [e.target.value.trim()] : [],
                                })
                              }
                            />
                          </label>
                          <div className="space-y-2">
                            <p className="text-xs text-steel-muted">Photos (optional)</p>
                            <div className="flex flex-wrap gap-2">
                              <FilePickButton
                                accept="image/*"
                                capture="environment"
                                multiple
                                variant="primary"
                                disabled={!canFill}
                                onPick={(files) => onPatchLine(item.id, { photos: [...line.photos, ...files] })}
                              >
                                Take photo
                              </FilePickButton>
                              <FilePickButton
                                accept="image/*"
                                multiple
                                disabled={!canFill}
                                onPick={(files) => onPatchLine(item.id, { photos: [...line.photos, ...files] })}
                              >
                                Attach photo
                              </FilePickButton>
                            </div>
                            <FileList
                              files={line.photos}
                              onRemove={(i) =>
                                onPatchLine(item.id, { photos: line.photos.filter((_, idx) => idx !== i) })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs text-steel-muted">Documents (optional)</p>
                            <FilePickButton
                              accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.txt,application/pdf,image/*"
                              multiple
                              disabled={!canFill}
                              onPick={(files) => onPatchLine(item.id, { docs: [...line.docs, ...files] })}
                            >
                              Attach file
                            </FilePickButton>
                            <FileList
                              files={line.docs}
                              onRemove={(i) => onPatchLine(item.id, { docs: line.docs.filter((_, idx) => idx !== i) })}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </section>
            ))}
          </div>

          <div className="pt-4 border-t border-line space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-sm text-steel-muted">
                  Overall photos (optional)
                  {minPhotos > 0 && (
                    <span className="ml-2 text-xs font-semibold text-brand">
                      {photoTotal}/{minPhotos} photos (min)
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  <FilePickButton
                    accept="image/*"
                    capture="environment"
                    multiple
                    variant="primary"
                    disabled={!canFill}
                    onPick={(files) => onOverallPhotos([...overallPhotos, ...files])}
                  >
                    Take photo
                  </FilePickButton>
                  <FilePickButton
                    accept="image/*"
                    multiple
                    disabled={!canFill}
                    onPick={(files) => onOverallPhotos([...overallPhotos, ...files])}
                  >
                    Attach photo
                  </FilePickButton>
                </div>
                <FileList
                  files={overallPhotos}
                  onRemove={(i) => onOverallPhotos(overallPhotos.filter((_, idx) => idx !== i))}
                />
              </div>
              <SignaturePad
                onCapture={onSignature}
                personName={signerName}
                label="Signed by (inspector / site engineer)"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {canFill && (
                <>
                  {onSaveDraft && (
                    <Button type="button" variant="secondary" disabled={savingDraft} onClick={() => onSaveDraft()}>
                      {savingDraft ? "Saving…" : "Save draft"}
                    </Button>
                  )}
                  <Button
                    type="submit"
                    disabled={
                      submitting ||
                      answered < items.length ||
                      (minPhotos > 0 && photoTotal < minPhotos) ||
                      (requireDrawing && drawings.length > 0 && !drawingId)
                    }
                  >
                    {submitting ? "Submitting…" : submitLabel}
                  </Button>
                </>
              )}
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
