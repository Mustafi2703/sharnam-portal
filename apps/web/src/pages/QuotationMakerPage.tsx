import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { SPDC_OFFICE_ADDRESS } from "@sharnam/shared";
import { Button, Card, Input, PageHeader, Select, TextArea } from "../components/ui";
import { downloadAuthFile } from "../lib/downloadReport";
import { StatusNote } from "../components/StatusNote";

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

type QuotationRow = { description: string; unit: string; qty: number; rate: number; amount: number };
type QuotationSection = { title: string; note?: string; rows: QuotationRow[] };

type Quotation = {
  id: string;
  quotationNo: string;
  clientName: string;
  clientAddress?: string | null;
  clientGst?: string | null;
  scopeSummary?: string | null;
  totalValue?: number | null;
  validityDays?: number | null;
  quotationDate?: string | null;
  currency?: string | null;
  sectionsJson?: string | null;
  status: string;
  projectId?: string | null;
  awardedProjectId?: string | null;
  currentRevisionNo?: number | null;
  attachmentUrl?: string | null;
  attachmentSharePointUrl?: string | null;
  updatedAt?: string;
  revisions?: Revision[];
  log?: LogRow[];
};

function parseSections(raw: string | null | undefined): QuotationSection[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sumSections(sections: QuotationSection[]): number {
  return sections.reduce((s, sec) => s + sec.rows.reduce((r, row) => r + Number(row.amount || 0), 0), 0);
}

function normalizeRow(row: QuotationRow): QuotationRow {
  const qty = Number(row.qty) || 0;
  const rate = Number(row.rate) || 0;
  const amount = row.amount != null && row.amount !== (qty * rate as unknown as number) ? Number(row.amount) || qty * rate : qty * rate;
  return { ...row, qty, rate, amount: Number.isFinite(amount) ? amount : qty * rate };
}

function emptySection(): QuotationSection {
  return { title: "New section", note: "", rows: [{ description: "", unit: "—", qty: 1, rate: 0, amount: 0 }] };
}

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
  if (row.action === "quotation.revise") return "Opened a new version in SharePoint (previous R stays)";
  if (row.action === "quotation.award") return "Awarded — Planning job added to the projects register";
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
  const { token, user } = useAuth();
  const canWrite = ["admin", "office"].includes(user?.role || "");

  const [status, setStatus] = useState<string>("Draft");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState<Quotation | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [details, setDetails] = useState({
    quotationNo: "",
    clientName: "",
    clientAddress: SPDC_OFFICE_ADDRESS,
    clientGst: "",
    scopeSummary: "",
    totalValue: "",
    validityDays: "30",
    quotationDate: "",
    currency: "INR",
  });
  const [sections, setSections] = useState<QuotationSection[]>([]);

  useEffect(() => {
    if (!isEditing) nav("/crm/proposals", { replace: true });
  }, [isEditing, nav]);

  useEffect(() => {
    if (!isEditing || !id) return;
    (async () => {
      const q = await api<Quotation>(`/api/crm/quotations/${id}`, { token });
      setSaved(q);
      setStatus(q.status);
      const loadedSections = parseSections(q.sectionsJson);
      setDetails({
        quotationNo: q.quotationNo || "",
        clientName: q.clientName || "",
        clientAddress: q.clientAddress || SPDC_OFFICE_ADDRESS,
        clientGst: q.clientGst || "",
        scopeSummary: q.scopeSummary || "",
        totalValue: q.totalValue != null ? String(q.totalValue) : "",
        validityDays: q.validityDays != null ? String(q.validityDays) : "30",
        quotationDate: q.quotationDate ? String(q.quotationDate).slice(0, 10) : "",
        currency: q.currency || "INR",
      });
      setSections(loadedSections.length ? loadedSections : []);
    })().catch((err) => setMsg(err instanceof Error ? err.message : "Load failed"));
  }, [id, token, isEditing]);

  if (!isEditing) return null;

  async function saveDetails() {
    if (!saved) return;
    setSaving(true);
    setMsg("");
    try {
      const normalizedSections = sections.map((sec) => ({
        ...sec,
        rows: sec.rows.map((row) => normalizeRow(row)),
      }));
      const computedTotal = sumSections(normalizedSections);
      const totalValue = details.totalValue ? Number(details.totalValue) : computedTotal;
      const r = await api<Quotation>(`/api/crm/quotations/${saved.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          quotationNo: details.quotationNo.trim(),
          clientName: details.clientName.trim(),
          clientAddress: details.clientAddress.trim(),
          clientGst: details.clientGst.trim() || null,
          scopeSummary: details.scopeSummary.trim() || null,
          totalValue,
          validityDays: details.validityDays ? Number(details.validityDays) : 30,
          quotationDate: details.quotationDate || undefined,
          currency: details.currency.trim() || "INR",
          sectionsJson: normalizedSections,
        }),
      });
      setSaved(r);
      setSections(parseSections(r.sectionsJson));
      setDetails((d) => ({ ...d, totalValue: r.totalValue != null ? String(r.totalValue) : d.totalValue }));
      setMsg("Proposal details saved — download .docx or open SharePoint to refresh Word.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
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
      setMsg(`Opened R${r.currentRevisionNo ?? 0} in 05.03 / PMC_Proposals. Previous versions stay on this register.`);
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
      setMsg(`Stored ${file.name} as R${r.currentRevisionNo ?? 0} in SharePoint. Previous versions stay on this register.`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSaving(false);
    }
  }

  async function awardProposal() {
    if (!saved) return;
    setSaving(true);
    setMsg("");
    try {
      const res = await api<{
        quotation: Quotation;
        projectId?: string;
        alreadyAwarded?: boolean;
        project?: { id: string; code: string; status?: string };
      }>(`/api/crm/quotations/${saved.id}/award`, {
        method: "POST",
        token,
        body: JSON.stringify({}),
      });
      const q = await api<Quotation>(`/api/crm/quotations/${saved.id}`, { token });
      setSaved(q);
      setStatus(q.status);
      const code = res.project?.code || "the job";
      setMsg(
        res.alreadyAwarded
          ? `${code} is already on the projects register as Planning.`
          : `${code} is on the projects register as Planning. Continue setup to pick parties and staff.`,
      );
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not award this proposal");
    } finally {
      setSaving(false);
    }
  }

  const href = driveHref(saved);
  const statusOptions = STATUSES.includes(status as (typeof STATUSES)[number])
    ? [...STATUSES]
    : [status, ...STATUSES];
  const isAwarded = (saved?.status || "").toLowerCase() === "awarded";
  const awardedProjectId = saved?.awardedProjectId || saved?.projectId || null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="CRM · Proposal"
        title={saved?.clientName || "Proposal"}
        subtitle="SharePoint PMC format — edit in Word, mark sent, Award to Planning on Projects."
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
        {saved && isAwarded && awardedProjectId && (
          <Link to={`/crm/setup?projectId=${awardedProjectId}&step=project`}>
            <Button type="button">Continue project setup</Button>
          </Link>
        )}
      </div>

      <StatusNote msg={msg} />

      {saved && canWrite && (
        <Card className="!p-4 space-y-3">
          <h3 className="font-semibold text-sm">Proposal details (portal form)</h3>
          <p className="text-[11px] text-steel-muted">
            Client address defaults to the SPDC Vadodara office — update for the client site. Saved fields feed exports and SharePoint metadata.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <Input placeholder="Quotation no." value={details.quotationNo} onChange={(e) => setDetails({ ...details, quotationNo: e.target.value })} />
            <Input placeholder="Client name" value={details.clientName} onChange={(e) => setDetails({ ...details, clientName: e.target.value })} />
            <Input className="sm:col-span-2" placeholder="Client address" value={details.clientAddress} onChange={(e) => setDetails({ ...details, clientAddress: e.target.value })} />
            <Input placeholder="Client GSTIN" value={details.clientGst} onChange={(e) => setDetails({ ...details, clientGst: e.target.value })} />
            <Input type="date" placeholder="Quotation date" value={details.quotationDate} onChange={(e) => setDetails({ ...details, quotationDate: e.target.value })} />
            <Input placeholder="Currency" value={details.currency} onChange={(e) => setDetails({ ...details, currency: e.target.value })} />
            <Input placeholder="Validity (days)" value={details.validityDays} onChange={(e) => setDetails({ ...details, validityDays: e.target.value })} />
            <Input placeholder="Total value (INR)" value={details.totalValue} onChange={(e) => setDetails({ ...details, totalValue: e.target.value })} />
            <TextArea className="sm:col-span-2" rows={3} placeholder="Scope summary" value={details.scopeSummary} onChange={(e) => setDetails({ ...details, scopeSummary: e.target.value })} />
          </div>

          <div className="border-t border-line pt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold text-sm">Commercial sections (portal → HTML export)</h4>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="!py-1 !text-xs"
                  onClick={() => setSections((s) => [...s, emptySection()])}
                >
                  Add section
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="!py-1 !text-xs"
                  onClick={() => {
                    const t = sumSections(sections);
                    setDetails((d) => ({ ...d, totalValue: String(t) }));
                  }}
                >
                  Recalc total from rows
                </Button>
              </div>
            </div>
            {!sections.length ? (
              <p className="text-xs text-steel-muted">
                No sections yet — add sections here or edit in Word; saved JSON feeds Download HTML and summary exports.
              </p>
            ) : null}
            {sections.map((sec, si) => (
              <div key={si} className="rounded-lg border border-line p-3 space-y-2 bg-white">
                <div className="flex flex-wrap gap-2 items-start">
                  <Input
                    className="flex-1 min-w-[200px] font-semibold"
                    placeholder="Section title"
                    value={sec.title}
                    onChange={(e) =>
                      setSections((all) => all.map((s, i) => (i === si ? { ...s, title: e.target.value } : s)))
                    }
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="!py-1 !text-xs shrink-0"
                    onClick={() => setSections((all) => all.filter((_, i) => i !== si))}
                  >
                    Remove section
                  </Button>
                </div>
                <TextArea
                  rows={2}
                  placeholder="Section note (optional)"
                  value={sec.note || ""}
                  onChange={(e) =>
                    setSections((all) => all.map((s, i) => (i === si ? { ...s, note: e.target.value } : s)))
                  }
                />
                <div className="overflow-x-auto scrollbars-visible">
                  <table className="w-full text-xs min-w-[640px]">
                    <thead className="text-steel-muted text-left">
                      <tr>
                        <th className="p-1">Description</th>
                        <th className="p-1 w-16">Unit</th>
                        <th className="p-1 w-16">Qty</th>
                        <th className="p-1 w-24">Rate</th>
                        <th className="p-1 w-24">Amount</th>
                        <th className="p-1 w-12" />
                      </tr>
                    </thead>
                    <tbody>
                      {sec.rows.map((row, ri) => (
                        <tr key={ri} className="border-t border-line/60">
                          <td className="p-1">
                            <Input
                              className="!text-xs"
                              value={row.description}
                              onChange={(e) =>
                                setSections((all) =>
                                  all.map((s, i) =>
                                    i === si
                                      ? {
                                          ...s,
                                          rows: s.rows.map((r, j) => (j === ri ? { ...r, description: e.target.value } : r)),
                                        }
                                      : s,
                                  ),
                                )
                              }
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              className="!text-xs"
                              value={row.unit}
                              onChange={(e) =>
                                setSections((all) =>
                                  all.map((s, i) =>
                                    i === si
                                      ? {
                                          ...s,
                                          rows: s.rows.map((r, j) => (j === ri ? { ...r, unit: e.target.value } : r)),
                                        }
                                      : s,
                                  ),
                                )
                              }
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              className="!text-xs"
                              type="number"
                              value={row.qty}
                              onChange={(e) => {
                                const qty = Number(e.target.value);
                                setSections((all) =>
                                  all.map((s, i) =>
                                    i === si
                                      ? {
                                          ...s,
                                          rows: s.rows.map((r, j) =>
                                            j === ri ? normalizeRow({ ...r, qty, amount: qty * (Number(r.rate) || 0) }) : r,
                                          ),
                                        }
                                      : s,
                                  ),
                                );
                              }}
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              className="!text-xs"
                              type="number"
                              value={row.rate}
                              onChange={(e) => {
                                const rate = Number(e.target.value);
                                setSections((all) =>
                                  all.map((s, i) =>
                                    i === si
                                      ? {
                                          ...s,
                                          rows: s.rows.map((r, j) =>
                                            j === ri ? normalizeRow({ ...r, rate, amount: (Number(r.qty) || 0) * rate }) : r,
                                          ),
                                        }
                                      : s,
                                  ),
                                );
                              }}
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              className="!text-xs"
                              type="number"
                              value={row.amount}
                              onChange={(e) =>
                                setSections((all) =>
                                  all.map((s, i) =>
                                    i === si
                                      ? {
                                          ...s,
                                          rows: s.rows.map((r, j) => (j === ri ? { ...r, amount: Number(e.target.value) || 0 } : r)),
                                        }
                                      : s,
                                  ),
                                )
                              }
                            />
                          </td>
                          <td className="p-1">
                            <button
                              type="button"
                              className="text-[10px] text-danger"
                              onClick={() =>
                                setSections((all) =>
                                  all.map((s, i) => (i === si ? { ...s, rows: s.rows.filter((_, j) => j !== ri) } : s)),
                                )
                              }
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="!py-1 !text-xs"
                  onClick={() =>
                    setSections((all) =>
                      all.map((s, i) =>
                        i === si ? { ...s, rows: [...s.rows, { description: "", unit: "—", qty: 1, rate: 0, amount: 0 }] } : s,
                      ),
                    )
                  }
                >
                  Add row
                </Button>
              </div>
            ))}
          </div>

          <Button type="button" disabled={saving} onClick={() => void saveDetails()}>
            Save proposal details
          </Button>
        </Card>
      )}

      {saved && (
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
                    Open in SharePoint →
                  </Button>
                </a>
              ) : (
                <p className="text-sm text-warn">File link missing — use Download .docx, then re-save to SharePoint.</p>
              )}

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
                    {!isAwarded && saved.status !== "Lost" && (
                      <Button type="button" disabled={saving} onClick={() => void awardProposal()}>
                        Award → projects register
                      </Button>
                    )}
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
