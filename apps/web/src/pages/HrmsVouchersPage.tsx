import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, Select } from "../components/ui";
import { isHrApprover } from "../lib/driveAccess";

type Voucher = {
  id: string;
  voucherNo: string;
  voucherDate: string;
  category: string;
  description: string;
  amount: number;
  status: string;
  user?: { fullName?: string };
  approver?: { fullName?: string } | null;
  project?: { code?: string } | null;
};

/** Employee expense / petty voucher — HR (Anushka) approves. */
export default function HrmsVouchersPage() {
  const { token, user } = useAuth();
  const canApprove = isHrApprover(user);
  const [rows, setRows] = useState<Voucher[]>([]);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    voucherDate: new Date().toISOString().slice(0, 10),
    category: "Site",
    description: "",
    amount: "",
  });

  const load = useCallback(async () => {
    const list = await api<Voucher[]>("/api/hrm/vouchers", { token }).catch(() => []);
    setRows(list);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      await api("/api/hrm/vouchers", { method: "POST", token, body: JSON.stringify(form) });
      setForm({ voucherDate: new Date().toISOString().slice(0, 10), category: "Site", description: "", amount: "" });
      setMsg("Voucher submitted — awaiting HR approval.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Submit failed");
    }
  }

  async function decide(id: string, status: string) {
    await api(`/api/hrm/vouchers/${id}`, { method: "PATCH", token, body: JSON.stringify({ status }) });
    await load();
  }

  return (
    <div className="space-y-5">
      {msg && <p className="text-sm text-ok">{msg}</p>}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="space-y-3">
          <h3 className="font-semibold">Raise voucher</h3>
          <p className="text-xs text-steel-muted">
            Same flow as the old HR desk — employee raises, HR Head (Anushka Jha) or office HR approves.
          </p>
          <form className="space-y-2" onSubmit={submit}>
            <Input type="date" required value={form.voucherDate} onChange={(e) => setForm({ ...form, voucherDate: e.target.value })} />
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {["Site", "Travel", "Petty cash", "Conveyance", "Other"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
            <Input placeholder="Particulars / purpose" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Input placeholder="Amount (₹)" type="number" required min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <Button type="submit" className="w-full" variant="secondary">
              Submit voucher
            </Button>
          </form>
        </Card>

        <Card>
          <h3 className="font-semibold mb-2">Register</h3>
          <ul className="text-sm space-y-1">
            {rows.map((v) => (
              <li key={v.id} className="flex justify-between gap-2 items-center border-b border-line py-1.5">
                <span className="min-w-0">
                  <span className="font-mono text-[11px] text-brand mr-1">{v.voucherNo}</span>
                  {v.user?.fullName || "You"} · {v.category} · ₹{Number(v.amount).toLocaleString("en-IN")}
                  <Badge tone={v.status === "Approved" || v.status === "Paid" ? "ok" : v.status === "Rejected" ? "danger" : "warn"}>
                    {v.status}
                  </Badge>
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
