import { Link } from "react-router-dom";
import { Badge, Button, Card } from "./ui";
import {
  DEMO_PROJECT_BLURBS,
  DEMO_PROJECT_CODES,
  type DemoProject,
  demoProjectLinks,
  findDemoProject,
  PILOT_WEEK_END,
  DEMO_DPR_DATE,
} from "../lib/demoProjects";

/** Office desk — quick access to seeded demo projects + DPR/WPR format checks */
export function DemoProjectsPanel({
  projects,
  compact = false,
}: {
  projects: DemoProject[];
  compact?: boolean;
}) {
  const demos = DEMO_PROJECT_CODES.map((code) => findDemoProject(projects, code)).filter(Boolean) as DemoProject[];
  const missing = DEMO_PROJECT_CODES.filter((code) => !findDemoProject(projects, code));

  if (!demos.length && !missing.length) return null;

  return (
    <Card className={`border-brand/35 bg-brand-soft/30 ${compact ? "!p-3" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="font-semibold text-sm">Client demo projects</h3>
          <p className="text-xs text-steel-muted mt-0.5">
            Office sees both demos — open <strong>SPDC-PILOT-02</strong> to verify WPR PPTX and DPR XLSX/PDF match SPDC format.
          </p>
        </div>
        {!compact && <Badge tone="brand">After RUN_SEED=1</Badge>}
      </div>

      <div className={`grid gap-3 ${compact ? "grid-cols-1" : "md:grid-cols-2"}`}>
        {demos.map((p) => {
          const links = demoProjectLinks(p.id, p.code);
          const isPilot = p.code === "SPDC-PILOT-02";
          return (
            <div key={p.id} className="rounded-xl border border-line bg-paper p-3 space-y-2">
              <div>
                <div className="font-mono text-xs text-brand">{p.code}</div>
                <div className="font-medium text-sm">{p.name}</div>
                <p className="text-[11px] text-steel-muted mt-1">{DEMO_PROJECT_BLURBS[p.code as keyof typeof DEMO_PROJECT_BLURBS]}</p>
                <p className="text-[10px] text-steel-muted mt-1">
                  {isPilot ? `WPR week ending ${PILOT_WEEK_END} · 7 DPR days seeded` : `DPR demo date ${DEMO_DPR_DATE}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Link to={links.home}>
                  <Button type="button" variant="secondary" className="!py-1 !px-2.5 !text-[11px]">
                    Project home
                  </Button>
                </Link>
                <Link to={links.dpr}>
                  <Button type="button" className="!py-1 !px-2.5 !text-[11px]">
                    DPR maker
                  </Button>
                </Link>
                <Link to={links.wpr}>
                  <Button type="button" className="!py-1 !px-2.5 !text-[11px]">
                    WPR maker
                  </Button>
                </Link>
                <Link to={links.progress}>
                  <Button type="button" variant="secondary" className="!py-1 !px-2.5 !text-[11px]">
                    Progress / S-curve
                  </Button>
                </Link>
                {!isPilot && (
                  <Link to={links.finance}>
                    <Button type="button" variant="secondary" className="!py-1 !px-2.5 !text-[11px]">
                      Cost / RA-COP
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          );
        })}

        {missing.map((code) => (
          <div key={code} className="rounded-xl border border-dashed border-line p-3 text-xs text-steel-muted">
            <strong>{code}</strong> not in database — redeploy with <code className="text-brand">RUN_SEED=1</code> or run{" "}
            <code className="text-brand">npm run db:seed</code> on server.
          </div>
        ))}
      </div>
    </Card>
  );
}
