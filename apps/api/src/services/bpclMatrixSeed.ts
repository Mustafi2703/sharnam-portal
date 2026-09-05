import { prisma } from "../prisma.js";

/** BPCL Communication Matrix_BPCL (2).xlsx — TECHNICAL contact sheet columns. */
export const BPCL_MATRIX_HEADER = {
  subject: "TECHNICAL COMMUNICATION MATRIX",
  matrixDate: "05-11-2025",
} as const;

type BpclRow =
  | { kind: "section"; letter: string; orgName: string; orgSection: string; officeAddress?: string }
  | {
      kind: "person";
      srNo: string;
      orgSection: string;
      orgName: string;
      personName: string;
      designation: string;
      company: string;
      spoc?: string;
      mobile?: string;
      email?: string;
      mailRole: "TO" | "CC";
      officeAddress?: string;
    };

/** Exact rows from Communication Matrix_BPCL (2).xlsx */
export const BPCL_TECHNICAL_ROWS: BpclRow[] = [
  {
    kind: "section",
    letter: "A",
    orgSection: "Client",
    orgName: "BURCKHARDT COMPRESSION",
  },
  {
    kind: "person",
    srNo: "1",
    orgSection: "Client",
    orgName: "BURCKHARDT COMPRESSION",
    personName: "Mr. Milan Shah",
    designation: "Head – Procurement",
    company: "Burckhardt Compression",
    spoc: "Mr. Milan Shah",
    mobile: "8511197622",
    email: "Milan.shah@burckhardtcompression.com",
    mailRole: "CC",
    officeAddress:
      "Revenue Survey No.160/1,Nr. Plot No.1112, GIDC - Ranoli, Dist. Vadodara, 391 350, Gujarat. India.",
  },
  {
    kind: "section",
    letter: "B",
    orgSection: "PMC",
    orgName: "SHARNAM PROJECT DEVELOPMENT CONSULTANTS & CO. (SPDC)",
  },
  {
    kind: "person",
    srNo: "1",
    orgSection: "PMC",
    orgName: "SHARNAM PROJECT DEVELOPMENT CONSULTANTS & CO. (SPDC)",
    personName: "Mr. Nirav Parekh",
    designation: "Director",
    company: "Sharnam Projec Development Consultants & Co.",
    spoc: "Mr. Saurabh Prajapati (HO Discussion)\n\nMr.Jaideep Kumar Parmar (Site Discsussion )",
    mobile: "8160757201",
    email: "nirav@spdc.in",
    mailRole: "CC",
    officeAddress: "F-09, Status Plaza, First Floor, Plot No. 18, Near Akshar Chowk, Munjmahuda, Vadodara – 390007, Gujarat, India.",
  },
  {
    kind: "person",
    srNo: "2",
    orgSection: "PMC",
    orgName: "SHARNAM PROJECT DEVELOPMENT CONSULTANTS & CO. (SPDC)",
    personName: "Mr. Saurabh Prajapati",
    designation: "Project Co-ordinator",
    company: "Sharnam Project Development Consultants & Co.",
    mobile: "9106945294",
    email: "operations@spdc.in",
    mailRole: "TO",
  },
  {
    kind: "person",
    srNo: "3",
    orgSection: "PMC",
    orgName: "SHARNAM PROJECT DEVELOPMENT CONSULTANTS & CO. (SPDC)",
    personName: "Mr. Jaideep Kumar Parmar",
    designation: "Project Manager",
    company: "Sharnam Project Development Consultants & Co.",
    mobile: "9925746676",
    email: "execution.site01@spdc.in",
    mailRole: "CC",
  },
  {
    kind: "section",
    letter: "C",
    orgSection: "Consultant",
    orgName: "SHAH AND TALATI (S&T)",
  },
  {
    kind: "person",
    srNo: "1",
    orgSection: "Consultant",
    orgName: "SHAH AND TALATI (S&T)",
    personName: "Maitrey Talati",
    designation: "Director",
    company: "Shah & Talati",
    spoc: "Devanshu Panchal",
    mobile: "9924409599",
    email: "mgtalati@shahntalati.com",
    mailRole: "CC",
    officeAddress: "9th Floor, Kirti Towers, Tilak Road, Sayajigunj, Vadodara, Gujarat 390001, India",
  },
  {
    kind: "person",
    srNo: "2",
    orgSection: "Consultant",
    orgName: "SHAH AND TALATI (S&T)",
    personName: "Ruchita Shetty",
    designation: "Project Manager",
    company: "Shah & Talati",
    mobile: "9687931201",
    email: "ruchitashetty@shahntalati.com",
    mailRole: "CC",
  },
  {
    kind: "person",
    srNo: "3",
    orgSection: "Consultant",
    orgName: "SHAH AND TALATI (S&T)",
    personName: "Devanshu Panchal",
    designation: "Project Manager",
    company: "Shah & Talati",
    mobile: "8511029404",
    email: "devanshu.panchal@shahntalati.com",
    mailRole: "TO",
  },
  {
    kind: "section",
    letter: "D",
    orgSection: "Contractor",
    orgName: "TCC",
  },
  {
    kind: "person",
    srNo: "1",
    orgSection: "Contractor",
    orgName: "TCC",
    personName: "Mr. Pradip .V. Pancholi",
    designation: "Director",
    company: "TCC",
    spoc: "Mr. Dhruv Darji (HO Discussion)\n\nMr. Prakash Gadhvi (Site Discsussion )",
    mobile: "9136163363",
    email: "bdteam.tcc@gmail.com",
    mailRole: "CC",
    officeAddress: "AMITA, FP 153, TP 18, B/H Simandhar Sharnam, Chanakyapuri, Ghatlodiya, Ahmedabad 380061",
  },
  {
    kind: "person",
    srNo: "2",
    orgSection: "Contractor",
    orgName: "TCC",
    personName: "Mr. Dhruv Darji",
    designation: "Project Co-ordinator",
    company: "TCC",
    mobile: "7045764546",
    email: "indprojects.tcc@gmail.com",
    mailRole: "TO",
  },
  {
    kind: "person",
    srNo: "3",
    orgSection: "Contractor",
    orgName: "TCC",
    personName: "Mr. Prakash Gadhvi",
    designation: "Project Manager",
    company: "TCC",
    mobile: "9099051782",
    email: "tcc.bcpl@gmail.com",
    mailRole: "TO",
  },
  {
    kind: "person",
    srNo: "4",
    orgSection: "Contractor",
    orgName: "TCC",
    personName: "Mr. Piyus Tyagi",
    designation: "Billing Engineer",
    company: "TCC",
    mobile: "9376536173",
    email: "tcc.bcpl@gmail.com",
    mailRole: "CC",
  },
  {
    kind: "person",
    srNo: "5",
    orgSection: "Contractor",
    orgName: "TCC",
    personName: "Mr. Renison Rebello",
    designation: "HR & Safety Compliance",
    company: "TCC",
    mobile: "9166577153",
    email: "teamhr.tcc@gmail.com",
    mailRole: "CC",
  },
];

