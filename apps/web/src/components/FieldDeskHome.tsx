import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { AttendanceCalendar } from "./AttendanceCalendar";
import { AttendancePunchPanel } from "./AttendancePunchPanel";
import { Button, Card, Input, PageHeader } from "./ui";

type Balance = {
  id: string;
  entitled: number;
  used: number;
  balance: number;
  leaveType?: { name?: string; code?: string } | null;
};

type LeaveRow = {
  id: string;
  reason?: string | null;
  status: string;
  fromDate: string;
  toDate: string;
  days: number;
  leaveType?: { name?: string } | null;
};

type DocRow = {
  id: string;
  category: string;
  title: string;
  createdAt: string;
};

const DOC_KINDS = ["Aadhaar", "PAN", "Bank", "ID-card", "Medical", "Other"];

/** Site and contractor landing — punch, calendar, leave, documents, separation. Letters stay with HR. */
export function FieldDeskHome({ variant }: { variant: "site" | "vendor" }) {
  const { token, user } = useAuth();
  const [balances, setBalances] = useState<Balance[]>([]);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [msg, setMsg] = useState("");
  const [leaveFrom, setLeaveFrom] = useState("");
  const [leaveTo, setLeaveTo] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [sepDay, setSepDay] = useState("");
  const [sepReason, setSepReason] = useState("");
  const [docKind, setDocKind] = useState("Aadhaar");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const site = variant === "site";
  const [searchParams, setSearchParams] = useSearchParams();
  const desk = searchParams.get("desk") || "attendance";
  const sections = [
    { id: "attendance", label: "Attendance" },
    { id: "leave", label: "Leave" },
    { id: "calendar", label: "Calendar" },
    { id: "documents", label: "Documents" },
    { id: "separation", label: "Separation" },
  ];

  async function load() {
    if (!user?.id) return;
    const [b, l, d] = await Promise.all([
      api<Balance[]>("/api/hrm/leave-balances", { token }).catch(() => []),
      api<LeaveRow[]>("/api/hrm/leave", { token }).catch(() => []),
      api<DocRow[]>(`/api/hrm/employee-files?userId=${encodeURIComponent(user.id)}`, { token }).catch(() => []),
    ]);
    setBalances(b);
    setLeaves(l);
    setDocs(d);
  }

  useEffect(() => {
    void load();
  }, [token, user?.id]);

  const separations = leaves.filter((row) => (row.reason || "").startsWith("SEPARATION:"));
  const leaveRows = leaves.filter((row) => !(row.reason || "").startsWith("SEPARATION:"));

  async function applyLeave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      await api("/api/hrm/leave", {
        method: "POST",
        token,
        body: JSON.stringify({ fromDate: leaveFrom, toDate: leaveTo, reason: leaveReason }),
      });
      setLeaveReason("");
      setMsg("Leave request sent to HR.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not send leave request");
    } finally {
      setBusy(false);
    }
  }

  async function requestSeparation(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      await api("/api/hrm/separation", {
        method: "POST",
        token,
        body: JSON.stringify({ lastWorkingDay: sepDay, reason: sepReason }),
      });
      setSepReason("");
      setMsg("Separation request sent. HR will issue the exit letter — you do not generate letters here.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not send separation request");
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
      const fd = new FormData();
      fd.append("userId", user.id);
      fd.append("category", docKind);
      fd.append("title", docFile.name);
      fd.append("files", docFile);
      await api("/api/hrm/employee-files", { method: "POST", token, body: fd });
      setDocFile(null);
      setMsg("Document stored in your employee file.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not store the document");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8 min-w-0 max-w-3xl mx-auto">
      <PageHeader
        eyebrow={site ? "Site desk" : "Contractor desk"}
        title={site ? "Site home" : "Contractor home"}
        subtitle={
          site
            ? "Check in, see leave left, keep your documents, and raise separation separately. Appointment letters are issued once at onboarding — you do not generate them here."
            : "Check in, see leave left, and keep your documents. Bid work stays on Bid management. Letters are issued by HR once, at onboarding."
        }
        actions={undefined}
      />

      <div className="flex flex-wrap gap-2">
        {sections.map((section) => (
          <Button
            key={section.id}
            type="button"
            variant={desk === section.id ? "primary" : "secondary"}
            className="!text-xs"
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

      {msg && <p className="text-sm bg-brand-soft text-brand-dark rounded-lg px-3 py-2">{msg}</p>}

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
          <p className="text-xs text-steel-muted">This sends a request. Approval is a separate HR step — you cannot approve your own leave here.</p>
          <form className="grid sm:grid-cols-2 gap-2" onSubmit={applyLeave}>
            <Input type="date" required value={leaveFrom} onChange={(e) => setLeaveFrom(e.target.value)} />
            <Input type="date" required value={leaveTo} onChange={(e) => setLeaveTo(e.target.value)} />
            <Input
              className="sm:col-span-2"
              placeholder="Reason"
              value={leaveReason}
              onChange={(e) => setLeaveReason(e.target.value)}
            />
            <Button type="submit" disabled={busy}>
              Send to HR
            </Button>
          </form>
          {leaveRows.length > 0 && (
            <ul className="text-sm space-y-1">
              {leaveRows.slice(0, 5).map((row) => (
                <li key={row.id} className="flex justify-between gap-2">
                  <span>
                    {new Date(row.fromDate).toLocaleDateString("en-IN")} – {new Date(row.toDate).toLocaleDateString("en-IN")}
                    {row.leaveType?.name ? ` · ${row.leaveType.name}` : ""}
                  </span>
                  <span className="text-steel-muted">{row.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
      )}

      {desk === "calendar" && <AttendanceCalendar compact />}

      {desk === "documents" && (
      <section className="space-y-3">
        <h2 className="font-display text-lg">My documents</h2>
        <p className="text-sm text-steel-muted">
          After onboarding, store Aadhaar, PAN, bank proof, and other papers here. They go into your employee file. Letter templates are not part of this desk.
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

      {desk === "separation" && (
      <section className="space-y-3">
        <h2 className="font-display text-lg">Separation</h2>
        <p className="text-sm text-steel-muted">
          This is separate from leave. Tell HR your last working day. They issue the exit letter — you only raise the request.
        </p>
        <Card className="!p-4 border-amber-200">
          <form className="grid sm:grid-cols-2 gap-2" onSubmit={requestSeparation}>
            <Input type="date" required value={sepDay} onChange={(e) => setSepDay(e.target.value)} />
            <Input
              required
              placeholder="Reason for leaving"
              value={sepReason}
              onChange={(e) => setSepReason(e.target.value)}
            />
            <Button type="submit" disabled={busy}>
              Request separation
            </Button>
          </form>
          {separations.length > 0 && (
            <ul className="mt-3 text-sm space-y-1">
              {separations.map((row) => (
                <li key={row.id} className="flex justify-between gap-2">
                  <span>
                    Last day {new Date(row.fromDate).toLocaleDateString("en-IN")} · {(row.reason || "").replace(/^SEPARATION:\s*/, "")}
                  </span>
                  <span className="text-steel-muted">{row.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
      )}
    </div>
  );
}
