import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { isHrApprover } from "../lib/driveAccess";
import { Badge, Button, Card, Input, Select } from "./ui";

export type VoucherLine = {
  date?: string;
  particular: string;
  qty?: string;
  rate?: string;
  amount: string;
  category?: string;
};

export type VoucherRow = {
  id: string;
  voucherNo: string;
  voucherDate: string;
  category: string;
  description: string;
  amount: number;
  status: string;
  user?: { fullName?: string };
  approver?: { fullName?: string } | null;
  project?: { id?: string; code?: string; name?: string } | null;
  particulars?: VoucherLine[];
};

const CATEGORIES = ["Site", "Travel", "Petty cash", "Conveyance", "Food", "Material", "Fuel", "Other"];

function emptyLine(date: string): VoucherLine {
  return { date, particular: "", qty: "1", rate: "", amount: "", category: "Site" };
}

function lineAmount(line: VoucherLine) {
  const qty = Number(line.qty);
  const rate = Number(line.rate);
  if (Number.isFinite(qty) && Number.isFinite(rate) && qty > 0 && rate > 0) return qty * rate;
  const amount = Number(line.amount);
  return Number.isFinite(amount) ? amount : 0;
}

type Props = {
  variant?: "full" | "daily";
  defaultProjectId?: string;
  title?: string;
};

