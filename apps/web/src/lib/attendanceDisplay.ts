import { formatIstPunchTime } from "@sharnam/shared";

export function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export type AttendanceGeoRow = {
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
};

export function formatPunchLine(kind: "in" | "out", row: AttendanceGeoRow) {
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
    rawTime: time,
    place,
    lat,
    lng,
    acc,
  };
}
