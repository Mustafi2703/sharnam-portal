/**
 * Convert filled WPR PPTX → PDF.
 *
 * Priority (Hostinger-friendly first):
 *   1. Microsoft Graph / SharePoint — portal.spdc.in with MOCK_ONEDRIVE=false
 *   2. CloudConvert API — optional CLOUDCONVERT_API_KEY
 *   3. Gotenberg — VPS / Docker only
 *   4. LibreOffice — local dev
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { convertDriveItemToPdf, graphConfig, MODULE_TO_ISO_FOLDER, uploadToProjectLibrary } from "./graph.js";

const execFileAsync = promisify(execFile);

export type WprPdfEngine = "sharepoint" | "cloudconvert" | "gotenberg" | "libreoffice";

export type WprPdfResult = {
  buffer: Buffer;
  engine: WprPdfEngine;
};

function sofficeCandidates(): string[] {
  const env = process.env.LIBREOFFICE_PATH || process.env.SOFFICE_PATH;
  return [
    env,
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    "/usr/bin/soffice",
    "/usr/bin/libreoffice",
    "soffice",
  ].filter(Boolean) as string[];
}

async function convertWithSharePoint(pptx: Buffer, projectCode: string): Promise<Buffer> {
  const { configured, mock } = graphConfig();
  if (!configured) throw new Error("SharePoint Graph credentials not configured");
  if (mock) throw new Error("MOCK_ONEDRIVE is enabled — set MOCK_ONEDRIVE=false for live PDF conversion");

  const fileName = `_wpr_pdf_${Date.now()}.pptx`;
  const uploaded = await uploadToProjectLibrary(
    projectCode,
    MODULE_TO_ISO_FOLDER.wpr,
    fileName,
    pptx,
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  );
  if (!uploaded.driveId || !uploaded.itemId) {
    throw new Error("SharePoint upload did not return drive item id for PDF conversion");
  }
  return convertDriveItemToPdf(uploaded.driveId, uploaded.itemId);
}

async function convertWithCloudConvert(pptx: Buffer): Promise<Buffer> {
  const apiKey = process.env.CLOUDCONVERT_API_KEY?.trim();
  if (!apiKey) throw new Error("CLOUDCONVERT_API_KEY not set");

  const jobRes = await fetch("https://api.cloudconvert.com/v2/jobs", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tasks: {
        import: { operation: "import/upload" },
        convert: {
          operation: "convert",
          input: "import",
          input_format: "pptx",
          output_format: "pdf",
        },
        export: { operation: "export/url", input: "convert" },
      },
    }),
  });
  if (!jobRes.ok) {
    const text = await jobRes.text().catch(() => "");
    throw new Error(`CloudConvert job failed (${jobRes.status}): ${text.slice(0, 200)}`);
  }
  const job = (await jobRes.json()) as {
    data?: { tasks?: Array<{ name?: string; id?: string; result?: { form?: { url?: string; parameters?: Record<string, string> } } }> };
  };
  const importTask = job.data?.tasks?.find((t) => t.name === "import");
  const form = importTask?.result?.form;
  if (!form?.url) throw new Error("CloudConvert import form missing");

  const uploadForm = new FormData();
  for (const [k, v] of Object.entries(form.parameters || {})) {
    uploadForm.append(k, v);
  }
  uploadForm.append(
    "file",
    new Blob([new Uint8Array(pptx)], {
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    }),
    "wpr.pptx",
  );
  const upRes = await fetch(form.url, { method: "POST", body: uploadForm });
  if (!upRes.ok) throw new Error(`CloudConvert upload failed (${upRes.status})`);

  const jobId = (job.data as { id?: string })?.id;
  if (!jobId) throw new Error("CloudConvert job id missing");

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!poll.ok) continue;
    const polled = (await poll.json()) as {
      data?: { status?: string; tasks?: Array<{ name?: string; status?: string; result?: { files?: { url?: string }[] } }> };
    };
    if (polled.data?.status === "error") throw new Error("CloudConvert job failed");
    if (polled.data?.status !== "finished") continue;
    const exportTask = polled.data.tasks?.find((t) => t.name === "export");
    const fileUrl = exportTask?.result?.files?.[0]?.url;
    if (!fileUrl) throw new Error("CloudConvert export URL missing");
    const pdfRes = await fetch(fileUrl);
    if (!pdfRes.ok) throw new Error(`CloudConvert PDF download failed (${pdfRes.status})`);
    return Buffer.from(await pdfRes.arrayBuffer());
  }
  throw new Error("CloudConvert timed out waiting for PDF");
}

async function convertWithLibreOffice(pptx: Buffer): Promise<Buffer> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpr-pdf-"));
  const inputPath = path.join(tmpDir, "wpr.pptx");
  fs.writeFileSync(inputPath, pptx);
  let lastErr: unknown;
  for (const bin of sofficeCandidates()) {
    try {
      await execFileAsync(
        bin,
        ["--headless", "--nologo", "--nofirststartwizard", "--convert-to", "pdf", "--outdir", tmpDir, inputPath],
        { timeout: 120_000, maxBuffer: 20 * 1024 * 1024 },
      );
      const pdfPath = path.join(tmpDir, "wpr.pdf");
      if (fs.existsSync(pdfPath)) {
        const buf = fs.readFileSync(pdfPath);
        fs.rmSync(tmpDir, { recursive: true, force: true });
        return buf;
      }
    } catch (err) {
      lastErr = err;
    }
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
  throw lastErr instanceof Error ? lastErr : new Error("LibreOffice PDF conversion failed");
}

async function convertWithGotenberg(pptx: Buffer): Promise<Buffer> {
  const base = (process.env.GOTENBERG_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
  const form = new FormData();
  form.append(
    "files",
    new Blob([new Uint8Array(pptx)], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }),
    "wpr.pptx",
  );
  const res = await fetch(`${base}/forms/libreoffice/convert`, { method: "POST", body: form });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gotenberg PDF failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/** Convert PPTX buffer to PDF — SharePoint Graph first (Hostinger), then optional fallbacks. */
