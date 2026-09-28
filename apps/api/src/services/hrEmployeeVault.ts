/**
 * HR employee files — `_HR/06_Records_Employee_Files/{EmpID}_{Name}/`
 * Subfolders follow SPDC_HRMS: Joining, KYC, Service letters, Discipline, Exit.
 */
import fs from "fs";
import path from "path";
import { prisma } from "../prisma.js";
import { mockOneDrive } from "./mockOneDrive.js";
import { ensureSandboxLibraryFolders } from "./graph.js";
import {
  EMPLOYEE_FILE_SUBFOLDERS,
  employeeRecordRoot,
  hrFyRecordFolders,
  HR_DRIVE,
  HR_LIBRARY_FOLDERS,
  letterRecordSubfolder,
} from "./spdcLibraryFolders.js";

export const HRMS_EMPLOYEE_FILES_ROOT = "06_Records_Employee_Files";
/** Company-wide SharePoint directory — Sharnam Portal/SPDC_HRMS, not a project. */
export const HR_VAULT_DRIVE_CODE = HR_DRIVE;
/** Virtual path prefix used inside project DMS browse. */
export const HR_VAULT_VIRTUAL_PREFIX = "@SPDC_HRMS";
const HR_VAULT_LEGACY_PREFIX = "@_HR";
export const HR_VAULT_TREE_ROOT = "06_Records_Employee_Files";
export const HR_VAULT_LABEL = "SPDC HRMS";

const HR_COMPANY_FOLDERS = HR_LIBRARY_FOLDERS;

const VAULT_SUBFOLDERS = EMPLOYEE_FILE_SUBFOLDERS;

export function isHrVaultPath(folderPath: string) {
  return (
    folderPath === HR_VAULT_VIRTUAL_PREFIX ||
    folderPath.startsWith(`${HR_VAULT_VIRTUAL_PREFIX}/`) ||
    folderPath === HR_VAULT_LEGACY_PREFIX ||
    folderPath.startsWith(`${HR_VAULT_LEGACY_PREFIX}/`)
  );
}

export function hrRelFromVirtualPath(folderPath: string) {
  for (const prefix of [HR_VAULT_VIRTUAL_PREFIX, HR_VAULT_LEGACY_PREFIX]) {
    if (folderPath === prefix) return "";
    if (folderPath.startsWith(`${prefix}/`)) return folderPath.slice(prefix.length + 1);
  }
  return "";
}

export function toHrVirtualPath(_hrRel: string, childPath: string) {
  return `${HR_VAULT_VIRTUAL_PREFIX}/${childPath}`;
}

export function userCanBrowseHrVault(role: string) {
  return role === "admin" || role === "office" || role === "hr";
}

export type VaultSubfolder = (typeof VAULT_SUBFOLDERS)[number];

export function employeeVaultFolderName(
  profile: { empCode?: string | null } | null | undefined,
  fullName: string,
) {
  const root = employeeRecordRoot(profile?.empCode, fullName);
  return root.slice(HRMS_EMPLOYEE_FILES_ROOT.length + 1);
}

export function employeeVaultRelPath(
  profile: { empCode?: string | null } | null | undefined,
  fullName: string,
) {
  return employeeRecordRoot(profile?.empCode, fullName);
}

/** Map upload category → SPDC_HRMS subfolder under the employee file. */
export function vaultSubfolderForCategory(category: string): (typeof VAULT_SUBFOLDERS)[number] {
  const c = String(category || "").toLowerCase();
  if (/passport|photo|pan|aadhaar|education|experience|salary|address|bank|pf|esic|kyc|medical|bgv|id-card|id card/.test(c)) return "02_KYC_and_Statutory";
  if (/warning|concern|discipline/.test(c)) return "04_Discipline";
  if (/reliev|exit|separation/.test(c)) return "05_Exit";
  if (/offer|appointment|joining|nda/.test(c)) return "01_Joining";
  if (/letter|promotion|confirmation/.test(c)) return "03_Service_Letters";
  return letterRecordSubfolder(category) === "03_Service_Letters" && !/letter/.test(c)
    ? "02_KYC_and_Statutory"
    : letterRecordSubfolder(category);
}

