import { useAuth } from "../../auth";
import { WorkPackagesPanel } from "../../components/WorkPackagesPanel";
import { PageHeader } from "../../components/ui";

/** Org-wide work package catalogue — tick packages onto a job in Project setup. */
export default function CrmPackagesPage() {
  const { token } = useAuth();
  return (
    <div className="space-y-4 p-4 sm:p-5 pb-8">
      <PageHeader eyebrow="CRM · packages" title="Package management" />
      <WorkPackagesPanel token={token} mode="manage" />
    </div>
  );
}
