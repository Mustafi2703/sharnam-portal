import { useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { DrawingPicklistSetup } from "../../components/DrawingPicklistSetup";
import { StatusNote } from "../../components/StatusNote";
import { Button, Card, PageHeader } from "../../components/ui";
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
    title: "Approval & GFC drawing log",
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
      setMsg("Master register, GFC log, drawing dashboard and RFI register saved to the project's SharePoint folders.");
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
        subtitle="Pick-lists for the register, RFIs and design coordination; load the client's reference workbooks; save the generated sheets to SharePoint."
      />
      <StatusNote msg={msg} />

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
        <h3 className="font-semibold">4. Generate and save to SharePoint</h3>
        <Card className="space-y-2">
          <p className="text-sm text-steel-muted">Generates the master register, the Approval &amp; GFC log, the drawing dashboard and the RFI register from the database and files them in this project's SharePoint folders.</p>
          {canManage ? (
            <Button type="button" disabled={Boolean(busy)} onClick={() => void save()}>
              {busy === "sync" ? "Saving…" : "Generate and save to SharePoint"}
            </Button>
          ) : null}
        </Card>
      </section>
    </div>
  );
}
