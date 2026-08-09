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

/** ISO / PMC folder tree — 10 areas, 100 subject folders (max 3 levels deep) */
export const PROJECT_LIBRARY_FOLDERS = [
  // Root registers
  "_Registers",
  // 01
  "01_CONTEXT_AND_GOVERNANCE",
  "01_CONTEXT_AND_GOVERNANCE/01.01_Project_Charter_and_Context",
  "01_CONTEXT_AND_GOVERNANCE/01.02_Stakeholders_and_Communication",
  "01_CONTEXT_AND_GOVERNANCE/01.03_Organisation_and_Authority",
  "01_CONTEXT_AND_GOVERNANCE/01.04_Stage_Gates_and_Assurance",
  "01_CONTEXT_AND_GOVERNANCE/01.05_Agreements_Bonds_and_Insurance",
  // 02
  "02_PLANNING",
  "02_PLANNING/02.01_Scope_and_Work_Breakdown",
  "02_PLANNING/02.02_Project_Programme_Schedule_Control",
  "02_PLANNING/02.03_Milestone_Register_Payment_Linkage",
  "02_PLANNING/02.04_LookAhead_Planning_Constraint_Management",
  "02_PLANNING/02.05_Cost_Estimates_Budget_Development",
  "02_PLANNING/02.06_Cost_Baseline_Cost_Breakdown_Structure",
  "02_PLANNING/02.07_Cash_Flow_Forecast_Monitoring",
  "02_PLANNING/02.08_Risk_and_Issue_Management",
  "02_PLANNING/02.09_Studies_Investigations_Technical_Reports",
  "02_PLANNING/02.10_Topographical_SettingOut_Survey",
  "02_PLANNING/02.11_Geotechnical_Investigation",
  // 03
  "03_SUPPORT_AND_RESOURCES",
  "03_SUPPORT_AND_RESOURCES/03.01_Competence_and_Training",
  "03_SUPPORT_AND_RESOURCES/03.02_Resources_and_Productivity",
  "03_SUPPORT_AND_RESOURCES/03.03_Master_Register_Index_Update_Control",
  "03_SUPPORT_AND_RESOURCES/03.04_Controlled_Templates_Forms",
  "03_SUPPORT_AND_RESOURCES/03.05_Superseded_Document_Control",
  "03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control",
  "03_SUPPORT_AND_RESOURCES/03.07_Transmittal_Control",
  "03_SUPPORT_AND_RESOURCES/03.08_Meetings_Minutes_Action_Tracking",
  "03_SUPPORT_AND_RESOURCES/03.09_Monitoring_and_Measuring_Equipment",
  // 04
  "04_DESIGN_AND_INFORMATION_MANAGEMENT",
  "04_DESIGN_AND_INFORMATION_MANAGEMENT/04.01_Design_Programme_and_Deliverables",
  "04_DESIGN_AND_INFORMATION_MANAGEMENT/04.02_Drawings_and_Specifications",
  "04_DESIGN_AND_INFORMATION_MANAGEMENT/04.03_Design_Review_and_Verification",
  "04_DESIGN_AND_INFORMATION_MANAGEMENT/04.04_Clash_Detection_Design_Coordination",
  "04_DESIGN_AND_INFORMATION_MANAGEMENT/04.05_BIM_Model_Management_CDE",
  "04_DESIGN_AND_INFORMATION_MANAGEMENT/04.06_Asset_Register_Structured_Asset_Data",
  "04_DESIGN_AND_INFORMATION_MANAGEMENT/04.07_Design_Change_and_Value_Engineering",
  "04_DESIGN_AND_INFORMATION_MANAGEMENT/04.08_Shop_Drawings_and_Material_Submittals",
  // 05
  "05_PROCUREMENT_AND_CONTRACTS",
  "05_PROCUREMENT_AND_CONTRACTS/05.01_Procurement_Strategy_and_Packages",
  "05_PROCUREMENT_AND_CONTRACTS/05.02_Prequalification_Vendor_Database",
  "05_PROCUREMENT_AND_CONTRACTS/05.03_Tender_Documents_Issue",
  "05_PROCUREMENT_AND_CONTRACTS/05.04_PreBid_Queries_Addenda",
  "05_PROCUREMENT_AND_CONTRACTS/05.05_Bid_Receipt_Opening",
  "05_PROCUREMENT_AND_CONTRACTS/05.06_Bid_Evaluation_Recommendation",
  "05_PROCUREMENT_AND_CONTRACTS/05.07_Negotiation_Records",
  "05_PROCUREMENT_AND_CONTRACTS/05.08_Award_Recommendation_Letter_Intent",
  "05_PROCUREMENT_AND_CONTRACTS/05.09_Contract_Administration_and_Supplier_Performance",
  "05_PROCUREMENT_AND_CONTRACTS/05.10_Customer_Supplied_Property",
  "05_PROCUREMENT_AND_CONTRACTS/05.11_Vendor_Works_Inspection_and_Long_Lead",
  // 06
  "06_STATUTORY_AND_LAND",
  "06_STATUTORY_AND_LAND/06.01_Land_Title_and_Revenue_Records",
  "06_STATUTORY_AND_LAND/06.02_Statutory_Approvals_and_Permits",
  "06_STATUTORY_AND_LAND/06.03_Labour_and_Statutory_Compliance",
  "06_STATUTORY_AND_LAND/06.04_Industrial_Statutory_Approvals",
  // 07
  "07_EXECUTION_AND_DELIVERY",
  "07_EXECUTION_AND_DELIVERY/07.01_Mobilisation_and_Site_Logistics",
  "07_EXECUTION_AND_DELIVERY/07.02_Daily_Site_Records",
  "07_EXECUTION_AND_DELIVERY/07.03_Site_Instructions_Client_Instructions",
  "07_EXECUTION_AND_DELIVERY/07.04_Interface_Management_Between_Packages",
  "07_EXECUTION_AND_DELIVERY/07.05_Work_Front_Release_Between_Trades",
  "07_EXECUTION_AND_DELIVERY/07.06_Method_Statements_and_Temporary_Works",
  "07_EXECUTION_AND_DELIVERY/07.07_Material_Receipt_and_Traceability",
  "07_EXECUTION_AND_DELIVERY/07.08_Progress_Measurement_SCurve",
  "07_EXECUTION_AND_DELIVERY/07.09_Delay_Analysis",
  "07_EXECUTION_AND_DELIVERY/07.10_Recovery_Acceleration_Planning",
  "07_EXECUTION_AND_DELIVERY/07.11_PEB_Structural_Steel_and_Surface_Protection",
  "07_EXECUTION_AND_DELIVERY/07.12_Mechanical_Erection_Piping_and_Equipment",
  // 08
  "08_QUALITY_HSE_AND_ENVIRONMENT",
  "08_QUALITY_HSE_AND_ENVIRONMENT/08.01_Quality_Plans_and_Inspection_Test_Plans",
  "08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards",
  "08_QUALITY_HSE_AND_ENVIRONMENT/08.03_Testing_Test_Report_Control",
  "08_QUALITY_HSE_AND_ENVIRONMENT/08.04_Third_Party_Inspection",
  "08_QUALITY_HSE_AND_ENVIRONMENT/08.05_MockUps_Benchmark_Approvals",
  "08_QUALITY_HSE_AND_ENVIRONMENT/08.06_Control_of_Nonconforming_Output",
  "08_QUALITY_HSE_AND_ENVIRONMENT/08.07_Hazard_Identification_Risk_Assessment",
  "08_QUALITY_HSE_AND_ENVIRONMENT/08.08_Permit_Work",
  "08_QUALITY_HSE_AND_ENVIRONMENT/08.09_Toolbox_Talks",
  "08_QUALITY_HSE_AND_ENVIRONMENT/08.10_Incidents_and_Emergency_Preparedness",
  "08_QUALITY_HSE_AND_ENVIRONMENT/08.11_Environmental_and_Sustainability",
  "08_QUALITY_HSE_AND_ENVIRONMENT/08.12_Welding_and_NDT_Control",
  // 09
  "09_COMMERCIAL_AND_CHANGE",
  "09_COMMERCIAL_AND_CHANGE/09.01_Interim_Bill_Verification_Certification",
  "09_COMMERCIAL_AND_CHANGE/09.02_Joint_Measurement",
  "09_COMMERCIAL_AND_CHANGE/09.03_Commitment_Expenditure_Register",
  "09_COMMERCIAL_AND_CHANGE/09.04_Change_Control",
  "09_COMMERCIAL_AND_CHANGE/09.05_Variation_Extra_Item_Evaluation",
  "09_COMMERCIAL_AND_CHANGE/09.06_Rate_Analysis_Market_Rate_Evidence",
  "09_COMMERCIAL_AND_CHANGE/09.07_Claims_and_Disputes",
  "09_COMMERCIAL_AND_CHANGE/09.08_Cost_Reporting_and_Reconciliation",
  "09_COMMERCIAL_AND_CHANGE/09.09_Final_Account_and_Retention",
  // 10
  "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT",
  "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.01_Progress_Reporting_MIS",
  "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.02_Project_KPIs_Performance_Measurement",
  "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.03_Presentations_Site_Visits_Reviews",
  "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.04_Commissioning_and_Testing",
  "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.05_Snagging_and_Acceptance",
  "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.06_Handover_Dossier_Practical_Completion",
  "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.07_Operation_Maintenance_Manuals",
  "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.08_Warranties_Guarantees",
  "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.09_Mandatory_Spares_Consumables",
  "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.10_FM_Training_Soft_Landings",
  "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.11_Key_Access_Handover",
  "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.12_Defect_Liability_and_Warranty",
  "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.13_Contract_Project_Closeout",
  "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.14_Lessons_Learned",
  "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.15_Records_Archival_Transfer_Client",
  "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.16_Closed_Correspondence_Archive",
  "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.17_FAT_SAT_and_Performance_Test_Run",
  "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.18_Management_Review_and_Audit_Programme",
  "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.19_Client_Satisfaction_and_QMS_Context",
] as const;

