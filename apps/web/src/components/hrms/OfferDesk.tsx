import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { downloadAuthFile } from "../../lib/downloadReport";
import { rolesForDepartment, useHrmOrg, withCurrentOption } from "../../lib/hrmOrg";
import { Badge, Button, Card, Input, Select, TextArea } from "../ui";

const CTC_DEFAULTS = {
  basicPctOfGross: 0.5,
  hraPctOfBasic: 0.4,
  restrictPfCeiling: false,
  gratuityPctOfBasic: 0.0481,
  ltaPctOfBasic: 0.0833,
  conveyanceAnnual: 19200,
  childrenEducationAnnual: 2400,
  mediclaimAnnual: 12000,
  performancePayPct: 0.1,
  professionalTaxAnnual: 2400,
};
type CtcInputs = typeof CTC_DEFAULTS & { fixedCtcAnnual: number };
type Row = { label: string; basis: string; perAnnum: number; perMonth: number | string };
type Breakdown = {
  partA: { rows: Row[]; gross: { perAnnum: number; perMonth: number } };
  partB: { rows: Row[]; total: { perAnnum: number; perMonth: number }; fixedCtc: { perAnnum: number; perMonth: number }; performancePay: { perAnnum: number; perMonth: string }; totalCtc: { perAnnum: number; perMonth: string } };
  partC: { rows: Row[]; indicativeNet: { perAnnum: number; perMonth: number } };
  validation: string[];
};

const LETTER_BLANK = {
  gender: "",
  phone: "",
  address: "",
  grade: "",
  projectName: "",
  workingHours: "9:00 AM to 6:30 PM",
  reportingTime: "9:30 AM",
  reportingAddress: "",
  probationNotice: "15",
  employeeNotice: "60",
  companyNotice: "30",
  clDays: "12",
  slDays: "6",
};
const FORM_BLANK = {
  candidateId: "",
  designation: "",
  department: "",
  joiningDate: "",
  probationMonths: "6",
  location: "SPDC Corporate Office, Vadodara",
  reportingManager: "",
  notes: "",
};

const inr = (n?: number | null) => (n == null || Number.isNaN(Number(n)) ? "—" : `₹ ${Math.round(Number(n)).toLocaleString("en-IN")}`);
const ELIGIBLE = ["Shortlisted", "Interview", "Interviewed", "Selected", "SalaryDiscussion"];

function bestScore(c: any) {
  return Math.max(0, ...(c.interviews || []).map((r: any) => Number(r.scoreOverall) || 0));
}

/** Steps an offer goes through, shown as a strip on every offer row. */
const STEPS = [
  { key: "letter", label: "Offer letter" },
  { key: "sent", label: "Sent" },
  { key: "accepted", label: "Accepted" },
  { key: "prejoin", label: "Pre-joining" },
  { key: "appointment", label: "Appointment letter" },
  { key: "login", label: "Portal login" },
] as const;

function stepState(o: any): Record<(typeof STEPS)[number]["key"], boolean> {
  const accepted = ["Accepted", "Onboarding", "Joined"].includes(o.status);
  return {
    letter: !!(o.offerLetterDocId || o.offerLetterUrl),
    sent: accepted || o.status === "Sent",
    accepted,
    prejoin: !!o.appointmentReady,
    appointment: !!o.appointmentLetterUrl,
    login: !!o.onboard?.userId,
  };
}

/**
 * HRMS · Offers — one form fills the offer, the CTC split and every field printed on the SPDC letters.
 * Saving generates the SPDC Offer Letter; the row then walks Sent → Accepted → Pre-joining →
 * Appointment letter → Portal login.
 */
