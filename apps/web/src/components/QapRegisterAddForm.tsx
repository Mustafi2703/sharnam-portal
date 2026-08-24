import { FormEvent } from "react";
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

/** Add QAP section or line — master-register style form. */
export function QapRegisterAddForm({ open, busy, weeks, sections, form, onChange, onSubmit, onClose }: Props) {
  if (!open) return null;

  const set = (patch: Partial<QapAddFormState>) => onChange({ ...form, ...patch });

  return (
    <div className="sheet-register overflow-hidden shrink-0">
      <div className="sheet-register__head flex-col sm:flex-row sm:items-start gap-2">
        <div>
          <div className="font-display text-sm text-ink">
            {form.addMode === "section" ? "Add QAP activity section" : "Add QAP line under section"}
          </div>
          <p className="text-xs font-normal text-steel-muted mt-1 max-w-3xl">
            {form.addMode === "section"
              ? "Start a new activity group (e.g. Concreting, Reinforcement) — first row of the section band."
              : "Add another description line under an existing activity section."}
          </p>
        </div>
        <Button type="button" variant="ghost" className="!text-xs shrink-0" onClick={onClose}>
          Close
        </Button>
      </div>

      <form className="p-4 space-y-4 bg-paper border-t border-line" onSubmit={onSubmit}>
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
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy}>
            {form.addMode === "section" ? "Save section" : "Save QAP line"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
