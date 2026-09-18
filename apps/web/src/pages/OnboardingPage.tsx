import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, apiBase, mediaUrl } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, TextArea } from "../components/ui";
import { canManageHrms, isJoiningEmployee } from "../lib/portalAccounts";

/**
 * Onboarding hub — top level shows all offers past "Accepted" with a live pre-join +
 * onboarding progress. Row → dedicated OfferOnboardingPage with the full checklist.
 */
export default function OnboardingPage() {
  const { offerId } = useParams();
  if (offerId) return <OfferOnboardingPage />;
  return <OnboardingList />;
}

function OnboardingList() {
  const { token, user } = useAuth();
  const [offers, setOffers] = useState<any[]>([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (isJoiningEmployee(user)) return;
    (async () => {
      try {
        const list = await api<any[]>("/api/hrm/offers", { token });
        setOffers(list.filter((o) => ["Accepted", "Joined"].includes(o.status)));
        setLoadError("");
      } catch (err) {
        setOffers([]);
        setLoadError(err instanceof Error ? err.message : "Could not load onboarding");
      }
    })();
  }, [token, user]);

  if (isJoiningEmployee(user)) {
    return (
      <Card className="!p-6 space-y-2">
        <p className="font-semibold text-ink">Pre-joining is managed by HR</p>
        <p className="text-sm text-steel-muted">
          Candidates do not use a separate joiner login. HR completes pre-joining and onboarding from the HR desk.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="!p-4 bg-brand-soft/20 border-brand/20">
        <p className="text-sm text-ink font-semibold">2 · Pre-Joining &amp; 3 · Employee Onboarding</p>
        <p className="text-xs text-steel-muted mt-1 leading-relaxed">
          After recruitment (section 1), accepted offers appear here. HR runs pre-joining — documents, BGV, medical,
          employee code, appointment letter, IT/email/ID — then onboarding formalities, KYC, PF/ESIC, orientation, and
          policy acknowledgement.
        </p>
        <Link to="/hrm/recruitment" className="text-xs text-brand font-semibold underline mt-2 inline-block">
          ← Recruitment &amp; interview (section 1)
        </Link>
      </Card>
      {loadError ? (
        <p className="text-sm rounded-lg px-3 py-2 bg-[color-mix(in_srgb,var(--color-danger)_12%,var(--color-paper))] text-danger border border-[color-mix(in_srgb,var(--color-danger)_35%,transparent)]">
          {loadError}
        </p>
      ) : null}
      <Card padding={false}>
        <div className="px-4 py-3 border-b border-line bg-sand/40 font-semibold text-sm">
          Accepted / joined ({offers.length})
        </div>
        <ul className="divide-y">
          {offers.map((o) => (
            <li key={o.id} className="px-4 py-3 flex items-center justify-between gap-4">
              <div>
                <div className="font-medium">{o.candidate?.fullName}</div>
                <div className="text-xs text-steel-muted">
                  {o.offerNo} · {o.designation} · CTC ₹{Number(o.ctcAnnual).toLocaleString("en-IN")} · joining{" "}
                  {o.joiningDate ? new Date(o.joiningDate).toLocaleDateString("en-IN") : "—"} ·{" "}
                  <Badge tone={o.status === "Joined" ? "ok" : "brand"}>{o.status}</Badge>
                </div>
              </div>
              <Link to={`/hrm/onboarding/${o.id}`}>
                <Button variant="secondary">Open checklist</Button>
              </Link>
            </li>
          ))}
          {!offers.length && <li className="px-4 py-6 text-center text-sm text-steel-muted">No accepted offers yet. Once a candidate accepts, they show up here.</li>}
        </ul>
      </Card>
    </div>
  );
}

function OfferOnboardingPage() {
  const { offerId } = useParams();
  const { token, user } = useAuth();
  const canHrWrite = canManageHrms(user);

  if (isJoiningEmployee(user)) {
    return (
      <Card className="!p-6 space-y-2">
        <p className="font-semibold text-ink">Pre-joining is managed by HR</p>
        <p className="text-sm text-steel-muted">
          Candidates do not use a separate joiner login. HR completes pre-joining and onboarding from the HR desk.
        </p>
        <Link to="/hrm/onboarding" className="text-xs text-brand font-semibold underline inline-block">
          ← Back to onboarding list
        </Link>
      </Card>
    );
  }

  const [offer, setOffer] = useState<any | null>(null);
  const [preJoin, setPreJoin] = useState<any | null>(null);
  const [onboard, setOnboard] = useState<any | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [letterHtml, setLetterHtml] = useState("");
  const [policyHtml, setPolicyHtml] = useState("");
  const [policyUrl, setPolicyUrl] = useState("");
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
      if (onboardRow?.itemsCompletedAt?._hrPolicyUrl) setPolicyUrl(onboardRow.itemsCompletedAt._hrPolicyUrl);
    } catch {
      setOnboard(null);
    }
    if (o?.candidate) {
      const docs = await api<any[]>(`/api/hrm/hrms-documents?kind=Appointment`, { token }).catch(() => []);
      const mine = docs.find(
        (d) =>
          (o.candidate.email && d.candidateEmail === o.candidate.email) ||
          d.employeeName === o.candidate.fullName,
      );
      if (mine?.id) {
        const res = await fetch(`${apiBase()}/api/hrm/hrms-documents/${mine.id}/preview`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (res.ok) setLetterHtml(await res.text());
      }
    }
    const policyRes = await fetch(`${apiBase()}/api/hrm/onboarding/${offerId}/hr-policy`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (policyRes.ok) setPolicyHtml(await policyRes.text());
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
    if (r?.hrPolicyUrl) setPolicyUrl(r.hrPolicyUrl);
    else if (r?.itemsCompletedAt?._hrPolicyUrl) setPolicyUrl(r.itemsCompletedAt._hrPolicyUrl);
    setMsg("Onboarding updated.");
    await load();
  }

  async function fileHrPolicy() {
    if (!offerId) return;
    try {
      const r = await api<{ url?: string; folder?: string; employeeName?: string }>(`/api/hrm/onboarding/${offerId}/hr-policy`, {
        method: "POST",
        token,
      });
      if (r.url) setPolicyUrl(r.url);
      setMsg(
        `HR policy acknowledgement filed under 06.02 Employee Files / ${r.employeeName || offer?.candidate?.fullName} / Onboarding.`,
      );
      const policyRes = await fetch(`${apiBase()}/api/hrm/onboarding/${offerId}/hr-policy`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (policyRes.ok) setPolicyHtml(await policyRes.text());
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not file HR policy");
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

  if (user && isJoiningEmployee(user)) {
    return (
      <Card className="!p-6 space-y-2">
        <p className="font-semibold text-ink">Pre-joining is managed by HR</p>
        <p className="text-sm text-steel-muted">
          Candidates do not use a separate joiner login. HR completes pre-joining and onboarding from the HR desk.
        </p>
      </Card>
    );
  }

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
              <Link to="/hrm/documents">
                <Button variant="secondary">Letters register</Button>
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

      <Card className="!p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-line bg-sand/40 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-semibold text-sm">HR policy acknowledgement · {offer?.candidate?.fullName}</div>
            <p className="text-[11px] text-steel-muted">
              Renders with this candidate&apos;s name. Filing saves it to SharePoint 06.02 Employee Files /{" "}
              {offer?.candidate?.fullName} / Onboarding.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {policyUrl ? (
              <a href={mediaUrl(policyUrl)} target="_blank" rel="noreferrer" className="text-xs text-brand underline">
                Open filed copy
              </a>
            ) : null}
            {canHrWrite ? (
              <Button type="button" variant="secondary" onClick={() => void fileHrPolicy()}>
                File acknowledgement
              </Button>
            ) : null}
          </div>
        </div>
        {policyHtml ? (
          <iframe title="HR policy acknowledgement" srcDoc={policyHtml} className="w-full h-[420px] border-0 bg-white" />
        ) : (
          <p className="px-4 py-6 text-sm text-steel-muted">Loading policy…</p>
        )}
      </Card>

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
            <p className="text-[11px] text-steel-muted mt-3">Uploaded files are stored under _HR/06.02 Employee Files with names like PAN_{`{empCode}`}_scan.pdf</p>
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
                    if (item.key === "hrPolicyAcknowledged" && e.target.checked) {
                      void fileHrPolicy();
                      return;
                    }
                    void updateOnboard({ [item.key]: e.target.checked });
                  }}
                  disabled={!canHrWrite}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div>{item.label}</div>
                  {item.key === "hrPolicyAcknowledged" && (
                    <div className="text-[10px] text-steel-muted mt-0.5">
                      Opens the policy with {offer?.candidate?.fullName}&apos;s name and files it in their HR folder.
                    </div>
                  )}
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
      <Card padding={false}>
        <div className="px-4 py-3 border-b border-line bg-sand/40 font-semibold text-sm">Employee audit log</div>
        <ul className="divide-y max-h-96 overflow-y-auto">
          {timeline.map((e) => (
            <li key={e.id} className="px-4 py-2 text-xs">
              <div className="flex justify-between">
                <span className="font-mono">{e.action}</span>
                <span className="text-steel-muted">{new Date(e.createdAt).toLocaleString("en-IN")}</span>
              </div>
              {e.metaJson && (
                <div className="text-[10px] text-steel-muted mt-0.5 font-mono truncate">{e.metaJson}</div>
              )}
            </li>
          ))}
          {!timeline.length && <li className="px-4 py-4 text-center text-sm text-steel-muted">No audit events for this candidate yet.</li>}
        </ul>
      </Card>
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