/** Where each portal module dumps logs & sample files (matches Sharnam Portal → ISO folders) */
export const MODULE_TO_ISO_FOLDER = {
  drawings: "04_DESIGN_AND_INFORMATION_MANAGEMENT/04.02_Drawings_and_Specifications",
  drawingSpec: "04_DESIGN_AND_INFORMATION_MANAGEMENT/04.02_Drawings_and_Specifications",
  designCoordination: "04_DESIGN_AND_INFORMATION_MANAGEMENT/04.04_Clash_Detection_Design_Coordination",
  submittals: "04_DESIGN_AND_INFORMATION_MANAGEMENT/04.08_Shop_Drawings_and_Material_Submittals",
  rfiInformation: "03_SUPPORT_AND_RESOURCES/03.06_Correspondence_Control",
  transmittals: "03_SUPPORT_AND_RESOURCES/03.07_Transmittal_Control",
  meetings: "03_SUPPORT_AND_RESOURCES/03.08_Meetings_Minutes_Action_Tracking",
  dpr: "07_EXECUTION_AND_DELIVERY/07.02_Daily_Site_Records",
  photos: "07_EXECUTION_AND_DELIVERY/07.02_Daily_Site_Records",
  siteInstructions: "07_EXECUTION_AND_DELIVERY/07.03_Site_Instructions_Client_Instructions",
  progress: "07_EXECUTION_AND_DELIVERY/07.08_Progress_Measurement_SCurve",
  hindrance: "07_EXECUTION_AND_DELIVERY/07.09_Delay_Analysis",
  qap: "08_QUALITY_HSE_AND_ENVIRONMENT/08.01_Quality_Plans_and_Inspection_Test_Plans",
  qualityChecklist: "08_QUALITY_HSE_AND_ENVIRONMENT/08.02_Inspection_Checklists_Pour_Cards",
  cube: "08_QUALITY_HSE_AND_ENVIRONMENT/08.03_Testing_Test_Report_Control",
  ncr: "08_QUALITY_HSE_AND_ENVIRONMENT/08.06_Control_of_Nonconforming_Output",
  safety: "08_QUALITY_HSE_AND_ENVIRONMENT/08.07_Hazard_Identification_Risk_Assessment",
  safetyNcr: "08_QUALITY_HSE_AND_ENVIRONMENT/08.06_Control_of_Nonconforming_Output",
  cashflow: "02_PLANNING/02.07_Cash_Flow_Forecast_Monitoring",
  budget: "02_PLANNING/02.05_Cost_Estimates_Budget_Development",
  raBill: "09_COMMERCIAL_AND_CHANGE/09.01_Interim_Bill_Verification_Certification",
  variation: "09_COMMERCIAL_AND_CHANGE/09.05_Variation_Extra_Item_Evaluation",
  costReport: "09_COMMERCIAL_AND_CHANGE/09.08_Cost_Reporting_and_Reconciliation",
  finalAccount: "09_COMMERCIAL_AND_CHANGE/09.09_Final_Account_and_Retention",
  reportsMis: "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.01_Progress_Reporting_MIS",
  kpi: "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.02_Project_KPIs_Performance_Measurement",
  snagging: "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.05_Snagging_and_Acceptance",
  handover: "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.06_Handover_Dossier_Practical_Completion",
  lessons: "10_PERFORMANCE_HANDOVER_AND_IMPROVEMENT/10.14_Lessons_Learned",
} as const;

export type ModuleKey = keyof typeof MODULE_TO_ISO_FOLDER;

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

