import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, apiBase, mediaUrl } from "../api";
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
  const { token, user } = useAuth();
  const canHrWrite = canManageHrms(user);

  const [offer, setOffer] = useState<any | null>(null);
  const [preJoin, setPreJoin] = useState<any | null>(null);
  const [onboard, setOnboard] = useState<any | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [letterHtml, setLetterHtml] = useState("");
  const [logOpen, setLogOpen] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [vaultDocs, setVaultDocs] = useState<Array<{ id: string; category: string; title: string; fileUrl: string; storagePath?: string | null; createdAt: string }>>([]);
  const signedUploadRef = useRef<HTMLInputElement | null>(null);
  const docUploadRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    if (!offerId) return;
    const o = await api<any>(`/api/hrm/offers/${offerId}`, { token });
    setOffer(o);
    try {
      setPreJoin(await api<any>(`/api/hrm/pre-joining/${offerId}`, { token }));
    } catch {
      setPreJoin(null);
    }
    try {
      const onboardRow = await api<any>(`/api/hrm/onboarding/${offerId}`, { token });
      setOnboard(onboardRow);
    } catch {
      setOnboard(null);
    }
    if (o?.candidate) {
      const docs = await api<any[]>(`/api/hrm/hrms-documents?kind=Appointment`, { token }).catch(() => []);
      const person = String(o.candidate.fullName || "").trim().toLowerCase();
      const mine = docs.find((d) => String(d.employeeName || "").trim().toLowerCase() === person);
      if (mine?.id) {
        const res = await fetch(`${apiBase()}/api/hrm/hrms-documents/${mine.id}/preview`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (res.ok) setLetterHtml(await res.text());
      }
    }
    if (o?.onboard?.userId) {
      const docs = await api<any[]>(`/api/hrm/employee-files?userId=${encodeURIComponent(o.onboard.userId)}`, { token }).catch(() => []);
      setVaultDocs(docs);
    } else {
      setVaultDocs([]);
    }
    if (o?.candidate?.id && canHrWrite) {
      const events = await api<any[]>(`/api/hrm/employees/${o.candidate.id}/timeline`, { token }).catch(() => []);
      setTimeline(events);
    } else {
      setTimeline([]);
    }
  };
  useEffect(() => {
    void load();
  }, [offerId, token]);

  async function updatePreJoin(patch: any) {
    if (!offerId) return;
    const r = await api<any>(`/api/hrm/pre-joining/${offerId}`, { method: "PATCH", token, body: JSON.stringify(patch) });
    setPreJoin(r);
    setMsg("Pre-joining updated.");
    await load();
  }
  async function updateOnboard(patch: any) {
    if (!offerId) return;
    const r = await api<any>(`/api/hrm/onboarding/${offerId}`, { method: "PATCH", token, body: JSON.stringify(patch) });
    setOnboard(r);
    setMsg("Onboarding updated.");
    await load();
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
    if (!preJoin) return [];
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
  }, [preJoin]);

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

  const preDone = preJoin
    ? [
        preJoin.docCollectionDone,
        preJoin.bgvStatus === "Cleared",
        preJoin.medicalStatus === "Cleared" || preJoin.medicalStatus === "Not-Applicable",
        !!preJoin.empCodeGenerated,
        !!preJoin.appointmentLetterUrl,
        preJoin.itAssetRequested,
        preJoin.emailCreated,
        preJoin.idCardRequested,
        preJoin.welcomeKitPrepared,
      ].filter(Boolean).length
    : 0;

  const onboardDone = onboard ? onboardItems.filter((i) => onboard[i.key]).length : 0;
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
                  setMsg(`Appointment ${letter.refNo} generated and filed under 06.02 Employee Files / ${offer?.candidate?.fullName}.`);
                  const res = await fetch(`${apiBase()}/api/hrm/hrms-documents/${letter.id}/preview`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                  });
                  if (res.ok) setLetterHtml(await res.text());
                  await load();
                } catch (err) {
                  setMsg(err instanceof Error ? err.message : "Letter generate failed");
                }
              }}
            >
              Generate appointment letter
            </Button>
          ) : null}
          {canHrWrite && offer?.onboard?.userId ? (
            <Link to={`/hrm/files?userId=${offer.onboard.userId}`}>
              <Button variant="secondary">Employee files · upload PAN / payslip</Button>
            </Link>
          ) : null}
          {canHrWrite ? (
            <>
              <Link to={`/hrm/documents?offerId=${offerId}`}>
                <Button variant="secondary">Letter desk</Button>
              </Link>
              <Link to="/hrm/onboarding">
                <Button variant="secondary">Back to list</Button>
              </Link>
            </>
          ) : null}
        </div>
      </div>
      {msg && <p className="text-sm text-brand-dark">{msg}</p>}

      {letterHtml ? (
        <Card className="!p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-line bg-sand/40 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-semibold text-sm">Appointment letter · {offer?.candidate?.fullName}</div>
              <p className="text-[11px] text-steel-muted">
                Candidate name, designation, CTC and joining date merged into the SPDC letter. Filed under 06.02 Employee Files.
              </p>
            </div>
            {preJoin?.appointmentLetterUrl ? (
              <a href={mediaUrl(preJoin.appointmentLetterUrl)} target="_blank" rel="noreferrer" className="text-xs text-brand underline">
                Open filed copy
              </a>
            ) : null}
            {canHrWrite ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  className="!text-xs"
                  onClick={() => {
                    signedUploadRef.current?.click();
                  }}
                >
                  Upload signed copy
                </Button>
                <input
                  ref={signedUploadRef}
                  type="file"
                  accept=".pdf,.doc,.docx,image/*"
                  hidden
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !offerId) return;
                    try {
                      const fd = new FormData();
                      fd.append("file", file);
                      await api(`/api/hrm/offers/${offerId}/signed-appointment`, { method: "POST", token, body: fd });
                      setMsg(`Signed appointment saved to employee docs and letters register.`);
                      await load();
                    } catch (err) {
                      setMsg(err instanceof Error ? err.message : "Upload failed");
                    } finally {
                      if (signedUploadRef.current) signedUploadRef.current.value = "";
                    }
                  }}
                />
              </>
            ) : null}
          </div>
          <iframe title="Appointment letter" srcDoc={letterHtml} className="w-full h-[520px] border-0 bg-white" />
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-steel-muted">
            {`Generate the appointment letter after steps 1–4 and IT / email / ID are done — preview ${offer?.candidate?.fullName || "the candidate"}'s name, designation, CTC and joining date on the SPDC letterhead.`}
          </p>
        </Card>
      )}

      {canHrWrite && preJoin ? (
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
          {!preJoin && <p className="text-sm text-steel-muted">Loading pre-joining checklist…</p>}
          {preJoin && (
            <ul className="space-y-2 text-sm">
              {preJoinItems.map((item) => {
                const editable = canEditPreJoinItem(item);
                const lockedAfterLetter = item.afterLetter && !preJoin.appointmentLetterUrl;
                return (
                <li key={item.key} className="flex items-center gap-3 border-t border-line pt-2">
                  {"text" in item && item.text ? (
                    <>
                      <span className="flex-1">
                        {item.label}
                      </span>
                      {canHrWrite ? (
                        <>
                          <Input
                            defaultValue={preJoin[item.key] || ""}
                            onBlur={(e) => updatePreJoin({ [item.key]: e.target.value })}
                            placeholder={item.boolTextKey ? "e.g. jane@spdc.in" : item.key === "empCodeGenerated" ? "SPDC-001" : ""}
                            disabled={!editable || lockedAfterLetter}
                            className="max-w-xs"
                          />
                          {item.key === "appointmentLetterUrl" && preJoin.appointmentLetterUrl ? (
                            <a href={mediaUrl(preJoin.appointmentLetterUrl)} target="_blank" rel="noreferrer" className="text-xs text-brand underline">
                              Open
                            </a>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-xs text-steel-muted tabular-nums">
                          {item.key === "appointmentLetterUrl"
                            ? preJoin.appointmentLetterUrl
                              ? "Ready"
                              : "Pending"
                            : preJoin[item.key]
                              ? String(preJoin[item.key])
                              : preJoin[item.boolTextKey || ""] || "Pending"}
                        </span>
                      )}
                    </>
                  ) : "picker" in item && item.picker ? (
                    <>
                      <span className="flex-1">
                        {item.label}
                      </span>
                      {canHrWrite ? (
                        <select
                          defaultValue={preJoin[item.key] || "Pending"}
                          onChange={(e) => updatePreJoin({ [item.key]: e.target.value })}
                          disabled={!editable}
                          className="border border-line rounded px-2 py-1 text-xs"
                        >
                          {item.picker.map((p) => <option key={p}>{p}</option>)}
                        </select>
                      ) : (
                        <Badge tone={preJoin[item.key] === "Cleared" ? "ok" : "neutral"}>{preJoin[item.key] || "Pending"}</Badge>
                      )}
                    </>
                  ) : (
                    <>
                      <input
                        type="checkbox"
                        checked={!!preJoin[item.key]}
                        onChange={(e) => updatePreJoin({ [item.key]: e.target.checked })}
                        disabled={!editable || lockedAfterLetter}
                      />
                      <span className="flex-1">
                        {item.label}
                        {item.afterLetter && !preJoin.appointmentLetterUrl ? (
                          <span className="block text-[10px] text-steel-muted">After appointment letter</span>
                        ) : null}
                      </span>
                    </>
                  )}
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
        {onboard && (preJoinComplete || canHrWrite) && (
          <ul className="grid md:grid-cols-2 gap-2 text-sm">
            {onboardItems.map((item) => (
              <li key={item.key} className="flex items-start gap-2 border border-line rounded-lg px-3 py-2">
                <input
                  type="checkbox"
                  checked={!!onboard[item.key]}
                  onChange={(e) => {
                    void updateOnboard({ [item.key]: e.target.checked });
                  }}
                  disabled={!canHrWrite}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div>{item.label}</div>
                  {onboard.itemsCompletedAt?.[item.key] && (
                    <div className="text-[10px] text-steel-muted mt-0.5">
                      Completed {new Date(onboard.itemsCompletedAt[item.key]).toLocaleString("en-IN")}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {onboard && (preJoinComplete || canHrWrite) && (
          <TextArea
            rows={2}
            placeholder="Onboarding notes"
            defaultValue={onboard.notes || ""}
            onBlur={(e) => updateOnboard({ notes: e.target.value })}
            className="mt-3"
            disabled={!canHrWrite}
          />
        )}
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
