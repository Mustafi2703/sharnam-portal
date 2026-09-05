import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Badge, Button, Card, Input } from "./ui";
import { WorkPackagesPanel } from "./WorkPackagesPanel";

type SetupSummary = {
  project: {
    id: string;
    code: string;
    name: string;
    clientName?: string | null;
    status: string;
  };
  lead?: { id: string; title: string; stage: string } | null;
  members: {
    id: string;
    userId: string;
    fullName: string;
    email: string;
    portalRole: string;
    role: string;
  }[];
};

type Props = {
  projectId: string;
  token: string;
  onMsg?: (text: string) => void;
};

/** Step 1 companion — edit project spine, team display names, packages, DMS links. */
export function CrmBidProjectSetupSection({ projectId, token, onMsg }: Props) {
  const [summary, setSummary] = useState<SetupSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [projectForm, setProjectForm] = useState({
    name: "",
    clientName: "",
    location: "",
    clientContactName: "",
    clientEmail: "",
  });
  const [nameEdits, setNameEdits] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!projectId) return;
    const s = await api<SetupSummary & { project: SetupSummary["project"] & { location?: string; clientContactName?: string; clientEmail?: string } }>(
      `/api/projects/${projectId}/setup-summary`,
      { token }
    );
    setSummary(s);
    setProjectForm({
      name: s.project.name || "",
      clientName: s.project.clientName || "",
      location: (s.project as { location?: string }).location || "",
      clientContactName: (s.project as { clientContactName?: string }).clientContactName || "",
      clientEmail: (s.project as { clientEmail?: string }).clientEmail || "",
    });
    const edits: Record<string, string> = {};
    for (const m of s.members) edits[m.userId] = m.fullName;
    setNameEdits(edits);
  }, [projectId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveProject(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/api/projects/${projectId}/settings`, {
        method: "PATCH",
        token,
        body: JSON.stringify(projectForm),
      });
      onMsg?.("Project details saved.");
      await load();
    } catch (err) {
      onMsg?.(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveMemberName(userId: string) {
    const fullName = nameEdits[userId]?.trim();
    if (!fullName) return;
    setBusy(true);
    try {
      await api(`/api/users/${userId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ fullName }),
      });
      onMsg?.(`Updated display name → ${fullName}`);
      await load();
    } catch (err) {
      onMsg?.(err instanceof Error ? err.message : "Name update failed");
    } finally {
      setBusy(false);
    }
  }

  if (!summary) {
    return <p className="text-xs text-steel-muted py-2">Loading project directory…</p>;
  }

  return (
    <div className="space-y-4 border border-line rounded-xl p-4 bg-sand/20">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="font-semibold text-sm">Project directory &amp; files</h4>
          <p className="text-[11px] text-steel-muted mt-0.5">
            Confirm client, team names (comms matrix / RFIs), work packages, and DMS access before opening R2 bids.
          </p>
        </div>
        <Badge tone="brand">{summary.project.code}</Badge>
      </div>

      {summary.lead && (
        <p className="text-xs text-steel-muted">
          CRM lead: <span className="font-medium text-ink">{summary.lead.title}</span> · {summary.lead.stage}
        </p>
      )}

      <form className="grid sm:grid-cols-2 gap-2" onSubmit={saveProject}>
        <Input
          placeholder="Project name"
          value={projectForm.name}
          onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
        />
        <Input
          placeholder="Client organisation"
          value={projectForm.clientName}
          onChange={(e) => setProjectForm({ ...projectForm, clientName: e.target.value })}
        />
        <Input
          placeholder="Site location"
          value={projectForm.location}
          onChange={(e) => setProjectForm({ ...projectForm, location: e.target.value })}
        />
        <Input
          placeholder="Client contact name"
          value={projectForm.clientContactName}
          onChange={(e) => setProjectForm({ ...projectForm, clientContactName: e.target.value })}
        />
        <Input
          placeholder="Client email"
          type="email"
          value={projectForm.clientEmail}
          onChange={(e) => setProjectForm({ ...projectForm, clientEmail: e.target.value })}
        />
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          <Button type="submit" variant="secondary" className="!text-xs" disabled={busy}>
            Save project details
          </Button>
          <Link to={`/projects/${projectId}/dms`} className="text-xs font-semibold text-brand self-center">
            Open DMS / ISO folders →
          </Link>
          <Link to={`/projects/${projectId}/directory`} className="text-xs font-semibold text-brand self-center">
            Project directory →
          </Link>
          <Link to={`/master?tab=projects`} className="text-xs font-semibold text-brand self-center">
            Directory setup →
          </Link>
        </div>
      </form>

      <Card className="!p-3 space-y-2">
        <h5 className="text-xs font-mono uppercase text-steel-muted">Team — edit display names (office admin)</h5>
        <ul className="divide-y divide-line text-sm max-h-44 overflow-y-auto">
          {summary.members.map((m) => (
            <li key={m.id} className="py-2 flex flex-wrap items-center gap-2">
              <Input
                className="!text-sm flex-1 min-w-[140px]"
                value={nameEdits[m.userId] ?? m.fullName}
                onChange={(e) => setNameEdits({ ...nameEdits, [m.userId]: e.target.value })}
              />
              <span className="text-[10px] font-mono text-steel-muted shrink-0">{m.email}</span>
              <Badge tone="neutral">{m.portalRole || m.role}</Badge>
              <Button
                type="button"
                variant="secondary"
                className="!text-xs !py-1"
                disabled={busy || (nameEdits[m.userId] ?? m.fullName) === m.fullName}
                onClick={() => void saveMemberName(m.userId)}
              >
                Save name
              </Button>
            </li>
          ))}
          {!summary.members.length && (
            <li className="py-2 text-steel-muted text-xs">
              No members yet — assign from{" "}
              <Link to={`/projects/${projectId}/directory`} className="text-brand font-semibold">
                project directory
              </Link>
              .
            </li>
          )}
        </ul>
      </Card>

      <WorkPackagesPanel token={token} projectId={projectId} onSaved={() => onMsg?.("Work packages saved.")} />
    </div>
  );
}
