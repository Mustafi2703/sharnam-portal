import { FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { Button, Input, Select, TextArea } from "./ui";
import { DEFAULT_PICKLISTS, withCurrent, type DrawingPicklists } from "../lib/drawingPicklists";
import {
  MASTER_REGISTER_DELAY_RESP,
  drawingDisciplineOptions,
  MASTER_REGISTER_DRAWING_TYPES,
  MASTER_REGISTER_ISSUED_TO,
  MASTER_REGISTER_LATEST,
  digitsOnly,
  masterRegisterDelay,
  masterRegisterErrors,
  type MasterRegisterForm,
} from "../lib/masterDrawingRegister";
import { formatUiText } from "../lib/formatUiText";
import { istTodayKey } from "@sharnam/shared";

function Field({
  label,
  children,
  className = "",
  error,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  error?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[10px] font-mono uppercase tracking-wider text-steel-muted block mb-1.5">{formatUiText(label)}</span>
      {children}
      {error ? (
        <span role="alert" className="mt-1 block text-[11px] text-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}

/** Number inputs still accept "-", "+", "e" and "." from the keyboard; whole-number fields refuse them. */
function blockNonDigitKeys(e: KeyboardEvent<HTMLInputElement>) {
  if (["-", "+", "e", "E", ".", ","].includes(e.key)) e.preventDefault();
}

function Section({
  title,
  tint,
  children,
}: {
  title: string;
  tint: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-lg border p-4 ${tint}`}>
      <p className="text-xs font-semibold uppercase tracking-wider mb-3">{title}</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{children}</div>
    </div>
  );
}

export function MasterDrawingRegisterForm({
  projectId,
  form,
  onChange,
  onSubmit,
  editingId = null,
  onCancelEdit,
  picklists,
  formId,
  inModal = false,
  packageOptions = [],
  buildingOptions = [],
}: {
  /** Pop-up mode: no header or buttons — the dialog's Save submits the form (formId) so required fields are enforced. */
  formId?: string;
  inModal?: boolean;
  packageOptions?: string[];
  buildingOptions?: string[];
  picklists?: DrawingPicklists;
  projectId: string;
  form: MasterRegisterForm;
  onChange: (next: MasterRegisterForm) => void;
  onSubmit: (e: FormEvent) => void;
  editingId?: string | null;
  onCancelEdit?: () => void;
}) {
  const { user } = useAuth();
  const set = (patch: Partial<MasterRegisterForm>) => onChange({ ...form, ...patch });
  const packageChoices = withCurrent(packageOptions, form.projectPackage);
  const today = istTodayKey();
  const delay = masterRegisterDelay(form, today);
  const errors = masterRegisterErrors(form, today);
  const hasErrors = Object.keys(errors).length > 0;
  const submit = (e: FormEvent) => {
    if (hasErrors) {
      e.preventDefault();
      return;
    }
    onSubmit(e);
  };

  const req = inModal;
  return (
    <div className={inModal ? "" : "sheet-register overflow-hidden"}>
      <datalist id="master-pick-building">{buildingOptions.map((v) => <option key={v} value={v} />)}</datalist>
      {inModal ? (
        <p className="text-xs text-steel-muted">
          Fields marked * are required. After saving, upload the PDF/DWG on the{" "}
          <Link to={`/projects/${projectId}/drawings`} className="text-brand font-semibold">Approval & GFC Log</Link> with the same drawing number.
        </p>
      ) : (
      <div className="sheet-register__head flex-col sm:flex-row sm:items-start gap-2">
        <div>
          <div className="font-display text-sm text-ink">
            {editingId ? `Edit master line · ${form.drawingNumber || "…"}` : "Add master register line"}
          </div>
          <p className="text-xs font-normal text-steel-muted mt-1 max-w-2xl">
            Full DCI row from <strong>Master Drawing Register</strong> sheet — separate from GFC file upload. After
            saving, upload PDF/DWG on{" "}
            <Link to={`/projects/${projectId}/drawings`} className="text-brand font-semibold">
              Approval & GFC Log
            </Link>{" "}
            with the same drawing number to link files.
          </p>
        </div>
      </div>
      )}

      <form id={formId} className={inModal ? "space-y-4" : "p-4 space-y-4 bg-paper"} onSubmit={submit}>
        <Section title="Drawing identity" tint="border-line bg-gradient-to-br from-sky-50/80 to-white">
          <Field label="Sr #" error={errors.srNo}>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={99999}
              step={1}
              onKeyDown={blockNonDigitKeys}
              value={form.srNo}
              onChange={(e) => set({ srNo: digitsOnly(e.target.value) })}
              placeholder="Auto"
              aria-invalid={errors.srNo ? true : undefined}
              className="font-mono"
            />
          </Field>
          <Field label={packageOptions.length ? "Project package" : "Project package"}>
            <Select
              value={form.projectPackage}
              onChange={(e) => set({ projectPackage: e.target.value })}
            >
              <option value="">{formatUiText(packageOptions.length ? "Select package" : "No packages yet")}</option>
              {packageChoices.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </Select>
            {!packageOptions.length ? (
              <p className="text-[11px] text-steel-muted mt-1">
                {formatUiText("No packages on this project. Add them in Project set-up.")}{" "}
                {user?.role === "admin" || user?.role === "office" ? (
                  <Link to={`/projects/${projectId}/setup`} className="text-brand font-semibold">{formatUiText("Project set-up")}</Link>
                ) : null}
              </p>
            ) : null}
          </Field>
          <Field label={req ? "Building *" : "Building"}>
            <Input
              required={req}
              list="master-pick-building"
              value={form.building}
              onChange={(e) => set({ building: e.target.value })}
              placeholder="Building / block"
            />
          </Field>
          <Field label={req ? "Discipline *" : "Discipline"}>
            <Select required={req} value={form.discipline} onChange={(e) => set({ discipline: e.target.value })}>
              {drawingDisciplineOptions([], form.discipline, (picklists || DEFAULT_PICKLISTS).disciplines).map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
          </Field>
          <Field label="Drawing number *">
            <Input
              value={form.drawingNumber}
              onChange={(e) => set({ drawingNumber: e.target.value })}
              placeholder="AR-101"
              required
              className="font-mono"
            />
          </Field>
          <Field label="Drawing title *" className="lg:col-span-2">
            <Input
              value={form.drawingTitle}
              onChange={(e) => set({ drawingTitle: e.target.value })}
              placeholder="Typical floor plan"
              required
            />
          </Field>
          <Field label={req ? "Drawing type *" : "Drawing type"}>
            <Select required={req} value={form.drawingType} onChange={(e) => set({ drawingType: e.target.value })}>
              {withCurrent((picklists || DEFAULT_PICKLISTS).drawingTypes, form.drawingType).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label={req ? "Consultant name *" : "Consultant name"}>
            <Input
              required={req}
              value={form.consultantName}
              onChange={(e) => set({ consultantName: e.target.value })}
              placeholder="Design Consultants Ltd"
            />
          </Field>
        </Section>

        <Section title="Revision" tint="border-line bg-gradient-to-br from-indigo-50/70 to-white">
          <Field label={req ? "Revision number *" : "Revision number"}>
            <Input
              required={req}
              value={form.revisionNumber}
              onChange={(e) => set({ revisionNumber: e.target.value })}
              placeholder="R0"
              className="font-mono"
            />
          </Field>
          <Field label={req ? "Revision date *" : "Revision date"} error={errors.revisionDate}>
            <Input
              type="date"
              required={req}
              max={today}
              value={form.revisionDate}
              onChange={(e) => set({ revisionDate: e.target.value })}
              aria-invalid={errors.revisionDate ? true : undefined}
            />
          </Field>
          <Field label="Latest revision">
            <Select value={form.latestRevision} onChange={(e) => set({ latestRevision: e.target.value })}>
              {MASTER_REGISTER_LATEST.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </Select>
          </Field>
          <Field label="Revision description" className="lg:col-span-4">
            <Input
              value={form.revisionDescription}
              onChange={(e) => set({ revisionDescription: e.target.value })}
              placeholder="Revised layout as per client comments"
            />
          </Field>
        </Section>

        <Section title="Submission tracking" tint="border-line bg-gradient-to-br from-amber-50/60 to-white">
          <Field label={req ? "Planned submission date *" : "Planned submission date"}>
            <Input
              type="date"
              required={req}
              value={form.plannedSubmissionDate}
              onChange={(e) => set({ plannedSubmissionDate: e.target.value })}
            />
          </Field>
          <Field label="Actual submission date">
            <Input
              type="date"
              value={form.actualSubmissionDate}
              onChange={(e) => set({ actualSubmissionDate: e.target.value })}
            />
          </Field>
          <div className="block">
            <span className="text-[10px] font-mono uppercase tracking-wider text-steel-muted block mb-1.5">
              {formatUiText("Submission delay (days)")}
            </span>
            <output
              aria-live="polite"
              className={`flex min-h-[38px] items-center gap-2 rounded border border-line bg-sand px-3 py-2 font-mono text-sm ${
                (delay.days ?? 0) > 0 ? "text-danger font-semibold" : "text-ink"
              }`}
            >
              {delay.days == null ? <span className="text-steel-muted">-</span> : delay.days}
              {delay.running ? (
                <span className="rounded border border-line bg-paper px-1.5 py-0.5 text-[10px] font-sans uppercase tracking-wider text-steel-muted">
                  {formatUiText("Running")}
                </span>
              ) : null}
            </output>
            <span className="mt-1 block text-[11px] text-steel-muted">
              {formatUiText(delay.days == null ? "Set the planned date to calculate" : "Calculated from the dates")}
            </span>
          </div>
          <Field label="Delay responsibility">
            <Select value={form.delayResponsibility} onChange={(e) => set({ delayResponsibility: e.target.value })}>
              <option value="">Select…</option>
              {withCurrent((picklists || DEFAULT_PICKLISTS).delayResponsibility, form.delayResponsibility).map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
          </Field>
        </Section>

        <Section title="Issue to site / client" tint="border-line bg-gradient-to-br from-emerald-50/60 to-white">
          <Field label="Issued to">
            <Select value={form.issuedTo} onChange={(e) => set({ issuedTo: e.target.value })}>
              <option value="">Select…</option>
              {withCurrent((picklists || DEFAULT_PICKLISTS).issuedTo, form.issuedTo).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Issue date" error={errors.issueDate}>
            <Input
              type="date"
              max={today}
              value={form.issueDate}
              onChange={(e) => set({ issueDate: e.target.value })}
              aria-invalid={errors.issueDate ? true : undefined}
            />
          </Field>
          <Field label="No. of copies" error={errors.copiesCount}>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={99}
              step={1}
              onKeyDown={blockNonDigitKeys}
              value={form.copiesCount}
              onChange={(e) => set({ copiesCount: digitsOnly(e.target.value) })}
              placeholder="2"
              aria-invalid={errors.copiesCount ? true : undefined}
              className="font-mono"
            />
          </Field>
          <Field label={req ? "Critical drawing *" : "Critical drawing"}>
            <Select required={req} value={form.criticalDrawing} onChange={(e) => set({ criticalDrawing: e.target.value })}>
              <option>No</option>
              <option>Yes</option>
            </Select>
          </Field>
          <Field label="Remarks" className="lg:col-span-4">
            <TextArea rows={2} value={form.remarks} onChange={(e) => set({ remarks: e.target.value })} placeholder="Issued to site" />
          </Field>
        </Section>

        {inModal ? null : (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="submit">{editingId ? "Save changes" : "Save master line"}</Button>
          {editingId && onCancelEdit && (
            <Button type="button" variant="secondary" onClick={onCancelEdit}>
              Cancel edit
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              onChange({
                ...form,
                drawingNumber: "",
                drawingTitle: "",
                revisionDescription: "",
                remarks: "",
              })
            }
          >
            Clear drawing fields
          </Button>
        </div>
        )}
      </form>
    </div>
  );
}
