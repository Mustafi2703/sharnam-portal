import { FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button, Input, Select, TextArea } from "./ui";
import {
  MASTER_REGISTER_BUILDINGS,
  MASTER_REGISTER_DELAY_RESP,
  MASTER_REGISTER_DISCIPLINES,
  MASTER_REGISTER_DRAWING_TYPES,
  MASTER_REGISTER_ISSUED_TO,
  MASTER_REGISTER_PACKAGES,
  type MasterRegisterForm,
} from "../lib/masterDrawingRegister";

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[10px] font-mono uppercase tracking-wider text-steel-muted block mb-1.5">{label}</span>
      {children}
    </label>
  );
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
}: {
  projectId: string;
  form: MasterRegisterForm;
  onChange: (next: MasterRegisterForm) => void;
  onSubmit: (e: FormEvent) => void;
}) {
  const set = (patch: Partial<MasterRegisterForm>) => onChange({ ...form, ...patch });

  const onPlannedOrActual = (patch: Partial<MasterRegisterForm>) => {
    const next = { ...form, ...patch };
    if (
      !next.submissionDelayDays.trim() &&
      next.plannedSubmissionDate &&
      next.actualSubmissionDate
    ) {
      const delay = Math.ceil(
        (new Date(next.actualSubmissionDate).getTime() - new Date(next.plannedSubmissionDate).getTime()) / 86400000
      );
      next.submissionDelayDays = Number.isFinite(delay) ? String(delay) : "";
    }
    onChange(next);
  };

  return (
    <div className="sheet-register overflow-hidden">
      <div className="sheet-register__head flex-col sm:flex-row sm:items-start gap-2">
        <div>
          <div className="font-display text-sm text-ink">Add master register line</div>
          <p className="text-xs font-normal text-steel-muted mt-1 max-w-2xl">
            Full DCI row from <strong>Master Drawing Register</strong> sheet — separate from GFC file upload. After
            saving, upload PDF/DWG on{" "}
            <Link to={`/projects/${projectId}/drawings`} className="text-brand font-semibold">
              GFC register
            </Link>{" "}
            with the same drawing number to link files.
          </p>
        </div>
      </div>

      <form className="p-4 space-y-4 bg-paper" onSubmit={onSubmit}>
        <Section title="Drawing identity" tint="border-line bg-gradient-to-br from-sky-50/80 to-white">
          <Field label="Sr #">
            <Input value={form.srNo} onChange={(e) => set({ srNo: e.target.value })} placeholder="1" />
          </Field>
          <Field label="Project package">
            <Select value={form.projectPackage} onChange={(e) => set({ projectPackage: e.target.value })}>
              {MASTER_REGISTER_PACKAGES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
          </Field>
          <Field label="Building">
            <Select value={form.building} onChange={(e) => set({ building: e.target.value })}>
              {MASTER_REGISTER_BUILDINGS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </Select>
          </Field>
          <Field label="Discipline">
            <Select value={form.discipline} onChange={(e) => set({ discipline: e.target.value })}>
              {MASTER_REGISTER_DISCIPLINES.map((d) => (
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
          <Field label="Drawing type">
            <Select value={form.drawingType} onChange={(e) => set({ drawingType: e.target.value })}>
              {MASTER_REGISTER_DRAWING_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Consultant name">
            <Input
              value={form.consultantName}
              onChange={(e) => set({ consultantName: e.target.value })}
              placeholder="Design Consultants Ltd"
            />
          </Field>
        </Section>

        <Section title="Revision" tint="border-line bg-gradient-to-br from-indigo-50/70 to-white">
          <Field label="Revision number">
            <Input
              value={form.revisionNumber}
              onChange={(e) => set({ revisionNumber: e.target.value })}
              placeholder="R0"
              className="font-mono"
            />
          </Field>
          <Field label="Revision date">
            <Input type="date" value={form.revisionDate} onChange={(e) => set({ revisionDate: e.target.value })} />
          </Field>
          <Field label="Latest revision">
            <Select value={form.latestRevision} onChange={(e) => set({ latestRevision: e.target.value })}>
              <option>Yes</option>
              <option>No</option>
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
          <Field label="Planned submission date">
            <Input
              type="date"
              value={form.plannedSubmissionDate}
              onChange={(e) => onPlannedOrActual({ plannedSubmissionDate: e.target.value })}
            />
          </Field>
          <Field label="Actual submission date">
            <Input
              type="date"
              value={form.actualSubmissionDate}
              onChange={(e) => onPlannedOrActual({ actualSubmissionDate: e.target.value })}
            />
          </Field>
          <Field label="Submission delay (days)">
            <Input
              value={form.submissionDelayDays}
              onChange={(e) => set({ submissionDelayDays: e.target.value })}
              placeholder="Auto from dates"
              className="font-mono"
            />
          </Field>
          <Field label="Delay responsibility">
            <Select value={form.delayResponsibility} onChange={(e) => set({ delayResponsibility: e.target.value })}>
              <option value="">Select…</option>
              {MASTER_REGISTER_DELAY_RESP.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
          </Field>
        </Section>

        <Section title="Issue to site / client" tint="border-line bg-gradient-to-br from-emerald-50/60 to-white">
          <Field label="Issued to">
            <Select value={form.issuedTo} onChange={(e) => set({ issuedTo: e.target.value })}>
              <option value="">Select…</option>
              {MASTER_REGISTER_ISSUED_TO.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Issue date">
            <Input type="date" value={form.issueDate} onChange={(e) => set({ issueDate: e.target.value })} />
          </Field>
          <Field label="No. of copies">
            <Input
              type="number"
              min={0}
              value={form.copiesCount}
              onChange={(e) => set({ copiesCount: e.target.value })}
              placeholder="2"
              className="font-mono"
            />
          </Field>
          <Field label="Critical drawing">
            <Select value={form.criticalDrawing} onChange={(e) => set({ criticalDrawing: e.target.value })}>
              <option>No</option>
              <option>Yes</option>
            </Select>
          </Field>
          <Field label="Remarks" className="lg:col-span-4">
            <TextArea rows={2} value={form.remarks} onChange={(e) => set({ remarks: e.target.value })} placeholder="Issued to site" />
          </Field>
        </Section>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="submit">Save master line</Button>
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
                submissionDelayDays: "",
              })
            }
          >
            Clear drawing fields
          </Button>
        </div>
      </form>
    </div>
  );
}
