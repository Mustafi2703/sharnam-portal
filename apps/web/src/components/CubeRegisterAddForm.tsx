import { FormEvent, useRef } from "react";
import { applyCubeFormula } from "@sharnam/shared";
import { RegisterEntryModal } from "./RegisterEntryModal";
import { Input, Select } from "./ui";

export type CubeSpecimenDraft = { weight: string; load7: string; load28: string };

export type CubeAddFormState = {
  srNo: string;
  castDate: string;
  description: string;
  grade: string;
  testAgency: string;
  testDate7: string;
  testDate28: string;
  result: string;
  cubes: CubeSpecimenDraft[];
};

type Props = {
  open: boolean;
  busy?: boolean;
  form: CubeAddFormState;
  onChange: (next: CubeAddFormState) => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
};

export function emptyCubeForm(): CubeAddFormState {
  return {
    srNo: "",
    castDate: "",
    description: "",
    grade: "M25",
    testAgency: "",
    testDate7: "",
    testDate28: "",
    result: "Pending",
    cubes: [
      { weight: "", load7: "", load28: "" },
      { weight: "", load7: "", load28: "" },
      { weight: "", load7: "", load28: "" },
    ],
  };
}

function mpaFrom(load: string) {
  const n = Number(load);
  if (!load || !Number.isFinite(n) || n <= 0) return "—";
  const v = applyCubeFormula({ load7: n }).strength7;
  return v != null ? String(v) : "—";
}

export function CubeRegisterAddForm({ open, busy, form, onChange, onSubmit, onClose }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const setCube = (i: number, patch: Partial<CubeSpecimenDraft>) => {
    const cubes = form.cubes.map((c, idx) => (idx === i ? { ...c, ...patch } : c));
    onChange({ ...form, cubes });
  };

  return (
    <RegisterEntryModal
      open={open}
      title="Add 3 cubes for this date"
      onClose={onClose}
      onSave={() => formRef.current?.requestSubmit()}
      saving={busy}
      size="3xl"
      saveLabel="Save"
    >
      <form ref={formRef} className="space-y-4" onSubmit={onSubmit}>
        <div className="register-form-section">
          <p className="register-form-section__title">One date / footing entry creates 3 pour cubes (7-day and 28-day loads on the same cube)</p>
          <div className="register-form-grid register-form-grid--wide">
            <label className="register-form-field">
              <span>Sr. no.</span>
              <Input value={form.srNo} onChange={(e) => onChange({ ...form, srNo: e.target.value })} placeholder="12" />
            </label>
            <label className="register-form-field">
              <span>Cast date</span>
              <Input type="date" value={form.castDate} onChange={(e) => onChange({ ...form, castDate: e.target.value })} />
            </label>
            <label className="register-form-field register-form-field--wide">
              <span>Description / footing</span>
              <Input
                value={form.description}
                onChange={(e) => onChange({ ...form, description: e.target.value })}
                placeholder="Footing F1, column C2…"
                required
              />
            </label>
            <label className="register-form-field">
              <span>Grade</span>
              <Input value={form.grade} onChange={(e) => onChange({ ...form, grade: e.target.value })} placeholder="M25" />
            </label>
            <label className="register-form-field">
              <span>Testing agency</span>
              <Input value={form.testAgency} onChange={(e) => onChange({ ...form, testAgency: e.target.value })} placeholder="NABL lab" />
            </label>
            <label className="register-form-field">
              <span>7-day test date</span>
              <Input type="date" value={form.testDate7} onChange={(e) => onChange({ ...form, testDate7: e.target.value })} />
            </label>
            <label className="register-form-field">
              <span>28-day test date</span>
              <Input type="date" value={form.testDate28} onChange={(e) => onChange({ ...form, testDate28: e.target.value })} />
            </label>
            <label className="register-form-field">
              <span>Result (28-day vs grade)</span>
              <Select value={form.result} onChange={(e) => onChange({ ...form, result: e.target.value })}>
                {["Pending", "PASS", "FAIL"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            </label>
          </div>
        </div>

        <div className="register-form-section">
          <p className="register-form-section__title">Three pours — load kN → MPa = kN / 22.5 (IS 516, 150 mm)</p>
          <div className="grid md:grid-cols-3 gap-3">
            {form.cubes.map((c, i) => (
              <div key={i} className="border border-line rounded-xl p-3 space-y-2 bg-sand/30">
                <p className="text-xs font-semibold uppercase tracking-wide">Cube {i + 1}</p>
                <label className="register-form-field">
                  <span>Weight (kg)</span>
                  <Input value={c.weight} onChange={(e) => setCube(i, { weight: e.target.value })} />
                </label>
                <label className="register-form-field">
                  <span>7-day load (kN)</span>
                  <Input value={c.load7} onChange={(e) => setCube(i, { load7: e.target.value })} />
                </label>
                <p className="text-[11px] text-steel-muted">7-day {mpaFrom(c.load7)} MPa</p>
                <label className="register-form-field">
                  <span>28-day load (kN)</span>
                  <Input value={c.load28} onChange={(e) => setCube(i, { load28: e.target.value })} />
                </label>
                <p className="text-[11px] text-steel-muted">28-day {mpaFrom(c.load28)} MPa</p>
              </div>
            ))}
          </div>
        </div>
      </form>
    </RegisterEntryModal>
  );
}
