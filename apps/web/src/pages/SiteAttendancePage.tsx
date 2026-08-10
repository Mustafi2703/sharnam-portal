import { PageHeader } from "../components/ui";
import { AttendancePunchPanel } from "../components/AttendancePunchPanel";

/** Mobile landing for site employees — selfie + GPS attendance punch. */
export default function SiteAttendancePage() {
  return (
    <div className="space-y-4 min-w-0 max-w-lg mx-auto">
      <PageHeader
        eyebrow="HRMS · Field"
        title="Attendance punch"
        subtitle="Open camera, take a selfie, allow location — then check in or out. Photos save to SharePoint under Resources & Productivity."
      />
      <AttendancePunchPanel variant="full" showRoster={false} />
    </div>
  );
}
