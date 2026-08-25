import { FormEvent, useRef } from "react";
import { RegisterEntryModal } from "./RegisterEntryModal";
import { Input, Select } from "./ui";

export type CubeAddFormState = {
  srNo: string;
  castDate: string;
  description: string;
  grade: string;
  testAgency: string;
  cubeWeight: string;
  testDate7: string;
  testDate28: string;
  load7: string;
  load28: string;
  strength7: string;
  strength28: string;
  avgStrength: string;
  result: string;
};

type Props = {
  open: boolean;
  busy?: boolean;
  form: CubeAddFormState;
  onChange: (next: CubeAddFormState) => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
};

/** Add cube test line — popup modal; register sheet stays visible behind. */
export function CubeRegisterAddForm({ open, busy, form, onChange, onSubmit, onClose }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const set = (patch: Partial<CubeAddFormState>) => onChange({ ...form, ...patch });

  return (
    <RegisterEntryModal
      open={open}
      title="Add cube test entry"
      onClose={onClose}
      onSave={() => formRef.current?.requestSubmit()}
      saving={busy}
      size="2xl"
      saveLabel="Save cube row"
    >
      <p className="text-sm text-steel-muted">
        New specimen row for the SPDC cube register. Group fields (sr no, cast date, footing) can repeat for multiple
        cubes from the same pour.
      </p>

      <form ref={formRef} className="space-y-4" onSubmit={onSubmit}>
        <div className="rounded-lg border border-line bg-gradient-to-br from-teal-50/80 to-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3 text-brand-dark">Pour / footing</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="block">
              <span className="text-[10px] font-mono uppercase tracking-wider text-steel-muted block mb-1.5">Sr. No.</span>
              <Input value={form.srNo} onChange={(e) => set({ srNo: e.target.value })} placeholder="e.g. 12" />
            </label>
            <label className="block">
              <span className="text-[10px] font-mono uppercase tracking-wider text-steel-muted block mb-1.5">
                Date of casting
              </span>
              <Input type="date" value={form.castDate} onChange={(e) => set({ castDate: e.target.value })} />
            </label>
            <label className="block lg:col-span-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-steel-muted block mb-1.5">
                Description / footing *
              </span>
              <Input
                value={form.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="Footing F1, column C2…"
                required
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-mono uppercase tracking-wider text-steel-muted block mb-1.5">
                Concrete grade
              </span>
              <Input value={form.grade} onChange={(e) => set({ grade: e.target.value })} placeholder="M:25" />
            </label>
            <label className="block lg:col-span-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-steel-muted block mb-1.5">
                Testing agency
              </span>
              <Input value={form.testAgency} onChange={(e) => set({ testAgency: e.target.value })} placeholder="NABL lab / site" />
            </label>
          </div>
        </div>

        <div className="rounded-lg border border-line bg-gradient-to-br from-sand/40 to-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3 text-brand-dark">Test results</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="block">
              <span className="text-[10px] font-mono uppercase tracking-wider text-steel-muted block mb-1.5">
                Weight of cube (kg)
              </span>
              <Input value={form.cubeWeight} onChange={(e) => set({ cubeWeight: e.target.value })} placeholder="8.1" />
            </label>
            <label className="block">
              <span className="text-[10px] font-mono uppercase tracking-wider text-steel-muted block mb-1.5">7-day test date</span>
              <Input type="date" value={form.testDate7} onChange={(e) => set({ testDate7: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-[10px] font-mono uppercase tracking-wider text-steel-muted block mb-1.5">28-day test date</span>
              <Input type="date" value={form.testDate28} onChange={(e) => set({ testDate28: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-[10px] font-mono uppercase tracking-wider text-steel-muted block mb-1.5">Result</span>
              <Select value={form.result} onChange={(e) => set({ result: e.target.value })}>
                {["Pending", "PASS", "FAIL"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            </label>
            <label className="block">
              <span className="text-[10px] font-mono uppercase tracking-wider text-steel-muted block mb-1.5">7-day load (kN)</span>
              <Input value={form.load7} onChange={(e) => set({ load7: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-[10px] font-mono uppercase tracking-wider text-steel-muted block mb-1.5">28-day load (kN)</span>
              <Input value={form.load28} onChange={(e) => set({ load28: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-[10px] font-mono uppercase tracking-wider text-steel-muted block mb-1.5">
                7-day strength (MPa)
              </span>
              <Input value={form.strength7} onChange={(e) => set({ strength7: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-[10px] font-mono uppercase tracking-wider text-steel-muted block mb-1.5">
                28-day strength (MPa)
              </span>
              <Input value={form.strength28} onChange={(e) => set({ strength28: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-[10px] font-mono uppercase tracking-wider text-steel-muted block mb-1.5">
                Average strength (MPa)
              </span>
              <Input value={form.avgStrength} onChange={(e) => set({ avgStrength: e.target.value })} />
            </label>
          </div>
        </div>
      </form>
    </RegisterEntryModal>
  );
}
