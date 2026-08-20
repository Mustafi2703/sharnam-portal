import { Badge } from "./ui";
import {
  HSE_REGISTER_REF,
  inspectionFormForKind,
  parseFormDataJson,
  remarksCellClass,
  type InspectionFormRef,
} from "../lib/inspectionRequestForms";

type Row = {
  id: string;
  number: string;
  irNumber?: string | null;
  subject: string;
  status: string;
  rfiKind: string;
  createdAt: string;
  formDataJson?: string | null;
  linkedAssignmentId?: string | null;
  assignedTo?: { fullName: string } | null;
  drawing?: { drawingNumber: string; title?: string } | null;
};

type Props = {
  rows: Row[];
  formRef: InspectionFormRef;
  variant?: "register" | "hse";
  onSelect?: (id: string) => void;
  activeId?: string | null;
  checklistByRowId?: Record<string, string>;
};

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function cell(row: Row, key: string, form: Record<string, string>) {
  switch (key) {
    case "IR No.":
    case "Ref. no.":
    case "Checklist no.":
      return row.irNumber || form.irNumber || form.checklistNo || row.number;
    case "Date raised":
    case "Date of check":
      return form.dateRaised || fmtDate(row.createdAt);
    case "Discipline":
      return form.discipline || "—";
    case "Activity":
    case "Activity checked":
      return form.activityDescription || form.activity || row.subject;
    case "Location / grid":
    case "Area / location":
    case "Location":
      return form.location || "—";
    case "Quantity":
      return form.quantityUnit || "—";
    case "ITP / control point":
      return [form.itpRef, form.controlPoint].filter(Boolean).join(" / ") || "—";
    case "Drawing no. & rev.":
      return form.drawingRef || row.drawing?.drawingNumber || "—";
    case "Linked IR no.":
      return form.linkedIrNo || "—";
    case "Type":
      return row.rfiKind === "SafetyIR" ? "Safety IR — Clearance" : row.rfiKind;
    case "Activity / finding":
      return form.activityDescription || row.subject;
    case "Risk rating":
      return form.riskRating || "—";
    case "Clearance result":
      return form.clearanceResult || "—";
    case "Action required":
      return form.actionRequired || "—";
    case "Status":
      return row.status;
    case "Assignee":
      return row.assignedTo?.fullName || "—";
    default:
      return "—";
  }
}

export function InspectionRegisterTable({ rows, formRef, variant = "register", onSelect, activeId, checklistByRowId }: Props) {
  const columns =
    variant === "hse"
      ? HSE_REGISTER_REF.columns.filter((c) => c !== "Sr.")
      : formRef.registerColumns;
  const showChecklistCol = !!checklistByRowId;

  if (rows.length === 0) {
    return (
      <p className="text-sm text-steel-muted py-6 text-center">
        No entries yet — raise the first {formRef.title} using the form above.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto border border-sand rounded-lg">
      <table className="w-full text-xs min-w-[720px]">
        <thead>
          <tr className="bg-sand/60 text-left">
            {variant === "hse" && <th className="p-2 font-semibold w-10">Sr.</th>}
            {columns.map((c) => (
              <th key={c} className="p-2 font-semibold whitespace-nowrap">
                {c}
              </th>
            ))}
            {showChecklistCol && <th className="p-2 font-semibold whitespace-nowrap">Checklist (master)</th>}
            {variant === "register" && <th className="p-2 font-semibold">Portal ref</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const form = parseFormDataJson(row.formDataJson);
            const active = row.id === activeId;
            return (
              <tr
                key={row.id}
                className={`border-t border-sand/80 ${active ? "bg-brand/5" : "hover:bg-sand/30"} ${onSelect ? "cursor-pointer" : ""}`}
                onClick={() => onSelect?.(row.id)}
              >
                {variant === "hse" && <td className="p-2 text-steel-muted">{idx + 1}</td>}
                {columns.map((c) => {
                  const val = cell(row, c, form);
                  const cls =
                    c === "Status" || c === "Clearance result"
                      ? remarksCellClass(String(val))
                      : "";
                  return (
                    <td key={c} className={`p-2 align-top ${cls}`}>
                      {c === "Status" ? <Badge tone={row.status === "Open" ? "warn" : "ok"}>{val}</Badge> : val}
                    </td>
                  );
                })}
                {showChecklistCol && (
                  <td className="p-2 align-top text-brand-dark font-medium">
                    {checklistByRowId[row.id] || "—"}
                  </td>
                )}
                {variant === "register" && (
                  <td className="p-2 font-mono text-[10px] text-steel-muted">{row.number}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function registerFormRefForTab(tab: string): InspectionFormRef {
  if (tab === "safety-ir" || tab === "hse-register") return inspectionFormForKind("SafetyIR")!;
  if (tab === "activity-checklist") return inspectionFormForKind("ActivityInspection")!;
  return inspectionFormForKind("QualityIR")!;
}
