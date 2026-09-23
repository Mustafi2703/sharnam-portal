import { useEffect, useRef } from "react";

type Props = {
  blob: Blob | null;
  className?: string;
};

/** Renders a .docx blob — same bytes as Generate / Word download (docx-preview). */
export default function HrmsDocxPreview({ blob, className }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const styleRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = hostRef.current;
    const styleEl = styleRef.current;
    if (!el) return;
    el.innerHTML = "";
    if (styleEl) styleEl.innerHTML = "";
    if (!blob) return;

    let cancelled = false;
    void (async () => {
      const { renderAsync } = await import("docx-preview");
      if (cancelled || !hostRef.current) return;
      await renderAsync(blob, hostRef.current, styleEl ?? undefined, {
        className: "docx",
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        ignoreFonts: false,
        breakPages: true,
        useBase64URL: true,
        renderHeaders: true,
        renderFooters: true,
        renderFootnotes: true,
        renderEndnotes: true,
        renderAltChunks: true,
      });
    })().catch(() => {
      if (hostRef.current) {
        hostRef.current.innerHTML =
          '<p class="text-sm text-danger p-4">Could not render Word preview. Download the .docx and open in Microsoft Word.</p>';
      }
    });

    return () => {
      cancelled = true;
    };
  }, [blob]);

  if (!blob) {
    return (
      <p className="text-sm text-steel-muted p-4">
        Click <strong className="text-ink">Preview Word</strong> to load the official SPDC letter here — same layout and branding as the
        downloadable .docx.
      </p>
    );
  }

  return (
    <div className={className || "hrms-docx-preview-frame w-full min-h-[360px] flex flex-col"}>
      <div ref={styleRef} className="hrms-docx-preview-styles" aria-hidden />
      <div ref={hostRef} className="docx-preview-host flex-1 overflow-auto bg-[#e8eaed] p-4" />
    </div>
  );
}
