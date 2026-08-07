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
  const path =
    itemPath === "root" || !itemPath
      ? `/drives/${driveId}/root/children?$top=50&$select=id,name,size,folder,file,webUrl,lastModifiedDateTime`
      : `/drives/${driveId}/root:/${encodeURI(itemPath).replace(/%2F/g, "/")}:/children?$top=50&$select=id,name,size,folder,file,webUrl,lastModifiedDateTime`;
  return graphFetch<{ value: unknown[] }>(path);
}