export async function convertWprPptxToPdf(pptx: Buffer, projectCode: string): Promise<WprPdfResult> {
  if (process.env.WPR_PDF_DISABLED === "1") {
    throw new Error("WPR PDF export is disabled (WPR_PDF_DISABLED=1)");
  }

  const errors: string[] = [];
  const { configured, mock } = graphConfig();
  if (configured && !mock && projectCode) {
    try {
      return { buffer: await convertWithSharePoint(pptx, projectCode), engine: "sharepoint" };
    } catch (err) {
      errors.push(`SharePoint: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (process.env.CLOUDCONVERT_API_KEY?.trim()) {
    try {
      return { buffer: await convertWithCloudConvert(pptx), engine: "cloudconvert" };
    } catch (err) {
      errors.push(`CloudConvert: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (process.env.GOTENBERG_URL) {
    try {
      return { buffer: await convertWithGotenberg(pptx), engine: "gotenberg" };
    } catch (err) {
      errors.push(`Gotenberg: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  try {
    return { buffer: await convertWithLibreOffice(pptx), engine: "libreoffice" };
  } catch (libreErr) {
    const msg = libreErr instanceof Error ? libreErr.message : String(libreErr);
    const hint =
      configured && mock
        ? "On Hostinger: set MOCK_ONEDRIVE=false and ensure Azure Graph credentials are valid (SharePoint converts PPTX→PDF)."
        : "Set MOCK_ONEDRIVE=false for SharePoint PDF, or CLOUDCONVERT_API_KEY, or install LibreOffice locally.";
    throw new Error(`${msg}. ${hint}${errors.length ? ` Also tried: ${errors.join("; ")}` : ""}`);
  }
}

export async function pdfEngineAvailable(projectCode?: string): Promise<boolean> {
  if (process.env.WPR_PDF_DISABLED === "1") return false;
  const { configured, mock } = graphConfig();
  if (configured && !mock && projectCode) return true;
  if (process.env.CLOUDCONVERT_API_KEY?.trim()) return true;
  if (process.env.GOTENBERG_URL) return true;
  for (const bin of sofficeCandidates()) {
    try {
      await execFileAsync(bin, ["--version"], { timeout: 5000 });
      return true;
    } catch {
      /* try next */
    }
  }
  return false;
}

export function pdfEngineHint(): string {
  const { configured, mock } = graphConfig();
  if (configured && !mock) return "sharepoint";
  if (process.env.CLOUDCONVERT_API_KEY?.trim()) return "cloudconvert";
  if (process.env.GOTENBERG_URL) return "gotenberg";
  return "none";
}
