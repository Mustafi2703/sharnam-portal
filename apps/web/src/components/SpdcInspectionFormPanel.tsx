import { useEffect, useMemo, useState } from "react";
import { irTypeForPmcRole } from "@sharnam/shared";
import { api } from "../api";
import { useAuth } from "../auth";
import { Button, Card, Input, Select, TextArea } from "./ui";
import {
  buildSpdcBody,
  buildSpdcSubject,
  inspectionFormForKind,
  SPDC_FORM_DEFAULTS,
  type InspectionFormRef,
  type InspectionRfiKind,
} from "../lib/inspectionRequestForms";

type QapPlanLine = {
  id: string;
  srNo?: string | null;
  section?: string | null;
  description?: string | null;
  codeOfConformance?: string | null;
  pmcRole?: string | null;
  isHeader?: boolean;
  canRaise?: boolean;
};

type Props = {
  formKind: InspectionRfiKind;
  projectId?: string;
  token?: string | null;
  initialQapLineId?: string | null;
  lockQapLine?: boolean;
  users: { id: string; fullName: string; role?: string }[];
  qualityIrOptions?: { number: string; label: string }[];
  checklistAssignments?: { id: string; template?: { name?: string } }[];
  masterHref?: string;
  project?: { code?: string; name?: string; clientName?: string | null; contractorName?: string | null };
  onSubmit: (payload: {
    subject: string;
    question: string;
    rfiKind: string;
    irNumber: string;
    formDataJson: Record<string, string>;
    assignedToId: string;
    linkedAssignmentId: string;
    qapLineId?: string;
    onBehalf?: boolean;
    unlinkedReason?: string;
    status?: string;
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
export function SpdcInspectionFormPanel({
  formKind,
  projectId,
  token,
  initialQapLineId,
  lockQapLine = false,
  users,
  qualityIrOptions = [],
  checklistAssignments = [],
  masterHref,
  project,
  onSubmit,
  busy,
}: Props) {
  const { user } = useAuth();
  const isQuality = formKind === "QualityIR";
  const isAdmin = user?.role === "admin";
  const isSpdc = ["admin", "office", "employee", "site_employee"].includes(user?.role || "");
  const ref = inspectionFormForKind(formKind);
  const projectDefaults = useMemo(
    () => ({
      ...SPDC_FORM_DEFAULTS,
      projectFacility: project?.code || project?.name || "",
      employerClient: project?.clientName || "",
      contractorAgency: project?.contractorName || "",
      dateRaised: new Date().toISOString().slice(0, 10),
    }),
    [project]
  );
  const [draft, setDraft] = useState<Record<string, string>>(projectDefaults);
  const [assignedToId, setAssignedToId] = useState("");
  const [linkedAssignmentId, setLinkedAssignmentId] = useState("");
  const [subject, setSubject] = useState("");
  const [question, setQuestion] = useState("");
  const [planLines, setPlanLines] = useState<QapPlanLine[]>([]);
  const [linesMsg, setLinesMsg] = useState("");
  const [qapQuery, setQapQuery] = useState("");
  const [picked, setPicked] = useState<QapPlanLine | null>(null);
  const [noLine, setNoLine] = useState(false);
  const [unlinkedReason, setUnlinkedReason] = useState("");
  const [onBehalf, setOnBehalf] = useState(false);

  useEffect(() => {
    if (!isQuality || !projectId) return;
    let cancelled = false;
    setLinesMsg("");
    void api<{ lines?: QapPlanLine[] }>(`/api/checklist/project/${projectId}/qap/plan-lines`, { token })
      .then((out) => {
        if (!cancelled) setPlanLines(out.lines || []);
      })
      .catch((err) => {
        if (!cancelled) setLinesMsg(err instanceof Error ? err.message : "Could not load QAP lines");
      });
    return () => {
      cancelled = true;
    };
  }, [isQuality, projectId, token]);

  function applyLine(line: QapPlanLine) {
    setPicked(line);
    setNoLine(false);
    setQapQuery("");
    setDraft((d) => ({
      ...d,
      activityDescription: [line.section, line.description].filter(Boolean).join(" - "),
      itpRef: line.srNo ? `QAP ${line.srNo}` : "",
      discipline: line.section || "",
      specClause: line.codeOfConformance || "",
      irType: irTypeForPmcRole(line.pmcRole),
    }));
  }

  useEffect(() => {
    if (!initialQapLineId || picked || !planLines.length) return;
    const hit = planLines.find((l) => l.id === initialQapLineId);
    if (!hit) return;
    if (hit.isHeader || hit.canRaise === false) {
      setLinesMsg("That QAP line is a group header and cannot have an IR.");
      return;
    }
    applyLine(hit);
    // applyLine sets picked; initial id is applied once lines arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQapLineId, planLines]);

  const matches = useMemo(() => {
    const q = qapQuery.trim().toLowerCase();
    if (!q) return [];
    return planLines
      .filter((l) => !l.isHeader && l.canRaise !== false)
      .filter((l) => `${l.srNo || ""} ${l.section || ""} ${l.description || ""}`.toLowerCase().includes(q))
      .slice(0, 20);
  }, [planLines, qapQuery]);

  const readyToCompose = !isQuality || !!picked || (isAdmin && noLine && unlinkedReason.trim().length > 0);
  const laterKeys = new Set(["inspectedOn", "result", "observations", "closedBy", ...(picked ? ["irType"] : [])]);

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

      {isQuality && (
        <div className="mb-4 rounded-lg border border-line bg-sand/30 p-3 space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-brand">QAP line</div>
          {picked ? (
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-brand/40 bg-white px-3 py-1 text-xs">
              <span className="truncate font-semibold text-ink">
                {(picked.section || "Activity") + " - " + (picked.description || "Line")}
                {picked.srNo ? ` · QAP ${picked.srNo}` : ""}
              </span>
              {lockQapLine ? <span className="text-[10px] uppercase text-steel-muted">Locked</span> : (
                <button type="button" className="text-brand font-semibold" onClick={() => setPicked(null)}>
                  Change
                </button>
              )}
            </div>
          ) : (
            <>
              <Input
                placeholder="Search section or description"
                value={qapQuery}
                onChange={(e) => setQapQuery(e.target.value)}
              />
              {linesMsg ? <p className="text-xs text-amber-800">{linesMsg}</p> : null}
              {qapQuery.trim() ? (
                <ul className="max-h-48 overflow-y-auto rounded-lg border border-line bg-white divide-y divide-line">
                  {matches.map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-xs hover:bg-sand/60"
                        onClick={() => applyLine(l)}
                      >
                        <span className="font-semibold">{l.section || "Activity"}</span>
                        <span className="text-steel-muted"> - {l.description || "No description"}</span>
                        {l.srNo ? <span className="font-mono text-steel-muted"> · {l.srNo}</span> : null}
                      </button>
                    </li>
                  ))}
                  {!matches.length ? <li className="px-3 py-2 text-xs text-steel-muted">No matching QAP line.</li> : null}
                </ul>
              ) : (
                <p className="text-xs text-steel-muted">Search the QAP plan, then pick a line before composing this IR.</p>
              )}
            </>
          )}
          {isAdmin && !lockQapLine ? (
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={noLine}
                onChange={(e) => {
                  setNoLine(e.target.checked);
                  if (e.target.checked) setPicked(null);
                }}
              />
              No QAP line
            </label>
          ) : null}
          {noLine ? (
            <Input
              placeholder="Reason this IR has no QAP line"
              value={unlinkedReason}
              onChange={(e) => setUnlinkedReason(e.target.value)}
            />
          ) : null}
          {!readyToCompose ? (
            <p className="text-xs text-steel-muted">
              {isAdmin && noLine ? "Type a reason to compose an IR with no QAP line." : "Choose a QAP line to compose this IR."}
            </p>
          ) : null}
        </div>
      )}

      {readyToCompose && sections.map((sec) => (
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
                ) : f.options ? (
                  <Select
                    className="mt-0.5 !py-1 !text-xs"
                    value={draft[f.key] || ""}
                    disabled={laterKeys.has(f.key)}
                    onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                  >
                    <option value="">{f.placeholder}</option>
                    {f.options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    className="!py-1 !text-xs mt-0.5"
                    type={f.inputType || "text"}
                    placeholder={f.placeholder}
                    value={draft[f.key] || ""}
                    disabled={laterKeys.has(f.key)}
                    onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {readyToCompose && (
      <>
      {isQuality && isSpdc ? (
        <label className="mb-3 flex items-center gap-2 text-xs">
          <input type="checkbox" checked={onBehalf} onChange={(e) => setOnBehalf(e.target.checked)} />
          On behalf of contractor
        </label>
      ) : null}
      <div className="grid sm:grid-cols-2 gap-2 mb-3">
        <div>
          <label className="text-[10px] uppercase text-steel-muted font-semibold">Assignee *</label>
          <Select className="mt-0.5" value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} required>
            <option value="">Select assignee…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
                {u.role ? ` · ${u.role}` : ""}
              </option>
            ))}
          </Select>
          {!users.length && (
            <p className="text-[11px] text-amber-800 mt-1">Add people on project setup or the technical communication matrix first.</p>
          )}
        </div>
        <div>
          <label className="text-[10px] uppercase text-steel-muted font-semibold">Link checklist (optional)</label>
          <Select
            className="mt-0.5"
            value={linkedAssignmentId}
            onChange={(e) => {
              const nextId = e.target.value;
              setLinkedAssignmentId(nextId);
              const picked = checklistAssignments.find((a) => a.id === nextId);
              const templateName = picked?.template?.name || "";
              if (templateName) {
                setDraft((d) => ({
                  ...d,
                  checklistNo: d.checklistNo || templateName,
                  checklistRef: templateName,
                }));
              }
            }}
          >
            <option value="">None — attach from master later</option>
            {checklistAssignments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.template?.name || a.id}
              </option>
            ))}
          </Select>
          {masterHref && (
            <a href={masterHref} className="text-[11px] text-brand font-medium mt-1 inline-block">
              Checklist master →
            </a>
          )}
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <Input
          placeholder="Subject (auto-built from form if blank)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <TextArea
          rows={5}
          placeholder="Request body (auto-built from form if blank)"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const subj = subject.trim() || buildSpdcSubject(ref, draft);
          const body = question.trim() || buildSpdcBody(ref, draft);
          const irNumber = draft.irNumber || draft.checklistNo || "";
          if (!assignedToId) {
            window.alert("Select an assignee from the project directory or communication matrix.");
            return;
          }
          if (!subj || !body) {
            window.alert("Fill the SPDC form fields (or subject/body) before raising.");
            return;
          }
          if (isQuality && !picked && !(isAdmin && noLine && unlinkedReason.trim())) {
            window.alert(isAdmin ? "Choose a QAP line, or tick No QAP line and type a reason." : "Choose a QAP line before saving this IR.");
            return;
          }
          if (isQuality && noLine && !unlinkedReason.trim()) {
            window.alert("Type a reason for an IR with no QAP line.");
            return;
          }
          if (isQuality && isSpdc && user?.role !== "admin" && user?.role !== "vendor" && !onBehalf) {
            window.alert("Tick On behalf of contractor to save this IR.");
            return;
          }
          try {
          await onSubmit({
            subject: subj,
            question: body,
            rfiKind: ref.rfiKind,
            irNumber,
            formDataJson: draft,
            assignedToId,
            linkedAssignmentId,
            qapLineId: picked?.id,
            onBehalf: isQuality && isSpdc ? onBehalf : undefined,
            unlinkedReason: isQuality && noLine ? unlinkedReason.trim() : undefined,
            status: isQuality ? "Draft" : undefined,
          });
          } catch (err) {
            window.alert(err instanceof Error ? err.message : "Could not save this IR");
            return;
          }
          const nextDraft: Record<string, string> = { ...projectDefaults };
          if (picked) {
            nextDraft.activityDescription = [picked.section, picked.description].filter(Boolean).join(" - ");
            nextDraft.itpRef = picked.srNo ? `QAP ${picked.srNo}` : "";
            nextDraft.discipline = picked.section || "";
            nextDraft.specClause = picked.codeOfConformance || "";
            nextDraft.irType = irTypeForPmcRole(picked.pmcRole);
          }
          setDraft(nextDraft);
          setSubject("");
          setQuestion("");
          setAssignedToId("");
          setLinkedAssignmentId("");
        }}
      >
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : isQuality ? "Save draft" : `Raise ${ref.title}`}
        </Button>
      </form>
      </>
      )}
    </Card>
  );
}
