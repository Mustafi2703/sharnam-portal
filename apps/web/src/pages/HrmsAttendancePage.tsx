import { AttendanceCalendar } from "../components/AttendanceCalendar";
import { AttendancePunchPanel } from "../components/AttendancePunchPanel";
import { PageHeader } from "../components/ui";

/** HRMS · Attendance tab — monthly calendar with photo/GPS review + punch + roster. */
export default function HrmsAttendancePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        dense
        eyebrow="HRMS"
        title="Attendance"
        subtitle="Monthly records with check-in/out time, selfie evidence, and map location for office and HR review. Field staff must check out near their check-in GPS."
      />
      <AttendanceCalendar />
      <AttendancePunchPanel variant="compact" showRoster />
    </div>
  );
}
