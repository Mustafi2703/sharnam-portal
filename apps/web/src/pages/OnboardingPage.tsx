import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, mediaUrl } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, TextArea } from "../components/ui";
import { canManageHrms } from "../lib/portalAccounts";

/**
 * Onboarding hub — top level shows all offers past "Accepted" with a live pre-join +
 * onboarding progress. Row → dedicated OfferOnboardingPage with the full checklist.
 */
export default function OnboardingPage() {
  const { offerId } = useParams();
  if (offerId) return <OfferOnboardingPage />;
  return <OnboardingList />;
}

const JOIN_STEPS = ["Convert", "Documents", "Letters", "Pre-join", "Day 1"];

function OnboardingList() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loadError, setLoadError] = useState("");
  const [busyId, setBusyId] = useState("");

  async function load() {
    try {
      setRows(await api<any[]>("/api/hrm/onboarding-board", { token }));
      setLoadError("");
    } catch (err) {
      setRows([]);
      setLoadError(err instanceof Error ? err.message : "Could not load onboarding");
    }
  }

  useEffect(() => {
    void load();
  }, [token]);

  async function openDesk(row: any) {
    if (row.offerId) {
      navigate(`/hrm/onboarding/${row.offerId}`);
      return;
    }
    setBusyId(row.candidateId);
    try {
      const desk = await api<{ offerId: string }>(`/api/hrm/candidates/${row.candidateId}/start-onboarding`, {
        method: "POST",
        token,
      });
      navigate(`/hrm/onboarding/${desk.offerId}`);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not open the checklist");
      setBusyId("");
    }
  }

  return (
    <div className="space-y-4">
      <Card className="!p-4">
        <p className="text-sm font-semibold">New joinee desk</p>
        <p className="text-xs text-steel-muted mt-1 leading-relaxed">
          People converted from Recruitment land here. Open a person to finish documents, the appointment letter, employee code, email, and Day 1 formalities.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {JOIN_STEPS.map((step, i) => (
            <span key={step} className="inline-flex items-center gap-2 text-xs">
              <span className="h-6 min-w-6 px-1.5 rounded-full grid place-items-center text-[11px] font-semibold text-white" style={{ background: "var(--module-accent, #0D9488)" }}>{i + 1}</span>
              <span className="font-medium">{step}</span>
              {i < JOIN_STEPS.length - 1 ? <span className="text-steel-muted">→</span> : null}
            </span>
          ))}
        </div>
      </Card>
      {loadError ? (
        <p className="text-sm rounded-lg px-3 py-2 bg-[color-mix(in_srgb,var(--color-danger)_12%,var(--color-paper))] text-danger border border-[color-mix(in_srgb,var(--color-danger)_35%,transparent)]">
          {loadError}
        </p>
      ) : null}
      <div className="grid lg:grid-cols-2 gap-3">
        {rows.map((row) => (
          <Card key={row.candidateId} className="!p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{row.fullName}</p>
                <p className="text-xs text-steel-muted mt-0.5">
                  {[row.designation, row.department, row.requisitionNo].filter(Boolean).join(" · ") || "Joined"}
                </p>
              </div>
              <Badge tone="ok">{row.status}</Badge>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-steel-muted">Employee code</dt>
                <dd className="font-medium">{row.empCode || "Pending"}</dd>
              </div>
              <div>
                <dt className="text-steel-muted">Joining</dt>
                <dd className="font-medium">{row.joinDate ? new Date(row.joinDate).toLocaleDateString("en-IN") : "—"}</dd>
              </div>
              <div>
                <dt className="text-steel-muted">Documents</dt>
                <dd className="font-medium">{row.documentCount || 0} on file</dd>
              </div>
              <div>
                <dt className="text-steel-muted">CTC</dt>
                <dd className="font-medium">{row.ctcAnnual ? `₹${Number(row.ctcAnnual).toLocaleString("en-IN")}` : "—"}</dd>
              </div>
            </dl>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Button type="button" disabled={busyId === row.candidateId} onClick={() => void openDesk(row)}>
                {busyId === row.candidateId ? "Opening…" : "Open checklist"}
              </Button>
              {row.userId ? (
                <Link to={`/hrm/documents?employeeUserId=${row.userId}`} className="inline-flex items-center justify-center rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs font-semibold">
                  Letters
                </Link>
              ) : null}
              {row.userId ? (
                <Link to={`/hrm/files?userId=${row.userId}`} className="inline-flex items-center justify-center rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs font-semibold">
                  Employee files
                </Link>
              ) : null}
            </div>
          </Card>
        ))}
      </div>
      {!rows.length && !loadError ? (
        <Card>
          <p className="text-sm font-medium">No joinees yet</p>
          <p className="text-xs text-steel-muted mt-1">
            Score the interviews, open Compare, convert the person you select, then they appear on this desk.
          </p>
          <Link to="/hrm/recruitment?tab=compare" className="text-xs font-semibold text-brand underline mt-2 inline-block">
            Go to Compare
          </Link>
        </Card>
      ) : null}
    </div>
  );
}