export function OfferDesk({ candidates, offers, canManage, reload, setMsg, token }: any) {
  const org = useHrmOrg(token);
  const [form, setForm] = useState(FORM_BLANK);
  const [letter, setLetter] = useState(LETTER_BLANK);
  const [ctc, setCtc] = useState<CtcInputs>({ fixedCtcAnnual: 600000, ...CTC_DEFAULTS });
  const [showSplit, setShowSplit] = useState(false);
  const [preview, setPreview] = useState<Breakdown | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rowBusy, setRowBusy] = useState("");
  const [loginNote, setLoginNote] = useState<{ email: string; password: string | null; created: boolean } | null>(null);

  const eligible = useMemo(
    () => candidates.filter((c: any) => ELIGIBLE.includes(c.status) || c.id === form.candidateId),
    [candidates, form.candidateId],
  );
  const person = candidates.find((c: any) => c.id === form.candidateId);
  const departments = withCurrentOption(org.departments.map((d) => d.name), form.department);
  const roles = rolesForDepartment(org.designations, form.department, form.designation);

  // Live CTC split as HR types
  useEffect(() => {
    if (!(ctc.fixedCtcAnnual > 0)) {
      setPreview(null);
      return;
    }
    const t = setTimeout(() => {
      api<Breakdown>("/api/hrm/ctc/compute", {
        method: "POST",
        token,
        body: JSON.stringify({ ...ctc, candidateName: person?.fullName || "Candidate", designation: form.designation || "Executive" }),
      })
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 350);
    return () => clearTimeout(t);
  }, [ctc, token, person?.fullName, form.designation]);

  function pickCandidate(candidateId: string) {
    const c = candidates.find((x: any) => x.id === candidateId);
    const designation = c?.requisition?.designation || c?.posting?.title || "";
    const dept = c?.requisition?.department || org.designations.find((d) => d.title === designation)?.department || "";
    setForm({ ...form, candidateId, designation, department: dept });
    setLetter((l) => ({ ...l, phone: c?.phone || "" }));
    if (c?.expectedCtc) setCtc((x) => ({ ...x, fixedCtcAnnual: Number(c.expectedCtc) }));
  }

  function startEdit(o: any) {
    let lf: Record<string, string> = {};
    let inputs: Partial<CtcInputs> = {};
    try {
      lf = JSON.parse(o.letterFieldsJson || "{}");
    } catch {
      lf = {};
    }
    try {
      inputs = JSON.parse(o.ctcInputsJson || "{}");
    } catch {
      inputs = {};
    }
    setEditId(o.id);
    setForm({
      candidateId: o.candidateId,
      designation: o.designation || "",
      department: o.department || "",
      joiningDate: o.joiningDate ? String(o.joiningDate).slice(0, 10) : "",
      probationMonths: String(o.probationMonths ?? 6),
      location: o.location || "",
      reportingManager: o.reportingManager || "",
      notes: o.notes || "",
    });
    setLetter({ ...LETTER_BLANK, ...lf });
    setCtc({ ...CTC_DEFAULTS, ...inputs, fixedCtcAnnual: Number(inputs.fixedCtcAnnual || o.ctcAnnual || 0) } as CtcInputs);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditId(null);
    setForm(FORM_BLANK);
    setLetter(LETTER_BLANK);
    setCtc({ fixedCtcAnnual: 600000, ...CTC_DEFAULTS });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form.candidateId) return setMsg("Pick the candidate first.");
    setSaving(true);
    try {
      const ctcInputsJson = JSON.stringify({ ...ctc, candidateName: person?.fullName || "", designation: form.designation });
      const payload = { ...form, ctcAnnual: String(ctc.fixedCtcAnnual), ctcInputsJson, letterFieldsJson: JSON.stringify(letter) };
      let out: any;
      if (editId) {
        out = await api(`/api/hrm/offers/${editId}`, { method: "PUT", token, body: JSON.stringify(payload) });
      } else {
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => v !== "" && fd.append(k, String(v)));
        out = await api("/api/hrm/offers", { method: "POST", token, body: fd });
      }
      setMsg(
        out?.letterError
          ? `Offer saved, but the letter could not be generated: ${out.letterError}`
          : `Offer ${editId ? "updated" : "saved"} and the SPDC offer letter is ready to download.`,
      );
      resetForm();
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not save the offer");
    } finally {
      setSaving(false);
    }
  }

  async function act(o: any, key: string, fn: () => Promise<unknown>, ok: string) {
    setRowBusy(`${o.id}:${key}`);
    try {
      await fn();
      setMsg(ok);
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Action failed");
    } finally {
      setRowBusy("");
    }
  }
  const status = (o: any, next: string, ok: string) =>
    act(o, next, () => api(`/api/hrm/offers/${o.id}`, { method: "PATCH", token, body: JSON.stringify({ status: next }) }), ok);

  const L = (k: keyof typeof LETTER_BLANK, label: string, extra: Record<string, unknown> = {}) => (
    <Input label={label} value={letter[k]} onChange={(e) => setLetter({ ...letter, [k]: e.target.value })} {...extra} />
  );

  return (
    <div className="space-y-3">
      {canManage && (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
            <div>
              <h3 className="font-semibold text-sm">{editId ? "Edit Offer" : "Make An Offer"}</h3>
              <p className="text-[11px] text-steel-muted">
                Fill this once. Saving generates the SPDC Offer Letter with Annexure I from the same figures. The appointment letter later uses the same details.
              </p>
            </div>
            {editId ? (
              <Button type="button" variant="secondary" className="!text-xs" onClick={resetForm}>
                Cancel edit
              </Button>
            ) : null}
          </div>
          <form onSubmit={save} className="space-y-4">
            <section>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-steel-muted mb-2">1. Candidate And Role</p>
              <div className="grid md:grid-cols-4 gap-3">
                <Select label="Candidate *" value={form.candidateId} onChange={(e) => pickCandidate(e.target.value)} required disabled={!!editId}>
                  <option value="">Select candidate</option>
                  {eligible.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName}
                      {bestScore(c) ? ` · score ${bestScore(c)}` : ""} · {c.status}
                    </option>
                  ))}
                </Select>
                <Select label="Department *" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value, designation: "" })} required>
                  <option value="">Select department</option>
                  {departments.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </Select>
                <Select label="Designation *" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} required>
                  <option value="">Select designation</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.title}>
                      {r.title}
                    </option>
                  ))}
                </Select>
                <Input label="Joining date *" type="date" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} required />
                <Input label="Base location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                <Input label="Reporting manager" value={form.reportingManager} onChange={(e) => setForm({ ...form, reportingManager: e.target.value })} />
                <Input label="Probation (months)" type="number" min={0} value={form.probationMonths} onChange={(e) => setForm({ ...form, probationMonths: e.target.value })} />
                {L("grade", "Grade / band")}
                {L("projectName", "Project / site (if known)")}
              </div>
              {person && (person.interviews || []).length ? (
                <p className="mt-2 text-[11px] text-steel-muted">
                  Scorecards:{" "}
                  {(person.interviews || [])
                    .map((r: any) => `${r.roundType || `R${r.roundNumber}`} ${r.scoreOverall ?? "—"}${r.decision ? ` (${r.decision})` : ""}`)
                    .join(" · ")}
                </p>
              ) : null}
            </section>

            <section>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-steel-muted mb-2">2. Salary (CTC)</p>
              <div className="grid md:grid-cols-4 gap-3 items-end">
                <Input
                  label="Fixed CTC per annum (₹) *"
                  type="number"
                  min={1}
                  value={ctc.fixedCtcAnnual || ""}
                  onChange={(e) => setCtc({ ...ctc, fixedCtcAnnual: Number(e.target.value) })}
                  required
                />
                <div className="md:col-span-3 text-xs rounded-lg border border-line bg-sand/30 px-3 py-2">
                  {preview ? (
                    <span>
                      Basic {inr(Number(preview.partA.rows[0]?.perMonth))}/mo · HRA {inr(Number(preview.partA.rows[1]?.perMonth))}/mo · Gross {inr(preview.partA.gross.perMonth)}/mo ·
                      Retirals {inr(preview.partB.total.perAnnum)} p.a. · Take-home about <strong>{inr(preview.partC.indicativeNet.perMonth)}</strong>/mo
                    </span>
                  ) : (
                    <span className="text-steel-muted">Enter the fixed CTC to see the split.</span>
                  )}
                </div>
              </div>
              <button type="button" className="mt-2 text-xs font-semibold text-brand cursor-pointer" onClick={() => setShowSplit((v) => !v)}>
                {showSplit ? "Hide the CTC split settings" : "Change the CTC split (basic %, HRA %, PF, allowances…)"}
              </button>
              {showSplit && (
                <div className="grid md:grid-cols-4 gap-3 mt-2">
                  <Input label="Basic % of gross" type="number" value={Math.round(ctc.basicPctOfGross * 100)} onChange={(e) => setCtc({ ...ctc, basicPctOfGross: Number(e.target.value) / 100 })} />
                  <Input label="HRA % of basic (40 non-metro, 50 metro)" type="number" value={Math.round(ctc.hraPctOfBasic * 100)} onChange={(e) => setCtc({ ...ctc, hraPctOfBasic: Number(e.target.value) / 100 })} />
                  <Input label="Gratuity % of basic" type="number" step="0.01" value={Math.round(ctc.gratuityPctOfBasic * 10000) / 100} onChange={(e) => setCtc({ ...ctc, gratuityPctOfBasic: Number(e.target.value) / 100 })} />
                  <Input label="LTA % of basic" type="number" step="0.01" value={Math.round(ctc.ltaPctOfBasic * 10000) / 100} onChange={(e) => setCtc({ ...ctc, ltaPctOfBasic: Number(e.target.value) / 100 })} />
                  <Input label="Conveyance p.a. (₹)" type="number" value={ctc.conveyanceAnnual} onChange={(e) => setCtc({ ...ctc, conveyanceAnnual: Number(e.target.value) })} />
                  <Input label="Children education p.a. (₹)" type="number" value={ctc.childrenEducationAnnual} onChange={(e) => setCtc({ ...ctc, childrenEducationAnnual: Number(e.target.value) })} />
                  <Input label="Mediclaim / GPA p.a. (₹)" type="number" value={ctc.mediclaimAnnual} onChange={(e) => setCtc({ ...ctc, mediclaimAnnual: Number(e.target.value) })} />
                  <Input label="Performance pay % of CTC" type="number" value={Math.round(ctc.performancePayPct * 100)} onChange={(e) => setCtc({ ...ctc, performancePayPct: Number(e.target.value) / 100 })} />
                  <Input label="Professional tax p.a. (₹)" type="number" value={ctc.professionalTaxAnnual} onChange={(e) => setCtc({ ...ctc, professionalTaxAnnual: Number(e.target.value) })} />
                  <label className="text-xs text-steel-muted flex items-center gap-2 md:col-span-3">
                    <input type="checkbox" checked={ctc.restrictPfCeiling} onChange={(e) => setCtc({ ...ctc, restrictPfCeiling: e.target.checked })} />
                    Restrict employer PF to the ₹15,000 statutory ceiling
                  </label>
                </div>
              )}
              {showSplit && preview && (
                <div className="text-xs border border-line rounded overflow-x-auto mt-2">
                  <table className="min-w-[640px] w-full">
                    <thead className="bg-sand/40">
                      <tr>
                        <th className="p-1.5 text-left">Component</th>
                        <th className="p-1.5 text-right">Per annum</th>
                        <th className="p-1.5 text-right">Per month</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ...preview.partA.rows,
                        { label: "A. Gross salary", perAnnum: preview.partA.gross.perAnnum, perMonth: preview.partA.gross.perMonth },
                        ...preview.partB.rows,
                        { label: "B. Total retirals", perAnnum: preview.partB.total.perAnnum, perMonth: preview.partB.total.perMonth },
                        { label: "Fixed CTC (A + B)", perAnnum: preview.partB.fixedCtc.perAnnum, perMonth: preview.partB.fixedCtc.perMonth },
                        { label: "C. Performance pay", perAnnum: preview.partB.performancePay.perAnnum, perMonth: preview.partB.performancePay.perMonth },
                        { label: "Total CTC (A + B + C)", perAnnum: preview.partB.totalCtc.perAnnum, perMonth: preview.partB.totalCtc.perMonth },
                        ...preview.partC.rows,
                        { label: "Indicative take-home", perAnnum: preview.partC.indicativeNet.perAnnum, perMonth: preview.partC.indicativeNet.perMonth },
                      ].map((r: any, i) => (
                        <tr key={i} className={/^(A\.|B\.|Fixed|Total|Indicative)/.test(r.label) ? "font-semibold bg-brand-soft/60" : "border-t border-line"}>
                          <td className="p-1.5">{r.label}</td>
                          <td className="p-1.5 text-right">{typeof r.perAnnum === "number" ? inr(r.perAnnum) : r.perAnnum}</td>
                          <td className="p-1.5 text-right">{typeof r.perMonth === "number" ? inr(r.perMonth) : r.perMonth}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-steel-muted mb-2">3. Details Printed On The Letters</p>
              <div className="grid md:grid-cols-4 gap-3">
                <Select label="Gender (Mr. / Ms. on letter)" value={letter.gender} onChange={(e) => setLetter({ ...letter, gender: e.target.value })}>
                  <option value="">Not specified</option>
                  <option>Male</option>
                  <option>Female</option>
                </Select>
                {L("phone", "Mobile")}
                {L("workingHours", "Working hours")}
                {L("reportingTime", "Reporting time on day 1")}
                <TextArea label="Candidate address" rows={2} fieldClassName="md:col-span-2" value={letter.address} onChange={(e) => setLetter({ ...letter, address: e.target.value })} />
                <TextArea label="Reporting address on day 1" rows={2} fieldClassName="md:col-span-2" value={letter.reportingAddress} onChange={(e) => setLetter({ ...letter, reportingAddress: e.target.value })} />
                {L("probationNotice", "Notice in probation (days)", { type: "number" })}
                {L("employeeNotice", "Notice by employee (days)", { type: "number" })}
                {L("companyNotice", "Notice by SPDC (days)", { type: "number" })}
                <div className="grid grid-cols-2 gap-2">
                  {L("clDays", "CL / year", { type: "number" })}
                  {L("slDays", "SL / year", { type: "number" })}
                </div>
                <TextArea label="Notes / special terms" rows={2} fieldClassName="md:col-span-4" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </section>

            <Button type="submit" disabled={saving}>
              {saving ? "Generating offer letter…" : editId ? "Save changes and regenerate letter" : "Save offer and generate letter"}
            </Button>
          </form>
        </Card>
      )}

      {loginNote && (
        <Card className="border-brand/40">
          <p className="text-sm font-semibold">Portal login {loginNote.created ? "created" : "linked"}</p>
          <p className="text-xs mt-1">
            Login: <span className="font-mono">{loginNote.email}</span>
            {loginNote.password ? (
              <>
                {" "}
                · One-time password: <span className="font-mono font-semibold">{loginNote.password}</span> — share it with the joinee privately; it is not shown again. Manage the login under HRMS · Users.
              </>
            ) : (
              " · This person already had a login; it is now linked to the offer. Reset the password under HRMS · Users if needed."
            )}
          </p>
          <Button type="button" variant="secondary" className="!text-xs mt-2" onClick={() => setLoginNote(null)}>
            Done
          </Button>
        </Card>
      )}

      <Card padding={false}>
        <div className="px-4 py-3 border-b border-line bg-sand/40 flex justify-between">
          <span className="font-semibold text-sm">Offers</span>
          <span className="text-[11px] text-steel-muted">{offers.length} entries</span>
        </div>
        <div className="divide-y divide-line">
          {offers.map((o: any) => {
            const st = stepState(o);
            const busy = (k: string) => rowBusy === `${o.id}:${k}`;
            return (
              <div key={o.id} className="p-3 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-sm">
                      {o.candidate?.fullName} <span className="font-mono text-[11px] text-steel-muted">· {o.offerNo}</span>
                    </div>
                    <div className="text-xs text-steel-muted">
                      {o.designation}
                      {o.department ? ` · ${o.department}` : ""} · {inr(o.ctcAnnual)} p.a. · Joining {o.joiningDate ? new Date(o.joiningDate).toLocaleDateString("en-IN") : "—"}
                      {o.empCode ? ` · ${o.empCode}` : ""}
                    </div>
                  </div>
                  <Badge tone={["Accepted", "Onboarding", "Joined"].includes(o.status) ? "ok" : ["Declined", "Withdrawn"].includes(o.status) ? "danger" : "brand"}>{o.status}</Badge>
                </div>
                <ol className="flex flex-wrap gap-1.5 text-[11px]">
                  {STEPS.map((s, i) => (
                    <li key={s.key} className={`rounded-full border px-2 py-0.5 ${st[s.key] ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-line text-steel-muted"}`}>
                      {i + 1}. {s.label}
                    </li>
                  ))}
                </ol>
                <div className="flex flex-wrap gap-1.5">
                  {o.offerLetterDocId ? (
                    <>
                      <Button type="button" variant="secondary" className="!text-xs !py-1" onClick={() => void downloadAuthFile(`/api/hrm/hrms-documents/${o.offerLetterDocId}/preview.docx`, token, `Offer-Letter-${o.candidate?.fullName || o.offerNo}.docx`).catch((e) => setMsg(e.message))}>
                        Offer letter (Word)
                      </Button>
                      <a className="ui-btn inline-flex items-center rounded-xl px-3 py-1 text-xs font-semibold border border-line" href={`/api/hrm/hrms-documents/${o.offerLetterDocId}/preview?token=${encodeURIComponent(token || "")}`} target="_blank" rel="noreferrer">
                        Offer letter (print / PDF)
                      </a>
                    </>
                  ) : o.offerLetterUrl ? (
                    <a className="text-brand text-xs self-center" href={o.offerLetterUrl} target="_blank" rel="noreferrer">
                      Uploaded offer letter
                    </a>
                  ) : null}
                  {o.ctcInputsJson ? (
                    <a className="ui-btn inline-flex items-center rounded-xl px-3 py-1 text-xs font-semibold border border-line" href={`/api/hrm/offers/${o.id}/annexure.xlsx?token=${encodeURIComponent(token || "")}`}>
                      Annexure I (Excel)
                    </a>
                  ) : null}
                  {canManage && (
                    <>
                      {["Draft", "Approved"].includes(o.status) && (
                        <>
                          <Button type="button" variant="secondary" className="!text-xs !py-1" onClick={() => startEdit(o)}>
                            Edit offer
                          </Button>
                          <Button type="button" variant="secondary" className="!text-xs !py-1" disabled={busy("regen")} onClick={() => void act(o, "regen", () => api(`/api/hrm/offers/${o.id}/offer-letter`, { method: "POST", token }), "Offer letter regenerated.")}>
                            {busy("regen") ? "Generating…" : "Regenerate letter"}
                          </Button>
                          <Button type="button" className="!text-xs !py-1" disabled={busy("Sent")} onClick={() => void status(o, "Sent", "Offer marked as sent to the candidate.")}>
                            Mark sent
                          </Button>
                        </>
                      )}
                      {o.status === "Sent" && (
                        <>
                          <Button type="button" className="!text-xs !py-1" disabled={busy("Accepted")} onClick={() => void status(o, "Accepted", "Offer accepted. Pre-joining checklist opened.")}>
                            Candidate accepted
                          </Button>
                          <Button type="button" variant="secondary" className="!text-xs !py-1" disabled={busy("Declined")} onClick={() => void status(o, "Declined", "Offer marked declined.")}>
                            Declined
                          </Button>
                        </>
                      )}
                      {["Accepted", "Onboarding", "Joined"].includes(o.status) && (
                        <>
                          <Link to={`/hrm/onboarding/${o.id}`} className="ui-btn inline-flex items-center rounded-xl px-3 py-1 text-xs font-semibold border border-line">
                            Pre-joining checklist
                          </Link>
                          <Button
                            type="button"
                            className="!text-xs !py-1"
                            disabled={busy("appt") || !o.appointmentReady}
                            title={o.appointmentReady ? "" : "Finish documents, background check, medical and the employee code in the pre-joining checklist first"}
                            onClick={() => void act(o, "appt", () => api(`/api/hrm/offers/${o.id}/appointment-letter`, { method: "POST", token }), "Appointment letter generated and filed in the employee's HR folder.")}
                          >
                            {busy("appt") ? "Generating…" : o.appointmentLetterUrl ? "Regenerate appointment letter" : "Generate appointment letter"}
                          </Button>
                          {!o.appointmentReady && <span className="text-[11px] text-steel-muted self-center">Appointment letter unlocks when pre-joining is complete.</span>}
                          <Button
                            type="button"
                            variant={o.onboard?.userId ? "secondary" : "primary"}
                            className="!text-xs !py-1"
                            disabled={busy("login")}
                            onClick={() =>
                              void act(
                                o,
                                "login",
                                async () => {
                                  const out = await api<{ email: string; password: string | null; created: boolean }>(`/api/hrm/offers/${o.id}/portal-login`, { method: "POST", token });
                                  setLoginNote(out);
                                },
                                "Portal login ready.",
                              )
                            }
                          >
                            {busy("login") ? "Creating…" : o.onboard?.userId ? "Sync portal login" : "Create portal login"}
                          </Button>
                          {o.status !== "Joined" && (
                            <Button type="button" variant="secondary" className="!text-xs !py-1" disabled={busy("Joined")} onClick={() => void status(o, "Joined", "Marked as joined.")}>
                              Mark joined
                            </Button>
                          )}
                        </>
                      )}
                      {!["Declined", "Withdrawn", "Joined"].includes(o.status) && (
                        <Button type="button" variant="ghost" className="!text-xs !py-1" disabled={busy("Withdrawn")} onClick={() => window.confirm("Withdraw this offer?") && void status(o, "Withdrawn", "Offer withdrawn.")}>
                          Withdraw
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {!offers.length && <p className="py-4 text-center text-sm text-steel-muted">No offers yet. Make one above once the scorecards are done.</p>}
        </div>
      </Card>
    </div>
  );
}
