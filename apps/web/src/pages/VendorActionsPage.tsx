import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Card, PageHeader } from "../components/ui";

type Action = {
  kind: string;
  id: string;
  projectId: string;
  projectCode: string;
  number: string;
  title: string;
  status: string;
  next: string;
  due: string | null;
  raisedAt: string | null;
  href: string;
  waitingOn: "contractor" | "pmc" | "done";
};
type Out = { vendor: { name: string }; counts: { contractor: number; pmc: number; done: number }; actions: Action[] };

const d = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const GROUPS: { key: Action["waitingOn"]; title: string; hint: string; tone: "danger" | "warn" | "ok" }[] = [
  { key: "contractor", title: "Your action", hint: "Open the form, record root cause / corrective action / evidence, and submit.", tone: "danger" },
  { key: "pmc", title: "With PMC", hint: "Your response is in — PMC verifies on site and closes, or sends it back.", tone: "warn" },
  { key: "done", title: "Closed / paid", hint: "Closed by PMC or bill paid.", tone: "ok" },
];

/**
 * Contractor action desk: quality NCR / CAR, safety NCR / NCN / observations issued to the company, and RA
 * bills with their stage. Inside a project (/projects/:id/actions) it shows that project only.
 */
export default function VendorActionsPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [data, setData] = useState<Out | null>(null);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    api<Out>("/api/vendor-actions", { token })
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : "Could not load"));
  }, [token]);

  const rows = useMemo(() => {
    const all = (data?.actions || []).filter((a) => !id || a.projectId === id);
    return filter === "all" ? all : all.filter((a) => (filter === "quality" ? /^(NCR|CAR)$/.test(a.kind) : filter === "safety" ? a.kind.startsWith("Safety") : a.kind === "RA bill"));
  }, [data, id, filter]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Contractor action desk"
        subtitle={`${data?.vendor.name || "Your company"} — NCR / CAR, safety notices and RA bills issued to you${id ? " on this project" : ""}`}
      />
      {err && <Card className="text-sm text-red-700">{err}</Card>}
      <div className="flex flex-wrap gap-2">
        {[
          ["all", "All"],
          ["quality", "Quality NCR / CAR"],
          ["safety", "Safety NCR / observations"],
          ["ra", "RA bills"],
        ].map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-md border ${filter === k ? "bg-brand text-white border-brand" : "bg-paper border-line text-steel-muted"}`}
          >
            {l}
          </button>
        ))}
      </div>
      {GROUPS.map((g) => {
        const list = rows.filter((r) => r.waitingOn === g.key);
        return (
          <Card key={g.key} padding={false} className="overflow-hidden">
            <div className="px-4 py-3 border-b border-line bg-sand/40 flex items-center justify-between gap-2">
              <div>
                <span className="font-semibold">{g.title}</span> <Badge tone={g.tone}>{list.length}</Badge>
                <p className="text-xs text-steel-muted mt-0.5">{g.hint}</p>
              </div>
            </div>
            {list.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-[11px] uppercase text-steel-muted">
                    <tr>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">No.</th>
                      <th className="px-3 py-2">Project</th>
                      <th className="px-3 py-2">Issue</th>
                      <th className="px-3 py-2">Raised</th>
                      <th className="px-3 py-2">Due</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Next step</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((a) => (
                      <tr key={`${a.kind}-${a.id}`} className="border-t border-line align-top">
                        <td className="px-3 py-2">
                          <Badge tone={a.kind === "RA bill" ? "brand" : a.kind.startsWith("Safety") ? "warn" : "danger"}>{a.kind}</Badge>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{a.number}</td>
                        <td className="px-3 py-2 text-xs">{a.projectCode}</td>
                        <td className="px-3 py-2 max-w-md">
                          <span className="line-clamp-2" title={a.title}>
                            {a.title}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs whitespace-nowrap">{d(a.raisedAt)}</td>
                        <td className={`px-3 py-2 text-xs whitespace-nowrap ${a.due && g.key === "contractor" && new Date(a.due) < new Date() ? "text-red-700 font-semibold" : ""}`}>
                          {d(a.due)}
                        </td>
                        <td className="px-3 py-2 text-xs">{a.status}</td>
                        <td className="px-3 py-2">
                          <Link to={a.href} className="text-brand font-semibold text-xs">
                            {a.next} →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-4 py-4 text-sm text-steel-muted">Nothing here.</p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
