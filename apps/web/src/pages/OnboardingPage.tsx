import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, Select, TextArea } from "../components/ui";
import { formatUiText } from "../lib/formatUiText";
import { canManageHrms } from "../lib/portalAccounts";
import { hrFileContentUrl, isHrImage } from "../lib/hrFileView";
import { StatusNote } from "../components/StatusNote";

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

type WorkingHourOption = { id: string; label: string };

function asHourList(payload: unknown): WorkingHourOption[] {
  if (Array.isArray(payload)) {
    return payload.filter((row): row is WorkingHourOption => !!row && typeof row.id === "string" && typeof row.label === "string");
  }
  const options = payload && typeof payload === "object" ? (payload as { options?: unknown }).options : null;
  return Array.isArray(options)
    ? options.filter((row): row is WorkingHourOption => !!row && typeof row.id === "string" && typeof row.label === "string")
    : [];
}

function echoedText(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

/** Documents, appointment letter, employee code, bank, PF / ESIC, and nominee. */
function joineeOnboardingProgress(row: any, offer?: any): number {
  const letter = row?.appointmentLetterUrl || offer?.appointmentLetterUrl || row?.preJoin?.appointmentLetterUrl;
  const code = row?.empCode || offer?.empCode;
  const checks = [
    Number(row?.documentCount) > 0,
    !!letter,
    !!String(code || "").trim(),
    !!(row?.bankDetailsDone || offer?.onboard?.bankDetailsDone),
    !!(row?.pfEsicDone || offer?.onboard?.pfEsicDone),
    !!(row?.nomineeDone || offer?.onboard?.nomineeDone),
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

function OnboardingList() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [loadError, setLoadError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    try {
      const [board, offerRows] = await Promise.all([
        api<any[]>("/api/hrm/onboarding-board", { token }),
        api<any[]>("/api/hrm/offers", { token }).catch(() => []),
      ]);
      setRows(board);
      setOffers(Array.isArray(offerRows) ? offerRows : []);
      setLoadError("");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load onboarding");
    }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { void load(); }, 15000);
    const onFocus = () => { void load(); };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [token]);

  const offerById = useMemo(() => {
    const map = new Map<string, any>();
    for (const offer of offers) {
      if (offer?.id) map.set(offer.id, offer);
    }
    return map;
  }, [offers]);

  const visible = rows.filter((row) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [row.fullName, row.email, row.designation, row.department, row.requisitionNo, row.empCode, row.offerNo]
      .some((v) => String(v || "").toLowerCase().includes(q));
  });

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
        <p className="text-sm font-semibold">{formatUiText("New Joinee Desk")}</p>
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, code, requisition" className="max-w-sm" />
        <p className="text-xs text-steel-muted">{visible.length} of {rows.length} joinees</p>
      </div>
      <div className="max-h-[32rem] overflow-y-auto rounded-xl border border-line bg-paper divide-y">
        {visible.map((row) => {
          const progress = joineeOnboardingProgress(row, row.offerId ? offerById.get(row.offerId) : undefined);
          return (
          <div key={row.candidateId} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{row.fullName}</p>
                <p className="text-xs text-steel-muted mt-0.5">
                  {[row.designation, row.department, row.requisitionNo].filter(Boolean).join(" · ") || formatUiText("Onboarding")}
                </p>
              </div>
              <div className="w-40 shrink-0">
                <ProgressBar
                  label={progress >= 100 ? formatUiText("Joined") : formatUiText("Onboarding")}
                  value={progress / 100}
                  tone={progress >= 100 ? "ok" : "brand"}
                />
              </div>
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
          </div>
          );
        })}
        {rows.length > 0 && !visible.length ? (
          <p className="p-4 text-sm text-steel-muted">No joinee matches that search.</p>
        ) : null}
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
  const [msg, setMsg] = useState("");
  const [signedFiled, setSignedFiled] = useState(false);
  const [hourOptions, setHourOptions] = useState<WorkingHourOption[]>([]);
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
    setMsg("");
    try {
      const o = await api<any>(`/api/hrm/offers/${offerId}`, { token });
      setOffer(o);
      let linked = o?.onboard?.userId || "";
      let pre: any = null;
      try {
        pre = await api<any>(`/api/hrm/pre-joining/${offerId}`, { token, timeoutMs: 30_000 });
        setPreJoin(pre);
        if (String(pre.appointmentLetterUrl || "").toLowerCase().includes("-signed")) setSignedFiled(true);
        setForm((prev: any) => ({
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
          bankDetail: echoedText(pre.bankDetail, prev?.bankDetail || ""),
          pfEsic: echoedText(pre.pfEsic, prev?.pfEsic || ""),
          nomineeDetails: echoedText(pre.nomineeDetails, prev?.nomineeDetails || ""),
          workingHours: echoedText(pre.workingHours, prev?.workingHours || ""),
        }));
        if (pre.linkedUserId) linked = pre.linkedUserId;
      } catch (err) {
        setPreJoin(null);
        setForm((prev: any) => ({
          docCollectionDone: false,
          bgvStatus: "Pending",
          medicalStatus: "Pending",
          empCodeGenerated: "",
          appointmentLetterUrl: "",
          itAssetRequested: false,
          emailCreated: false,
          emailAddress: o?.candidate?.email || "",
          idCardRequested: false,
          welcomeKitPrepared: false,
          bankDetail: prev?.bankDetail || "",
          pfEsic: prev?.pfEsic || "",
          nomineeDetails: prev?.nomineeDetails || "",
          workingHours: prev?.workingHours || "",
        }));
        setMsg(err instanceof Error ? err.message : "Could not load the pre-joining checklist. Try again.");
      }
      try {
        const onboardRow = await api<any>(`/api/hrm/onboarding/${offerId}`, { token });
        setOnboard(onboardRow);
        if (onboardRow?.userId) linked = onboardRow.userId;
        setForm((prev: any) => prev ? {
          ...prev,
          bankDetail: echoedText(onboardRow.bankDetail, prev.bankDetail || ""),
          pfEsic: echoedText(onboardRow.pfEsic, prev.pfEsic || ""),
          nomineeDetails: echoedText(onboardRow.nomineeDetails, prev.nomineeDetails || ""),
          workingHours: echoedText(onboardRow.workingHours, prev.workingHours || ""),
        } : prev);
      } catch {
        setOnboard(null);
      }
      setStaffUserId(linked);
      const fromCandidate = Array.isArray(pre?.candidateDocuments) ? pre.candidateDocuments : [];
      const fromVault = linked
        ? await api<any[]>(`/api/hrm/employee-files?userId=${encodeURIComponent(linked)}`, { token }).catch(() => [])
        : [];
      const seen = new Set(fromVault.map((d) => d.fileUrl));
      const merged = [...fromVault];
      for (const d of fromCandidate) {
        if (d?.fileUrl && !seen.has(d.fileUrl)) merged.push(d);
      }
      setVaultDocs(merged);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not open this onboarding page");
    }
  };
  useEffect(() => {
    void load();
  }, [offerId, token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api<unknown>("/api/hrm/working-hours", { token })
      .then((payload) => {
        if (!cancelled) setHourOptions(asHourList(payload));
      })
      .catch(() => {
        if (!cancelled) setHourOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    const onFocus = () => { void load(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
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
          body: JSON.stringify({
            ...day1,
            notes,
            bankDetail: form.bankDetail || "",
            pfEsic: form.pfEsic || "",
            nomineeDetails: form.nomineeDetails || "",
            workingHours: form.workingHours || "",
          }),
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
      const have = new Set(vaultDocs.map((doc) => doc.category));
      have.add(category);
      const required = ["PAN", "Aadhaar", "Education", "Experience", "Salary slips", "Address proof", "Photo", "Bank"];
      const onboardFlags: Record<string, boolean> = {};
      if (/pan|aadhaar/i.test(category)) onboardFlags.panAadhaarDone = true;
      if (/bank/i.test(category)) onboardFlags.bankDetailsDone = true;
      if (required.every((name) => have.has(name))) {
        onboardFlags.docVerificationDone = true;
        await api(`/api/hrm/pre-joining/${offerId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify({ docCollectionDone: true }),
        });
      }
      if (Object.keys(onboardFlags).length) {
        await api(`/api/hrm/onboarding/${offerId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(onboardFlags),
        });
      }
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
    statusPick?: boolean;
    text?: boolean;
    boolTextKey?: string;
    afterLetter?: boolean;
  };

  const preJoinItems = useMemo((): PreJoinItem[] => {
    return [
      { key: "docCollectionDone", label: "1 · Document collection", statusPick: true },
      { key: "bgvStatus", label: "2 · Background verification", hrOnly: true, picker: ["Pending", "In-Progress", "Cleared", "Failed"] },
      { key: "medicalStatus", label: "3 · Medical fitness", hrOnly: true, picker: ["Pending", "In-Progress", "Cleared", "Failed", "Not-Applicable"] },
      { key: "empCodeGenerated", label: "4 · Employee code generated", hrOnly: true, text: true },
      { key: "itAssetRequested", label: "5 · IT asset allocation", statusPick: true },
      { key: "emailCreated", label: "6 · Email ID created", hrOnly: true, text: true, boolTextKey: "emailAddress" },
      { key: "idCardRequested", label: "7 · ID card request", statusPick: true },
      { key: "welcomeKitPrepared", label: "8 · Welcome kit ready", statusPick: true },
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
      ].every(Boolean)
    : false;

  async function fileSignedAppointment(file: File | null) {
    if (!offerId || !file) return;
    setUploadBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api(`/api/hrm/offers/${offerId}/signed-appointment`, { method: "POST", token, body: fd });
      setSignedFiled(true);
      await load();
      setMsg(formatUiText("Signed Copy Has Been Filed."));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not file the signed letter");
    } finally {
      setUploadBusy(false);
    }
  }

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

  const hourChoices = useMemo(() => {
    const list = hourOptions.slice();
    const current = String(form?.workingHours || "").trim();
    if (current && !list.some((row) => row.label === current)) {
      list.unshift({ id: `current-${current}`, label: current });
    }
    return list;
  }, [hourOptions, form?.workingHours]);

  const preDone = form
    ? [
        form.docCollectionDone,
        form.bgvStatus === "Cleared",
        form.medicalStatus === "Cleared" || form.medicalStatus === "Not-Applicable",
        !!form.empCodeGenerated,
        form.itAssetRequested,
        form.emailCreated || !!form.emailAddress,
        form.idCardRequested,
        form.welcomeKitPrepared,
      ].filter(Boolean).length
    : 0;

  const onboardDone = day1 ? onboardItems.filter((i) => day1[i.key]).length : 0;
  const preTotal = 8;
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
              title={!letterReady ? "Complete document collection, background check, medical, and the employee code first" : undefined}
              onClick={async () => {
                try {
                  const letter = await api<any>(`/api/hrm/offers/${offerId}/appointment-letter`, { method: "POST", token });
                  setMsg(`Appointment ${letter.refNo} generated. File the signed copy on step 5 when they return it. IT, email, ID card, and the welcome kit can be saved now.`);
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
      <StatusNote msg={msg || (signedFiled ? formatUiText("Signed Copy Has Been Filed.") : "")} />

      {canHrWrite && form ? (
        <Card>
          <h3 className="font-semibold text-sm mb-3">Upload pre-joining documents</h3>
          <ul className="space-y-2">
            {["PAN", "Aadhaar", "Education", "Experience", "Salary slips", "Address proof", "Photo", "Bank"].map((kind) => {
              const filed = vaultDocs.find((doc) => doc.category === kind);
              return (
                <li key={kind} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className={filed ? "text-emerald-700" : "text-red-700"}>{kind}</span>
                  <Button type="button" variant="secondary" disabled={uploadBusy} onClick={() => {
                    const input = docUploadRef.current;
                    if (!input) return;
                    input.dataset.category = kind;
                    input.click();
                  }}>
                    {filed ? "Replace" : "Upload"}
                  </Button>
                  {filed ? (
                    <a href={hrFileContentUrl(filed.id, token)} target="_blank" rel="noreferrer" className="text-xs font-semibold text-brand">
                      Open
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div className="hidden">
            <input
              ref={docUploadRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              hidden
              onChange={(e) => {
                const cat = docUploadRef.current?.dataset.category || "Other";
                void uploadPreJoinDocs(e.target.files, cat);
              }}
            />
          </div>
          <div className="mt-4 border-t border-line pt-3 flex flex-wrap items-center gap-3">
            <span className="text-sm">Signed Appointment Letter</span>
            <label className="text-xs">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="hidden"
                disabled={uploadBusy}
                onChange={(e) => void fileSignedAppointment(e.target.files?.[0] || null)}
              />
              <span className="inline-flex items-center rounded-md border border-line px-2 py-1 cursor-pointer">
                {uploadBusy ? "Filing…" : formatUiText("File Signed Copy")}
              </span>
            </label>
            {signedFiled ? <span className="text-xs text-emerald-700">{formatUiText("Signed Copy Has Been Filed.")}</span> : null}
          </div>
          {vaultDocs.length ? (
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-xs font-semibold text-ink mb-2">Documents on file ({vaultDocs.length})</p>
              <ul className="divide-y text-xs max-h-64 overflow-y-auto">
                {vaultDocs.map((d) => (
                  <li key={d.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2 min-w-0">
                      {isHrImage(d) ? (
                        <img src={hrFileContentUrl(d.id, token)} alt={d.title || d.category} className="h-14 w-14 rounded border border-line object-cover bg-sand" />
                      ) : null}
                      <span>
                        <Badge tone="brand">{d.category}</Badge>{" "}
                        <span className="text-steel-muted">{d.title}</span>
                      </span>
                    </span>
                    <a href={hrFileContentUrl(d.id, token)} target="_blank" rel="noreferrer" className="text-brand underline shrink-0">
                      Open
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[11px] text-steel-muted mt-3">Uploads are filed under the requisition for this person, and into their employee file once they are onboarded. The count matches Recruitment.</p>
          )}
        </Card>
      ) : null}

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <h3 className="font-semibold text-sm mb-3">{formatUiText("Progress")}</h3>
          <div className="space-y-3">
            <ProgressBar label={`Pre-joining · ${preDone}/${preTotal}`} value={preDone / preTotal} />
            <ProgressBar label={`Onboarding · ${onboardDone}/${onboardTotal}`} value={onboardDone / onboardTotal} tone="ok" />
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <h3 className="font-semibold text-sm mb-3">2 · Pre-Joining Process</h3>
          {!form && (
            <div className="space-y-2">
              <p className="text-sm text-steel-muted">Loading pre-joining checklist…</p>
              <Button type="button" variant="secondary" onClick={() => void load()}>
                Retry
              </Button>
            </div>
          )}
          {form && (
            <ul className="space-y-2 text-sm">
              {preJoinItems.map((item) => {
                const editable = canEditPreJoinItem(item);
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
                if (item.statusPick) {
                  const done = !!form[item.key];
                  return (
                    <li key={item.key} className="flex items-center gap-3 border-t border-line pt-2">
                      <span className="flex-1">{item.label}</span>
                      <select
                        value={done ? "Done" : "Pending"}
                        onChange={(e) => setForm({ ...form, [item.key]: e.target.value === "Done" })}
                        disabled={!editable}
                        className="border border-line rounded px-2 py-1 text-xs"
                      >
                        <option>Pending</option>
                        <option>Done</option>
                      </select>
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
                      disabled={!editable}
                    />
                    <span className="flex-1">{item.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <h3 className="font-semibold text-sm mb-3">{formatUiText("3 · Employee Onboarding")}</h3>
        {form && (preJoinComplete || canHrWrite) ? (
          <div className="grid md:grid-cols-2 gap-3 mb-4">
            <Input
              label="Bank Detail"
              value={form.bankDetail || ""}
              onChange={(e) => setForm({ ...form, bankDetail: e.target.value })}
              disabled={!canHrWrite}
            />
            <Input
              label="PF ESIC"
              value={form.pfEsic || ""}
              onChange={(e) => setForm({ ...form, pfEsic: e.target.value })}
              disabled={!canHrWrite}
            />
            <TextArea
              label="Nominee Details"
              rows={3}
              value={form.nomineeDetails || ""}
              onChange={(e) => setForm({ ...form, nomineeDetails: e.target.value })}
              disabled={!canHrWrite}
            />
            <Select
              label="Working Hours"
              value={form.workingHours || ""}
              onChange={(e) => setForm({ ...form, workingHours: e.target.value })}
              disabled={!canHrWrite}
            >
              <option value="">{formatUiText("Select Working Hours")}</option>
              {hourChoices.map((row) => (
                <option key={row.id} value={row.label} data-preserve-case>{row.label}</option>
              ))}
            </Select>
          </div>
        ) : null}
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
