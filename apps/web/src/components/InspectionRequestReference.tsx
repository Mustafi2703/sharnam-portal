import { useState } from "react";
import { Button, Card, Input } from "./ui";
import {
  RFI_REGISTER_REF,
  inspectionFormForKind,
  type InspectionRfiKind,
} from "../lib/inspectionRequestForms";

type Props = {
  rfiKind: string;
  onApplyTemplate?: (subject: string, question: string) => void;
};

/** Reference panel — SPDC inspection request workbooks for quality / safety RFIs. */
export function InspectionRequestReference({ rfiKind, onApplyTemplate }: Props) {
  const ref = inspectionFormForKind(rfiKind);
  const [draft, setDraft] = useState<Record<string, string>>({});

  if (!ref) return null;

  function buildBody(): string {
    const lines = ref!.bodyTemplate.split("\n");
    const map: Record<string, string> = {
      "Location / grid: ": draft.location || "",
      "Work area: ": draft.location || "",
      "Activity / work: ": draft.activity || "",
      "Activity / task: ": draft.activity || "",
      "Drawing reference: ": draft.drawingRef || "",
      "Requested date / time: ": draft.requestedDate || "",
      "Requested date: ": draft.requestedDate || "",
      "Contractor rep: ": draft.contractorRep || "",
      "Checklist / QAP reference: ": draft.checklistRef || "",
      "Checklist: ": draft.checklistRef || "",
      "Hazard category: ": draft.hazard || "",
      "Work permit / JSA: ": draft.permitRef || "",
    };
    return lines
      .map((line) => (line in map ? `${line}${map[line]}` : line))
      .join("\n");
  }

  function buildSubject(): string {
    const act = draft.activity?.trim();
    if (rfiKind === "QualityInspection") return act ? `RFI — Quality inspection: ${act}` : ref!.subjectHint;
    if (rfiKind === "SafetyChecklist") return act ? `Safety RFI — inspection: ${act}` : ref!.subjectHint;
    return ref!.subjectHint;
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
          <Button
            type="button"
            variant="secondary"
            className="!text-xs"
            onClick={() => onApplyTemplate(buildSubject(), buildBody())}
          >
            Apply to form
          </Button>
        )}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {ref.fields.map((f) => (
          <div key={f.key}>
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
        Register export matches{" "}
        <span className="font-mono">{RFI_REGISTER_REF.workbook}</span> — columns:{" "}
        {RFI_REGISTER_REF.columns.slice(0, 6).join(", ")}…
      </p>
    </Card>
  );
}

export type { InspectionRfiKind };
