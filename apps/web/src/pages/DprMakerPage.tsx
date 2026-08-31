import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api, apiBase } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, Select } from "../components/ui";
import { MakerToolHeader } from "../components/MakerToolHeader";
import { BarChart } from "../components/PieChart";
import { SharePointStatusBanner } from "../components/SharePointStatusBanner";
import { EvidencePanel } from "../components/EvidencePanel";
import { RegisterEntryModal } from "../components/RegisterEntryModal";
import { ReferenceSheetToolbar } from "../components/ReferenceSheetToolbar";
import { DailySheetWorkflow } from "../components/DailySheetWorkflow";

async function downloadWithAuth(url: string, token: string | null | undefined, filename: string) {
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

/**
 * DPR Maker — writes into the official SPDC discipline template.
 *
 *   1. Project header
 *   2. Quantity progress (BOQ items)
 *   3. Manpower deployed today
 *   4. Equipment deployed today
 *   5. Material at site
 *   6. Quality control & tests today
 *   7. HSE / safety statistics
 *   8. Delay / idle time log today
 *   9. Drawings / RFI / material approvals pending
 *  10. Issues & risks (open items)
 *  11. Today's highlights
 *  12. Next day plan
 *  13. Decisions required
 *  ─── Evidence & sign-off ───
 *  14. Site photos (phone camera / gallery)
 *  15. PDF attachments (RA bills, checklists, MoM)
 *  16. Signatures (site engineer / PMC / contractor)
 *
 * On publish the maker loads the SPDC discipline template XLSX
 * (apps/api/dpr-templates/SPDC_DPR_<DISCIPLINE>_DASHBOARD.xlsx),
 * pokes user data into its INPUT cells so the DASHBOARD sheet
 * recomputes with the real SPDC formulas, and uploads to
 * SharePoint under 07.02_Daily_Site_Records/<DISCIPLINE>/.
 */

const DISCIPLINES = [
  { key: "CIVIL", label: "Civil & Structural" },
  { key: "ELECTRICAL", label: "Electrical" },
  { key: "FIRE", label: "Fire Protection" },
  { key: "MECHANICAL", label: "Mechanical" },
  { key: "PEB_ERECTION", label: "PEB Erection" },
  { key: "PEB_SUPPLY", label: "PEB Supply" },
  { key: "PLUMBING", label: "Plumbing" },
];

type Header = {
  projectName?: string;
  projectManager?: string;
  contractor?: string;
  location?: string;
  contractRef?: string;
  contractCompletion?: string | null;
  calendarHours?: string;
  shiftHours?: number;
  weather?: string;
  reportDate?: string | null;
  dataDate?: string | null;
  reportNumber?: string;
  acCertifiedToDate?: number;
  cumManDaysPrev?: number;
  cumSafeManHoursPrev?: number;
  dateOfLastLti?: string | null;
  preparedBy?: string;
};

type Line = {
  srNo?: number;
  group?: string;
  description: string;
  unit?: string;
  scopeQty?: number;
  rate?: number;
  start?: string | null;
  finish?: string | null;
  cumQtyPrev?: number;
  qtyToday?: number;
  remarks?: string;
};

type Manpower = { trade: string; planned?: number; actual?: number; hoursWorked?: number };
type Equipment = { name: string; qty?: number; workedHrs?: number; idleHrs?: number };
type Material = { name: string; unit?: string; opening?: number; received?: number; consumed?: number };
type QualityTest = { parameter: string; figure?: string };
type SafetyRow = { parameter: string; figure?: string };
type Safety = {
  safeManHoursToday?: number;
  safeManDaysToday?: number;
  toolboxTalks?: number;
  ppeCompliancePct?: number;
  nearMiss?: number;
  firstAid?: number;
  ltis?: number;
  incidents?: number;
};
type Delay = { cause: string; category?: string; from?: string; to?: string; hoursLost?: number; eot?: "Yes" | "No" | "Review" };
type Approval = { refNo: string; description?: string; raisedOn?: string | null; pendingWith?: string };
type Issue = { description: string; severity?: "Critical" | "High" | "Medium" | "Low"; owner?: string };
type Photo = { path: string; caption?: string; takenAt?: string | null; kind?: "photo" | "signature" | "pdf" };

type Snap = {
  projectId: string;
  projectCode: string;
  logDate: string;
  discipline: string;
  header: Header;
  lines: Line[];
  manpower: Manpower[];
  equipment: Equipment[];
  materials: Material[];
  qualityTests: QualityTest[];
  safetyRows: SafetyRow[];
  safety: Safety;
  delays: Delay[];
  approvals: Approval[];
  issues: Issue[];
  highlights: string[];
  nextDayPlan: string[];
  decisions: string[];
  photos: Photo[];
  attachments: Photo[];
  signatures: Photo[];
  status: string;
  publishedPath?: string | null;
  publishedAt?: string | null;
  autoFillSources?: string[];
  charts?: {
    summary: {
      plannedPct: number;
      actualPct: number;
      variance: number;
      spi: number;
      overallStatus: string;
    };
    scurve: { label: string; planned: number; actual: number }[];
    boqProgress: { label: string; planned: number; actual: number }[];
    manpower: { label: string; planned: number; actual: number }[];
  };
};

function toDateInput(v: string | null | undefined): string {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

/** Delay log uses HH:mm — strip legacy ISO dates auto-filled from hindrance register. */
function toTimeInput(v: string | null | undefined): string {
  if (!v) return "";
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(v)) return v.slice(0, 5);
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return "";
  return v;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function planPct(dataDate: string | null | undefined, start: string | null | undefined, finish: string | null | undefined): number {
  const d = dataDate ? new Date(dataDate) : null;
  const s = start ? new Date(start) : null;
  const f = finish ? new Date(finish) : null;
  if (!d || !s || !f) return 0;
  if (d >= f) return 1;
  if (d < s) return 0;
  const total = f.getTime() - s.getTime();
  if (total <= 0) return 1;
  return Math.max(0, Math.min(1, (d.getTime() - s.getTime()) / total));
}

function buildSavePayload(snap: Snap, logDate: string, discipline: string) {
  return {
    logDate,
    discipline,
    header: snap.header,
    lines: snap.lines,
    manpower: snap.manpower,
    equipment: snap.equipment,
    materials: snap.materials,
    qualityTests: snap.qualityTests,
    safetyRows: snap.safetyRows,
    safety: snap.safety,
    delays: snap.delays,
    approvals: snap.approvals,
    issues: snap.issues,
    highlights: snap.highlights,
    nextDayPlan: snap.nextDayPlan,
    decisions: snap.decisions,
    photos: snap.photos,
    attachments: snap.attachments,
    signatures: snap.signatures,
  };
}

export default function DprMakerPage() {
  const { id: projectId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const { token, user } = useAuth();
  const canSeedDemo = user?.role === "admin" || user?.role === "office";
  const [logDate, setLogDate] = useState<string>(
    () => searchParams.get("date") || new Date().toISOString().slice(0, 10)
  );
  const [discipline, setDiscipline] = useState<string>("CIVIL");
  const [snap, setSnap] = useState<Snap | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [recent, setRecent] = useState<any[]>([]);
  const [lineModalOpen, setLineModalOpen] = useState(false);
  const [manpowerModalOpen, setManpowerModalOpen] = useState(false);
  const [lineDraft, setLineDraft] = useState<Line>({
    description: "",
    unit: "CUM",
    scopeQty: 0,
    rate: 0,
    cumQtyPrev: 0,
    qtyToday: 0,
  });
  const [manpowerDraft, setManpowerDraft] = useState<Manpower>({
    trade: "",
    planned: 0,
    actual: 0,
    hoursWorked: 8,
  });
  const load = useCallback(async () => {
    if (!projectId) return;
    setBusy(true);
    setMsg("");
    try {
      const s = await api<Snap>(`/api/dpr-maker/${projectId}?date=${logDate}&discipline=${discipline}`, { token });
      setSnap(s);
      const r = await api<any[]>(`/api/dpr-maker/${projectId}/recent`, { token }).catch(() => []);
      setRecent(r);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Load failed");
    } finally {
      setBusy(false);
    }
  }, [projectId, logDate, discipline, token]);

  useEffect(() => {
    const d = searchParams.get("date");
    if (d) setLogDate(d);
  }, [searchParams]);

  useEffect(() => {
    void load();
  }, [load]);

  const computed = useMemo(() => {
    if (!snap) return null;
    const totalValue = snap.lines.reduce((s, l) => s + num(l.scopeQty) * num(l.rate), 0) || 1;
    const rows = snap.lines.map((l) => {
      const weight = (num(l.scopeQty) * num(l.rate)) / totalValue;
      const cumPrev = num(l.cumQtyPrev);
      const today = num(l.qtyToday);
      const scope = num(l.scopeQty);
      const cum = Math.min(scope, cumPrev + today);
      const pctComplete = scope > 0 ? Math.min(1, cum / scope) : 0;
      const planned = planPct(snap.header.dataDate, l.start ?? null, l.finish ?? null);
      const earnedToday = today * num(l.rate);
      return { weight, cum, pctComplete, planned, earnedToday, balance: Math.max(0, scope - cum) };
    });
    const plannedPct = rows.reduce((s, r) => s + r.weight * r.planned, 0);
    const actualPct = rows.reduce((s, r) => s + r.weight * r.pctComplete, 0);
    const shiftHrs = num(snap.header.shiftHours) || 8;
    const manDaysToday = snap.manpower.reduce(
      (s, m) => s + (num(m.actual) * num(m.hoursWorked || shiftHrs)) / shiftHrs,
      0
    );
    const hoursLostToday = snap.delays.reduce((s, d) => s + num(d.hoursLost), 0);
    return {
      rows,
      plannedPct,
      actualPct,
      variance: actualPct - plannedPct,
      spi: plannedPct > 0 ? actualPct / plannedPct : 0,
      earnedValueLakh: (rows.reduce((s, r) => s + r.weight * r.pctComplete, 0) * totalValue) / 100000,
      valueDoneTodayInr: rows.reduce((s, r) => s + r.earnedToday, 0),
      itemsDelayed: rows.filter((r) => r.pctComplete < r.planned && r.pctComplete < 1).length,
      contractValueLakh: totalValue / 100000,
      manDaysToday,
      hoursLostToday,
    };
  }, [snap]);

  /** API charts with client-side fallback so dashboard always renders. */
  const displayCharts = useMemo(() => {
    if (!snap || !computed) return null;
    const api = snap.charts;
    const boqProgress =
      api?.boqProgress?.length
        ? api.boqProgress
        : snap.lines
            .filter((l) => l.description && num(l.scopeQty) > 0)
            .slice(0, 10)
            .map((l, i) => ({
              label: l.description.slice(0, 36),
              planned: Math.round((computed.rows[i]?.planned ?? 0) * 1000) / 10,
              actual: Math.round((computed.rows[i]?.pctComplete ?? 0) * 1000) / 10,
            }));

    const manpower =
      api?.manpower?.length
        ? api.manpower
        : snap.manpower
            .filter((m) => m.trade && (m.planned || m.actual))
            .slice(0, 8)
            .map((m) => ({
              label: m.trade.slice(0, 24),
              planned: num(m.planned),
              actual: num(m.actual),
            }));

    const scurve =
      api?.scurve?.length
        ? api.scurve
        : [
            {
              date: logDate,
              label: new Date(logDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
              planned: Math.round(computed.plannedPct * 1000) / 10,
              actual: Math.round(computed.actualPct * 1000) / 10,
            },
          ];

    return {
      summary: api?.summary ?? {
        plannedPct: Math.round(computed.plannedPct * 1000) / 10,
        actualPct: Math.round(computed.actualPct * 1000) / 10,
        variance: Math.round(computed.variance * 1000) / 10,
        spi: Math.round(computed.spi * 100) / 100,
        overallStatus: computed.actualPct >= computed.plannedPct ? "On programme" : "Behind",
      },
      scurve,
      boqProgress,
      manpower,
    };
  }, [snap, computed, logDate]);

  function updateHeader<K extends keyof Header>(k: K, v: Header[K]) {
    if (!snap) return;
    setSnap({ ...snap, header: { ...snap.header, [k]: v } });
  }
  function updateLine(idx: number, patch: Partial<Line>) {
    if (!snap) return;
    const lines = snap.lines.slice();
    lines[idx] = { ...lines[idx], ...patch };
    setSnap({ ...snap, lines });
  }
  function addLine() {
    setLineDraft({ description: "", unit: "CUM", scopeQty: 0, rate: 0, cumQtyPrev: 0, qtyToday: 0, group: "" });
    setLineModalOpen(true);
  }
  function commitLineFromModal() {
    if (!snap) return;
    setSnap({ ...snap, lines: [...snap.lines, { ...lineDraft }] });
    setLineModalOpen(false);
  }
  function removeLine(idx: number) {
    if (!snap) return;
    setSnap({ ...snap, lines: snap.lines.filter((_, i) => i !== idx) });
  }

  function updateManpower(i: number, patch: Partial<Manpower>) {
    if (!snap) return;
    const arr = snap.manpower.slice();
    arr[i] = { ...arr[i], ...patch };
    setSnap({ ...snap, manpower: arr });
  }
  function addManpower() {
    setManpowerDraft({ trade: "", planned: 0, actual: 0, hoursWorked: 8 });
    setManpowerModalOpen(true);
  }
  function commitManpowerFromModal() {
    if (!snap) return;
    setSnap({ ...snap, manpower: [...snap.manpower, { ...manpowerDraft }] });
    setManpowerModalOpen(false);
  }
  function removeManpower(i: number) {
    if (!snap) return;
    setSnap({ ...snap, manpower: snap.manpower.filter((_, k) => k !== i) });
  }

  function updateEquip(i: number, patch: Partial<Equipment>) {
    if (!snap) return;
    const arr = snap.equipment.slice();
    arr[i] = { ...arr[i], ...patch };
    setSnap({ ...snap, equipment: arr });
  }
  function addEquip() {
    if (!snap) return;
    setSnap({ ...snap, equipment: [...snap.equipment, { name: "", qty: 0, workedHrs: 0, idleHrs: 0 }] });
  }
  function removeEquip(i: number) {
    if (!snap) return;
    setSnap({ ...snap, equipment: snap.equipment.filter((_, k) => k !== i) });
  }

  function updateMat(i: number, patch: Partial<Material>) {
    if (!snap) return;
    const arr = snap.materials.slice();
    arr[i] = { ...arr[i], ...patch };
    setSnap({ ...snap, materials: arr });
  }
  function addMat() {
    if (!snap) return;
    setSnap({ ...snap, materials: [...snap.materials, { name: "", unit: "BAGS", opening: 0, received: 0, consumed: 0 }] });
  }
  function removeMat(i: number) {
    if (!snap) return;
    setSnap({ ...snap, materials: snap.materials.filter((_, k) => k !== i) });
  }

  function updateDelay(i: number, patch: Partial<Delay>) {
    if (!snap) return;
    const arr = snap.delays.slice();
    arr[i] = { ...arr[i], ...patch };
    setSnap({ ...snap, delays: arr });
  }
  function addDelay() {
    if (!snap) return;
    setSnap({ ...snap, delays: [...snap.delays, { cause: "", from: "", to: "", hoursLost: 0, eot: "No" }] });
  }
  function removeDelay(i: number) {
    if (!snap) return;
    setSnap({ ...snap, delays: snap.delays.filter((_, k) => k !== i) });
  }

  function removePhoto(i: number) {
    if (!snap) return;
    setSnap({ ...snap, photos: snap.photos.filter((_, k) => k !== i) });
  }
  function removeAttachment(i: number) {
    if (!snap) return;
    setSnap({ ...snap, attachments: snap.attachments.filter((_, k) => k !== i) });
  }
  function removeSignature(i: number) {
    if (!snap) return;
    setSnap({ ...snap, signatures: snap.signatures.filter((_, k) => k !== i) });
  }

  async function uploadPhotosBatch(files: File[], cap: string) {
    if (!snap) return;
    setBusy(true);
    setMsg("");
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("photo", file);
        fd.append("caption", cap);
        fd.append("logDate", logDate);
        fd.append("discipline", discipline);
        const out = await api<{ photo: Photo }>(`/api/dpr-maker/${projectId}/photo`, {
          method: "POST",
          token,
          body: fd,
        });
        setSnap((prev) => (prev ? { ...prev, photos: [...prev.photos, out.photo] } : prev));
      }
      setMsg(`Uploaded ${files.length} photo(s) to SharePoint`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Photo upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadAttachmentFile(file: File) {
    if (!snap) return;
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("caption", file.name);
      fd.append("logDate", logDate);
      fd.append("discipline", discipline);
      const out = await api<{ attachment: Photo }>(`/api/dpr-maker/${projectId}/attachment`, {
        method: "POST",
        token,
        body: fd,
      });
      setSnap((prev) => (prev ? { ...prev, attachments: [...prev.attachments, out.attachment] } : prev));
      setMsg(`Attachment uploaded → ${out.attachment.path}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Attachment upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadSignatureFile(file: File, role: string) {
    if (!snap) return;
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("signature", file);
      fd.append("logDate", logDate);
      fd.append("discipline", discipline);
      fd.append("role", role);
      const out = await api<{ signature: Photo }>(`/api/dpr-maker/${projectId}/signature`, {
        method: "POST",
        token,
        body: fd,
      });
      setSnap((prev) => (prev ? { ...prev, signatures: [...prev.signatures, out.signature] } : prev));
      setMsg(`Signature saved · ${role} → ${out.signature.path}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Signature save failed");
    } finally {
      setBusy(false);
    }
  }

  function updateQualityTest(i: number, patch: Partial<QualityTest>) {
    if (!snap) return;
    const arr = snap.qualityTests.slice();
    arr[i] = { ...arr[i], ...patch };
    setSnap({ ...snap, qualityTests: arr });
  }
  function updateSafetyRow(i: number, patch: Partial<SafetyRow>) {
    if (!snap) return;
    const arr = snap.safetyRows.slice();
    arr[i] = { ...arr[i], ...patch };
    setSnap({ ...snap, safetyRows: arr });
  }
  function updateApproval(i: number, patch: Partial<Approval>) {
    if (!snap) return;
    const arr = snap.approvals.slice();
    arr[i] = { ...arr[i], ...patch };
    setSnap({ ...snap, approvals: arr });
  }
  function addApproval() {
    if (!snap) return;
    setSnap({ ...snap, approvals: [...snap.approvals, { refNo: "", description: "", pendingWith: "" }] });
  }
  function removeApproval(i: number) {
    if (!snap) return;
    setSnap({ ...snap, approvals: snap.approvals.filter((_, k) => k !== i) });
  }
  function updateIssue(i: number, patch: Partial<Issue>) {
    if (!snap) return;
    const arr = snap.issues.slice();
    arr[i] = { ...arr[i], ...patch };
    setSnap({ ...snap, issues: arr });
  }
  function addIssue() {
    if (!snap) return;
    setSnap({ ...snap, issues: [...snap.issues, { description: "", severity: "Medium", owner: "" }] });
  }
  function removeIssue(i: number) {
    if (!snap) return;
    setSnap({ ...snap, issues: snap.issues.filter((_, k) => k !== i) });
  }

  function updateNarrativeList(k: "highlights" | "nextDayPlan" | "decisions", i: number, val: string) {
    if (!snap) return;
    const arr = (snap[k] as string[]).slice();
    arr[i] = val;
    setSnap({ ...snap, [k]: arr } as Snap);
  }
  function addNarrativeItem(k: "highlights" | "nextDayPlan" | "decisions") {
    if (!snap) return;
    const arr = [...(snap[k] as string[]), ""];
    setSnap({ ...snap, [k]: arr } as Snap);
  }
  function removeNarrativeItem(k: "highlights" | "nextDayPlan" | "decisions", i: number) {
    if (!snap) return;
    const arr = (snap[k] as string[]).filter((_, kk) => kk !== i);
    setSnap({ ...snap, [k]: arr } as Snap);
  }

  async function save() {
    if (!snap) return;
    setBusy(true);
    setMsg("");
    try {
      await api(`/api/dpr-maker/${projectId}/save`, {
        method: "POST",
        token,
        body: JSON.stringify(buildSavePayload(snap, logDate, discipline)),
      });
      setMsg("Saved draft.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!snap) return;
    setBusy(true);
    setMsg("");
    try {
      await api(`/api/dpr-maker/${projectId}/save`, {
        method: "POST",
        token,
        body: JSON.stringify(buildSavePayload(snap, logDate, discipline)),
      });
      const out = await api<any>(`/api/dpr-maker/${projectId}/publish`, {
        method: "POST",
        token,
        body: JSON.stringify({ logDate, discipline }),
      });
      setMsg(`Published → ${out.publishedPath || out.url || "OneDrive/SharePoint"}${out.provider ? ` · ${out.provider}` : ""}${out.provider === "mock-onedrive" ? " (SharePoint not live — check server env)" : ""}`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  async function downloadXlsx() {
    if (!snap) return;
    const url = `${apiBase()}/api/dpr-maker/${projectId}/download.xlsx?date=${logDate}&discipline=${discipline}`;
    const fname = `DPR-${snap.projectCode}-${discipline}-${logDate}.xlsx`;
    setBusy(true);
    try {
      await downloadWithAuth(url, token, fname);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusy(false);
    }
  }

  async function downloadPdf() {
    if (!snap) return;
    const url = `${apiBase()}/api/dpr-maker/${projectId}/download.html?date=${logDate}&discipline=${discipline}`;
    const fname = `DPR-${snap.projectCode}-${discipline}-${logDate}.html`;
    setBusy(true);
    try {
      await downloadWithAuth(url, token, fname);
      setMsg("PDF pack downloaded — open the HTML file and use Print → Save as PDF (Sharnam logo included).");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusy(false);
    }
  }

  async function seedDemoDay() {
    if (!projectId || !canSeedDemo) return;
    setBusy(true);
    setMsg("");
    try {
      const out = await api<{
        logDate: string;
        disciplines: { discipline: string; qtyToday: number; signatures: number }[];
      }>(`/api/dpr-maker/${projectId}/seed-demo-day`, {
        method: "POST",
        token,
        body: JSON.stringify({ logDate }),
      });
      setMsg(
        `Demo day ready — ${out.disciplines.length} published DPRs on ${out.logDate} (qty + signatures + XLSX/PDF on disk). Pick any discipline to screenshot.`
      );
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Demo seed failed");
    } finally {
      setBusy(false);
    }
  }

  if (!snap) {
    return (
      <div className="maker-shell dpr-maker page-stack--register flex flex-col flex-1 min-h-0 overflow-hidden gap-0 pb-0 safe-bottom">
        <div className="maker-shell__chrome shrink-0 pb-2 border-b border-line/80 bg-sand/30">
          <MakerToolHeader eyebrow="DPR Maker" title="Daily Progress Report" description="Loading report…" busy />
        </div>
        <div className="maker-shell__form flex items-center justify-center">
          <p className="text-sm text-steel-muted">Loading…</p>
        </div>
      </div>
    );
  }

  const h = snap.header;
  return (
    <div className="maker-shell dpr-maker page-stack--register flex flex-col flex-1 min-h-0 overflow-hidden gap-0 pb-0 safe-bottom">
      <div className="maker-shell__chrome shrink-0 space-y-2 pb-2 border-b border-line/80 bg-sand/30">
      <MakerToolHeader
        eyebrow="DPR Maker · SPDC template"
        title="Daily Progress Report"
        meta={DISCIPLINES.find((d) => d.key === discipline)?.label || discipline}
        description="Header, quantities, manpower, equipment, material, quality, HSE, delays, photos, and sign-off. Publishes SPDC XLSX to SharePoint."
        busy={busy}
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <Badge tone={snap.status === "Published" ? "ok" : "warn"}>{snap.status}</Badge>
            <button className="text-sm font-semibold text-brand underline" onClick={downloadXlsx} disabled={busy}>Download XLSX</button>
            <button className="text-sm font-semibold text-brand underline" onClick={downloadPdf} disabled={busy}>Download PDF</button>
          </div>
        }
      />

      {snap.autoFillSources?.length ? (
        <p className="text-sm text-steel-muted mx-1 px-3 py-2 rounded-lg bg-paper border border-line">
          Auto-filled from: {snap.autoFillSources.join(" · ")}. Update Cost, Quality, Safety, and Progress daily — then re-open this date to refresh.
        </p>
      ) : null}
      {projectId && <DailySheetWorkflow projectId={projectId} compact />}

      <ReferenceSheetToolbar
        sheetLabel={`SPDC_DPR_${discipline}_DASHBOARD`}
        rowCount={snap.lines.length}
        canEdit
        onAddRow={() => setLineModalOpen(true)}
        onGenerate={() => void publish()}
        generateLabel="Publish DPR"
        onDownloadXlsx={() => void downloadXlsx()}
        busy={busy}
        message={msg}
      />

      <div className="maker-section">
        <div className="maker-toolbar">
          <div className="maker-toolbar__field">
            <label>Log date</label>
            <Input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} />
          </div>
          <div className="maker-toolbar__field">
            <label>Discipline</label>
            <Select value={discipline} onChange={(e) => setDiscipline(e.target.value)}>
              {DISCIPLINES.map((d) => (
                <option key={d.key} value={d.key}>{d.label}</option>
              ))}
            </Select>
          </div>
          <div className="maker-toolbar__actions">
            {canSeedDemo && (
              <Button onClick={seedDemoDay} disabled={busy} variant="secondary" title="Publish all 7 disciplines with demo qty and signatures">
                Prepare demo day (all 7)
              </Button>
            )}
            <Button onClick={save} disabled={busy}>Save draft</Button>
          </div>
        </div>
        {msg && <p className="maker-flash maker-flash--ok mx-4 mb-4">{msg}</p>}
        <div className="px-4 pb-4">
          <SharePointStatusBanner />
        </div>
      </div>
      </div>

      <div className="maker-shell__form flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-4 scrollbars-visible px-0.5 py-3">

      {/* 1. Header */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="maker-section">
          <div className="maker-section__head">1. Project header</div>
          <div className="maker-section__body grid sm:grid-cols-2 gap-2">
            <Input placeholder="Project name" value={h.projectName || ""} onChange={(e) => updateHeader("projectName", e.target.value)} />
            <Input placeholder="Project manager" value={h.projectManager || ""} onChange={(e) => updateHeader("projectManager", e.target.value)} />
            <Input placeholder="Contractor / vendor" value={h.contractor || ""} onChange={(e) => updateHeader("contractor", e.target.value)} />
            <Input placeholder="Location" value={h.location || ""} onChange={(e) => updateHeader("location", e.target.value)} />
            <Input placeholder="Contract / PO ref" value={h.contractRef || ""} onChange={(e) => updateHeader("contractRef", e.target.value)} />
            <label className="text-xs text-steel-muted">
              Contract completion
              <Input type="date" value={toDateInput(h.contractCompletion)} onChange={(e) => updateHeader("contractCompletion", e.target.value)} />
            </label>
            <Input placeholder="Calendar hours" value={h.calendarHours || ""} onChange={(e) => updateHeader("calendarHours", e.target.value)} />
            <Input placeholder="Shift hours" type="number" value={h.shiftHours ?? 8} onChange={(e) => updateHeader("shiftHours", Number(e.target.value))} />
            <Input placeholder="Weather" value={h.weather || ""} onChange={(e) => updateHeader("weather", e.target.value)} />
            <Input placeholder="Report number" value={h.reportNumber || ""} onChange={(e) => updateHeader("reportNumber", e.target.value)} />
          </div>
        </div>
        <div className="maker-section">
          <div className="maker-section__head">Report cut-off + safety history</div>
          <div className="maker-section__body grid sm:grid-cols-2 gap-2">
            <label className="text-xs text-steel-muted">Report date
              <Input type="date" value={toDateInput(h.reportDate)} onChange={(e) => updateHeader("reportDate", e.target.value)} />
            </label>
            <label className="text-xs text-steel-muted">Data date (cut-off)
              <Input type="date" value={toDateInput(h.dataDate)} onChange={(e) => updateHeader("dataDate", e.target.value)} />
            </label>
            <Input placeholder="AC certified to date (₹ Lakh)" type="number" value={h.acCertifiedToDate ?? 0} onChange={(e) => updateHeader("acCertifiedToDate", Number(e.target.value))} />
            <Input placeholder="Cum man-days upto prev." type="number" value={h.cumManDaysPrev ?? 0} onChange={(e) => updateHeader("cumManDaysPrev", Number(e.target.value))} />
            <Input placeholder="Cum safe man-hours upto prev." type="number" value={h.cumSafeManHoursPrev ?? 0} onChange={(e) => updateHeader("cumSafeManHoursPrev", Number(e.target.value))} />
            <label className="text-xs text-steel-muted">Date of last LTI
              <Input type="date" value={toDateInput(h.dateOfLastLti)} onChange={(e) => updateHeader("dateOfLastLti", e.target.value)} />
            </label>
            <Input placeholder="Prepared by" value={h.preparedBy || ""} onChange={(e) => updateHeader("preparedBy", e.target.value)} className="sm:col-span-2" />
          </div>
        </div>
      </div>

      {/* KPI band */}
      {computed && (
        <div className="maker-section">
          <div className="maker-section__head">Live KPIs</div>
          <div className="maker-section__body">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 text-sm">
            <KPI label="Planned %" value={(computed.plannedPct * 100).toFixed(1) + "%"} />
            <KPI label="Actual %" value={(computed.actualPct * 100).toFixed(1) + "%"} />
            <KPI label="Variance" value={(computed.variance * 100).toFixed(1) + "%"} tone={computed.variance >= 0 ? "ok" : "warn"} />
            <KPI label="SPI" value={computed.spi.toFixed(2)} tone={computed.spi >= 1 ? "ok" : "warn"} />
            <KPI label="Earned value ₹ L" value={computed.earnedValueLakh.toFixed(2)} />
            <KPI label="Man-days today" value={computed.manDaysToday.toFixed(1)} />
            <KPI label="Hrs lost today" value={computed.hoursLostToday.toFixed(1)} tone={computed.hoursLostToday > 0 ? "warn" : "ok"} />
          </div>
          <p className="text-xs text-steel-muted mt-2">Contract value ~ ₹ {computed.contractValueLakh.toFixed(2)} Lakh · Overall {computed.actualPct >= computed.plannedPct ? "ON PROGRAMME" : "BEHIND PROGRAMME"}.</p>
          </div>
        </div>
      )}

      {/* DPR DASHBOARD — mirrors Excel DASHBOARD sheet charts (BOQ, manpower, S-curve) */}
      {displayCharts ? (
        <div className="maker-section shrink-0">
          <div className="maker-section__head">DPR dashboard · matches Excel DASHBOARD sheet</div>
          <div className="maker-section__body grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
            <Card className="!p-4 lg:col-span-2 xl:col-span-1">
              <p className="text-[10px] uppercase font-semibold text-steel-muted mb-2">Planned vs actual progress</p>
              <DprScurveChart points={displayCharts.scurve} />
            </Card>
            {displayCharts.boqProgress.length > 0 ? (
              <BarChart
                title="BOQ progress today"
                items={displayCharts.boqProgress}
                valueKey="actual"
                compareKey="planned"
              />
            ) : (
              <Card className="!p-4 text-sm text-steel-muted">Add BOQ lines with scope qty to see progress bars.</Card>
            )}
            {displayCharts.manpower.length > 0 ? (
              <BarChart
                title="Manpower deployed today"
                items={displayCharts.manpower}
                valueKey="actual"
                compareKey="planned"
              />
            ) : (
              <Card className="!p-4 text-sm text-steel-muted">Fill manpower trades (planned / actual) for histogram.</Card>
            )}
          </div>
          <p className="text-xs text-steel-muted mt-2 px-4 pb-4">
            Charts feed the SPDC DASHBOARD sheet on XLSX publish · data also saved to DMS{" "}
            <code className="font-mono text-[10px]">07.02_Daily_Site_Records</code>.
          </p>
        </div>
      ) : null}

      {/* S-curve history register — mirrors Excel INPUT rows 125–137 / DASHBOARD chart */}
      {displayCharts && displayCharts.scurve.length > 0 && (
        <div className="maker-section">
          <div className="maker-section__head maker-section__head--row">
            <span>S-curve history register · planned vs actual %</span>
            <span className="maker-section__meta">Auto-calculated from BOQ lines + dates · written to XLSX on publish</span>
          </div>
          <div className="maker-table-wrap overflow-x-auto">
            <table className="maker-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Planned %</th>
                  <th>Actual %</th>
                  <th>Variance</th>
                </tr>
              </thead>
              <tbody>
                {displayCharts.scurve.map((p, i) => (
                  <tr key={`${p.label}-${i}`} className="border-t border-line">
                    <td className="p-2 text-sm font-medium">{p.label}</td>
                    <td className="p-2 text-sm tabular-nums">{p.planned}%</td>
                    <td className="p-2 text-sm tabular-nums">{p.actual}%</td>
                    <td className={`p-2 text-sm tabular-nums ${p.actual >= p.planned ? "text-ok" : "text-warn"}`}>
                      {(p.actual - p.planned).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Quantity */}
      <div className="maker-section maker-section--flush">
        <div className="maker-section__head maker-section__head--row shrink-0">
          <span>2. Quantity progress · BOQ item-wise</span>
          <Button variant="secondary" onClick={() => setLineModalOpen(true)}>+ Add item</Button>
        </div>
        <div className="maker-table-wrap overflow-x-auto">
          <table className="maker-table">
            <thead>
              <tr>
                <th>Sr</th>
                <th>Group</th>
                <th>Description</th>
                <th>Unit</th>
                <th>Scope</th>
                <th>Rate</th>
                <th>Start</th>
                <th>Finish</th>
                <th>Cum prev</th>
                <th>Qty today</th>
                <th>Cum</th>
                <th>%</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {snap.lines.map((l, i) => {
                const c = computed?.rows[i];
                return (
                  <tr key={i} className="border-t border-line">
                    <td className="p-1.5 text-xs">{i + 1}</td>
                    <td className="p-1"><Input value={l.group || ""} onChange={(e) => updateLine(i, { group: e.target.value })} className="max-w-[80px]" /></td>
                    <td className="p-1"><Input value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} /></td>
                    <td className="p-1"><Input value={l.unit || ""} onChange={(e) => updateLine(i, { unit: e.target.value })} className="max-w-[80px]" /></td>
                    <td className="p-1"><Input type="number" value={l.scopeQty ?? 0} onChange={(e) => updateLine(i, { scopeQty: Number(e.target.value) })} className="max-w-[110px]" /></td>
                    <td className="p-1"><Input type="number" value={l.rate ?? 0} onChange={(e) => updateLine(i, { rate: Number(e.target.value) })} className="max-w-[110px]" /></td>
                    <td className="p-1"><Input type="date" value={toDateInput(l.start)} onChange={(e) => updateLine(i, { start: e.target.value })} /></td>
                    <td className="p-1"><Input type="date" value={toDateInput(l.finish)} onChange={(e) => updateLine(i, { finish: e.target.value })} /></td>
                    <td className="p-1"><Input type="number" value={l.cumQtyPrev ?? 0} onChange={(e) => updateLine(i, { cumQtyPrev: Number(e.target.value) })} className="max-w-[110px]" /></td>
                    <td className="p-1"><Input type="number" value={l.qtyToday ?? 0} onChange={(e) => updateLine(i, { qtyToday: Number(e.target.value) })} className="max-w-[100px]" /></td>
                    <td className="p-1.5 text-xs tabular-nums">{(c?.cum ?? 0).toFixed(2)}</td>
                    <td className="p-1.5 text-xs tabular-nums">{c ? (c.pctComplete * 100).toFixed(1) + "%" : "—"}</td>
                    <td><button type="button" className="maker-table__remove-row" onClick={() => removeLine(i)} aria-label="Remove">✕</button></td>
                  </tr>
                );
              })}
              {!snap.lines.length && (
                <tr>
                  <td colSpan={13} className="p-6 text-center text-steel-muted text-sm">
                    No BOQ items yet. Click <b>+ Add item</b>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Manpower */}
      <div className="maker-section maker-section--flush">
        <div className="maker-section__head maker-section__head--row">
          <span>3. Manpower deployed today</span>
          <Button variant="secondary" onClick={addManpower}>+ Trade</Button>
        </div>
        <div className="maker-table-wrap">
          <table className="maker-table">
            <thead>
              <tr>
                <th>Sr</th>
                <th>Trade / category</th>
                <th>Planned nos</th>
                <th>Actual nos</th>
                <th>Hours</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {snap.manpower.map((m, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="p-1.5 text-xs">{i + 1}</td>
                  <td className="p-1"><Input value={m.trade} onChange={(e) => updateManpower(i, { trade: e.target.value })} /></td>
                  <td className="p-1"><Input type="number" value={m.planned ?? 0} onChange={(e) => updateManpower(i, { planned: Number(e.target.value) })} className="max-w-[110px]" /></td>
                  <td className="p-1"><Input type="number" value={m.actual ?? 0} onChange={(e) => updateManpower(i, { actual: Number(e.target.value) })} className="max-w-[110px]" /></td>
                  <td className="p-1"><Input type="number" step="0.25" value={m.hoursWorked ?? 8} onChange={(e) => updateManpower(i, { hoursWorked: Number(e.target.value) })} className="max-w-[90px]" /></td>
                  <td><button type="button" className="maker-table__remove-row" onClick={() => removeManpower(i)} aria-label="Remove">✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Equipment */}
      <Card padding={false}>
        <div className="flex items-center justify-between p-3 border-b border-line bg-sand/40">
          <h3 className="text-sm font-semibold uppercase tracking-widest">4. Equipment deployed today</h3>
          <Button variant="secondary" onClick={addEquip}>+ Equipment</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sand/40 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="p-2 w-8">Sr</th>
                <th className="p-2 text-left">Equipment</th>
                <th className="p-2">Qty</th>
                <th className="p-2">Worked hrs</th>
                <th className="p-2">Idle hrs</th>
                <th className="p-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {snap.equipment.map((e, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="p-1.5 text-xs">{i + 1}</td>
                  <td className="p-1"><Input value={e.name} onChange={(ev) => updateEquip(i, { name: ev.target.value })} /></td>
                  <td className="p-1"><Input type="number" value={e.qty ?? 0} onChange={(ev) => updateEquip(i, { qty: Number(ev.target.value) })} className="max-w-[100px]" /></td>
                  <td className="p-1"><Input type="number" step="0.25" value={e.workedHrs ?? 0} onChange={(ev) => updateEquip(i, { workedHrs: Number(ev.target.value) })} className="max-w-[110px]" /></td>
                  <td className="p-1"><Input type="number" step="0.25" value={e.idleHrs ?? 0} onChange={(ev) => updateEquip(i, { idleHrs: Number(ev.target.value) })} className="max-w-[110px]" /></td>
                  <td className="p-1.5 text-danger cursor-pointer text-xs" onClick={() => removeEquip(i)}>✕</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 5. Material */}
      <Card padding={false}>
        <div className="flex items-center justify-between p-3 border-b border-line bg-sand/40">
          <h3 className="text-sm font-semibold uppercase tracking-widest">5. Material at site</h3>
          <Button variant="secondary" onClick={addMat}>+ Material</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sand/40 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="p-2 w-8">Sr</th>
                <th className="p-2 text-left">Material</th>
                <th className="p-2">Unit</th>
                <th className="p-2">Opening</th>
                <th className="p-2">Received</th>
                <th className="p-2">Consumed</th>
                <th className="p-2">Closing</th>
                <th className="p-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {snap.materials.map((m, i) => {
                const closing = num(m.opening) + num(m.received) - num(m.consumed);
                return (
                  <tr key={i} className="border-t border-line">
                    <td className="p-1.5 text-xs">{i + 1}</td>
                    <td className="p-1"><Input value={m.name} onChange={(e) => updateMat(i, { name: e.target.value })} /></td>
                    <td className="p-1"><Input value={m.unit || ""} onChange={(e) => updateMat(i, { unit: e.target.value })} className="max-w-[80px]" /></td>
                    <td className="p-1"><Input type="number" value={m.opening ?? 0} onChange={(e) => updateMat(i, { opening: Number(e.target.value) })} className="max-w-[110px]" /></td>
                    <td className="p-1"><Input type="number" value={m.received ?? 0} onChange={(e) => updateMat(i, { received: Number(e.target.value) })} className="max-w-[110px]" /></td>
                    <td className="p-1"><Input type="number" value={m.consumed ?? 0} onChange={(e) => updateMat(i, { consumed: Number(e.target.value) })} className="max-w-[110px]" /></td>
                    <td className="p-1.5 text-xs tabular-nums">{closing.toFixed(2)}</td>
                    <td className="p-1.5 text-danger cursor-pointer text-xs" onClick={() => removeMat(i)}>✕</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 6. Quality control & tests today */}
      <Card padding={false}>
        <div className="p-3 border-b border-line bg-sand/40">
          <h3 className="text-sm font-semibold uppercase tracking-widest">6. Quality control & tests today</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sand/40 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="p-2 w-8">Sr</th>
                <th className="p-2 text-left">Quality / test parameter</th>
                <th className="p-2 text-left">Today&#39;s figure</th>
              </tr>
            </thead>
            <tbody>
              {snap.qualityTests.map((q, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="p-1.5 text-xs">{i + 1}</td>
                  <td className="p-1"><Input value={q.parameter} onChange={(e) => updateQualityTest(i, { parameter: e.target.value })} /></td>
                  <td className="p-1"><Input value={q.figure || ""} onChange={(e) => updateQualityTest(i, { figure: e.target.value })} placeholder="e.g. 4 / 8 · 24.8 N/mm² · 5 of 6" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 7. Safety — SPDC 6-row parameter/figure layout */}
      <Card padding={false}>
        <div className="p-3 border-b border-line bg-sand/40">
          <h3 className="text-sm font-semibold uppercase tracking-widest">7. HSE / safety statistics</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sand/40 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="p-2 w-8">Sr</th>
                <th className="p-2 text-left">HSE parameter</th>
                <th className="p-2 text-left">Today&#39;s figure</th>
              </tr>
            </thead>
            <tbody>
              {snap.safetyRows.map((row, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="p-1.5 text-xs">{i + 1}</td>
                  <td className="p-1"><Input value={row.parameter} onChange={(e) => updateSafetyRow(i, { parameter: e.target.value })} /></td>
                  <td className="p-1"><Input value={row.figure || ""} onChange={(e) => updateSafetyRow(i, { figure: e.target.value })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 8. Delay / idle time log */}
      <Card padding={false}>
        <div className="flex items-center justify-between p-3 border-b border-line bg-sand/40">
          <h3 className="text-sm font-semibold uppercase tracking-widest">8. Delay / idle time log today</h3>
          <Button variant="secondary" onClick={addDelay}>+ Delay</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sand/40 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="p-2 w-8">Sr</th>
                <th className="p-2 text-left">Cause</th>
                <th className="p-2 text-left">Category</th>
                <th className="p-2">From</th>
                <th className="p-2">To</th>
                <th className="p-2">Hrs lost</th>
                <th className="p-2">EOT</th>
                <th className="p-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {snap.delays.map((d, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="p-1.5 text-xs">{i + 1}</td>
                  <td className="p-1"><Input value={d.cause} onChange={(e) => updateDelay(i, { cause: e.target.value })} /></td>
                  <td className="p-1">
                    <Select value={d.category || "Weather"} onChange={(e) => updateDelay(i, { category: e.target.value })} className="max-w-[140px]">
                      <option>Weather</option>
                      <option>Contractor</option>
                      <option>Client</option>
                      <option>Vendor</option>
                      <option>Client / Vendor</option>
                      <option>PMC</option>
                      <option>Other</option>
                    </Select>
                  </td>
                  <td className="p-1"><Input type="time" value={toTimeInput(d.from)} onChange={(e) => updateDelay(i, { from: e.target.value })} className="max-w-[110px]" /></td>
                  <td className="p-1"><Input type="time" value={toTimeInput(d.to)} onChange={(e) => updateDelay(i, { to: e.target.value })} className="max-w-[110px]" /></td>
                  <td className="p-1"><Input type="number" step="0.25" value={d.hoursLost ?? 0} onChange={(e) => updateDelay(i, { hoursLost: Number(e.target.value) })} className="max-w-[100px]" /></td>
                  <td className="p-1">
                    <Select value={d.eot || "No"} onChange={(e) => updateDelay(i, { eot: (e.target.value as "Yes" | "No" | "Review") })} className="max-w-[95px]">
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                      <option value="Review">Review</option>
                    </Select>
                  </td>
                  <td className="p-1.5 text-danger cursor-pointer text-xs" onClick={() => removeDelay(i)}>✕</td>
                </tr>
              ))}
              {!snap.delays.length && (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-xs text-steel-muted">
                    No delays logged today. Click <b>+ Delay</b> when there is idle time to record.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 9. Approvals pending */}
      <Card padding={false}>
        <div className="flex items-center justify-between p-3 border-b border-line bg-sand/40">
          <h3 className="text-sm font-semibold uppercase tracking-widest">9. Drawings / RFI / material approvals pending</h3>
          <Button variant="secondary" onClick={addApproval}>+ Approval</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sand/40 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="p-2 w-8">Sr</th>
                <th className="p-2 text-left">Ref. no</th>
                <th className="p-2 text-left">Description</th>
                <th className="p-2">Raised on</th>
                <th className="p-2 text-left">Pending with</th>
                <th className="p-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {snap.approvals.map((a, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="p-1.5 text-xs">{i + 1}</td>
                  <td className="p-1"><Input value={a.refNo} onChange={(e) => updateApproval(i, { refNo: e.target.value })} className="max-w-[130px]" /></td>
                  <td className="p-1"><Input value={a.description || ""} onChange={(e) => updateApproval(i, { description: e.target.value })} /></td>
                  <td className="p-1"><Input type="date" value={toDateInput(a.raisedOn)} onChange={(e) => updateApproval(i, { raisedOn: e.target.value })} /></td>
                  <td className="p-1"><Input value={a.pendingWith || ""} onChange={(e) => updateApproval(i, { pendingWith: e.target.value })} className="max-w-[160px]" /></td>
                  <td className="p-1.5 text-danger cursor-pointer text-xs" onClick={() => removeApproval(i)}>✕</td>
                </tr>
              ))}
              {!snap.approvals.length && (
                <tr><td colSpan={6} className="p-4 text-center text-xs text-steel-muted">Nothing pending. Click <b>+ Approval</b> to add a drawing / RFI / material approval waiting on someone.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 10. Issues & risks */}
      <Card padding={false}>
        <div className="flex items-center justify-between p-3 border-b border-line bg-sand/40">
          <h3 className="text-sm font-semibold uppercase tracking-widest">10. Issues & risks (open items)</h3>
          <Button variant="secondary" onClick={addIssue}>+ Issue</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sand/40 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="p-2 w-8">Sr</th>
                <th className="p-2 text-left">Description</th>
                <th className="p-2">Severity</th>
                <th className="p-2 text-left">Owner</th>
                <th className="p-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {snap.issues.map((iss, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="p-1.5 text-xs">{i + 1}</td>
                  <td className="p-1"><Input value={iss.description} onChange={(e) => updateIssue(i, { description: e.target.value })} /></td>
                  <td className="p-1">
                    <Select value={iss.severity || "Medium"} onChange={(e) => updateIssue(i, { severity: e.target.value as Issue["severity"] })} className="max-w-[110px]">
                      <option>Critical</option>
                      <option>High</option>
                      <option>Medium</option>
                      <option>Low</option>
                    </Select>
                  </td>
                  <td className="p-1"><Input value={iss.owner || ""} onChange={(e) => updateIssue(i, { owner: e.target.value })} className="max-w-[160px]" /></td>
                  <td className="p-1.5 text-danger cursor-pointer text-xs" onClick={() => removeIssue(i)}>✕</td>
                </tr>
              ))}
              {!snap.issues.length && (
                <tr><td colSpan={5} className="p-4 text-center text-xs text-steel-muted">No open issues today. Click <b>+ Issue</b> to log one.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 11-13. Narrative */}
      <div className="grid md:grid-cols-3 gap-4">
        <NarrativeCard
          title="11. Today's highlights"
          items={snap.highlights}
          onChange={(i, v) => updateNarrativeList("highlights", i, v)}
          onAdd={() => addNarrativeItem("highlights")}
          onRemove={(i) => removeNarrativeItem("highlights", i)}
          hint="Concreting complete up to GL-4 · 42 nos."
        />
        <NarrativeCard
          title="12. Next day plan"
          items={snap.nextDayPlan}
          onChange={(i, v) => updateNarrativeList("nextDayPlan", i, v)}
          onAdd={() => addNarrativeItem("nextDayPlan")}
          onRemove={(i) => removeNarrativeItem("nextDayPlan", i)}
          hint="Footing reinforcement GL-5 to GL-6 · 8 nos."
        />
        <NarrativeCard
          title="13. Decisions required"
          items={snap.decisions}
          onChange={(i, v) => updateNarrativeList("decisions", i, v)}
          onAdd={() => addNarrativeItem("decisions")}
          onRemove={(i) => removeNarrativeItem("decisions", i)}
          hint="Approve floor hardener brand (MAR-044)"
        />
      </div>

      <Card>
        <EvidencePanel
          folderHint={`07.02_Daily_Site_Records/${discipline}/photos · attachments · signatures`}
          photos={snap.photos}
          attachments={snap.attachments}
          signatures={snap.signatures}
          busy={busy}
          onUploadPhotos={uploadPhotosBatch}
          onUploadAttachment={uploadAttachmentFile}
          onUploadSignature={uploadSignatureFile}
          onRemovePhoto={removePhoto}
          onRemoveAttachment={removeAttachment}
          onRemoveSignature={removeSignature}
        />
      </Card>

      {recent.length > 0 && (
        <Card>
          <h3 className="font-semibold mb-2">Recent DPRs</h3>
          <ul className="text-sm divide-y">
            {recent.map((r) => (
              <li key={r.id} className="py-1.5 flex justify-between items-center">
                <span className="font-mono text-xs">{new Date(r.logDate).toISOString().slice(0, 10)} · {r.discipline}</span>
                <span>
                  <Badge tone={r.status === "Published" ? "ok" : "warn"}>{r.status}</Badge>
                  {r.publishedPath && (
                    <span className="text-xs text-steel-muted ml-2 truncate max-w-[280px] inline-block align-middle">
                      {r.publishedPath}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      </div>

      <div className="maker-sticky-bar shrink-0">
        <Badge tone={snap.status === "Published" ? "ok" : "warn"}>{snap.status}</Badge>
        <Button type="button" variant="secondary" onClick={downloadXlsx} disabled={busy}>XLSX</Button>
        <Button type="button" variant="secondary" onClick={downloadPdf} disabled={busy}>PDF</Button>
        <Button type="button" onClick={save} disabled={busy}>Save</Button>
        <Button type="button" variant="secondary" onClick={publish} disabled={busy}>Publish</Button>
      </div>

      <RegisterEntryModal
        open={lineModalOpen}
        title="Add BOQ line — quantity progress"
        onClose={() => setLineModalOpen(false)}
        onSave={commitLineFromModal}
        saving={busy}
        size="xl"
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block sm:col-span-2">
            <span className="text-xs text-steel-muted">Description</span>
            <Input value={lineDraft.description} onChange={(e) => setLineDraft({ ...lineDraft, description: e.target.value })} required />
          </label>
          <label className="block">
            <span className="text-xs text-steel-muted">Group</span>
            <Input value={lineDraft.group || ""} onChange={(e) => setLineDraft({ ...lineDraft, group: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs text-steel-muted">Unit</span>
            <Input value={lineDraft.unit || ""} onChange={(e) => setLineDraft({ ...lineDraft, unit: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-xs text-steel-muted">Scope qty</span>
            <Input type="number" value={lineDraft.scopeQty ?? 0} onChange={(e) => setLineDraft({ ...lineDraft, scopeQty: Number(e.target.value) })} />
          </label>
          <label className="block">
            <span className="text-xs text-steel-muted">Qty today</span>
            <Input type="number" value={lineDraft.qtyToday ?? 0} onChange={(e) => setLineDraft({ ...lineDraft, qtyToday: Number(e.target.value) })} />
          </label>
        </div>
      </RegisterEntryModal>

      <RegisterEntryModal
        open={manpowerModalOpen}
        title="Add trade — manpower"
        onClose={() => setManpowerModalOpen(false)}
        onSave={commitManpowerFromModal}
        saving={busy}
      >
        <label className="block">
          <span className="text-xs text-steel-muted">Trade</span>
          <Input value={manpowerDraft.trade} onChange={(e) => setManpowerDraft({ ...manpowerDraft, trade: e.target.value })} required />
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="text-xs text-steel-muted">Planned</span>
            <Input type="number" value={manpowerDraft.planned ?? 0} onChange={(e) => setManpowerDraft({ ...manpowerDraft, planned: Number(e.target.value) })} />
          </label>
          <label className="block">
            <span className="text-xs text-steel-muted">Actual</span>
            <Input type="number" value={manpowerDraft.actual ?? 0} onChange={(e) => setManpowerDraft({ ...manpowerDraft, actual: Number(e.target.value) })} />
          </label>
          <label className="block">
            <span className="text-xs text-steel-muted">Hours</span>
            <Input type="number" value={manpowerDraft.hoursWorked ?? 8} onChange={(e) => setManpowerDraft({ ...manpowerDraft, hoursWorked: Number(e.target.value) })} />
          </label>
        </div>
      </RegisterEntryModal>
    </div>
  );
}

function DprScurveChart({ points }: { points: { label: string; planned: number; actual: number }[] }) {
  if (!points.length) return <p className="text-sm text-steel-muted">Add qty + dates on BOQ lines to build S-curve.</p>;
  const w = 320;
  const h = 140;
  const pad = 24;
  const maxY = Math.max(10, ...points.flatMap((p) => [p.planned, p.actual])) * 1.15;
  const step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const y = (v: number) => h - pad - (v / maxY) * (h - pad * 2);
  const planned = points.map((p, i) => `${i ? "L" : "M"} ${pad + i * step} ${y(p.planned)}`).join(" ");
  const actual = points.map((p, i) => `${i ? "L" : "M"} ${pad + i * step} ${y(p.actual)}`).join(" ");
  return (
    <div>
      <div className="text-sm font-semibold mb-2">S-curve · cumulative %</div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-md" role="img" aria-label="S-curve chart">
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="var(--color-line,#d5dadd)" />
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="var(--color-line,#d5dadd)" />
        <path d={planned} fill="none" stroke="#2563EB" strokeWidth="2.5" />
        <path d={actual} fill="none" stroke="#0F766E" strokeWidth="2.5" />
      </svg>
      <div className="flex gap-4 text-[11px] text-steel-muted mt-1">
        <span><span className="inline-block w-3 h-0.5 bg-[#2563EB] align-middle mr-1" />Planned</span>
        <span><span className="inline-block w-3 h-0.5 bg-[#0F766E] align-middle mr-1" />Actual</span>
      </div>
    </div>
  );
}

function KPI({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className={`rounded-lg border ${tone === "warn" ? "border-warn/40 bg-warn/5" : tone === "ok" ? "border-ok/40 bg-ok/5" : "border-line bg-white"} p-2`}>
      <div className="text-[10px] uppercase tracking-widest text-steel-muted">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function NarrativeCard({
  title, items, onChange, onAdd, onRemove, hint,
}: {
  title: string;
  items: string[];
  onChange: (i: number, v: string) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  hint?: string;
}) {
  return (
    <Card padding={false}>
      <div className="flex items-center justify-between p-3 border-b border-line bg-sand/40">
        <h3 className="text-xs font-semibold uppercase tracking-widest">{title}</h3>
        <Button variant="secondary" onClick={onAdd} className="!text-xs">+ Add</Button>
      </div>
      <div className="p-2 space-y-1.5">
        {items.length === 0 && (
          <p className="text-[11px] text-steel-muted italic px-1">
            {hint || "Nothing recorded yet — click + Add"}
          </p>
        )}
        {items.map((item, i) => (
          <div key={i} className="flex gap-2 items-start">
            <span className="text-[10px] text-steel-muted mt-2 tabular-nums w-4">{i + 1}.</span>
            <textarea
              className="w-full rounded border border-line bg-white px-2 py-1 text-xs focus:border-brand focus:outline-none"
              rows={2}
              value={item}
              placeholder={hint}
              onChange={(e) => onChange(i, e.target.value)}
            />
            <button
              type="button"
              className="text-danger text-xs mt-2"
              onClick={() => onRemove(i)}
              title="Remove"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

