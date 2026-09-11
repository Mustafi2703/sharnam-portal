import { FormEvent, useRef } from "react";
import { applyCubeFormula } from "@sharnam/shared";
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

export function CubeRegisterAddForm({ open, busy, form, onChange, onSubmit, onClose }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const set = (patch: Partial<CubeAddFormState>) => {
    const next = { ...form, ...patch };
    const computed = applyCubeFormula({
      load7: next.load7 ? Number(next.load7) : null,
      load28: next.load28 ? Number(next.load28) : null,
      grade: next.grade,
      result: next.result,
    });
    if (patch.load7 != null || patch.load28 != null || patch.grade != null) {
      next.strength7 = computed.strength7 != null ? String(computed.strength7) : next.strength7;
      next.strength28 = computed.strength28 != null ? String(computed.strength28) : next.strength28;
      next.avgStrength = computed.avgStrength != null ? String(computed.avgStrength) : next.avgStrength;
      next.result = computed.result;
    }
    onChange(next);
  };

  return (
    <RegisterEntryModal
      open={open}
      title="Add cube group (3 cubes)"
      onClose={onClose}
      onSave={() => formRef.current?.requestSubmit()}
      saving={busy}
      size="3xl"
      saveLabel="Save"
    >
      <form ref={formRef} className="space-y-4" onSubmit={onSubmit}>
        <div className="register-form-section">
          <p className="register-form-section__title">Pour / footing — saves as 3 cube specimens</p>
          <div className="register-form-grid register-form-grid--wide">
            <label className="register-form-field">
              <span>Sr. no.</span>
              <Input value={form.srNo} onChange={(e) => set({ srNo: e.target.value })} placeholder="12" />
            </label>
            <label className="register-form-field">
              <span>Cast date</span>
              <Input type="date" value={form.castDate} onChange={(e) => set({ castDate: e.target.value })} />
            </label>
            <label className="register-form-field register-form-field--wide">
              <span>Description / footing</span>
              <Input
                value={form.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="Footing F1, column C2…"
                required
              />
            </label>
            <label className="register-form-field">
              <span>Grade</span>
              <Input value={form.grade} onChange={(e) => set({ grade: e.target.value })} placeholder="M25" />
            </label>
            <label className="register-form-field register-form-field--wide">
              <span>Testing agency</span>
              <Input value={form.testAgency} onChange={(e) => set({ testAgency: e.target.value })} placeholder="NABL lab" />
            </label>
          </div>
        </div>

        <div className="register-form-section">
          <p className="register-form-section__title">Test results</p>
          <div className="register-form-grid register-form-grid--wide">
            <label className="register-form-field">
              <span>Cube weight (kg)</span>
              <Input value={form.cubeWeight} onChange={(e) => set({ cubeWeight: e.target.value })} />
            </label>
            <label className="register-form-field">
              <span>7-day test date</span>
              <Input type="date" value={form.testDate7} onChange={(e) => set({ testDate7: e.target.value })} />
            </label>
            <label className="register-form-field">
              <span>28-day test date</span>
              <Input type="date" value={form.testDate28} onChange={(e) => set({ testDate28: e.target.value })} />
            </label>
            <label className="register-form-field">
              <span>Result</span>
              <Select value={form.result} onChange={(e) => set({ result: e.target.value })}>
                {["Pending", "PASS", "FAIL"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            </label>
            <label className="register-form-field">
              <span>7-day load (kN)</span>
              <Input value={form.load7} onChange={(e) => set({ load7: e.target.value })} />
            </label>
            <label className="register-form-field">
              <span>28-day load (kN)</span>
              <Input value={form.load28} onChange={(e) => set({ load28: e.target.value })} />
            </label>
            <label className="register-form-field">
              <span>7-day strength (MPa) — auto IS 516</span>
              <Input value={form.strength7} readOnly className="bg-sand/50" />
            </label>
            <label className="register-form-field">
              <span>28-day strength (MPa) — auto IS 516</span>
              <Input value={form.strength28} readOnly className="bg-sand/50" />
            </label>
            <label className="register-form-field">
              <span>Average strength (MPa)</span>
              <Input value={form.avgStrength} readOnly className="bg-sand/50" />
            </label>
          </div>
        </div>
      </form>
    </RegisterEntryModal>
  );
}
