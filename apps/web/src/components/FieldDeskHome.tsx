import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { countLeaveWorkingDays } from "@sharnam/shared";
import { api } from "../api";
import { useAuth } from "../auth";
import { BrandMark } from "./Brand";
import { AttendanceCalendar } from "./AttendanceCalendar";
import { AttendancePunchPanel } from "./AttendancePunchPanel";
import { Button, Card, Input, PageHeader, Select } from "./ui";
import { StatusNote } from "./StatusNote";

type LeaveType = { id: string; code: string; name: string };

type Balance = {
  id: string;
  entitled: number;
  used: number;
  balance: number;
  leaveType?: { id?: string; name?: string; code?: string } | null;
};

type LeaveRow = {
  id: string;
  reason?: string | null;
  status: string;
  fromDate: string;
  toDate: string;
  days: number;
  halfDay?: boolean;
  leaveType?: { name?: string; code?: string } | null;
};

type DocRow = {
  id: string;
  category: string;
  title: string;
  createdAt: string;
};

const DOC_KINDS = ["Aadhaar", "PAN", "Bank", "ID-card", "Medical", "Other"];

function requestGeoQuiet(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });
}

/** Site and contractor landing — punch, calendar, leave, documents. Letters stay with HR. */
export function FieldDeskHome({ variant }: { variant: "site" | "vendor" }) {
  const { token, user } = useAuth();
  const [balances, setBalances] = useState<Balance[]>([]);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [msg, setMsg] = useState("");
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [halfDay, setHalfDay] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [docKind, setDocKind] = useState("Aadhaar");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const site = variant === "site";
  const [searchParams, setSearchParams] = useSearchParams();
  const rawDesk = searchParams.get("desk") || "attendance";
  const desk = rawDesk === "separation" ? "attendance" : rawDesk;
  const earlyFromGeo = searchParams.get("early") === "1";
  const sections = [
    { id: "attendance", label: "Attendance" },
    { id: "leave", label: "Leave" },
    { id: "calendar", label: "Calendar" },
    { id: "documents", label: "Documents" },
  ];

  const leaveDaysPreview = useMemo(() => {
    if (!leaveFrom) return null;
    if (halfDay) return 0.5;
    if (!leaveTo) return null;
    const from = new Date(`${leaveFrom}T00:00:00`);
    const to = new Date(`${leaveTo}T00:00:00`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
    return countLeaveWorkingDays({ from, to, halfDay: false });
  }, [leaveFrom, leaveTo, halfDay]);

  async function load() {
    if (!user?.id) return;
    const [b, l, d, t] = await Promise.all([
      api<Balance[]>("/api/hrm/leave-balances", { token }).catch(() => []),
      api<LeaveRow[]>("/api/hrm/leave", { token }).catch(() => []),
      api<DocRow[]>(`/api/hrm/employee-files?userId=${encodeURIComponent(user.id)}`, { token }).catch(() => []),
      api<LeaveType[]>("/api/hrm/leave-types", { token }).catch(() => []),
    ]);
    setBalances(b);
    setLeaves(l.filter((row) => !(row.reason || "").startsWith("SEPARATION:")));
    setDocs(d);
    setLeaveTypes(t);
    if (!leaveTypeId && t.length) {
      const cl = t.find((x) => /^cl$/i.test(x.code) || /casual/i.test(x.name));
      setLeaveTypeId((cl || t[0]).id);
    }
  }

  useEffect(() => {
    void load();
  }, [token, user?.id]);

  useEffect(() => {
    if (searchParams.get("desk") === "separation") {
      const next = new URLSearchParams(searchParams);
      next.delete("desk");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (searchParams.get("halfDay") === "1") setHalfDay(true);
    if (earlyFromGeo || searchParams.get("halfDay") === "1") {
      const today = new Date();
      const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      if (!leaveFrom) setLeaveFrom(iso);
      if (!leaveTo) setLeaveTo(iso);
      if (!leaveReason && earlyFromGeo) setLeaveReason("Early checkout from site (GPS)");
    }
  }, [searchParams, earlyFromGeo]);

  async function applyLeave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      await api("/api/hrm/leave", {
        method: "POST",
        token,
        body: JSON.stringify({
          fromDate: leaveFrom,
          toDate: leaveTo,
          reason: leaveReason,
          leaveTypeId: leaveTypeId || undefined,
          halfDay,
        }),
      });
      setLeaveReason("");
      setHalfDay(false);
      setMsg(halfDay ? "Half-day leave request sent to HR." : "Leave request sent to HR.");
      const next = new URLSearchParams(searchParams);
      next.delete("early");
      next.delete("halfDay");
      setSearchParams(next, { replace: true });
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not send leave request");
    } finally {
      setBusy(false);
    }
  }

  async function storeDocument(e: FormEvent) {
    e.preventDefault();
    if (!docFile || !user?.id) return;
    setBusy(true);
    setMsg("");
    try {
      const geo = await requestGeoQuiet();
      const fd = new FormData();
      fd.append("userId", user.id);
      fd.append("category", docKind);
      fd.append("title", docFile.name);
      fd.append("capturedAt", new Date().toISOString());
      if (geo) {
        fd.append("lat", String(geo.lat));
        fd.append("lng", String(geo.lng));
      }
      fd.append("files", docFile);
      await api("/api/hrm/employee-files", { method: "POST", token, body: fd });
      setDocFile(null);
      setMsg(
        geo
          ? "Document stored with location and time stamp in your employee file."
          : "Document stored in your employee file (location was not available).",
      );
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not store the document");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 min-w-0 max-w-3xl mx-auto">
      <div className="rounded-2xl border border-line bg-paper overflow-hidden shadow-sm">
        <div className="h-1.5 bg-gradient-to-r from-brand via-mark to-brand" />
        <div className="px-4 sm:px-5 py-4 flex flex-wrap items-center gap-4">
          <img src="/logo-transparent.png" alt="Sharnam" className="h-10 w-auto object-contain" />
          <div className="min-w-0 flex-1">
            <BrandMark size="sm" compact />
            <p className="text-xs text-steel-muted mt-1">
              {site
                ? "Site desk · clock in with selfie and GPS · leave and documents"
                : "Contractor desk · clock in with selfie and GPS · leave and documents"}
            </p>
          </div>
        </div>
      </div>

      <PageHeader
        eyebrow={site ? "Site desk" : "Contractor desk"}
        title={site ? "Site home" : "Contractor home"}
        subtitle={
          site
            ? "Use one section at a time. Attendance is selfie + GPS. Check-out must be near where you checked in. Expense vouchers are on Expense voucher in the sidebar."
            : "Check in with selfie and GPS. Leave and documents are separate from bid tools. Letters are issued by HR at onboarding."
        }
        actions={undefined}
      />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Site desk sections">
        {sections.map((section) => (
          <Button
            key={section.id}
            type="button"
            variant={desk === section.id ? "primary" : "secondary"}
            className="!text-xs"
            aria-selected={desk === section.id}
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              if (section.id === "attendance") next.delete("desk");
              else next.set("desk", section.id);
              setSearchParams(next);
            }}
          >
            {section.label}
          </Button>
        ))}
      </div>

      <StatusNote msg={msg} />

      {desk === "attendance" && <AttendancePunchPanel variant="full" showRoster={false} />}

      {desk === "leave" && (
      <section className="space-y-3">
        <h2 className="font-display text-lg">Leave left</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {balances.length === 0 && (
            <Card className="!p-4 text-sm text-steel-muted sm:col-span-3">Leave balances appear after HR sets them for this year.</Card>
          )}
          {balances.map((b) => (
            <Card key={b.id} className="!p-4">
              <div className="text-[10px] uppercase text-steel-muted font-mono">{b.leaveType?.code || b.leaveType?.name || "Leave"}</div>
              <div className="text-2xl font-display mt-1">{b.balance}</div>
              <p className="text-xs text-steel-muted mt-1">
                {b.used} used of {b.entitled}
              </p>
            </Card>
          ))}
        </div>
        <Card className="!p-4 space-y-3">
          <h3 className="font-semibold text-sm">Request leave</h3>
          <p className="text-xs text-steel-muted">
            Days are counted as working days (weekends and company holidays excluded). Half day is 0.5. HR approves separately.
          </p>
          {earlyFromGeo && (
            <p className="text-xs rounded-lg px-3 py-2 bg-warn-soft text-warn">
              Early checkout recorded with GPS. Submit a half-day (usually CL) for today so HR can approve.
            </p>
          )}
          <form className="grid sm:grid-cols-2 gap-2" onSubmit={applyLeave}>
            <Select
              className="sm:col-span-2"
              required
              value={leaveTypeId}
              onChange={(e) => setLeaveTypeId(e.target.value)}
            >
              <option value="">Leave type…</option>
              {leaveTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} — {t.name}
                </option>
              ))}
            </Select>
            <Input type="date" required value={leaveFrom} onChange={(e) => setLeaveFrom(e.target.value)} />
            <Input
              type="date"
              required
              value={leaveTo}
              onChange={(e) => setLeaveTo(e.target.value)}
              disabled={halfDay}
            />
            <label className="sm:col-span-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={halfDay}
                onChange={(e) => {
                  const on = e.target.checked;
                  setHalfDay(on);
                  if (on && leaveFrom) setLeaveTo(leaveFrom);
                }}
              />
              Half day (0.5 day)
            </label>
            {leaveDaysPreview != null && (
              <p className="sm:col-span-2 text-xs text-steel-muted">
                Will request <strong className="text-ink">{leaveDaysPreview}</strong> working day
                {leaveDaysPreview === 1 ? "" : "s"} (preview — HR holidays also apply on the server).
              </p>
            )}
            <Input
              className="sm:col-span-2"
              placeholder="Reason"
              value={leaveReason}
              onChange={(e) => setLeaveReason(e.target.value)}
            />
            <Button type="submit" disabled={busy || !leaveTypeId}>
              Send to HR
            </Button>
          </form>
          {leaves.length > 0 && (
            <ul className="text-sm space-y-1">
              {leaves.slice(0, 5).map((row) => (
                <li key={row.id} className="flex justify-between gap-2">
                  <span>
                    {new Date(row.fromDate).toLocaleDateString("en-IN")} – {new Date(row.toDate).toLocaleDateString("en-IN")}
                    {row.leaveType?.name ? ` · ${row.leaveType.name}` : ""}
                    {row.halfDay ? " · Half" : ` · ${row.days}d`}
                  </span>
                  <span className="text-steel-muted shrink-0">{row.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
      )}

      {desk === "calendar" && (
        <section className="space-y-3">
          <h2 className="font-display text-lg">Monthly attendance</h2>
          <p className="text-sm text-steel-muted">
            Your month record with check-in/out times, photos, and map points. Office and HR review the same calendar on the HR attendance desk.
          </p>
          <AttendanceCalendar compact />
        </section>
      )}

      {desk === "documents" && (
      <section className="space-y-3">
        <h2 className="font-display text-lg">My documents</h2>
        <p className="text-sm text-steel-muted">
          Store Aadhaar, PAN, bank proof, and other papers. Uploads are saved with time (and GPS when available) into your employee file.
        </p>
        <Card className="!p-4">
          <form className="grid sm:grid-cols-2 gap-2" onSubmit={storeDocument}>
            <select
              className="rounded-xl border border-line bg-paper px-3 py-2 text-sm"
              value={docKind}
              onChange={(e) => setDocKind(e.target.value)}
            >
              {DOC_KINDS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
            <Input type="file" onChange={(e) => setDocFile(e.target.files?.[0] || null)} />
            <Button type="submit" disabled={busy || !docFile}>
              Store document
            </Button>
          </form>
          <ul className="mt-3 text-sm space-y-1">
            {docs.length === 0 && <li className="text-steel-muted">No documents stored yet.</li>}
            {docs.slice(0, 8).map((d) => (
              <li key={d.id}>
                <span className="font-mono text-[10px] text-brand mr-2">{d.category}</span>
                {d.title}
              </li>
            ))}
          </ul>
        </Card>
      </section>
      )}
    </div>
  );
}
