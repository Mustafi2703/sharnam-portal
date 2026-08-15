import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../components/ui";
import { downloadAuthFile } from "../lib/downloadReport";

/**
 * Quotation maker — spits out the SPDC PMC proposal format.
 * Sections are editable; totals compute; print CSS renders a clean proposal.
 * Award button converts a quotation → new project (or links an existing one).
 */

type Row = { description: string; unit: string; qty: number; rate: number; amount: number };
type Section = { title: string; note?: string; rows: Row[] };

const SPDC_DEFAULT_SECTIONS: Section[] = [
  {
    title: "Executive Summary",
    note: "Comprehensive Project Development & Management Consultancy — pre-construction, construction, and post-construction with Sharnam portal (DPR/WPR, quality, safety, cost, finance).",
    rows: [
      { description: "Reference SPDC/26-27/INQ/78 · Manufacturing Facility, Satej", unit: "—", qty: 1, rate: 0, amount: 0 },
    ],
  },
  {
    title: "1. Commercial Proposal — Man-Month Fee",
    note: "INR 3,40,000 per man-month (plus GST). Pre/post-construction included. No extra charges for initial 7 months.",
    rows: [
      { description: "Professional PMC fee — per man-month", unit: "INR/mo", qty: 1, rate: 340000, amount: 340000 },
      { description: "Indicative construction phase (18 months)", unit: "months", qty: 18, rate: 340000, amount: 6120000 },
    ],
  },
  {
    title: "2. Complete Scope of Services (included)",
    note: "Initiate · Plan · Execute · Control · Close — aligned to SPDC PMC proposal.",
    rows: [
      { description: "DPR (7 disciplines) + WPR PPTX + MS Project S-curve", unit: "LS", qty: 1, rate: 0, amount: 0 },
      { description: "Quality — QAP, NCR/CAR, cubes, QI checklists", unit: "LS", qty: 1, rate: 0, amount: 0 },
      { description: "Safety dashboard + safety checklists", unit: "LS", qty: 1, rate: 0, amount: 0 },
      { description: "Cost BOQ/MB/BBS + cashflow; Finance PO/RA/COP", unit: "LS", qty: 1, rate: 0, amount: 0 },
      { description: "Handover, DLP & retention management", unit: "LS", qty: 1, rate: 0, amount: 0 },
    ],
  },
  {
    title: "3. Payment Terms",
    note: "Monthly billing on 1st of month. Retention 5% on DLP closure. GST extra.",
    rows: [
      { description: "Mobilisation on award", unit: "INR", qty: 1, rate: 340000, amount: 340000 },
      { description: "Running monthly man-month fee", unit: "INR/mo", qty: 1, rate: 340000, amount: 340000 },
      { description: "Final on handover", unit: "INR", qty: 1, rate: 340000, amount: 340000 },
    ],
  },
];

