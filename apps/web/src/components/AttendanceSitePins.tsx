import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input } from "./ui";

type Site = { id: string; code: string; name: string; location: string | null; siteLat: number | null; siteLng: number | null; siteRadiusM: number | null };

/** Pull "lat,lng" out of a pasted Google Maps / OpenStreetMap link or plain coordinates. */
export function parseMapLocation(raw: string): { lat: number; lng: number } | null {
  const t = raw.trim();
  const patterns = [/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/, /[?&](?:q|ll|query)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/, /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /mlat=(-?\d+\.\d+)&mlon=(-?\d+\.\d+)/, /^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/];
  for (const re of patterns) {
    const m = re.exec(t);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
    }
  }
  return null;
}

function mapEmbed(lat: number, lng: number, radiusM: number) {
  // ~ degrees per metre; frame shows about 3× the radius around the pin
  const d = Math.max(0.002, (radiusM * 3) / 111_000);
  const bbox = [lng - d, lat - d * 0.7, lng + d, lat + d * 0.7].map((n) => n.toFixed(6)).join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

function SiteRow({ site, onSaved }: { site: Site; onSaved: () => void }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [locName, setLocName] = useState(site.location || "");
  const [lat, setLat] = useState(site.siteLat != null ? String(site.siteLat) : "");
  const [lng, setLng] = useState(site.siteLng != null ? String(site.siteLng) : "");
  const [radius, setRadius] = useState(String(site.siteRadiusM || 300));
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const pinned = lat !== "" && lng !== "" && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));

  function usePaste(v: string) {
    setPaste(v);
    const hit = parseMapLocation(v);
    if (hit) {
      setLat(hit.lat.toFixed(6));
      setLng(hit.lng.toFixed(6));
      setNote({ tone: "ok", text: "Pin read from the link." });
    }
  }

  function useHere() {
    if (!navigator.geolocation) return setNote({ tone: "err", text: "This browser cannot read your location." });
    setNote({ tone: "ok", text: "Reading your location…" });
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(p.coords.latitude.toFixed(6));
        setLng(p.coords.longitude.toFixed(6));
        setNote({ tone: "ok", text: `Pin set to where you are (±${Math.round(p.coords.accuracy)} m). Stand at the site gate for best results.` });
      },
      (e) => setNote({ tone: "err", text: e.message || "Location permission denied" }),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function save(clear = false) {
    setBusy(true);
    setNote(null);
    try {
      await api(`/api/hrm/attendance/site/${site.id}`, {
        method: "PUT",
        token,
        body: JSON.stringify({ location: locName, siteLat: clear ? null : lat === "" ? null : Number(lat), siteLng: clear ? null : lng === "" ? null : Number(lng), siteRadiusM: Number(radius) || 300 }),
      });
      if (clear) {
        setLat("");
        setLng("");
      }
      setNote({ tone: "ok", text: clear ? "Map pin cleared — punches at this site now wait for HR review." : "Saved. Punches inside the radius are verified automatically." });
      onSaved();
    } catch (err) {
      setNote({ tone: "err", text: err instanceof Error ? err.message : "Could not save" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-line first:border-t-0">
      <button type="button" className="w-full flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-left cursor-pointer hover:bg-sand/30" onClick={() => setOpen((v) => !v)}>
        <span>
          <span className="font-mono text-xs text-brand mr-2">{site.code}</span>
          <span className="font-semibold text-sm">{site.name}</span>
          <span className="block text-[11px] text-steel-muted">{site.location || "No location name"}</span>
        </span>
        {site.siteLat != null ? <Badge tone="ok">Map pin · {site.siteRadiusM || 300} m</Badge> : <Badge tone="warn">Name only · manual review</Badge>}
      </button>
      {open && (
        <div className="px-4 pb-4 grid lg:grid-cols-[1fr_360px] gap-4">
          <div className="space-y-3">
            <Input label="Site location name" placeholder="e.g. Arvind Santej plant, Gate 2" value={locName} onChange={(e) => setLocName(e.target.value)} />
            <Input label="Paste a Google Maps link or coordinates" placeholder="https://maps.google.com/…@23.0225,72.5714… or 23.0225, 72.5714" value={paste} onChange={(e) => usePaste(e.target.value)} />
            <div className="grid grid-cols-3 gap-2">
              <Input label="Latitude" value={lat} onChange={(e) => setLat(e.target.value)} />
              <Input label="Longitude" value={lng} onChange={(e) => setLng(e.target.value)} />
              <Input label="Radius (m)" type="number" min={30} max={5000} value={radius} onChange={(e) => setRadius(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" className="!text-xs" onClick={useHere}>
                Use my current location
              </Button>
              <Button type="button" className="!text-xs" disabled={busy} onClick={() => void save(false)}>
                {busy ? "Saving…" : pinned ? "Save pin and radius" : "Save name only (manual review)"}
              </Button>
              {site.siteLat != null && (
                <Button type="button" variant="ghost" className="!text-xs" disabled={busy} onClick={() => void save(true)}>
                  Clear map pin
                </Button>
              )}
            </div>
            {note ? <p className={`text-xs ${note.tone === "err" ? "text-red-700" : "text-steel-muted"}`}>{note.text}</p> : null}
          </div>
          <div className="rounded-lg border border-line overflow-hidden bg-sand/30 min-h-[220px]">
            {pinned ? (
              <iframe title={`${site.code} map`} src={mapEmbed(Number(lat), Number(lng), Number(radius) || 300)} className="w-full h-[260px] border-0" loading="lazy" />
            ) : (
              <p className="p-4 text-xs text-steel-muted">No pin yet. Paste a map link, type coordinates, or use your current location at the site.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** HR / office: map pin + radius per project site. Check-ins inside the radius verify themselves. */
export function AttendanceSitePins() {
  const { token } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const load = () =>
    api<Site[]>("/api/hrm/attendance/sites", { token })
      .then(setSites)
      .catch(() => setSites([]))
      .finally(() => setLoading(false));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  return (
    <Card padding={false}>
      <div className="px-4 py-3 border-b border-line bg-sand/40">
        <div className="font-semibold text-sm">Site Locations For Check-in</div>
        <p className="text-[11px] text-steel-muted">
          Pin each site on the map and set a radius. A check-in within the radius is verified automatically. A site with only a name (no pin) still works, but every punch there waits for HR review.
        </p>
      </div>
      {sites.map((s) => (
        <SiteRow key={s.id} site={s} onSaved={() => void load()} />
      ))}
      {!sites.length && <p className="p-4 text-sm text-steel-muted">{loading ? "Loading sites…" : "No active projects."}</p>}
    </Card>
  );
}
