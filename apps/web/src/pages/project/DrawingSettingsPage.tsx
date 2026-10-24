import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatDayMonYear, mondayDayKey } from "@sharnam/shared";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { DrawingPicklistSetup } from "../../components/DrawingPicklistSetup";
import { DrawingPackMenu } from "../../components/DrawingPackMenu";
import { useDrawingsStart, type DrawingsWeekStart } from "../../components/ProjectWeekPicker";
import { StatusNote } from "../../components/StatusNote";
import { Button, Card, PageHeader } from "../../components/ui";
import { formatUiText } from "../../lib/formatUiText";
import { useDrawingPicklists } from "../../lib/drawingPicklists";

type Loader = {
  key: string;
  title: string;
  file: string;
  path: (id: string) => string;
  what: string;
  summary: (out: any) => string;
};

const LOADERS: Loader[] = [
  {
    key: "register",
    title: "Master & site drawing register",
    file: "DRAWING REGISTER - 01.xlsx",
    path: (id) => `/api/drawings/project/${id}/register/import`,
    what: "Reads the Master Drawing Register sheet (all columns) and the Input sheet, which sets this project's pick-lists.",
    summary: (o) => `${o.lines} register lines loaded${o.picklists?.length ? `; pick-lists set from the Input sheet (${o.picklists.join(", ")})` : ""}.`,
  },
  {
    key: "gfc",
    title: "Approval & GFC Log",
    file: "Approval & GFC Drawing Log.xlsx",
    path: (id) => `/api/drawings/project/${id}/gfc-log/import`,
    what: "Creates every drawing row and its R0–Rn dates. The PDF/DWG files are added later, each behind its Drawing Check.",
    summary: (o) => `${o.drawings} drawings and ${o.revisions} revision dates loaded.`,
  },
  {
    key: "rfi",
    title: "RFI register",
    file: "SPDC_RFI_Form_and_Register.xlsx",
    path: (id) => `/api/rfis/project/${id}/register/import`,
    what: "Reads the 04_RFI_REGISTER sheet: each row becomes an RFI (kept by RFI number) with its response, dates, priority and package.",
    summary: (o) => `${o.created} RFIs created, ${o.updated} updated, ${o.responses} responses added.`,
  },
];

