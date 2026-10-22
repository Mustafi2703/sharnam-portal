import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../../../api";
import { downloadAuthFile } from "../../../lib/downloadReport";
import { Badge, Button, Card, Input, Select } from "../../../components/ui";

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
  setMsg,
}: {
  projectId: string;
  token: string;
  canWrite: boolean;
  projectName?: string;
  setMsg: (m: string) => void;
}) {
  const [kind, setKind] = useState<Kind>("TAX_INVOICE");
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
    const list = await api<Saved[]>(`/api/finance/${projectId}/sap-docs`, { token }).catch(() => []);
    setRows(list);
  }, [projectId, token]);

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
      setMsg(
        created.sharePointError
          ? `${label(kind)} ${created.number} saved. SharePoint filing is pending: ${created.sharePointError}`
          : `${label(kind)} ${created.number} filed in ${kind === "PURCHASE_ORDER" ? "05.01 Purchase orders" : "09.01 Tax invoices"}.`,
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

  const folderNote =
    kind === "PURCHASE_ORDER"
      ? "Filed under ISO 05.01 Procurement / Purchase orders."
      : "Filed under ISO 09.01 Commercial / Tax invoices.";

  return (
    <div className="space-y-4">
      <Card className="!p-4">
        <p className="text-xs text-steel-muted">{folderNote} Download the PDF here, or open the SharePoint copy to share it.</p>
      </Card>

      {canWrite && (
        <Card>
          <h3 className="font-semibold text-sm mb-3">Create {label(kind)}</h3>
          <form className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2" onSubmit={(e) => void create(e)}>
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold uppercase text-steel-muted">Document</span>
              <Select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                <option value="TAX_INVOICE">Tax invoice</option>
                <option value="PURCHASE_ORDER">Purchase order</option>
              </Select>
            </label>
            <Input required placeholder={kind === "PURCHASE_ORDER" ? "PO number" : "Invoice number"} value={form.number} onChange={(e) => set("number", e.target.value)} />
            <Input type="date" value={form.docDate} onChange={(e) => set("docDate", e.target.value)} />
            <Input required className="sm:col-span-2" placeholder={kind === "PURCHASE_ORDER" ? "Vendor name" : "Client name"} value={form.partyName} onChange={(e) => set("partyName", e.target.value)} />
            <Input placeholder="GSTIN" value={form.partyGstin} onChange={(e) => set("partyGstin", e.target.value)} />
            <Input className="sm:col-span-2" placeholder="Address" value={form.partyAddress} onChange={(e) => set("partyAddress", e.target.value)} />
            <Input placeholder="PAN" value={form.partyPan} onChange={(e) => set("partyPan", e.target.value)} />
            <Input placeholder="Attention" value={form.partyAttn} onChange={(e) => set("partyAttn", e.target.value)} />
            <Input placeholder={kind === "PURCHASE_ORDER" ? "Vendor number" : "Customer number"} value={form.partyRef} onChange={(e) => set("partyRef", e.target.value)} />
            <Input placeholder={kind === "PURCHASE_ORDER" ? "Their quotation" : "Client PO / WO"} value={form.reference} onChange={(e) => set("reference", e.target.value)} />
            <Input placeholder="Project / site" value={form.projectSite} onChange={(e) => set("projectSite", e.target.value)} />
            <Input placeholder="Site address" value={form.siteAddress} onChange={(e) => set("siteAddress", e.target.value)} />
            <Input placeholder="Place of supply" value={form.placeOfSupply} onChange={(e) => set("placeOfSupply", e.target.value)} />
            <Input placeholder="Contact" value={form.contactName} onChange={(e) => set("contactName", e.target.value)} />
            <Input placeholder="Phone" value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} />
            <Input placeholder="Email" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
            <Input placeholder="Payment terms" value={form.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)} />
            <Input placeholder={kind === "PURCHASE_ORDER" ? "Incoterms" : "Due date"} value={form.dueOrIncoterms} onChange={(e) => set("dueOrIncoterms", e.target.value)} />
            {kind === "TAX_INVOICE" ? (
              <Input placeholder="Period of service" value={form.period} onChange={(e) => set("period", e.target.value)} />
            ) : (
              <Input placeholder="Document type" value={form.billingType} onChange={(e) => set("billingType", e.target.value)} />
            )}
            <Input placeholder="Prepared by" value={form.preparedBy} onChange={(e) => set("preparedBy", e.target.value)} />
            <Input placeholder="Checked by" value={form.checkedBy} onChange={(e) => set("checkedBy", e.target.value)} />
            <Input placeholder="Authorised signatory" value={form.signatory} onChange={(e) => set("signatory", e.target.value)} />
            {kind === "TAX_INVOICE" ? (
              <>
                <Input placeholder="Bank" value={form.bankName} onChange={(e) => set("bankName", e.target.value)} />
                <Input placeholder="Account no." value={form.accountNo} onChange={(e) => set("accountNo", e.target.value)} />
                <Input placeholder="IFSC" value={form.ifsc} onChange={(e) => set("ifsc", e.target.value)} />
              </>
            ) : null}
            <Input placeholder="SPDC GSTIN" value={form.spdcGstin} onChange={(e) => set("spdcGstin", e.target.value)} />
            <Input placeholder="SPDC PAN" value={form.spdcPan} onChange={(e) => set("spdcPan", e.target.value)} />
            <Input className="sm:col-span-2" placeholder="Office address" value={form.officeAddress} onChange={(e) => set("officeAddress", e.target.value)} />

            <div className="sm:col-span-2 lg:col-span-3 space-y-2 pt-2">
              <div className="text-[11px] font-semibold uppercase text-steel-muted">Lines</div>
              {lines.map((line, i) => (
                <div key={i} className="grid sm:grid-cols-6 gap-2">
                  <Input placeholder="Code" value={line.code} onChange={(e) => setLines(lines.map((l, j) => (j === i ? { ...l, code: e.target.value } : l)))} />
                  <Input className="sm:col-span-2" placeholder="Description" value={line.description} onChange={(e) => setLines(lines.map((l, j) => (j === i ? { ...l, description: e.target.value } : l)))} />
                  <Input placeholder="Qty" type="number" value={line.qty} onChange={(e) => setLines(lines.map((l, j) => (j === i ? { ...l, qty: e.target.value } : l)))} />
                  <Input placeholder="Unit" value={line.unit} onChange={(e) => setLines(lines.map((l, j) => (j === i ? { ...l, unit: e.target.value } : l)))} />
                  <Input placeholder="Rate" type="number" value={line.rate} onChange={(e) => setLines(lines.map((l, j) => (j === i ? { ...l, rate: e.target.value } : l)))} />
                  <Input placeholder="HSN / SAC" value={line.hsn} onChange={(e) => setLines(lines.map((l, j) => (j === i ? { ...l, hsn: e.target.value } : l)))} />
                  <Input placeholder="CGST %" type="number" value={line.cgstPct} onChange={(e) => setLines(lines.map((l, j) => (j === i ? { ...l, cgstPct: e.target.value } : l)))} />
                  <Input placeholder="SGST %" type="number" value={line.sgstPct} onChange={(e) => setLines(lines.map((l, j) => (j === i ? { ...l, sgstPct: e.target.value } : l)))} />
                  <Input placeholder="Discount %" type="number" value={line.discountPct} onChange={(e) => setLines(lines.map((l, j) => (j === i ? { ...l, discountPct: e.target.value } : l)))} />
                  <Input placeholder="Note" value={line.detail} onChange={(e) => setLines(lines.map((l, j) => (j === i ? { ...l, detail: e.target.value } : l)))} />
                  {kind === "PURCHASE_ORDER" ? (
                    <Input type="date" value={line.deliveryDate} onChange={(e) => setLines(lines.map((l, j) => (j === i ? { ...l, deliveryDate: e.target.value } : l)))} />
                  ) : null}
                </div>
              ))}
              <Button type="button" variant="secondary" className="!text-xs" onClick={() => setLines([...lines, emptyLine()])}>
                Add line
              </Button>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <Button type="submit" disabled={busy}>{busy ? "Filing…" : "Create PDF and file it"}</Button>
            </div>
          </form>
        </Card>
      )}

      <Card padding={false}>
        <div className="px-4 py-3 border-b border-line bg-sand/40 font-semibold text-sm">Filed tax invoices and purchase orders</div>
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <div>
                <div className="font-medium">{r.number}</div>
                <div className="text-xs text-steel-muted">{r.partyName}{r.storagePath ? ` · ${r.storagePath}` : ""}</div>
              </div>
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
            </li>
          ))}
          {!rows.length && <li className="p-4 text-sm text-steel-muted">No tax invoices or purchase orders yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
