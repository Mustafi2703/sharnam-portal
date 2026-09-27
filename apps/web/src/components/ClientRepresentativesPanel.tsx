import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Badge, Button, Input } from "./ui";
import { formatUiText } from "../lib/formatUiText";

type ContactRow = {
  id: string;
  email: string;
  fullName?: string | null;
  role?: string | null;
  portalActive?: boolean;
};

export type CompanyRepDesk = "client" | "vendor" | "consultant";

const DEFAULT_PASSWORD = "Demo@1234";

const DESK: Record<
  CompanyRepDesk,
  {
    stepTitle: string;
    blurb: string;
    loginPath: string;
    loginLabel: string;
    removeConfirm: string;
    addedMsg: string;
  }
> = {
  client: {
    stepTitle: "Step 2 · Client representatives",
    blurb: "who needs the client portal (/login/client). Separate from vendor and consultant logins.",
    loginPath: "/login/client",
    loginLabel: "client",
    removeConfirm: "Remove this person from the client list?",
    addedMsg: "Person added — Activate portal for /login/client.",
  },
  vendor: {
    stepTitle: "Step 2 · Vendor / contractor users",
    blurb: "who need the contractor portal (/login/vendor) for bids and project desk. Not client logins.",
    loginPath: "/login/vendor",
    loginLabel: "vendor",
    removeConfirm: "Remove this person from the vendor user list?",
    addedMsg: "Person added — Activate portal for /login/vendor.",
  },
  consultant: {
    stepTitle: "Step 2 · Consultant users",
    blurb: "who need the stakeholder portal (/login/stakeholder). Not SPDC staff — add those in HRMS → Users.",
    loginPath: "/login/stakeholder",
    loginLabel: "consultant",
    removeConfirm: "Remove this person from the consultant list?",
    addedMsg: "Person added — Activate portal for /login/stakeholder.",
  },
};

/**
 * Step 2 on CRM directory — add people + activate the correct portal per company type.
 */
