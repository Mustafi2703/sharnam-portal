import { Link } from "react-router-dom";
import { SearchableCheckboxList } from "./SearchableCheckboxList";

export type SetupVendor = {
  id: string;
  name: string;
  partyType?: string;
  trade?: string | null;
  email?: string | null;
  primaryContactName?: string | null;
};

type QuickKind = "Consultant" | "Contractor" | "PMC";

type Props = {
  token: string | null;
  title: string;
  kind: QuickKind;
  vendors: SetupVendor[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onCreated?: (vendor: SetupVendor) => void;
  onMsg?: (text: string) => void;
  busy?: boolean;
  directoryHref?: string;
  directoryLabel?: string;
};

/** Which setup picker a company belongs to. Consultants whose trade is project management are listed under PMC. */
export function setupPartyKind(v: Pick<SetupVendor, "partyType" | "trade">): QuickKind | null {
  const t = v.partyType || "";
  if (t === "PMC") return "PMC";
  if (t === "Consultant" || t === "Designer") {
    return /project management/i.test(v.trade || "") ? "PMC" : "Consultant";
  }
  if (t === "Contractor" || t === "Vendor") return "Contractor";
  return null;
}

function matchesKind(v: SetupVendor, kind: QuickKind) {
  return setupPartyKind(v) === kind;
}

function noun(kind: QuickKind) {
  if (kind === "PMC") return "PMC firms";
  if (kind === "Consultant") return "consultants";
  return "vendors / contractors";
}

/** Tick companies from the CRM directory. New companies are added on the directory pages, not here. */
export function SetupPartyMultiPick({
  title,
  kind,
  vendors,
  selectedIds,
  onChange,
  directoryHref,
  directoryLabel,
}: Props) {
  const items = vendors.filter((v) => matchesKind(v, kind)).map((v) => ({
    id: v.id,
    label: v.name,
    sublabel: v.primaryContactName || v.trade || undefined,
    meta: v.email || undefined,
    trade: v.trade,
  }));
  const directoryLink = directoryHref && directoryLabel ? directoryLabel : "";

  return (
    <div className="space-y-2 border border-line rounded-xl p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-semibold text-sm">{title}</h4>
        {directoryHref && directoryLabel ? (
          <Link to={directoryHref} className="text-[11px] font-semibold text-brand">
            {directoryLabel}
          </Link>
        ) : null}
      </div>
      <SearchableCheckboxList
        items={items}
        selectedIds={selectedIds}
        onChange={onChange}
        placeholder={`Search ${noun(kind)}…`}
        emptyMessage={
          directoryLink
            ? `No ${noun(kind)} in the directory yet. Add them on ${directoryLink.replace(" →", "")}.`
            : `No ${noun(kind)} in the directory yet.`
        }
        maxHeightClass="max-h-40"
      />
    </div>
  );
}
