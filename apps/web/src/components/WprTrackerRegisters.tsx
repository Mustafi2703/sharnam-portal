import { useState } from "react";
import { api } from "../api";
import { Badge, Button, Card, Input, Select, TextArea } from "./ui";
import { RegisterEntryModal } from "./RegisterEntryModal";
import { ReferenceSheetToolbar } from "./ReferenceSheetToolbar";
import { ToolLink } from "./ToolLink";

type Tab = "value" | "procurement" | "pr" | "invoice" | "materials" | "quality";

type Props = {
  projectId: string;
  token?: string | null;
  data: {
    valueAdditions?: any[];
    procurementLines?: any[];
    siteMaterials?: any[];
    prRequisitions?: any[];
    invoiceTrackers?: any[];
    sorStats?: any[];
  } | null;
  canEdit?: boolean;
  onReload: () => void;
  /** Default Progress API. Finance PR / invoices use `/api/finance`. */
  apiBase?: "progress" | "finance";
  visibleTabs?: Tab[];
  hideImport?: boolean;
};

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN");
}

function isoDay(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function inr(n?: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

const EMPTY = {
  value: {
    block: "",
    packageName: "",
    planning: "",
    suggestions: "",
    valueEngineeringPoints: "",
    cost: "",
    timeImpact: "",
    qualityImpact: "",
    approvalAuthority: "Client",
    earlierQuoted: "",
    finalPrice: "",
  },
  procurement: {
    workPackage: "",
    itemDescription: "",
    responsibleStakeholder: "Client",
    contractorName: "",
    targetInquiryDate: "",
    vendorAppointmentDate: "",
    leadTimeDays: "",
    priorityLevel: "1",
    vendorAppointed: "false",
    remarks: "",
  },
  pr: {
    prType: "Service",
    prNumber: "",
    discipline: "",
    qty: "1",
    unit: "",
    rate: "",
    amount: "",
    materialCode: "",
    poNumber: "",
  },
  invoice: {
    workName: "",
    invoiceNumber: "",
    poNumber: "",
    vendorName: "",
    invoiceDate: "",
    amountExclGst: "",
    copStatus: "Open",
    remarks: "",
  },
  materials: {
    recordDate: "",
    materialName: "",
    totalPurchase: "",
    balanceQuantity: "",
    unit: "",
    location: "",
    remarks: "",
  },
  quality: { observation: "", total: "", openCount: "", closedCount: "" },
};

const PATH: Record<Tab, string> = {
  value: "value-additions",
  procurement: "procurement-lines",
  pr: "purchase-requisitions",
  invoice: "invoice-trackers",
  materials: "site-materials",
  quality: "sor-stats",
};

const TITLE: Record<Tab, string> = {
  value: "Value addition / VE",
  procurement: "Procurement tracker line",
  pr: "Purchase requisition",
  invoice: "Invoice processing row",
  materials: "Site material stock",
  quality: "Quality statistic",
};

/** Client WPR tracker registers — popup forms, not inline cells. */
export function WprTrackerRegisters({
  projectId,
  token,
  data,
  canEdit,
  onReload,
  apiBase = "progress",
  visibleTabs,
  hideImport,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [sub, setSub] = useState<Tab>(() => visibleTabs?.[0] || (apiBase === "finance" ? "pr" : "value"));
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>(EMPTY.value);
  const [saving, setSaving] = useState(false);

  const va = data?.valueAdditions || [];
  const proc = data?.procurementLines || [];
  const pr = data?.prRequisitions || [];
  const inv = data?.invoiceTrackers || [];
  const mat = data?.siteMaterials || [];
  const sor = data?.sorStats || [];

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY[sub] });
    setModalOpen(true);
  }

  function openEdit(tab: Tab, row: any) {
    setSub(tab);
    setEditingId(row.id);
    if (tab === "value") {
      setForm({
        block: row.block || "",
        packageName: row.packageName || "",
        planning: row.planning || "",
        suggestions: row.suggestions || "",
        valueEngineeringPoints: row.valueEngineeringPoints || "",
        cost: row.cost != null ? String(row.cost) : "",
        timeImpact: row.timeImpact || "",
        qualityImpact: row.qualityImpact || "",
        approvalAuthority: row.approvalAuthority || "Client",
        earlierQuoted: row.earlierQuoted != null ? String(row.earlierQuoted) : "",
        finalPrice: row.finalPrice != null ? String(row.finalPrice) : "",
      });
    } else if (tab === "procurement") {
      setForm({
        workPackage: row.workPackage || "",
        itemDescription: row.itemDescription || "",
        responsibleStakeholder: row.responsibleStakeholder || "",
        contractorName: row.contractorName || "",
        targetInquiryDate: isoDay(row.targetInquiryDate),
        vendorAppointmentDate: isoDay(row.vendorAppointmentDate),
        leadTimeDays: row.leadTimeDays != null ? String(row.leadTimeDays) : "",
        priorityLevel: String(row.priorityLevel || 1),
        vendorAppointed: row.vendorAppointed ? "true" : "false",
        remarks: row.remarks || "",
      });
    } else if (tab === "pr") {
      setForm({
        prType: row.prType || "Service",
        prNumber: row.prNumber || "",
        discipline: row.discipline || "",
        qty: row.qty != null ? String(row.qty) : "1",
        unit: row.unit || "",
        rate: row.rate != null ? String(row.rate) : "",
        amount: row.amount != null ? String(row.amount) : "",
        materialCode: row.materialCode || "",
        poNumber: row.poNumber || "",
      });
    } else if (tab === "invoice") {
      setForm({
        workName: row.workName || "",
        invoiceNumber: row.invoiceNumber || "",
        poNumber: row.poNumber || "",
        vendorName: row.vendorName || "",
        invoiceDate: isoDay(row.invoiceDate),
        amountExclGst: row.amountExclGst != null ? String(row.amountExclGst) : "",
        copStatus: row.copStatus || "Open",
        remarks: row.remarks || "",
      });
    } else if (tab === "materials") {
      setForm({
        recordDate: isoDay(row.recordDate),
        materialName: row.materialName || "",
        totalPurchase: row.totalPurchase != null ? String(row.totalPurchase) : "",
        balanceQuantity: row.balanceQuantity != null ? String(row.balanceQuantity) : "",
        unit: row.unit || "",
        location: row.location || "",
        remarks: row.remarks || "",
      });
    } else {
      setForm({
        observation: row.observation || "",
        total: row.total != null ? String(row.total) : "",
        openCount: row.openCount != null ? String(row.openCount) : "",
        closedCount: row.closedCount != null ? String(row.closedCount) : "",
      });
    }
    setModalOpen(true);
  }

  function payload() {
    if (sub === "value") {
      return {
        block: form.block,
        packageName: form.packageName,
        planning: form.planning,
        suggestions: form.suggestions,
        valueEngineeringPoints: form.valueEngineeringPoints,
        cost: form.cost,
        timeImpact: form.timeImpact,
        qualityImpact: form.qualityImpact,
        approvalAuthority: form.approvalAuthority,
        earlierQuoted: form.earlierQuoted,
        finalPrice: form.finalPrice,
      };
    }
    if (sub === "procurement") {
      return {
        workPackage: form.workPackage,
        itemDescription: form.itemDescription,
        responsibleStakeholder: form.responsibleStakeholder,
        contractorName: form.contractorName,
        targetInquiryDate: form.targetInquiryDate || null,
        vendorAppointmentDate: form.vendorAppointmentDate || null,
        leadTimeDays: form.leadTimeDays,
        priorityLevel: form.priorityLevel,
        vendorAppointed: form.vendorAppointed === "true",
        remarks: form.remarks,
      };
    }
    if (sub === "pr") {
      return {
        prType: form.prType,
        prNumber: form.prNumber,
        discipline: form.discipline,
        qty: form.qty,
        unit: form.unit,
        rate: form.rate,
        amount: form.amount,
        materialCode: form.materialCode,
        poNumber: form.poNumber,
      };
    }
    if (sub === "invoice") {
      return {
        workName: form.workName,
        invoiceNumber: form.invoiceNumber,
        poNumber: form.poNumber,
        vendorName: form.vendorName,
        invoiceDate: form.invoiceDate || null,
        amountExclGst: form.amountExclGst,
        copStatus: form.copStatus,
        remarks: form.remarks,
      };
    }
    if (sub === "materials") {
      return {
        recordDate: form.recordDate || null,
        materialName: form.materialName,
        totalPurchase: form.totalPurchase,
        balanceQuantity: form.balanceQuantity,
        unit: form.unit,
        location: form.location,
        remarks: form.remarks,
      };
    }
    return {
      observation: form.observation,
      total: form.total,
      openCount: form.openCount,
      closedCount: form.closedCount,
    };
  }

  async function saveRow() {
    if (!token) return;
    setSaving(true);
    setMsg("");
    try {
      const path = `/api/${apiBase}/${projectId}/${PATH[sub]}${editingId ? `/${editingId}` : ""}`;
      await api(path, {
        method: editingId ? "PATCH" : "POST",
        token,
        body: JSON.stringify(payload()),
      });
      setModalOpen(false);
      setEditingId(null);
      onReload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(tab: Tab, id: string) {
    if (!token || !confirm("Delete this tracker row?")) return;
    try {
      await api(`/api/${apiBase}/${projectId}/${PATH[tab]}/${id}`, { method: "DELETE", token });
      onReload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function importPack() {
    if (!token) return;
    setBusy(true);
    setMsg("");
    try {
      const importPath =
        apiBase === "finance"
          ? `/api/finance/${projectId}/import-pr-tracker`
          : `/api/progress/${projectId}/import-wpr-trackers`;
      const out = await api<Record<string, number>>(importPath, {
        method: "POST",
        token,
      });
      setMsg(
        apiBase === "finance"
          ? `Imported PR Tracker — ${out.purchaseRequisitions ?? 0} PRs, ${out.invoiceTrackers ?? 0} invoices (filed to 05.01 / 09.01)`
          : `Imported July 23–29 pack — VE ${out.valueAdditions ?? 0}, PR ${out.purchaseRequisitions ?? 0}, invoices ${out.invoiceTrackers ?? 0}, PvA ${out.activityLines ?? 0}, cashflow ${out.cashflow ?? 0}`
      );
      onReload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  const allTabs: [Tab, string, number][] = [
    ["pr", "PR Tracker", pr.length],
    ["invoice", "Invoice tracker", inv.length],
    ["value", "Value Addition", va.length],
    ["procurement", "Procurement", proc.length],
    ["materials", "Site materials", mat.length],
    ["quality", "Quality stats", sor.length],
  ];
  const tabs = visibleTabs ? allTabs.filter(([id]) => visibleTabs.includes(id)) : allTabs;

  return (
    <div className="space-y-4">
      <Card className="!p-4 bg-sand/40 border-brand/20">
        <p className="font-mono text-[10px] uppercase tracking-wider text-brand mb-1">
          {apiBase === "finance" ? "Finance · commercial trackers" : "WPR client trackers"}
        </p>
        <h3 className="font-semibold text-base">
          {apiBase === "finance" ? "PR Tracker and invoice processing" : "Registers that feed weekly WPR"}
        </h3>
        <p className="text-sm text-steel-muted mt-1 max-w-3xl">
          {apiBase === "finance" ? (
            <>
              Fill PR and invoice rows here — they file to ISO 05.01 / 09.01 and feed{" "}
              <ToolLink to={`/projects/${projectId}/wpr-maker`} className="text-brand font-semibold">
                WPR Maker
              </ToolLink>
              . Material / tax invoices stay on the invoices tab.
            </>
          ) : (
            <>
              Value Addition, procurement, site materials and quality stats. PR and invoices live in{" "}
              <ToolLink to={`/projects/${projectId}/finance?tab=pr-tracker`} className="text-brand font-semibold">
                Finance → PR Tracker
              </ToolLink>
              .
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          {canEdit && !hideImport && (
              <Button type="button" variant="primary" disabled={busy} onClick={() => void importPack()}>
                {busy ? "Importing…" : apiBase === "finance" ? "Import PR Tracker-52" : "Import 23–29 July WPR pack"}
              </Button>
          )}
          <Badge tone="neutral">{pr.length} PR</Badge>
          <Badge tone="neutral">{inv.length} invoices</Badge>
          <Badge tone="neutral">{va.length} VE</Badge>
        </div>
        {msg && <p className="text-xs text-brand mt-2">{msg}</p>}
      </Card>

      <ReferenceSheetToolbar
        sheetLabel={TITLE[sub]}
        rowCount={tabs.find(([key]) => key === sub)?.[2]}
        canEdit={canEdit}
        onAddRow={canEdit ? openAdd : undefined}
        addRowLabel={`+ Add ${TITLE[sub].toLowerCase()}`}
      />

      <div className="flex flex-wrap gap-1.5">
        {tabs.map(([key, label, n]) => (
          <button
            key={key}
            type="button"
            className={`text-xs font-semibold px-3 py-1.5 rounded-md border ${sub === key ? "bg-brand text-white border-brand" : "bg-paper border-line text-steel-muted"}`}
            onClick={() => setSub(key)}
          >
            {label} ({n})
          </button>
        ))}
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          {sub === "value" && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase text-steel-muted border-b border-line bg-sand/30">
                  <th className="py-2 px-3">Sr</th>
                  <th className="py-2 pr-3">Block</th>
                  <th className="py-2 pr-3">Package</th>
                  <th className="py-2 pr-3 min-w-[14rem]">VE points</th>
                  <th className="py-2 pr-3">Cost</th>
                  <th className="py-2 pr-3">Approval</th>
                  <th className="py-2 px-3" />
                </tr>
              </thead>
              <tbody>
                {va.map((r) => (
                  <tr key={r.id} className="border-b border-line/60 hover:bg-sand/20">
                    <td className="py-2 px-3">{r.srNo}</td>
                    <td className="py-2 pr-3">{r.block || "—"}</td>
                    <td className="py-2 pr-3">{r.packageName || "—"}</td>
                    <td className="py-2 pr-3 text-xs">{r.valueEngineeringPoints || r.suggestions || "—"}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{inr(r.cost)}</td>
                    <td className="py-2 pr-3 text-xs">{r.approvalAuthority || r.status || "—"}</td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      {canEdit && (
                        <>
                          <button type="button" className="text-xs font-semibold text-brand mr-2" onClick={() => openEdit("value", r)}>
                            Edit
                          </button>
                          <button type="button" className="text-xs text-steel-muted" onClick={() => void deleteRow("value", r.id)}>
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {!va.length && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-steel-muted text-sm">
                      No value-addition rows — use Add or import the July pack.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {sub === "procurement" && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase text-steel-muted border-b border-line bg-sand/30">
                  <th className="py-2 px-3">Sr</th>
                  <th className="py-2 pr-3">Work package</th>
                  <th className="py-2 pr-3 min-w-[12rem]">Item</th>
                  <th className="py-2 pr-3">Stakeholder</th>
                  <th className="py-2 pr-3">Vendor</th>
                  <th className="py-2 pr-3">Appointed</th>
                  <th className="py-2 px-3" />
                </tr>
              </thead>
              <tbody>
                {proc.map((r) => (
                  <tr key={r.id} className="border-b border-line/60 hover:bg-sand/20">
                    <td className="py-2 px-3">{r.srNo}</td>
                    <td className="py-2 pr-3">{r.workPackage || "—"}</td>
                    <td className="py-2 pr-3 text-xs">{r.itemDescription || "—"}</td>
                    <td className="py-2 pr-3">{r.responsibleStakeholder || "—"}</td>
                    <td className="py-2 pr-3">{r.contractorName || "—"}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={r.vendorAppointed ? "ok" : "warn"}>{r.vendorAppointed ? "Yes" : "No"}</Badge>
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      {canEdit && (
                        <>
                          <button type="button" className="text-xs font-semibold text-brand mr-2" onClick={() => openEdit("procurement", r)}>
                            Edit
                          </button>
                          <button type="button" className="text-xs text-steel-muted" onClick={() => void deleteRow("procurement", r.id)}>
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {!proc.length && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-steel-muted text-sm">
                      No procurement rows — add via popup or import the WPR pack.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {sub === "pr" && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase text-steel-muted border-b border-line bg-sand/30">
                  <th className="py-2 px-3">Sr</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">PR No</th>
                  <th className="py-2 pr-3 min-w-[14rem]">Discipline</th>
                  <th className="py-2 pr-3 text-right">Qty</th>
                  <th className="py-2 pr-3">Unit</th>
                  <th className="py-2 pr-3 text-right">Rate</th>
                  <th className="py-2 pr-3 text-right">Amount</th>
                  <th className="py-2 pr-3">Material</th>
                  <th className="py-2 pr-3">PO</th>
                  <th className="py-2 px-3" />
                </tr>
              </thead>
              <tbody>
                {pr.map((r) => (
                  <tr key={r.id} className="border-b border-line/60 hover:bg-sand/20">
                    <td className="py-2 px-3">{r.srNo}</td>
                    <td className="py-2 pr-3">{r.prType || "—"}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{r.prNumber || "—"}</td>
                    <td className="py-2 pr-3 text-xs">{r.discipline || "—"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.qty}</td>
                    <td className="py-2 pr-3">{r.unit || "—"}</td>
                    <td className="py-2 pr-3 text-right font-mono text-xs">{inr(r.rate)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-xs">{inr(r.amount)}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{r.materialCode || "—"}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{r.poNumber || "—"}</td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      {canEdit && (
                        <>
                          <button type="button" className="text-xs font-semibold text-brand mr-2" onClick={() => openEdit("pr", r)}>
                            Edit
                          </button>
                          <button type="button" className="text-xs text-steel-muted" onClick={() => void deleteRow("pr", r.id)}>
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {!pr.length && (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-steel-muted text-sm">
                      No PR lines — add a requisition in the popup or import PR Tracker-52.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {sub === "invoice" && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase text-steel-muted border-b border-line bg-sand/30">
                  <th className="py-2 px-3">Sr</th>
                  <th className="py-2 pr-3 min-w-[14rem]">Name of work</th>
                  <th className="py-2 pr-3">Invoice No</th>
                  <th className="py-2 pr-3">PO</th>
                  <th className="py-2 pr-3">Vendor</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3 text-right">Amount excl. GST</th>
                  <th className="py-2 pr-3">COP</th>
                  <th className="py-2 px-3" />
                </tr>
              </thead>
              <tbody>
                {inv.map((r) => (
                  <tr key={r.id} className="border-b border-line/60 hover:bg-sand/20">
                    <td className="py-2 px-3">{r.srNo}</td>
                    <td className="py-2 pr-3 text-xs">{r.workName}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{r.invoiceNumber || "—"}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{r.poNumber || "—"}</td>
                    <td className="py-2 pr-3">{r.vendorName || "—"}</td>
                    <td className="py-2 pr-3 text-xs">{fmtDate(r.invoiceDate)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-xs">{inr(r.amountExclGst)}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={/done|certified|paid/i.test(r.copStatus || "") ? "ok" : "warn"}>{r.copStatus || "Open"}</Badge>
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      {canEdit && (
                        <>
                          <button type="button" className="text-xs font-semibold text-brand mr-2" onClick={() => openEdit("invoice", r)}>
                            Edit
                          </button>
                          <button type="button" className="text-xs text-steel-muted" onClick={() => void deleteRow("invoice", r.id)}>
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {!inv.length && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-steel-muted text-sm">
                      No invoice processing rows — add via popup or import the PR Tracker invoice sheet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {sub === "materials" && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase text-steel-muted border-b border-line bg-sand/30">
                  <th className="py-2 px-3">Sr</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Material</th>
                  <th className="py-2 pr-3">Purchased</th>
                  <th className="py-2 pr-3">Balance</th>
                  <th className="py-2 pr-3">Unit</th>
                  <th className="py-2 pr-3">Location</th>
                  <th className="py-2 px-3" />
                </tr>
              </thead>
              <tbody>
                {mat.map((r) => (
                  <tr key={r.id} className="border-b border-line/60 hover:bg-sand/20">
                    <td className="py-2 px-3">{r.srNo}</td>
                    <td className="py-2 pr-3 text-xs">{fmtDate(r.recordDate)}</td>
                    <td className="py-2 pr-3">{r.materialName}</td>
                    <td className="py-2 pr-3">{r.totalPurchase}</td>
                    <td className="py-2 pr-3">{r.balanceQuantity}</td>
                    <td className="py-2 pr-3">{r.unit || "—"}</td>
                    <td className="py-2 pr-3 text-xs">{r.location || "—"}</td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      {canEdit && (
                        <>
                          <button type="button" className="text-xs font-semibold text-brand mr-2" onClick={() => openEdit("materials", r)}>
                            Edit
                          </button>
                          <button type="button" className="text-xs text-steel-muted" onClick={() => void deleteRow("materials", r.id)}>
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {!mat.length && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-steel-muted text-sm">
                      No site material rows — add via popup or import Site Materials.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {sub === "quality" && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase text-steel-muted border-b border-line bg-sand/30">
                  <th className="py-2 px-3">Sr</th>
                  <th className="py-2 pr-3">Observation</th>
                  <th className="py-2 pr-3">Total</th>
                  <th className="py-2 pr-3">Open</th>
                  <th className="py-2 pr-3">Closed</th>
                  <th className="py-2 px-3" />
                </tr>
              </thead>
              <tbody>
                {sor.map((r, i) => (
                  <tr key={r.id || i} className="border-b border-line/60 hover:bg-sand/20">
                    <td className="py-2 px-3">{i + 1}</td>
                    <td className="py-2 pr-3">{r.observation}</td>
                    <td className="py-2 pr-3">{r.total}</td>
                    <td className="py-2 pr-3">{r.openCount}</td>
                    <td className="py-2 pr-3">{r.closedCount}</td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      {canEdit && (
                        <>
                          <button type="button" className="text-xs font-semibold text-brand mr-2" onClick={() => openEdit("quality", r)}>
                            Edit
                          </button>
                          <button type="button" className="text-xs text-steel-muted" onClick={() => void deleteRow("quality", r.id)}>
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {!sor.length && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-steel-muted text-sm">
                      No quality statistics — add via popup or import Quality Statistic.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <RegisterEntryModal
        open={modalOpen && Boolean(canEdit)}
        title={`${editingId ? "Edit" : "Add"} ${TITLE[sub]}`}
        onClose={() => setModalOpen(false)}
        onSave={() => void saveRow()}
        saving={saving}
        size="2xl"
        saveLabel={editingId ? "Save changes" : "Add row"}
      >
        {sub === "value" && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Input placeholder="Block" value={form.block} onChange={(e) => setForm({ ...form, block: e.target.value })} />
            <Input placeholder="Package" value={form.packageName} onChange={(e) => setForm({ ...form, packageName: e.target.value })} />
            <Input placeholder="Planning note" value={form.planning} onChange={(e) => setForm({ ...form, planning: e.target.value })} />
            <Input placeholder="Suggestions" value={form.suggestions} onChange={(e) => setForm({ ...form, suggestions: e.target.value })} />
            <TextArea className="sm:col-span-2" rows={3} placeholder="Value engineering points" value={form.valueEngineeringPoints} onChange={(e) => setForm({ ...form, valueEngineeringPoints: e.target.value })} />
            <Input type="number" placeholder="Cost ₹" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
            <Input placeholder="Approval authority" value={form.approvalAuthority} onChange={(e) => setForm({ ...form, approvalAuthority: e.target.value })} />
            <Input type="number" placeholder="Earlier quoted ₹" value={form.earlierQuoted} onChange={(e) => setForm({ ...form, earlierQuoted: e.target.value })} />
            <Input type="number" placeholder="Final price ₹" value={form.finalPrice} onChange={(e) => setForm({ ...form, finalPrice: e.target.value })} />
          </div>
        )}
        {sub === "procurement" && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Input placeholder="Work package" value={form.workPackage} onChange={(e) => setForm({ ...form, workPackage: e.target.value })} required />
            <Input placeholder="Stakeholder" value={form.responsibleStakeholder} onChange={(e) => setForm({ ...form, responsibleStakeholder: e.target.value })} />
            <TextArea className="sm:col-span-2" rows={2} placeholder="Item description" value={form.itemDescription} onChange={(e) => setForm({ ...form, itemDescription: e.target.value })} />
            <Input placeholder="Vendor / contractor" value={form.contractorName} onChange={(e) => setForm({ ...form, contractorName: e.target.value })} />
            <Select value={form.vendorAppointed} onChange={(e) => setForm({ ...form, vendorAppointed: e.target.value })}>
              <option value="false">Vendor appointed — No</option>
              <option value="true">Vendor appointed — Yes</option>
            </Select>
            <label className="text-xs text-steel-muted">
              Target inquiry
              <Input type="date" value={form.targetInquiryDate} onChange={(e) => setForm({ ...form, targetInquiryDate: e.target.value })} />
            </label>
            <label className="text-xs text-steel-muted">
              Vendor appointment
              <Input type="date" value={form.vendorAppointmentDate} onChange={(e) => setForm({ ...form, vendorAppointmentDate: e.target.value })} />
            </label>
            <Input type="number" placeholder="Lead time (days)" value={form.leadTimeDays} onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value })} />
            <Input type="number" placeholder="Priority" value={form.priorityLevel} onChange={(e) => setForm({ ...form, priorityLevel: e.target.value })} />
            <Input className="sm:col-span-2" placeholder="Remarks" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
          </div>
        )}
        {sub === "pr" && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Select value={form.prType} onChange={(e) => setForm({ ...form, prType: e.target.value })}>
              <option>Service</option>
              <option>Material</option>
              <option>Capex</option>
            </Select>
            <Input placeholder="PR number" value={form.prNumber} onChange={(e) => setForm({ ...form, prNumber: e.target.value })} />
            <Input className="sm:col-span-2" placeholder="Discipline / work description" value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })} />
            <Input type="number" placeholder="Qty" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
            <Input placeholder="Unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            <Input type="number" placeholder="Rate ₹" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
            <Input type="number" placeholder="Amount ₹" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <Input placeholder="Material code" value={form.materialCode} onChange={(e) => setForm({ ...form, materialCode: e.target.value })} />
            <Input placeholder="PO number" value={form.poNumber} onChange={(e) => setForm({ ...form, poNumber: e.target.value })} />
          </div>
        )}
        {sub === "invoice" && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Input className="sm:col-span-2" placeholder="Name of work" value={form.workName} onChange={(e) => setForm({ ...form, workName: e.target.value })} required />
            <Input placeholder="Invoice number" value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} />
            <Input placeholder="PO number" value={form.poNumber} onChange={(e) => setForm({ ...form, poNumber: e.target.value })} />
            <Input placeholder="Vendor" value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })} />
            <label className="text-xs text-steel-muted">
              Invoice date
              <Input type="date" value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} />
            </label>
            <Input type="number" placeholder="Invoice rise excl. GST ₹" value={form.amountExclGst} onChange={(e) => setForm({ ...form, amountExclGst: e.target.value })} />
            <Select value={form.copStatus} onChange={(e) => setForm({ ...form, copStatus: e.target.value })}>
              <option>Open</option>
              <option>Submitted</option>
              <option>Done</option>
              <option>Certified</option>
              <option>Paid</option>
            </Select>
            <Input className="sm:col-span-2" placeholder="Remarks" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
          </div>
        )}
        {sub === "materials" && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Input className="sm:col-span-2" placeholder="Material name" value={form.materialName} onChange={(e) => setForm({ ...form, materialName: e.target.value })} required />
            <label className="text-xs text-steel-muted">
              Record date
              <Input type="date" value={form.recordDate} onChange={(e) => setForm({ ...form, recordDate: e.target.value })} />
            </label>
            <Input placeholder="Unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            <Input type="number" placeholder="Total purchased" value={form.totalPurchase} onChange={(e) => setForm({ ...form, totalPurchase: e.target.value })} />
            <Input type="number" placeholder="Balance qty" value={form.balanceQuantity} onChange={(e) => setForm({ ...form, balanceQuantity: e.target.value })} />
            <Input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <Input placeholder="Remarks" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
          </div>
        )}
        {sub === "quality" && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Input className="sm:col-span-2" placeholder="Observation (Site Observation / NCR / …)" value={form.observation} onChange={(e) => setForm({ ...form, observation: e.target.value })} required />
            <Input type="number" placeholder="Total" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} />
            <Input type="number" placeholder="Open" value={form.openCount} onChange={(e) => setForm({ ...form, openCount: e.target.value })} />
            <Input type="number" placeholder="Closed" value={form.closedCount} onChange={(e) => setForm({ ...form, closedCount: e.target.value })} />
          </div>
        )}
      </RegisterEntryModal>
    </div>
  );
}
