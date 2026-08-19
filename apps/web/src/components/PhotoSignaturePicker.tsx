import { useEffect, useState } from "react";
import { api } from "../api";
import { Button } from "./ui";
import { resolveDrawingFileUrl } from "../lib/drawingPreview";

type Photo = { id: string; fileUrl: string; album?: string; description?: string | null };

type Props = {
  projectId: string;
  token?: string | null;
  label: string;
  personName?: string;
  selectedPhotoId?: string | null;
  existingUrl?: string | null;
  onSelect: (photoId: string | null, previewUrl: string | null) => void;
};

/** Pick a signature image from project photo storage (Photos module). */
export function PhotoSignaturePicker({ projectId, token, label, selectedPhotoId, existingUrl, onSelect }: Props) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void api<{ photos: Photo[] }>(`/api/directory/project/${projectId}/photos`, { token })
      .then((r) => setPhotos(r.photos || []))
      .catch(() => setPhotos([]));
  }, [projectId, token]);

  const selected = photos.find((p) => p.id === selectedPhotoId);
  const preview = selected?.fileUrl || existingUrl;

  return (
    <div className="space-y-2 rounded-lg border border-line bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-steel-muted">{label}</span>
        <Button type="button" variant="secondary" className="!text-xs !py-1" onClick={() => setOpen((o) => !o)}>
          {open ? "Hide photos" : "Pick from photo storage"}
        </Button>
      </div>
      {preview && (
        <img
          src={resolveDrawingFileUrl(preview)}
          alt={`${label} preview`}
          className="h-14 border border-line rounded bg-white object-contain"
        />
      )}
      {open && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto">
          {photos.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`border rounded overflow-hidden ${selectedPhotoId === p.id ? "ring-2 ring-brand" : "border-line"}`}
              onClick={() => {
                onSelect(p.id, p.fileUrl);
                setOpen(false);
              }}
            >
              <img src={resolveDrawingFileUrl(p.fileUrl)} alt="" className="w-full h-16 object-cover" />
            </button>
          ))}
          {!photos.length && <p className="col-span-full text-xs text-steel-muted">No photos in storage — upload in Photos first.</p>}
        </div>
      )}
      {selectedPhotoId && (
        <Button type="button" variant="ghost" className="!text-xs" onClick={() => onSelect(null, null)}>
          Clear selection
        </Button>
      )}
    </div>
  );
}