/** Week 1 anchor for the drawing register dashboard and the weekly SharePoint folders. */
function DrawingsStartDateCard({
  projectId,
  token,
  canManage,
  onMsg,
}: {
  projectId: string;
  token?: string | null;
  canManage: boolean;
  onMsg: (msg: string) => void;
}) {
  const start = useDrawingsStart(projectId, token);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (start.loaded) setValue(start.drawingsStartDate || "");
  }, [start.loaded, start.drawingsStartDate]);

  const anchor = value || start.projectStartDate;
  const weekOne = anchor ? mondayDayKey(anchor) : null;
  const dirty = value !== (start.drawingsStartDate || "");

  async function saveStart() {
    setSaving(true);
    try {
      const out = await api<DrawingsWeekStart>(`/api/drawings/project/${projectId}/settings`, {
        method: "PUT",
        token,
        body: JSON.stringify({ drawingsStartDate: value || "" }),
      });
      start.setValue(out);
      onMsg(
        out.drawingsStartDate
          ? `Drawings start date saved. Week 1 starts on ${formatDayMonYear(mondayDayKey(out.drawingsStartDate))}.`
          : "Drawings start date cleared. Weeks count from the project start date.",
      );
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Could not save the drawings start date");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-2">
      <h3 className="font-semibold">{formatUiText("0. Drawings start date")}</h3>
      <Card className="space-y-3">
        <p className="text-sm text-steel-muted">
          Week 1 of the drawing register starts on the Monday of this week. Leave empty to use the project start date.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-steel-muted">
            {formatUiText("Drawings start date")}
            <input
              type="date"
              className="mt-1 block rounded-lg border border-line bg-paper px-2 py-1.5 text-sm text-ink disabled:opacity-60"
              value={value}
              disabled={!canManage || saving}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
          {canManage ? (
            <>
              <Button type="button" disabled={saving || !dirty} onClick={() => void saveStart()}>
                {saving ? "Saving…" : "Save"}
              </Button>
              {value ? (
                <Button type="button" variant="ghost" disabled={saving} onClick={() => setValue("")}>
                  Clear
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
        <p className="text-sm text-ink">
          {weekOne ? (
            <>
              {formatUiText("Week 1")} = <strong>{formatDayMonYear(weekOne)}</strong>
              {!value ? <span className="text-steel-muted"> ({formatUiText("from the project start date")})</span> : null}
            </>
          ) : (
            <span className="text-steel-muted">No drawings start date or project start date set yet, so week numbers show as Week -.</span>
          )}
        </p>
        {!canManage ? <p className="text-xs text-steel-muted">Only admin and office can change the drawings start date.</p> : null}
      </Card>
    </section>
  );
}

/** Drawing settings — pick-lists, reference workbooks and SharePoint, all in the Drawings module. */
export default function DrawingSettingsPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const picklists = useDrawingPicklists(id, token);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const canManage = user?.role === "admin" || user?.role === "office";

  async function load(l: Loader, f: File) {
    if (!id) return;
    setBusy(l.key);
    setMsg(`Loading ${f.name}…`);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const out = await api<any>(l.path(id), { method: "POST", token, body: fd, timeoutMs: 180_000 });
      setMsg(`${l.title}: ${l.summary(out)}`);
      if (l.key === "register") await picklists.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : `Could not load ${l.title}`);
    } finally {
      setBusy("");
    }
  }

  async function save() {
    if (!id) return;
    setBusy("sync");
    setMsg("Generating the registers and saving them to SharePoint…");
    try {
      await api(`/api/drawings/project/${id}/publish-registers`, { method: "POST", token, timeoutMs: 180_000 });
      setMsg("Master register, Approval & GFC Log, drawing dashboard and RFI register generated and saved to the project's SharePoint folders.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not save to SharePoint");
    } finally {
      setBusy("");
    }
  }

  if (!id) return null;
  return (
    <div className="space-y-4 min-w-0 pb-8">
      <PageHeader
        eyebrow="Drawings module · Settings"
        title="Drawing settings"
      />
      <StatusNote msg={msg} />

      <DrawingsStartDateCard projectId={id} token={token} canManage={canManage} onMsg={setMsg} />

      <section className="space-y-2">
        <h3 className="font-semibold">1. Pick-lists</h3>
        {canManage ? (
          <DrawingPicklistSetup projectId={id} token={token} state={picklists} onSaved={picklists.reload} />
        ) : (
          <Card><p className="text-sm text-steel-muted">Only admin and office can change the pick-lists.</p></Card>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">2. Load the reference workbooks</h3>
        <div className="grid md:grid-cols-3 gap-3">
          {LOADERS.map((l) => (
            <Card key={l.key} className="space-y-2">
              <div className="font-semibold text-sm">{l.title}</div>
              <div className="text-[11px] font-mono text-steel-muted">{l.file}</div>
              <p className="text-xs text-steel-muted">{l.what}</p>
              {canManage ? (
                <>
                  <input
                    ref={(el) => {
                      fileRefs.current[l.key] = el;
                    }}
                    type="file"
                    accept=".xlsx,.xls"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) void load(l, f);
                    }}
                  />
                  <Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => fileRefs.current[l.key]?.click()}>
                    {busy === l.key ? "Loading…" : "Choose Excel and load"}
                  </Button>
                </>
              ) : null}
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">3. People and portal access</h3>
        <Card className="space-y-2">
          <p className="text-sm text-steel-muted">
            RFIs and design coordination are assigned to people on this project's team. To put everyone from the communication matrix on the team in one go, open the matrix and use <strong>Open portal for everyone</strong>.
          </p>
          <Link to={`/projects/${id}/comms?tab=matrix`} className="text-sm font-semibold text-brand">Open the communication matrix →</Link>
        </Card>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">4. Generate the sheets</h3>
        <Card className="space-y-3">
          <p className="text-sm text-steel-muted">Generated fresh from the database in the client's formats. The same menu sits in the Approval & GFC Log, the master register, the dashboard and the RFI register. Take one sheet, or the whole pack.</p>
          <DrawingPackMenu projectId={id} token={token} onMsg={setMsg} canPublish={canManage} panel />
        </Card>
      </section>
    </div>
  );
}
