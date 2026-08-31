import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card } from "../components/ui";
import { FilePickButton } from "../components/FilePickButton";
import { CrmComparativeRegister } from "../components/CrmComparativeRegister";
import { CrmBidBoqRegister } from "../components/CrmBidBoqRegister";
import { downloadAuthFile } from "../lib/downloadReport";

type BidSlot = {
  id: string;
  bidPackageId: string;
  bidPackageTitle: string;
  bidPackageStatus: string;
  revisionLabel: string;
  projectNote?: string | null;
  projectId?: string | null;
  projectCode?: string | null;
  projectName?: string | null;
  comparativeSharePointUrl?: string | null;
  summarySheetId?: string | null;
  comparativeSheetId?: string | null;
  vendorLabel: string;
  discipline: string;
  disciplineLabel: string;
  fileName?: string | null;
  uploadedAt?: string | null;
  sharePointUrl?: string | null;
  sheetId?: string | null;
};

type PackageSummary = {
  id: string;
  title: string;
  myVendorLabel?: string | null;
  summary?: {
    vendorLabels: string[];
    sectionTotals: { section: string; title: string; totals: Record<string, number> }[];
    grandTotals: Record<string, number>;
    lowestVendor?: string;
  } | null;
  summarySheetId?: string | null;
  comparativeSheetId?: string | null;
  comparativeSharePointUrl?: string | null;
  uploadProgress?: { done: number; total: number };
};

type ProjectGroup = {
  key: string;
  projectCode: string | null;
  projectName: string | null;
  packages: Record<string, BidSlot[]>;
};

