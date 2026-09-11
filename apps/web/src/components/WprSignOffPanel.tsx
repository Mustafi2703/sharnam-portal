import { FilePickButton } from "./FilePickButton";
import { SignaturePad } from "./SignaturePad";

type Sig = { path: string; role: string; url?: string };

/** Draw or upload PMC / Client / Contractor signs for WPR dashboard and project brief. */
export function WprSignOffPanel({
  signatures,
  onUpload,
  onRemove,
  resolveUrl,
  title = "Sign-off",
}: {
  signatures: Sig[];
  onUpload: (file: File, role: string) => void;
  onRemove: (index: number) => void;
  resolveUrl: (ref: string) => string;
  title?: string;
}) {
  return (
    <section className="rounded-lg border border-line p-3 space-y-3 bg-sand/30">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-steel-muted">
          {title} ({signatures.length})
        </h4>
        <p className="text-[11px] text-steel-muted">Draw or upload PNG — saved on this week’s pack.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        {(
          [
            ["pmc", "PMC sign"],
            ["client", "Client sign"],
            ["contractor", "Contractor sign"],
          ] as const
        ).map(([role, label]) => (
          <div key={role} className="space-y-2">
            <SignaturePad label={label} personName={role.toUpperCase()} height={120} onCapture={(f) => f && onUpload(f, role)} />
            <FilePickButton accept="image/png,image/jpeg,image/webp" onPick={(files) => files[0] && onUpload(files[0], role)}>
              Upload {label}
            </FilePickButton>
          </div>
        ))}
      </div>
      {signatures.length > 0 && (
        <div className="grid sm:grid-cols-3 gap-3">
          {signatures.map((p, i) => (
            <div key={`${p.role}-${i}`} className="rounded-lg border border-line bg-white p-2 space-y-1">
              <div className="text-[10px] uppercase text-steel-muted">{p.role}</div>
              <a href={resolveUrl(p.url || p.path)} target="_blank" rel="noopener noreferrer">
                <img src={resolveUrl(p.url || p.path)} alt={p.role} className="w-full h-24 object-contain bg-sand/20" />
              </a>
              <button type="button" className="text-danger text-xs" onClick={() => onRemove(i)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
