/**
 * Microsoft Graph — client-credentials for SharePoint + shared mailbox.
 * No Project Online dependency. Secrets only from env.
 */

type TokenCache = { accessToken: string; expiresAt: number };

let tokenCache: TokenCache | null = null;

function env(name: string, ...aliases: string[]) {
  for (const key of [name, ...aliases]) {
    const v = process.env[key]?.trim();
    if (v) return v;
  }
  return "";
}

export function graphConfig() {
  const tenantId = env("AZURE_TENANT_ID", "GRAPH_TENANT_ID");
  const clientId = env("AZURE_CLIENT_ID", "GRAPH_CLIENT_ID");
  const clientSecret = env("AZURE_CLIENT_SECRET", "GRAPH_CLIENT_SECRET");
  const siteUrl = env("SHAREPOINT_SITE_URL", "GRAPH_SHAREPOINT_SITE_URL");
  const mailbox = env("GRAPH_MAIL_FROM", "GRAPH_SHARED_MAILBOX");
  const mock = process.env.MOCK_ONEDRIVE !== "false";
  const configured = Boolean(tenantId && clientId && clientSecret);
  return { tenantId, clientId, clientSecret, siteUrl, mailbox, mock, configured };
}

export function parseSharePointSiteUrl(siteUrl: string): { hostname: string; sitePath: string } | null {
  try {
    const u = new URL(siteUrl);
    const hostname = u.hostname;
    // e.g. /sites/SharnamProjects or /sites/SharnamProjects/Shared%20Documents
    const match = u.pathname.match(/^(\/sites\/[^/]+)/i);
    if (!match) return null;
    return { hostname, sitePath: match[1] };
  } catch {
    return null;
  }
}

async function getAccessToken(): Promise<string> {
  const { tenantId, clientId, clientSecret, configured } = graphConfig();
  if (!configured) throw new Error("Graph credentials not configured (AZURE_TENANT_ID / CLIENT_ID / CLIENT_SECRET)");

  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.accessToken;
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `Token request failed (${res.status})`);
  }

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + (data.expires_in || 3600) * 1000,
  };
  return data.access_token;
}