export function CompanyRepresentativesPanel({
  desk,
  vendorId,
  companyName,
  token,
  canEdit,
}: {
  desk: CompanyRepDesk;
  vendorId: string;
  companyName: string;
  token: string | null;
  canEdit: boolean;
}) {
  const meta = DESK[desk];
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [form, setForm] = useState({ fullName: "", email: "", role: "" });
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"ok" | "err">("ok");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [portalPassword, setPortalPassword] = useState(DEFAULT_PASSWORD);

  const load = useCallback(async () => {
    const list = await api<ContactRow[]>(`/api/vendors/${vendorId}/contacts`, { token });
    setRows(list);
  }, [vendorId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addPerson(e: FormEvent) {
    e.preventDefault();
    if (!canEdit || submitBusy) return;
    setMsg("");
    setMsgTone("ok");
    setSubmitBusy(true);
    try {
      await api(`/api/vendors/${vendorId}/contacts`, {
        method: "POST",
        token,
        body: JSON.stringify(form),
      });
      setForm({ fullName: "", email: "", role: "" });
      setMsgTone("ok");
      setMsg(meta.addedMsg);
      await load();
    } catch (err) {
      setMsgTone("err");
      setMsg(err instanceof Error ? err.message : "Could not add person");
    } finally {
      setSubmitBusy(false);
    }
  }

  async function activatePortal(contact: ContactRow) {
    if (!canEdit) return;
    setActivatingId(contact.id);
    setMsg("");
    setMsgTone("ok");
    try {
      const r = await api<{
        login?: { created?: boolean; tempPassword?: string; email?: string };
        loginPath?: string;
      }>(`/api/vendors/${vendorId}/contacts/${contact.id}/activate-portal`, {
        method: "POST",
        token,
        body: JSON.stringify({ password: portalPassword.trim() || DEFAULT_PASSWORD }),
      });
      const path = r.loginPath || meta.loginPath;
      const pwd = r.login?.tempPassword || portalPassword || DEFAULT_PASSWORD;
      setMsg(
        `${meta.loginLabel} portal ready for ${contact.fullName || contact.email} — ${path} · ${r.login?.email || contact.email} · Password: ${pwd}`,
      );
      await load();
    } catch (err) {
      setMsgTone("err");
      setMsg(err instanceof Error ? err.message : "Could not activate portal");
    } finally {
      setActivatingId(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm(meta.removeConfirm)) return;
    await api(`/api/vendors/${vendorId}/contacts/${id}`, { method: "DELETE", token });
    await load();
  }

  const stepHint = useMemo(
    () => (
      <ol className="text-xs text-steel-muted list-decimal list-inside space-y-1">
        <li>Add name + email (+ role optional)</li>
        <li>
          Click <strong className="text-ink">Activate portal</strong> for that person
        </li>
        <li>
          Share <code className="text-[11px]">{meta.loginPath}</code> and the password below
        </li>
      </ol>
    ),
    [meta.loginPath],
  );

  return (
    <div className="mt-5 pt-5 border-t-2 border-brand/20 space-y-4">
      <div className="rounded-xl bg-brand-soft/30 border border-brand/15 p-4 space-y-2">
        <p className="text-xs font-mono uppercase tracking-wide text-brand font-semibold">{formatUiText(meta.stepTitle)}</p>
        <p className="text-sm text-ink leading-relaxed">
          {formatUiText("Add everyone from")} <strong data-preserve-case>{companyName}</strong> {formatUiText(meta.blurb)}
        </p>
        {stepHint}
      </div>

      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl border border-line bg-paper p-3 space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-sm" data-preserve-case>
                  {r.fullName || formatUiText("Unnamed contact")}
                </div>
                <div className="text-xs text-steel-muted">
                  <span data-preserve-case>{r.email}</span>
                  {r.role ? (
                    <>
                      {" · "}
                      <span data-preserve-case>{r.role}</span>
                    </>
                  ) : null}
                </div>
              </div>
              <Badge tone={r.portalActive ? "ok" : "neutral"}>{r.portalActive ? "Portal active" : "No portal yet"}</Badge>
            </div>
            {canEdit ? (
              <div className="flex flex-wrap gap-2">
                {!r.portalActive ? (
                  <Button
                    type="button"
                    className="!text-xs"
                    disabled={activatingId === r.id}
                    onClick={() => void activatePortal(r)}
                  >
                    {activatingId === r.id ? "Activating…" : "Activate portal"}
                  </Button>
                ) : (
                  <Button type="button" variant="secondary" className="!text-xs" onClick={() => void activatePortal(r)}>
                    Reset password
                  </Button>
                )}
                <Button type="button" variant="ghost" className="!text-xs text-danger" onClick={() => void remove(r.id)}>
                  Remove
                </Button>
              </div>
            ) : null}
          </li>
        ))}
        {!rows.length ? (
          <li className="text-sm text-steel-muted border border-dashed border-line rounded-xl p-4 text-center">
            No people yet — use the form below to add the first person.
          </li>
        ) : null}
      </ul>

      {canEdit ? (
        <form className="rounded-xl border border-line bg-sand/40 p-4 space-y-3" onSubmit={addPerson}>
          <p className="text-sm font-semibold">Add another person</p>
          <div className="grid sm:grid-cols-2 gap-2">
            <Input required placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            <Input required type="email" placeholder="Email (their login)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input className="sm:col-span-2" placeholder="Role (e.g. Estimator, Director)" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs space-y-1 flex-1 min-w-[200px]">
              <span className="text-steel-muted">Portal password for new activations</span>
              <Input type="password" value={portalPassword} onChange={(e) => setPortalPassword(e.target.value)} autoComplete="new-password" />
            </label>
            <Button type="submit" variant="secondary" disabled={submitBusy}>
              {submitBusy ? "Adding…" : "+ Add person"}
            </Button>
          </div>
        </form>
      ) : null}

      {msg ? (
        <p
          className={`text-xs font-medium leading-relaxed ${msgTone === "err" ? "text-danger" : "text-brand"}`}
          role={msgTone === "err" ? "alert" : undefined}
        >
          {msg}
        </p>
      ) : null}
    </div>
  );
}

/** @deprecated Use CompanyRepresentativesPanel with desk="client" */
export function ClientRepresentativesPanel(props: Omit<Parameters<typeof CompanyRepresentativesPanel>[0], "desk">) {
  return <CompanyRepresentativesPanel {...props} desk="client" />;
}
