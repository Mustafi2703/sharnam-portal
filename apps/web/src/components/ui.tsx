import type { ButtonHTMLAttributes, ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="rise flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
      <div>
        {eyebrow && (
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-brand mb-2">{eyebrow}</p>
        )}
        <h1 className="text-2xl sm:text-3xl font-semibold leading-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-2 text-steel-muted max-w-2xl text-sm leading-relaxed">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
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
    <div className={`surface rounded ${padding ? "p-4 sm:p-5" : ""} ${className}`}>{children}</div>
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
    neutral: "bg-steel/5 text-steel-muted border-steel/10",
    brand: "bg-brand-soft text-brand-dark border-brand/20",
    ok: "bg-emerald-50 text-ok border-emerald-200",
    warn: "bg-amber-50 text-warn border-amber-200",
    danger: "bg-red-50 text-danger border-red-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "dark";
}) {
  const variants = {
    primary: "bg-procore-blue hover:bg-brand-dark text-white shadow-sm",
    secondary: "bg-white border border-line text-ink hover:bg-sand",
    ghost: "text-steel-muted hover:text-ink hover:bg-black/5",
    dark: "bg-procore-navy text-white hover:bg-[#16202b]",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded px-3.5 py-2 text-sm font-medium transition disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
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
          How this works
        </span>
        <Badge tone="brand">Demo flow</Badge>
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
                  i <= active ? "bg-brand text-white" : "bg-steel/10 text-steel-muted"
                }`}
              >
                {i + 1}
              </span>
              <span className="font-medium text-sm">{s.label}</span>
            </div>
            {s.hint && <p className="text-xs text-steel-muted leading-relaxed pl-9">{s.hint}</p>}
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
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-steel-muted">{label}</div>
      <div className="mt-2 font-display text-3xl text-ink">{value}</div>
      {hint && <div className="mt-2 text-xs text-steel-muted">{hint}</div>}
    </Card>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 ${props.className || ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 ${props.className || ""}`}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 ${props.className || ""}`}
    />
  );
}

/** Styled file picker — replaces bare browser "Choose file" control */
export function FileField({
  label = "Choose file",
  accept,
  file,
  onChange,
  hint,
}: {
  label?: string;
  accept?: string;
  file: File | null;
  onChange: (file: File | null) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-dashed border-line bg-sand/40 px-3 py-3 cursor-pointer hover:border-brand/50 hover:bg-brand-soft/40 transition">
        <span className="inline-flex items-center justify-center rounded bg-procore-navy text-white text-xs font-medium px-3 py-1.5 shrink-0">
          {label}
        </span>
        <span className="text-sm text-steel-muted truncate">
          {file ? file.name : "PDF, DWG, or image — no file selected"}
        </span>
        <input
          type="file"
          className="sr-only"
          accept={accept}
          onChange={(e) => onChange(e.target.files?.[0] || null)}
        />
      </label>
      {hint && <p className="text-[11px] text-steel-muted">{hint}</p>}
    </div>
  );
}
