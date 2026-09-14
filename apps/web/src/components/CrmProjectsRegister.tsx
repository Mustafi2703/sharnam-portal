import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CrmDetailLines, CrmDetailPanel } from "./crm/CrmDetailPanel";
import { RegisterEmptyRow, RegisterSheetFrame } from "./RegisterSheetFrame";
import { Badge, Button, Input, Select } from "./ui";
import { PROJECT_STATUSES, projectStatusHint } from "../lib/projectStatus";

export type CrmProjectRow = {
  id: string;
  code: string;
  name: string;
  status?: string | null;
  clientName?: string | null;
  clientContactName?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientAddress?: string | null;
  clientGst?: string | null;
  designConsultant?: string | null;
  contractorName?: string | null;
  pmcName?: string | null;
  location?: string | null;
};

const PAGE_SIZE = 50;

type Props = {
  projects: CrmProjectRow[];
  canWrite: boolean;
  onEdit?: (project: CrmProjectRow) => void;
  onDelete?: (project: CrmProjectRow) => void;
  selectedId?: string | null;
  onSelect?: (project: CrmProjectRow) => void;
};

function projectDetailLines(p: CrmProjectRow) {
  return [
    { label: "Project code", value: p.code, mono: true },
    { label: "Project name", value: p.name },
    { label: "Status", value: p.status || "Planning" },
    { label: "Client", value: p.clientName || "—" },
    { label: "Contact", value: p.clientContactName || "—" },
    { label: "Email", value: p.clientEmail || "—" },
    { label: "Phone", value: p.clientPhone || "—", mono: true },
    { label: "Address", value: p.clientAddress || "—" },
    { label: "GST", value: p.clientGst || "—", mono: true },
    { label: "Site location", value: p.location || "—" },
    { label: "Design consultant", value: p.designConsultant || "—" },
    { label: "PMC / SPDC", value: p.pmcName || "—" },
    { label: "Main contractor", value: p.contractorName || "—" },
  ];
}

function filterProjects(rows: CrmProjectRow[], q: string, status: string) {
  const needle = q.trim().toLowerCase();
  return rows.filter((p) => {
    if (status !== "all" && (p.status || "") !== status) return false;
    if (!needle) return true;
    const hay = [p.code, p.name, p.clientName, p.location, p.designConsultant, p.contractorName]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(needle);
  });
}

