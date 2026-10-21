import { useEffect, useRef } from "react";

type Props = {
  blob: Blob | null;
  className?: string;
  /** panel = composer sidebar; modal = full-screen dialog (fills height, scrolls inside). */
  layout?: "panel" | "modal";
};

/** Renders a .docx blob — same bytes as Generate / Word download (docx-preview). */
export default function HrmsDocxPreview({ blob, className, layout = "panel" }: Props) {
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
      const host = hostRef.current;
      if (!host) return;
      const pages = host.querySelectorAll("section.docx");
      const total = pages.length || 1;
      pages.forEach((page, index) => {
        page.querySelectorAll("footer").forEach((footer) => {
          const nodes: Text[] = [];
          const walker = document.createTreeWalker(footer, NodeFilter.SHOW_TEXT);
          let node: Node | null = walker.nextNode();
          while (node) {
            nodes.push(node as Text);
            node = walker.nextNode();
          }
          const joined = nodes.map((n) => n.data).join("");
          if (!/Page\s+\d+\s+of\s+\d+/.test(joined)) return;
          const next = joined.replace(/Page\s+\d+\s+of\s+\d+/, `Page ${index + 1} of ${total}`);
          if (nodes[0]) nodes[0].data = next;
          nodes.slice(1).forEach((n) => {
            n.data = "";
          });
        });
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

  const frameClass =
    layout === "modal"
      ? "hrms-docx-preview-frame hrms-docx-preview-frame--modal w-full flex flex-col min-h-0 flex-1"
      : "hrms-docx-preview-frame w-full flex flex-col min-h-0";

  return (
    <div className={[frameClass, className].filter(Boolean).join(" ")}>
      <div ref={styleRef} className="hrms-docx-preview-styles" aria-hidden />
      <div
        ref={hostRef}
        className="docx-preview-host scrollbars-visible flex-1 min-h-0 overflow-y-auto overscroll-contain bg-[#e8eaed] p-4"
      />
    </div>
  );
}
