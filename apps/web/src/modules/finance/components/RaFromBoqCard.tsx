import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../../api";
import { Button, Card, Input, Select } from "../../../components/ui";

type Pkg = { packageName: string; discipline: string; billableItems: number; billable: number; items: number };
type Line = {
  lineId: string;
  itemNo: string | null;
  description: string;
  uom: string | null;
  rate: number;
  boqQty: number;
  measuredQty: number;
  prevQty: number;
  thisQty: number;
  amount: number;
};

const inr = (n: number) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;

/**
 * Raise an RA bill from the BOQ: pick a BOQ package → its measured, not-yet-billed quantities priced at BOQ
 * rate (editable) → the bill is created in the package's discipline with a branded abstract as its
 * Submitted workbook. PMC then uploads Corrected → Certified and generates the COP as usual.
 */
export function RaFromBoqCard({
  projectId,
  token,
  disciplines,
  vendorNames,
  reload,
  setMsg,
}: {
  projectId: string;
  token: string | null;
  disciplines: string[];
  vendorNames: string[];
  reload: () => Promise<void> | void;
  setMsg: (m: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [pkg, setPkg] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ raNumber: "", vendorName: "", discipline: "", invoiceNumber: "", invoiceDate: "", gstPct: "18", retentionPct: "5" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    api<Pkg[]>(`/api/finance/${projectId}/ra/from-boq/packages`, { token })
      .then(setPkgs)
      .catch(() => setPkgs([]));
  }, [open, projectId, token]);

  async function pickPackage(name: string) {
    setPkg(name);
    setLines([]);
    setQty({});
    if (!name) return;
    try {
      const out = await api<{ discipline: string; lines: Line[] }>(
        `/api/finance/${projectId}/ra/from-boq/lines?package=${encodeURIComponent(name)}`,
        { token }
      );
      setLines(out.lines);
      setQty(Object.fromEntries(out.lines.map((l) => [l.lineId, String(l.thisQty)])));
      setForm((f) => ({ ...f, discipline: out.discipline }));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not load BOQ lines");
    }
  }

  const amountOf = (l: Line) => Math.max(0, Math.min(Number(qty[l.lineId]) || 0, l.measuredQty - l.prevQty)) * l.rate;
  const total = lines.reduce((n, l) => n + amountOf(l), 0);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const out = await api<{ raNumber: string; discipline: string; lines: Line[] }>(`/api/finance/${projectId}/ra/from-boq`, {
        method: "POST",
        token,
        body: JSON.stringify({
          ...form,
          packageName: pkg,
          qty: Object.fromEntries(Object.entries(qty).map(([k, v]) => [k, Number(v) || 0])),
        }),
      });
      setMsg(`${out.raNumber} raised from BOQ · ${out.discipline} · ${out.lines.length} item(s) — abstract filed as the Submitted workbook. Next: Corrected → Certified → COP.`);
      setOpen(false);
      setPkg("");
      setLines([]);
      setForm({ ...form, raNumber: "", invoiceNumber: "" });
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not raise the bill");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-sm">Raise RA bill from BOQ</h3>
          <p className="text-xs text-steel-muted">
            Measured quantity not yet certified × BOQ rate, per BOQ package. The bill carries the package's discipline.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => setOpen((o) => !o)}>
          {open ? "Close" : "From BOQ"}
        </Button>
      </div>
      {open && (
        <form onSubmit={create} className="mt-3 space-y-3">
          <div className="grid md:grid-cols-4 gap-2">
            <Select value={pkg} onChange={(e) => void pickPackage(e.target.value)} required>
              <option value="">BOQ package…</option>
              {pkgs.map((p) => (
                <option key={p.packageName} value={p.packageName} disabled={!p.billableItems}>
                  {p.packageName} · {p.discipline} · {p.billableItems ? `${p.billableItems} item(s) · ${inr(p.billable)}` : "nothing to bill"}
                </option>
              ))}
            </Select>
            <Select value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })} required>
              <option value="">Discipline…</option>
              {disciplines.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
            <Input placeholder="RA number (RA-07)" value={form.raNumber} onChange={(e) => setForm({ ...form, raNumber: e.target.value })} required />
            <Input
              placeholder="Contractor"
              list="boq-vendor-names"
              value={form.vendorName}
              onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
              required
            />
            <datalist id="boq-vendor-names">
              {vendorNames.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
            <Input label="Tax invoice no." placeholder="Tax invoice no." value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} />
            <Input label="Invoice date" type="date" value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} />
            <Input label="GST %" placeholder="GST %" type="number" value={form.gstPct} onChange={(e) => setForm({ ...form, gstPct: e.target.value })} />
            <Input label="Retention %" placeholder="Retention %" type="number" value={form.retentionPct} onChange={(e) => setForm({ ...form, retentionPct: e.target.value })} />
          </div>
          {lines.length > 0 && (
            <div className="overflow-x-auto max-h-96 border border-line rounded-lg">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-sand">
                  <tr className="text-left">
                    <th className="p-1.5">Item</th>
                    <th className="p-1.5">Description</th>
                    <th className="p-1.5">Unit</th>
                    <th className="p-1.5 text-right">Rate</th>
                    <th className="p-1.5 text-right">BOQ</th>
                    <th className="p-1.5 text-right">Measured</th>
                    <th className="p-1.5 text-right">Previous</th>
                    <th className="p-1.5 text-right">This bill</th>
                    <th className="p-1.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.lineId} className="border-t border-line">
                      <td className="p-1.5">{l.itemNo || "—"}</td>
                      <td className="p-1.5 max-w-xs truncate" title={l.description}>
                        {l.description}
                      </td>
                      <td className="p-1.5">{l.uom || ""}</td>
                      <td className="p-1.5 text-right">{l.rate.toLocaleString("en-IN")}</td>
                      <td className="p-1.5 text-right">{l.boqQty.toLocaleString("en-IN")}</td>
                      <td className="p-1.5 text-right">{l.measuredQty.toLocaleString("en-IN")}</td>
                      <td className="p-1.5 text-right">{l.prevQty.toLocaleString("en-IN")}</td>
                      <td className="p-1.5 text-right">
                        <input
                          type="number"
                          step="any"
                          min={0}
                          max={l.measuredQty - l.prevQty}
                          className="w-24 rounded border border-line px-1 py-0.5 text-right"
                          value={qty[l.lineId] ?? ""}
                          onChange={(e) => setQty({ ...qty, [l.lineId]: e.target.value })}
                        />
                      </td>
                      <td className="p-1.5 text-right">{inr(amountOf(l))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pkg && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                Against bill raised <strong>{inr(total)}</strong> · GST {inr((total * (Number(form.gstPct) || 0)) / 100)} · retention{" "}
                {inr((total * (Number(form.retentionPct) || 0)) / 100)}
              </span>
              <Button type="submit" disabled={busy || !total}>
                {busy ? "Raising…" : "Raise RA bill"}
              </Button>
            </div>
          )}
        </form>
      )}
    </Card>
  );
}