export function CrmProjectsRegister({ projects, canWrite, onEdit, onDelete, selectedId: selectedIdProp, onSelect }: Props) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [selectedIdLocal, setSelectedIdLocal] = useState<string | null>(null);
  const selectedId = selectedIdProp !== undefined ? selectedIdProp : selectedIdLocal;
  const setSelectedId = (id: string | null) => {
    setSelectedIdLocal(id);
    const row = projects.find((p) => p.id === id);
    if (row && onSelect) onSelect(row);
  };

  const statusOptions = useMemo(
    () => [...new Set([...PROJECT_STATUSES, ...projects.map((p) => p.status).filter(Boolean)])] as string[],
    [projects],
  );

  const filtered = useMemo(() => filterProjects(projects, q, status), [projects, q, status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const selected = projects.find((p) => p.id === selectedId) || null;

  return (
    <div className="space-y-3 pb-2">
      <div className="grid lg:grid-cols-[1fr_auto] gap-3 items-end shrink-0">
        <div className="grid sm:grid-cols-2 gap-2">
          <Input
            placeholder="Search code, client, location…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
          />
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">All statuses</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <span className="text-xs text-steel-muted font-mono whitespace-nowrap">
          {pageRows.length} of {filtered.length} · {projects.length} total
        </span>
      </div>

      <div className="grid xl:grid-cols-[1fr_360px] gap-3">
        <RegisterSheetFrame
          title="SPDC projects register"
          sheetLabel="Client card · team & vendors"
          rowCount={filtered.length}
          className="min-h-[320px]"
        >
          <table className="sheet-register__table min-w-[900px]">
            <thead>
              <tr>
                <th>Code</th>
                <th>Project name</th>
                <th>Client</th>
                <th>Location</th>
                <th>Consultant</th>
                <th>Contractor</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!pageRows.length && <RegisterEmptyRow colSpan={8} message="No projects match filters." />}
              {pageRows.map((p) => (
                <tr
                  key={p.id}
                  className={selectedId === p.id ? "bg-brand/5 cursor-pointer" : "cursor-pointer hover:bg-sand/30"}
                  onClick={() => setSelectedId(p.id)}
                >
                  <td className="font-mono text-xs text-brand">{p.code}</td>
                  <td className="font-medium max-w-[200px]">
                    <div className="line-clamp-2">{p.name}</div>
                  </td>
                  <td className="text-xs max-w-[140px]">
                    <div className="line-clamp-1">{p.clientName || "—"}</div>
                    {p.clientContactName && (
                      <div className="text-[10px] text-steel-muted line-clamp-1">{p.clientContactName}</div>
                    )}
                  </td>
                  <td className="text-xs max-w-[120px]">
                    <span className="line-clamp-2">{p.location || "—"}</span>
                  </td>
                  <td className="text-xs max-w-[120px]">
                    <span className="line-clamp-2">{p.designConsultant || "—"}</span>
                  </td>
                  <td className="text-xs max-w-[120px]">
                    <span className="line-clamp-2">{p.contractorName || "—"}</span>
                  </td>
                  <td>
                    <Badge tone={p.status === "In Progress" ? "ok" : p.status === "Planning" || !p.status ? "warn" : "neutral"}>
                      {p.status || "Planning"}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap items-center gap-2">
                      {canWrite && onEdit ? (
                        <Button type="button" variant="secondary" className="!text-xs !py-1.5 !px-3" onClick={() => onEdit(p)}>
                          Edit
                        </Button>
                      ) : null}
                      {canWrite && onDelete ? (
                        <Button
                          type="button"
                          className="!text-xs !py-1.5 !px-3 !bg-danger !border-danger"
                          onClick={() => onDelete(p)}
                        >
                          Delete
                        </Button>
                      ) : null}
                      {!p.status || p.status === "Planning" ? (
                        <Link to={`/crm/setup?projectId=${p.id}&step=project`} className="text-[10px] font-semibold text-brand">
                          Continue setup
                        </Link>
                      ) : (
                        <Link to={`/projects/${p.id}`} className="text-[10px] font-semibold text-brand">
                          Open desk
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </RegisterSheetFrame>

        <CrmDetailPanel title="Project client card" emptyMessage="Select a project to view the full client card.">
          {selected && (
            <>
              <div>
                <div className="text-[10px] font-mono uppercase text-brand">{selected.code}</div>
                <h3 className="font-display text-lg leading-snug">{selected.name}</h3>
                {selected.status && (
                  <span className="inline-block mt-1">
                    <Badge tone={selected.status === "In Progress" ? "ok" : selected.status === "Planning" ? "warn" : "neutral"}>
                      {selected.status}
                    </Badge>
                  </span>
                )}
                <p className="text-[11px] text-steel-muted mt-1">{projectStatusHint(selected.status)}</p>
              </div>
              <CrmDetailLines lines={projectDetailLines(selected)} />
              <div className="flex flex-col gap-2 border-t border-line pt-3">
                {(!selected.status || selected.status === "Planning") ? (
                  <Link to={`/crm/setup?projectId=${selected.id}&step=project`} className="text-sm font-semibold text-brand">
                    Continue setup (parties · staff) →
                  </Link>
                ) : null}
                <Link to={`/projects/${selected.id}`} className="text-sm font-semibold text-brand">
                  Open project tools →
                </Link>
                {canWrite && (onEdit || onDelete) ? (
                  <div className="flex flex-wrap gap-2">
                    {onEdit ? (
                      <Button type="button" variant="secondary" className="!text-xs !py-1.5 !px-3" onClick={() => onEdit(selected)}>
                        Edit
                      </Button>
                    ) : null}
                    {onDelete ? (
                      <Button
                        type="button"
                        className="!text-xs !py-1.5 !px-3 !bg-danger !border-danger"
                        onClick={() => onDelete(selected)}
                      >
                        Delete
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </CrmDetailPanel>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 shrink-0">
          <Button type="button" variant="secondary" disabled={safePage <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            Previous
          </Button>
          <span className="text-xs font-mono text-steel-muted">
            Page {safePage + 1} / {pageCount}
          </span>
          <Button
            type="button"
            variant="secondary"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
