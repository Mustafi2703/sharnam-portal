import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, TextArea } from "../components/ui";

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
  const { token } = useAuth();
  const [offers, setOffers] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const list = await api<any[]>("/api/hrm/offers", { token });
      setOffers(list.filter((o) => ["Accepted", "Joined"].includes(o.status)));
    })();
  }, [token]);

  return (
    <div className="space-y-4">
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
  const canWrite = ["admin", "office"].includes(user?.role || "");
  const [offer, setOffer] = useState<any | null>(null);
  const [preJoin, setPreJoin] = useState<any | null>(null);
  const [onboard, setOnboard] = useState<any | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [msg, setMsg] = useState("");

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
      setOnboard(await api<any>(`/api/hrm/onboarding/${offerId}`, { token }));
    } catch {
      setOnboard(null);
    }
    // Timeline: audit events tied to the candidate + offer + user (if joined)
    if (o?.candidate?.id) {
      const events = await api<any[]>(`/api/hrm/employees/${o.candidate.id}/timeline`, { token }).catch(() => []);
      setTimeline(events);
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

  const preJoinItems = useMemo(() => {
    if (!preJoin) return [];
    return [
      { key: "docCollectionDone", label: "1 · Document collection" },
      { key: "bgvStatus", label: "2 · Background verification", picker: ["Pending", "In-Progress", "Cleared", "Failed"] },
      { key: "medicalStatus", label: "3 · Medical fitness", picker: ["Pending", "In-Progress", "Cleared", "Failed", "Not-Applicable"] },
      { key: "empCodeGenerated", label: "4 · Employee code generated", text: true },
      { key: "appointmentLetterUrl", label: "5 · Appointment letter URL", text: true },
      { key: "itAssetRequested", label: "6 · IT asset requested" },
      { key: "emailCreated", label: "7 · Email ID created", text: true, boolTextKey: "emailAddress" },
      { key: "idCardRequested", label: "8 · ID card requested" },
      { key: "welcomeKitPrepared", label: "9 · Welcome kit ready" },
    ];
  }, [preJoin]);

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
          <h2 className="font-semibold text-lg">{offer ? `${offer.candidate?.fullName} · ${offer.designation}` : "Loading…"}</h2>
          {offer && (
            <p className="text-sm text-steel-muted mt-1">
              Offer {offer.offerNo} · CTC ₹{Number(offer.ctcAnnual).toLocaleString("en-IN")} · joining{" "}
              {offer.joiningDate ? new Date(offer.joiningDate).toLocaleDateString("en-IN") : "—"}
            </p>
          )}
        </div>
        <Link to="/hrm/onboarding"><Button variant="secondary">Back to list</Button></Link>
      </div>
      {msg && <p className="text-sm text-brand-dark">{msg}</p>}

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <h3 className="font-semibold text-sm mb-3">Progress</h3>
          <div className="space-y-3">
            <ProgressBar label={`Pre-joining · ${preDone}/${preTotal}`} value={preDone / preTotal} />
            <ProgressBar label={`Onboarding · ${onboardDone}/${onboardTotal}`} value={onboardDone / onboardTotal} tone="ok" />
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <h3 className="font-semibold text-sm mb-3">Pre-joining checklist</h3>
          {!preJoin && <p className="text-sm text-steel-muted">Pre-joining record initialises after the offer is Accepted.</p>}
          {preJoin && (
            <ul className="space-y-2 text-sm">
              {preJoinItems.map((item) => (
                <li key={item.key} className="flex items-center gap-3 border-t border-line pt-2">
                  {"text" in item && item.text ? (
                    <>
                      <span className="flex-1">{item.label}</span>
                      <Input
                        defaultValue={preJoin[item.key] || ""}
                        onBlur={(e) => updatePreJoin({ [item.key]: e.target.value })}
                        placeholder={item.boolTextKey ? "e.g. jane@spdc.in" : ""}
                        disabled={!canWrite}
                        className="max-w-xs"
                      />
                    </>
                  ) : "picker" in item && item.picker ? (
                    <>
                      <span className="flex-1">{item.label}</span>
                      <select
                        defaultValue={preJoin[item.key] || "Pending"}
                        onChange={(e) => updatePreJoin({ [item.key]: e.target.value })}
                        disabled={!canWrite}
                        className="border border-line rounded px-2 py-1 text-xs"
                      >
                        {item.picker.map((p) => <option key={p}>{p}</option>)}
                      </select>
                    </>
                  ) : (
                    <>
                      <input
                        type="checkbox"
                        checked={!!preJoin[item.key]}
                        onChange={(e) => updatePreJoin({ [item.key]: e.target.checked })}
                        disabled={!canWrite}
                      />
                      <span className="flex-1">{item.label}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <h3 className="font-semibold text-sm mb-3">Employee onboarding checklist</h3>
        {!onboard && <p className="text-sm text-steel-muted">Onboarding record initialises when the offer moves to Joined.</p>}
        {onboard && (
          <ul className="grid md:grid-cols-2 gap-2 text-sm">
            {onboardItems.map((item) => (
              <li key={item.key} className="flex items-start gap-2 border border-line rounded-lg px-3 py-2">
                <input
                  type="checkbox"
                  checked={!!onboard[item.key]}
                  onChange={(e) => updateOnboard({ [item.key]: e.target.checked })}
                  disabled={!canWrite}
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
        {onboard && (
          <TextArea
            rows={2}
            placeholder="Onboarding notes"
            defaultValue={onboard.notes || ""}
            onBlur={(e) => updateOnboard({ notes: e.target.value })}
            className="mt-3"
            disabled={!canWrite}
          />
        )}
      </Card>

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
