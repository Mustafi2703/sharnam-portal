/**
 * SignaturePad — draw on canvas or upload an existing signature image.
 * Returns a File (image/png) via `onCapture`. Works with mouse, touch and stylus.
 * Also displayed inline as a small thumbnail once captured.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "./ui";

type Props = {
  onCapture: (file: File | null) => void;
  label?: string;
  personName?: string;
  height?: number;
};

export function SignaturePad({ onCapture, label = "Signature", personName, height = 160 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);
  const [preview, setPreview] = useState<string | null>(null);

  const setup = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const parent = c.parentElement;
    const width = parent?.clientWidth || 360;
    const ratio = window.devicePixelRatio || 1;
    c.width = Math.floor(width * ratio);
    c.height = Math.floor(height * ratio);
    c.style.width = `${width}px`;
    c.style.height = `${height}px`;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0b3140";
  }, [height]);

  useEffect(() => {
    setup();
    const onResize = () => setup();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [setup]);

  function pointerPos(e: PointerEvent | React.PointerEvent) {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function begin(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pointerPos(e);
    setEmpty(false);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    e.preventDefault();
    const c = canvasRef.current!;
    const ctx = c.getContext("2d");
    if (!ctx || !last.current) return;
    const now = pointerPos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(now.x, now.y);
    ctx.stroke();
    last.current = now;
  }
  function end() {
    drawing.current = false;
    last.current = null;
  }

  function clear() {
    setup();
    setEmpty(true);
    setPreview(null);
    onCapture(null);
  }

  async function capture() {
    const c = canvasRef.current;
    if (!c) return;
    c.toBlob(
      (blob) => {
        if (!blob) return;
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const name = `signature-${personName || "party"}-${stamp}.png`.replace(/[^a-zA-Z0-9._-]/g, "_");
        const file = new File([blob], name, { type: "image/png" });
        onCapture(file);
        setPreview(URL.createObjectURL(blob));
      },
      "image/png",
      0.92
    );
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    onCapture(f);
    setPreview(URL.createObjectURL(f));
    setEmpty(false);
  }

  return (
    <div className="border border-line rounded-xl bg-paper p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-steel-muted">
          {label}
          {personName && <span className="normal-case text-steel-muted ml-2 font-medium">· {personName}</span>}
        </span>
        {preview && (
          <img
            src={preview}
            alt="Captured signature"
            className="h-9 w-28 object-contain rounded border border-line bg-white"
          />
        )}
      </div>
      <div className="relative rounded-lg border border-dashed border-line bg-white overflow-hidden" style={{ height }}>
        <canvas
          ref={canvasRef}
          onPointerDown={begin}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="w-full h-full touch-none select-none block"
        />
        {empty && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] text-steel-muted uppercase tracking-widest">
            Sign here
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => void capture()} variant="secondary" className="!text-xs" disabled={empty}>
          Save signature
        </Button>
        <Button type="button" onClick={clear} variant="ghost" className="!text-xs" disabled={empty}>
          Clear
        </Button>
        <label className="text-[11px] font-semibold text-brand cursor-pointer">
          or upload image
          <input type="file" accept="image/*" onChange={onFile} className="hidden" />
        </label>
      </div>
    </div>
  );
}
