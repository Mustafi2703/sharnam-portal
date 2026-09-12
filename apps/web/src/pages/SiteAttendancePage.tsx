import { PageHeader } from "../components/ui";
import { AttendancePunchPanel } from "../components/AttendancePunchPanel";
import { ExpenseVoucherPanel } from "../components/ExpenseVoucherPanel";

/** Mobile landing for site employees — selfie + GPS attendance punch. */
export default function SiteAttendancePage() {
  return (
    <div className="space-y-8 min-w-0 max-w-3xl mx-auto">
      <PageHeader
        eyebrow="HRMS · Field"
        title="Attendance punch"
        subtitle="Your first step each day: take a selfie, allow GPS, pick your site, then check in. Location and photo are saved to your attendance record. Gallery is not allowed — live camera only."
      />
      <AttendancePunchPanel variant="full" showRoster={false} />
      <ExpenseVoucherPanel variant="daily" title="Daily expense voucher" />
    </div>
  );
}
