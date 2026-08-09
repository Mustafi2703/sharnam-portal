/**
 * Site Pilot — for testing with clients. A one-screen mobile-first flow the site
 * user can open after signing in on their phone. Take photos, sign, note the
 * location, submit. Everything lands in the project's SharePoint gallery
 * under 07.02_Daily_Site_Records/SitePilot/.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Input, PageHeader, TextArea } from "../components/ui";
import { SignaturePad } from "../components/SignaturePad";
import { PhotoCapture } from "../components/PhotoCapture";

type SavedItem = { kind: "photo" | "signature" | "note"; path?: string; url?: string; provider?: string };

export default function SitePilotPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [project, setProject] = useState<any>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [signature, setSignature] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [items, setItems] = useState<SavedItem[]>([]);

  useEffect(() => {
    if (!id) return;
    api<any>(`/api/projects/${id}`, { token }).then(setProject).catch(() => setProject(null));
  }, [id, token]);

  const canSubmit = useMemo(
    () => Boolean(!busy && (photos.length || signature || note.trim() || location.trim())),
    [busy, photos, signature, note, location]
  );

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      photos.forEach((p) => fd.append("photos", p, p.name));
      if (signature) fd.append("signature", signature, signature.name);
      if (note.trim()) fd.append("note", note.trim());
      if (location.trim()) fd.append("location", location.trim());
      const res = await api<any>(`/api/site-test/${id}/upload`, { method: "POST", token, body: fd });
      setItems(res.items || []);
      setMsg(
        `Uploaded ${res.items?.filter((i: any) => i.kind === "photo").length || 0} photo(s)` +
          (signature ? ", 1 signature" : "") +
          (note || location ? ", 1 note" : "") +
          ` → ${res.provider === "sharepoint" ? "SharePoint" : "mock OneDrive"}`
      );
      setPhotos([]);
      setSignature(null);
      setNote("");
      setLocation("");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function useGeolocation() {
    if (!navigator.geolocation) return setMsg("Geolocation not available on this device");
    setMsg("Reading location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`);
        setMsg("Location captured. Add a photo, sign, and submit.");
      },
      (err) => setMsg(err.message || "Could not read location"),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={project?.code || ""}
        title="Site pilot"
        subtitle="Snap a site photo, sign, note the location, submit. Everything lands in the SharePoint gallery under Daily Site Records → SitePilot."
        actions={
          <div className="flex items-center gap-2">
            {project?.code && <Badge tone="brand">{project.code}</Badge>}
            <Link to={`/projects/${id}`} className="text-xs font-semibold text-brand">
              Close
            </Link>
          </div>
        }
      />

      {msg && <p className="text-sm rounded-lg px-3 py-2 bg-brand-soft text-brand-dark">{msg}</p>}

      <Card>
        <h3 className="font-semibold text-sm mb-2">1 · Site photo</h3>
        <PhotoCapture
          onChange={setPhotos}
          multiple
          hint="Tap Camera on phone to open the rear camera. Gallery lets you pick existing images."
        />
      </Card>

      <Card>
        <h3 className="font-semibold text-sm mb-2">2 · Signature</h3>
        <p className="text-xs text-steel-muted mb-2">Draw with a finger, stylus or mouse — or upload an existing sign.</p>
        <SignaturePad onCapture={setSignature} personName={user?.fullName || user?.email || undefined} />
      </Card>

      <Card>
        <h3 className="font-semibold text-sm mb-2">3 · Note & location</h3>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-end">
          <label className="text-xs font-semibold uppercase tracking-widest text-steel-muted">
            Location
            <Input
              value={location}
              placeholder="Block / floor / gate coordinates"
              onChange={(e) => setLocation(e.target.value)}
              className="mt-1"
            />
          </label>
          <Button type="button" variant="secondary" onClick={() => void useGeolocation()} className="!text-xs">
            Use GPS
          </Button>
        </div>
        <div className="mt-3">
          <label className="text-xs font-semibold uppercase tracking-widest text-steel-muted">
            Note
            <TextArea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What did you capture? Package, issue, next action…"
              rows={4}
              className="mt-1"
            />
          </label>
        </div>
      </Card>

      <div className="flex items-center gap-3 sticky bottom-3 justify-end">
        <span className="text-xs text-steel-muted">
          {photos.length} photo{photos.length === 1 ? "" : "s"} · {signature ? "1 signature" : "no signature"} ·{" "}
          {note || location ? "note" : "no note"}
        </span>
        <Button type="button" onClick={() => void submit()} disabled={!canSubmit}>
          {busy ? "Uploading…" : "Submit to SharePoint"}
        </Button>
      </div>

      {items.length > 0 && (
        <Card>
          <h3 className="font-semibold text-sm mb-2">Last upload</h3>
          <ul className="space-y-1 text-xs">
            {items.map((i, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span className="uppercase font-semibold text-brand">{i.kind}</span>
                {i.url ? (
                  <a href={i.url} target="_blank" rel="noreferrer" className="text-brand underline break-all">
                    {i.path || i.url}
                  </a>
                ) : (
                  <span className="break-all">{i.path}</span>
                )}
                {i.provider && <Badge tone={i.provider === "sharepoint" ? "brand" : "warn"}>{i.provider}</Badge>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
