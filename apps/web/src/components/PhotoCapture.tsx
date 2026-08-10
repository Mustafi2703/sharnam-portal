/**
 * PhotoCapture — mobile-first photo capture.
 * Camera opens native lens on phone; Gallery opens picker. Large tap targets (44px+).
 */
import { useRef, useState } from "react";

type Props = {
  onChange: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  hint?: string;
  buttonSize?: "sm" | "md";
  /** Rear camera on site (default). Use "user" for selfie / attendance. */
  captureFacing?: "user" | "environment";
};

export function PhotoCapture({
  onChange,
  multiple = true,
  accept = "image/*",
  hint,
  buttonSize = "sm",
  captureFacing = "environment",
}: Props) {
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);

  const push = (list: FileList | null, input: HTMLInputElement | null) => {
    const incoming = list ? Array.from(list) : [];
    if (input) input.value = "";
    if (!incoming.length) return;
    const next = multiple ? [...files, ...incoming] : incoming.slice(0, 1);
    setFiles(next);
    onChange(next);
  };

  const removeAt = (i: number) => {
    const next = files.filter((_, idx) => idx !== i);
    setFiles(next);
    onChange(next);
  };

  const sizeCls = buttonSize === "md" ? "photo-capture__btn--md" : "photo-capture__btn--sm";

  return (
    <div className="photo-capture">
      <div className="photo-capture__actions">
        <button
          type="button"
          className={`photo-capture__btn photo-capture__btn--camera ${sizeCls}`}
          onClick={() => cameraRef.current?.click()}
        >
          <span className="photo-capture__icon" aria-hidden>📷</span>
          <span>Camera</span>
        </button>
        <button
          type="button"
          className={`photo-capture__btn photo-capture__btn--gallery ${sizeCls}`}
          onClick={() => galleryRef.current?.click()}
        >
          <span className="photo-capture__icon" aria-hidden>🖼</span>
          <span>Gallery</span>
        </button>
        {files.length > 0 && (
          <span className="photo-capture__count">{files.length} selected</span>
        )}
      </div>
      {hint && <p className="photo-capture__hint">{hint}</p>}
      <input
        ref={cameraRef}
        type="file"
        accept={accept}
        capture={captureFacing}
        multiple={multiple}
        className="photo-capture__input"
        onChange={(e) => push(e.target.files, e.currentTarget)}
      />
      <input
        ref={galleryRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="photo-capture__input"
        onChange={(e) => push(e.target.files, e.currentTarget)}
      />
      {files.length > 0 && (
        <ul className="photo-capture__grid">
          {files.map((f, i) => {
            const url = URL.createObjectURL(f);
            return (
              <li key={`${f.name}-${f.size}-${i}`} className="photo-capture__thumb-wrap">
                <img
                  src={url}
                  alt={f.name}
                  className="photo-capture__thumb"
                  onLoad={() => URL.revokeObjectURL(url)}
                />
                <button
                  type="button"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => removeAt(i)}
                  className="photo-capture__remove"
                >
                  ×
                </button>
                <span className="photo-capture__name">{f.name}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