export async function graphFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || "GET").toUpperCase();
  // Hard ban: never delete anything in the customer's drive via Graph
  if (method === "DELETE") {
    throw new Error("SharePoint DELETE is disabled — portal never deletes customer drive items");
  }

  const token = await getAccessToken();
  const url = path.startsWith("http") ? path : `https://graph.microsoft.com/v1.0${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init?.headers || {}),
    },
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const err = json as { error?: { message?: string; code?: string } };
    throw new Error(err?.error?.message || err?.error?.code || `Graph ${res.status}: ${text.slice(0, 240)}`);
  }
  return json as T;
}

export type GraphHealth = {
  configured: boolean;
  mockOneDrive: boolean;
  mailbox: string | null;
  siteUrl: string | null;
  tokenOk: boolean;
  siteOk: boolean;
  siteId: string | null;
  siteName: string | null;
  driveId: string | null;
  driveName: string | null;
  rootItemCount: number | null;
  rootSample: { name: string; folder: boolean }[];
  projectOnline: false;
  error: string | null;
  checkedAt: string;
};

export async function probeSharePoint(): Promise<GraphHealth> {
  const cfg = graphConfig();
  const base: GraphHealth = {
    configured: cfg.configured,
    mockOneDrive: cfg.mock,
    mailbox: cfg.mailbox || null,
    siteUrl: cfg.siteUrl || null,
    tokenOk: false,
    siteOk: false,
    siteId: null,
    siteName: null,
    driveId: null,
    driveName: null,
    rootItemCount: null,
    rootSample: [],
    projectOnline: false,
    error: null,
    checkedAt: new Date().toISOString(),
  };

  if (!cfg.configured) {
    base.error = "Missing AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET";
    return base;
  }
  if (!cfg.siteUrl) {
    base.error = "Missing SHAREPOINT_SITE_URL";
    return base;
  }

  try {
    await getAccessToken();
    base.tokenOk = true;

    const parsed = parseSharePointSiteUrl(cfg.siteUrl);
    if (!parsed) {
      base.error = `Could not parse SharePoint site URL: ${cfg.siteUrl}`;
      return base;
    }

    const site = await graphFetch<{ id: string; displayName?: string; name?: string; webUrl?: string }>(
      `/sites/${parsed.hostname}:${parsed.sitePath}`
    );
    base.siteOk = true;
    base.siteId = site.id;
    base.siteName = site.displayName || site.name || null;

    const drives = await graphFetch<{ value: { id: string; name: string }[] }>(`/sites/${site.id}/drives`);
    const defaultDrive =
      drives.value?.find((d) => /documents|shared documents/i.test(d.name)) || drives.value?.[0];
    if (!defaultDrive) {
      base.error = "Site resolved but no document libraries found";
      return base;
    }
    base.driveId = defaultDrive.id;
    base.driveName = defaultDrive.name;

    const children = await graphFetch<{ value: { name: string; folder?: unknown; file?: unknown }[] }>(
      `/drives/${defaultDrive.id}/root/children?$top=12&$select=name,folder,file`
    );
    const items = children.value || [];
    base.rootItemCount = items.length;
    base.rootSample = items.slice(0, 8).map((i) => ({ name: i.name, folder: Boolean(i.folder) }));
    return base;
  } catch (err) {
    base.error = err instanceof Error ? err.message : String(err);
    return base;
  }
}

export async function listDriveChildren(driveId: string, itemPath = "root") {
  if (itemPath === "root" || !itemPath) {
    return graphFetch<{ value: unknown[] }>(
      `/drives/${driveId}/root/children?$top=50&$select=id,name,size,folder,file,webUrl,lastModifiedDateTime`
    );
  }
  const encoded = itemPath
    .split("/")
    .filter(Boolean)
    .map((s) => encodeURIComponent(s))
    .join("/");
  return graphFetch<{ value: unknown[] }>(
    `/drives/${driveId}/root:/${encoded}:/children?$top=50&$select=id,name,size,folder,file,webUrl,lastModifiedDateTime`
  );
}

/** Project library folders (mirrors mockOneDrive ensureProjectTree) */
export const PROJECT_LIBRARY_FOLDERS = [
  "Drawings",
  "Drawings/Architecture",
  "Drawings/Structural",
  "Drawings/MEP",
  "Drawings/Civil",
  "Documents",
  "Documents/Contracts",
  "Documents/Reports",
  "Documents/DPR",
  "Documents/WPR",
  "Documents/QAP",
  "Documents/Communication-Matrix",
  "Documents/Design-Coordination",
  "Photos",
  "Checklists",
  "Inspections",
  "Inspections/Architecture",
  "Inspections/Structural",
  "Inspections/MEP",
  "Inspections/Civil",
  "RFIs",
  "Submittals",
  "Safety",
  "Cost-Bills",
] as const;

export type DriveRef = { siteId: string; driveId: string; driveName: string; siteName: string | null };

export async function resolveDefaultDrive(): Promise<DriveRef> {
  const health = await probeSharePoint();
  if (!health.tokenOk || !health.siteOk || !health.driveId || !health.siteId) {
    throw new Error(health.error || "SharePoint drive not available");
  }
  return {
    siteId: health.siteId,
    driveId: health.driveId,
    driveName: health.driveName || "Documents",
    siteName: health.siteName,
  };
}

function encodeDrivePath(relPath: string) {
  return relPath
    .split("/")
    .filter(Boolean)
    .map((s) => encodeURIComponent(s))
    .join("/");
}

/** All portal writes stay inside this sandbox — never touch other site folders/files. */
export const SHAREPOINT_SANDBOX_ROOT = "Sharnam Portal";

function sanitizeProjectCode(projectCode: string) {
  const clean = projectCode.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!clean || clean === "." || clean === "..") throw new Error("Invalid projectCode");
  return clean;
}

/** Refuse any path outside Sharnam Portal/ or with path traversal. */
export function assertPortalSafePath(relPath: string) {
  const normalized = relPath.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/");
  if (!normalized.startsWith(`${SHAREPOINT_SANDBOX_ROOT}/`) && normalized !== SHAREPOINT_SANDBOX_ROOT) {
    throw new Error(`SharePoint write blocked outside sandbox (${SHAREPOINT_SANDBOX_ROOT}/): ${relPath}`);
  }
  if (normalized.split("/").some((p) => p === ".." || p === "")) {
    throw new Error(`SharePoint path traversal blocked: ${relPath}`);
  }
  return normalized;
}

/**
 * Ensure folder under sandbox only.
 * Idempotent: if folder exists, leave it untouched (no rename/delete).
 */
export async function ensureDriveFolder(driveId: string, folderPath: string): Promise<{ id: string; name: string; webUrl?: string }> {
  const safePath = assertPortalSafePath(folderPath);
  const parts = safePath.split("/").filter(Boolean);
  if (!parts.length) throw new Error("folderPath required");

  let parentPath = "";
  let last: { id: string; name: string; webUrl?: string } | null = null;

  for (const name of parts) {
    if (name === ".." || name.includes("/") || name.includes("\\")) {
      throw new Error(`Invalid folder segment: ${name}`);
    }
    const currentPath = parentPath ? `${parentPath}/${name}` : name;
    assertPortalSafePath(currentPath);
    const encoded = encodeDrivePath(currentPath);
    try {
      const existing = await graphFetch<{ id: string; name: string; webUrl?: string; folder?: unknown }>(
        `/drives/${driveId}/root:/${encoded}`
      );
      // Exists — never alter
      last = { id: existing.id, name: existing.name, webUrl: existing.webUrl };
    } catch {
      // Create only if missing. fail = do not rename/overwrite siblings.
      const createUrl = parentPath
        ? `/drives/${driveId}/root:/${encodeDrivePath(parentPath)}:/children`
        : `/drives/${driveId}/root/children`;
      try {
        last = await graphFetch<{ id: string; name: string; webUrl?: string }>(createUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            folder: {},
            "@microsoft.graph.conflictBehavior": "fail",
          }),
        });
      } catch (createErr) {
        // Race / already exists — re-read, never delete or rename
        const existing = await graphFetch<{ id: string; name: string; webUrl?: string }>(
          `/drives/${driveId}/root:/${encoded}`
        ).catch(() => null);
        if (!existing) throw createErr;
        last = { id: existing.id, name: existing.name, webUrl: existing.webUrl };
      }
    }
    parentPath = currentPath;
  }

  if (!last) throw new Error(`Failed to ensure folder ${folderPath}`);
  return last;
}

export async function ensureProjectSharePointTree(projectCode: string) {
  const code = sanitizeProjectCode(projectCode);
  const drive = await resolveDefaultDrive();
  const rootFolder = `${SHAREPOINT_SANDBOX_ROOT}/${code}`;
  assertPortalSafePath(rootFolder);
  const created: string[] = [];

  await ensureDriveFolder(drive.driveId, rootFolder);
  created.push(rootFolder);

  for (const rel of PROJECT_LIBRARY_FOLDERS) {
    const full = `${rootFolder}/${rel}`;
    await ensureDriveFolder(drive.driveId, full);
    created.push(full);
  }

  return { drive, rootFolder, folders: created };
}

/**
 * Upload into sandbox only.
 * Never overwrites an existing file — if name exists, writes a unique sibling name.
 * Never deletes.
 */
export async function uploadToProjectLibrary(
  projectCode: string,
  relFolder: string,
  fileName: string,
  buffer: Buffer,
  contentType = "application/octet-stream"
) {
  const code = sanitizeProjectCode(projectCode);
  const drive = await resolveDefaultDrive();
  const rootFolder = `${SHAREPOINT_SANDBOX_ROOT}/${code}`;
  const folder = relFolder ? `${rootFolder}/${relFolder.replace(/^\/+|\/+$/g, "")}` : rootFolder;
  assertPortalSafePath(folder);
  await ensureDriveFolder(drive.driveId, folder);

  let safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!safe || safe === "." || safe === "..") safe = `upload-${Date.now()}.bin`;

  let target = `${folder}/${safe}`;
  assertPortalSafePath(target);

  // If file already exists, do NOT overwrite — pick a new name
  const existing = await graphFetch<{ id: string }>(`/drives/${drive.driveId}/root:/${encodeDrivePath(target)}`).catch(
    () => null
  );
  if (existing) {
    const dot = safe.lastIndexOf(".");
    const base = dot > 0 ? safe.slice(0, dot) : safe;
    const ext = dot > 0 ? safe.slice(dot) : "";
    safe = `${base}-${Date.now()}${ext}`;
    target = `${folder}/${safe}`;
    assertPortalSafePath(target);
  }

  const encoded = encodeDrivePath(target);
  // conflictBehavior=fail: refuse overwrite if something appeared mid-flight
  const uploaded = await graphFetch<{
    id: string;
    name: string;
    webUrl?: string;
    size?: number;
  }>(`/drives/${drive.driveId}/root:/${encoded}:/content?@microsoft.graph.conflictBehavior=fail`, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: new Uint8Array(buffer),
  });

  return {
    path: `${relFolder}/${safe}`.replace(/^\//, ""),
    url: uploaded.webUrl || null,
    sharePointPath: target,
    itemId: uploaded.id,
    driveId: drive.driveId,
    provider: "sharepoint" as const,
  };
}

export async function listProjectLibrary(projectCode: string, relFolder = "") {
  const code = sanitizeProjectCode(projectCode);
  const drive = await resolveDefaultDrive();
  const rootFolder = `${SHAREPOINT_SANDBOX_ROOT}/${code}`;
  const path = relFolder ? `${rootFolder}/${relFolder.replace(/^\/+|\/+$/g, "")}` : rootFolder;
  assertPortalSafePath(path);
  try {
    return await listDriveChildren(drive.driveId, path);
  } catch {
    // tree may not exist yet
    return { value: [] };
  }
}

