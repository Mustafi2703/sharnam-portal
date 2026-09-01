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

type Quotation = {
  id: string;
  quotationNo: string;
  clientName: string;
  status: string;
  attachmentUrl?: string | null;
  attachmentSharePointUrl?: string | null;
  updatedAt?: string;
  log?: LogRow[];
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
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (isEditing || !leadIdFromUrl) return;
    (async () => {
      try {
        const lead = await api<{ title?: string; clientName?: string }>(`/api/crm/leads/${leadIdFromUrl}`, { token });
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
    setSaving(true);
    setMsg("");
    try {
      const r = await api<Quotation>("/api/crm/quotations", {
        method: "POST",
        token,
        body: JSON.stringify({ clientName: name, leadId: leadIdFromUrl || undefined }),
      });
      setSaved(r);
      setMsg(`Proposal file created for ${name}. Open it in Drive to edit.`);
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
      setMsg("Status log updated.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  const href = driveHref(saved);
  const statusOptions = STATUSES.includes(status as (typeof STATUSES)[number])
    ? [...STATUSES]
    : [status, ...STATUSES];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="CRM · Proposal"
        title={isEditing ? saved?.clientName || "Proposal" : "New proposal"}
        subtitle="Ask for the client name, drop a copy of the SPDC PMC proposal into the proposals folder, then edit in Drive. Status lives in the log."
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
            onClick={() => void downloadAuthFile(`/api/crm/quotations/${saved.id}/download.docx`, token, `${saved.clientName}-PMC-Proposal.docx`)}
          >
            Download .docx
          </Button>
        )}
      </div>

      {msg && <p className="text-sm text-brand bg-brand-soft px-3 py-2 rounded-sm">{msg}</p>}

      {!isEditing && (
        <Card>
          <h3 className="font-semibold text-sm mb-1">Client name</h3>
          <p className="text-xs text-steel-muted mb-4">
            Creates <code className="font-mono">{clientName.trim() || "Client"}-PMC-Proposal.docx</code> in{" "}
            <code className="font-mono">PMC_Proposals</code>. Edit through the Drive / SharePoint link — not a complete in-app document.
          </p>
          <form className="flex flex-wrap gap-3 items-end" onSubmit={(e) => void createProposal(e)}>
            <label className="text-xs font-semibold uppercase tracking-wider text-steel-muted min-w-[16rem] flex-1">
              Client
              <Input
                className="mt-1"
                placeholder="e.g. Arvind Limited"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
                disabled={!canWrite || saving}
              />
            </label>
            <Button type="submit" disabled={!canWrite || saving}>
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
                Open the <strong>.docx</strong> in SharePoint, fill client details and scope inside Word, then mark status here when sent or finalised.
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
                  <Button type="button" disabled={saving} onClick={() => void saveStatus()}>
                    {saving ? "Saving…" : "Save to status log"}
                  </Button>
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
