import { AttendanceCalendar } from "../components/AttendanceCalendar";
import { AttendancePunchPanel } from "../components/AttendancePunchPanel";

/** HRMS · Attendance tab — calendar history + punch + roster. */
export default function HrmsAttendancePage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <AttendanceCalendar />
      <AttendancePunchPanel variant="compact" showRoster />
    </div>
  );
}
