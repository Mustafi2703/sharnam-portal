import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../../../api";
import { downloadAuthFile } from "../../../lib/downloadReport";
import { Badge, Button, Card, Input } from "../../../components/ui";

type Kind = "TAX_INVOICE" | "PURCHASE_ORDER";

type Line = {
  code: string;
  description: string;
  detail: string;
  qty: string;
  unit: string;
  rate: string;
  discountPct: string;
  cgstPct: string;
  sgstPct: string;
  hsn: string;
  deliveryDate: string;
};

type Saved = {
  id: string;
  kind: Kind;
  number: string;
  partyName: string;
  docDate?: string | null;
  fileUrl?: string | null;
  sharePointUrl?: string | null;
  storagePath?: string | null;
  taxable?: number;
  total?: number;
};

const emptyLine = (): Line => ({
  code: "",
  description: "",
  detail: "",
  qty: "1",
  unit: "",
  rate: "",
  discountPct: "0",
  cgstPct: "9",
  sgstPct: "9",
  hsn: "",
  deliveryDate: "",
});

function label(kind: Kind) {
  return kind === "PURCHASE_ORDER" ? "Purchase order" : "Tax invoice";
}

function shareHref(row: Saved) {
  return row.sharePointUrl || row.fileUrl || "";
}

function absoluteShare(href: string) {
  if (!href || /^https?:/i.test(href) || typeof window === "undefined") return href;
  return `${window.location.origin}${href.startsWith("/") ? href : `/${href}`}`;
}

