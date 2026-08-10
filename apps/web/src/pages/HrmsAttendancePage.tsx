import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Select } from "../components/ui";

/**
 * HRMS · Attendance — geo-fenced site check-in / check-out for the
 * signed-in user, plus today's attendance roster.
 */
export default function HrmsAttendancePage() {
  const { token } = useAuth();
  const [attendance, setAttendance] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [checkInProject, setCheckInProject] = useState("");
  const [msg, setMsg] = useState("");
  const [geo, setGeo] = useState("");

  const load = useCallback(async () => {
    const [a, p] = await Promise.all([
      api<any[]>("/api/hrm/attendance", { token }).catch(() => []),
      api<any[]>("/api/projects", { token }).catch(() => []),
    ]);
    setAttendance(a);
    setProjects(p);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  function checkIn(kind: "in" | "out") {
    setGeo("Requesting GPS…");
    if (!navigator.geolocation) return setGeo("Geolocation not supported.");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const g = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        setGeo(`GPS ok · ±${Math.round(g.accuracy)}m`);
        try {
          await api("/api/hrm/attendance", {
            method: "POST",
            token,
            body: JSON.stringify({
              status: "Present",
              kind,
              [kind === "in" ? "checkIn" : "checkOut"]: new Date().toTimeString().slice(0, 5),
              geo: g,
              projectId: checkInProject || undefined,
            }),
          });
          setMsg(`${kind === "in" ? "Checked in" : "Checked out"}${checkInProject ? " · site verified" : ""}.`);
          await load();
        } catch (err) {
          setMsg(err instanceof Error ? err.message : "Check-in failed");
        }
      },
      (err) => setGeo(`GPS error — ${err.message}`),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={checkInProject} onChange={(e) => setCheckInProject(e.target.value)} className="max-w-xs">
          <option value="">No project (office)</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.code}</option>
          ))}
        </Select>
        <Button onClick={() => checkIn("in")}>Check-in (GPS)</Button>
        <Button variant="secondary" onClick={() => checkIn("out")}>Check-out</Button>
      </div>
      {msg && <p className="text-sm text-ok">{msg}</p>}
      {geo && <p className="text-xs text-steel-muted">GPS: {geo}</p>}

      <Card>
        <h2 className="font-semibold mb-2">Today's attendance</h2>
        <ul className="text-sm space-y-2">
          {attendance.map((a) => (
            <li key={a.id} className="flex justify-between gap-2 items-start">
              <div>
                <div>{a.user?.fullName}</div>
                {(a.inLat || a.inLng) && (
                  <div className="text-[10px] text-steel-muted">
                    {a.inSiteName ? `Site: ${a.inSiteName}` : `${(a.inLat ?? 0).toFixed(4)}, ${(a.inLng ?? 0).toFixed(4)}`}
                    {a.inGeofenceOk ? " · ✓ inside geofence" : ""}
                  </div>
                )}
              </div>
              <Badge tone={a.inGeofenceOk ? "ok" : "warn"}>
                {a.status} {a.checkIn || ""}
              </Badge>
            </li>
          ))}
          {!attendance.length && <li className="text-steel-muted text-sm">No marks yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
