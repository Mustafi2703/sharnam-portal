import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, Select, TextArea } from "../components/ui";

/**
 * Recruitment & Interview Management — one page, six tabs walking through the flow.
 * All routes: /api/hrm/{requisitions,postings,candidates,interviews,offers}
 */

const TABS = [
  { id: "requisitions", label: "1 · Manpower Requisition" },
  { id: "postings", label: "2 · Job Postings" },
  { id: "candidates", label: "3 · Candidates / Resume DB" },
  { id: "interviews", label: "4 · Interviews & scorecard" },
  { id: "offers", label: "5 · Offers" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const CANDIDATE_STAGES = ["New", "Screened", "Shortlisted", "Interview", "Selected", "Offered", "Joined", "Rejected", "Withdrawn"] as const;
const OFFER_STAGES = ["Draft", "Approved", "Sent", "Accepted", "Declined", "Withdrawn", "Joined"] as const;
const INTERVIEW_STAGES = ["Scheduled", "Completed", "No-Show", "Cancelled"] as const;

function money(n?: number | null) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  return "₹ " + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default function RecruitmentPage() {
  const { token, user } = useAuth();
  const canManage = ["admin", "office"].includes(user?.role || "");
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get("tab") as TabId) || "requisitions";

  const [reqs, setReqs] = useState<any[]>([]);
  const [postings, setPostings] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [msg, setMsg] = useState("");

  const reload = async () => {
    const [r, p, c, o] = await Promise.all([
      api<any[]>("/api/hrm/requisitions", { token }),
      api<any[]>("/api/hrm/postings", { token }),
      api<any[]>("/api/hrm/candidates", { token }),
      api<any[]>("/api/hrm/offers", { token }),
    ]);
    setReqs(r);
    setPostings(p);
    setCandidates(c);
    setOffers(o);
  };
  useEffect(() => {
    void reload();
  }, [token]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSp({ tab: t.id })}
            className={`rounded-full px-4 py-2 text-sm font-semibold border transition ${
              tab === t.id ? "bg-ink text-white border-ink" : "bg-white border-line text-steel-muted hover:border-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {msg && <p className="text-sm rounded-lg px-3 py-2 bg-brand-soft text-brand-dark">{msg}</p>}

      {tab === "requisitions" && <RequisitionsTab reqs={reqs} canManage={canManage} reload={reload} setMsg={setMsg} token={token || ""} />}
      {tab === "postings" && <PostingsTab reqs={reqs} postings={postings} canManage={canManage} reload={reload} setMsg={setMsg} token={token || ""} />}
      {tab === "candidates" && <CandidatesTab postings={postings} candidates={candidates} canManage={canManage} reload={reload} setMsg={setMsg} token={token || ""} />}
      {tab === "interviews" && <InterviewsTab candidates={candidates} canManage={canManage} reload={reload} setMsg={setMsg} token={token || ""} />}
      {tab === "offers" && <OffersTab candidates={candidates} offers={offers} canManage={canManage} reload={reload} setMsg={setMsg} token={token || ""} />}
    </div>
  );
}

/* ────────────────────────────  1  Requisitions  ──────────────────────────── */

function RequisitionsTab({ reqs, canManage, reload, setMsg, token }: any) {
  const [form, setForm] = useState({ requisitionNo: "", department: "", designation: "", count: 1, employmentType: "Permanent", reportingManager: "", justification: "", urgency: "Normal", ctcRangeMin: "", ctcRangeMax: "", location: "" });
  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/api/hrm/requisitions", { method: "POST", token, body: JSON.stringify(form) });
      setForm({ requisitionNo: "", department: "", designation: "", count: 1, employmentType: "Permanent", reportingManager: "", justification: "", urgency: "Normal", ctcRangeMin: "", ctcRangeMax: "", location: "" });
      setMsg("Requisition submitted.");
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
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
          <form onSubmit={add} className="grid md:grid-cols-4 gap-2">
            <Input placeholder="Req No (auto)" value={form.requisitionNo} onChange={(e) => setForm({ ...form, requisitionNo: e.target.value })} />
            <Input placeholder="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} required />
            <Input placeholder="Designation" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} required />
            <Input placeholder="Head count" type="number" value={form.count} onChange={(e) => setForm({ ...form, count: Number(e.target.value) })} />
            <Select value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })}>
              {["Permanent", "Contract", "Consultant", "Intern"].map((v) => <option key={v}>{v}</option>)}
            </Select>
            <Input placeholder="Reporting manager" value={form.reportingManager} onChange={(e) => setForm({ ...form, reportingManager: e.target.value })} />
            <Input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <Select value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })}>
              {["Normal", "Priority", "Critical"].map((v) => <option key={v}>{v}</option>)}
            </Select>
            <Input placeholder="CTC min (₹/yr)" type="number" value={form.ctcRangeMin} onChange={(e) => setForm({ ...form, ctcRangeMin: e.target.value })} />
            <Input placeholder="CTC max (₹/yr)" type="number" value={form.ctcRangeMax} onChange={(e) => setForm({ ...form, ctcRangeMax: e.target.value })} />
            <TextArea rows={2} placeholder="Business justification" value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })} className="md:col-span-4" />
            <Button type="submit" className="md:col-span-4">Submit requisition</Button>
          </form>
        </Card>
      )}
      <Card padding={false}>
        <div className="px-4 py-3 border-b border-line bg-sand/40 flex justify-between">
          <span className="font-semibold text-sm">Requisitions</span>
          <span className="text-[11px] text-steel-muted">{reqs.length} entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-xs">
            <thead className="text-left text-steel-muted bg-white">
              <tr><th className="p-2">Req No</th><th>Dept</th><th>Designation</th><th>Count</th><th>Type</th><th>Range</th><th>Urgency</th><th>Postings</th><th>Status</th><th className="no-print"></th></tr>
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
                  <td>{r.postings?.length ?? 0}</td>
                  <td><Badge tone={r.status === "Approved" ? "ok" : r.status === "Rejected" ? "danger" : "warn"}>{r.status}</Badge></td>
                  <td>
                    {canManage && r.status === "Submitted" && (
                      <span className="flex gap-1">
                        <button className="text-brand text-[10px] font-semibold" onClick={() => transition(r.id, "Approved")}>Approve</button>
                        <button className="text-danger text-[10px] font-semibold" onClick={() => transition(r.id, "Rejected", "not approved")}>Reject</button>
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

function PostingsTab({ reqs, postings, canManage, reload, setMsg, token }: any) {
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
          <h3 className="font-semibold text-sm mb-2">Post a job (LinkedIn / Naukri / Website)</h3>
          <form onSubmit={add} className="grid md:grid-cols-3 gap-2">
            <Select value={form.requisitionId} onChange={(e) => setForm({ ...form, requisitionId: e.target.value })}>
              <option value="">Link approved requisition (optional)</option>
              {approvedReqs.map((r: any) => <option key={r.id} value={r.id}>{r.requisitionNo} · {r.designation}</option>)}
            </Select>
            <Input placeholder="Job title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            <Input placeholder="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
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
                </div>
                <div className="text-[10px] text-steel-muted mt-0.5">
                  {(() => {
                    try {
                      return (JSON.parse(p.channelsJson || "[]") as string[]).join(" · ");
                    } catch { return ""; }
                  })()}
                </div>
              </div>
              <div className="text-xs text-steel-muted">Candidates: {p._count?.candidates ?? 0}</div>
            </li>
          ))}
          {!postings.length && <li className="px-4 py-6 text-center text-sm text-steel-muted">No postings yet.</li>}
        </ul>
      </Card>
    </div>
  );
}

/* ────────────────────────────  3  Candidates / Resume DB  ──────────────────────────── */

function CandidatesTab({ postings, candidates, canManage, reload, setMsg, token }: any) {
  const [form, setForm] = useState({ postingId: "", fullName: "", email: "", phone: "", sourceChannel: "LinkedIn", currentCompany: "", currentDesign: "", currentCtc: "", expectedCtc: "", noticePeriodDays: "", experienceYears: "", skills: "", location: "" });
  const [file, setFile] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("");

  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v && fd.append(k, String(v)));
      if (file) fd.append("resume", file);
      await api("/api/hrm/candidates", { method: "POST", token, body: fd });
      setForm({ postingId: "", fullName: "", email: "", phone: "", sourceChannel: "LinkedIn", currentCompany: "", currentDesign: "", currentCtc: "", expectedCtc: "", noticePeriodDays: "", experienceYears: "", skills: "", location: "" });
      setFile(null);
      setMsg("Candidate added.");
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }
  async function transition(id: string, status: string, reason?: string) {
    await api(`/api/hrm/candidates/${id}`, { method: "PATCH", token, body: JSON.stringify({ status, rejectionReason: reason }) });
    await reload();
  }

  const filtered = candidates.filter((c: any) => {
    if (filterStage && c.status !== filterStage) return false;
    if (search) {
      const q = search.toLowerCase();
      return [c.fullName, c.email, c.phone, c.skills].some((v) => (v || "").toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="space-y-3">
      {canManage && (
        <Card>
          <h3 className="font-semibold text-sm mb-2">Add candidate (resume DB)</h3>
          <form onSubmit={add} className="grid md:grid-cols-4 gap-2">
            <Select value={form.postingId} onChange={(e) => setForm({ ...form, postingId: e.target.value })}>
              <option value="">Link posting (optional)</option>
              {postings.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
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
            <Button type="submit" className="md:col-span-4">Add candidate</Button>
          </form>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <Input placeholder="Search name / email / skill" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={filterStage} onChange={(e) => setFilterStage(e.target.value)} className="max-w-xs">
          <option value="">All stages</option>
          {CANDIDATE_STAGES.map((s) => <option key={s}>{s}</option>)}
        </Select>
        <span className="text-xs text-steel-muted">{filtered.length} / {candidates.length}</span>
      </div>

      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full text-xs">
            <thead className="text-left text-steel-muted bg-sand/40">
              <tr><th className="p-2">Name</th><th>Contact</th><th>Current</th><th>Exp</th><th>Notice</th><th className="text-right">Current CTC</th><th className="text-right">Expected CTC</th><th>Source</th><th>Resume</th><th>Stage</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map((c: any) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="p-2 font-medium">{c.fullName}</td>
                  <td>{c.email}<br/>{c.phone}</td>
                  <td>{c.currentCompany || "—"}<br/><span className="text-steel-muted">{c.currentDesign || ""}</span></td>
                  <td className="text-right">{c.experienceYears || "—"}</td>
                  <td className="text-right">{c.noticePeriodDays || "—"}d</td>
                  <td className="text-right">{money(c.currentCtc)}</td>
                  <td className="text-right">{money(c.expectedCtc)}</td>
                  <td>{c.sourceChannel || "—"}</td>
                  <td>{c.resumeUrl ? <a href={c.resumeUrl} target="_blank" rel="noreferrer" className="text-brand">↗ Open</a> : "—"}</td>
                  <td>
                    <Select value={c.status} onChange={(e) => transition(c.id, e.target.value)} disabled={!canManage} className="!py-1">
                      {CANDIDATE_STAGES.map((s) => <option key={s}>{s}</option>)}
                    </Select>
                  </td>
                  <td>
                    <Link to={`/hrm/recruitment?tab=interviews&candidateId=${c.id}`} className="text-brand text-[10px] font-semibold">Schedule ↗</Link>
                  </td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={11} className="py-4 text-center text-steel-muted">No candidates match.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ────────────────────────────  4  Interviews & scorecard  ──────────────────────────── */

function InterviewsTab({ candidates, canManage, reload, setMsg, token }: any) {
  const [sp] = useSearchParams();
  const preselected = sp.get("candidateId") || "";
  const [candidateId, setCandidateId] = useState(preselected);
  const [rounds, setRounds] = useState<any[]>([]);
  const [form, setForm] = useState({ roundType: "Technical", panel: "", scheduledAt: "", durationMins: 60, mode: "Teams", meetingLink: "" });

  useEffect(() => {
    if (!candidateId) {
      setRounds([]);
      return;
    }
    api<any[]>(`/api/hrm/candidates/${candidateId}/interviews`, { token }).then(setRounds).catch(() => setRounds([]));
  }, [candidateId, token]);

  async function schedule(e: FormEvent) {
    e.preventDefault();
    if (!candidateId) return;
    try {
      const body = { ...form, panel: form.panel.split(",").map((s) => s.trim()).filter(Boolean) };
      const r = await api<any>(`/api/hrm/candidates/${candidateId}/interviews`, { method: "POST", token, body: JSON.stringify(body) });
      setRounds((prev) => [...prev, r]);
      setForm({ roundType: "Technical", panel: "", scheduledAt: "", durationMins: 60, mode: "Teams", meetingLink: "" });
      setMsg(`Interview scheduled${r.meetingLink ? " · Teams link ready" : ""}.`);
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

  return (
    <div className="space-y-3">
      <Card>
        <h3 className="font-semibold text-sm mb-2">Pick candidate</h3>
        <Select value={candidateId} onChange={(e) => setCandidateId(e.target.value)} className="max-w-md">
          <option value="">— select —</option>
          {candidates.map((c: any) => <option key={c.id} value={c.id}>{c.fullName} · {c.status}{c.currentCompany ? ` · ${c.currentCompany}` : ""}</option>)}
        </Select>
      </Card>

      {candidate && canManage && (
        <Card>
          <h3 className="font-semibold text-sm mb-2">Schedule an interview round for {candidate.fullName}</h3>
          <form onSubmit={schedule} className="grid md:grid-cols-4 gap-2">
            <Select value={form.roundType} onChange={(e) => setForm({ ...form, roundType: e.target.value })}>
              {["Technical", "HR", "Management", "Client", "Assessment"].map((v) => <option key={v}>{v}</option>)}
            </Select>
            <Input placeholder="Panel members (comma-separated)" value={form.panel} onChange={(e) => setForm({ ...form, panel: e.target.value })} />
            <Input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
            <Input placeholder="Duration (mins)" type="number" value={form.durationMins} onChange={(e) => setForm({ ...form, durationMins: Number(e.target.value) })} />
            <Select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
              {["Teams", "Zoom", "Google Meet", "In-person"].map((v) => <option key={v}>{v}</option>)}
            </Select>
            <Input placeholder="Meeting link (optional)" value={form.meetingLink} onChange={(e) => setForm({ ...form, meetingLink: e.target.value })} className="md:col-span-2" />
            <Button type="submit">Schedule round</Button>
          </form>
          <p className="text-[10px] text-steel-muted mt-2">If mode is Teams and no link is provided, a Teams meeting URL is generated automatically for the panel.</p>
        </Card>
      )}

      {candidate && (
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-line bg-sand/40 font-semibold text-sm">Rounds for {candidate.fullName}</div>
          <ul className="divide-y">
            {rounds.map((r) => (
              <li key={r.id} className="p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <div>
                    <span className="font-semibold">Round {r.roundNumber} · {r.roundType}</span>
                    <span className="text-xs text-steel-muted ml-2">
                      {r.scheduledAt ? new Date(r.scheduledAt).toLocaleString("en-IN") : "Unscheduled"} · {r.durationMins}m · {r.mode}
                    </span>
                  </div>
                  <Badge tone={r.status === "Completed" ? "ok" : r.status === "Cancelled" ? "danger" : "brand"}>{r.status}</Badge>
                </div>
                {(() => {
                  try {
                    const panel = JSON.parse(r.panelJson || "[]") as string[];
                    return panel.length ? <div className="text-xs text-steel-muted">Panel: {panel.join(" · ")}</div> : null;
                  } catch { return null; }
                })()}
                {r.meetingLink && (
                  <div className="text-xs">
                    <a href={r.meetingLink} target="_blank" rel="noreferrer" className="text-brand font-semibold">↗ Join {r.mode} meeting</a>
                  </div>
                )}
                {canManage && r.status !== "Completed" && (
                  <div className="grid md:grid-cols-4 gap-2 text-xs pt-2 border-t border-line">
                    <label>Technical<br/><input type="number" defaultValue={r.scoreTechnical || ""} onBlur={(e) => updateRound(r.id, { scoreTechnical: Number(e.target.value) })} placeholder="/10" className="w-full border border-line rounded px-2 py-1" /></label>
                    <label>Communication<br/><input type="number" defaultValue={r.scoreCommunication || ""} onBlur={(e) => updateRound(r.id, { scoreCommunication: Number(e.target.value) })} placeholder="/10" className="w-full border border-line rounded px-2 py-1" /></label>
                    <label>Culture<br/><input type="number" defaultValue={r.scoreCulture || ""} onBlur={(e) => updateRound(r.id, { scoreCulture: Number(e.target.value) })} placeholder="/10" className="w-full border border-line rounded px-2 py-1" /></label>
                    <label>Overall<br/><input type="number" defaultValue={r.scoreOverall || ""} onBlur={(e) => updateRound(r.id, { scoreOverall: Number(e.target.value) })} placeholder="/10" className="w-full border border-line rounded px-2 py-1" /></label>
                    <textarea defaultValue={r.feedbackTechnical || ""} onBlur={(e) => updateRound(r.id, { feedbackTechnical: e.target.value })} placeholder="Technical feedback" rows={2} className="md:col-span-2 border border-line rounded px-2 py-1" />
                    <textarea defaultValue={r.feedbackHr || ""} onBlur={(e) => updateRound(r.id, { feedbackHr: e.target.value })} placeholder="HR feedback" rows={2} className="md:col-span-2 border border-line rounded px-2 py-1" />
                    <div className="md:col-span-4 flex gap-2 pt-1">
                      <Button type="button" onClick={() => updateRound(r.id, { status: "Completed", decision: "Advance" })} variant="secondary">Advance</Button>
                      <Button type="button" onClick={() => updateRound(r.id, { status: "Completed", decision: "Hold" })} variant="secondary">Hold</Button>
                      <Button type="button" onClick={() => updateRound(r.id, { status: "Completed", decision: "Reject" })} variant="secondary">Reject</Button>
                    </div>
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

  const shortlisted = candidates.filter((c: any) => ["Shortlisted", "Selected", "Interview"].includes(c.status));

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
              Basic % of Gross
              <Input type="number" step="0.01" value={ctc.basicPctOfGross} onChange={(e) => setCtc({ ...ctc, basicPctOfGross: Number(e.target.value) })} />
            </label>
            <label className="text-xs text-steel-muted">
              HRA % of Basic (0.4 non-metro, 0.5 metro)
              <Input type="number" step="0.01" value={ctc.hraPctOfBasic} onChange={(e) => setCtc({ ...ctc, hraPctOfBasic: Number(e.target.value) })} />
            </label>
            <label className="text-xs text-steel-muted">
              Gratuity % of Basic
              <Input type="number" step="0.0001" value={ctc.gratuityPctOfBasic} onChange={(e) => setCtc({ ...ctc, gratuityPctOfBasic: Number(e.target.value) })} />
            </label>
            <label className="text-xs text-steel-muted">
              LTA % of Basic
              <Input type="number" step="0.0001" value={ctc.ltaPctOfBasic} onChange={(e) => setCtc({ ...ctc, ltaPctOfBasic: Number(e.target.value) })} />
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
              Performance Pay % of CTC
              <Input type="number" step="0.01" value={ctc.performancePayPct} onChange={(e) => setCtc({ ...ctc, performancePayPct: Number(e.target.value) })} />
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
            <Select value={form.candidateId} onChange={(e) => setForm({ ...form, candidateId: e.target.value })} required>
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
