import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader } from "../components/ui";
import DmsPage from "./DmsPage";

type ProjectRow = { id: string; code: string; name: string; clientName?: string | null; location?: string | null };

const QUALITY_ISO = "08_QUALITY_HSE_AND_ENVIRONMENT/08.01_Quality_Plans_and_Inspection_Test_Plans";

/** Office/admin — browse every project's ISO library from one desk. */
export default function OfficeDmsViewerPage() {
  const { token, user } = useAuth();
  const canBrowse = user?.role === "admin" || user?.role === "office";
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [filter, setFilter] = useState("");
  const [folderJump, setFolderJump] = useState("");
  const selectedId = searchParams.get("project") || "";

  useEffect(() => {
    if (!canBrowse || !token) return;
    void api<ProjectRow[]>("/api/projects", { token })
      .then(setProjects)
      .catch(() => setProjects([]));
  }, [token, canBrowse]);

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return projects;
    return projects.filter((p) => `${p.code} ${p.name} ${p.clientName || ""} ${p.location || ""}`.toLowerCase().includes(needle));
  }, [projects, filter]);

  const selected = projects.find((p) => p.id === selectedId) || null;

  function selectProject(id: string, folder = "") {
    const q = new URLSearchParams(searchParams);
    if (id) q.set("project", id);
    else q.delete("project");
    setSearchParams(q, { replace: true });
    setFolderJump(folder);
  }

  if (!canBrowse) {
    return (
      <Card className="max-w-lg mx-auto mt-12 space-y-3">
        <h1 className="font-display text-2xl">All-project documents</h1>
        <p className="text-sm text-steel-muted">Only Office and Admin can browse every project ISO library.</p>
        <Link to="/dashboard" className="text-sm font-semibold text-brand">
          Back to dashboard →
        </Link>
      </Card>
    );
  }

  return (
    <div className="office-dms-viewer page-scroll-full space-y-4 min-w-0 pb-8 w-full">
      <PageHeader
        eyebrow="Office · Documents"
        title="All-project DMS"
        subtitle="Pick any delivery project and browse its ISO folder tree — QAP, checklists, drawings, and commercial files."
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">{projects.length} projects</Badge>
            <Link to="/master">
              <Button type="button" variant="secondary">
                Directory
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid lg:grid-cols-[minmax(16rem,20rem)_1fr] gap-4 items-start">
        <Card className="!p-3 space-y-2 lg:sticky lg:top-3">
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search code, name, client…" />
          <ul className="max-h-[70vh] overflow-y-auto divide-y border rounded-xl bg-paper">
            {filtered.map((p) => {
              const active = p.id === selectedId;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-brand-soft/40 ${
                      active ? "bg-brand-soft/70 ring-1 ring-brand/30" : ""
                    }`}
                    onClick={() => selectProject(p.id)}
                  >
                    <div className="font-semibold font-mono text-ink">{p.code}</div>
                    <div className="text-xs text-steel-muted line-clamp-2">{p.name}</div>
                    {p.clientName ? <div className="text-[10px] text-steel-muted mt-0.5">{p.clientName}</div> : null}
                  </button>
                </li>
              );
            })}
            {!filtered.length && (
              <li className="px-3 py-8 text-sm text-steel-muted text-center">No projects match.</li>
            )}
          </ul>
        </Card>

        <div className="min-w-0 space-y-3">
          {selected ? (
            <>
              <Card className="!p-3 flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold flex-1 min-w-[12rem]">
                  <span className="font-mono">{selected.code}</span>
                  <span className="text-steel-muted font-normal"> · {selected.name}</span>
                </p>
                <Button type="button" variant="secondary" className="!text-xs" onClick={() => selectProject(selected.id, QUALITY_ISO)}>
                  Open QAP folder
                </Button>
                <Link to={`/projects/${selected.id}/dms`}>
                  <Button type="button" variant="secondary" className="!text-xs">
                    Project DMS
                  </Button>
                </Link>
                <Link to={`/projects/${selected.id}/qap`}>
                  <Button type="button" variant="secondary" className="!text-xs">
                    QAP register
                  </Button>
                </Link>
              </Card>
              <DmsPage
                key={`${selected.id}:${folderJump}`}
                projectId={selected.id}
                embedded
                initialPath={folderJump}
              />
            </>
          ) : (
            <Card className="py-16 text-center space-y-2">
              <p className="font-semibold">Select a project</p>
              <p className="text-sm text-steel-muted">Office can open every ISO library without switching project context first.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
