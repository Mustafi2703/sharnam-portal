import { useEffect, useRef, useState } from "react";

/**
 * ImageMarkup — draw over any image or PDF page.
 * Loads the source into a canvas, lets user draw with pen (colour + width),
 * add text annotations, erase, undo, and export as a PNG File.
 *
 * Works for phone camera photos AND for a single PDF page rendered via <embed>/<img>.
 * For multi-page PDFs, pass one page (image data URL) at a time.
 */

type Stroke =
  | { kind: "path"; color: string; width: number; points: { x: number; y: number }[] }
  | { kind: "text"; color: string; text: string; x: number; y: number; size: number };

type Props = {
  /** Source image URL, dataURL or File. */
  src: string | File | null;
  /** Called with a new PNG File whenever the user hits Save. */
  onSave?: (file: File) => void;
  /** Optional label for the save button. */
  saveLabel?: string;
  /** Suggested output filename (without extension). */
  filename?: string;
  /** Fired if the user hits Cancel. */
  onCancel?: () => void;
  className?: string;
};

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7", "#111827", "#ffffff"];
const WIDTHS = [2, 4, 8, 14];

export default function ImageMarkup({ src, onSave, onCancel, saveLabel = "Save markup", filename = "markup", className = "" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [current, setCurrent] = useState<Stroke | null>(null);
  const [color, setColor] = useState("#ef4444");
  const [width, setWidth] = useState(4);
  const [tool, setTool] = useState<"pen" | "text" | "erase">("pen");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!src) return;
    if (typeof src === "string") {
      setImageDataUrl(src);
    } else {
      const reader = new FileReader();
      reader.onload = () => setImageDataUrl(String(reader.result));
      reader.readAsDataURL(src);
    }
  }, [src]);

  useEffect(() => {
    if (!imageDataUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const maxWidth = Math.min(1600, window.innerWidth - 60);
      const scale = img.naturalWidth > maxWidth ? maxWidth / img.naturalWidth : 1;
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      setImgSize({ w, h });
      const c = canvasRef.current;
      if (c) {
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        ctx?.drawImage(img, 0, 0, w, h);
      }
      const o = overlayRef.current;
      if (o) {
        o.width = w;
        o.height = h;
      }
    };
    img.src = imageDataUrl;
  }, [imageDataUrl]);

  useEffect(() => {
    const o = overlayRef.current;
    if (!o) return;
    const ctx = o.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, o.width, o.height);
    const drawStroke = (s: Stroke) => {
      if (s.kind === "path") {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        s.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.stroke();
      } else if (s.kind === "text") {
        ctx.fillStyle = s.color;
        ctx.font = `${s.size}px system-ui, sans-serif`;
        ctx.fillText(s.text, s.x, s.y);
      }
    };
    strokes.forEach(drawStroke);
    if (current) drawStroke(current);
  }, [strokes, current, imgSize]);

  function eventToPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = e.currentTarget.width / rect.width;
    const scaleY = e.currentTarget.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = eventToPoint(e);
    if (tool === "text") {
      const text = window.prompt("Text to add");
      if (text) {
        setStrokes((prev) => [...prev, { kind: "text", color, size: Math.max(16, width * 4), text, x: p.x, y: p.y }]);
      }
      return;
    }
    if (tool === "erase") {
      // Remove the top-most stroke within a small radius
      const radius = width * 3;
      setStrokes((prev) => {
        for (let i = prev.length - 1; i >= 0; i--) {
          const s = prev[i];
          const hit =
            s.kind === "path"
              ? s.points.some((pt) => Math.hypot(pt.x - p.x, pt.y - p.y) < radius)
              : Math.hypot(s.x - p.x, s.y - p.y) < radius;
          if (hit) return [...prev.slice(0, i), ...prev.slice(i + 1)];
        }
        return prev;
      });
      return;
    }
    setCurrent({ kind: "path", color, width, points: [p] });
  }
  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!current) return;
    if (current.kind !== "path") return;
    const p = eventToPoint(e);
    setCurrent({ ...current, points: [...current.points, p] });
  }
  function onUp() {
    if (current) {
      setStrokes((prev) => [...prev, current]);
      setCurrent(null);
    }
  }

  function undo() {
    setStrokes((prev) => prev.slice(0, -1));
  }
  function clearAll() {
    setStrokes([]);
  }

  async function save() {
    const base = canvasRef.current;
    const overlay = overlayRef.current;
    if (!base || !overlay) return;
    const out = document.createElement("canvas");
    out.width = base.width;
    out.height = base.height;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(base, 0, 0);
    ctx.drawImage(overlay, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => out.toBlob((b) => resolve(b), "image/png"));
    if (!blob) return;
    const file = new File([blob], `${filename}-${Date.now()}.png`, { type: "image/png" });
    onSave?.(file);
  }

  return (
    <div className={`space-y-3 markup-root ${className}`}>
      <div className="markup-toolbar">
        <div className="flex gap-1">
          {(["pen", "text", "erase"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTool(t)}
              className={`markup-toolbar__btn ${tool === t ? "markup-toolbar__btn--active" : ""}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="markup-toolbar__group">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => setColor(c)}
              className={`h-5 w-5 rounded-full border ${color === c ? "ring-2 ring-ink" : ""}`}
              style={{ background: c, borderColor: c === "#ffffff" ? "#999" : c }}
            />
          ))}
        </div>
        <div className="markup-toolbar__group">
          {WIDTHS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWidth(w)}
              className={`h-5 rounded-full ${width === w ? "ring-2 ring-ink" : ""}`}
              style={{ background: "#111827", width: w + 8 }}
              aria-label={`${w}px`}
            />
          ))}
        </div>
        <button type="button" onClick={undo} className="markup-toolbar__btn">Undo</button>
        <button type="button" onClick={clearAll} className="markup-toolbar__btn">Clear</button>
        <div className="markup-toolbar__actions">
          {onCancel && (
            <button type="button" onClick={onCancel} className="markup-toolbar__btn">Cancel</button>
          )}
          <button
            type="button"
            onClick={() => void save()}
            className="markup-toolbar__btn markup-toolbar__btn--primary"
          >
            {saveLabel}
          </button>
        </div>
      </div>

      {!imageDataUrl && <div className="text-xs text-steel-muted">Loading image…</div>}

      {imageDataUrl && (
        <div className="markup-canvas-wrap relative inline-block max-w-full">
          <canvas ref={canvasRef} className="markup-canvas block max-w-full h-auto rounded-lg" style={{ background: "#f4f4f5" }} />
          <canvas
            ref={overlayRef}
            className="markup-overlay absolute inset-0 max-w-full h-auto rounded-lg touch-none"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
        </div>
      )}
    </div>
  );
}
