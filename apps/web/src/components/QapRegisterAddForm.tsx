import { FormEvent, useRef } from "react";
import { RegisterEntryModal } from "./RegisterEntryModal";
import { Button, Input, Select } from "./ui";

export type QapAddFormState = {
  addMode: "section" | "line";
  weekLabel: string;
  srNo: string;
  section: string;
  description: string;
  frequency: string;
  codeOfConformance: string;
  testAgency: string;
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

/** Add QAP section or line — popup so the register sheet stays visible behind. */
export function QapRegisterAddForm({ open, busy, weeks, sections, form, onChange, onSubmit, onClose }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const set = (patch: Partial<QapAddFormState>) => onChange({ ...form, ...patch });

  const title = form.addMode === "section" ? "Add QAP activity section" : "Add QAP line under section";
  const saveLabel = form.addMode === "section" ? "Save section" : "Save QAP line";

  return (
    <RegisterEntryModal
      open={open}
      title={title}
      onClose={onClose}
      onSave={() => formRef.current?.requestSubmit()}
      saving={busy}
      size="2xl"
      saveLabel={saveLabel}
    >
      <p className="text-sm text-steel-muted">
        {form.addMode === "section"
          ? "Start a new activity group (e.g. Concreting, Reinforcement) — first row of the section band."
          : "Add another description line under an existing activity section."}
      </p>

      <form ref={formRef} className="space-y-4" onSubmit={onSubmit}>
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

        <div className="rounded-lg border border-line bg-gradient-to-br from-teal-50/80 to-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3 text-brand-dark">
            {form.addMode === "section" ? "New activity section" : "Activity line"}
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <label className="block">
              <span className="text-[10px] font-mono uppercase tracking-wider text-steel-muted block mb-1.5">Week</span>
              {weeks.length > 0 ? (
                <Select value={form.weekLabel} onChange={(e) => set({ weekLabel: e.target.value })} required>
                  {weeks.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  value={form.weekLabel}
                  onChange={(e) => set({ weekLabel: e.target.value })}
                  placeholder="Week 50"
                  required
                />
              )}
            </label>
            {form.addMode === "section" && (
              <label className="block">
                <span className="text-[10px] font-mono uppercase tracking-wider text-steel-muted block mb-1.5">Sr. No.</span>
                <Input value={form.srNo} onChange={(e) => set({ srNo: e.target.value })} placeholder="e.g. 12" />
              </label>
            )}
            <label className="block lg:col-span-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-steel-muted block mb-1.5">
                Activity / section *
              </span>
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
                  placeholder="e.g. Concreting"
                  required
                />
              )}
            </label>
            <label className="block lg:col-span-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-steel-muted block mb-1.5">
                Description of activity / material *
              </span>
              <Input
                value={form.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="Material confirmation, slump, cube casting…"
                required
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-mono uppercase tracking-wider text-steel-muted block mb-1.5">
                Frequency of check
              </span>
              <Input value={form.frequency} onChange={(e) => set({ frequency: e.target.value })} placeholder="Daily / Each pour" />
            </label>
            <label className="block">
              <span className="text-[10px] font-mono uppercase tracking-wider text-steel-muted block mb-1.5">
                Code of conformance
              </span>
              <Input
                value={form.codeOfConformance}
                onChange={(e) => set({ codeOfConformance: e.target.value })}
                placeholder="IS / drawing ref"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-mono uppercase tracking-wider text-steel-muted block mb-1.5">Test agency</span>
              <Input value={form.testAgency} onChange={(e) => set({ testAgency: e.target.value })} placeholder="NABL lab / site" />
            </label>
          </div>
        </div>
      </form>
    </RegisterEntryModal>
  );
}
