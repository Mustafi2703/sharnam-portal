import { useCallback, useEffect, useState } from "react";
import { formatIstPunchTime } from "@sharnam/shared";
import { api, apiBase } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Select } from "../components/ui";
import { PhotoCapture } from "./PhotoCapture";

type GeoFix = { lat: number; lng: number; accuracy: number };

function photoSrc(url?: string | null, token?: string | null) {
  if (!url) return null;
  if (url.startsWith("http")) return null;
  const full = url.startsWith("/") ? `${apiBase()}${url}` : url;
  if (url.includes("/attendance/") && url.includes("/photo/") && token) {
    return `${full}?token=${encodeURIComponent(token)}`;
  }
  return full;
}

function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function formatPunchLine(
  kind: "in" | "out",
  row: {
    checkIn?: string | null;
    checkOut?: string | null;
    inLat?: number | null;
    inLng?: number | null;
    outLat?: number | null;
    outLng?: number | null;
    inAccuracy?: number | null;
    outAccuracy?: number | null;
    inSiteName?: string | null;
    outSiteName?: string | null;
    project?: { code?: string; name?: string; location?: string | null } | null;
  }
) {
  const time = kind === "in" ? row.checkIn : row.checkOut;
  const lat = kind === "in" ? row.inLat : row.outLat;
  const lng = kind === "in" ? row.inLng : row.outLng;
  const acc = kind === "in" ? row.inAccuracy : row.outAccuracy;
  const site = kind === "in" ? row.inSiteName : row.outSiteName;
  if (!time && (lat == null || lng == null)) return null;

  const label = kind === "in" ? "Check-in" : "Check-out";
  const place =
    site ||
    row.project?.location ||
    (row.project ? `${row.project.code}` : null) ||
    (lat != null && lng != null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "—");

  return {
    label,
    time: formatIstPunchTime(time),
    place,
    lat,
    lng,
    acc,
  };
}

function PunchLocationRow({ line }: { line: ReturnType<typeof formatPunchLine> }) {
  if (!line) return null;
  return (
    <div className="attendance-punch__log-row">
      <div className="attendance-punch__log-head">
        <span className="attendance-punch__log-label">{line.label}</span>
        <span className="attendance-punch__log-time">{line.time}</span>
      </div>
      <div className="attendance-punch__log-place">{line.place}</div>
      {line.lat != null && line.lng != null && (
        <div className="attendance-punch__log-geo">
          <span className="font-mono">
            {line.lat.toFixed(5)}, {line.lng.toFixed(5)}
            {line.acc != null ? ` · ±${Math.round(line.acc)}m` : ""}
          </span>
          <a
            href={mapsUrl(line.lat, line.lng)}
            target="_blank"
            rel="noreferrer"
            className="attendance-punch__map-link"
          >
            Open map
          </a>
        </div>
      )}
    </div>
  );
}

function requestGeo(): Promise<GeoFix> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported on this device."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => reject(new Error(err.message || "Could not read GPS — allow location access.")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

type Props = {
  /** Compact mode for HRMS tab; full for /attendance site landing */
  variant?: "compact" | "full";
  showRoster?: boolean;
};

/**
 * Mobile-first attendance punch — camera selfie + GPS required.
 * POST /api/hrm/attendance/punch (multipart) → SharePoint + Prisma.
 */