function VendorPackageCard({
  pkgId,
  pkgSlots,
  summary,
  highlighted,
  onUpload,
}: {
  pkgId: string;
  pkgSlots: BidSlot[];
  summary?: PackageSummary;
  highlighted?: boolean;
  onUpload: (slot: BidSlot) => void;
}) {
  const head = pkgSlots[0];
  const done = pkgSlots.filter((s) => s.fileName || s.uploadedAt).length;

  return (
    <Card className={highlighted ? "ring-2 ring-brand" : undefined}>
      <div className="mb-3">
        <h3 className="font-semibold">{head?.bidPackageTitle}</h3>
        <p className="text-xs text-steel-muted mt-0.5">
          {head?.revisionLabel} · <Badge>{head?.bidPackageStatus}</Badge>
          <span className="ml-2">
            Your BOQs {done}/{pkgSlots.length}
          </span>
          {summary?.myVendorLabel && (
            <span className="ml-2 font-mono">· {summary.myVendorLabel}</span>
          )}
        </p>
        <div className="flex flex-wrap gap-3 mt-1">
          {head?.comparativeSharePointUrl && (
            <a
              href={head.comparativeSharePointUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-brand font-semibold"
            >
              Comparative Statement R2 (SharePoint) →
            </a>
          )}
        </div>
        {head?.projectNote && <p className="text-[11px] text-steel-muted mt-1">{head.projectNote}</p>}
      </div>

      {summary?.summary?.grandTotals && Object.keys(summary.summary.grandTotals).length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-mono uppercase text-steel-muted mb-2">
            Comparative statement (R2 summary — all bidders)
          </h4>
          <CrmComparativeRegister summary={summary.summary} revisionLabel={head?.revisionLabel || "R2"} />
        </div>
      )}

      <h4 className="text-xs font-mono uppercase text-steel-muted mb-2">Your discipline BOQs (R2 sheets)</h4>
      <ul className="divide-y border border-line rounded-xl overflow-hidden">
        {pkgSlots.map((s) => (
          <li key={s.id} className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-sm bg-paper">
            <div className="min-w-0">
              <div className="font-medium">{s.disciplineLabel}</div>
              <div className="text-xs text-steel-muted">{s.fileName || "Not uploaded"}</div>
              {s.uploadedAt && (
                <div className="text-[10px] text-steel-muted">
                  {new Date(s.uploadedAt).toLocaleDateString("en-IN")}
                </div>
              )}
              {s.sharePointUrl && (
                <a
                  href={s.sharePointUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-brand font-semibold"
                >
                  Open in SharePoint
                </a>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              {s.sheetId ? (
                <Button type="button" variant="primary" className="!text-xs !py-1" onClick={() => onUpload(s)}>
                  {s.fileName ? "Edit BOQ" : "Fill BOQ online"}
                </Button>
              ) : null}
              <Button type="button" variant="secondary" className="!text-xs !py-1" onClick={() => onUpload(s)}>
                Upload Excel
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function CrmVendorBidsPage() {
  const { token, user } = useAuth();
  const [searchParams] = useSearchParams();
  const focusPkgId = searchParams.get("pkg") || "";
  const [slots, setSlots] = useState<BidSlot[]>([]);
  const [summaries, setSummaries] = useState<Record<string, PackageSummary>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadSlot, setUploadSlot] = useState<BidSlot | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    const rows = await api<BidSlot[]>("/api/crm/my-bid-slots", { token }).catch(() => []);
    setSlots(rows);

    const pkgIds = [...new Set(rows.map((r) => r.bidPackageId))];
    const loaded = await Promise.all(
      pkgIds.map((id) =>
        api<PackageSummary>(`/api/crm/my-bid-packages/${id}/summary`, { token }).catch(() => null)
      )
    );
    const map: Record<string, PackageSummary> = {};
    pkgIds.forEach((id, i) => {
      if (loaded[i]) map[id] = loaded[i]!;
    });
    setSummaries(map);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const byProject = useMemo(() => {
    const groups: ProjectGroup[] = [];
    const index = new Map<string, ProjectGroup>();

    for (const slot of slots) {
      const key = slot.projectId || slot.projectCode || "unlinked";
      let group = index.get(key);
      if (!group) {
        group = {
          key,
          projectCode: slot.projectCode || null,
          projectName: slot.projectName || null,
          packages: {},
        };
        index.set(key, group);
        groups.push(group);
      }
      (group.packages[slot.bidPackageId] ||= []).push(slot);
    }
    return groups;
  }, [slots]);

  async function uploadBoq(e: FormEvent) {
    e.preventDefault();
    if (!uploadFile || !uploadSlot) return;
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      await api(`/api/crm/bid-packages/${uploadSlot.bidPackageId}/vendor-boq/${uploadSlot.id}`, {
        method: "POST",
        token,
        body: fd,
      });
      setMsg(`Uploaded — ${uploadSlot.disciplineLabel}${uploadSlot.projectCode ? ` · ${uploadSlot.projectCode}` : ""}`);
      setUploadSlot(null);
      setUploadFile(null);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  if (user?.role !== "vendor") {
    return (
      <Card>
        <p className="text-sm text-steel-muted">
          Sign in via the <strong>Contractor</strong> portal to fill bid BOQs here.
        </p>
        <ul className="text-xs text-steel-muted mt-2 space-y-1">
          <li>
            <strong>vendor@sharnam.demo</strong> — M/s Bhavna Infra
          </li>
          <li>
            <strong>tcc@sharnam.demo</strong> — TCC Projects
          </li>
          <li>
            <strong>pearl@sharnam.demo</strong> — Pearl Electricals
          </li>
        </ul>
        <Link to="/login/vendor" className="text-sm text-brand font-semibold mt-2 inline-block">
          Contractor login →
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-4 flex flex-col flex-1 min-h-0">
      <div className="flex flex-wrap gap-2 shrink-0">
        <Button
          type="button"
          variant="secondary"
          onClick={() => void downloadAuthFile("/api/crm/template.xlsx", token, "Comparative-Statement-R2.xlsx")}
        >
          Download R2 .xlsx
        </Button>
      </div>

      {msg && <p className="text-sm text-ok">{msg}</p>}

      {!slots.length && (
        <Card>
          <p className="text-sm text-steel-muted">
            No bid slots yet. Office creates a package under{" "}
            <Link to="/crm/bids" className="text-brand font-semibold">
              Bid management
            </Link>
            .
          </p>
        </Card>
      )}

      {byProject.map((project) => (
        <div key={project.key} className="space-y-3">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="font-semibold text-base">
              {project.projectCode ? `${project.projectCode}` : "Unlinked project"}
            </h2>
            {project.projectName && <span className="text-sm text-steel-muted">{project.projectName}</span>}
          </div>

          {Object.entries(project.packages).map(([pkgId, pkgSlots]) => (
            <VendorPackageCard
              key={pkgId}
              pkgId={pkgId}
              pkgSlots={pkgSlots}
              summary={summaries[pkgId]}
              highlighted={focusPkgId === pkgId}
              onUpload={setUploadSlot}
            />
          ))}
        </div>
      ))}

      {uploadSlot && uploadSlot.sheetId && (
        <CrmBidBoqRegister
          token={token!}
          sheetId={uploadSlot.sheetId}
          bidPackageId={uploadSlot.bidPackageId}
          slotId={uploadSlot.id}
          title={`${uploadSlot.disciplineLabel}${uploadSlot.projectCode ? ` · ${uploadSlot.projectCode}` : ""}`}
          sheetLabel={uploadSlot.disciplineLabel}
          canEdit
          onSaved={() => void load()}
          onClose={() => setUploadSlot(null)}
        />
      )}

      {uploadSlot && (
        <Card>
          <h4 className="font-semibold text-sm mb-2">
            Upload Excel — {uploadSlot.disciplineLabel}
          </h4>
          <p className="text-xs text-steel-muted mb-3">
            Use the matching discipline sheet from Comparative Statement R2 (CCV, Admin, Security, …).
          </p>
          <form className="space-y-3" onSubmit={uploadBoq}>
            <FilePickButton accept=".xlsx,.xls,.csv" onPick={(files) => setUploadFile(files[0] || null)}>
              {uploadFile ? uploadFile.name : "Choose Excel from R2 workbook"}
            </FilePickButton>
            <div className="flex gap-2">
              <Button type="submit" disabled={!uploadFile || busy}>
                Upload
              </Button>
              <Button type="button" variant="secondary" onClick={() => setUploadSlot(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
