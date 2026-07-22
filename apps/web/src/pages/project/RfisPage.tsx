import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader, Select, TextArea } from "../../components/ui";
import { getActiveWorkspace } from "../../workspaces";

type RfiKind = "All" | "RequestForInformation" | "DrawingChecklist" | "QualityInspection" | "Manual" | "ClientConcern";

export default function RfisPage() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const { token, user } = useAuth();
  const [rfis, setRfis] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [drawings, setDrawings] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [kindFilter, setKindFilter] = useState<RfiKind>(() => {
    const q = search.get("kind") as RfiKind | null;
    if (q) return q;
    const ws = getActiveWorkspace();
    if (ws === "quality") return "QualityInspection";
    if (ws === "drawings") return "DrawingChecklist";
    if (ws === "comms") return "RequestForInformation";
    return "All";
  });
  const [matrixCanRespond, setMatrixCanRespond] = useState(false);
  const [form, setForm] = useState({
    subject: "",
    question: "",
    rfiKind: "RequestForInformation",
    assignedToId: "",
    linkedDrawingId: "",
    linkedAssignmentId: "",
    linkedChecklistItemId: "",
    responsibleVendorId: "",
    attachmentNote: "",
    scheduleImpact: "None",
    costImpact: "None",
  });
  const [answer, setAnswer] = useState("");
  const [siteAssignments, setSiteAssignments] = useState<any[]>([]);
  const [qiAssignments, setQiAssignments] = useState<any[]>([]);

  const isClient = user?.role === "client";
  const canCreate = !!user;
  const canRespond = matrixCanRespond;
  const canClose = matrixCanRespond;

  const load = async () => {
    const [rPayload, u, d, aSite, aQi, v] = await Promise.all([
      api<any>(`/api/rfis/project/${id}`, { token }),
      api<any[]>("/api/users", { token }).catch(() => []),
      api<any[]>(`/api/drawings/project/${id}`, { token }),
      api<{ assignments: any[] }>(`/api/checklist/project/${id}?type=SiteExecution`, { token }).catch(() => ({
        assignments: [],
      })),
      api<{ assignments: any[] }>(`/api/checklist/project/${id}?type=QualityInspection`, { token }).catch(() => ({
        assignments: [],
      })),
      api<any[]>(`/api/vendors/project/${id}`, { token }).catch(() => []),
    ]);
    const list = Array.isArray(rPayload) ? rPayload : rPayload.rfis || [];
    setRfis(list);
    setMatrixCanRespond(Array.isArray(rPayload) ? true : !!rPayload.canRespond);
    setUsers(u);
    setDrawings(d);
    setSiteAssignments(aSite.assignments || []);
    setQiAssignments(aQi.assignments || []);
    setVendors(Array.isArray(v) ? v.map((row: any) => row.vendor || row) : []);
    if (!active && list[0]) setActive(list[0].id);
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  useEffect(() => {
    const q = search.get("kind") as RfiKind | null;
    if (q) setKindFilter(q);
  }, [search]);

  useEffect(() => {
    if (kindFilter === "QualityInspection") {
      setForm((f) => ({ ...f, rfiKind: "QualityInspection" }));
    } else if (kindFilter === "DrawingChecklist") {
      setForm((f) => ({ ...f, rfiKind: "DrawingChecklist" }));
    } else if (kindFilter === "RequestForInformation" || kindFilter === "All") {
      setForm((f) => ({ ...f, rfiKind: "RequestForInformation" }));
    }
  }, [kindFilter]);

  const needsChecklist = form.rfiKind === "DrawingChecklist" || form.rfiKind === "QualityInspection";
  const checklistOptions = form.rfiKind === "QualityInspection" ? qiAssignments : siteAssignments;

  const filtered = useMemo(() => {
    return rfis.filter((r) => {
      const statusOk = statusFilter === "All" || r.status === statusFilter;
      const kind = r.rfiKind || "RequestForInformation";
      const kindOk =
        kindFilter === "All" ||
        kind === kindFilter ||
        (kindFilter === "RequestForInformation" && (kind === "Manual" || kind === "RequestForInformation"));
      return statusOk && kindOk;
    });
  }, [rfis, statusFilter, kindFilter]);

  const selected = rfis.find((r) => r.id === active);

  const fillLink = selected?.linkedAssignmentId
    ? `/projects/${id}/checklist/fill/${selected.linkedAssignmentId}?family=${
        selected.rfiKind === "QualityInspection" ? "QualityInspection" : "SiteExecution"
      }`
    : selected?.rfiKind === "QualityInspection"
      ? `/projects/${id}/quality-inspections`
      : `/projects/${id}/checklist`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Simple request types"
        title={isClient ? "Concerns & RFIs" : "Requests"}
        subtitle={
          isClient
            ? "Raise a concern anytime. Matrix parties or office respond and close."
            : "① Ask (PMC RFI) — clarification. ② Request checklist fill — open the fill form (drawings + docs). ③ Quality Inspection — Procore-style QI is under Quality; use Request QI fill only when needed."
        }
      />

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["All", "All"],
            ["RequestForInformation", "Ask (PMC)"],
            ["DrawingChecklist", "Request checklist fill"],
            ["QualityInspection", "Request QI fill"],
            ["ClientConcern", "Client"],
          ] as [RfiKind, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setKindFilter(k)}
            className={`rounded-md px-3 py-2 text-sm font-semibold border ${
              kindFilter === k ? "bg-brand text-white border-brand" : "bg-white border-line text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {canCreate && (
        <Card>
          <h3 className="font-semibold mb-3">{isClient ? "Raise concern" : "Create request"}</h3>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (needsChecklist && !form.linkedAssignmentId) {
                alert("Select the checklist this fill request is for.");
                return;
              }
              const assignment = checklistOptions.find((a) => a.id === form.linkedAssignmentId);
              await api(`/api/rfis/project/${id}`, {
                method: "POST",
                token,
                body: JSON.stringify({
                  ...form,
                  linkedChecklistItemId: assignment?.template?.id || form.linkedChecklistItemId || null,
                  linkedAssignmentId: form.linkedAssignmentId || null,
                  rfiKind: isClient ? "ClientConcern" : form.rfiKind,
                }),
              });
              setForm({
                ...form,
                subject: "",
                question: "",
                linkedAssignmentId: "",
                linkedChecklistItemId: "",
                attachmentNote: "",
              });
              await load();
            }}
          >
            {!isClient && (
              <Select value={form.rfiKind} onChange={(e) => setForm({ ...form, rfiKind: e.target.value, linkedAssignmentId: "" })}>
                <option value="RequestForInformation">Ask — Request for Information (PMC)</option>
                <option value="DrawingChecklist">Request checklist fill (site / drawings)</option>
                <option value="QualityInspection">Request QI fill (separate from Procore QI form)</option>
              </Select>
            )}
            <Input required placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            <TextArea
              required
              rows={3}
              placeholder={
                isClient
                  ? "Describe your concern"
                  : form.rfiKind === "RequestForInformation"
                    ? "What information do you need?"
                    : "Ask matrix parties / vendor to open and fill the linked checklist (they can attach drawings, revisions, and docs)."
              }
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
            />
            {!isClient && (
              <div className="grid sm:grid-cols-2 gap-2">
                {needsChecklist && (
                  <Select
                    value={form.linkedAssignmentId}
                    onChange={(e) => setForm({ ...form, linkedAssignmentId: e.target.value })}
                  >
                    <option value="">Checklist to fill *</option>
                    {checklistOptions.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.template?.name || a.id}
                      </option>
                    ))}
                  </Select>
                )}
                {needsChecklist && (
                  <Select value={form.responsibleVendorId} onChange={(e) => setForm({ ...form, responsibleVendorId: e.target.value })}>
                    <option value="">Responsible vendor (optional)</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </Select>
                )}
                <Select value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}>
                  <option value="">Assignee</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} · {u.role}
                    </option>
                  ))}
                </Select>
                <Select value={form.linkedDrawingId} onChange={(e) => setForm({ ...form, linkedDrawingId: e.target.value })}>
                  <option value="">Linked drawing (optional)</option>
                  {drawings.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.drawingNumber} — {d.title}
                    </option>
                  ))}
                </Select>
                <Input
                  placeholder="Attachment / note"
                  value={form.attachmentNote}
                  onChange={(e) => setForm({ ...form, attachmentNote: e.target.value })}
                />
                <Select value={form.scheduleImpact} onChange={(e) => setForm({ ...form, scheduleImpact: e.target.value })}>
                  {["None", "Low", "Medium", "High"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </Select>
              </div>
            )}
            <p className="text-xs text-steel-muted">
              {form.rfiKind === "RequestForInformation"
                ? "PMC Request for Information — matrix parties respond / close."
                : "Fillers: Communication Matrix parties, assignee, and responsible vendor."}
            </p>
            <Button type="submit">{isClient ? "Submit concern" : "Open RFI"}</Button>
          </form>
        </Card>
      )}

      <div className="flex flex-wrap gap-1">
        {["All", "Open", "Answered", "Closed"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs ${statusFilter === s ? "bg-brand text-white" : "bg-white border border-line"}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[340px_1fr] gap-4">
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-line font-semibold bg-sand/40">Log</div>
          <ul className="divide-y divide-line max-h-[60vh] overflow-y-auto">
            {filtered.map((r) => (
              <button
                key={r.id}
                className={`w-full text-left px-4 py-3 ${active === r.id ? "bg-brand-soft" : "hover:bg-sand/30"}`}
                onClick={() => setActive(r.id)}
              >
                <div className="flex justify-between gap-2">
                  <span className="font-mono text-[11px] text-brand">{r.number}</span>
                  <Badge tone={r.status === "Open" ? "warn" : r.status === "Closed" ? "ok" : "neutral"}>{r.status}</Badge>
                </div>
                <div className="font-medium text-sm mt-1">{r.subject}</div>
                <div className="text-[11px] text-steel-muted mt-1">
                  {r.rfiKind || "RequestForInformation"} · BIC: {r.ballInCourt}
                  {r.vendor ? ` · ${r.vendor.name}` : ""}
                </div>
              </button>
            ))}
            {!filtered.length && <li className="p-4 text-sm text-steel-muted">No items.</li>}
          </ul>
        </Card>

        <Card>
          {!selected && <p className="text-steel-muted text-sm">Select an item</p>}
          {selected && (
            <div className="space-y-4">
              <div>
                <div className="font-mono text-xs text-brand">{selected.number}</div>
                <h2 className="font-display text-2xl mt-1">{selected.subject}</h2>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge tone="brand">{selected.rfiKind || "RequestForInformation"}</Badge>
                  <Badge tone="brand">Ball: {selected.ballInCourt}</Badge>
                  <Badge>{selected.status}</Badge>
                  {selected.drawing && <Badge tone="neutral">{selected.drawing.drawingNumber}</Badge>}
                  {selected.vendor && <Badge tone="ok">Vendor: {selected.vendor.name}</Badge>}
                </div>
              </div>
              <div className="rounded-xl bg-sand/40 p-4 text-sm whitespace-pre-wrap">{selected.question}</div>
              {(selected.linkedAssignmentId || selected.linkedChecklistItemId) &&
                (selected.rfiKind === "DrawingChecklist" || selected.rfiKind === "QualityInspection") && (
                <div className="rounded-lg border-2 border-brand bg-brand-soft/40 p-4 text-sm space-y-3">
                  <div className="font-semibold text-xs uppercase tracking-wider text-brand">Fill this checklist</div>
                  <p className="text-steel-muted text-xs leading-relaxed">
                    Open the fill form to answer Yes/No/N.A., upload photos & docs, and attach or upload a drawing / revision if needed.
                  </p>
                  <Link to={fillLink}>
                    <Button type="button" className="!text-sm">
                      Fill checklist form →
                    </Button>
                  </Link>
                </div>
              )}
              <div>
                <h3 className="font-semibold text-sm mb-2">Responses</h3>
                <ul className="space-y-2">
                  {selected.responses?.map((resp: any) => (
                    <li key={resp.id} className="rounded-xl border border-line p-3 text-sm">
                      <div className="text-xs text-steel-muted">
                        {resp.respondedBy.fullName} · {new Date(resp.createdAt).toLocaleString()}
                      </div>
                      <div className="mt-1">{resp.responseText}</div>
                    </li>
                  ))}
                </ul>
              </div>
              {canRespond && selected.status !== "Closed" && (
                <form
                  className="space-y-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await api(`/api/rfis/${selected.id}/respond`, {
                      method: "POST",
                      token,
                      body: JSON.stringify({ responseText: answer, isOfficialResponse: true }),
                    });
                    setAnswer("");
                    await load();
                  }}
                >
                  <TextArea rows={3} placeholder="Official response (matrix party)" value={answer} onChange={(e) => setAnswer(e.target.value)} required />
                  <div className="flex gap-2">
                    <Button type="submit">Submit response</Button>
                    {canClose && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={async () => {
                          await api(`/api/rfis/${selected.id}`, {
                            method: "PATCH",
                            token,
                            body: JSON.stringify({ status: "Closed", ballInCourt: "Creator" }),
                          });
                          await load();
                        }}
                      >
                        Close
                      </Button>
                    )}
                  </div>
                </form>
              )}
              {!canRespond && selected.status !== "Closed" && (
                <p className="text-xs text-steel-muted bg-sand/50 p-3 rounded-lg">
                  Respond / close is for Communication Matrix parties — ask Sharnam office under Comms → Matrix.
                </p>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
