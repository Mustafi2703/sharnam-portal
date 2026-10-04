import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, Select } from "../components/ui";
import { StatusNote } from "../components/StatusNote";

/**
 * Payroll — Pay Hike + Payslip generation.
 * Payslip compute is deterministic from EmployeeProfile CTC breakdown + paid days.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function money(n?: number | null) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return "₹ " + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function staffName(row: { userId?: string; staffName?: string; empCode?: string }, employees: { id?: string; fullName?: string; profile?: { empCode?: string } }[]) {
  const emp = employees.find((e) => e.id === row.userId);
  const name = String(row.staffName || emp?.fullName || "").trim();
  const code = String(row.empCode || emp?.profile?.empCode || "").trim();
  return { name, code };
}

export default function PayrollPage() {
  const { token, user } = useAuth();
  const canWrite = ["admin", "office", "hr"].includes(user?.role || "") || Boolean(user?.hrDeskOnly);
  const [tab, setTab] = useState<"payslip" | "hike">("payslip");
  const [employees, setEmployees] = useState<any[]>([]);
  const [hikes, setHikes] = useState<any[]>([]);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [msg, setMsg] = useState("");

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [scopeUserId, setScopeUserId] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const [emps, hs] = await Promise.all([
          api<any[]>("/api/hrm/employees", { token }),
          api<any[]>("/api/hrm/pay-hikes", { token }),
        ]);
        setEmployees(emps);
        setHikes(hs);
        await loadPayslips();
      } catch (err) {
        setMsg(err instanceof Error ? err.message : "Could not load payroll");
      }
    })();
  }, [token]);

  async function loadPayslips() {
    const params = new URLSearchParams();
    params.set("year", String(year));
    params.set("month", String(month));
    if (scopeUserId) params.set("userId", scopeUserId);
    const rows = await api<any[]>(`/api/hrm/payslips?${params.toString()}`, { token });
    setPayslips(rows);
  }

  useEffect(() => {
    void loadPayslips();
  }, [year, month, scopeUserId, token]);

  return (
    <div className="space-y-4">
      <nav className="hrms-subnav" aria-label="Payroll views">
        {(["payslip", "hike"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`hrms-subnav__tab${tab === t ? " is-on" : ""}`}
          >
            {t === "payslip" ? "Payslips" : "Pay hikes"}
          </button>
        ))}
      </nav>

      <StatusNote msg={msg} />

      {tab === "payslip" ? (
        <PayslipTab
          employees={employees}
          payslips={payslips}
          year={year}
          month={month}
          scopeUserId={scopeUserId}
          setYear={setYear}
          setMonth={setMonth}
          setScopeUserId={setScopeUserId}
          canWrite={canWrite}
          setMsg={setMsg}
          reload={loadPayslips}
          token={token || ""}
        />
      ) : (
        <HikeTab
          employees={employees}
          hikes={hikes}
          canWrite={canWrite}
          setMsg={setMsg}
          reload={async () => setHikes(await api<any[]>("/api/hrm/pay-hikes", { token }))}
          token={token || ""}
        />
      )}
    </div>
  );
}

function PayslipTab({ employees, payslips, year, month, scopeUserId, setYear, setMonth, setScopeUserId, canWrite, setMsg, reload, token }: any) {
  const [form, setForm] = useState({
    userId: "",
    workingDays: 30,
    lopDays: 0,
    incomeTax: 0,
    basic: "",
    hra: "",
    conveyance: "",
    medicalAllow: "",
    specialAllow: "",
    otherEarnings: "",
    pfEmployee: "",
    professionalTax: "",
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ basic: "", hra: "", specialAllow: "", incomeTax: "", pfEmployee: "" });

  async function generate(e: FormEvent) {
    e.preventDefault();
    try {
      const body: Record<string, unknown> = { userId: form.userId, year, month, workingDays: form.workingDays, lopDays: form.lopDays, incomeTax: form.incomeTax };
      for (const key of ["basic", "hra", "conveyance", "medicalAllow", "specialAllow", "otherEarnings", "pfEmployee", "professionalTax"] as const) {
        if (form[key] !== "") body[key] = Number(form[key]);
      }
      await api("/api/hrm/payslips/generate", { method: "POST", token, body: JSON.stringify(body) });
      setMsg("Payslip generated and filed as a PDF.");
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  async function clearMonth() {
    if (!window.confirm(`Delete every payslip for this month? Staff records stay.`)) return;
    try {
      const out = await api<{ deleted: number }>("/api/hrm/registers/clear-ops", {
        method: "POST",
        token,
        body: JSON.stringify({ confirm: "CLEAR", which: "payslips", year, month }),
      });
      setMsg(`Deleted ${out.deleted} payslip${out.deleted === 1 ? "" : "s"} for this month.`);
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not delete payslips");
    }
  }

  async function removeSlip(id: string) {
    if (!window.confirm("Delete this payslip?")) return;
    try {
      await api(`/api/hrm/payslips/${id}`, { method: "DELETE", token });
      setMsg("Payslip deleted.");
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not delete payslip");
    }
  }

  async function generateAll() {
    try {
      const out = await api<{ created: any[]; skipped: any[] }>("/api/hrm/payslips/generate-month", {
        method: "POST",
        token,
        body: JSON.stringify({ year, month, workingDays: form.workingDays, lopDays: form.lopDays, incomeTax: form.incomeTax }),
      });
      setMsg(`Generated ${out.created.length} slip(s). Skipped ${out.skipped.length} (no CTC or not staff).`);
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Month generate failed");
    }
  }

  async function saveEdit(id: string) {
    const body: Record<string, number> = {};
    for (const [k, v] of Object.entries(edit)) {
      if (v !== "") body[k] = Number(v);
    }
    await api(`/api/hrm/payslips/${id}`, { method: "PATCH", token, body: JSON.stringify(body) });
    setEditId(null);
    await reload();
  }
  async function transition(id: string, status: string) {
    await api(`/api/hrm/payslips/${id}`, { method: "PATCH", token, body: JSON.stringify({ status }) });
    await reload();
  }

  const grossTotal = payslips.reduce((s: number, p: any) => s + p.grossEarnings, 0);
  const netTotal = payslips.reduce((s: number, p: any) => s + p.netPay, 0);

  const staffWithCtc = useMemo(
    () => employees.filter((e: any) => e.profile && (e.profile.ctcAnnual || e.profile.basicMonthly)),
    [employees]
  );
  const staffMissingCtc = useMemo(
    () =>
      employees.filter(
        (e: any) =>
          e.profile &&
          !e.profile.ctcAnnual &&
          !e.profile.basicMonthly &&
          ["admin", "office", "hr", "site_employee", "employee"].includes(e.role)
      ),
    [employees]
  );

  return (
    <div className="space-y-4">
      <Card className="!p-4">
        <div className="hrms-payroll-toolbar">
          <label className="text-xs font-semibold text-steel-muted">
            Year
            <Input type="number" className="mt-1" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </label>
          <label className="text-xs font-semibold text-steel-muted">
            Month
            <Select className="mt-1" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {i + 1} · {m}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-xs font-semibold text-steel-muted md:col-span-2">
            Filter employee
            <Select className="mt-1" value={scopeUserId} onChange={(e) => setScopeUserId(e.target.value)}>
              <option value="">All employees</option>
              {employees.map((emp: any) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <p className="text-[11px] text-steel-muted mt-3 leading-relaxed">
          {staffWithCtc.length} staff with CTC on file · {staffMissingCtc.length} missing CTC —{" "}
          <Link to="/hrm/users" className="text-brand font-semibold underline">
            set CTC in HRMS → Users
          </Link>{" "}
          before Generate all. Each payslip is stored as a PDF.
        </p>
      </Card>

      {canWrite && (
        <Card className="!p-4 space-y-3">
          <div>
            <h3 className="font-semibold text-sm">Generate · {MONTHS[month - 1]} {year}</h3>
            <p className="text-[11px] text-steel-muted mt-1">
              Blank overrides use the SPDC CTC calculator (same monthly basic, HRA, conveyance, special, PF and professional tax as the offer letter). The payslip is filed on SharePoint as a PDF.
            </p>
          </div>
          <form onSubmit={generate} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="text-xs font-semibold text-steel-muted sm:col-span-2 lg:col-span-4">
              Employee
              <Select className="mt-1" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} required>
                <option value="">Pick employee</option>
                {staffWithCtc.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName}
                    {emp.profile?.empCode ? ` · ${emp.profile.empCode}` : ""}
                    {emp.profile?.ctcAnnual ? ` · ₹${Number(emp.profile.ctcAnnual).toLocaleString("en-IN")}/yr` : ""}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-xs font-semibold text-steel-muted">
              Working days
              <Input className="mt-1" type="number" value={form.workingDays} onChange={(e) => setForm({ ...form, workingDays: Number(e.target.value) })} />
              <span className="mt-1 block text-[10px] font-normal">Paid days in this month. Usually 30.</span>
            </label>
            <label className="text-xs font-semibold text-steel-muted">
              Loss of pay (days)
              <Input className="mt-1" type="number" value={form.lopDays} onChange={(e) => setForm({ ...form, lopDays: Number(e.target.value) })} />
              <span className="mt-1 block text-[10px] font-normal">Unpaid leave. Put 0 if none.</span>
            </label>
            <label className="text-xs font-semibold text-steel-muted">
              TDS (₹)
              <Input className="mt-1" type="number" value={form.incomeTax} onChange={(e) => setForm({ ...form, incomeTax: Number(e.target.value) })} />
              <span className="mt-1 block text-[10px] font-normal">Income tax deducted this month. Put 0 if none.</span>
            </label>
            <label className="text-xs font-semibold text-steel-muted">
              Basic override (₹)
              <Input className="mt-1" type="number" placeholder="Leave blank" value={form.basic} onChange={(e) => setForm({ ...form, basic: e.target.value })} />
              <span className="mt-1 block text-[10px] font-normal">Optional. Blank uses the CTC basic.</span>
            </label>
            <label className="text-xs font-semibold text-steel-muted">
              HRA override (₹)
              <Input className="mt-1" type="number" placeholder="Leave blank" value={form.hra} onChange={(e) => setForm({ ...form, hra: e.target.value })} />
              <span className="mt-1 block text-[10px] font-normal">Optional. Blank uses the CTC HRA.</span>
            </label>
            <label className="text-xs font-semibold text-steel-muted">
              Special allowance override (₹)
              <Input className="mt-1" type="number" placeholder="Leave blank" value={form.specialAllow} onChange={(e) => setForm({ ...form, specialAllow: e.target.value })} />
              <span className="mt-1 block text-[10px] font-normal">Optional. Blank uses the CTC special allowance.</span>
            </label>
            <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4">
              <Button type="submit">Generate one</Button>
              <Button type="button" variant="secondary" onClick={() => void generateAll()}>
                Generate all staff ({staffWithCtc.length})
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card padding={false}>
        <div className="px-4 py-3 border-b border-line flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-sm">
            Payslips · {MONTHS[month - 1]} {year} ({payslips.length})
          </span>
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-steel-muted">
              Gross {money(grossTotal)} · Net {money(netTotal)}
            </span>
            {canWrite && (
              <Button
                type="button"
                variant="danger"
                className="!px-2.5 !py-1.5 !text-xs !rounded-lg"
                onClick={() => void clearMonth()}
              >
                Delete this month
              </Button>
            )}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-xs">
            <thead className="text-left text-steel-muted bg-sand/20">
              <tr>
                <th>Staff</th>
                <th>Days</th>
                <th className="text-right">Basic</th>
                <th className="text-right">HRA</th>
                <th className="text-right">Other</th>
                <th className="text-right">Gross</th>
                <th className="text-right">PF</th>
                <th className="text-right">ESIC</th>
                <th className="text-right">PT</th>
                <th className="text-right">TDS</th>
                <th className="text-right">Deductions</th>
                <th className="text-right">Net Pay</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {payslips.map((p: any) => {
                const who = staffName(p, employees);
                return (
                  <tr key={p.id} className="border-t border-line">
                    <td className="p-2">
                      <div className="font-medium text-ink">{who.name || "—"}</div>
                      {who.code ? <div className="text-[10px] text-steel-muted">{who.code}</div> : null}
                    </td>
                    <td>{p.paidDays}/{p.workingDays}{p.lopDays ? ` (LOP ${p.lopDays})` : ""}</td>
                    <td className="text-right">
                      {editId === p.id ? (
                        <input className="w-20 border border-line rounded px-1 text-right" value={edit.basic} onChange={(e) => setEdit({ ...edit, basic: e.target.value })} />
                      ) : (
                        money(p.basic)
                      )}
                    </td>
                    <td className="text-right">
                      {editId === p.id ? (
                        <input className="w-20 border border-line rounded px-1 text-right" value={edit.hra} onChange={(e) => setEdit({ ...edit, hra: e.target.value })} />
                      ) : (
                        money(p.hra)
                      )}
                    </td>
                    <td className="text-right">{money(p.conveyance + p.medicalAllow + p.specialAllow + p.otherEarnings)}</td>
                    <td className="text-right font-medium">{money(p.grossEarnings)}</td>
                    <td className="text-right">{money(p.pfEmployee)}</td>
                    <td className="text-right">{money(p.esicEmployee)}</td>
                    <td className="text-right">{money(p.professionalTax)}</td>
                    <td className="text-right">
                      {editId === p.id ? (
                        <input className="w-20 border border-line rounded px-1 text-right" value={edit.incomeTax} onChange={(e) => setEdit({ ...edit, incomeTax: e.target.value })} />
                      ) : (
                        money(p.incomeTax)
                      )}
                    </td>
                    <td className="text-right">{money(p.totalDeductions)}</td>
                    <td className="text-right font-semibold">{money(p.netPay)}</td>
                    <td>
                      <button
                        type="button"
                        className="text-xs font-semibold text-brand underline mr-2"
                        onClick={() => {
                          const base = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "") || window.location.origin;
                          const q = token ? `?token=${encodeURIComponent(token)}` : "";
                          window.open(`${base}/api/hrm/payslips/${p.id}/file.pdf${q}`, "_blank");
                        }}
                      >
                        View slip
                      </button>
                      {canWrite ? (
                        <>
                          {editId === p.id ? (
                            <button type="button" className="text-xs font-semibold text-ok underline mr-2" onClick={() => void saveEdit(p.id)}>
                              Save
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="text-xs font-semibold text-steel-muted underline mr-2"
                              onClick={() => {
                                setEditId(p.id);
                                setEdit({
                                  basic: String(p.basic ?? ""),
                                  hra: String(p.hra ?? ""),
                                  specialAllow: String(p.specialAllow ?? ""),
                                  incomeTax: String(p.incomeTax ?? ""),
                                  pfEmployee: String(p.pfEmployee ?? ""),
                                });
                              }}
                            >
                              Edit
                            </button>
                          )}
                          {p.fileUrl ? (
                            <a href={p.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-brand underline mr-2">
                              Drive
                            </a>
                          ) : null}
                          <Button type="button" variant="danger" className="!px-2.5 !py-1 !text-xs !rounded-lg" onClick={() => void removeSlip(p.id)}>Delete</Button>
                          <Select value={p.status} onChange={(e) => transition(p.id, e.target.value)} className="!py-1">
                            {["Generated", "Approved", "Released", "Paid"].map((s) => <option key={s}>{s}</option>)}
                          </Select>
                        </>
                      ) : (
                        <Badge tone={p.status === "Paid" ? "ok" : "brand"}>{p.status}</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!payslips.length && <tr><td colSpan={13} className="py-4 text-center text-steel-muted">No payslips for this month yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function HikeTab({ employees, hikes, canWrite, setMsg, reload, token }: any) {
  const [form, setForm] = useState({ userId: "", effectiveDate: "", oldCtcAnnual: "", newCtcAnnual: "", oldBasicMonthly: "", newBasicMonthly: "", oldHraMonthly: "", newHraMonthly: "", reason: "", performanceRating: "" });

  useEffect(() => {
    if (!form.userId) return;
    const emp = employees.find((e: any) => e.id === form.userId);
    setForm((prev) => ({
      ...prev,
      oldCtcAnnual: emp?.profile?.ctcAnnual != null ? String(emp.profile.ctcAnnual) : "",
      oldBasicMonthly: emp?.profile?.basicMonthly != null ? String(emp.profile.basicMonthly) : "",
      oldHraMonthly: emp?.profile?.hraMonthly != null ? String(emp.profile.hraMonthly) : "",
      newCtcAnnual: "",
      newBasicMonthly: "",
      newHraMonthly: "",
    }));
  }, [form.userId]);

  useEffect(() => {
    const ctc = Number(form.newCtcAnnual);
    if (!token || !(ctc > 0)) return;
    const emp = employees.find((e: any) => e.id === form.userId);
    let cancel = false;
    void api<{ partA: { rows: { label: string; perMonth: number }[] } }>("/api/hrm/ctc/compute", {
      method: "POST",
      token,
      body: JSON.stringify({
        candidateName: emp?.fullName || "Employee",
        designation: emp?.profile?.designation || "Employee",
        fixedCtcAnnual: ctc,
      }),
    })
      .then((breakdown) => {
        if (cancel) return;
        const basic = breakdown.partA.rows.find((r) => r.label === "Basic Salary")?.perMonth;
        const hra = breakdown.partA.rows.find((r) => r.label === "House Rent Allowance")?.perMonth;
        setForm((prev) =>
          prev.newCtcAnnual !== form.newCtcAnnual
            ? prev
            : {
                ...prev,
                newBasicMonthly: basic != null ? String(Math.round(basic)) : prev.newBasicMonthly,
                newHraMonthly: hra != null ? String(Math.round(hra)) : prev.newHraMonthly,
              },
        );
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [form.newCtcAnnual, form.userId, token]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/api/hrm/pay-hikes", { method: "POST", token, body: JSON.stringify(form) });
      setForm({ userId: "", effectiveDate: "", oldCtcAnnual: "", newCtcAnnual: "", oldBasicMonthly: "", newBasicMonthly: "", oldHraMonthly: "", newHraMonthly: "", reason: "", performanceRating: "" });
      setMsg("Pay hike submitted.");
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }
  async function transition(id: string, status: string) {
    await api(`/api/hrm/pay-hikes/${id}`, { method: "PATCH", token, body: JSON.stringify({ status }) });
    await reload();
  }

  return (
    <div className="space-y-3">
      {canWrite && (
        <Card>
          <h3 className="font-semibold text-sm mb-2">Propose a pay hike</h3>
          <form onSubmit={submit} className="grid md:grid-cols-4 gap-3">
            <label className="text-xs font-semibold text-steel-muted md:col-span-2">
              Employee
              <Select className="mt-1" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} required>
                <option value="">Pick employee</option>
                {employees.filter((e: any) => e.profile).map((emp: any) => (
                  <option key={emp.id} value={emp.id}>{emp.fullName}{emp.profile?.empCode ? ` · ${emp.profile.empCode}` : ""}</option>
                ))}
              </Select>
            </label>
            <label className="text-xs font-semibold text-steel-muted">
              Effective date
              <Input className="mt-1" type="date" value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} required />
            </label>
            <label className="text-xs font-semibold text-steel-muted">
              Rating
              <Input className="mt-1" placeholder="5/5" value={form.performanceRating} onChange={(e) => setForm({ ...form, performanceRating: e.target.value })} />
            </label>
            <label className="text-xs font-semibold text-steel-muted">
              Current CTC (₹ / year)
              <Input className="mt-1" type="number" value={form.oldCtcAnnual} onChange={(e) => setForm({ ...form, oldCtcAnnual: e.target.value })} />
              <span className="mt-1 block text-[10px] font-normal">Filled from employee setup.</span>
            </label>
            <label className="text-xs font-semibold text-steel-muted">
              New CTC (₹ / year)
              <Input className="mt-1" type="number" value={form.newCtcAnnual} onChange={(e) => setForm({ ...form, newCtcAnnual: e.target.value })} required />
            </label>
            <label className="text-xs font-semibold text-steel-muted">
              Current basic (₹ / month)
              <Input className="mt-1" type="number" value={form.oldBasicMonthly} onChange={(e) => setForm({ ...form, oldBasicMonthly: e.target.value })} />
            </label>
            <label className="text-xs font-semibold text-steel-muted">
              New basic (₹ / month)
              <Input className="mt-1" type="number" value={form.newBasicMonthly} onChange={(e) => setForm({ ...form, newBasicMonthly: e.target.value })} />
              <span className="mt-1 block text-[10px] font-normal">Filled from the CTC calculator.</span>
            </label>
            <label className="text-xs font-semibold text-steel-muted">
              Current HRA (₹ / month)
              <Input className="mt-1" type="number" value={form.oldHraMonthly} onChange={(e) => setForm({ ...form, oldHraMonthly: e.target.value })} />
            </label>
            <label className="text-xs font-semibold text-steel-muted">
              New HRA (₹ / month)
              <Input className="mt-1" type="number" value={form.newHraMonthly} onChange={(e) => setForm({ ...form, newHraMonthly: e.target.value })} />
            </label>
            <label className="text-xs font-semibold text-steel-muted md:col-span-2">
              Reason
              <Input className="mt-1" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </label>
            <div className="md:col-span-4">
              <Button type="submit">Submit hike</Button>
            </div>
          </form>
          <p className="text-[10px] text-steel-muted mt-2">Approving the hike writes the new CTC, basic, and HRA onto the employee. Later payslips use those figures.</p>
        </Card>
      )}

      <Card padding={false}>
        <div className="px-4 py-3 border-b border-line flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-sm">Pay hikes</span>
          <span className="text-[11px] text-steel-muted">{hikes.length} entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1000px] w-full text-xs">
            <thead className="text-left text-steel-muted bg-sand/20">
              <tr><th className="p-2">Employee</th><th>Effective</th><th className="text-right">Old CTC</th><th className="text-right">New CTC</th><th className="text-right">Hike %</th><th>Rating</th><th>Reason</th><th>Status</th></tr>
            </thead>
            <tbody>
              {hikes.map((h: any) => {
                const who = staffName(h, employees);
                return (
                  <tr key={h.id} className="border-t border-line">
                    <td className="p-2">
                      <div className="font-medium text-ink">{who.name || "—"}</div>
                      {who.code ? <div className="text-[10px] text-steel-muted">{who.code}</div> : null}
                    </td>
                    <td>{new Date(h.effectiveDate).toLocaleDateString("en-IN")}</td>
                    <td className="text-right">{money(h.oldCtcAnnual)}</td>
                    <td className="text-right">{money(h.newCtcAnnual)}</td>
                    <td className="text-right">{h.hikePercent?.toFixed(2)}%</td>
                    <td>{h.performanceRating || "—"}</td>
                    <td>{h.reason || "—"}</td>
                    <td>
                      {canWrite ? (
                        <Select value={h.status} onChange={(e) => transition(h.id, e.target.value)} className="!py-1">
                          {["Submitted", "Approved", "Rejected", "Applied"].map((s) => <option key={s}>{s}</option>)}
                        </Select>
                      ) : (
                        <Badge tone={h.status === "Applied" ? "ok" : h.status === "Rejected" ? "danger" : "brand"}>{h.status}</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!hikes.length && <tr><td colSpan={8} className="py-4 text-center text-steel-muted">No pay hikes yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