/** Seed BPCL TECHNICAL matrix (replaces existing TECHNICAL contacts when force=true). */
export async function seedBpclTechnicalMatrix(projectId: string, opts?: { force?: boolean }): Promise<number> {
  const kind = "TECHNICAL";
  const existing = await prisma.communicationContact.count({ where: { projectId, matrixKind: kind } });
  if (existing > 0 && !opts?.force) return 0;

  if (opts?.force || existing > 0) {
    await prisma.communicationContact.deleteMany({ where: { projectId, matrixKind: kind } });
  }

  let order = 0;
  for (const row of BPCL_TECHNICAL_ROWS) {
    order += 1;
    if (row.kind === "section") {
      await prisma.communicationContact.create({
        data: {
          projectId,
          matrixKind: kind,
          orgSection: row.orgSection,
          orgName: row.orgName,
          isSectionHeader: true,
          sortOrder: order,
          officeAddress: row.officeAddress,
        },
      });
      continue;
    }
    await prisma.communicationContact.create({
      data: {
        projectId,
        matrixKind: kind,
        orgSection: row.orgSection,
        orgName: row.orgName,
        isSectionHeader: false,
        sortOrder: order,
        personName: row.personName,
        designation: row.designation,
        company: row.company,
        spoc: row.spoc,
        mobile: row.mobile,
        email: row.email,
        mailRole: row.mailRole,
        officeAddress: row.officeAddress,
      },
    });
  }
  return BPCL_TECHNICAL_ROWS.length;
}
