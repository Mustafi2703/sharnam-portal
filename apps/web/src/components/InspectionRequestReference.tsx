import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, Input } from "./ui";
import {
  RFI_REGISTER_REF,
  buildSpdcBody,
  buildSpdcSubject,
  inspectionFormForKind,
  type InspectionRfiKind,
} from "../lib/inspectionRequestForms";

type Props = {
  rfiKind: string;
  projectId?: string;
  onApplyTemplate?: (subject: string, question: string) => void;
};

/** Reference panel — SPDC inspection request workbooks for quality / safety RFIs. */
export function InspectionRequestReference({ rfiKind, projectId, onApplyTemplate }: Props) {
  const ref = inspectionFormForKind(rfiKind);
  const [draft, setDraft] = useState<Record<string, string>>({});

  if (!ref) return null;

  const isSpdcRegisterKind = rfiKind === "QualityIR" || rfiKind === "SafetyIR" || rfiKind === "ActivityInspection";

  if (isSpdcRegisterKind && projectId) {
    const tab =
      rfiKind === "SafetyIR" ? "safety-ir" : rfiKind === "ActivityInspection" ? "activity-checklist" : "quality-ir";
    return (
      <Card className="!p-4 bg-sand/30 border-brand/20">
        <p className="text-sm">
          Use the dedicated{" "}
          <Link className="text-brand underline font-medium" to={`/projects/${projectId}/inspection-register?tab=${tab}`}>
            Inspection register
          </Link>{" "}
          for SPDC {ref.title} — structured form fields and live register.
        </p>
      </Card>
    );
  }

  function apply() {
    onApplyTemplate?.(buildSpdcSubject(ref!, draft), buildSpdcBody(ref!, draft));
  }

  return (
    <Card className="!p-4 bg-sand/30 border-brand/20">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h4 className="font-semibold text-sm">{ref.title}</h4>
          <p className="text-xs text-steel-muted mt-0.5">{ref.subtitle}</p>
          <p className="text-[10px] text-steel-muted mt-1 font-mono">Ref: {ref.workbook}</p>
        </div>
        {onApplyTemplate && (
          <Button type="button" variant="secondary" className="!text-xs" onClick={apply}>
            Apply to form
          </Button>
        )}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {ref.fields.map((f) => (
          <div key={f.key} className={f.wide ? "sm:col-span-2 lg:col-span-3" : ""}>
            <label className="text-[10px] uppercase text-steel-muted font-semibold">{f.label}</label>
            <Input
              className="!py-1 !text-xs mt-0.5"
              placeholder={f.placeholder}
              value={draft[f.key] || ""}
              onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <p className="text-[10px] text-steel-muted mt-3">
        Drawing reference is text-only on inspection forms. For linked drawing files use{" "}
        <span className="font-medium">Ask (PMC RFI)</span> or Drawings coordination.
      </p>
      <p className="text-[10px] text-steel-muted mt-1">
        Register export matches{" "}
        <span className="font-mono">{RFI_REGISTER_REF.workbook}</span> — columns:{" "}
        {RFI_REGISTER_REF.columns.slice(0, 6).join(", ")}…
      </p>
    </Card>
  );
}

export type { InspectionRfiKind };
