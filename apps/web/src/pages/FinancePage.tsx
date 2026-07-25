import { useMemo, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { Badge, Button, Card, PageHeader } from "../components/ui";

const TOOLS = [
  { id: "overview", label: "Overview", hint: "Open invoices, POs, RA bills, COPs" },
  { id: "invoices", label: "Invoice tracking", hint: "Invoices raised / received / status" },
  { id: "po", label: "PO tracking", hint: "Purchase orders vs delivery / billed" },
  { id: "ra", label: "RA bill tracking", hint: "Running account bills" },
  { id: "cop", label: "COP tracking", hint: "Certificate of payment" },
] as const;

type ToolId = (typeof TOOLS)[number]["id"];

/**
 * Finance module shell — commercial tracking, separate from Cost (MB/BBS/budget).
 * Detail fields and Excel import to be finalized with client later.
 */
export default function FinancePage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as ToolId) || "overview";
  const active = TOOLS.find((t) => t.id === tab) || TOOLS[0];
  const [msg] = useState("Shell ready — registers and Excel import will be detailed with the client.");

  const placeholders = useMemo(() => {
    switch (active.id) {
      case "invoices":
        return ["Invoice no.", "Party", "Amount", "Date", "Status", "Linked PO / RA"];
      case "po":
        return ["PO no.", "Vendor", "Value", "Ordered", "Delivered", "Billed"];
      case "ra":
        return ["RA no.", "Period", "Gross", "Certified", "Status", "Linked COP"];
      case "cop":
        return ["COP no.", "RA ref", "Amount", "Certified on", "Paid", "Status"];
      default:
        return ["Open invoices", "Open POs", "Pending RA", "Pending COP"];
    }
  }, [active.id]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance module · separate from Cost"
        title={active.label}
        subtitle="Invoice, PO, RA bill, and COP tracking. Cost stays MB / BBS / budget / cashflow. Detail design later — this page is the working shell."
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge tone="brand">Shell</Badge>
            <Link to={`/projects/${id}/hub/finance`}>
              <Button type="button" variant="secondary">
                Finance hub
              </Button>
            </Link>
            <Link to={`/projects/${id}/cost`}>
              <Button type="button" variant="secondary">
                Cost (MB / BOQ) →
              </Button>
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSearchParams(t.id === "overview" ? {} : { tab: t.id })}
            className={`rounded-full px-4 py-2 text-sm font-semibold border transition ${
              active.id === t.id ? "bg-ink text-white border-ink" : "bg-white border-line text-steel-muted hover:border-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="text-sm text-steel-muted bg-sand/40 border border-line rounded-xl px-4 py-3">{msg}</p>

      {active.id === "overview" ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {placeholders.map((label) => (
            <Card key={label} className="!p-4">
              <div className="text-[10px] uppercase tracking-wide text-steel-muted">{label}</div>
              <div className="text-2xl font-display mt-2">—</div>
              <div className="text-xs text-steel-muted mt-1">Pilot data later</div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <h3 className="font-semibold mb-1">{active.label}</h3>
          <p className="text-sm text-steel-muted mb-4">{active.hint}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-steel-muted">
                  {placeholders.map((h) => (
                    <th key={h} className="py-2 pr-4 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={placeholders.length} className="py-8 text-center text-steel-muted">
                    No rows yet — columns match client Payment Summary / RA formats after biweekly detail.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
