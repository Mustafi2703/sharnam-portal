import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, mediaUrl } from "../api";
import { useAuth } from "../auth";
import { SearchableSelect } from "../components/SearchableSelect";
import { InterviewScorecard } from "../components/InterviewScorecard";
import { Badge, Button, Card, Input, Select, TextArea } from "../components/ui";
import { canManageHrms } from "../lib/portalAccounts";
import { hrFileContentUrl, isHrImage } from "../lib/hrFileView";
import {
  CANDIDATE_STAGES,
  candidateStageLabel,
  candidateStageTone,
  designationsForDepartment,
  INTERVIEWER_SEATS,
  scorecardRoleForDesignation,
  SPDC_HIRING_DEPARTMENTS,
  SPDC_HIRING_ROLES,
} from "@sharnam/shared";
import { StatusNote } from "../components/StatusNote";
import { formatUiText } from "../lib/formatUiText";

/**
 * Recruitment & Interview Management — one page, six tabs walking through the flow.
 * All routes: /api/hrm/{requisitions,postings,candidates,interviews,offers}
 */

const TABS = [
  { id: "requisitions", label: "Requisition" },
  { id: "candidates", label: "Resumes" },
  { id: "compare", label: "Compare" },
  { id: "interviews", label: "Scorecard" },
  { id: "offers", label: "Offers" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const TAB_HINTS: Record<TabId, string> = {
  requisitions: "Raise the role request",
  candidates: "Add resumes, book interviews",
  compare: "Rank people on one role",
  interviews: "Score each interview round",
  offers: "CTC + offer letter",
};

const OFFER_STAGES = ["Draft", "Approved", "Sent", "Accepted", "Declined", "Withdrawn", "Joined"] as const;
const INTERVIEW_STAGES = ["Scheduled", "Completed", "No-Show", "Cancelled"] as const;

const rowBtn = "!px-2.5 !py-1.5 !text-xs !rounded-lg whitespace-nowrap";
const linkBtn = "inline-flex items-center justify-center rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-[var(--color-brand-soft)]";

async function openOnboardingDesk(candidateId: string, token: string) {
  return api<{ offerId: string }>(`/api/hrm/candidates/${candidateId}/start-onboarding`, {
    method: "POST",
    token,
  });
}

function money(n?: number | null) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return "₹ " + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default function RecruitmentPage() {
  const { token, user } = useAuth();
  const canManage = canManageHrms(user);
  const [sp, setSp] = useSearchParams();
  const requested = (sp.get("tab") as TabId) || "requisitions";
  const tab: TabId = requested === ("postings" as TabId) || !TABS.some((t) => t.id === requested) ? "requisitions" : requested;

  const [reqs, setReqs] = useState<any[]>([]);
  const [postings, setPostings] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [msg, setMsg] = useState("");
  const [loadError, setLoadError] = useState("");

  const reload = async () => {
    try {
      const [r, p, c, o, people, depts] = await Promise.all([
        api<any[]>("/api/hrm/requisitions", { token }),
        api<any[]>("/api/hrm/postings", { token }),
        api<any[]>("/api/hrm/candidates", { token }),
        api<any[]>("/api/hrm/offers", { token }),
        api<any[]>("/api/hrm/employees", { token }).catch(() => []),
        api<any[]>("/api/hrm/departments", { token }).catch(() => []),
      ]);
      setReqs(r);
      setPostings(p);
      setCandidates(c);
      setOffers(o);
      setStaff(people);
      setDepartments(depts.map((d: any) => ({ id: d.id || d.name, name: d.name })));
      setLoadError("");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load recruitment");
    }
  };
  useEffect(() => {
    void reload();
  }, [token]);

  async function deleteAllRecruitment() {
    const ok = window.confirm("Delete all recruitment data? Requisitions, resumes, interviews, offers, and letters are removed. Staff logins and projects stay. This cannot be undone.");
    if (!ok) return;
    try {
      await api("/api/hrm/registers/clear", { method: "POST", token, body: JSON.stringify({ confirm: "CLEAR" }) });
      setMsg("Recruitment data deleted. Staff logins and projects are unchanged.");
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not delete recruitment data");
    }
  }

  return (
    <div className="space-y-6">
      <nav className="hr-steps" aria-label="Recruitment steps">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSp({ tab: t.id })}
            className={`hr-steps__btn${tab === t.id ? " is-on" : ""}`}
            aria-current={tab === t.id ? "step" : undefined}
          >
            <span className="hr-steps__num">{i + 1}</span>
            <span className="min-w-0">
              <span className="hr-steps__label">{formatUiText(t.label)}</span>
              <span className="hr-steps__hint">{formatUiText(TAB_HINTS[t.id])}</span>
            </span>
          </button>
        ))}
      </nav>

      <StatusNote msg={loadError} tone="danger" />
      <StatusNote msg={msg} onClose={() => setMsg("")} />

      {tab === "requisitions" && <RequisitionsTab reqs={reqs} canManage={canManage} reload={reload} setMsg={setMsg} token={token || ""} />}
      {tab === "candidates" && <CandidatesTab reqs={reqs} candidates={candidates} staff={staff} canManage={canManage} reload={reload} setMsg={setMsg} token={token || ""} />}
      {tab === "compare" && <CompareTab candidates={candidates} staff={staff} canManage={canManage} reload={reload} setMsg={setMsg} token={token || ""} />}
      {tab === "interviews" && <InterviewsTab candidates={candidates} staff={staff} canManage={canManage} reload={reload} setMsg={setMsg} token={token || ""} />}
      {tab === "offers" && <OffersTab candidates={candidates} offers={offers} canManage={canManage} reload={reload} setMsg={setMsg} token={token || ""} />}

      {canManage ? (
        <details className="danger-zone">
          <summary>{formatUiText("Danger zone — reset recruitment data")}</summary>
          <div className="danger-zone__body">
            <p>
              {formatUiText(
                "Permanently deletes every requisition, resume, interview, offer and recruitment letter. Staff logins and projects are kept. This cannot be undone.",
              )}
            </p>
            <Button type="button" variant="danger" onClick={() => deleteAllRecruitment()}>
              Delete all recruitment data
            </Button>
          </div>
        </details>
      ) : null}
    </div>
  );
}

/* ────────────────────────────  1  Requisitions  ──────────────────────────── */