export function AttendancePunchPanel({ variant = "compact", showRoster = true }: Props) {
  const { token, user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState("");
  const [selfie, setSelfie] = useState<File[]>([]);
  const [captureKey, setCaptureKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [geoHint, setGeoHint] = useState("");
  const [attendance, setAttendance] = useState<any[]>([]);
  const isSite = user?.role === "site_employee" || user?.role === "employee";

  const load = useCallback(async () => {
    const [a, p] = await Promise.all([
      api<any[]>("/api/hrm/attendance", { token }).catch(() => []),
      api<any[]>("/api/projects", { token }).catch(() => []),
    ]);
    setAttendance(a);
    setProjects(p);
    if (!projectId && p.length === 1) setProjectId(p[0].id);
  }, [token, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const myToday = attendance.find((a) => a.userId === user?.id || a.user?.email === user?.email);

  async function punch(kind: "in" | "out") {
    if (!selfie[0]) {
      setMsg("Take a selfie first — tap Camera (rear lens on phone).");
      return;
    }
    if (isSite && !projectId) {
      setMsg("Select the site / project you are checking in at.");
      return;
    }
    setBusy(true);
    setMsg("");
    setGeoHint("Requesting location permission…");
    try {
      const geo = await requestGeo();
      setGeoHint(`GPS ok · ${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)} · ±${Math.round(geo.accuracy)}m`);

      const fd = new FormData();
      fd.append("selfie", selfie[0], selfie[0].name || "selfie.jpg");
      fd.append("kind", kind);
      fd.append("lat", String(geo.lat));
      fd.append("lng", String(geo.lng));
      fd.append("accuracy", String(geo.accuracy));
      if (projectId) fd.append("projectId", projectId);

      const row = await api<any>("/api/hrm/attendance/punch", { method: "POST", token, body: fd });
      const punchTime = kind === "in" ? row.checkIn : row.checkOut;
      setMsg(
        `${kind === "in" ? "Checked in" : "Checked out"} at ${formatIstPunchTime(punchTime)}` +
          ` · ${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}` +
          (row.inGeofenceOk || row.outGeofenceOk ? " · site verified" : "") +
          (row.provider === "sharepoint" ? " · SharePoint" : row.sharePointWarning ? ` · ${row.sharePointWarning}` : "")
      );
      setSelfie([]);
      setCaptureKey((k) => k + 1);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Punch failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`space-y-4 ${variant === "full" ? "attendance-punch--full" : ""}`}>
      <Card className={variant === "full" ? "attendance-punch__hero" : ""}>
        <h2 className="font-semibold text-sm mb-1">
          {variant === "full" ? "Site attendance" : "Punch in / out"}
        </h2>
        <p className="text-xs text-steel-muted mb-3">
          Allow <strong>camera</strong> and <strong>location</strong> when prompted. Selfie + GPS are required for every punch.
        </p>

        <label className="text-xs font-semibold uppercase tracking-widest text-steel-muted block mb-1">
          Site / project
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="mt-1">
            <option value="">{isSite ? "Select site…" : "Office (no project)"}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </Select>
        </label>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-steel-muted mb-2">Selfie</p>
          <PhotoCapture
            key={captureKey}
            multiple={false}
            buttonSize="md"
            captureFacing="user"
            hint="Tap Camera — front selfie opens on phone."
            onChange={setSelfie}
          />
        </div>

        {geoHint && <p className="text-xs text-steel-muted mt-2">{geoHint}</p>}
        {msg && (
          <p className={`text-sm mt-3 rounded-lg px-3 py-2 ${msg.includes("fail") || msg.includes("first") ? "bg-warn-soft text-warn" : "bg-brand-soft text-brand-dark"}`}>
            {msg}
          </p>
        )}

        <div className={`flex gap-3 mt-4 ${variant === "full" ? "attendance-punch__actions sticky bottom-3 z-10" : ""}`}>
          <Button type="button" className="flex-1" disabled={busy} onClick={() => void punch("in")}>
            {busy ? "Working…" : "Check in"}
          </Button>
          <Button type="button" variant="secondary" className="flex-1" disabled={busy} onClick={() => void punch("out")}>
            Check out
          </Button>
        </div>
      </Card>

      {myToday && (
        <Card>
          <h3 className="font-semibold text-sm mb-2">Your punch today</h3>
          <div className="flex flex-wrap gap-4 items-start">
            {myToday.inPhotoUrl && (
              <div>
                <p className="text-[10px] uppercase text-steel-muted mb-1">Check-in photo</p>
                <img src={photoSrc(myToday.inPhotoUrl, token) || ""} alt="Check-in" className="h-24 w-24 object-cover rounded-lg border border-line" />
              </div>
            )}
            {myToday.outPhotoUrl && (
              <div>
                <p className="text-[10px] uppercase text-steel-muted mb-1">Check-out photo</p>
                <img src={photoSrc(myToday.outPhotoUrl, token) || ""} alt="Check-out" className="h-24 w-24 object-cover rounded-lg border border-line" />
              </div>
            )}
            <dl className="text-xs space-y-2 w-full">
              <PunchLocationRow line={formatPunchLine("in", myToday)} />
              <PunchLocationRow line={formatPunchLine("out", myToday)} />
            </dl>
          </div>
        </Card>
      )}

      {showRoster && (
        <Card>
          <h3 className="font-semibold text-sm mb-2">Today&apos;s roster</h3>
          <ul className="text-sm space-y-2">
            {attendance.map((a) => (
              <li key={a.id} className="flex justify-between gap-2 items-start border-t border-line pt-2 first:border-0 first:pt-0">
                <div className="flex gap-2 min-w-0">
                  {(a.inPhotoUrl || a.outPhotoUrl) && (
                    <img
                      src={photoSrc(a.inPhotoUrl || a.outPhotoUrl, token) || ""}
                      alt=""
                      className="h-10 w-10 rounded object-cover border border-line shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{a.user?.fullName}</div>
                    <div className="text-[10px] text-steel-muted space-y-0.5 mt-0.5">
                      {formatPunchLine("in", a) && (
                        <div>
                          In {formatPunchLine("in", a)!.time}
                          {" · "}
                          {formatPunchLine("in", a)!.place}
                          {a.inGeofenceOk ? " · ✓ site" : ""}
                        </div>
                      )}
                      {formatPunchLine("out", a) && (
                        <div>
                          Out {formatPunchLine("out", a)!.time}
                          {" · "}
                          {formatPunchLine("out", a)!.place}
                        </div>
                      )}
                      {a.inLat != null && a.inLng != null && (
                        <div className="font-mono truncate">
                          {a.inLat.toFixed(5)}, {a.inLng.toFixed(5)}
                          {a.inAccuracy != null ? ` ±${Math.round(a.inAccuracy)}m` : ""}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <Badge tone={a.inGeofenceOk ? "ok" : "warn"}>
                  {a.status} {formatIstPunchTime(a.checkIn)}
                </Badge>
              </li>
            ))}
            {!attendance.length && <li className="text-steel-muted text-sm">No punches yet today.</li>}
          </ul>
        </Card>
      )}
    </div>
  );
}