function money(n: number) {
  return Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export default function QuotationMakerPage() {
  const { id } = useParams<{ id?: string }>();
  const isEditing = !!id;
  const nav = useNavigate();
  const { token, user } = useAuth();
  const canWrite = ["admin", "office"].includes(user?.role || "");

  const [meta, setMeta] = useState({
    quotationNo: "SPDC/26-27/INQ/78",
    clientName: "Arvind Limited",
    clientAddress: "Santej Road, Taluka, near Khatrej, Kalol, Gujarat 382722",
    clientGst: "24AAAAA0000A1Z5",
    scopeSummary:
      "Proposal for Comprehensive Project Development & Management Consultancy — Manufacturing Facility at Satej, Ahmedabad. Digital transparency via Sharnam portal (DPR/WPR, quality, safety, cost, RA/COP).",
    validityDays: 90,
    quotationDate: "2026-07-29",
    currency: "INR",
    status: "Draft",
  });
  const [sections, setSections] = useState<Section[]>(SPDC_DEFAULT_SECTIONS);
  const [saving, setSaving] = useState(false);
  const [exportBusy, setExportBusy] = useState<"html" | "doc" | "docx" | null>(null);
  const [msg, setMsg] = useState("");
  const [saved, setSaved] = useState<any | null>(null);
  const [awardForm, setAwardForm] = useState({ code: "", name: "", projectId: "" });
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    if (!isEditing) return;
    (async () => {
      const q = await api<any>(`/api/crm/quotations/${id}`, { token });
      setSaved(q);
      setMeta({
        quotationNo: q.quotationNo,
        clientName: q.clientName,
        clientAddress: q.clientAddress || "",
        clientGst: q.clientGst || "",
        scopeSummary: q.scopeSummary || "",
        validityDays: q.validityDays,
        quotationDate: (q.quotationDate || "").slice(0, 10),
        currency: q.currency,
        status: q.status,
      });
      if (q.sectionsJson) {
        try {
          setSections(JSON.parse(q.sectionsJson));
        } catch {}
      }
    })();
  }, [id, token, isEditing]);

  useEffect(() => {
    api<any[]>("/api/projects", { token }).then(setProjects).catch(() => setProjects([]));
  }, [token]);

  const total = useMemo(
    () => sections.reduce((s, sec) => s + sec.rows.reduce((r, row) => r + Number(row.amount || 0), 0), 0),
    [sections]
  );

  function setRow(secIdx: number, rowIdx: number, patch: Partial<Row>) {
    setSections((prev) => {
      const next = prev.map((s) => ({ ...s, rows: s.rows.map((r) => ({ ...r })) }));
      next[secIdx].rows[rowIdx] = { ...next[secIdx].rows[rowIdx], ...patch };
      const r = next[secIdx].rows[rowIdx];
      r.amount = Number(r.qty || 0) * Number(r.rate || 0);
      return next;
    });
  }

  function addRow(secIdx: number) {
    setSections((prev) => {
      const next = prev.map((s) => ({ ...s, rows: s.rows.map((r) => ({ ...r })) }));
      next[secIdx].rows.push({ description: "", unit: "LS", qty: 1, rate: 0, amount: 0 });
      return next;
    });
  }
  function removeRow(secIdx: number, rowIdx: number) {
    setSections((prev) => {
      const next = prev.map((s) => ({ ...s, rows: s.rows.map((r) => ({ ...r })) }));
      next[secIdx].rows.splice(rowIdx, 1);
      return next;
    });
  }
  function setSection(secIdx: number, patch: Partial<Section>) {
    setSections((prev) => prev.map((s, i) => (i === secIdx ? { ...s, ...patch } : s)));
  }
  function addSection() {
    setSections((prev) => [...prev, { title: `Section ${prev.length + 1}`, rows: [] }]);
  }

  async function save(e?: FormEvent) {
    e?.preventDefault();
    setSaving(true);
    try {
      const body = { ...meta, totalValue: total, sections };
      if (isEditing) {
        const r = await api<any>(`/api/crm/quotations/${id}`, { method: "PATCH", token, body: JSON.stringify(body) });
        setSaved(r);
        setMsg("Quotation updated.");
      } else {
        const r = await api<any>("/api/crm/quotations", { method: "POST", token, body: JSON.stringify(body) });
        setSaved(r);
        setMsg("Quotation saved.");
        nav(`/quotations/${r.id}`, { replace: true });
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function exportFile(kind: "html" | "doc" | "docx") {
    const qid = saved?.id || id;
    setExportBusy(kind);
    try {
      const safe = meta.quotationNo.replace(/[^a-zA-Z0-9._-]+/g, "-");
      if (kind === "docx") {
        const path = qid ? `/api/crm/quotations/${qid}/download.docx` : "/api/crm/quotations/template.docx";
        const name = qid ? `${safe}-Full-Proposal.docx` : "SPDC-PMC-Full-Proposal-Template.docx";
        await downloadAuthFile(path, token, name);
        if (qid) {
          const refreshed = await api<any>(`/api/crm/quotations/${qid}`, { token }).catch(() => null);
          if (refreshed) setSaved(refreshed);
        }
        setMsg("Full 63-page SPDC proposal .docx downloaded — synced to SharePoint when project is linked.");
        return;
      }
      if (!qid) {
        setMsg("Save the quotation first for summary exports.");
        return;
      }
      if (kind === "html") {
        await downloadAuthFile(`/api/crm/quotations/${qid}/download.html`, token, `${safe}-Proposal.html`);
        setMsg("HTML downloaded — open in browser, edit text, Print → PDF.");
      } else {
        await downloadAuthFile(`/api/crm/quotations/${qid}/download.doc`, token, `${safe}-Proposal.doc`);
        setMsg("Summary Word .doc downloaded — quick commercial summary from maker fields.");
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExportBusy(null);
    }
  }

  async function award() {
    if (!saved) {
      setMsg("Save the quotation first.");
      return;
    }
    try {
      const r = await api<any>(`/api/crm/quotations/${saved.id}/award`, {
        method: "POST",
        token,
        body: JSON.stringify(awardForm),
      });
      setMsg(`Awarded — project id ${r.projectId} created / linked.`);
      setSaved(r.quotation);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Award failed");
    }
  }

  return (
    <div className="space-y-6 print:space-y-2">
      <PageHeader
        eyebrow="CRM · Proposal maker"
        title={isEditing ? `Quotation ${meta.quotationNo}` : "New quotation"}
        subtitle="PMC proposal to client (not contractor bids). Full ~63-page .docx from SPDC template; maker fields export a short commercial summary."
        actions={
          <div className="flex flex-wrap gap-2 no-print">
            <Link to="/crm">
              <Button type="button" variant="secondary">Back to CRM</Button>
            </Link>
            <Link to="/crm/bid-compare">
              <Button type="button" variant="secondary">Bid management →</Button>
            </Link>
            {canWrite && (
              <Button type="button" onClick={() => void save()} disabled={saving}>
                {saving ? "Saving…" : isEditing ? "Save changes" : "Save quotation"}
              </Button>
            )}
            <Button type="button" disabled={!!exportBusy} onClick={() => void exportFile("docx")}>
              {exportBusy === "docx" ? "…" : "Full proposal .docx"}
            </Button>
            {(saved?.id || id) && (
              <>
                <Button type="button" variant="secondary" disabled={!!exportBusy} onClick={() => void exportFile("doc")}>
                  {exportBusy === "doc" ? "…" : "Summary .doc"}
                </Button>
                <Button type="button" variant="secondary" disabled={!!exportBusy} onClick={() => void exportFile("html")}>
                  {exportBusy === "html" ? "…" : "Summary HTML"}
                </Button>
              </>
            )}
            <Button type="button" variant="secondary" onClick={() => window.print()}>Print</Button>
          </div>
        }
      />

      {msg && <p className="text-sm text-brand-dark no-print">{msg}</p>}
      {saved?.attachmentSharePointUrl && (
        <p className="text-sm no-print">
          <a
            href={saved.attachmentSharePointUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand font-semibold"
          >
            Open proposal in SharePoint (05.03 Tender Documents) →
          </a>
        </p>
      )}

      <Card className="print-card">
        <div className="grid md:grid-cols-4 gap-3 no-print">
          <Input placeholder="Quotation no." value={meta.quotationNo} onChange={(e) => setMeta({ ...meta, quotationNo: e.target.value })} />
          <Input type="date" value={meta.quotationDate} onChange={(e) => setMeta({ ...meta, quotationDate: e.target.value })} />
          <Input placeholder="Client" value={meta.clientName} onChange={(e) => setMeta({ ...meta, clientName: e.target.value })} />
          <Input placeholder="Client GST" value={meta.clientGst} onChange={(e) => setMeta({ ...meta, clientGst: e.target.value })} />
          <TextArea rows={2} placeholder="Client address" value={meta.clientAddress} onChange={(e) => setMeta({ ...meta, clientAddress: e.target.value })} className="md:col-span-2" />
          <TextArea rows={2} placeholder="Scope summary (one-line)" value={meta.scopeSummary} onChange={(e) => setMeta({ ...meta, scopeSummary: e.target.value })} className="md:col-span-2" />
          <Select value={meta.status} onChange={(e) => setMeta({ ...meta, status: e.target.value })}>
            {["Draft", "Sent", "Negotiation", "Won", "Lost", "Awarded"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
          <Input placeholder="Validity (days)" type="number" value={meta.validityDays} onChange={(e) => setMeta({ ...meta, validityDays: Number(e.target.value) })} />
        </div>

        <div className="mt-4 print-body">
          <div className="text-center mb-6">
            <div className="text-2xl font-display font-bold">शरणम्&nbsp;· Sharnam PMC</div>
            <div className="text-xs text-steel-muted">Project Management Consultancy · Proposal</div>
            <div className="mt-2 text-sm">
              <strong>Quotation:</strong> {meta.quotationNo || "—"} · <strong>Date:</strong> {meta.quotationDate}
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4 mb-6 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wide text-steel-muted">Client</div>
              <div className="font-semibold">{meta.clientName || "—"}</div>
              <div className="whitespace-pre-wrap text-xs">{meta.clientAddress}</div>
              {meta.clientGst && <div className="text-xs">GST: {meta.clientGst}</div>}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-steel-muted">Scope</div>
              <div className="text-sm whitespace-pre-wrap">{meta.scopeSummary || "—"}</div>
            </div>
          </div>

          {sections.map((sec, si) => (
            <div key={si} className="mb-5">
              <div className="flex items-center gap-2 mb-2 no-print">
                <Input value={sec.title} onChange={(e) => setSection(si, { title: e.target.value })} className="!py-1" />
                <Button type="button" variant="secondary" onClick={() => addRow(si)} className="!py-1 !px-3">+ line</Button>
              </div>
              <div className="print-only text-base font-semibold mb-1">{sec.title}</div>
              {sec.note && (
                <TextArea rows={2} value={sec.note} onChange={(e) => setSection(si, { note: e.target.value })} className="no-print" />
              )}
              {sec.note && <div className="print-only text-xs text-steel-muted mb-2 whitespace-pre-wrap">{sec.note}</div>}
              {sec.rows.length > 0 && (
                <table className="w-full text-xs mt-2 border-t border-line">
                  <thead className="text-left text-steel-muted">
                    <tr>
                      <th className="py-1">Description</th>
                      <th>Unit</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Rate</th>
                      <th className="text-right">Amount</th>
                      <th className="no-print"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sec.rows.map((r, ri) => (
                      <tr key={ri} className="border-t border-line">
                        <td className="py-1 pr-2">
                          <Input value={r.description} onChange={(e) => setRow(si, ri, { description: e.target.value })} className="!py-1 no-print" />
                          <span className="print-only">{r.description}</span>
                        </td>
                        <td>
                          <Input value={r.unit} onChange={(e) => setRow(si, ri, { unit: e.target.value })} className="!py-1 no-print" />
                          <span className="print-only">{r.unit}</span>
                        </td>
                        <td className="text-right">
                          <Input type="number" value={r.qty} onChange={(e) => setRow(si, ri, { qty: Number(e.target.value) })} className="!py-1 text-right no-print" />
                          <span className="print-only">{r.qty}</span>
                        </td>
                        <td className="text-right">
                          <Input type="number" value={r.rate} onChange={(e) => setRow(si, ri, { rate: Number(e.target.value) })} className="!py-1 text-right no-print" />
                          <span className="print-only">{money(r.rate)}</span>
                        </td>
                        <td className="text-right tabular-nums">{money(r.amount)}</td>
                        <td className="no-print">
                          <button type="button" className="text-danger text-[10px]" onClick={() => removeRow(si, ri)}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
          <Button type="button" variant="secondary" onClick={addSection} className="no-print !py-1 !px-3">+ Add section</Button>

          <div className="flex justify-end mt-6">
            <div className="text-right">
              <div className="text-xs text-steel-muted">Grand total (ex GST)</div>
              <div className="text-2xl font-display font-bold">₹ {money(total)}</div>
              <div className="text-[10px] text-steel-muted">Validity: {meta.validityDays} days · GST as applicable</div>
            </div>
          </div>
        </div>
      </Card>

      {isEditing && canWrite && (
        <Card>
          <h3 className="font-semibold mb-2">Award this quotation → project</h3>
          <p className="text-xs text-steel-muted mb-3">Creates a new project (or links to an existing one), then bootstraps the SharePoint ISO tree.</p>
          <div className="grid sm:grid-cols-3 gap-2">
            <Input placeholder="New project code (e.g. SPDC-ARV-01)" value={awardForm.code} onChange={(e) => setAwardForm({ ...awardForm, code: e.target.value })} />
            <Input placeholder="New project name" value={awardForm.name} onChange={(e) => setAwardForm({ ...awardForm, name: e.target.value })} />
            <Select value={awardForm.projectId} onChange={(e) => setAwardForm({ ...awardForm, projectId: e.target.value })}>
              <option value="">…or link existing</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
              ))}
            </Select>
          </div>
          <div className="mt-3">
            <Button type="button" onClick={() => void award()}>Award & create / link</Button>
          </div>
        </Card>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .print-card { border: 0; box-shadow: none; padding: 0; }
        }
        .print-only { display: none; }
        @media print { .print-only { display: inline; } }
      `}</style>
    </div>
  );
}