function OfferOnboardingPage() {
  const { offerId } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [portalBusy, setPortalBusy] = useState(false);
  const canHrWrite = canManageHrms(user);

  const [offer, setOffer] = useState<any | null>(null);
  const [preJoin, setPreJoin] = useState<any | null>(null);
  const [onboard, setOnboard] = useState<any | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [logOpen, setLogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [staffUserId, setStaffUserId] = useState("");
  const [form, setForm] = useState<any | null>(null);
  const [day1, setDay1] = useState<Record<string, boolean> | null>(null);
  const [notes, setNotes] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [vaultDocs, setVaultDocs] = useState<Array<{ id: string; category: string; title: string; fileUrl: string; storagePath?: string | null; createdAt: string }>>([]);
  const docUploadRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    if (!offerId) return;
    const o = await api<any>(`/api/hrm/offers/${offerId}`, { token });
    setOffer(o);
    let linked = o?.onboard?.userId || "";
    try {
      const pre = await api<any>(`/api/hrm/pre-joining/${offerId}`, { token });
      setPreJoin(pre);
      setForm({
        docCollectionDone: !!pre.docCollectionDone,
        bgvStatus: pre.bgvStatus || "Pending",
        medicalStatus: pre.medicalStatus || "Pending",
        empCodeGenerated: pre.empCodeGenerated || "",
        appointmentLetterUrl: pre.appointmentLetterUrl || "",
        itAssetRequested: !!pre.itAssetRequested,
        emailCreated: !!pre.emailCreated,
        emailAddress: pre.emailAddress && pre.emailAddress !== "true" ? pre.emailAddress : o?.candidate?.email || "",
        idCardRequested: !!pre.idCardRequested,
        welcomeKitPrepared: !!pre.welcomeKitPrepared,
      });
      if (pre.linkedUserId) linked = pre.linkedUserId;
    } catch {
      setPreJoin(null);
      setForm(null);
    }
    try {
      const onboardRow = await api<any>(`/api/hrm/onboarding/${offerId}`, { token });
      setOnboard(onboardRow);
      if (onboardRow?.userId) linked = onboardRow.userId;
    } catch {
      setOnboard(null);
    }
    setStaffUserId(linked);
    if (linked) {
      const docs = await api<any[]>(`/api/hrm/employee-files?userId=${encodeURIComponent(linked)}`, { token }).catch(() => []);
      setVaultDocs(docs);
    } else {
      setVaultDocs([]);
    }
    if (canHrWrite && (linked || o?.candidate?.id)) {
      const q = new URLSearchParams();
      if (offerId) q.set("offerId", offerId);
      if (o?.candidate?.id) q.set("candidateId", o.candidate.id);
      const who = linked || o.candidate.id;
      const events = await api<any[]>(`/api/hrm/employees/${who}/timeline?${q.toString()}`, { token }).catch(() => []);
      setTimeline(events);
    } else {
      setTimeline([]);
    }
  };
  useEffect(() => {
    void load();
  }, [offerId, token]);

  useEffect(() => {
    if (!onboard) {
      setDay1(null);
      return;
    }
    setDay1({
      joiningFormalitiesDone: !!onboard.joiningFormalitiesDone,
      personalInfoDone: !!onboard.personalInfoDone,
      bankDetailsDone: !!onboard.bankDetailsDone,
      panAadhaarDone: !!onboard.panAadhaarDone,
      pfEsicDone: !!onboard.pfEsicDone,
      nomineeDone: !!onboard.nomineeDone,
      docVerificationDone: !!onboard.docVerificationDone,
      departmentAllocated: !!onboard.departmentAllocated,
      reportingManagerAssigned: !!onboard.reportingManagerAssigned,
      orientationDone: !!onboard.orientationDone,
      hrPolicyAcknowledged: !!onboard.hrPolicyAcknowledged,
    });
    setNotes(onboard.notes || "");
  }, [onboard]);

  async function addPortalLogin() {
    if (staffUserId) {
      navigate("/hrm/users");
      return;
    }
    const candidateId = offer?.candidate?.id;
    if (!candidateId) return;
    setPortalBusy(true);
    try {
      const res = await api<{ email: string; fullName: string; created: boolean }>(`/api/hrm/candidates/${candidateId}/convert`, {
        method: "POST",
        token,
      });
      setMsg(`${res.fullName} can sign in as ${res.email}. Set department, CTC, and project under Users.`);
      await load();
      navigate("/hrm/users");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not add the portal login");
      setPortalBusy(false);
    }
  }

  async function saveChecklist() {
    if (!offerId || !form) return;
    setSaving(true);
    setMsg("");
    try {
      const pre = await api<any>(`/api/hrm/pre-joining/${offerId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({
          ...form,
          emailCreated: !!(form.emailCreated || form.emailAddress),
        }),
      });
      setPreJoin(pre);
      if (day1) {
        const row = await api<any>(`/api/hrm/onboarding/${offerId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify({ ...day1, notes }),
        });
        setOnboard(row);
      }
      setMsg("Checklist saved.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not save the checklist");
    } finally {
      setSaving(false);
    }
  }

  async function uploadPreJoinDocs(files: FileList | null, category: string) {
    if (!offerId || !files?.length) return;
    setUploadBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      fd.append("category", category);
      const r = await api<{ uploaded: number }>(`/api/hrm/pre-joining/${offerId}/documents`, {
        method: "POST",
        token,
        body: fd,
      });
      setMsg(`${r.uploaded} file(s) uploaded to your HR folder (${category}).`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadBusy(false);
      if (docUploadRef.current) docUploadRef.current.value = "";
    }
  }

  type PreJoinItem = {
    key: string;
    label: string;
    hrOnly?: boolean;
    candidate?: boolean;
    picker?: string[];
    text?: boolean;
    boolTextKey?: string;
    afterLetter?: boolean;
  };

  const preJoinItems = useMemo((): PreJoinItem[] => {
    return [
      { key: "docCollectionDone", label: "1 · Document collection", candidate: true },
      { key: "bgvStatus", label: "2 · Background verification", hrOnly: true, picker: ["Pending", "In-Progress", "Cleared", "Failed"] },
      { key: "medicalStatus", label: "3 · Medical fitness", hrOnly: true, picker: ["Pending", "In-Progress", "Cleared", "Failed", "Not-Applicable"] },
      { key: "empCodeGenerated", label: "4 · Employee code generated", hrOnly: true, text: true },
      { key: "appointmentLetterUrl", label: "5 · Appointment letter", hrOnly: true, text: true },
      { key: "itAssetRequested", label: "6 · IT asset allocation request", candidate: true },
      { key: "emailCreated", label: "7 · Email ID created", hrOnly: true, text: true, boolTextKey: "emailAddress" },
      { key: "idCardRequested", label: "8 · ID card request", candidate: true },
      { key: "welcomeKitPrepared", label: "9 · Welcome kit ready", hrOnly: true, afterLetter: true },
    ];
  }, []);

  function canEditPreJoinItem(item: PreJoinItem) {
    return canHrWrite;
  }

  const preJoinComplete = useMemo(() => {
    if (!preJoin) return !!user?.preJoinComplete;
    return [
      preJoin.docCollectionDone,
      preJoin.bgvStatus === "Cleared",
      preJoin.medicalStatus === "Cleared" || preJoin.medicalStatus === "Not-Applicable",
      !!preJoin.empCodeGenerated,
      !!preJoin.appointmentLetterUrl,
      preJoin.itAssetRequested,
      preJoin.emailCreated,
      preJoin.idCardRequested,
      preJoin.welcomeKitPrepared,
    ].every(Boolean);
  }, [preJoin, user?.preJoinComplete]);

  const letterReady = preJoin
    ? [
        preJoin.docCollectionDone,
        preJoin.bgvStatus === "Cleared",
        preJoin.medicalStatus === "Cleared" || preJoin.medicalStatus === "Not-Applicable",
        !!preJoin.empCodeGenerated,
        preJoin.itAssetRequested,
        preJoin.emailCreated,
        preJoin.idCardRequested,
      ].every(Boolean)
    : false;

  const onboardItems = [
    { key: "joiningFormalitiesDone", label: "1 · Joining formalities" },
    { key: "personalInfoDone", label: "2 · Personal information captured" },
    { key: "bankDetailsDone", label: "3 · Bank details" },
    { key: "panAadhaarDone", label: "4 · PAN / Aadhaar uploaded" },
    { key: "pfEsicDone", label: "5 · PF / ESIC details" },
    { key: "nomineeDone", label: "6 · Nominee details" },
    { key: "docVerificationDone", label: "7 · Document verification" },
    { key: "departmentAllocated", label: "8 · Department allocation" },
    { key: "reportingManagerAssigned", label: "9 · Reporting manager assigned" },
    { key: "orientationDone", label: "10 · Orientation" },
    { key: "hrPolicyAcknowledged", label: "11 · HR policy acknowledged" },
  ];

  const preDone = form
    ? [
        form.docCollectionDone,
        form.bgvStatus === "Cleared",
        form.medicalStatus === "Cleared" || form.medicalStatus === "Not-Applicable",
        !!form.empCodeGenerated,
        !!form.appointmentLetterUrl,
        form.itAssetRequested,
        form.emailCreated || !!form.emailAddress,
        form.idCardRequested,
        form.welcomeKitPrepared,
      ].filter(Boolean).length
    : 0;

  const onboardDone = day1 ? onboardItems.filter((i) => day1[i.key]).length : 0;
  const preTotal = 9;
  const onboardTotal = onboardItems.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-lg">
            {offer ? `${offer.candidate?.fullName} · ${offer.designation}` : "Loading…"}
          </h2>
          {offer && (
            <p className="text-sm text-steel-muted mt-1">
              Offer {offer.offerNo} · CTC ₹{Number(offer.ctcAnnual).toLocaleString("en-IN")} · joining{" "}
              {offer.joiningDate ? new Date(offer.joiningDate).toLocaleDateString("en-IN") : "—"}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {canHrWrite && offerId ? (
            <Button
              type="button"
              disabled={!letterReady}
              title={!letterReady ? "Complete steps 1–4 and IT / email / ID before generating the letter" : undefined}
              onClick={async () => {
                try {
                  const letter = await api<any>(`/api/hrm/offers/${offerId}/appointment-letter`, { method: "POST", token });
                  setMsg(`Appointment ${letter.refNo} filed. Open it from the checklist.`);
                  await load();
                } catch (err) {
                  setMsg(err instanceof Error ? err.message : "Letter generate failed");
                }
              }}
            >
              Generate appointment letter
            </Button>
          ) : null}
          {canHrWrite && staffUserId ? (
            <Link to={`/hrm/files?userId=${staffUserId}`}>
              <Button variant="secondary">Employee files · upload PAN / payslip</Button>
            </Link>
          ) : null}
          {canHrWrite ? (
            <>
              <Link to={`/hrm/documents?offerId=${offerId}`}>
                <Button variant="secondary">Letter desk</Button>
              </Link>
              <Button type="button" variant="secondary" disabled={portalBusy} onClick={() => void addPortalLogin()}>
                {portalBusy ? "Opening…" : staffUserId ? "Portal setup" : "Add portal login"}
              </Button>
              <Link to="/hrm/onboarding">
                <Button variant="secondary">Back to list</Button>
              </Link>
            </>
          ) : null}
        </div>
      </div>
      {msg && <p className="text-sm text-brand-dark">{msg}</p>}

      {canHrWrite && form ? (
        <Card>
          <h3 className="font-semibold text-sm mb-1">Upload pre-joining documents</h3>
          <p className="text-[11px] text-steel-muted mb-3">
            PAN, Aadhaar, bank proof, education certificates, photo — saved to your HR employee folder.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs flex flex-col gap-1">
              <span className="text-steel-muted">Category</span>
              <select id="prejoin-doc-category" defaultValue="PAN" className="border border-line rounded px-2 py-1.5 text-sm">
                <option value="PAN">PAN card</option>
                <option value="Aadhaar">Aadhaar</option>
                <option value="Bank">Bank proof / cancelled cheque</option>
                <option value="Education">Education / experience</option>
                <option value="Photo">Passport photo</option>
                <option value="PF-ESIC">PF / ESIC</option>
                <option value="Medical">Medical fitness</option>
                <option value="BGV">BGV report</option>
                <option value="Other">Other pre-join</option>
              </select>
            </label>
            <input
              ref={docUploadRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              hidden
              onChange={(e) => {
                const cat = (document.getElementById("prejoin-doc-category") as HTMLSelectElement)?.value || "Pre-join";
                void uploadPreJoinDocs(e.target.files, cat);
              }}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={uploadBusy}
              onClick={() => docUploadRef.current?.click()}
            >
              {uploadBusy ? "Uploading…" : "Choose files"}
            </Button>
          </div>
          {vaultDocs.length ? (
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-xs font-semibold text-ink mb-2">Files in HR vault ({vaultDocs.length})</p>
              <ul className="divide-y text-xs">
                {vaultDocs.map((d) => (
                  <li key={d.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <Badge tone="brand">{d.category}</Badge>{" "}
                      <span className="text-steel-muted">{d.title}</span>
                    </span>
                    <a href={mediaUrl(d.fileUrl)} target="_blank" rel="noreferrer" className="text-brand underline shrink-0">
                      Open
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[11px] text-steel-muted mt-3">Uploaded files are stored in SharePoint under SPDC_HRMS/06_Records_Employee_Files, in KYC or the matching letter folder.</p>
          )}
        </Card>
      ) : null}

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <h3 className="font-semibold text-sm mb-1">Progress</h3>
          <p className="text-[11px] text-steel-muted mb-3">Nirav HRMS flow · sections 2 &amp; 3</p>
          <div className="space-y-3">
            <ProgressBar label={`Pre-joining · ${preDone}/${preTotal}`} value={preDone / preTotal} />
            <ProgressBar label={`Onboarding · ${onboardDone}/${onboardTotal}`} value={onboardDone / onboardTotal} tone="ok" />
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <h3 className="font-semibold text-sm mb-1">2 · Pre-Joining Process</h3>
          <p className="text-[11px] text-steel-muted mb-3">
            Document collection · BGV · medical · employee code · appointment letter · IT asset · email · ID card · welcome kit
          </p>
          {!form && <p className="text-sm text-steel-muted">Loading pre-joining checklist…</p>}
          {form && (
            <ul className="space-y-2 text-sm">
              {preJoinItems.map((item) => {
                const editable = canEditPreJoinItem(item);
                const lockedAfterLetter = item.afterLetter && !form.appointmentLetterUrl;
                if (item.key === "appointmentLetterUrl") {
                  return (
                    <li key={item.key} className="flex items-center gap-3 border-t border-line pt-2">
                      <span className="flex-1">{item.label}</span>
                      {form.appointmentLetterUrl ? (
                        <a href={mediaUrl(form.appointmentLetterUrl)} target="_blank" rel="noreferrer" className="text-xs font-semibold text-brand">Open letter</a>
                      ) : (
                        <span className="text-xs text-steel-muted">Not filed yet</span>
                      )}
                    </li>
                  );
                }
                if (item.key === "emailCreated") {
                  return (
                    <li key={item.key} className="flex flex-wrap items-center gap-3 border-t border-line pt-2">
                      <input
                        type="checkbox"
                        checked={!!form.emailCreated}
                        onChange={(e) => setForm({ ...form, emailCreated: e.target.checked })}
                        disabled={!editable}
                      />
                      <span className="flex-1">{item.label}</span>
                      <Input
                        value={form.emailAddress || ""}
                        onChange={(e) => setForm({ ...form, emailAddress: e.target.value, emailCreated: !!e.target.value || form.emailCreated })}
                        placeholder="name@spdc.in"
                        disabled={!editable}
                        className="max-w-xs"
                      />
                    </li>
                  );
                }
                if (item.text) {
                  return (
                    <li key={item.key} className="flex items-center gap-3 border-t border-line pt-2">
                      <span className="flex-1">{item.label}</span>
                      <Input
                        value={form[item.key] || ""}
                        onChange={(e) => setForm({ ...form, [item.key]: e.target.value })}
                        placeholder="EMP-000"
                        disabled={!editable}
                        className="max-w-[10rem]"
                      />
                    </li>
                  );
                }
                if (item.picker) {
                  return (
                    <li key={item.key} className="flex items-center gap-3 border-t border-line pt-2">
                      <span className="flex-1">{item.label}</span>
                      <select
                        value={form[item.key] || "Pending"}
                        onChange={(e) => setForm({ ...form, [item.key]: e.target.value })}
                        disabled={!editable}
                        className="border border-line rounded px-2 py-1 text-xs"
                      >
                        {item.picker.map((p) => <option key={p}>{p}</option>)}
                      </select>
                    </li>
                  );
                }
                return (
                  <li key={item.key} className="flex items-center gap-3 border-t border-line pt-2">
                    <input
                      type="checkbox"
                      checked={!!form[item.key]}
                      onChange={(e) => setForm({ ...form, [item.key]: e.target.checked })}
                      disabled={!editable || lockedAfterLetter}
                    />
                    <span className="flex-1">
                      {item.label}
                      {item.afterLetter && !form.appointmentLetterUrl ? (
                        <span className="block text-[10px] text-steel-muted">After the appointment letter is filed</span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <h3 className="font-semibold text-sm mb-1">3 · Employee Onboarding</h3>
        <p className="text-[11px] text-steel-muted mb-3">
          Joining formalities · personal &amp; bank details · PAN/Aadhaar · PF/ESIC · nominee · doc verification · department ·
          reporting manager · orientation · HR policy
        </p>
        {!onboard && preJoinComplete && <p className="text-sm text-steel-muted">Loading onboarding checklist…</p>}
        {day1 && (preJoinComplete || canHrWrite) && (
          <ul className="grid md:grid-cols-2 gap-2 text-sm">
            {onboardItems.map((item) => (
              <li key={item.key} className="flex items-start gap-2 border border-line rounded-lg px-3 py-2">
                <input
                  type="checkbox"
                  checked={!!day1[item.key]}
                  onChange={(e) => setDay1({ ...day1, [item.key]: e.target.checked })}
                  disabled={!canHrWrite}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div>{item.label}</div>
                  {onboard?.itemsCompletedAt?.[item.key] && (
                    <div className="text-[10px] text-steel-muted mt-0.5">
                      Completed {new Date(onboard.itemsCompletedAt[item.key]).toLocaleString("en-IN")}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {day1 && (preJoinComplete || canHrWrite) && (
          <TextArea
            rows={2}
            placeholder="Onboarding notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-3"
            disabled={!canHrWrite}
          />
        )}
        {canHrWrite && form ? (
          <div className="mt-4">
            <Button type="button" disabled={saving} onClick={() => void saveChecklist()}>
              {saving ? "Saving…" : "Save checklist"}
            </Button>
          </div>
        ) : null}
      </Card>

      {canHrWrite ? (
        <>
          <Button type="button" variant="secondary" onClick={() => setLogOpen(true)}>
            Activity log ({timeline.length})
          </Button>
          {logOpen ? (
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/45" role="dialog" aria-modal="true" aria-label="Onboarding activity">
              <div className="bg-paper border border-line rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-xl">
                <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-3">
                  <p className="font-semibold text-sm">Activity · {offer?.candidate?.fullName}</p>
                  <Button type="button" variant="secondary" onClick={() => setLogOpen(false)}>Close</Button>
                </div>
                <ul className="divide-y overflow-y-auto">
                  {timeline.map((e) => (
                    <li key={e.id} className="px-4 py-2 text-xs">
                      <div className="flex justify-between gap-3">
                        <span className="font-mono">{e.action}</span>
                        <span className="text-steel-muted whitespace-nowrap">{new Date(e.createdAt).toLocaleString("en-IN")}</span>
                      </div>
                    </li>
                  ))}
                  {!timeline.length && <li className="px-4 py-8 text-center text-sm text-steel-muted">No activity for this person yet.</li>}
                </ul>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function ProgressBar({ label, value, tone = "brand" }: { label: string; value: number; tone?: "brand" | "ok" }) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <div>
      <div className="flex justify-between text-xs mb-1"><span>{label}</span><span className="tabular-nums">{Math.round(pct)}%</span></div>
      <div className="h-2 rounded bg-sand overflow-hidden">
        <div className={`h-full ${tone === "ok" ? "bg-ok" : "bg-brand"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
