/** Procore-style vendor / party types — company directory (global). */
export const VENDOR_PARTY_TYPES = [
  { value: "Contractor", label: "Contractor" },
  { value: "Vendor", label: "Vendor / supplier" },
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
  partyType: "Vendor",
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
  const partyType = VENDOR_PARTY_TYPES.some((p) => p.value === v.partyType)
    ? (v.partyType as VendorPartyType)
    : "Vendor";
  return {
    ...EMPTY_VENDOR_FORM,
    ...v,
    partyType,
    name: v.name || "",
  };
}
