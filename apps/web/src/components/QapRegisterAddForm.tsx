import { FormEvent, useRef } from "react";
import { RegisterEntryModal } from "./RegisterEntryModal";
import { Button, Input, Select } from "./ui";
import { QapPickerLists } from "./QapPickerLists";

export type QapAddFormState = {
  addMode: "section" | "line";
  weekLabel: string;
  srNo: string;
  section: string;
  description: string;
  frequency: string;
  codeOfConformance: string;
  testAgency: string;
  contractorPerformer?: string;
  contractorChecker?: string;
  pmcRole?: string;
  clientRole?: string;
  records?: string;
  remarks?: string;
};

type Props = {
  open: boolean;
  busy?: boolean;
  weeks: string[];
  sections: string[];
  form: QapAddFormState;
  onChange: (next: QapAddFormState) => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
};

export function QapRegisterAddForm({ open, busy, weeks, sections, form, onChange, onSubmit, onClose }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const set = (patch: Partial<QapAddFormState>) => onChange({ ...form, ...patch });

  const title = form.addMode === "section" ? "Add QAP section" : "Add QAP line";
  const saveLabel = form.addMode === "section" ? "Save section" : "Save line";

  return (
    <RegisterEntryModal
      open={open}
      title={title}
      onClose={onClose}
      onSave={() => formRef.current?.requestSubmit()}
      saving={busy}
      size="3xl"
      saveLabel={saveLabel}
    >
      <form ref={formRef} className="space-y-4" onSubmit={onSubmit}>
        <QapPickerLists />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={form.addMode === "section" ? "primary" : "secondary"}
            className="!text-xs"
            onClick={() => set({ addMode: "section", section: "", srNo: "" })}
          >
            New section
          </Button>
          <Button
            type="button"
            variant={form.addMode === "line" ? "primary" : "secondary"}
            className="!text-xs"
            onClick={() => set({ addMode: "line" })}
          >
            Line under section
          </Button>
        </div>

        <div className="register-form-section">
          <p className="register-form-section__title">
            {form.addMode === "section" ? "Activity section" : "Activity line"}
          </p>
          <div className="register-form-grid register-form-grid--wide">
            <label className="register-form-field">
              <span>Week</span>
              <Input
                value={form.weekLabel}
                onChange={(e) => set({ weekLabel: e.target.value })}
                list="qap-week-labels"
                placeholder="Week 50"
                required
              />
              {weeks.length > 0 && (
                <datalist id="qap-week-labels">
                  {weeks.map((w) => (
                    <option key={w} value={w} />
                  ))}
                </datalist>
              )}
            </label>
            {form.addMode === "section" && (
              <label className="register-form-field">
                <span>Sr. no.</span>
                <Input value={form.srNo} onChange={(e) => set({ srNo: e.target.value })} placeholder="12" />
              </label>
            )}
            <label className="register-form-field register-form-field--wide">
              <span>Activity / section</span>
              {form.addMode === "line" && sections.length > 0 ? (
                <Select value={form.section} onChange={(e) => set({ section: e.target.value })} required>
                  <option value="">Pick section…</option>
                  {sections.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  value={form.section}
                  onChange={(e) => set({ section: e.target.value })}
                  placeholder="Concreting"
                  required
                />
              )}
            </label>
            <label className="register-form-field register-form-field--wide">
              <span>Description</span>
              <Input
                value={form.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="Material confirmation, slump, cube casting…"
                required
              />
            </label>
            <label className="register-form-field">
              <span>Frequency</span>
              <Input value={form.frequency} list="qap-pick-frequency" onChange={(e) => set({ frequency: e.target.value })} placeholder="Daily" />
            </label>
            <label className="register-form-field">
              <span>Code of conformance</span>
              <Input
                value={form.codeOfConformance}
                onChange={(e) => set({ codeOfConformance: e.target.value })}
                placeholder="IS / drawing ref"
              />
            </label>
            <label className="register-form-field">
              <span>Test agency</span>
              <Input value={form.testAgency} list="qap-pick-testAgency" onChange={(e) => set({ testAgency: e.target.value })} placeholder="NABL lab" />
            </label>
            <label className="register-form-field">
              <span>Contractor performer</span>
              <Input value={form.contractorPerformer || ""} list="qap-pick-contractorPerformer" onChange={(e) => set({ contractorPerformer: e.target.value })} placeholder="Site Engr" />
            </label>
            <label className="register-form-field">
              <span>Contractor checker</span>
              <Input value={form.contractorChecker || ""} list="qap-pick-contractorChecker" onChange={(e) => set({ contractorChecker: e.target.value })} placeholder="QC Engr" />
            </label>
            <label className="register-form-field">
              <span>PMC checker</span>
              <Input value={form.pmcRole || ""} list="qap-pick-pmcRole" onChange={(e) => set({ pmcRole: e.target.value })} placeholder="Witness / Review" />
            </label>
            <label className="register-form-field">
              <span>Client checker</span>
              <Input value={form.clientRole || ""} list="qap-pick-clientRole" onChange={(e) => set({ clientRole: e.target.value })} placeholder="Random / Witness" />
            </label>
            <label className="register-form-field">
              <span>Records to maintain</span>
              <Input value={form.records || ""} list="qap-pick-records" onChange={(e) => set({ records: e.target.value })} placeholder="Work Check List" />
            </label>
            <label className="register-form-field">
              <span>Remarks</span>
              <Input value={form.remarks || ""} list="qap-pick-remarks" onChange={(e) => set({ remarks: e.target.value })} placeholder="Pending / Completed" />
            </label>
          </div>
        </div>
      </form>
    </RegisterEntryModal>
  );
}
