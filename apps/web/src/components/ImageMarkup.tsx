import { useEffect, useRef, useState } from "react";

/**
 * ImageMarkup — draw over any image or PDF page.
 * Tools: pen, shapes (rect, circle, arrow, line), text, erase.
 */

type ShapeKind = "rect" | "ellipse" | "arrow" | "line";

type Stroke =
  | { kind: "path"; color: string; width: number; points: { x: number; y: number }[] }
  | { kind: "text"; color: string; text: string; x: number; y: number; size: number }
  | { kind: "shape"; shape: ShapeKind; color: string; width: number; x1: number; y1: number; x2: number; y2: number };

type Tool = "pen" | "text" | "erase" | ShapeKind;

type Props = {
  src: string | File | null;
  onSave?: (file: File) => void;
  saveLabel?: string;
  filename?: string;
  onCancel?: () => void;
  className?: string;
};

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7", "#111827", "#ffffff"];
const WIDTHS = [2, 4, 8, 14];

const TOOLS: { id: Tool; label: string }[] = [
  { id: "pen", label: "Pen" },
  { id: "line", label: "Line" },
  { id: "arrow", label: "Arrow" },
  { id: "rect", label: "Box" },
  { id: "ellipse", label: "Circle" },
  { id: "text", label: "Text" },
  { id: "erase", label: "Erase" },
];

function drawShape(ctx: CanvasRenderingContext2D, s: Extract<Stroke, { kind: "shape" }>) {
  const x = Math.min(s.x1, s.x2);
  const y = Math.min(s.y1, s.y2);
  const w = Math.abs(s.x2 - s.x1);
  const h = Math.abs(s.y2 - s.y1);
  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (s.shape === "rect") {
    ctx.strokeRect(x, y, w, h);
    return;
  }
  if (s.shape === "ellipse") {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, Math.max(w / 2, 1), Math.max(h / 2, 1), 0, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  if (s.shape === "line" || s.shape === "arrow") {
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
    if (s.shape === "arrow") {
      const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
      const head = Math.max(10, s.width * 3);
      ctx.beginPath();
      ctx.moveTo(s.x2, s.y2);
      ctx.lineTo(s.x2 - head * Math.cos(angle - Math.PI / 6), s.y2 - head * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(s.x2, s.y2);
      ctx.lineTo(s.x2 - head * Math.cos(angle + Math.PI / 6), s.y2 - head * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    }
  }
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function hitStroke(s: Stroke, p: { x: number; y: number }, radius: number): boolean {
  if (s.kind === "path") {
    return s.points.some((pt) => Math.hypot(pt.x - p.x, pt.y - p.y) < radius);
  }
  if (s.kind === "text") {
    return Math.hypot(s.x - p.x, s.y - p.y) < radius;
  }
  const x = Math.min(s.x1, s.x2);
  const y = Math.min(s.y1, s.y2);
  const w = Math.abs(s.x2 - s.x1);
  const h = Math.abs(s.y2 - s.y1);
  if (s.shape === "rect" || s.shape === "ellipse") {
    return p.x >= x - radius && p.x <= x + w + radius && p.y >= y - radius && p.y <= y + h + radius;
  }
  return distToSegment(p.x, p.y, s.x1, s.y1, s.x2, s.y2) < radius;
}

export default function ImageMarkup({
  src,
  onSave,
  onCancel,
  saveLabel = "Save markup",
  filename = "markup",
  className = "",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [current, setCurrent] = useState<Stroke | null>(null);
  const [color, setColor] = useState("#ef4444");
  const [width, setWidth] = useState(4);
  const [tool, setTool] = useState<Tool>("pen");
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
      } else if (s.kind === "shape") {
        drawShape(ctx, s);
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

  function isShapeTool(t: Tool): t is ShapeKind {
    return t === "rect" || t === "ellipse" || t === "arrow" || t === "line";
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
      const radius = width * 3;
      setStrokes((prev) => {
        for (let i = prev.length - 1; i >= 0; i--) {
          if (hitStroke(prev[i], p, radius)) return [...prev.slice(0, i), ...prev.slice(i + 1)];
        }
        return prev;
      });
      return;
    }
    if (isShapeTool(tool)) {
      setCurrent({ kind: "shape", shape: tool, color, width, x1: p.x, y1: p.y, x2: p.x, y2: p.y });
      return;
    }
    setCurrent({ kind: "path", color, width, points: [p] });
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!current) return;
    const p = eventToPoint(e);
    if (current.kind === "shape") {
      setCurrent({ ...current, x2: p.x, y2: p.y });
      return;
    }
    if (current.kind === "path") {
      setCurrent({ ...current, points: [...current.points, p] });
    }
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
        <div className="flex flex-wrap gap-1">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTool(t.id)}
              className={`markup-toolbar__btn ${tool === t.id ? "markup-toolbar__btn--active" : ""}`}
            >
              {t.label}
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
        <button type="button" onClick={undo} className="markup-toolbar__btn">
          Undo
        </button>
        <button type="button" onClick={clearAll} className="markup-toolbar__btn">
          Clear
        </button>
        <div className="markup-toolbar__actions">
          {onCancel && (
            <button type="button" onClick={onCancel} className="markup-toolbar__btn">
              Cancel
            </button>
          )}
          <button type="button" onClick={() => void save()} className="markup-toolbar__btn markup-toolbar__btn--primary">
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
