/**
 * Global bidder catalog — one or more vendors per R2 BOQ discipline sheet.
 * Trade field uses discipline labels so CRM convert filters work.
 */
import { COMPARATIVE_DISCIPLINES } from "./comparativeStatement.js";

export type BidVendorSeed = {
  name: string;
  partyType: "Contractor" | "Vendor";
  disciplines: string[];
  email: string;
  primaryContactName: string;
  city: string;
  businessPhone?: string;
};

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function tradeFromDisciplines(keys: string[]): string {
  return keys
    .map((k) => COMPARATIVE_DISCIPLINES.find((d) => d.key === k)?.label || k)
    .join(", ");
}

/** ~3 bidders per R2 discipline — derived from Comparative Statement R2 sheet names. */
export const CRM_BID_VENDOR_CATALOG: BidVendorSeed[] = [
  { name: "M/s Bhavna Infra", partyType: "Contractor", disciplines: ["CCV"], email: "bhavna@bid.sharnam.demo", primaryContactName: "Bhavna Shah", city: "Ahmedabad", businessPhone: "+91 79 2650 1100" },
  { name: "TCC Projects PVT. LTD.", partyType: "Contractor", disciplines: ["CCV", "ENTRANCE_GATE"], email: "tcc@bid.sharnam.demo", primaryContactName: "Ramesh Desai", city: "Ahmedabad" },
  { name: "Kalyani Construction Co.", partyType: "Contractor", disciplines: ["CCV"], email: "kalyani@bid.sharnam.demo", primaryContactName: "Kalyani Mehta", city: "Surat" },
  { name: "Shreeji Infra Projects", partyType: "Contractor", disciplines: ["CCV", "ADMIN"], email: "shreeji@bid.sharnam.demo", primaryContactName: "Jayesh Patel", city: "Rajkot" },
  { name: "Pearl Electricals", partyType: "Vendor", disciplines: ["ELE_LAB"], email: "pearl@bid.sharnam.demo", primaryContactName: "Meera Joshi", city: "Vadodara", businessPhone: "+91 265 240 2200" },
  { name: "VoltTech Electricals", partyType: "Vendor", disciplines: ["ELE_LAB"], email: "volttech@bid.sharnam.demo", primaryContactName: "Ravi Kumar", city: "Ahmedabad" },
  { name: "PowerLine Contractors", partyType: "Vendor", disciplines: ["ELE_LAB", "ADMIN"], email: "powerline@bid.sharnam.demo", primaryContactName: "Anil Sharma", city: "Gandhinagar" },
  { name: "BuildCraft Interiors", partyType: "Contractor", disciplines: ["ADMIN"], email: "buildcraft@bid.sharnam.demo", primaryContactName: "Priya Nair", city: "Ahmedabad" },
  { name: "AdminStructure Builders", partyType: "Contractor", disciplines: ["ADMIN"], email: "adminstruct@bid.sharnam.demo", primaryContactName: "Harsh Shah", city: "Vadodara" },
  { name: "GreenSpace Admin Works", partyType: "Contractor", disciplines: ["ADMIN", "SECURITY"], email: "greenspace@bid.sharnam.demo", primaryContactName: "Neha Desai", city: "Surat" },
  { name: "SecureGate Systems", partyType: "Vendor", disciplines: ["SECURITY", "ENTRANCE_GATE"], email: "securegate@bid.sharnam.demo", primaryContactName: "Vikram Mehta", city: "Ahmedabad" },
  { name: "GuardPro Security Solutions", partyType: "Vendor", disciplines: ["SECURITY"], email: "guardpro@bid.sharnam.demo", primaryContactName: "Sanjay Rao", city: "Vadodara" },
  { name: "CCTV Secure India", partyType: "Vendor", disciplines: ["SECURITY"], email: "cctvsecure@bid.sharnam.demo", primaryContactName: "Imran Khan", city: "Ahmedabad" },
  { name: "AquaFlow MEP", partyType: "Vendor", disciplines: ["COOLING_TOWER", "UG_TANK"], email: "aquaflow@bid.sharnam.demo", primaryContactName: "Imran Khan", city: "Surat" },
  { name: "CoolTech Towers Pvt Ltd", partyType: "Vendor", disciplines: ["COOLING_TOWER"], email: "cooltech@bid.sharnam.demo", primaryContactName: "Deepak Verma", city: "Ahmedabad" },
  { name: "HVAC Masters India", partyType: "Vendor", disciplines: ["COOLING_TOWER"], email: "hvacmasters@bid.sharnam.demo", primaryContactName: "Rohit Singh", city: "Mumbai" },
  { name: "WeighPro India", partyType: "Vendor", disciplines: ["WEIGH_BRIDGE"], email: "weighpro@bid.sharnam.demo", primaryContactName: "Sanjay Rao", city: "Vadodara" },
  { name: "ScaleTech Weighbridge", partyType: "Vendor", disciplines: ["WEIGH_BRIDGE"], email: "scaletech@bid.sharnam.demo", primaryContactName: "Kiran Patel", city: "Ahmedabad" },
  { name: "Metrology Systems India", partyType: "Vendor", disciplines: ["WEIGH_BRIDGE"], email: "metrology@bid.sharnam.demo", primaryContactName: "Arjun Mehta", city: "Rajkot" },
  { name: "TankBuild Engineers", partyType: "Vendor", disciplines: ["UG_TANK"], email: "tankbuild@bid.sharnam.demo", primaryContactName: "Suresh Iyer", city: "Surat" },
  { name: "PumpFlow MEP Solutions", partyType: "Vendor", disciplines: ["UG_TANK", "COOLING_TOWER"], email: "pumpflow@bid.sharnam.demo", primaryContactName: "Anita Kulkarni", city: "Ahmedabad" },
  { name: "SteelForm Fabricators", partyType: "Vendor", disciplines: ["ENTRANCE_GATE", "CCV"], email: "steelform@bid.sharnam.demo", primaryContactName: "Nilesh Patel", city: "Rajkot" },
  { name: "PEB Gate Solutions", partyType: "Vendor", disciplines: ["ENTRANCE_GATE"], email: "pebgate@bid.sharnam.demo", primaryContactName: "Manish Shah", city: "Ahmedabad" },
  { name: "MetalCraft Fabricators", partyType: "Vendor", disciplines: ["ENTRANCE_GATE"], email: "metalcraft@bid.sharnam.demo", primaryContactName: "Vishal Desai", city: "Vadodara" },
];

