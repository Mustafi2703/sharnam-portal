import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api";
import { downloadAuthFile } from "../../lib/downloadReport";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader, Select } from "../../components/ui";
import { QapDetailRegister, type QapProjectMeta } from "../../components/QapDetailRegister";
import { ReferenceSheetToolbar } from "../../components/ReferenceSheetToolbar";
import { normalizeWeekLabel, preferWeekLabel, qapNeedsFullResync, weekMatchesFilter } from "../../lib/qapWeek";

/** ISO folder from SharePoint tree — matches MODULE_TO_ISO_FOLDER.qap in graph.ts */
const QAP_FOLDER = "08_QUALITY_HSE_AND_ENVIRONMENT/08.01_Quality_Plans_and_Inspection_Test_Plans";

/**
 * Quality Assurance Plan — full Week 50 register; toolbar at top, sheet fills viewport.
 */
export default function QapPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [dash, setDash] = useState<any>(null);
  const [project, setProject] = useState<QapProjectMeta | null>(null);
  const [weekFilter, setWeekFilter] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    weekLabel: "Week 50",
    section: "",
    description: "",
    frequency: "",
    codeOfConformance: "",
    testAgency: "",
  });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const autoSyncRef = useRef(false);
  const canManage = ["admin", "office", "employee", "site_employee"].includes(user?.role || "");

  const load = async () => {
    if (!id) return;
    try {
      const [dashRes, projRes] = await Promise.all([
        api<{ qap?: unknown[]; totals?: { qapOpen?: number; qapDone?: number } }>(
          `/api/checklist/project/${id}/quality-dashboard`,
          { token }
        ).catch(() => null),
        api<QapProjectMeta>(`/api/projects/${id}`, { token }).catch(() => null),
      ]);
      setDash(dashRes);
      if (projRes) {
        setProject({
          name: projRes.name,
          code: projRes.code,
          clientName: projRes.clientName,
          designConsultant: projRes.designConsultant,
          contractorName: projRes.contractorName,
        });
      }
      if (!weekFilter && dashRes?.qap?.length) {
        const labels = (dashRes.qap as { weekLabel?: string }[]).map((q) => q.weekLabel).filter(Boolean) as string[];
        setWeekFilter(preferWeekLabel(labels));
      }
    } catch {
      setDash(null);
    }
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  /** Auto-load full Week 50 template when register is empty, partial, or legacy. */
  useEffect(() => {
    if (!id || !canManage || !dash) return;
    const rows = (dash.qap || []) as Parameters<typeof qapNeedsFullResync>[0];
    if (!qapNeedsFullResync(rows)) return;
    if (autoSyncRef.current) return;
    autoSyncRef.current = true;
    void (async () => {
      setBusy(true);
      try {
        const out = await api<{ imported: number; weekLabel: string }>(
          `/api/checklist/project/${id}/qap/sync-template`,
          { method: "POST", token }
        );
        setMsg(`Loaded ${out.imported} QAP lines from Week 50 template (${out.weekLabel})`);
        setWeekFilter(out.weekLabel);
        await load();
      } catch (err) {
        autoSyncRef.current = false;
        setMsg(err instanceof Error ? err.message : "Load Week 50 template failed — use toolbar");
      } finally {
        setBusy(false);
      }
    })();
  }, [dash, id, canManage, token]);

  const weeks = useMemo(() => {
    const set = new Set<string>();
    (dash?.qap || []).forEach((q: any) => q.weekLabel && set.add(q.weekLabel));
    return Array.from(set).sort((a, b) => {
      const na = normalizeWeekLabel(a);
      const nb = normalizeWeekLabel(b);
      if (na === "Week 50") return -1;
      if (nb === "Week 50") return 1;
      return b.localeCompare(a);
    });
  }, [dash?.qap]);

  const qapRows = useMemo(() => {
    const rows = dash?.qap || [];
    if (!weekFilter) return rows.filter((q: any) => weekMatchesFilter(q.weekLabel, "Week 50"));
    return rows.filter((q: any) => weekMatchesFilter(q.weekLabel, weekFilter));
  }, [dash?.qap, weekFilter]);

  async function importExcel(file: File) {
    if (!id) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const out = await api<{ imported: number; weekLabel: string }>(
        `/api/checklist/project/${id}/qap/import`,
        { method: "POST", token, body: fd }
      );
      setMsg(`Imported ${out.imported} QAP lines for ${out.weekLabel}`);
      setWeekFilter(out.weekLabel);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadToDms(file: File) {
    if (!id) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", QAP_FOLDER);
      await api(`/api/dms/${id}/upload`, { method: "POST", token, body: fd });
      setMsg("QAP master file saved to DMS");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function onAddRow(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setBusy(true);
    try {
      await api(`/api/checklist/project/${id}/qap`, {
        method: "POST",
        token,
        body: JSON.stringify({
          weekLabel: addForm.weekLabel,
          section: addForm.section,
          activity: addForm.section,
          description: addForm.description,
          discipline: addForm.section,
          frequency: addForm.frequency,
          codeOfConformance: addForm.codeOfConformance,
          testAgency: addForm.testAgency,
        }),
      });
      setAddForm({ ...addForm, section: "", description: "", frequency: "", codeOfConformance: "", testAgency: "" });
      setAddOpen(false);
      setMsg("QAP line added");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="qap-page page-stack--register flex flex-col min-h-0">
      <PageHeader
        eyebrow="Quality module"
        title="Quality Assurance Plan"
        subtitle="Full Week 50 register — scroll the sheet; edit any cell inline."
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge tone="brand">{dash?.totals?.qapOpen ?? 0} open</Badge>
            <Badge tone="ok">{dash?.totals?.qapDone ?? 0} done</Badge>
            <Badge tone="neutral">{qapRows.length} lines</Badge>
            <Link to={`/projects/${id}/inspections`}>
              <Button type="button" variant="secondary">
                Quality dashboard →
              </Button>
            </Link>
            <Link to={`/projects/${id}/dms`}>
              <Button type="button" variant="secondary">
                DMS files →
              </Button>
            </Link>
          </div>
        }
      />

      {(qapRows.length === 0 || qapNeedsFullResync(dash?.qap || [])) && !busy && (
        <Card className="!p-3 border-amber-200 bg-amber-50 shrink-0">
          <p className="text-sm text-amber-900">
            {qapRows.length === 0
              ? "No QAP lines — use Load Week 50 in the toolbar or upload the client Excel."
              : "Register is partial — reload Week 50 template from the toolbar."}
          </p>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 items-center text-sm shrink-0">
        <span className="text-steel-muted font-semibold">Week:</span>
        <Select value={weekFilter} onChange={(e) => setWeekFilter(e.target.value)} className="!w-auto min-w-[8rem]">
          <option value="">All weeks</option>
          {weeks.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </Select>
        {canManage && (
          <Button
            type="button"
            variant="secondary"
            className="!text-xs"
            disabled={busy}
            onClick={async () => {
              if (!id) return;
              setBusy(true);
              try {
                const out = await api<{ imported: number; weekLabel: string }>(
                  `/api/checklist/project/${id}/qap/sync-template`,
                  { method: "POST", token }
                );
                setMsg(`Loaded ${out.imported} QAP lines (${out.weekLabel})`);
                setWeekFilter(out.weekLabel);
                await load();
              } catch (err) {
                setMsg(err instanceof Error ? err.message : "Sync failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            Load Week 50 template
          </Button>
        )}
      </div>

      <ReferenceSheetToolbar
        sheetLabel={`QAP — ${weekFilter || "Week 50"}`}
        rowCount={qapRows.length}
        canEdit={canManage}
        busy={busy}
        message={msg || undefined}
        onAddRow={() => setAddOpen((v) => !v)}
        onUpload={async (file) => {
          if (/\.xlsx?$/i.test(file.name)) await importExcel(file);
          else await uploadToDms(file);
        }}
        uploadTitle="Upload QAP Excel or master file"
        uploadHint="Week 50 .xlsx imports activity lines; PDF/DOC saves to DMS quality folder."
        onDownloadXlsx={async () => {
          if (!id) return;
          const q = weekFilter ? `?week=${encodeURIComponent(weekFilter)}` : "";
          await downloadAuthFile(`/api/checklist/project/${id}/qap/download.xlsx${q}`, token, `QAP-${weekFilter || "export"}.xlsx`);
        }}
        onGenerate={
          canManage
            ? async () => {
                if (!id) return;
                const q = weekFilter ? `?week=${encodeURIComponent(weekFilter)}` : "";
                await downloadAuthFile(`/api/checklist/project/${id}/qap/download.html${q}`, token, `QAP-${weekFilter || "export"}.html`);
              }
            : undefined
        }
        generateLabel="Print / PDF"
      />

      <input
        ref={importRef}
        type="file"
        accept=".xlsx,.xlsm"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) await importExcel(f);
          e.target.value = "";
        }}
      />

      {addOpen && canManage && (
        <Card className="!p-3 shrink-0">
          <form className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2" onSubmit={onAddRow}>
            <Input
              placeholder="Week (e.g. Week 50)"
              value={addForm.weekLabel}
              onChange={(e) => setAddForm({ ...addForm, weekLabel: e.target.value })}
              required
            />
            <Input
              placeholder="Activity section"
              value={addForm.section}
              onChange={(e) => setAddForm({ ...addForm, section: e.target.value })}
              required
            />
            <Input
              placeholder="Description / material"
              value={addForm.description}
              onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
              required
            />
            <Input placeholder="Frequency" value={addForm.frequency} onChange={(e) => setAddForm({ ...addForm, frequency: e.target.value })} />
            <Input placeholder="Code of conformance" value={addForm.codeOfConformance} onChange={(e) => setAddForm({ ...addForm, codeOfConformance: e.target.value })} />
            <Input placeholder="Test agency" value={addForm.testAgency} onChange={(e) => setAddForm({ ...addForm, testAgency: e.target.value })} />
            <div className="sm:col-span-2 lg:col-span-3 flex gap-2">
              <Button type="submit" disabled={busy}>
                Add line
              </Button>
              <Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="qap-page__register flex-1 min-h-0 flex flex-col">
        <QapDetailRegister
          projectId={id!}
          token={token}
          rows={qapRows}
          canEdit={canManage}
          onUpdated={load}
          showWeekFilter={false}
          project={project}
          loading={busy}
        />
      </div>
    </div>
  );
}
