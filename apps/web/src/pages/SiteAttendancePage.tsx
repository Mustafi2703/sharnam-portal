import { PageHeader } from "../components/ui";
import { AttendancePunchPanel } from "../components/AttendancePunchPanel";

/** Mobile landing for site employees — selfie + GPS attendance punch. */
export default function SiteAttendancePage() {
  return (
    <div className="space-y-4 min-w-0 max-w-lg mx-auto">
      <PageHeader
        eyebrow="HRMS · Field"
        title="Attendance punch"
        subtitle="Your first step each day: take a selfie, allow GPS, pick your site, then check in. Location and photo are saved to your attendance record."
      />
      <AttendancePunchPanel variant="full" showRoster={false} />
    </div>
  );
}