function RequisitionsTab({ reqs, canManage, reload, setMsg, token }: any) {
  const blank = { requisitionNo: "", department: "", designation: "", count: 1, employmentType: "Permanent", reportingManager: "", justification: "", urgency: "Normal", ctcRangeMin: "", ctcRangeMax: "", location: "" };
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState<string | null>(null);
  const designationOptions = designationsForDepartment(form.department);
  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      if (editId) {
        await api(`/api/hrm/requisitions/${editId}`, { method: "PATCH", token, body: JSON.stringify(form) });
        setMsg("Requisition updated.");
      } else {
        await api("/api/hrm/requisitions", { method: "POST", token, body: JSON.stringify(form) });
        setMsg("Requisition submitted.");
      }
      setEditId(null);
      setForm(blank);
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }
  async function removeReq(r: any) {
    const n = r._count?.candidates || 0;
    const extra = n ? ` ${n} resume${n === 1 ? "" : "s"} stay in the database, no longer attached to this requisition.` : "";
    if (!window.confirm(`Delete ${r.requisitionNo}?${extra}`)) return;
    try {
      await api(`/api/hrm/requisitions/${r.id}`, { method: "DELETE", token });
      setMsg(`${r.requisitionNo} deleted.`);
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not delete the requisition");
    }
  }
  async function transition(id: string, status: string, note?: string) {
    await api(`/api/hrm/requisitions/${id}`, { method: "PATCH", token, body: JSON.stringify({ status, rejectionReason: note }) });
    await reload();
  }
  return (
    <div className="space-y-3">
      {canManage && (
        <Card>
          <h3 className="font-semibold text-sm mb-2">Raise a manpower requisition</h3>
          <form onSubmit={add} className="grid md:grid-cols-4 gap-x-3 gap-y-3">
            <Input label="Requisition no." hint={formatUiText("Leave blank to auto-number")} placeholder="Auto" value={form.requisitionNo} onChange={(e) => setForm({ ...form, requisitionNo: e.target.value })} />
            <Select
              label="Department *"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value, designation: "" })}
              required
            >
              <option value="">{formatUiText("Select department")}</option>
              {SPDC_HIRING_DEPARTMENTS.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </Select>
            <Select label="Designation *" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} required disabled={!form.department}>
              <option value="">{formatUiText(form.department ? "Select designation" : "Choose department first")}</option>
              {designationOptions.map((row) => (
                <option key={row.title} value={row.title}>{row.title}</option>
              ))}
            </Select>
            <Input label="Head count" placeholder="1" type="number" min={1} value={form.count} onChange={(e) => setForm({ ...form, count: Number(e.target.value) })} />
            <Select label="Employment type" value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })}>
              {["Permanent", "Contract", "Consultant", "Intern"].map((v) => <option key={v}>{v}</option>)}
            </Select>
            <Input label="Reporting manager" placeholder="Name" value={form.reportingManager} onChange={(e) => setForm({ ...form, reportingManager: e.target.value })} />
            <Input label="Location" placeholder="Office / site" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <Select label="Urgency" value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })}>
              {["Normal", "Priority", "Critical"].map((v) => <option key={v}>{v}</option>)}
            </Select>
            <Input label="CTC min (₹ / year)" placeholder="e.g. 600000" type="number" value={form.ctcRangeMin} onChange={(e) => setForm({ ...form, ctcRangeMin: e.target.value })} />
            <Input label="CTC max (₹ / year)" placeholder="e.g. 900000" type="number" value={form.ctcRangeMax} onChange={(e) => setForm({ ...form, ctcRangeMax: e.target.value })} />
            <TextArea label="Job description / justification" fieldClassName="md:col-span-4" rows={2} placeholder="Why the role is needed, key responsibilities" value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })} />
            <div className="md:col-span-4 flex gap-2">
              <Button type="submit">{editId ? "Save requisition" : "Submit requisition"}</Button>
              {editId ? (
                <Button type="button" variant="secondary" onClick={() => { setEditId(null); setForm(blank); }}>Cancel</Button>
              ) : null}
            </div>
          </form>
        </Card>
      )}
      <Card padding={false}>
        <div className="px-4 py-3 border-b border-line bg-sand/40 flex justify-between">
          <span className="font-semibold text-sm">Requisitions</span>
          <span className="text-[11px] text-steel-muted">{reqs.length} entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-xs">
            <thead className="text-left text-steel-muted bg-white">
              <tr><th>Req No</th><th>Dept</th><th>Designation</th><th>Count</th><th>Type</th><th>Range</th><th>Urgency</th><th>Resumes</th><th>Status</th><th className="no-print"></th></tr>
            </thead>
            <tbody>
              {reqs.map((r: any) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="p-2 font-mono">{r.requisitionNo}</td>
                  <td>{r.department}</td>
                  <td>{r.designation}</td>
                  <td className="text-right">{r.count}</td>
                  <td>{r.employmentType}</td>
                  <td>{r.ctcRangeMin ? money(r.ctcRangeMin) : "—"} – {r.ctcRangeMax ? money(r.ctcRangeMax) : "—"}</td>
                  <td>{r.urgency}</td>
                  <td>{r._count?.candidates ?? 0}</td>
                  <td><Badge tone={r.status === "Approved" ? "ok" : r.status === "Rejected" ? "danger" : "warn"}>{r.status}</Badge></td>
                  <td>
                    {canManage && (
                      <span className="flex flex-wrap gap-1.5">
                        {r.status === "Submitted" && (
                          <>
                            <Button type="button" className={rowBtn} onClick={() => transition(r.id, "Approved")}>Approve</Button>
                            <Button type="button" variant="danger" className={rowBtn} onClick={() => transition(r.id, "Rejected", "not approved")}>Reject</Button>
                          </>
                        )}
                        <Button
                          type="button"
                          variant="secondary"
                          className={rowBtn}
                          onClick={() => {
                            setEditId(r.id);
                            setForm({
                              requisitionNo: r.requisitionNo || "",
                              department: r.department || "",
                              designation: r.designation || "",
                              count: r.count || 1,
                              employmentType: r.employmentType || "Permanent",
                              reportingManager: r.reportingManager || "",
                              justification: r.justification || "",
                              urgency: r.urgency || "Normal",
                              ctcRangeMin: r.ctcRangeMin ?? "",
                              ctcRangeMax: r.ctcRangeMax ?? "",
                              location: r.location || "",
                            });
                          }}
                        >
                          Edit
                        </Button>
                        <Button type="button" variant="danger" className={rowBtn} onClick={() => void removeReq(r)}>Delete</Button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {!reqs.length && <tr><td colSpan={10} className="py-4 text-center text-steel-muted">No requisitions yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ────────────────────────────  2  Postings  ──────────────────────────── */

function PostingsTab({ reqs, postings, departments, canManage, reload, setMsg, token }: any) {
  const [form, setForm] = useState({ requisitionId: "", title: "", department: "", location: "", employmentType: "Permanent", description: "", requirements: "", channels: "LinkedIn, Naukri, Website" });
  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      const body = { ...form, channels: form.channels.split(",").map((s) => s.trim()).filter(Boolean) };
      await api("/api/hrm/postings", { method: "POST", token, body: JSON.stringify(body) });
      setForm({ requisitionId: "", title: "", department: "", location: "", employmentType: "Permanent", description: "", requirements: "", channels: "LinkedIn, Naukri, Website" });
      setMsg("Job posting published.");
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }
  const approvedReqs = reqs.filter((r: any) => r.status === "Approved");
  return (
    <div className="space-y-3">
      {canManage && (
        <Card>
          <h3 className="font-semibold text-sm mb-1">Post a job (LinkedIn / Naukri / Website)</h3>
          <p className="text-[11px] text-steel-muted mb-2">
            Publish here logs the posting in Sharnam and Activity. Posting to LinkedIn/Naukri is manual — note channels below.
          </p>
          <form onSubmit={add} className="grid md:grid-cols-3 gap-2">
            <Select
              value={form.requisitionId}
              onChange={(e) => {
                const requisitionId = e.target.value;
                const linked = approvedReqs.find((r: { id: string; designation?: string }) => r.id === requisitionId);
                const title = linked && (SPDC_HIRING_ROLES as readonly string[]).includes(linked.designation || "")
                  ? linked.designation || ""
                  : form.title;
                setForm({ ...form, requisitionId, title });
              }}
            >
              <option value="">Link approved requisition (optional)</option>
              {approvedReqs.map((r: any) => <option key={r.id} value={r.id}>{r.requisitionNo} · {r.designation}</option>)}
            </Select>
            <Select value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required>
              <option value="">Position</option>
              {SPDC_HIRING_ROLES.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </Select>
            <Select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
              <option value="">Department</option>
              {departments.map((d: any) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </Select>
            <Input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <Select value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })}>
              {["Permanent", "Contract", "Consultant", "Intern"].map((v) => <option key={v}>{v}</option>)}
            </Select>
            <Input placeholder="Channels (comma separated)" value={form.channels} onChange={(e) => setForm({ ...form, channels: e.target.value })} />
            <TextArea rows={3} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="md:col-span-3" />
            <TextArea rows={2} placeholder="Requirements (skills, experience)" value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} className="md:col-span-3" />
            <Button type="submit" className="md:col-span-3">Publish posting</Button>
          </form>
        </Card>
      )}
      <Card padding={false}>
        <div className="px-4 py-3 border-b border-line bg-sand/40 flex justify-between">
          <span className="font-semibold text-sm">Postings</span>
          <span className="text-[11px] text-steel-muted">{postings.length} entries</span>
        </div>
        <ul className="divide-y">
          {postings.map((p: any) => (
            <li key={p.id} className="px-4 py-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{p.title}</div>
                <div className="text-xs text-steel-muted">
                  {p.department || "—"} · {p.location || "—"} · {p.employmentType}
                  {p.requisition && <> · req <span className="font-mono">{p.requisition.requisitionNo}</span></>}
                  {" · "}<Badge tone={p.status === "Open" ? "ok" : "warn"}>{p.status}</Badge>
                  {p.postedAt ? <> · posted {new Date(p.postedAt).toLocaleDateString("en-IN")}</> : null}
                </div>
                <div className="text-[10px] text-steel-muted mt-0.5">
                  {(() => {
                    try {
                      return (JSON.parse(p.channelsJson || "[]") as string[]).join(" · ");
                    } catch { return ""; }
                  })()}
                </div>
              </div>
              <div className="text-right text-xs">
                <div className="font-semibold text-ink">{p._count?.candidates ?? 0} applicants</div>
                <div className="text-steel-muted">Resume DB</div>
              </div>
            </li>
          ))}
          {!postings.length && <li className="px-4 py-6 text-center text-sm text-steel-muted">No postings yet.</li>}
        </ul>
      </Card>
    </div>
  );
}

/* ────────────────────────────  3  Candidates / Resume DB  ──────────────────────────── */

function CandidatesTab({ reqs, candidates, staff, canManage, reload, setMsg, token }: any) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ requisitionId: "", fullName: "", email: "", phone: "", sourceChannel: "LinkedIn", currentCompany: "", currentDesign: "", currentCtc: "", expectedCtc: "", noticePeriodDays: "", experienceYears: "", skills: "", location: "" });
  const [filterReq, setFilterReq] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [edit, setEdit] = useState<any>(null);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [docsFor, setDocsFor] = useState<string | null>(null);
  const [docCategory, setDocCategory] = useState("PAN");
  const [docFile, setDocFile] = useState<File | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v && fd.append(k, String(v)));
      if (file) fd.append("resume", file);
      await api("/api/hrm/candidates", { method: "POST", token, body: fd });
      setForm({ requisitionId: form.requisitionId, fullName: "", email: "", phone: "", sourceChannel: "LinkedIn", currentCompany: "", currentDesign: "", currentCtc: "", expectedCtc: "", noticePeriodDays: "", experienceYears: "", skills: "", location: "" });
      setFile(null);
      setMsg(
        file
          ? "Resume received. Next step is the interview and scorecard."
          : "Saved as Upload resume. Attach the file on this row to move them to Resume received.",
      );
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function clearRegisters() {
    const ok = window.confirm("Delete all recruitment data? Requisitions, resumes, interviews, offers, and letters are removed. Staff logins and projects stay. This cannot be undone.");
    if (!ok) return;
    try {
      await api("/api/hrm/registers/clear", { method: "POST", token, body: JSON.stringify({ confirm: "CLEAR" }) });
      setMsg("HR registers cleared. Add one candidate, then schedule one interview — the scorecard opens on that round.");
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not clear registers");
    }
  }
  function openEdit(c: any) {
    setOpenId(c.id);
    setEditFile(null);
    setEdit({
      fullName: c.fullName || "",
      email: c.email || "",
      phone: c.phone || "",
      currentCompany: c.currentCompany || "",
      currentDesign: c.currentDesign || "",
      location: c.location || "",
      currentCtc: c.currentCtc ?? "",
      expectedCtc: c.expectedCtc ?? "",
      noticePeriodDays: c.noticePeriodDays ?? "",
      experienceYears: c.experienceYears ?? "",
      skills: c.skills || "",
      sourceChannel: c.sourceChannel || "LinkedIn",
      status: c.status,
    });
  }

  async function saveEdit(id: string) {
    try {
      await api(`/api/hrm/candidates/${id}`, { method: "PATCH", token, body: JSON.stringify(edit) });
      if (editFile) {
        const fd = new FormData();
        fd.append("resume", editFile);
        await api(`/api/hrm/candidates/${id}/resume`, { method: "POST", token, body: fd });
      }
      setMsg(editFile ? "Resume received. Next step is the interview." : "Candidate updated.");
      setOpenId(null);
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not save");
    }
  }

  async function removeCandidate(c: any) {
    if (!window.confirm(`Delete ${c.fullName}? Their interviews and offers are removed. Staff logins stay.`)) return;
    try {
      await api(`/api/hrm/candidates/${c.id}`, { method: "DELETE", token });
      if (openId === c.id) setOpenId(null);
      setMsg(`${c.fullName} removed from the register.`);
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not delete");
    }
  }

  async function removeDuplicates() {
    if (!window.confirm("Keep one row per email (the one with an interview, score, or resume) and delete the copies?")) return;
    try {
      const res = await api<{ removed: number; remaining: number }>("/api/hrm/candidates/dedupe", { method: "POST", token });
      setMsg(res.removed ? `Removed ${res.removed} duplicate rows. ${res.remaining} people remain.` : "No duplicate rows.");
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not remove duplicates");
    }
  }

  async function removeDocument(c: any, doc: any) {
    if (!window.confirm(`Remove the ${doc.category} file for ${c.fullName}?`)) return;
    try {
      await api(`/api/hrm/candidates/${c.id}/documents/${doc.id}`, { method: "DELETE", token });
      setMsg(`${doc.category} removed.`);
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not delete the document");
    }
  }

  async function uploadDocument(c: any) {
    if (!docFile) {
      setMsg("Choose the background document to upload.");
      return;
    }
    try {
      const fd = new FormData();
      fd.append("file", docFile);
      fd.append("category", docCategory);
      await api(`/api/hrm/candidates/${c.id}/documents`, { method: "POST", token, body: fd });
      setDocFile(null);
      setMsg(`${docCategory} filed for ${c.fullName}. When PAN and the other checks are in, convert them to an employee, then generate letters.`);
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not upload the document");
    }
  }

  async function goOnboard(c: any) {
    try {
      const desk = await openOnboardingDesk(c.id, token);
      navigate(`/hrm/onboarding/${desk.offerId}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not open onboarding");
    }
  }

  const approvedReqs = (reqs || []).filter((r: any) => r.status === "Approved");
  const filtered = candidates.filter((c: any) => {
    if (filterReq && c.requisition?.id !== filterReq && c.requisitionId !== filterReq) return false;
    if (filterStage && c.status !== filterStage) return false;
    if (search) {
      const q = search.toLowerCase();
      return [c.fullName, c.email, c.phone, c.skills, c.requisition?.requisitionNo, c.requisition?.designation].some((v) => (v || "").toLowerCase().includes(q));
    }
    return true;
  });
  const compared = filterReq
    ? [...filtered].sort((a, b) => {
        const score = (row: any) => Math.max(0, ...(row.interviews || []).map((r: any) => Number(r.scoreOverall) || 0));
        return score(b) - score(a);
      })
    : [];

  return (
    <div className="space-y-3">
      {canManage && (
        <Card>
          <h3 className="font-semibold text-sm mb-2">Add candidate (resume DB)</h3>
          <form onSubmit={add} className="grid md:grid-cols-4 gap-2">
            <Select value={form.requisitionId} onChange={(e) => setForm({ ...form, requisitionId: e.target.value })} required className="md:col-span-2">
              <option value="">Approved requisition</option>
              {approvedReqs.map((r: any) => (
                <option key={r.id} value={r.id}>{r.requisitionNo} · {r.department} · {r.designation}</option>
              ))}
            </Select>
            <Input placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
            <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Select value={form.sourceChannel} onChange={(e) => setForm({ ...form, sourceChannel: e.target.value })}>
              {["LinkedIn", "Naukri", "Website", "Referral", "Instahyre", "Other"].map((v) => <option key={v}>{v}</option>)}
            </Select>
            <Input placeholder="Current company" value={form.currentCompany} onChange={(e) => setForm({ ...form, currentCompany: e.target.value })} />
            <Input placeholder="Current designation" value={form.currentDesign} onChange={(e) => setForm({ ...form, currentDesign: e.target.value })} />
            <Input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <Input placeholder="Current CTC (₹/yr)" type="number" value={form.currentCtc} onChange={(e) => setForm({ ...form, currentCtc: e.target.value })} />
            <Input placeholder="Expected CTC (₹/yr)" type="number" value={form.expectedCtc} onChange={(e) => setForm({ ...form, expectedCtc: e.target.value })} />
            <Input placeholder="Notice (days)" type="number" value={form.noticePeriodDays} onChange={(e) => setForm({ ...form, noticePeriodDays: e.target.value })} />
            <Input placeholder="Experience (yrs)" type="number" value={form.experienceYears} onChange={(e) => setForm({ ...form, experienceYears: e.target.value })} />
            <TextArea rows={2} placeholder="Skills (comma-separated)" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} className="md:col-span-4" />
            <label className="md:col-span-4 text-xs text-steel-muted">
              Resume (PDF / DOC)
              <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block mt-1 text-xs" />
            </label>
            <Button type="submit" className="md:col-span-4" disabled={saving}>{saving ? "Adding…" : "Add candidate"}</Button>
            <p className="md:col-span-4 text-[11px] text-steel-muted">The person is filed on the requisition you pick. With a resume the stage is Resume received. Without one it stays Upload resume until you attach the file.</p>
          </form>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <Input placeholder="Search name / email / skill" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        {canManage && (
          <>
            <Button type="button" variant="secondary" onClick={() => void removeDuplicates()}>
              Remove duplicates
            </Button>
          </>
        )}
        <Select value={filterReq} onChange={(e) => setFilterReq(e.target.value)} className="max-w-xs">
          <option value="">All requisitions</option>
          {(reqs || []).map((r: any) => (
            <option key={r.id} value={r.id}>{r.requisitionNo} · {r.designation}</option>
          ))}
        </Select>
        <Select value={filterStage} onChange={(e) => setFilterStage(e.target.value)} className="max-w-xs">
          <option value="">All stages</option>
          {CANDIDATE_STAGES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
        <span className="text-xs text-steel-muted">{filtered.length} / {candidates.length}</span>
      </div>

      {filterReq && (
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-line bg-sand/40 font-semibold text-sm">
            Compare · {(reqs || []).find((r: any) => r.id === filterReq)?.requisitionNo} · {(reqs || []).find((r: any) => r.id === filterReq)?.designation}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[640px] w-full text-xs">
              <thead className="text-left text-steel-muted">
                <tr>
                  <th className="p-2">Rank</th>
                  <th>Name</th>
                  <th>Stage</th>
                  <th className="text-right">Best score</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {compared.map((c: any, i: number) => {
                  const rounds = c.interviews || [];
                  const best = rounds.reduce((n: number, r: any) => Math.max(n, Number(r.scoreOverall) || 0), 0);
                  const decision = rounds.map((r: any) => r.decision).filter(Boolean).slice(-1)[0];
                  return (
                    <tr key={c.id} className="border-t border-line">
                      <td className="p-2">{i + 1}</td>
                      <td className="font-medium">{c.fullName}</td>
                      <td>{candidateStageLabel(c.status)}</td>
                      <td className="text-right">{best ? `${best}%` : "—"}</td>
                      <td>{decision || "—"}</td>
                    </tr>
                  );
                })}
                {!compared.length && <tr><td colSpan={5} className="py-4 text-center text-steel-muted">No resumes on this requisition yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wide text-steel-muted bg-sand/50">
              <tr>
                <th className="px-3 py-2">Candidate</th>
                <th className="px-3 py-2">Requisition</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Progress</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
          {filtered.map((c: any) => {
            const employee = (staff || []).find((s: any) => c.email && s.email && String(s.email).toLowerCase() === String(c.email).toLowerCase());
            const scored = (c.interviews || []).some((r: any) => r.scoreOverall != null);
            const lettersReady = Boolean(employee);
            const hasResume = Boolean(c.resumeUrl);
            const docCount = (c.documents || []).length;
            const stage = !hasResume && (c.status === "New" || c.status === "Upload" || !c.status) ? "Upload" : c.status;
            const best = (c.interviews || []).reduce((n: number, r: any) => Math.max(n, Number(r.scoreOverall) || 0), 0);
            return (
              <Fragment key={c.id}>
              <tr className="border-t border-line align-top">
                <td className="px-3 py-3">
                  <div className="font-semibold">{c.fullName}</div>
                  <div className="text-xs text-steel-muted">{c.currentCompany || c.currentDesign || "—"}</div>
                </td>
                <td className="px-3 py-3 text-xs">
                  {c.requisition ? (
                    <>
                      <div className="font-medium">{c.requisition.requisitionNo}</div>
                      <div className="text-steel-muted">{c.requisition.department} · {c.requisition.designation}</div>
                    </>
                  ) : "No requisition"}
                </td>
                <td className="px-3 py-3 text-xs">
                  <div>{c.email || "No email"}</div>
                  <div className="text-steel-muted">{c.phone || "No phone"}</div>
                </td>
                <td className="px-3 py-3">
                  <Badge tone={candidateStageTone(stage)}>{candidateStageLabel(stage)}</Badge>
                  {best ? <div className="text-[11px] text-steel-muted mt-1">Best score {best}%</div> : null}
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1 max-w-[220px]">
                    <Badge tone={hasResume ? "ok" : "neutral"}>{hasResume ? "Resume" : "No resume"}</Badge>
                    <Badge tone={(c.interviews || []).length ? "ok" : "neutral"}>{(c.interviews || []).length ? "Interview" : "No interview"}</Badge>
                    <Badge tone={scored ? "ok" : "neutral"}>{scored ? "Scored" : "No score"}</Badge>
                    <Badge tone={docCount ? "ok" : "neutral"}>{docCount ? `${docCount} docs` : "No docs"}</Badge>
                  </div>
                </td>
                <td className="px-3 py-3">
                <div className="flex flex-wrap gap-1.5 max-w-[280px]">
                  {hasResume ? (
                    <a href={mediaUrl(c.resumeUrl)} target="_blank" rel="noreferrer" className={linkBtn}>Open resume</a>
                  ) : canManage ? (
                    <Button type="button" className={rowBtn} onClick={() => openEdit(c)}>Upload resume</Button>
                  ) : null}
                  {hasResume ? (
                    <Link to={`/hrm/recruitment?tab=interviews&candidateId=${c.id}`} className={linkBtn}>Interview</Link>
                  ) : null}
                  {canManage && <Button type="button" variant="secondary" className={rowBtn} onClick={() => openEdit(c)}>Edit</Button>}
                  {canManage && <Button type="button" variant="danger" className={rowBtn} onClick={() => void removeCandidate(c)}>Delete</Button>}
                  {canManage && (
                    <Button type="button" variant="secondary" className={rowBtn} onClick={() => setDocsFor(docsFor === c.id ? null : c.id)}>
                      Documents{docCount ? ` (${docCount})` : ""}
                    </Button>
                  )}
                  {canManage && onboardReady(c) && (
                    <Button type="button" className={rowBtn} onClick={() => void goOnboard(c)}>Onboard</Button>
                  )}
                  {lettersReady ? (
                    <Link to={`/hrm/documents?employeeUserId=${employee.id}`} className={linkBtn}>Letters</Link>
                  ) : null}
                </div>
                </td>
              </tr>
              {(docsFor === c.id || openId === c.id) && (
              <tr className="border-t border-line bg-sand/20">
                <td colSpan={6} className="px-3 py-3">
                {docsFor === c.id && (
                  <form
                    className="grid md:grid-cols-4 gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void uploadDocument(c);
                    }}
                  >
                    <p className="md:col-span-4 text-[11px] text-steel-muted">Offer letter stays locked until these are on SharePoint: PAN, Aadhaar, Education, Experience, Salary slips, Address proof, Photo, and Bank. Each person has a folder inside the requisition. Once they are onboarded, the same files are stored in their employee file. The count matches Onboarding.</p>
                    <div className="md:col-span-4 max-h-36 overflow-y-auto space-y-1">
                    {(c.documents || []).map((d: any) => (
                      <span key={d.id} className="flex items-center gap-2 text-xs">
                        {isHrImage(d) ? (
                          <img src={hrFileContentUrl(d.id, token)} alt={d.category} className="h-10 w-10 rounded border border-line object-cover bg-sand" />
                        ) : null}
                        <a href={isHrImage(d) ? hrFileContentUrl(d.id, token) : mediaUrl(d.fileUrl)} target="_blank" rel="noreferrer" className={linkBtn}>{d.category}</a>
                        {canManage && (
                          <Button type="button" variant="danger" className={rowBtn} onClick={() => void removeDocument(c, d)}>Delete</Button>
                        )}
                      </span>
                    ))}
                    </div>
                    <Select value={docCategory} onChange={(e) => setDocCategory(e.target.value)}>
                      {["Passport photo", "Photo", "PAN", "Aadhaar", "Education", "Experience", "Salary slips", "Address proof", "Bank", "PF-ESIC", "Medical", "BGV", "Other"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </Select>
                    <label className="md:col-span-2 text-xs text-steel-muted">
                      File
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => setDocFile(e.target.files?.[0] || null)} className="block mt-1 text-xs" />
                    </label>
                    <Button type="submit">Upload document</Button>
                  </form>
                )}
                {openId === c.id && edit && (
                  <form
                    className="mt-3 grid md:grid-cols-4 gap-2 border-t border-line pt-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void saveEdit(c.id);
                    }}
                  >
                    <Input value={edit.fullName} onChange={(e) => setEdit({ ...edit, fullName: e.target.value })} required />
                    <Input value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} placeholder="Email" />
                    <Input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} placeholder="Phone" />
                    <Input value={edit.currentCompany} onChange={(e) => setEdit({ ...edit, currentCompany: e.target.value })} placeholder="Company" />
                    <Input value={edit.currentDesign} onChange={(e) => setEdit({ ...edit, currentDesign: e.target.value })} placeholder="Designation" />
                    <Input value={edit.location} onChange={(e) => setEdit({ ...edit, location: e.target.value })} placeholder="Location" />
                    <Input type="number" value={edit.experienceYears} onChange={(e) => setEdit({ ...edit, experienceYears: e.target.value })} placeholder="Experience (yrs)" />
                    <Input type="number" value={edit.expectedCtc} onChange={(e) => setEdit({ ...edit, expectedCtc: e.target.value })} placeholder="Expected CTC" />
                    <Select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                      {CANDIDATE_STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </Select>
                    <label className="md:col-span-3 text-xs text-steel-muted">
                      Replace resume
                      <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setEditFile(e.target.files?.[0] || null)} className="block mt-1 text-xs" />
                    </label>
                    <div className="md:col-span-4 flex gap-2">
                      <Button type="submit">Save</Button>
                      <Button type="button" variant="secondary" onClick={() => setOpenId(null)}>Close</Button>
                    </div>
                  </form>
                )}
                </td>
              </tr>
              )}
              </Fragment>
            );
          })}
          {!filtered.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-steel-muted">No candidates match.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function bestScore(c: any) {
  return Math.max(0, ...(c.interviews || []).map((r: any) => Number(r.scoreOverall) || 0));
}

const SCHEDULE_ROUNDS = [
  { id: "R1" as const, label: "R1 – HR Screening" },
  { id: "R2" as const, label: "R2 – Technical" },
  { id: "R3" as const, label: "R3 – Management" },
];

function scheduledRoundId(roundType: string): "R1" | "R2" | "R3" | null {
  const t = String(roundType || "");
  if (/^R1\b/i.test(t) || /^hr\b/i.test(t) || /screen/i.test(t)) return "R1";
  if (/^R3\b/i.test(t) || /manag/i.test(t)) return "R3";
  if (/^R2\b/i.test(t) || /technical/i.test(t)) return "R2";
  return null;
}

function roundHit(c: any, id: "R1" | "R2" | "R3") {
  return (c.interviews || []).find((r: any) => scheduledRoundId(String(r.roundType || "")) === id);
}

function roundsByCode(interviews: any[]) {
  const best = new Map<string, any>();
  for (const row of interviews || []) {
    const id = scheduledRoundId(String(row.roundType || "")) || `other-${row.id}`;
    const prev = best.get(id);
    const score = Number(row.scoreOverall) || 0;
    const prevScore = prev ? Number(prev.scoreOverall) || 0 : -1;
    if (!prev || score > prevScore) best.set(id, row);
  }
  return [...best.values()];
}

function onboardReady(c: any) {
  if (c.status === "Rejected" || c.status === "Withdrawn") return false;
  const sat = roundsByCode(c.interviews || []).filter((r) => scheduledRoundId(String(r.roundType || "")));
  if (!sat.length) return false;
  return sat.every((r) => r.decision === "Advance");
}

function sheetLink(c: any) {
  for (const r of c.interviews || []) {
    try {
      const url = JSON.parse(r.scorecardJson || "{}").sharePointUrl as string | undefined;
      if (url && url.includes("sharepoint.com")) return url;
    } catch {
      /* ignore */
    }
  }
  return "";
}

function ScoreMeter({ label, value }: { label: string; value: number | null }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex justify-between text-[11px] text-steel-muted mb-1">
        <span>{label}</span>
        <span className="tabular-nums font-semibold text-ink">{value == null ? "—" : `${value}%`}</span>
      </div>
      <div className="h-1.5 rounded-full bg-sand overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--module-accent, #0D9488)" }} />
      </div>
    </div>
  );
}

function CompareTab({ candidates, staff, canManage, reload, setMsg, token }: any) {
  const navigate = useNavigate();
  const groups = useMemo(() => {
    const by = new Map<string, { title: string; rows: any[] }>();
    for (const c of candidates || []) {
      const id = c.requisition?.id || "none";
      const title = c.requisition
        ? `${c.requisition.requisitionNo} · ${c.requisition.department} · ${c.requisition.designation}`
        : "No requisition";
      if (!by.has(id)) by.set(id, { title, rows: [] });
      by.get(id)!.rows.push(c);
    }
    return [...by.values()]
      .map((g) => ({ ...g, rows: [...g.rows].sort((a, b) => bestScore(b) - bestScore(a)) }))
      .sort((a, b) => bestScore(b.rows[0]) - bestScore(a.rows[0]));
  }, [candidates]);

  async function removeCandidate(c: any) {
    if (!window.confirm(`Delete ${c.fullName} from this comparison? Their interviews and offers are removed. Staff logins stay.`)) return;
    try {
      await api(`/api/hrm/candidates/${c.id}`, { method: "DELETE", token });
      setMsg(`${c.fullName} removed.`);
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not delete");
    }
  }

  return (
    <div className="space-y-4">
      <Card className="!p-4">
        <p className="text-sm font-semibold">Compare scored candidates</p>
        <p className="text-xs text-steel-muted mt-1">
          One board per requisition. People are ranked by their best saved score. R1, R2, and R3 stay separate. A candidate can skip a round and still be onboarded.
        </p>
      </Card>
      {groups.map((g) => {
        const leader = g.rows.find((c) => bestScore(c) > 0 && c.status !== "Rejected") || g.rows.find((c) => bestScore(c) > 0);
        return (
          <Card key={g.title} padding={false}>
            <div className="px-4 py-3 border-b border-line flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-steel-muted">Requisition</p>
                <p className="font-semibold text-sm">{g.title}</p>
              </div>
              {leader ? (
                <div className="text-sm">
                  <span className="text-steel-muted">Leading </span>
                  <span className="font-semibold">{leader.fullName}</span>
                  <span className="font-semibold"> · {bestScore(leader)}%</span>
                </div>
              ) : (
                <p className="text-xs text-steel-muted">No saved scores yet. Open Scorecard, enter the marks, and press Save scorecard.</p>
              )}
            </div>
            <div className="grid lg:grid-cols-2 gap-3 p-3">
              {g.rows.map((c, i) => {
                const employee = (staff || []).find((s: any) => c.email && s.email && String(s.email).toLowerCase() === String(c.email).toLowerCase());
                const decision = (c.interviews || []).map((r: any) => r.decision).filter(Boolean).slice(-1)[0];
                const best = bestScore(c);
                const sheet = sheetLink(c);
                const hr = roundHit(c, "R1")?.scoreOverall ?? null;
                const tech = roundHit(c, "R2")?.scoreOverall ?? null;
                const mgmt = roundHit(c, "R3")?.scoreOverall ?? null;
                const leading = leader && leader.id === c.id;
                return (
                  <div key={c.id} className={`rounded-xl border p-3 space-y-3 ${leading ? "border-[var(--module-accent,#0D9488)] bg-[color-mix(in_srgb,var(--module-accent,#0D9488)_8%,var(--color-paper))]" : "border-line bg-paper"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-steel-muted">Rank {i + 1}{leading ? " · Leading" : ""}</p>
                        <p className="font-semibold">{c.fullName}</p>
                        <p className="text-xs text-steel-muted">{c.phone || c.email || "—"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold tabular-nums">{best ? `${best}%` : "—"}</p>
                        <Badge tone={candidateStageTone(c.status)}>{candidateStageLabel(c.status)}</Badge>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <ScoreMeter label="R1 · HR Screening" value={hr == null ? null : Number(hr)} />
                      <ScoreMeter label="R2 · Technical" value={tech == null ? null : Number(tech)} />
                      <ScoreMeter label="R3 · Management" value={mgmt == null ? null : Number(mgmt)} />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-steel-muted">Decision {decision || "—"}</span>
                      <div className="flex flex-wrap gap-1.5">
                          <Link to={`/hrm/recruitment?tab=interviews&candidateId=${c.id}`} className={linkBtn}>Scorecard</Link>
                          {canManage && onboardReady(c) && (
                            <Button type="button" className={rowBtn} onClick={() => void openOnboardingDesk(c.id, token).then((desk) => navigate(`/hrm/onboarding/${desk.offerId}`)).catch((err) => setMsg(err instanceof Error ? err.message : "Could not open onboarding"))}>Onboard</Button>
                          )}
                        {sheet ? <a href={sheet} target="_blank" rel="noreferrer" className={linkBtn}>SharePoint</a> : null}
                        {employee ? <Link to={`/hrm/documents?employeeUserId=${employee.id}`} className={linkBtn}>Letters</Link> : null}
                        {canManage && <Button type="button" variant="danger" className={rowBtn} onClick={() => void removeCandidate(c)}>Delete</Button>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
      {!groups.length && <Card><p className="text-sm text-steel-muted">No candidates yet. Add them on Resumes, score them, then come back here.</p></Card>}
    </div>
  );
}

/* ────────────────────────────  4  Interviews & scorecard  ──────────────────────────── */

function InterviewsTab({ candidates, staff, canManage, reload, setMsg, token }: any) {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const preselected = sp.get("candidateId") || "";
  const [candidateId, setCandidateId] = useState(preselected);
  const [rounds, setRounds] = useState<any[]>([]);
  const [diary, setDiary] = useState<any[]>([]);
  const [form, setForm] = useState({
    position: "",
    roundType: "R1",
    scheduledAt: "",
    durationMins: 60,
    mode: "Teams",
    meetingLink: "",
    location: "",
    interviewers: [{ userId: "", seat: "Technical" }] as Array<{ userId: string; seat: string }>,
  });

  useEffect(() => {
    api<any[]>("/api/hrm/interviews", { token }).then(setDiary).catch(() => setDiary([]));
  }, [token]);

  useEffect(() => {
    setRounds([]);
    setForm((prev) => ({ ...prev, roundType: "R1" }));
  }, [candidateId]);

  useEffect(() => {
    if (!candidateId) return;
    api<any[]>(`/api/hrm/candidates/${candidateId}/interviews`, { token }).then((rows) => {
      setRounds(rows);
      setForm((prev) => {
        const taken = (id: string) => rows.some((row) => scheduledRoundId(row.roundType) === id);
        if (!taken(prev.roundType)) return prev;
        const open = SCHEDULE_ROUNDS.find((opt) => !taken(opt.id));
        return open ? { ...prev, roundType: open.id } : prev;
      });
    }).catch(() => setRounds([]));
    const person = candidates.find((c: { id: string; requisition?: { designation?: string }; posting?: { title?: string } }) => c.id === candidateId);
    const title = person?.requisition?.designation || person?.posting?.title || "";
    if (title) setForm((prev) => ({ ...prev, position: scorecardRoleForDesignation(title) }));
  }, [candidateId, token, candidates]);

  async function schedule(e: FormEvent) {
    e.preventDefault();
    if (!candidateId) return;
    const interviewers = form.interviewers
      .map((row) => {
        const emp = staff.find((s: any) => s.id === row.userId);
        if (!emp) return null;
        return {
          userId: emp.id,
          name: emp.fullName,
          email: emp.email,
          designation: emp.profile?.designation || emp.profile?.department || "",
          seat: row.seat,
        };
      })
      .filter(Boolean);
    if (!interviewers.length) {
      setMsg("Add at least one interviewer (pick a staff login and their seat).");
      return;
    }
    try {
      const r = await api<any>(`/api/hrm/candidates/${candidateId}/interviews`, {
        method: "POST",
        token,
        body: JSON.stringify({
          position: form.position,
          roundType: form.roundType,
          scheduledAt: form.scheduledAt,
          durationMins: form.durationMins,
          mode: form.mode,
          meetingLink: form.meetingLink,
          location: form.location,
          interviewers,
        }),
      });
      setRounds((prev) => [...prev, r]);
      const stillOpen = SCHEDULE_ROUNDS.find((opt) => opt.id !== form.roundType && !rounds.some((row) => scheduledRoundId(row.roundType) === opt.id));
      setForm({
        position: "",
        roundType: stillOpen?.id || "R1",
        scheduledAt: "",
        durationMins: 60,
        mode: "Teams",
        meetingLink: "",
        location: "",
        interviewers: [{ userId: "", seat: "Technical" }],
      });
      setMsg(
        r.meetingLink
          ? "Interview meeting scheduled. Interviewee and interviewers are on the card — use Join for Teams."
          : r.teamsNote
            ? `Interview saved. Teams: ${r.teamsNote}`
            : "Interview meeting saved in the portal."
      );
      const all = await api<any[]>("/api/hrm/interviews", { token }).catch(() => []);
      setDiary(all);
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  async function updateRound(id: string, patch: any) {
    const r = await api<any>(`/api/hrm/interviews/${id}`, { method: "PATCH", token, body: JSON.stringify(patch) });
    setRounds((prev) => prev.map((x) => (x.id === id ? r : x)));
    await reload();
  }

  const candidate = candidates.find((c: any) => c.id === candidateId);
  const staffOptions = (staff || []).map((s: any) => ({
    value: s.id,
    label: s.fullName,
    sublabel: [s.profile?.designation, s.email].filter(Boolean).join(" · "),
    keywords: `${s.fullName} ${s.email || ""} ${s.profile?.designation || ""}`,
  }));

  return (
    <div className="space-y-3">
      <Card padding={false}>
        <div className="px-4 py-3 border-b border-line bg-sand/40 font-semibold text-sm">Interview meetings</div>
        <ul className="divide-y max-h-64 overflow-y-auto">
          {diary.slice(0, 12).map((r) => (
            <li key={r.id} className="px-4 py-2.5 text-sm flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">
                  {r.interviewee?.name || r.candidate?.fullName} · {r.roundType}
                </div>
                <div className="text-[11px] text-steel-muted">
                  Interviewee: {r.interviewee?.name || "—"}
                  {r.interviewee?.applyingFor ? ` · ${r.interviewee.applyingFor}` : ""}
                  {" · "}
                  Interviewer: {(r.interviewers || []).map((p: any) => `${p.name} (${p.seat})`).join(", ") || "—"}
                </div>
              </div>
              <div className="text-xs text-right">
                <div>{r.scheduledAt ? new Date(r.scheduledAt).toLocaleString("en-IN") : "Unscheduled"}</div>
                {r.meetingLink ? (
                  <a href={r.meetingLink} target="_blank" rel="noreferrer" className="text-brand font-semibold">
                    Join
                  </a>
                ) : (
                  <Badge tone={r.status === "Completed" ? "ok" : "brand"}>{r.status}</Badge>
                )}
              </div>
            </li>
          ))}
          {!diary.length && <li className="px-4 py-6 text-center text-sm text-steel-muted">No interview meetings yet. Pick a candidate below and schedule.</li>}
        </ul>
      </Card>

      <Card>
        <h3 className="font-semibold text-sm mb-2">Interviewee (candidate)</h3>
        <Select value={candidateId} onChange={(e) => setCandidateId(e.target.value)} className="max-w-md">
          <option value="">— select candidate —</option>
          {candidates.map((c: any) => (
            <option key={c.id} value={c.id}>
              {c.fullName} · {candidateStageLabel(c.status)}
              {c.currentCompany ? ` · ${c.currentCompany}` : ""}
            </option>
          ))}
        </Select>
        {candidate && (
          <div className="mt-3 grid sm:grid-cols-2 gap-2 text-sm rounded-lg border border-line bg-sand/30 p-3">
            <div><span className="text-[11px] uppercase text-steel-muted block">Name</span>{candidate.fullName}</div>
            <div><span className="text-[11px] uppercase text-steel-muted block">Email / phone</span>{candidate.email || "—"} · {candidate.phone || "—"}</div>
            <div><span className="text-[11px] uppercase text-steel-muted block">Requisition</span>{candidate.requisition ? `${candidate.requisition.requisitionNo} · ${candidate.requisition.department} · ${candidate.requisition.designation}` : "—"}</div>
            <div><span className="text-[11px] uppercase text-steel-muted block">Stage</span><Badge tone={candidateStageTone(candidate.status)}>{candidateStageLabel(candidate.status)}</Badge></div>
          </div>
        )}
      </Card>

      {candidate && canManage && (
        <Card>
          <h3 className="font-semibold text-sm mb-2">Schedule meeting · interviewers</h3>
          <form onSubmit={schedule} className="space-y-3">
            <div className="grid md:grid-cols-4 gap-2">
              <Select value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} required className="md:col-span-2">
                <option value="">Position applied</option>
                {SPDC_HIRING_ROLES.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </Select>
              <Select value={form.roundType} onChange={(e) => setForm({ ...form, roundType: e.target.value })}>
                {SCHEDULE_ROUNDS.filter((opt) => opt.id === form.roundType || !rounds.some((row) => scheduledRoundId(row.roundType) === opt.id)).map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </Select>
              <Select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                <option>Teams</option>
                <option>In-person</option>
                <option>Phone</option>
              </Select>
              <Input type="datetime-local" required value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
              <Input placeholder="Duration (mins)" type="number" value={form.durationMins} onChange={(e) => setForm({ ...form, durationMins: Number(e.target.value) })} />
              <Input placeholder={form.mode === "Teams" ? "Location (optional)" : "Site / office room"} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="md:col-span-2" />
              <Input placeholder="Paste Teams link only if Graph is down" value={form.meetingLink} onChange={(e) => setForm({ ...form, meetingLink: e.target.value })} className="md:col-span-2" />
            </div>
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase text-steel-muted">Interviewers (staff seats)</div>
              {form.interviewers.map((row, idx) => (
                <div key={idx} className="grid md:grid-cols-[1fr_220px_auto] gap-2 items-center">
                  <SearchableSelect
                    options={staffOptions}
                    value={row.userId}
                    onChange={(userId) => {
                      const next = [...form.interviewers];
                      next[idx] = { ...row, userId };
                      setForm({ ...form, interviewers: next });
                    }}
                    placeholder="Pick interviewer…"
                    searchPlaceholder="Search staff…"
                  />
                  <Select
                    value={row.seat}
                    onChange={(e) => {
                      const next = [...form.interviewers];
                      next[idx] = { ...row, seat: e.target.value };
                      setForm({ ...form, interviewers: next });
                    }}
                  >
                    {INTERVIEWER_SEATS.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </Select>
                  <button
                    type="button"
                    className="text-xs text-danger"
                    onClick={() => setForm({ ...form, interviewers: form.interviewers.filter((_, i) => i !== idx) })}
                    disabled={form.interviewers.length === 1}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                onClick={() => setForm({ ...form, interviewers: [...form.interviewers, { userId: "", seat: "HR" }] })}
              >
                Add interviewer
              </Button>
            </div>
            <Button type="submit" disabled={!SCHEDULE_ROUNDS.some((opt) => !rounds.some((row) => scheduledRoundId(row.roundType) === opt.id))}>Schedule interview meeting</Button>
            {!SCHEDULE_ROUNDS.some((opt) => !rounds.some((row) => scheduledRoundId(row.roundType) === opt.id)) ? <p className="text-[11px] text-steel-muted">R1, R2, and R3 are already on file. Score the rounds they sat. Onboard opens when each of those rounds is Advance. A skipped round does not block it.</p> : null}
          </form>
          <p className="text-[10px] text-steel-muted mt-2">
            Schedule only R1, R2, or R3. Skip any round this candidate does not need. Three is the maximum. The scorecard sheet uses the candidate’s name. Teams meetings are created on the SPDC mailbox when Graph is connected.
          </p>
        </Card>
      )}

      {candidate && (
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-line bg-sand/40 font-semibold text-sm">Rounds for {candidate.fullName}</div>
          <ul className="divide-y max-h-[32rem] overflow-y-auto">
            {roundsByCode(rounds).map((r) => (
              <li key={r.id} className="p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <div>
                    <span className="font-semibold">{SCHEDULE_ROUNDS.find((opt) => opt.id === scheduledRoundId(String(r.roundType || "")))?.label || `Round ${r.roundNumber} · ${r.roundType}`}</span>
                    <span className="text-xs text-steel-muted ml-2">
                      {r.scheduledAt ? new Date(r.scheduledAt).toLocaleString("en-IN") : "Unscheduled"} · {r.durationMins}m · {r.mode}
                    </span>
                  </div>
                  <Badge tone={r.status === "Completed" ? "ok" : r.status === "Cancelled" ? "danger" : "brand"}>{r.status}</Badge>
                </div>
                <div className="text-xs grid sm:grid-cols-2 gap-2">
                  <div>
                    <span className="uppercase text-steel-muted block">Interviewee</span>
                    {r.interviewee?.name || candidate.fullName}
                    {r.interviewee?.email ? ` · ${r.interviewee.email}` : ""}
                  </div>
                  <div>
                    <span className="uppercase text-steel-muted block">Interviewers</span>
                    {(r.interviewers || []).length
                      ? (r.interviewers as any[]).map((p) => `${p.name} — ${p.seat}${p.designation ? ` (${p.designation})` : ""}`).join("; ")
                      : "—"}
                  </div>
                </div>
                {r.meetingLink && (
                  <div className="text-xs">
                    <a href={r.meetingLink} target="_blank" rel="noreferrer" className="text-brand font-semibold">↗ Join {r.mode} meeting</a>
                  </div>
                )}
                {canManage && (
                  <div className="space-y-2 text-xs pt-2 border-t border-line">
                    <InterviewScorecard
                      key={r.id}
                      token={token}
                      positionHint={scorecardRoleForDesignation(candidate.requisition?.designation || candidate.posting?.title || "")}
                      roundHint={r.roundType}
                      saved={(() => {
                        try {
                          return r.scorecardJson ? JSON.parse(r.scorecardJson) : null;
                        } catch {
                          return null;
                        }
                      })()}
                      onSave={async (scorecard) => {
                        await updateRound(r.id, { scorecard, status: "Completed" });
                        setMsg(`Scorecard saved for ${candidate.fullName}. Onboard opens on the resume row when every round they sat is Advance.`);
                      }}
                    />
                    <textarea defaultValue={r.feedbackTechnical || ""} onBlur={(e) => updateRound(r.id, { feedbackTechnical: e.target.value })} placeholder="Evidence / notes" rows={2} className="md:col-span-4 border border-line rounded px-2 py-1" />
                    <div className="md:col-span-4 flex gap-2 pt-1">
                      <Button type="button" onClick={() => updateRound(r.id, { status: "Completed", decision: "Advance" })} variant="secondary">Advance</Button>
                      <Button type="button" onClick={() => updateRound(r.id, { status: "Completed", decision: "Hold" })} variant="secondary">Hold</Button>
                      <Button type="button" onClick={() => updateRound(r.id, { status: "Completed", decision: "Reject" })} variant="secondary">Reject</Button>
                    </div>
                    {onboardReady(candidate) && canManage && (
                      <div className="md:col-span-4">
                        <Button
                          type="button"
                          onClick={() => void openOnboardingDesk(candidate.id, token).then((desk) => navigate(`/hrm/onboarding/${desk.offerId}`)).catch((err) => setMsg(err instanceof Error ? err.message : "Could not open onboarding"))}
                        >
                          Onboard {candidate.fullName}
                        </Button>
                      </div>
                    )}
                    {r.scorecardJson && (
                      <p className="md:col-span-4 text-[11px] text-steel-muted">
                        {r.scoreOverall != null ? `Saved score ${r.scoreOverall}%` : "Scorecard workbook is on SharePoint — fill the scores below."}
                        {(() => {
                          try {
                            const url = JSON.parse(r.scorecardJson).sharePointUrl as string | undefined;
                            return url ? (
                              <>
                                {" · "}
                                <a href={url} target="_blank" rel="noreferrer" className="text-brand font-semibold">
                                  Scorecard on SharePoint
                                </a>
                              </>
                            ) : null;
                          } catch {
                            return null;
                          }
                        })()}
                      </p>
                    )}
                  </div>
                )}
                {r.decision && <div className="text-xs">Decision: <Badge tone={r.decision === "Advance" ? "ok" : r.decision === "Reject" ? "danger" : "warn"}>{r.decision}</Badge></div>}
              </li>
            ))}
            {!rounds.length && <li className="px-4 py-6 text-center text-sm text-steel-muted">No rounds yet.</li>}
          </ul>
        </Card>
      )}
    </div>
  );
}

/* ────────────────────────────  5  Offers  ──────────────────────────── */

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

type CtcInputsForm = typeof CTC_DEFAULTS & {
  candidateName: string;
  designation: string;
  fixedCtcAnnual: number;
};

type CtcBreakdown = {
  partA: { rows: { label: string; basis: string; perAnnum: number; perMonth: number | string }[]; gross: { perAnnum: number; perMonth: number } };
  partB: {
    rows: { label: string; basis: string; perAnnum: number; perMonth: number | string }[];
    total: { perAnnum: number; perMonth: number };
    fixedCtc: { perAnnum: number; perMonth: number };
    performancePay: { perAnnum: number; perMonth: string };
    totalCtc: { perAnnum: number; perMonth: string };
  };
  partC: { rows: { label: string; basis: string; perAnnum: number; perMonth: number | string }[]; indicativeNet: { perAnnum: number; perMonth: number } };
  validation: string[];
};

function OffersTab({ candidates, offers, canManage, reload, setMsg, token }: any) {
  const [form, setForm] = useState({ candidateId: "", offerNo: "", designation: "", department: "", ctcAnnual: "", basicMonthly: "", hraMonthly: "", otherAllowMonthly: "", variablePayPct: "", joiningDate: "", probationMonths: 6, location: "", reportingManager: "", notes: "" });
  const [file, setFile] = useState<File | null>(null);
  const [ctc, setCtc] = useState<CtcInputsForm>({
    candidateName: "",
    designation: "",
    fixedCtcAnnual: 900000,
    ...CTC_DEFAULTS,
  });
  const [preview, setPreview] = useState<CtcBreakdown | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  async function runPreview() {
    setPreviewBusy(true);
    try {
      const b = await api<CtcBreakdown>("/api/hrm/ctc/compute", {
        method: "POST",
        token,
        body: JSON.stringify(ctc),
      });
      setPreview(b);
      const gross = b.partA.gross.perAnnum;
      const basicRow = b.partA.rows.find((r) => r.label === "Basic Salary");
      const hraRow = b.partA.rows.find((r) => r.label === "House Rent Allowance");
      setForm((f) => ({
        ...f,
        ctcAnnual: String(ctc.fixedCtcAnnual),
        basicMonthly: String(basicRow?.perMonth ?? ""),
        hraMonthly: String(hraRow?.perMonth ?? ""),
        otherAllowMonthly: String(Math.round((gross - Number(basicRow?.perAnnum || 0) - Number(hraRow?.perAnnum || 0)) / 12)),
        variablePayPct: String(ctc.performancePayPct * 100),
      }));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "CTC preview failed");
    } finally {
      setPreviewBusy(false);
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v !== "" && fd.append(k, String(v)));
      // If the calculator has been used (preview generated), attach the 12
      // inputs so the API stores them + auto-generates Sharnam Annexure I.
      if (preview) {
        const candidateName = candidates.find((c: any) => c.id === form.candidateId)?.fullName || "";
        fd.append(
          "ctcInputsJson",
          JSON.stringify({ ...ctc, candidateName: ctc.candidateName || candidateName, designation: ctc.designation || form.designation })
        );
      }
      if (file) fd.append("letter", file);
      await api("/api/hrm/offers", { method: "POST", token, body: fd });
      setForm({ candidateId: "", offerNo: "", designation: "", department: "", ctcAnnual: "", basicMonthly: "", hraMonthly: "", otherAllowMonthly: "", variablePayPct: "", joiningDate: "", probationMonths: 6, location: "", reportingManager: "", notes: "" });
      setFile(null);
      setPreview(null);
      setMsg(preview ? "Offer drafted + Annexure I attached." : "Offer drafted.");
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  async function transition(id: string, status: string) {
    await api(`/api/hrm/offers/${id}`, { method: "PATCH", token, body: JSON.stringify({ status }) });
    await reload();
  }

  const shortlisted = candidates.filter((c: any) =>
    ["Shortlisted", "Interview", "Interviewed", "Selected", "SalaryDiscussion"].includes(c.status)
  );

  return (
    <div className="space-y-3">
      {canManage && (
        <Card>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">CTC calculator — 12-input Annexure I</h3>
            <span className="text-[11px] text-steel-muted">Live from SPDC_CTC_Structure_Calculator.xlsx</span>
          </div>
          <div className="grid md:grid-cols-4 gap-2 mb-2">
            <Input placeholder="Candidate name (annexure)" value={ctc.candidateName} onChange={(e) => setCtc({ ...ctc, candidateName: e.target.value })} />
            <Input placeholder="Designation (annexure)" value={ctc.designation} onChange={(e) => setCtc({ ...ctc, designation: e.target.value })} />
            <label className="text-xs text-steel-muted">
              Fixed CTC p.a. (₹)
              <Input type="number" value={ctc.fixedCtcAnnual} onChange={(e) => setCtc({ ...ctc, fixedCtcAnnual: Number(e.target.value) })} />
            </label>
            <label className="text-xs text-steel-muted">
              Basic % of gross
              <Input type="number" step="1" value={Math.round(ctc.basicPctOfGross * 100)} onChange={(e) => setCtc({ ...ctc, basicPctOfGross: Number(e.target.value) / 100 })} />
            </label>
            <label className="text-xs text-steel-muted">
              HRA % of basic (40 non-metro, 50 metro)
              <Input type="number" step="1" value={Math.round(ctc.hraPctOfBasic * 100)} onChange={(e) => setCtc({ ...ctc, hraPctOfBasic: Number(e.target.value) / 100 })} />
            </label>
            <label className="text-xs text-steel-muted">
              Gratuity % of basic
              <Input type="number" step="0.01" value={Math.round(ctc.gratuityPctOfBasic * 10000) / 100} onChange={(e) => setCtc({ ...ctc, gratuityPctOfBasic: Number(e.target.value) / 100 })} />
            </label>
            <label className="text-xs text-steel-muted">
              LTA % of basic
              <Input type="number" step="0.01" value={Math.round(ctc.ltaPctOfBasic * 10000) / 100} onChange={(e) => setCtc({ ...ctc, ltaPctOfBasic: Number(e.target.value) / 100 })} />
            </label>
            <label className="text-xs text-steel-muted">
              Conveyance p.a. (₹)
              <Input type="number" value={ctc.conveyanceAnnual} onChange={(e) => setCtc({ ...ctc, conveyanceAnnual: Number(e.target.value) })} />
            </label>
            <label className="text-xs text-steel-muted">
              Children Edu. p.a. (₹)
              <Input type="number" value={ctc.childrenEducationAnnual} onChange={(e) => setCtc({ ...ctc, childrenEducationAnnual: Number(e.target.value) })} />
            </label>
            <label className="text-xs text-steel-muted">
              Mediclaim / GPA p.a. (₹)
              <Input type="number" value={ctc.mediclaimAnnual} onChange={(e) => setCtc({ ...ctc, mediclaimAnnual: Number(e.target.value) })} />
            </label>
            <label className="text-xs text-steel-muted">
              Performance pay % of CTC
              <Input type="number" step="1" value={Math.round(ctc.performancePayPct * 100)} onChange={(e) => setCtc({ ...ctc, performancePayPct: Number(e.target.value) / 100 })} />
            </label>
            <label className="text-xs text-steel-muted">
              Professional Tax p.a. (₹)
              <Input type="number" value={ctc.professionalTaxAnnual} onChange={(e) => setCtc({ ...ctc, professionalTaxAnnual: Number(e.target.value) })} />
            </label>
            <label className="text-xs text-steel-muted flex items-center gap-2 md:col-span-4">
              <input type="checkbox" checked={ctc.restrictPfCeiling} onChange={(e) => setCtc({ ...ctc, restrictPfCeiling: e.target.checked })} />
              Restrict employer PF to ₹15,000 statutory ceiling (caps employer PF at ₹21,600 p.a.)
            </label>
          </div>
          <div className="flex flex-wrap gap-2 mb-2">
            <Button type="button" variant="secondary" disabled={previewBusy || !(ctc.fixedCtcAnnual > 0)} onClick={runPreview}>
              {previewBusy ? "Computing…" : preview ? "Recompute Annexure I preview" : "Compute Annexure I preview"}
            </Button>
            {preview && (
              <span className="text-xs text-steel-muted self-center">
                Fixed CTC ₹ {ctc.fixedCtcAnnual.toLocaleString("en-IN")} · Gross ₹ {preview.partA.gross.perAnnum.toLocaleString("en-IN")} p.a. · Retirals ₹ {preview.partB.total.perAnnum.toLocaleString("en-IN")} · Take-home ₹ {preview.partC.indicativeNet.perMonth.toLocaleString("en-IN")}/mo
              </span>
            )}
          </div>
          {preview && (
            <div className="text-xs border border-line rounded-sm overflow-x-auto mb-2">
              <table className="min-w-[720px] w-full">
                <thead className="bg-paper">
                  <tr>
                    <th className="p-1.5 text-left">Component</th>
                    <th className="p-1.5 text-left">Basis</th>
                    <th className="p-1.5 text-right">Per annum</th>
                    <th className="p-1.5 text-right">Per month</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...preview.partA.rows,
                    { label: "A. GROSS SALARY", basis: "Sum of Part A", perAnnum: preview.partA.gross.perAnnum, perMonth: preview.partA.gross.perMonth },
                    ...preview.partB.rows,
                    { label: "B. TOTAL RETIRALS", basis: "Sum of Part B", perAnnum: preview.partB.total.perAnnum, perMonth: preview.partB.total.perMonth },
                    { label: "FIXED CTC (A + B)", basis: "", perAnnum: preview.partB.fixedCtc.perAnnum, perMonth: preview.partB.fixedCtc.perMonth },
                    { label: "C. Performance Pay", basis: "", perAnnum: preview.partB.performancePay.perAnnum, perMonth: preview.partB.performancePay.perMonth },
                    { label: "TOTAL CTC (A + B + C)", basis: "", perAnnum: preview.partB.totalCtc.perAnnum, perMonth: preview.partB.totalCtc.perMonth },
                    ...preview.partC.rows,
                    { label: "Indicative take-home", basis: "After Part C", perAnnum: preview.partC.indicativeNet.perAnnum, perMonth: preview.partC.indicativeNet.perMonth },
                  ].map((r, i) => (
                    <tr key={i} className={r.label.startsWith("A.") || r.label.startsWith("B.") || r.label.includes("CTC") ? "font-semibold bg-brand-soft" : "border-t border-line"}>
                      <td className="p-1.5">{r.label}</td>
                      <td className="p-1.5 text-steel-muted">{r.basis}</td>
                      <td className="p-1.5 text-right">{typeof r.perAnnum === "number" ? "₹ " + r.perAnnum.toLocaleString("en-IN") : r.perAnnum}</td>
                      <td className="p-1.5 text-right">{typeof r.perMonth === "number" ? "₹ " + r.perMonth.toLocaleString("en-IN") : r.perMonth}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-2 text-[11px] text-steel-muted bg-paper border-t border-line">
                <strong>Validation:</strong> {preview.validation.join(" · ")}
              </div>
            </div>
          )}
          <p className="text-[11px] text-steel-muted">
            "Draft offer" below stores these 12 inputs so <strong>Sharnam-branded Annexure I</strong> can be re-generated from the offer row (XLSX + printable HTML). Fixed CTC / Basic / HRA / Other on the offer are auto-filled from this preview.
          </p>
        </Card>
      )}

      {canManage && (
        <Card>
          <h3 className="font-semibold text-sm mb-2">Draft an offer</h3>
          <form onSubmit={add} className="grid md:grid-cols-4 gap-2">
            <Select
              value={form.candidateId}
              onChange={(e) => {
                const candidateId = e.target.value;
                const person = candidates.find((c: { id: string; fullName?: string; currentDesign?: string; applyingFor?: string }) => c.id === candidateId);
                setForm({
                  ...form,
                  candidateId,
                  designation: form.designation || person?.applyingFor || person?.currentDesign || "",
                });
                if (person) {
                  setCtc((c) => ({
                    ...c,
                    candidateName: person.fullName || c.candidateName,
                    designation: person.applyingFor || person.currentDesign || c.designation,
                  }));
                }
              }}
              required
            >
              <option value="">Candidate</option>
              {shortlisted.map((c: any) => <option key={c.id} value={c.id}>{c.fullName} · {c.currentCompany || "—"}</option>)}
            </Select>
            <Input placeholder="Offer No (auto)" value={form.offerNo} onChange={(e) => setForm({ ...form, offerNo: e.target.value })} />
            <Input placeholder="Designation" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} required />
            <Input placeholder="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            <Input placeholder="CTC annual (₹)" type="number" value={form.ctcAnnual} onChange={(e) => setForm({ ...form, ctcAnnual: e.target.value })} required />
            <Input placeholder="Basic monthly" type="number" value={form.basicMonthly} onChange={(e) => setForm({ ...form, basicMonthly: e.target.value })} />
            <Input placeholder="HRA monthly" type="number" value={form.hraMonthly} onChange={(e) => setForm({ ...form, hraMonthly: e.target.value })} />
            <Input placeholder="Other allow monthly" type="number" value={form.otherAllowMonthly} onChange={(e) => setForm({ ...form, otherAllowMonthly: e.target.value })} />
            <Input placeholder="Variable pay %" type="number" value={form.variablePayPct} onChange={(e) => setForm({ ...form, variablePayPct: e.target.value })} />
            <Input placeholder="Joining date" type="date" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} />
            <Input placeholder="Probation (months)" type="number" value={form.probationMonths} onChange={(e) => setForm({ ...form, probationMonths: Number(e.target.value) })} />
            <Input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <Input placeholder="Reporting manager" value={form.reportingManager} onChange={(e) => setForm({ ...form, reportingManager: e.target.value })} />
            <TextArea rows={2} placeholder="Notes / terms" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="md:col-span-4" />
            <label className="md:col-span-4 text-xs text-steel-muted">
              Offer letter (PDF)
              <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block mt-1 text-xs" />
            </label>
            <Button type="submit" className="md:col-span-4">Draft offer</Button>
          </form>
        </Card>
      )}

      <Card padding={false}>
        <div className="px-4 py-3 border-b border-line bg-sand/40 flex justify-between">
          <span className="font-semibold text-sm">Offers</span>
          <span className="text-[11px] text-steel-muted">{offers.length} entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1000px] w-full text-xs">
            <thead className="text-left text-steel-muted bg-white">
              <tr><th className="p-2">Offer No</th><th>Candidate</th><th>Designation</th><th className="text-right">CTC</th><th>Joining</th><th>Letter</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {offers.map((o: any) => (
                <tr key={o.id} className="border-t border-line">
                  <td className="p-2 font-mono">{o.offerNo}</td>
                  <td>{o.candidate?.fullName}</td>
                  <td>{o.designation}</td>
                  <td className="text-right">{money(o.ctcAnnual)}</td>
                  <td>{o.joiningDate ? new Date(o.joiningDate).toLocaleDateString("en-IN") : "—"}</td>
                  <td className="space-y-0.5">
                    {o.offerLetterUrl ? <a href={o.offerLetterUrl} target="_blank" rel="noreferrer" className="text-brand block">↗ Letter PDF</a> : null}
                    {o.ctcInputsJson || o.annexureUrl ? (
                      <>
                        <a
                          href={`/api/hrm/offers/${o.id}/annexure.html?token=${encodeURIComponent(token || "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand block text-[10px]"
                        >
                          ↗ Annexure I (print)
                        </a>
                        <a
                          href={`/api/hrm/offers/${o.id}/annexure.xlsx?token=${encodeURIComponent(token || "")}`}
                          className="text-brand block text-[10px]"
                        >
                          ↓ Annexure I .xlsx
                        </a>
                      </>
                    ) : null}
                    {!o.offerLetterUrl && !o.ctcInputsJson ? "—" : null}
                  </td>
                  <td><Badge tone={o.status === "Accepted" || o.status === "Joined" ? "ok" : o.status === "Declined" || o.status === "Withdrawn" ? "danger" : "brand"}>{o.status}</Badge></td>
                  <td>
                    {canManage && (
                      <Select value={o.status} onChange={(e) => transition(o.id, e.target.value)} className="!py-1">
                        {OFFER_STAGES.map((s) => <option key={s}>{s}</option>)}
                      </Select>
                    )}
                    {o.status === "Accepted" && (
                      <Link to={`/hrm/onboarding/${o.id}`} className="text-brand text-[10px] font-semibold ml-2">Pre-join ↗</Link>
                    )}
                  </td>
                </tr>
              ))}
              {!offers.length && <tr><td colSpan={8} className="py-4 text-center text-steel-muted">No offers yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
