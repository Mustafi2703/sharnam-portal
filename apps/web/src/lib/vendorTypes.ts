/** Vendor and contractor are the same party on SPDC jobs. */
export const VENDOR_CONTRACTOR_TYPES = ["Contractor", "Vendor"] as const;

export function isVendorOrContractor(partyType?: string | null) {
  return !partyType || partyType === "Contractor" || partyType === "Vendor";
}

export function formatPartyType(partyType?: string | null) {
  if (isVendorOrContractor(partyType)) return "Vendor / contractor";
  if (partyType === "PMC") return "PMC / partner firm";
  if (partyType === "Designer") return "Designer / architect";
  return partyType || "Vendor / contractor";
}

/** CRM desks must not share company rows or form state. */
export type VendorDesk = "client" | "consultant" | "vendor";

export function vendorDesk(partyType?: string | null): VendorDesk {
  if (partyType === "Client") return "client";
  if (partyType === "Consultant" || partyType === "PMC" || partyType === "Designer") return "consultant";
  return "vendor";
}

export function vendorDeskLabel(desk: VendorDesk | string | null | undefined) {
  if (desk === "client" || desk === "Client") return "Clients";
  if (desk === "consultant" || desk === "Consultant" || desk === "PMC" || desk === "Designer") return "Consultants";
  return "Vendors / contractors";
}

/** Stored type for a new vendor/contractor row. */
export function normalizeVendorPartyType(partyType?: string | null) {
  if (partyType === "Vendor") return "Contractor";
  return partyType || "Contractor";
}

/** Procore-style vendor / party types — company directory (global). */
export const VENDOR_PARTY_TYPES = [
  { value: "Contractor", label: "Vendor / contractor" },
  { value: "Client", label: "Client" },
  { value: "Consultant", label: "Consultant" },
  { value: "PMC", label: "PMC / partner firm" },
  { value: "Designer", label: "Designer / architect" },
] as const;

/** Consultant & stakeholder trade roles (CRM → Stakeholders tab + project directory). */
export const STAKEHOLDER_CONSULTANT_TRADES = [
  "Structural Consultant",
  "MEP Consultant",
  "Architectural Consultant",
  "Landscape Consultant",
  "Geotechnical Consultant",
  "PMC Partner",
  "Third-Party Reviewer",
  "Project Consultant",
  "Fire & Safety Consultant",
  "Facade Consultant",
] as const;

export type StakeholderConsultantTrade = (typeof STAKEHOLDER_CONSULTANT_TRADES)[number];

export type VendorPartyType = (typeof VENDOR_PARTY_TYPES)[number]["value"];

export type VendorFormState = {
  name: string;
  partyType: VendorPartyType;
  trade: string;
  primaryContactName: string;
  businessPhone: string;
  email: string;
  website: string;
  address: string;
  city: string;
  state: string;
  country: string;
  gstNumber: string;
  licenseNumber: string;
  isPrequalified: boolean;
  insuranceVerified: boolean;
  isUnionMember: boolean;
  isMinorityOwned: boolean;
  isWomenOwned: boolean;
  notes: string;
};

export const EMPTY_VENDOR_FORM: VendorFormState = {
  name: "",
  partyType: "Contractor",
  trade: "",
  primaryContactName: "",
  businessPhone: "",
  email: "",
  website: "",
  address: "",
  city: "",
  state: "",
  country: "India",
  gstNumber: "",
  licenseNumber: "",
  isPrequalified: false,
  insuranceVerified: false,
  isUnionMember: false,
  isMinorityOwned: false,
  isWomenOwned: false,
  notes: "",
};

export function vendorToForm(v: Partial<VendorFormState> & { name?: string; partyType?: string }): VendorFormState {
  const raw = String(v.partyType || "") === "Vendor" ? "Contractor" : v.partyType;
  const partyType = VENDOR_PARTY_TYPES.some((p) => p.value === raw)
    ? (raw as VendorPartyType)
    : "Contractor";
  return {
    ...EMPTY_VENDOR_FORM,
    ...v,
    partyType,
    name: v.name || "",
  };
}
