/**
 * HR employee DMS vault — `_HR/06_HR_AND_ADMIN/06.02_Employee_Files/{person}/`
 * Subfolders: Letters · Onboarding · Documents
 */
import fs from "fs";
import path from "path";
import { prisma } from "../prisma.js";
import { mockOneDrive } from "./mockOneDrive.js";
import { hrPersonFolder } from "./hrmsLetter.js";

export const HRMS_EMPLOYEE_FILES_ROOT = "06_HR_AND_ADMIN/06.02_Employee_Files";
/** Company-wide mock/SharePoint drive code — not per project. */
export const HR_VAULT_DRIVE_CODE = "_HR";
/** Virtual path prefix used inside project DMS browse (`@_HR/06_HR_AND_ADMIN/...`). */
export const HR_VAULT_VIRTUAL_PREFIX = "@_HR";
export const HR_VAULT_TREE_ROOT = "06_HR_AND_ADMIN";
export const HR_VAULT_LABEL = "06 HR & Admin (Company)";

const HR_COMPANY_FOLDERS = [
  HR_VAULT_TREE_ROOT,
  `${HR_VAULT_TREE_ROOT}/06.01_Letters`,
  `${HR_VAULT_TREE_ROOT}/06.02_Employee_Files`,
  `${HR_VAULT_TREE_ROOT}/06.03_Payslips`,
] as const;

const VAULT_SUBFOLDERS = ["Letters", "Onboarding", "Documents"] as const;

export function isHrVaultPath(folderPath: string) {
  return folderPath === HR_VAULT_VIRTUAL_PREFIX || folderPath.startsWith(`${HR_VAULT_VIRTUAL_PREFIX}/`);
}

export function hrRelFromVirtualPath(folderPath: string) {
  if (folderPath === HR_VAULT_VIRTUAL_PREFIX) return "";
  if (folderPath.startsWith(`${HR_VAULT_VIRTUAL_PREFIX}/`)) {
    return folderPath.slice(HR_VAULT_VIRTUAL_PREFIX.length + 1);
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
  const code = profile?.empCode?.trim();
  if (code) return hrPersonFolder(code);
  return hrPersonFolder(fullName);
}

export function employeeVaultRelPath(
  profile: { empCode?: string | null } | null | undefined,
  fullName: string,
) {
  return `${HRMS_EMPLOYEE_FILES_ROOT}/${employeeVaultFolderName(profile, fullName)}`;
}

/** Map upload category → SharePoint subfolder under the employee vault. */
export function vaultSubfolderForCategory(category: string): VaultSubfolder {
  const c = String(category || "").toLowerCase();
  if (/(offer|appointment|promotion|relieving|experience|confirmation|warning|letter)/.test(c)) {
    return "Letters";
  }
  if (/(onboard|policy|bgv|medical|welcome|id-card|id card)/.test(c)) {
    return "Onboarding";
  }
  return "Documents";
}

function uploadRoot() {
  return path.join(mockOneDrive.root(), "onedrive", "_HR");
}

function ensureLocalFolder(relPath: string) {
  const abs = path.join(uploadRoot(), relPath);
  fs.mkdirSync(abs, { recursive: true });
  return abs;
}

/** Ensure the company HR tree exists on the global `_HR` drive (not inside project folders). */
export async function ensureHrCompanyTree() {
  for (const rel of HR_COMPANY_FOLDERS) {
    ensureLocalFolder(rel);
  }
  return { driveCode: HR_VAULT_DRIVE_CODE, folders: [...HR_COMPANY_FOLDERS] };
}

function indexPayload(user: { fullName: string; email: string }, profile: { empCode?: string | null } | null) {
  return {
    employee: user.fullName,
    email: user.email,
    empCode: profile?.empCode || null,
    vaultRoot: `_HR/${HRMS_EMPLOYEE_FILES_ROOT}`,
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
    "_HR",
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
  if (fileUrl?.includes("/uploads/onedrive/_HR/")) {
    const rel = fileUrl.split("/uploads/onedrive/_HR/")[1];
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
    const saved = await mockOneDrive.upload("_HR", `${vaultRel}/${sub}`, base, buf, undefined, { replace: true });
    const url = saved.sharePointUrl || saved.url || `/uploads/onedrive/_HR/${saved.path}`;
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
