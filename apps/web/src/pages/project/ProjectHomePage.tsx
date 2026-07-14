import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { Badge, Button, Card, Stat, WorkflowStrip } from "../../components/ui";

export default function ProjectHomePage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [overview, setOverview] = useState<any>(null);

  useEffect(() => {
    api(`/api/directory/project/${id}/overview`, { token }).then(setOverview).catch(console.error);
  }, [id, token]);

  const s = overview?.stats || {};

  return (
    <div className="space-y-6">
      <WorkflowStrip
        active={s.publishedDrawings > 0 ? 2 : 0}
        steps={[
          { label: "CRM setup", hint: "Project · people · vendors" },
          { label: "Publish drawings", hint: "Unlocks QA & checklists" },
          { label: "Inspect & checklist", hint: "Final Index + QI forms" },
          { label: "RFI & close-out", hint: "Ball-in-court tracking" },
        ]}
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Published drawings" value={s.publishedDrawings ?? "—"} hint={`${s.drawings ?? 0} total`} />
        <Stat label="Open RFIs" value={s.openRfis ?? "—"} />
        <Stat label="Inspections" value={s.inspections ?? "—"} />
        <Stat label="Team + vendors" value={`${overview?.members?.length ?? 0} / ${overview?.vendors?.length ?? 0}`} />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          ["directory", "Directory", "Assign employees to this project"],
          ["vendors", "Vendors", "Company directory + project assignment"],
          ["drawings", "Drawings", "Publish sheets to open the gate"],
          ["checklist", "Final Index (Site)", "Site execution work checklists"],
          ["quality-inspections", "Quality Inspections", "QI forms (pre-pour, review…)"],
          ["inspections", "Quality Action Plan", "Track open QI actions & due dates"],
          ["safety", "Safety", "Incidents, observations, JHAs"],
          ["rfis", "RFIs", "Questions with ball-in-court"],
        ].map(([to, title, desc]) => (
          <Link key={to} to={`/projects/${id}/${to}`}>
            <Card className="h-full hover:border-brand/40 transition portal-card">
              <div className="font-semibold">{title}</div>
              <p className="text-sm text-steel-muted mt-1">{desc}</p>
              <div className="mt-4 text-sm text-brand font-medium">Open →</div>
            </Card>
          </Link>
        ))}
      </div>

      {s.publishedDrawings === 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <div className="font-semibold text-warn">Gate locked</div>
          <p className="text-sm text-steel-muted mt-1">
            Publish at least one drawing before site can submit checklists or create QA inspections.
          </p>
          <Link to={`/projects/${id}/drawings`}>
            <Button className="mt-3">Go to Drawings</Button>
          </Link>
        </Card>
      )}
    </div>
  );
}
