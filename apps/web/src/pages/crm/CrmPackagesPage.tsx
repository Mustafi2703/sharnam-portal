import { Link } from "react-router-dom";
import { useAuth } from "../../auth";
import { WorkPackagesPanel } from "../../components/WorkPackagesPanel";
import { PageHeader } from "../../components/ui";

/** Org-wide work package catalogue — tick packages onto a job in Project setup. */
export default function CrmPackagesPage() {
  const { token } = useAuth();
  return (
    <div className="space-y-4 p-4 sm:p-5 pb-8">
      <PageHeader
        eyebrow="CRM · packages"
        title="Package management"
        subtitle="Add or remove Civil, PEB, Electrical and other packages here. Project setup only ticks which ones apply to a job."
      />
      <p className="text-xs text-steel-muted">
        Clients, consultants, vendors, and SPDC staff stay on their own lists.{" "}
        <Link to="/crm/setup" className="font-semibold text-brand">
          Project setup →
        </Link>
      </p>
      <WorkPackagesPanel token={token} mode="manage" />
    </div>
  );
}
