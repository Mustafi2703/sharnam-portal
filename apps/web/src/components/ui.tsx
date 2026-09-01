import { useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { formatUiText } from "../lib/formatUiText";

function fmt(children: ReactNode): ReactNode {
  return typeof children === "string" ? formatUiText(children) : children;
}

export function PageHero({
  title,
  subtitle,
  actions,
  accent = "graphite",
  icon,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  accent?: "graphite" | "navy" | "ember";
  icon?: ReactNode;
}) {
  const gradients = {
    graphite: "from-[#1c222b] via-[#252b36] to-[#12151a]",
    navy: "from-[#1a2332] via-[#243044] to-[#121820]",
    ember: "from-[#2a241f] via-[#3a2e26] to-[#1a1612]",
  };
  return (
    <div
      className={`rounded-xl bg-gradient-to-br ${gradients[accent]} p-5 sm:p-6 border border-white/8 relative overflow-hidden mb-5`}
    >
      <div className="absolute inset-x-0 top-0 h-[3px] bg-[var(--wd-accent,var(--color-brand))]" />
      <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {icon ? (
            <span className="mt-0.5 h-10 w-10 shrink-0 rounded-lg grid place-items-center bg-white/10 text-white border border-white/15">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-display font-semibold text-white tracking-tight">{fmt(title)}</h1>
            {subtitle && <p className="text-sm text-white/75 mt-1.5 max-w-2xl leading-relaxed">{fmt(subtitle)}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  icon,
  dense = false,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  icon?: ReactNode;
  dense?: boolean;
}) {
  return (
    <header
      className={`rise flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between ${dense ? "mb-3" : "mb-8"}`}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {icon ? (
          <span className="mt-1 h-11 w-11 shrink-0 rounded-xl grid place-items-center bg-brand text-white shadow-sm">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand mb-2">{fmt(eyebrow)}</p>
          )}
          <h1 className="font-display text-2xl sm:text-3xl font-semibold leading-tight tracking-tight text-ink">{fmt(title)}</h1>
          {subtitle && (
            <p className="mt-2 text-steel-muted max-w-4xl text-sm sm:text-[15px] leading-relaxed hidden sm:block">
              {fmt(subtitle)}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2 shrink-0 w-full sm:w-auto sm:justify-end">{actions}</div>}
    </header>
  );
}

export function Card({
  children,
  className = "",
  padding = true,
}: {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}) {
  return (
    <div className={`surface ${padding ? "p-5 sm:p-6" : ""} ${className}`}>{children}</div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "ok" | "warn" | "danger";
}) {
  const tones = {
    neutral: "bg-sand/80 text-steel-muted border-line",
    brand: "bg-brand-soft text-brand-dark border-brand/25",
    ok: "bg-brand-soft text-brand border-brand/25",
    warn: "bg-amber-50 text-warn border-amber-200",
    danger: "bg-red-50 text-danger border-red-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${tones[tone]}`}
    >
      {fmt(children)}
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  style,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "dark";
}) {
  const variants = {
    primary:
      "bg-[var(--color-brand)] hover:brightness-[0.94] text-white shadow-sm border border-transparent",
    secondary: "bg-paper border border-line text-ink hover:bg-[var(--color-brand-soft)]",
    ghost: "text-steel-muted hover:text-ink hover:bg-sand/70",
    dark: "bg-ink text-white hover:bg-steel-2",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${variants[variant]} ${className}`}
      style={style}
      {...props}
    >
      {fmt(children)}
    </button>
  );
}

export function WorkflowStrip({
  steps,
  active = 0,
}: {
  steps: { label: string; hint?: string }[];
  active?: number;
}) {
  return (
    <Card className="rise rise-delay-1 overflow-hidden !p-0">
      <div className="px-5 py-3 border-b border-line flex items-center justify-between bg-sand/40">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-steel-muted">
          {fmt("How this works")}
        </span>
        <Badge tone="brand">{fmt("Demo flow")}</Badge>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-0">
        {steps.map((s, i) => (
          <div
            key={s.label}
            className={`workflow-step p-4 sm:p-5 border-t sm:border-t-0 sm:border-l border-line first:border-l-0 first:border-t-0 ${
              i === active ? "bg-brand-soft/50" : ""
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`h-7 w-7 rounded-full grid place-items-center text-xs font-semibold ${
                  i <= active ? "bg-ink text-white" : "bg-steel/10 text-steel-muted"
                }`}
              >
                {i + 1}
              </span>
              <span className="font-medium text-sm">{fmt(s.label)}</span>
            </div>
            {s.hint && <p className="text-xs text-steel-muted leading-relaxed pl-9">{fmt(s.hint)}</p>}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="rise">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-steel-muted">{fmt(label)}</div>
      <div className="mt-2 font-display text-3xl text-ink">{value}</div>
      {hint && <div className="mt-2 text-xs text-steel-muted">{fmt(hint)}</div>}
    </Card>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded border border-line bg-paper text-ink px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 ${props.className || ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded border border-line bg-paper text-ink px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 ${props.className || ""}`}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded border border-line bg-paper text-ink px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 ${props.className || ""}`}
    />
  );
}

/** Styled file picker — dropzone + browse (replaces bare browser file input) */
export function FileField({
  label = "Browse file",
  accept,
  file,
  onChange,
  hint,
  compact,
}: {
  label?: string;
  accept?: string;
  file: File | null;
  onChange: (file: File | null) => void;
  hint?: string;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function pickFromList(list: FileList | null) {
    onChange(list?.[0] || null);
  }

  return (
    <div className={`file-dropzone-wrap ${compact ? "file-dropzone-wrap--compact" : ""}`}>
      <div
        className={`file-dropzone ${dragOver ? "is-dragover" : ""} ${file ? "has-file" : ""} ${compact ? "file-dropzone--compact" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pickFromList(e.dataTransfer.files);
        }}
      >
        <div className="file-dropzone__icon" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M12 16V4m0 0L8 8m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 17v1a3 3 0 003 3h10a3 3 0 003-3v-1" strokeLinecap="round" />
          </svg>
        </div>
        <div className="file-dropzone__body min-w-0">
          <p className="file-dropzone__filename" data-preserve-case>
            {file ? file.name : compact ? "Drop file or browse" : "Drop spreadsheet here or browse"}
          </p>
          <p className="file-dropzone__hint">{hint ? fmt(hint) : fmt("XLSX · XLS · CSV")}</p>
        </div>
        <span className="file-dropzone__action">{fmt(label)}</span>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={accept}
          onChange={(e) => pickFromList(e.target.files)}
        />
      </div>
    </div>
  );
}

/** Multi-file dropzone for invoice / batch uploads */
export function FilesDropzone({
  label = "Browse files",
  accept,
  files,
  onChange,
  hint,
}: {
  label?: string;
  accept?: string;
  files: File[];
  onChange: (files: File[]) => void;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function pickFromList(list: FileList | null) {
    if (!list?.length) return;
    onChange(Array.from(list));
  }

  const summary =
    files.length === 0
      ? "Drop files here or browse"
      : files.length === 1
        ? files[0].name
        : `${files.length} files selected`;

  return (
    <div className="file-dropzone-wrap">
      <div
        className={`file-dropzone ${dragOver ? "is-dragover" : ""} ${files.length ? "has-file" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pickFromList(e.dataTransfer.files);
        }}
      >
        <div className="file-dropzone__icon" aria-hidden>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M12 16V4m0 0L8 8m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 17v1a3 3 0 003 3h10a3 3 0 003-3v-1" strokeLinecap="round" />
          </svg>
        </div>
        <div className="file-dropzone__body min-w-0">
          <p className="file-dropzone__filename" data-preserve-case>
            {summary}
          </p>
          <p className="file-dropzone__hint">{hint ? fmt(hint) : fmt("PDF · images · Excel")}</p>
        </div>
        <span className="file-dropzone__action">{fmt(label)}</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          accept={accept}
          onChange={(e) => pickFromList(e.target.files)}
        />
      </div>
    </div>
  );
}