export function SapDocumentsPanel({
  projectId,
  token,
  canWrite,
  projectName,
  kind,
  setMsg,
}: {
  projectId: string;
  token: string;
  canWrite: boolean;
  projectName?: string;
  kind: Kind;
  setMsg: (m: string) => void;
}) {
  const isPo = kind === "PURCHASE_ORDER";
  const [rows, setRows] = useState<Saved[]>([]);
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    number: "",
    docDate: "",
    partyName: "",
    partyAddress: "",
    partyGstin: "",
    partyPan: "",
    partyAttn: "",
    partyRef: "",
    reference: "",
    projectSite: projectName || "",
    siteAddress: "",
    placeOfSupply: "Gujarat (24)",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    paymentTerms: "",
    dueOrIncoterms: "",
    billingType: "",
    period: "",
    reverseCharge: "No",
    preparedBy: "",
    checkedBy: "",
    signatory: "",
    bankName: "",
    accountNo: "",
    ifsc: "",
    spdcGstin: "",
    spdcPan: "",
    officeAddress: "",
  });

  const load = useCallback(async () => {
    const list = await api<Saved[]>(`/api/finance/${projectId}/sap-docs?kind=${kind}`, { token }).catch(() => []);
    setRows(list);
  }, [projectId, token, kind]);

  useEffect(() => {
    void load();
  }, [load]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!canWrite || busy) return;
    setBusy(true);
    try {
      const created = await api<Saved & { sharePointError?: string | null }>(`/api/finance/${projectId}/sap-docs`, {
        method: "POST",
        token,
        body: JSON.stringify({
          ...form,
          kind,
          projectSite: form.projectSite || projectName || "",
          lines: lines.filter((l) => l.description.trim() || l.code.trim()),
        }),
      });
      const register = (created as { register?: string }).register;
      setMsg(
        created.sharePointError
          ? `${label(kind)} ${created.number} saved. SharePoint filing is pending: ${created.sharePointError}`
          : `${label(kind)} ${created.number} PDF filed. Logged on the ${register || (isPo ? "purchase order register" : "tax invoice register")}.`,
      );
      setForm((f) => ({ ...f, number: "" }));
      setLines([emptyLine()]);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not create the document");
    } finally {
      setBusy(false);
    }
  }

  const folderNote = isPo
    ? "Purchase orders stay on their own register under ISO 05.01. The PDF is filed with that register. Work orders and RA bills are not changed."
    : "Tax invoices stay on their own register under ISO 09.01. The PDF is filed with that register. Invoice processing is not changed.";

  const preview = lines.reduce(
    (sum, line) => {
      const gross = (Number(line.qty) || 0) * (Number(line.rate) || 0);
      const taxable = gross - gross * ((Number(line.discountPct) || 0) / 100);
      const tax = taxable * (((Number(line.cgstPct) || 0) + (Number(line.sgstPct) || 0)) / 100);
      return { taxable: sum.taxable + taxable, total: sum.total + taxable + tax };
    },
    { taxable: 0, total: 0 },
  );
  const inr = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <Card className="!p-4">
        <p className="text-xs text-steel-muted">{folderNote} Download the PDF here, or open the SharePoint copy to share it.</p>
      </Card>

      {canWrite && (
        <Card>
          <h3 className="font-semibold text-sm mb-1">Create {label(kind)}</h3>
          <p className="text-xs text-steel-muted mb-4">The date on this form is the date written on the register.</p>
          <form className="space-y-5" onSubmit={(e) => void create(e)}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Input required label={isPo ? "PO number" : "Invoice number"} value={form.number} onChange={(e) => set("number", e.target.value)} />
              <Input required label="Date" type="date" value={form.docDate} onChange={(e) => set("docDate", e.target.value)} />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase text-steel-muted mb-2">{kind === "PURCHASE_ORDER" ? "Vendor" : "Bill to"}</div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Input required fieldClassName="sm:col-span-2" label={kind === "PURCHASE_ORDER" ? "Vendor name" : "Client name"} value={form.partyName} onChange={(e) => set("partyName", e.target.value)} />
                <Input label="GSTIN" value={form.partyGstin} onChange={(e) => set("partyGstin", e.target.value)} />
                <Input fieldClassName="sm:col-span-2" label="Address" value={form.partyAddress} onChange={(e) => set("partyAddress", e.target.value)} />
                <Input label="PAN" value={form.partyPan} onChange={(e) => set("partyPan", e.target.value)} />
                <Input label="Attention" value={form.partyAttn} onChange={(e) => set("partyAttn", e.target.value)} />
                <Input label={kind === "PURCHASE_ORDER" ? "Vendor number" : "Customer number"} value={form.partyRef} onChange={(e) => set("partyRef", e.target.value)} />
                <Input label={kind === "PURCHASE_ORDER" ? "Their quotation" : "Client PO / WO"} value={form.reference} onChange={(e) => set("reference", e.target.value)} />
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase text-steel-muted mb-2">{kind === "PURCHASE_ORDER" ? "Deliver to" : "Place of service"}</div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Input label="Project / site" value={form.projectSite} onChange={(e) => set("projectSite", e.target.value)} />
                <Input label="Site address" value={form.siteAddress} onChange={(e) => set("siteAddress", e.target.value)} />
                <Input label="Place of supply" value={form.placeOfSupply} onChange={(e) => set("placeOfSupply", e.target.value)} />
                <Input label="Contact" value={form.contactName} onChange={(e) => set("contactName", e.target.value)} />
                <Input label="Phone" value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} />
                <Input label="Email" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
                <Input label="Payment terms" value={form.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)} />
                <Input label={kind === "PURCHASE_ORDER" ? "Incoterms" : "Due date"} value={form.dueOrIncoterms} onChange={(e) => set("dueOrIncoterms", e.target.value)} />
                {kind === "TAX_INVOICE" ? (
                  <Input label="Period of service" value={form.period} onChange={(e) => set("period", e.target.value)} />
                ) : (
                  <Input label="Document type" value={form.billingType} onChange={(e) => set("billingType", e.target.value)} />
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="text-[11px] font-semibold uppercase text-steel-muted mb-2">Lines</div>
              <table className="w-full text-xs min-w-[860px]">
                <thead>
                  <tr className="text-left text-steel-muted">
                    <th className="pb-1 pr-2 font-medium">Code</th>
                    <th className="pb-1 pr-2 font-medium">Description</th>
                    <th className="pb-1 pr-2 font-medium">Qty</th>
                    <th className="pb-1 pr-2 font-medium">Unit</th>
                    <th className="pb-1 pr-2 font-medium">Rate</th>
                    <th className="pb-1 pr-2 font-medium">HSN</th>
                    <th className="pb-1 pr-2 font-medium">CGST %</th>
                    <th className="pb-1 pr-2 font-medium">SGST %</th>
                    <th className="pb-1 pr-2 font-medium">Disc %</th>
                    {kind === "PURCHASE_ORDER" ? <th className="pb-1 font-medium">Delivery</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => {
                    const setLine = (patch: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
                    return (
                      <tr key={i}>
                        <td className="py-1 pr-2"><Input value={line.code} onChange={(e) => setLine({ code: e.target.value })} /></td>
                        <td className="py-1 pr-2"><Input value={line.description} onChange={(e) => setLine({ description: e.target.value })} /></td>
                        <td className="py-1 pr-2"><Input type="number" value={line.qty} onChange={(e) => setLine({ qty: e.target.value })} /></td>
                        <td className="py-1 pr-2"><Input value={line.unit} onChange={(e) => setLine({ unit: e.target.value })} /></td>
                        <td className="py-1 pr-2"><Input type="number" value={line.rate} onChange={(e) => setLine({ rate: e.target.value })} /></td>
                        <td className="py-1 pr-2"><Input value={line.hsn} onChange={(e) => setLine({ hsn: e.target.value })} /></td>
                        <td className="py-1 pr-2"><Input type="number" value={line.cgstPct} onChange={(e) => setLine({ cgstPct: e.target.value })} /></td>
                        <td className="py-1 pr-2"><Input type="number" value={line.sgstPct} onChange={(e) => setLine({ sgstPct: e.target.value })} /></td>
                        <td className="py-1 pr-2"><Input type="number" value={line.discountPct} onChange={(e) => setLine({ discountPct: e.target.value })} /></td>
                        {kind === "PURCHASE_ORDER" ? (
                          <td className="py-1"><Input type="date" value={line.deliveryDate} onChange={(e) => setLine({ deliveryDate: e.target.value })} /></td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-steel-muted">
                <Button type="button" variant="secondary" className="!text-xs" onClick={() => setLines([...lines, emptyLine()])}>
                  Add line
                </Button>
                <span>Taxable {inr(preview.taxable)} · Total with GST {inr(preview.total)}</span>
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase text-steel-muted mb-2">Sign-off and bank</div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Input label="Prepared by" value={form.preparedBy} onChange={(e) => set("preparedBy", e.target.value)} />
                <Input label="Checked by" value={form.checkedBy} onChange={(e) => set("checkedBy", e.target.value)} />
                <Input label="Authorised signatory" value={form.signatory} onChange={(e) => set("signatory", e.target.value)} />
                {kind === "TAX_INVOICE" ? (
                  <>
                    <Input label="Bank" value={form.bankName} onChange={(e) => set("bankName", e.target.value)} />
                    <Input label="Account no." value={form.accountNo} onChange={(e) => set("accountNo", e.target.value)} />
                    <Input label="IFSC" value={form.ifsc} onChange={(e) => set("ifsc", e.target.value)} />
                  </>
                ) : null}
                <Input label="SPDC GSTIN" value={form.spdcGstin} onChange={(e) => set("spdcGstin", e.target.value)} />
                <Input label="SPDC PAN" value={form.spdcPan} onChange={(e) => set("spdcPan", e.target.value)} />
                <Input fieldClassName="sm:col-span-2" label="Office address" value={form.officeAddress} onChange={(e) => set("officeAddress", e.target.value)} />
              </div>
            </div>
            <Button type="submit" disabled={busy}>{busy ? "Filing…" : "Create PDF and file it"}</Button>
          </form>
        </Card>
      )}

      <Card padding={false}>
        <div className="px-4 py-3 border-b border-line bg-sand/40 font-semibold text-sm">{isPo ? "Purchase order register" : "Tax invoice register"}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-[11px] uppercase text-steel-muted border-b border-line">
                <th className="px-4 py-2 font-semibold">Date</th>
                <th className="px-2 py-2 font-semibold">{isPo ? "PO number" : "Invoice number"}</th>
                <th className="px-2 py-2 font-semibold">{isPo ? "Vendor" : "Client"}</th>
                <th className="px-2 py-2 font-semibold text-right">Taxable</th>
                <th className="px-2 py-2 font-semibold text-right">{isPo ? "Order value" : "Total"}</th>
                <th className="px-4 py-2 font-semibold">PDF</th>
              </tr>
            </thead>
            <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line align-top">
              <td className="px-4 py-3 text-xs">{r.docDate ? new Date(r.docDate).toLocaleDateString("en-IN") : ""}</td>
              <td className="px-2 py-3 font-medium">{r.number}</td>
              <td className="px-2 py-3">
                <div>{r.partyName}</div>
                {r.storagePath ? <div className="text-[11px] text-steel-muted">{r.storagePath}</div> : null}
              </td>
              <td className="px-2 py-3 text-right tabular-nums">{inr(r.taxable || 0)}</td>
              <td className="px-2 py-3 text-right tabular-nums">{inr(r.total || 0)}</td>
              <td className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">{label(r.kind)}</Badge>
                <Button
                  type="button"
                  variant="secondary"
                  className="!text-xs"
                  onClick={() =>
                    void downloadAuthFile(
                      `/api/finance/${projectId}/sap-docs/${r.id}/download.pdf`,
                      token,
                      `${label(r.kind).replace(/ /g, "-")}-${r.number}.pdf`,
                    ).catch((err) => setMsg(err instanceof Error ? err.message : "Download failed"))
                  }
                >
                  Download PDF
                </Button>
                {shareHref(r) ? (
                  <>
                    <a href={shareHref(r)} target="_blank" rel="noreferrer" className="text-xs font-semibold text-brand">
                      {/^https?:/i.test(shareHref(r)) ? "Open in SharePoint" : "Open filed copy"}
                    </a>
                    <Button
                      type="button"
                      variant="secondary"
                      className="!text-xs"
                      onClick={() =>
                        void navigator.clipboard
                          .writeText(absoluteShare(shareHref(r)))
                          .then(() => setMsg(`Link copied for ${r.number}.`))
                          .catch(() => setMsg("Could not copy the link"))
                      }
                    >
                      Copy link
                    </Button>
                  </>
                ) : null}
                {canWrite && !/^https?:/i.test(shareHref(r)) ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="!text-xs"
                    onClick={() =>
                      void api(`/api/finance/${projectId}/sap-docs/${r.id}/file`, { method: "POST", token })
                        .then(() => {
                          setMsg(`${r.number} filed again.`);
                          return load();
                        })
                        .catch((err) => setMsg(err instanceof Error ? err.message : "Could not file"))
                    }
                  >
                    File to SharePoint
                  </Button>
                ) : null}
              </div>
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={6} className="p-4 text-sm text-steel-muted">
                {isPo ? "No purchase orders yet." : "No tax invoices yet."}
              </td>
            </tr>
          )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