export function bidVendorSeedRows(): (BidVendorSeed & { trade: string })[] {
  return CRM_BID_VENDOR_CATALOG.map((v) => ({
    ...v,
    email: v.email || `${slug(v.name)}@bid.sharnam.demo`,
    trade: tradeFromDisciplines(v.disciplines),
  }));
}

export async function seedBidVendorCatalog(prisma: import("@prisma/client").PrismaClient) {
  const rows = bidVendorSeedRows();
  let created = 0;
  let updated = 0;
  for (const v of rows) {
    const existing = await prisma.vendor.findFirst({ where: { name: v.name } });
    if (existing) {
      await prisma.vendor.update({
        where: { id: existing.id },
        data: {
          partyType: v.partyType,
          trade: v.trade,
          email: v.email,
          primaryContactName: v.primaryContactName,
          city: v.city,
          businessPhone: v.businessPhone,
          isPrequalified: true,
          isActive: true,
        },
      });
      updated++;
    } else {
      await prisma.vendor.create({
        data: {
          name: v.name,
          partyType: v.partyType,
          trade: v.trade,
          email: v.email,
          primaryContactName: v.primaryContactName,
          city: v.city,
          businessPhone: v.businessPhone,
          country: "India",
          isPrequalified: true,
          insuranceVerified: true,
          createdVia: "BidCatalog",
        },
      });
      created++;
    }
  }
  return { created, updated, total: rows.length };
}

export function vendorsForDisciplineKeys(keys: string[]): BidVendorSeed[] {
  if (!keys.length) return CRM_BID_VENDOR_CATALOG;
  return CRM_BID_VENDOR_CATALOG.filter((v) => v.disciplines.some((d) => keys.includes(d)));
}
