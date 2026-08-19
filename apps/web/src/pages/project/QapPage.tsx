import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api";
import { downloadAuthFile } from "../../lib/downloadReport";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Input, PageHeader, Select } from "../../components/ui";
import { QapDetailRegister, type QapProjectMeta } from "../../components/QapDetailRegister";

/** ISO folder from SharePoint tree — matches MODULE_TO_ISO_FOLDER.qap in graph.ts */
const QAP_FOLDER = "08_QUALITY_HSE_AND_ENVIRONMENT/08.01_Quality_Plans_and_Inspection_Test_Plans";

type DriveItem = { name: string; path: string; type: "folder" | "file"; modifiedAt?: string; url?: string };

/**
 * Quality Assurance Plan — single module page (Week 50 + Detail sheet, full edit).
 */
export default function QapPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [docs, setDocs] = useState<DriveItem[]>([]);
  const [dash, setDash] = useState<any>(null);
  const [project, setProject] = useState<QapProjectMeta | null>(null);
  const [weekFilter, setWeekFilter] = useState("");
  const [file, setFile] = useState<File | null>(null);
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
  const canManage = ["admin", "office", "employee", "site_employee"].includes(user?.role || "");
  const canUpload = ["admin", "office", "site_employee"].includes(user?.role || "");

  const load = async () => {
    if (!id) return;
    try {
      const [dmsRes, dashRes, projRes] = await Promise.all([
        api<{ children: DriveItem[]; path: string }>(
          `/api/dms/${id}/browse?path=${encodeURIComponent(QAP_FOLDER)}&sync=0`,
          { token }
        ).catch(() => ({ children: [] })),
        api<{ qap?: unknown[]; totals?: { qapOpen?: number; qapDone?: number } }>(
          `/api/checklist/project/${id}/quality-dashboard`,
          { token }
        ).catch(() => null),
        api<QapProjectMeta>(`/api/projects/${id}`, { token }).catch(() => null),
      ]);
      const files = (dmsRes.children || []).filter((f) => f.type === "file");
      setDocs(
        files.length
          ? files
          : (dmsRes.children || []).filter(
              (f) =>
                f.type === "file" &&
                (/qap|assurance|quality.?plan/i.test(f.name || f.path || "") ||
                  (f.path || "").toLowerCase().includes("qap"))
            )
      );
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
        const qapList = dashRes.qap as { weekLabel?: string }[];
        const preferred =
          qapList.find((q) => /week\s*50/i.test(String(q.weekLabel || ""))) ||
          qapList.find((q) => q.weekLabel === "W50") ||
          qapList[0];
        if (preferred?.weekLabel) setWeekFilter(String(preferred.weekLabel));
      }
    } catch {
      setDocs([]);
    }
  };

  useEffect(() => {
    void load();
  }, [id, token]);

  const weeks = useMemo(() => {
    const set = new Set<string>();
    (dash?.qap || []).forEach((q: any) => q.weekLabel && set.add(q.weekLabel));
    return Array.from(set).sort((a, b) => {
      const prefer = (w: string) => (/week\s*50/i.test(w) ? 0 : w === "W50" ? 1 : 2);
      return prefer(a) - prefer(b) || b.localeCompare(a);
    });
  }, [dash?.qap]);

  const qapRows = useMemo(() => {
    const rows = dash?.qap || [];
    if (!weekFilter) return rows.filter((q: any) => /week\s*50|^w50$/i.test(q.weekLabel || ""));
    return rows.filter((q: any) => q.weekLabel === weekFilter);
  }, [dash?.qap, weekFilter]);

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    if (!file || !id) return;
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", QAP_FOLDER);
      await api(`/api/dms/${id}/upload`, { method: "POST", token, body: fd });
      setMsg("QAP file saved to DMS. Re-seed or add rows below to sync activity lines.");
      setFile(null);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Quality module"
        title="Quality Assurance Plan"
        subtitle="Full QAP register — same layout as Week 50 / Detail Excel. Edit contractor, PMC & client sign-offs, remarks, and status per line."
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
          </div>
        }
      />

      {msg && <p className="text-sm rounded-xl px-3 py-2 bg-brand-soft text-brand-dark">{msg}</p>}

      {weeks.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center text-sm">
          <span className="text-steel-muted font-semibold">Week / plan:</span>
          <Select value={weekFilter} onChange={(e) => setWeekFilter(e.target.value)} className="!w-auto min-w-[8rem]">
            <option value="">All weeks</option>
            {weeks.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </Select>
          {canManage && (
            <>
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
                    setMsg(`Loaded ${out.imported} QAP lines from Week 50 template (${out.weekLabel})`);
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
              <input
                ref={importRef}
                type="file"
                accept=".xlsx,.xlsm"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f || !id) return;
                  setBusy(true);
                  try {
                    const fd = new FormData();
                    fd.append("file", f);
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
                    e.target.value = "";
                  }
                }}
              />
              <Button type="button" variant="secondary" className="!text-xs" disabled={busy} onClick={() => importRef.current?.click()}>
                Import Week 50 Excel
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="!text-xs"
                disabled={busy}
                onClick={async () => {
                  if (!id) return;
                  const q = weekFilter ? `?week=${encodeURIComponent(weekFilter)}` : "";
                  await downloadAuthFile(`/api/checklist/project/${id}/qap/download.xlsx${q}`, token, `QAP-${weekFilter || "export"}.xlsx`);
                }}
              >
                Download Excel
              </Button>
              <Button
                type="button"
                className="!text-xs"
                disabled={busy}
                onClick={async () => {
                  if (!id) return;
                  const q = weekFilter ? `?week=${encodeURIComponent(weekFilter)}` : "";
                  await downloadAuthFile(`/api/checklist/project/${id}/qap/download.html${q}`, token, `QAP-${weekFilter || "export"}.html`);
                }}
              >
                Download PDF (print)
              </Button>
            </>
          )}
        </div>
      )}

      <QapDetailRegister
        projectId={id!}
        token={token}
        rows={qapRows}
        canEdit={canManage}
        onUpdated={load}
        showWeekFilter={false}
        project={project}
      />

      {canManage && (
        <Card>
          <h3 className="font-semibold mb-3">Add QAP line</h3>
          <form
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
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
                setMsg("QAP line added");
                await load();
              } catch (err) {
                setMsg(err instanceof Error ? err.message : "Failed");
              }
            }}
          >
            <Input
              placeholder="Week (e.g. W50)"
              value={addForm.weekLabel}
              onChange={(e) => setAddForm({ ...addForm, weekLabel: e.target.value })}
              required
            />
            <Input
              placeholder="Activity section (e.g. Site Survey)"
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
            <Input
              placeholder="Frequency of check"
              value={addForm.frequency}
              onChange={(e) => setAddForm({ ...addForm, frequency: e.target.value })}
            />
            <Input
              placeholder="Code of conformance"
              value={addForm.codeOfConformance}
              onChange={(e) => setAddForm({ ...addForm, codeOfConformance: e.target.value })}
            />
            <Input
              placeholder="Test agency"
              value={addForm.testAgency}
              onChange={(e) => setAddForm({ ...addForm, testAgency: e.target.value })}
            />
            <Button type="submit" className="sm:col-span-2 lg:col-span-3 sm:w-auto">
              Add to QAP
            </Button>
          </form>
        </Card>
      )}

      {canUpload && (
        <Card>
          <h3 className="font-semibold mb-2">Upload master QAP file</h3>
          <p className="text-sm text-steel-muted mb-3">
            Saves to DMS <code className="text-xs">{QAP_FOLDER.split("/").pop()}</code> — Week 50 Excel or latest revision PDF.
          </p>
          <form className="flex flex-wrap items-end gap-3" onSubmit={onUpload}>
            <input
              type="file"
              accept=".xlsx,.xls,.pdf,.doc,.docx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-sm"
            />
            <Button type="submit" disabled={!file || busy}>
              {busy ? "Uploading…" : "Save to DMS"}
            </Button>
          </form>
        </Card>
      )}

      <Card>
        <h3 className="font-semibold mb-3">QAP files on DMS</h3>
        <ul className="divide-y divide-line text-sm">
          {docs.map((d) => (
            <li key={d.path || d.name} className="py-2 flex justify-between gap-2">
              <span>{d.name}</span>
              <Badge tone="neutral">{d.modifiedAt ? new Date(d.modifiedAt).toLocaleDateString() : "—"}</Badge>
            </li>
          ))}
          {!docs.length && (
            <li className="py-6 text-steel-muted">
              No QAP file on DMS yet — upload Week 50 Excel above or{" "}
              <Link to={`/projects/${id}/dms`} className="text-brand font-semibold">
                open DMS →
              </Link>
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
}
