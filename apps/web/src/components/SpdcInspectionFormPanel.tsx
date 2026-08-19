import { useMemo, useState } from "react";
import { Button, Card, Input, Select, TextArea } from "./ui";
import {
  buildSpdcBody,
  buildSpdcSubject,
  inspectionFormForKind,
  SPDC_FORM_DEFAULTS,
  type InspectionFormRef,
  type InspectionRfiKind,
} from "../lib/inspectionRequestForms";

type Props = {
  formKind: InspectionRfiKind;
  users: { id: string; fullName: string; role?: string }[];
  qualityIrOptions?: { number: string; label: string }[];
  onSubmit: (payload: {
    subject: string;
    question: string;
    rfiKind: string;
    irNumber: string;
    formDataJson: Record<string, string>;
    assignedToId: string;
  }) => Promise<void>;
  busy?: boolean;
};

function fieldsBySection(ref: InspectionFormRef) {
  const sections: { title: string; fields: InspectionFormRef["fields"] }[] = [];
  let current = "";
  for (const f of ref.fields) {
    const sec = f.section || "Details";
    if (sec !== current) {
      sections.push({ title: sec, fields: [] });
      current = sec;
    }
    sections[sections.length - 1].fields.push(f);
  }
  return sections;
}

/** SPDC-branded raise panel — quality IR, safety IR, activity checklist. */
export function SpdcInspectionFormPanel({ formKind, users, qualityIrOptions = [], onSubmit, busy }: Props) {
  const ref = inspectionFormForKind(formKind);
  const [draft, setDraft] = useState<Record<string, string>>({ ...SPDC_FORM_DEFAULTS });
  const [assignedToId, setAssignedToId] = useState("");
  const [subject, setSubject] = useState("");
  const [question, setQuestion] = useState("");

  const sections = useMemo(() => (ref ? fieldsBySection(ref) : []), [ref]);

  if (!ref) return null;

  function applyTemplate() {
    setSubject(buildSpdcSubject(ref!, draft));
    setQuestion(buildSpdcBody(ref!, draft));
  }

  return (
    <Card className="!p-4 border-brand/20">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] font-mono uppercase text-steel-muted">{ref.docNo}</p>
          <h3 className="font-semibold text-base">{ref.title}</h3>
          <p className="text-xs text-steel-muted mt-1 max-w-2xl">{ref.subtitle}</p>
          <p className="text-[10px] text-steel-muted mt-1 font-mono">Ref: {ref.workbook}</p>
        </div>
        <Button type="button" variant="secondary" className="!text-xs" onClick={applyTemplate}>
          Build subject & body
        </Button>
      </div>

      {sections.map((sec) => (
        <div key={sec.title} className="mb-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-brand mb-2">{sec.title}</h4>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {sec.fields.map((f) => (
              <div key={f.key} className={f.wide ? "sm:col-span-2 lg:col-span-3" : ""}>
                <label className="text-[10px] uppercase text-steel-muted font-semibold">{f.label}</label>
                {f.key === "linkedQualityIrNo" && qualityIrOptions.length > 0 ? (
                  <Select
                    className="mt-0.5"
                    value={draft[f.key] || ""}
                    onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                  >
                    <option value="">Select quality IR (optional)</option>
                    {qualityIrOptions.map((o) => (
                      <option key={o.number} value={o.number}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    className="!py-1 !text-xs mt-0.5"
                    placeholder={f.placeholder}
                    value={draft[f.key] || ""}
                    onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="grid sm:grid-cols-2 gap-2 mb-3">
        <div>
          <label className="text-[10px] uppercase text-steel-muted font-semibold">Assignee</label>
          <Select className="mt-0.5" value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)}>
            <option value="">PMC / matrix assignee</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
                {u.role ? ` · ${u.role}` : ""}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <Input
          required
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <TextArea
          required
          rows={6}
          placeholder="Inspection request body — use Build subject & body from SPDC fields above"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!subject.trim() || !question.trim()) {
            applyTemplate();
          }
          const subj = subject.trim() || buildSpdcSubject(ref, draft);
          const body = question.trim() || buildSpdcBody(ref, draft);
          const irNumber = draft.irNumber || draft.checklistNo || "";
          await onSubmit({
            subject: subj,
            question: body,
            rfiKind: ref.rfiKind,
            irNumber,
            formDataJson: draft,
            assignedToId,
          });
          setDraft({ ...SPDC_FORM_DEFAULTS });
          setSubject("");
          setQuestion("");
          setAssignedToId("");
        }}
      >
        <Button type="submit" disabled={busy}>
          {busy ? "Raising…" : `Raise ${ref.title}`}
        </Button>
      </form>
    </Card>
  );
}
