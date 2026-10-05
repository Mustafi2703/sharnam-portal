import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AttendanceCalendar } from "../components/AttendanceCalendar";
import { AttendancePunchPanel } from "../components/AttendancePunchPanel";
import { TeamMusterCalendar } from "../components/TeamMusterCalendar";
import { AttendanceMonthReview } from "../components/AttendanceMonthReview";
import { AttendanceSitePins } from "../components/AttendanceSitePins";
import { PageHeader } from "../components/ui";
import { useAuth } from "../auth";
import { canManageHrms } from "../lib/portalAccounts";
import { formatUiText } from "../lib/formatUiText";

type View = "team" | "person" | "punch" | "review" | "sites";

/** HRMS · Attendance — team muster (HR), one person's month calendar, and today's check-in/out. */
export default function HrmsAttendancePage() {
  const { user } = useAuth();
  const isHr = canManageHrms(user);
  const [params, setParams] = useSearchParams();
  const [memberId, setMemberId] = useState(params.get("user") || "");
  const requested = params.get("view") as View | null;
  const hrOnly: View[] = ["team", "review", "sites"];
  const view: View = requested && (!hrOnly.includes(requested) || isHr) ? requested : isHr ? "team" : "person";

  function go(next: View, userId?: string) {
    const p = new URLSearchParams(params);
    p.set("view", next);
    if (userId !== undefined) {
      setMemberId(userId);
      if (userId) p.set("user", userId);
      else p.delete("user");
    }
    setParams(p, { replace: true });
  }

  const tabs: { id: View; label: string; hint: string }[] = [
    ...(isHr ? [{ id: "team" as View, label: "Team calendar", hint: "Everyone × every day" }] : []),
    { id: "person", label: isHr ? "Person calendar" : "My calendar", hint: "Punches, leave, holidays" },
    { id: "punch", label: "Check in / out", hint: "Today's punch + roster" },
    ...(isHr
      ? [
          { id: "review" as View, label: "Review & hours", hint: "Verify locations · month log" },
          { id: "sites" as View, label: "Site locations", hint: "Map pin + radius" },
        ]
      : []),
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        dense
        eyebrow="HRMS"
        title="Attendance & Leave Calendar"
        subtitle="See who was present, on leave, or absent for the month. Leave and holidays are shown on the same calendar as check-ins."
      />

      <div className="segmented" role="tablist" aria-label="Attendance views">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={view === t.id}
            className={`segmented__btn${view === t.id ? " is-on" : ""}`}
            onClick={() => go(t.id)}
          >
            <span className="segmented__label">{formatUiText(t.label)}</span>
            <span className="segmented__hint">{formatUiText(t.hint)}</span>
          </button>
        ))}
      </div>

      {view === "team" && isHr ? <TeamMusterCalendar onOpenMember={(id) => go("person", id)} /> : null}
      {view === "person" ? <AttendanceCalendar initialUserId={memberId} /> : null}
      {view === "punch" ? <AttendancePunchPanel variant="compact" showRoster /> : null}
      {view === "review" && isHr ? <AttendanceMonthReview /> : null}
      {view === "sites" && isHr ? <AttendanceSitePins /> : null}
    </div>
  );
}
