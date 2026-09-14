import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../components/ui";
import { downloadAuthFile } from "../lib/downloadReport";

const STATUSES = ["Draft", "Editing", "Sent to client", "Done"] as const;

type LogRow = {
  id: string;
  action: string;
  createdAt: string;
  metaJson?: string | null;
  user?: { fullName?: string | null; email?: string | null } | null;
};

type Revision = {
  id: string;
  revisionNo: number;
  stage: string;
  fileName?: string | null;
  fileUrl?: string | null;
  sharePointUrl?: string | null;
  note?: string | null;
  uploadedAt?: string | null;
};

type Quotation = {
  id: string;
  quotationNo: string;
  clientName: string;
  status: string;
  projectId?: string | null;
  currentRevisionNo?: number | null;
  attachmentUrl?: string | null;
  attachmentSharePointUrl?: string | null;
  updatedAt?: string;
  revisions?: Revision[];
  log?: LogRow[];
};

type LeadPrefill = {
  id: string;
  title?: string;
  clientName?: string;
  projectId?: string | null;
  project?: { id: string; code: string; name: string } | null;
};

function driveHref(q: Quotation | null) {
  if (!q) return null;
  return q.attachmentSharePointUrl || q.attachmentUrl || null;
}

function logLabel(row: LogRow) {
  let meta: { from?: string; to?: string; note?: string; clientName?: string } = {};
  try {
    meta = row.metaJson ? JSON.parse(row.metaJson) : {};
  } catch {
    /* ignore */
  }
  if (row.action === "quotation.create") return `Created proposal file for ${meta.clientName || "client"}`;
  if (row.action === "quotation.revise") return "Opened a new version in the project SharePoint folder";
  if (row.action === "quotation.status") {
    const move = meta.from && meta.to ? `${meta.from} → ${meta.to}` : meta.to || "Status updated";
    return meta.note ? `${move} — ${meta.note}` : move;
  }
  return row.action;
}

