/**
 * PhotoCapture — mobile-first photo capture button.
 * On phones/tablets, tapping "Camera" opens the native camera (capture="environment").
 * On desktop, the same button falls back to file picker.
 * "Gallery" always opens the file picker.
 *
 * Files are lifted via onChange so the parent can post them along with its form.
 */
import { useRef, useState } from "react";
import { Button } from "./ui";

type Props = {
  onChange: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  hint?: string;
  buttonSize?: "sm" | "md";
};

export function PhotoCapture({ onChange, multiple = true, accept = "image/*", hint, buttonSize = "sm" }: Props) {
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);

  const push = (list: FileList | null) => {
    const incoming = list ? Array.from(list) : [];
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

  const btnCls = buttonSize === "sm" ? "!text-xs !py-1.5 !px-3" : "";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          className={btnCls}
          onClick={() => cameraRef.current?.click()}
        >
          📷 Camera
        </Button>
        <Button
          type="button"
          variant="ghost"
          className={btnCls}
          onClick={() => galleryRef.current?.click()}
        >
          🖼 Gallery
        </Button>
        {hint && <span className="text-[11px] text-steel-muted">{hint}</span>}
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept={accept}
        capture="environment"
        multiple={multiple}
        className="hidden"
        onChange={(e) => push(e.target.files)}
      />
      <input
        ref={galleryRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => push(e.target.files)}
      />
      {files.length > 0 && (
        <ul className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {files.map((f, i) => {
            const url = URL.createObjectURL(f);
            return (
              <li key={`${f.name}-${i}`} className="relative group">
                <img
                  src={url}
                  alt={f.name}
                  className="w-full h-20 object-cover rounded-md border border-line"
                  onLoad={() => URL.revokeObjectURL(url)}
                />
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => removeAt(i)}
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-white border border-line text-xs font-bold shadow"
                >
                  ×
                </button>
                <span className="absolute inset-x-0 bottom-0 bg-black/50 text-white text-[10px] px-1 py-0.5 truncate">
                  {f.name}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