/** Canonical file name — e.g. PAN_SPDC-001_scan_2026-09-15.pdf under Documents/. */
export function vaultFileNameForUpload(opts: {
  category: string;
  profile?: { empCode?: string | null } | null;
  fullName: string;
  originalName?: string | null;
}) {
  const cat =
    String(opts.category || "Document")
      .trim()
      .replace(/[^a-zA-Z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "Document";
  const code =
    opts.profile?.empCode?.trim().replace(/[^a-zA-Z0-9._-]+/g, "") ||
    opts.fullName
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .slice(0, 20) ||
    "STAFF";
  const orig = opts.originalName || "file";
  const ext = path.extname(orig) || "";
  const base = path.basename(orig, ext).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 32) || "file";
  const stamp = new Date().toISOString().slice(0, 10);
  return `${cat}_${code}_${base}_${stamp}${ext}`.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function uploadRoot() {
  return path.join(mockOneDrive.root(), "onedrive", HR_VAULT_DRIVE_CODE);
}

function ensureLocalFolder(relPath: string) {
  const abs = path.join(uploadRoot(), relPath);
  fs.mkdirSync(abs, { recursive: true });
  return abs;
}

/** One in-flight SharePoint folder walk. Parallel HR clicks must not each recreate the tree. */
let hrTreeTask: Promise<void> | null = null;

/** Ensure the company HR tree exists on the global `_HR` drive (not inside project folders). */
export async function ensureHrCompanyTree() {
  const folders = [...HR_COMPANY_FOLDERS, ...hrFyRecordFolders()];
  for (const rel of folders) {
    ensureLocalFolder(rel);
  }
  if (!hrTreeTask) {
    hrTreeTask = ensureSandboxLibraryFolders(HR_VAULT_DRIVE_CODE, folders)
      .then(() => undefined)
      .catch((err) => {
        hrTreeTask = null;
        console.warn("[HRMS] SharePoint folder tree:", err instanceof Error ? err.message : err);
      });
  }
  await hrTreeTask;
  void fileHrmsMasterFormats();
  return { driveCode: HR_VAULT_DRIVE_CODE, folders };
}

const HR_LETTER_MASTERS: Array<[string, string]> = [
  ["00_SPDC_HR_Letters_Usage_Guide.docx", "00_SPDC_HR_Letters_Usage_Guide.docx"],
  ["Offer.docx", "01_SPDC_Offer_Letter.docx"],
  ["Appointment.docx", "02_SPDC_Appointment_Letter.docx"],
  ["Confirmation.docx", "03_SPDC_Confirmation_Letter.docx"],
  ["AssetReturn.docx", "04_SPDC_Asset_Submission_Letter.docx"],
  ["Relieving.docx", "05_SPDC_Relieving_Letter.docx"],
  ["Exit.docx", "06_SPDC_Exit_Letter.docx"],
  ["Promotion.docx", "07_SPDC_Letter_of_Promotion.docx"],
  ["Warning.docx", "08_SPDC_Warning_Concern_Letter.docx"],
  ["Experience.docx", "09_SPDC_Experience_Certificate.docx"],
  ["NdaJoining.docx", "10_SPDC_NDA_At_Joining.docx"],
  ["NdaPostEmployment.docx", "11_SPDC_NDA_Post_Employment.docx"],
];

function hrmsFormatsDir(): string | null {
  const candidates = [
    path.join(process.cwd(), "apps/api/formats/hrms"),
    path.join(process.cwd(), "formats/hrms"),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

/** Copy the official letter and scorecard masters into SPDC_HRMS so HR can compare them on SharePoint. Once per process. */
let mastersTask: Promise<void> | null = null;
export function fileHrmsMasterFormats(): Promise<void> {
  if (!mastersTask) {
    mastersTask = uploadHrmsMasterFormats().catch((err) => {
      mastersTask = null;
      console.warn("[HRMS] master formats:", err instanceof Error ? err.message : err);
    });
  }
  return mastersTask;
}

async function uploadHrmsMasterFormats() {
  const dir = hrmsFormatsDir();
  if (!dir) return;
  const docx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  for (const [src, name] of HR_LETTER_MASTERS) {
    const abs = path.join(dir, src);
    if (!fs.existsSync(abs)) continue;
    await mockOneDrive.upload(HR_VAULT_DRIVE_CODE, "02_Templates_Letters", name, fs.readFileSync(abs), docx, { replace: true });
  }
  const scorecard = path.join(dir, "SPDC_Interview_Assessment_Scoring_System.xlsx");
  if (fs.existsSync(scorecard)) {
    await mockOneDrive.upload(
      HR_VAULT_DRIVE_CODE,
      "03_Formats",
      "SPDC_Interview_Assessment_Scoring_System.xlsx",
      fs.readFileSync(scorecard),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      { replace: true },
    );
  }
}

function indexPayload(user: { fullName: string; email: string }, profile: { empCode?: string | null } | null) {
  return {
    employee: user.fullName,
    email: user.email,
    empCode: profile?.empCode || null,
    vaultRoot: `${HR_VAULT_DRIVE_CODE}/${HRMS_EMPLOYEE_FILES_ROOT}`,
    subfolders: VAULT_SUBFOLDERS,
    updatedAt: new Date().toISOString(),
  };
}

export async function ensureEmployeeVault(opts: {
  userId: string;
  fullName: string;
  email: string;
  profile?: { empCode?: string | null } | null;
}) {
  const vaultRel = employeeVaultRelPath(opts.profile, opts.fullName);
  for (const sub of VAULT_SUBFOLDERS) {
    ensureLocalFolder(`${vaultRel}/${sub}`);
  }
  const indexJson = JSON.stringify(indexPayload(opts, opts.profile || null), null, 2);
  await mockOneDrive.upload(
    HR_VAULT_DRIVE_CODE,
    vaultRel,
    "_vault-index.json",
    Buffer.from(indexJson, "utf8"),
    "application/json",
    { replace: true },
  );
  return { vaultRel, folderName: employeeVaultFolderName(opts.profile, opts.fullName) };
}

function resolveLocalFile(storagePath?: string | null, fileUrl?: string | null): string | null {
  if (storagePath) {
    const fromPath = path.join(uploadRoot(), storagePath.replace(/^\/+/, ""));
    if (fs.existsSync(fromPath) && fs.statSync(fromPath).isFile()) return fromPath;
  }
  const marker = `/uploads/onedrive/${HR_VAULT_DRIVE_CODE}/`;
  const legacy = "/uploads/onedrive/_HR/";
  if (fileUrl?.includes(marker) || fileUrl?.includes(legacy)) {
    const rel = fileUrl.includes(marker) ? fileUrl.split(marker)[1] : fileUrl.split(legacy)[1];
    if (rel) {
      const full = path.join(uploadRoot(), decodeURIComponent(rel));
      if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
    }
  }
  return null;
}

/** Copy DB-tracked files into the canonical vault tree when they landed in the wrong folder. */
export async function syncEmployeeVaultDocuments(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, fullName: true, email: true },
  });
  if (!user) return { synced: 0, skipped: 0 };

  const profile = await prisma.employeeProfile.findFirst({ where: { userId } });
  const vaultRel = employeeVaultRelPath(profile, user.fullName);
  const docs = await prisma.employeeDocument.findMany({ where: { userId } });
  let synced = 0;
  let skipped = 0;

  for (const doc of docs) {
    const sub = vaultSubfolderForCategory(doc.category);
    const expectedPrefix = `${vaultRel}/${sub}/`;
    if (doc.storagePath?.startsWith(expectedPrefix)) {
      skipped++;
      continue;
    }
    const local = resolveLocalFile(doc.storagePath, doc.fileUrl);
    if (!local) {
      skipped++;
      continue;
    }
    const base = path.basename(local);
    const buf = fs.readFileSync(local);
    const saved = await mockOneDrive.upload(HR_VAULT_DRIVE_CODE, `${vaultRel}/${sub}`, base, buf, undefined, { replace: true });
    const url = saved.sharePointUrl || saved.url || `/uploads/onedrive/${HR_VAULT_DRIVE_CODE}/${saved.path}`;
    await prisma.employeeDocument.update({
      where: { id: doc.id },
      data: { fileUrl: url, storagePath: saved.sharePointPath || saved.path },
    });
    synced++;
  }
  return { synced, skipped };
}

const staffEmployeeWhere = {
  NOT: { email: { startsWith: "deleted." } },
  OR: [
    { role: { in: ["admin", "office", "hr", "site_employee"] as string[] } },
    { role: "employee", vendorId: null },
  ],
  isActive: true,
};

export async function provisionAllEmployeeVaults(opts?: { userId?: string; syncDocs?: boolean }) {
  const users = await prisma.user.findMany({
    where: opts?.userId ? { id: opts.userId, ...staffEmployeeWhere } : staffEmployeeWhere,
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, email: true },
  });
  const profiles = await prisma.employeeProfile.findMany({
    where: { userId: { in: users.map((u) => u.id) } },
  });
  const byUser = new Map(profiles.map((p) => [p.userId, p]));

  const rows: Array<{ userId: string; fullName: string; vaultRel: string; docsSynced: number }> = [];
  for (const u of users) {
    const profile = byUser.get(u.id) || null;
    const { vaultRel } = await ensureEmployeeVault({
      userId: u.id,
      fullName: u.fullName,
      email: u.email,
      profile,
    });
    let docsSynced = 0;
    if (opts?.syncDocs !== false) {
      const out = await syncEmployeeVaultDocuments(u.id);
      docsSynced = out.synced;
    }
    rows.push({ userId: u.id, fullName: u.fullName, vaultRel, docsSynced });
  }
  return { provisioned: rows.length, employees: rows };
}