export default function QuotationMakerPage() {
  const { id } = useParams<{ id?: string }>();
  const isEditing = !!id;
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const leadIdFromUrl = searchParams.get("leadId") || "";
  const { token, user } = useAuth();
  const canWrite = ["admin", "office"].includes(user?.role || "");

  const [clientName, setClientName] = useState("");
  const [status, setStatus] = useState<string>("Draft");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState<Quotation | null>(null);
  const [leadPrefill, setLeadPrefill] = useState<LeadPrefill | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (isEditing || !leadIdFromUrl) return;
    (async () => {
      try {
        const lead = await api<LeadPrefill>(`/api/crm/leads/${leadIdFromUrl}`, { token });
        setLeadPrefill(lead);
        const name = (lead.clientName || lead.title || "").trim();
        if (name) setClientName(name);
      } catch {
        /* optional prefill */
      }
    })();
  }, [isEditing, leadIdFromUrl, token]);

  useEffect(() => {
    if (!isEditing) return;
    (async () => {
      const q = await api<Quotation>(`/api/crm/quotations/${id}`, { token });
      setSaved(q);
      setClientName(q.clientName);
      setStatus(q.status);
    })().catch((err) => setMsg(err instanceof Error ? err.message : "Load failed"));
  }, [id, token, isEditing]);

  async function createProposal(e: FormEvent) {
    e.preventDefault();
    const name = clientName.trim();
    if (!name) {
      setMsg("Enter the client name to create a proposal file.");
      return;
    }
    if (!leadPrefill?.projectId && !isEditing) {
      setMsg("Convert this lead to an SPDC project first — proposals save to the project ISO folder (05.03 PMC_Proposals).");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const r = await api<Quotation>("/api/crm/quotations", {
        method: "POST",
        token,
        body: JSON.stringify({
          clientName: name,
          leadId: leadIdFromUrl || undefined,
          projectId: leadPrefill?.projectId || undefined,
        }),
      });
      setSaved(r);
      setMsg(`Proposal file created in project ISO folder for ${name}.`);
      nav(`/crm/proposals/${r.id}`, { replace: true });
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not create proposal");
    } finally {
      setSaving(false);
    }
  }

  async function saveStatus() {
    if (!saved) return;
    setSaving(true);
    setMsg("");
    try {
      const r = await api<Quotation>(`/api/crm/quotations/${saved.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ status, note: note.trim() || undefined }),
      });
      setSaved(r);
      setNote("");
      setMsg(status === "Sent to client" ? `R${r.currentRevisionNo ?? 0} marked sent — file kept in SharePoint.` : "Status log updated.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function newVersion() {
    if (!saved) return;
    setSaving(true);
    setMsg("");
    try {
      const r = await api<Quotation>(`/api/crm/quotations/${saved.id}/revise`, {
        method: "POST",
        token,
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      setSaved(r);
      setStatus("Editing");
      setNote("");
      setMsg(`Opened R${r.currentRevisionNo ?? 0} in 05.03 / PMC_Proposals. Previous versions stay.`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not open the next version");
    } finally {
      setSaving(false);
    }
  }

  async function uploadVersion(file: File) {
    if (!saved) return;
    setSaving(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (note.trim()) fd.append("note", note.trim());
      const r = await api<Quotation>(`/api/crm/quotations/${saved.id}/revisions`, {
        method: "POST",
        token,
        body: fd,
      });
      setSaved(r);
      setStatus("Editing");
      setNote("");
      setMsg(`Stored ${file.name} as R${r.currentRevisionNo ?? 0} in the project SharePoint folder.`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSaving(false);
    }
  }

  const href = driveHref(saved);
  const statusOptions = STATUSES.includes(status as (typeof STATUSES)[number])
    ? [...STATUSES]
    : [status, ...STATUSES];

  const needsConvert = !isEditing && leadIdFromUrl && leadPrefill && !leadPrefill.projectId;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="CRM · Proposal"
        title={isEditing ? saved?.clientName || "Proposal" : "New proposal"}
        subtitle="Each send keeps its own R0 / R1 / R2 file in the project SharePoint folder (05.03 / PMC_Proposals). Older versions stay."
      />

      <div className="flex flex-wrap gap-2">
        <Link to="/crm/proposals">
          <Button type="button" variant="secondary">
            ← CRM list
          </Button>
        </Link>
        {saved && (
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              void downloadAuthFile(
                `/api/crm/quotations/${saved.id}/download.docx`,
                token,
                `${saved.clientName}-PMC-Proposal-R${saved.currentRevisionNo ?? 0}.docx`
              )
            }
          >
            Download .docx
          </Button>
        )}
      </div>

      {msg && <p className="text-sm text-brand bg-brand-soft px-3 py-2 rounded-sm">{msg}</p>}

      {needsConvert && (
        <Card className="!p-4 border-warn/40 bg-amber-50/50">
          <p className="text-sm text-ink">
            This lead is not converted yet.{" "}
            <Link to="/crm/leads" className="font-semibold text-brand">
              Go to Leads → Convert to SPDC project
            </Link>{" "}
            before creating a proposal file.
          </p>
        </Card>
      )}

      {!isEditing && (
        <Card>
          <h3 className="font-semibold text-sm mb-1">Client name</h3>
          <p className="text-xs text-steel-muted mb-4">
            Creates <code className="font-mono">{clientName.trim() || "Client"}-PMC-Proposal-R0.docx</code> in{" "}
            <code className="font-mono">05.03 Tender Documents / PMC_Proposals</code> on the linked SPDC project.
          </p>
          {leadPrefill?.projectId && (
            <Badge tone="ok" className="mb-3">
              Project linked — ISO folder will be created on save
            </Badge>
          )}
          <form className="flex flex-wrap gap-3 items-end" onSubmit={(e) => void createProposal(e)}>
            <label className="text-xs font-semibold uppercase tracking-wider text-steel-muted min-w-[16rem] flex-1">
              Client
              <Input
                className="mt-1"
                placeholder="e.g. Arvind Limited"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
                disabled={!canWrite || saving || !!needsConvert}
              />
            </label>
            <Button type="submit" disabled={!canWrite || saving || !!needsConvert}>
              {saving ? "Creating file…" : "Create proposal file"}
            </Button>
          </form>
        </Card>
      )}

      {isEditing && saved && (
        <div className="grid lg:grid-cols-[1fr_340px] gap-4">
          <Card className="!p-0 overflow-hidden border-brand/30">
            <div className="px-5 py-4 bg-brand/5 border-b border-line">
              <div className="text-[10px] uppercase tracking-wider text-steel-muted mb-1">PMC proposal · Word in SharePoint</div>
              <div className="font-display text-xl">{saved.clientName}</div>
              <div className="font-mono text-xs text-steel-muted mt-1">{saved.quotationNo}</div>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-steel-muted">
                Open the current <strong>R{saved.currentRevisionNo ?? 0}</strong> .docx in SharePoint, edit in Word, then mark{" "}
                <strong>Sent to client</strong>. That version stays. Use <strong>New version</strong> for the next send so R0 is never overwritten.
              </p>
              {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className="block">
                  <Button type="button" className="w-full sm:w-auto">
                    Open proposal in SharePoint / Drive →
                  </Button>
                </a>
              ) : (
                <p className="text-sm text-warn">File link missing — use Download .docx below, then re-save to SharePoint.</p>
              )}
              <div className="grid sm:grid-cols-2 gap-2 text-xs text-steel-muted">
                <div className="rounded-lg border border-line p-3 bg-sand/30">
                  <div className="font-mono uppercase text-[10px] mb-1">Folder</div>
                  <code className="font-mono text-[11px]">05.03 Tender Documents / PMC_Proposals</code>
                </div>
                <div className="rounded-lg border border-line p-3 bg-sand/30">
                  <div className="font-mono uppercase text-[10px] mb-1">Workflow</div>
                  Draft → edit in Word → Sent to client → Done
                </div>
              </div>

              {canWrite && (
                <div className="space-y-3 border-t border-line pt-4">
                  <h3 className="text-sm font-semibold">Mark progress</h3>
                  <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                  <TextArea
                    rows={2}
                    placeholder="Optional note (e.g. sent to client 12 Aug, waiting comments)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" disabled={saving} onClick={() => void saveStatus()}>
                      {saving ? "Saving…" : "Save to status log"}
                    </Button>
                    <Button type="button" variant="secondary" disabled={saving} onClick={() => void newVersion()}>
                      New version (R{(saved.currentRevisionNo ?? 0) + 1})
                    </Button>
                  </div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-steel-muted block">
                    Or upload the sent copy
                    <Input
                      className="mt-1"
                      type="file"
                      accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      disabled={saving}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) void uploadVersion(file);
                      }}
                    />
                  </label>
                </div>
              )}

              {(saved.revisions || []).length > 0 && (
                <div className="border-t border-line pt-4 space-y-2">
                  <h3 className="text-sm font-semibold">Versions in SharePoint</h3>
                  <ul className="space-y-2">
                    {(saved.revisions || []).map((rev) => {
                      const href = rev.sharePointUrl || rev.fileUrl;
                      return (
                        <li key={rev.id} className="rounded-lg border border-line px-3 py-2 text-sm flex items-start justify-between gap-3">
                          <div>
                            <div className="font-mono text-xs font-semibold">R{rev.revisionNo} · {rev.stage}</div>
                            <div className="text-xs text-steel-muted">{rev.fileName || "PMC proposal"}</div>
                            {rev.note ? <div className="text-xs text-steel-muted mt-0.5">{rev.note}</div> : null}
                          </div>
                          {href ? (
                            <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-brand shrink-0">
                              Open →
                            </a>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </Card>

          <Card padding={false} className="flex flex-col max-h-[32rem]">
            <div className="px-4 py-3 border-b border-line font-semibold text-sm shrink-0">Status log</div>
            <ul className="divide-y overflow-y-auto flex-1">
              {(saved.log || []).map((row) => (
                <li key={row.id} className="px-4 py-3 text-sm">
                  <div className="font-medium">{logLabel(row)}</div>
                  <div className="text-xs text-steel-muted mt-0.5">
                    {row.user?.fullName || row.user?.email || "System"} ·{" "}
                    {new Date(row.createdAt).toLocaleString("en-IN")}
                  </div>
                </li>
              ))}
              {!(saved.log || []).length && (
                <li className="px-4 py-6 text-sm text-steel-muted">No log entries yet.</li>
              )}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
