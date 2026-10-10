import { useState } from "react";
import { api } from "../api";
import { Button } from "./ui";
import { downloadAuthFile } from "../lib/downloadReport";

type Sheet = { key: string; title: string; hint: string; kind: "xlsx" | "pdf"; path: (id: string) => string; file: string };

export const DRAWING_SHEETS: Sheet[] = [
  { key: "master-x", title: "Master Drawing Register", hint: "Excel — every drawing submitted", kind: "xlsx", path: (id) => `/api/drawings/project/${id}/register/export.xlsx`, file: "Master-Drawing-Register.xlsx" },
  { key: "master-p", title: "Master Drawing Register", hint: "Branded PDF", kind: "pdf", path: (id) => `/api/drawings/project/${id}/register/master.pdf`, file: "Master-Drawing-Register.pdf" },
  { key: "gfc-x", title: "Approval & GFC Drawing Log", hint: "Excel — R0–Rn dates, area, TL", kind: "xlsx", path: (id) => `/api/drawings/project/${id}/gfc-log/export.xlsx`, file: "Approval-GFC-Drawing-Log.xlsx" },
  { key: "gfc-p", title: "Approval & GFC Drawing Log", hint: "Branded PDF", kind: "pdf", path: (id) => `/api/drawings/project/${id}/gfc-log/export.pdf`, file: "Approval-GFC-Drawing-Log.pdf" },
  { key: "dash-p", title: "Drawing register dashboard", hint: "PDF — location, critical, delay, by organisation", kind: "pdf", path: (id) => `/api/drawings/project/${id}/register/dashboard.pdf`, file: "Drawing-Register-Dashboard.pdf" },
  { key: "rfi-x", title: "RFI register", hint: "Excel — SPDC_RFI_Form_and_Register format", kind: "xlsx", path: (id) => `/api/rfis/project/${id}/register.xlsx`, file: "RFI-Register.xlsx" },
];

/**
 * Sheet generation for the Drawings module — the same menu sits in every drawing tool:
 * any single sheet, the whole pack as one ZIP, or the whole set filed to SharePoint.
 */
export function DrawingPackMenu({
  projectId,
  token,
  onMsg,
  canPublish = false,
  panel = false,
}: {
  projectId: string;
  token: string | null;
  onMsg?: (m: string) => void;
  canPublish?: boolean;
  /** Show the sheets as an always-open panel (settings page) instead of a drop-down. */
  panel?: boolean;
}) {
  const [busy, setBusy] = useState("");
  const say = (m: string) => onMsg?.(m);

  async function one(sh: Sheet) {
    setBusy(sh.key);
    try {
      await downloadAuthFile(sh.path(projectId), token, sh.file);
      say(`${sh.title} (${sh.kind.toUpperCase()}) downloaded.`);
    } catch (err) {
      say(err instanceof Error ? err.message : `Could not generate ${sh.title}`);
    } finally {
      setBusy("");
    }
  }
  async function pack() {
    setBusy("pack");
    say("Generating the whole drawing pack…");
    try {
      await downloadAuthFile(`/api/drawings/project/${projectId}/pack.zip`, token, "Drawing-Pack.zip");
      say("Drawing pack downloaded — master register, GFC log, RFI register and dashboard.");
    } catch (err) {
      say(err instanceof Error ? err.message : "Could not generate the pack");
    } finally {
      setBusy("");
    }
  }
  async function publish() {
    setBusy("sync");
    say("Generating the registers and saving them to SharePoint…");
    try {
      await api(`/api/drawings/project/${projectId}/publish-registers`, { method: "POST", token, timeoutMs: 180_000 });
      say("Registers generated and saved to the project's SharePoint folders.");
    } catch (err) {
      say(err instanceof Error ? err.message : "Could not save to SharePoint");
    } finally {
      setBusy("");
    }
  }

  const body = (
    <div className={panel ? "space-y-3" : "space-y-1"}>
      <div className={panel ? "flex flex-wrap gap-2" : "space-y-1"}>
        <Button type="button" className={panel ? "" : "w-full !justify-start !text-sm !py-2"} disabled={Boolean(busy)} onClick={() => void pack()}>
          {busy === "pack" ? "Generating pack…" : "Download the whole pack (ZIP)"}
        </Button>
        {canPublish ? (
          <Button type="button" variant="secondary" className={panel ? "" : "w-full !justify-start !text-sm !py-2"} disabled={Boolean(busy)} onClick={() => void publish()}>
            {busy === "sync" ? "Saving…" : "Save the set to SharePoint"}
          </Button>
        ) : null}
      </div>
      <div className={panel ? "grid sm:grid-cols-2 lg:grid-cols-3 gap-2" : "space-y-0.5 border-t border-line pt-1"}>
        {DRAWING_SHEETS.map((sh) =>
          panel ? (
            <div key={sh.key} className="rounded-lg border border-line bg-white px-3 py-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{sh.title}</div>
                <div className="text-[11px] text-steel-muted truncate">{sh.hint}</div>
              </div>
              <Button type="button" variant="secondary" className="!py-1 !text-xs shrink-0" disabled={Boolean(busy)} onClick={() => void one(sh)}>
                {busy === sh.key ? "…" : sh.kind.toUpperCase()}
              </Button>
            </div>
          ) : (
            <button
              key={sh.key}
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void one(sh)}
              className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-sand/60 disabled:opacity-50"
            >
              <span className="truncate">{sh.title}</span>
              <span className="shrink-0 font-mono text-[10px] text-steel-muted">{busy === sh.key ? "…" : sh.kind.toUpperCase()}</span>
            </button>
          ),
        )}
      </div>
    </div>
  );

  if (panel) return body;
  return (
    <details className="relative shrink-0">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-ink hover:bg-sand/60">Sheets &amp; pack ▾</span>
      </summary>
      <div className="absolute right-0 top-full z-30 mt-1 w-72 rounded-lg border border-line bg-paper shadow-lg p-2">{body}</div>
    </details>
  );
}
