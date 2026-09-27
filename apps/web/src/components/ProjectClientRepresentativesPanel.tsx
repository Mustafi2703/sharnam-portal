import { Link } from "react-router-dom";
import { Badge, Card } from "./ui";

export type ProjectClientRep = {
  id: string;
  vendorId: string;
  vendorName: string;
  fullName: string | null;
  email: string;
  siteRole: string | null;
  portalActive: boolean;
  loginPath: string;
};

type Props = {
  reps: ProjectClientRep[];
  canEdit?: boolean;
  compact?: boolean;
  directoryClientId?: string | null;
  onRefresh?: () => void;
};

/** Client representatives for companies linked to this project (CRM Step 2 contacts). */
export function ProjectClientRepresentativesPanel({
  reps,
  canEdit,
  compact,
  directoryClientId,
}: Props) {
  const body = (
    <>
      {!compact ? (
        <p className="text-xs text-steel-muted">
          Site / client contacts from CRM → Clients → Step 2. Each person signs in at{" "}
          <code className="text-[11px]">/login/client</code> after <strong className="text-ink">Activate portal</strong>.
        </p>
      ) : null}
      {reps.length > 0 ? (
        <ul className="space-y-2">
          {reps.map((r) => (
            <li key={r.id} className="rounded-xl border border-line bg-paper p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-sm" data-preserve-case>
                    {r.fullName || "Client representative"}
                  </div>
                  <div className="text-xs text-steel-muted">
                    <span data-preserve-case>{r.email}</span>
                    {r.siteRole ? (
                      <>
                        {" · "}
                        <span data-preserve-case>{r.siteRole}</span>
                      </>
                    ) : null}
                  </div>
                  <div className="text-[11px] text-steel-muted mt-0.5" data-preserve-case>
                    {r.vendorName}
                  </div>
                </div>
                <Badge tone={r.portalActive ? "ok" : "warn"}>{r.portalActive ? "Portal active" : "Activate in CRM"}</Badge>
              </div>
              {!r.portalActive && canEdit ? (
                <p className="text-[11px] text-steel-muted mt-2">
                  Open CRM → Clients → Step 2 for this company and click Activate portal for this email.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-steel-muted border border-dashed border-line rounded-xl p-4 text-center">
          No client representatives yet — add people under{" "}
          {canEdit ? (
            <Link to="/crm/directory/clients" className="text-brand font-semibold">
              CRM → Clients → Step 2
            </Link>
          ) : (
            "CRM → Clients → Step 2"
          )}
          {directoryClientId ? (
            <>
              {" "}
              for the linked client company, then save this project card to refresh.
            </>
          ) : (
            ". Link a client company on this card first."
          )}
        </p>
      )}
      {canEdit && directoryClientId ? (
        <Link
          to={`/crm/directory/clients?vendorId=${directoryClientId}`}
          className="inline-block text-xs font-semibold text-brand"
        >
          Manage client representatives in CRM →
        </Link>
      ) : null}
    </>
  );

  if (compact) return <div className="space-y-2">{body}</div>;

  return (
    <Card className="!p-4 space-y-3">
      <h3 className="font-semibold text-sm">Client representatives</h3>
      {body}
    </Card>
  );
}
