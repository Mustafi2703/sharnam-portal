import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, PageHeader } from "../components/ui";
import { FilePickButton } from "../components/FilePickButton";

type BidSlot = {
  id: string;
  bidPackageId: string;
  bidPackageTitle: string;
  bidPackageStatus: string;
  revisionLabel: string;
  projectNote?: string | null;
  vendorLabel: string;
  discipline: string;
  disciplineLabel: string;
  fileName?: string | null;
  uploadedAt?: string | null;
  sheetId?: string | null;
};

export default function CrmVendorBidsPage() {
  const { token, user } = useAuth();
  const [slots, setSlots] = useState<BidSlot[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadSlot, setUploadSlot] = useState<BidSlot | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    const rows = await api<BidSlot[]>("/api/crm/my-bid-slots", { token }).catch(() => []);
    setSlots(rows);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

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
      setMsg(`Uploaded — ${uploadSlot.disciplineLabel}`);
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
      <div className="space-y-4">
        <PageHeader eyebrow="CRM" title="Vendor bid uploads" subtitle="Contractors upload discipline BOQs here." />
        <Card>
          <p className="text-sm text-steel-muted">Sign in as a vendor user (e.g. vendor@sharnam.demo) to upload bids.</p>
          <Link to="/crm/bid-compare" className="text-sm text-brand font-semibold mt-2 inline-block">
            Office: open bid management →
          </Link>
        </Card>
      </div>
    );
  }

  const byPackage = slots.reduce<Record<string, BidSlot[]>>((acc, s) => {
    (acc[s.bidPackageId] ||= []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CRM · Vendor"
        title="My bid uploads"
        subtitle="Upload one Excel BOQ per discipline (CCV, Admin, Security, …) — same sheets as Comparative Statement R2."
      />

      {msg && <p className="text-sm text-ok">{msg}</p>}

      {!slots.length && (
        <Card>
          <p className="text-sm text-steel-muted">
            No bid slots assigned to your vendor account yet. Office links vendors when creating a bid package on{" "}
            <Link to="/crm/bid-compare" className="text-brand font-semibold">
              Bid management
            </Link>
            .
          </p>
        </Card>
      )}

      {Object.entries(byPackage).map(([pkgId, pkgSlots]) => (
        <Card key={pkgId}>
          <div className="mb-3">
            <h3 className="font-semibold">{pkgSlots[0]?.bidPackageTitle}</h3>
            <p className="text-xs text-steel-muted mt-0.5">
              {pkgSlots[0]?.revisionLabel} · <Badge>{pkgSlots[0]?.bidPackageStatus}</Badge>
            </p>
            {pkgSlots[0]?.projectNote && <p className="text-[11px] text-steel-muted mt-1">{pkgSlots[0].projectNote}</p>}
          </div>
          <ul className="divide-y border border-line rounded-xl overflow-hidden">
            {pkgSlots.map((s) => (
              <li key={s.id} className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-sm bg-paper">
                <div>
                  <div className="font-medium">{s.disciplineLabel}</div>
                  <div className="text-xs text-steel-muted">{s.fileName || "Not uploaded"}</div>
                </div>
                <Button type="button" variant="secondary" className="!text-xs !py-1" onClick={() => setUploadSlot(s)}>
                  {s.fileName ? "Replace BOQ" : "Upload BOQ"}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ))}

      {uploadSlot && (
        <Card>
          <h4 className="font-semibold text-sm mb-2">Upload {uploadSlot.disciplineLabel}</h4>
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