/** Employee / site expense voucher with line items. HR Head approves. */
export function ExpenseVoucherPanel({ variant = "full", defaultProjectId, title }: Props) {
  const { token, user } = useAuth();
  const canApprove = isHrApprover(user);
  const isDaily = variant === "daily";
  const today = new Date().toISOString().slice(0, 10);
  const [rows, setRows] = useState<VoucherRow[]>([]);
  const [projects, setProjects] = useState<{ id: string; code: string; name: string }[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    voucherDate: today,
    category: "Site",
    description: "",
    projectId: defaultProjectId || "",
  });
  const [lines, setLines] = useState<VoucherLine[]>([emptyLine(today)]);

  const load = useCallback(async () => {
    const [list, proj] = await Promise.all([
      api<VoucherRow[]>(
        defaultProjectId ? `/api/hrm/vouchers?projectId=${encodeURIComponent(defaultProjectId)}` : "/api/hrm/vouchers",
        { token }
      ).catch(() => []),
      api<{ id: string; code: string; name: string }[]>("/api/projects", { token }).catch(() => []),
    ]);
    setRows(list);
    setProjects(proj);
    if (!form.projectId && (defaultProjectId || proj.length === 1)) {
      setForm((f) => ({ ...f, projectId: defaultProjectId || proj[0]?.id || f.projectId }));
    }
  }, [token, defaultProjectId, form.projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (defaultProjectId) setForm((f) => ({ ...f, projectId: defaultProjectId }));
  }, [defaultProjectId]);

  const total = useMemo(() => lines.reduce((s, l) => s + lineAmount(l), 0), [lines]);

  function patchLine(index: number, patch: Partial<VoucherLine>) {
    setLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line;
        const next = { ...line, ...patch };
        const qty = Number(next.qty);
        const rate = Number(next.rate);
        if (Number.isFinite(qty) && Number.isFinite(rate) && qty > 0 && rate > 0) {
          next.amount = String(Math.round(qty * rate * 100) / 100);
        }
        return next;
      })
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const particulars = lines
      .map((l) => ({
        date: l.date || form.voucherDate,
        particular: l.particular.trim(),
        qty: Number(l.qty) || 0,
        rate: Number(l.rate) || 0,
        amount: lineAmount(l),
        category: l.category || form.category,
      }))
      .filter((l) => l.particular && l.amount > 0);
    if (!particulars.length) {
      setMsg("Add at least one line item with particulars and amount.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      await api("/api/hrm/vouchers", {
        method: "POST",
        token,
        body: JSON.stringify({
          voucherDate: form.voucherDate,
          category: form.category,
          description: form.description.trim() || particulars.map((l) => l.particular).join("; "),
          amount: total,
          projectId: form.projectId || undefined,
          particulars,
        }),
      });
      setForm({
        voucherDate: today,
        category: "Site",
        description: "",
        projectId: defaultProjectId || form.projectId,
      });
      setLines([emptyLine(today)]);
      setMsg("Voucher submitted — awaiting HR approval.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setBusy(false);
    }
  }

  async function decide(id: string, status: string) {
    await api(`/api/hrm/vouchers/${id}`, { method: "PATCH", token, body: JSON.stringify({ status }) });
    await load();
  }

  return (
    <div className="space-y-5">
      {msg && <p className="text-sm text-ok">{msg}</p>}
      <div className={`grid gap-4 ${isDaily ? "" : "lg:grid-cols-2"}`}>
        <Card className="space-y-3">
          <h3 className="font-semibold">{title || (isDaily ? "Daily expense voucher" : "Raise voucher")}</h3>
          <p className="text-xs text-steel-muted">
            {isDaily
              ? "Site employees raise a daily voucher with line items. HR Head (Anushka Jha) or office HR approves."
              : "Every employee can raise an expense / petty voucher. HR Head approves."}
          </p>
          <form className="space-y-3" onSubmit={submit}>
            <div className="grid sm:grid-cols-2 gap-2">
              <Input
                type="date"
                required
                value={form.voucherDate}
                onChange={(e) => {
                  const next = e.target.value;
                  setForm({ ...form, voucherDate: next });
                  setLines((prev) => prev.map((l) => (l.date ? l : { ...l, date: next })));
                }}
              />
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
              {projects.length > 0 && (
                <Select
                  className="sm:col-span-2"
                  value={form.projectId}
                  onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                >
                  <option value="">Project (optional)…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </Select>
              )}
              <Input
                className="sm:col-span-2"
                placeholder="Summary / purpose"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="border border-line rounded-sm overflow-hidden">
              <div className="px-3 py-2 bg-sand/40 text-xs font-semibold uppercase tracking-wide text-steel-muted flex justify-between">
                <span>Line items</span>
                <span className="tabular-nums">Total ₹{total.toLocaleString("en-IN")}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[36rem]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase text-steel-muted">
                      <th className="px-2 py-1.5">Date</th>
                      <th className="px-2 py-1.5">Particulars</th>
                      <th className="px-2 py-1.5">Qty</th>
                      <th className="px-2 py-1.5">Rate</th>
                      <th className="px-2 py-1.5">Amount</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, i) => (
                      <tr key={i} className="border-t border-line">
                        <td className="px-1 py-1">
                          <Input
                            type="date"
                            value={line.date || form.voucherDate}
                            onChange={(e) => patchLine(i, { date: e.target.value })}
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Input
                            required
                            placeholder="Item / purpose"
                            value={line.particular}
                            onChange={(e) => patchLine(i, { particular: e.target.value })}
                          />
                        </td>
                        <td className="px-1 py-1 w-20">
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={line.qty}
                            onChange={(e) => patchLine(i, { qty: e.target.value })}
                          />
                        </td>
                        <td className="px-1 py-1 w-24">
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="₹"
                            value={line.rate}
                            onChange={(e) => patchLine(i, { rate: e.target.value })}
                          />
                        </td>
                        <td className="px-1 py-1 w-28">
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            required
                            placeholder="₹"
                            value={line.amount}
                            onChange={(e) => patchLine(i, { amount: e.target.value, rate: "", qty: line.qty })}
                          />
                        </td>
                        <td className="px-1 py-1">
                          {lines.length > 1 && (
                            <button
                              type="button"
                              className="text-xs text-danger font-semibold"
                              onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                            >
                              Del
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-3 py-2 border-t border-line">
                <Button type="button" variant="secondary" className="!text-xs" onClick={() => setLines((prev) => [...prev, emptyLine(form.voucherDate)])}>
                  + Add line
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={busy || total <= 0}>
              {busy ? "Submitting…" : isDaily ? "Submit daily voucher" : "Submit voucher"}
            </Button>
          </form>
        </Card>

        <Card>
          <h3 className="font-semibold mb-2">{isDaily ? "My daily vouchers" : "Register"}</h3>
          <ul className="text-sm space-y-1">
            {rows.map((v) => (
              <li key={v.id} className="flex justify-between gap-2 items-start border-b border-line py-1.5">
                <span className="min-w-0">
                  <span className="font-mono text-[11px] text-brand mr-1">{v.voucherNo}</span>
                  {v.user?.fullName || "You"} · {v.category} · ₹{Number(v.amount).toLocaleString("en-IN")}
                  {v.project?.code ? ` · ${v.project.code}` : ""}
                  <Badge tone={v.status === "Approved" || v.status === "Paid" ? "ok" : v.status === "Rejected" ? "danger" : "warn"}>
                    {v.status}
                  </Badge>
                  {v.description && <div className="text-xs text-steel-muted mt-0.5">{v.description}</div>}
                  {v.particulars && v.particulars.length > 0 && (
                    <ul className="text-[11px] text-steel-muted mt-0.5 space-y-0.5">
                      {v.particulars.map((p, i) => (
                        <li key={i}>
                          {p.particular} · ₹{Number(p.amount || 0).toLocaleString("en-IN")}
                        </li>
                      ))}
                    </ul>
                  )}
                </span>
                {canApprove && v.status === "Submitted" && (
                  <span className="flex gap-1 shrink-0">
                    <button className="text-brand text-xs font-semibold" onClick={() => void decide(v.id, "Approved")}>
                      Approve
                    </button>
                    <button className="text-danger text-xs font-semibold" onClick={() => void decide(v.id, "Rejected")}>
                      Reject
                    </button>
                  </span>
                )}
              </li>
            ))}
            {!rows.length && <li className="text-steel-muted">No vouchers yet.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
