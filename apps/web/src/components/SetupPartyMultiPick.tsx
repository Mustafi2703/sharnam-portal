import { Link } from "react-router-dom";
import { useConsultantTypes } from "../lib/consultantTypes";
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
  directoryHref: string;
  directoryLabel: string;
};

function matchesKind(v: SetupVendor, kind: QuickKind) {
  const t = v.partyType || "";
  if (kind === "PMC") return t === "PMC";
  if (kind === "Consultant") return t === "Consultant" || t === "Designer";
  return t === "Contractor" || t === "Vendor";
}

function noun(kind: QuickKind) {
  if (kind === "PMC") return "PMC firms";
  if (kind === "Consultant") return "consultants";
  return "vendors / contractors";
}

/** Tick companies from the CRM directory. New companies are added on the directory pages, not here. */
export function SetupPartyMultiPick({
  token,
  title,
  kind,
  vendors,
  selectedIds,
  onChange,
  directoryHref,
  directoryLabel,
}: Props) {
  const { types } = useConsultantTypes(kind === "Consultant" ? token : null);
  const items = vendors.filter((v) => matchesKind(v, kind)).map((v) => ({
    id: v.id,
    label: v.name,
    sublabel: v.primaryContactName || v.trade || undefined,
    meta: v.email || undefined,
    trade: v.trade,
  }));

  return (
    <div className="space-y-2 border border-line rounded-xl p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-semibold text-sm">{title}</h4>
        <Link to={directoryHref} className="text-[11px] font-semibold text-brand">
          {directoryLabel}
        </Link>
      </div>
      {kind === "Consultant" && types.length ? (
        <p className="text-[11px] text-steel-muted">Tick from the consultant directory. Add a new firm on Consultants.</p>
      ) : null}
      <SearchableCheckboxList
        items={items}
        selectedIds={selectedIds}
        onChange={onChange}
        placeholder={`Search ${noun(kind)}…`}
        emptyMessage={`No ${noun(kind)} in the directory yet. Add them on ${directoryLabel.replace(" →", "")}.`}
        maxHeightClass="max-h-40"
      />
    </div>
  );
}
