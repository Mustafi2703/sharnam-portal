import { Link } from "react-router-dom";

const BRAND_EN = "Sharnam";
const BRAND_HI = "शरणम्";
const BRAND_TAG = "Project Management Consultants";

/** Text wordmark — no logo image / white plate */
export function BrandMark({
  size = "md",
  showTag = true,
  tagTone = "light",
  compact = false,
}: {
  size?: "sm" | "md" | "lg" | "xl";
  showTag?: boolean;
  tagTone?: "light" | "dark";
  compact?: boolean;
}) {
  const nameSize = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-xl",
    xl: "text-2xl sm:text-3xl",
  }[size];
  const tone = tagTone === "dark" ? "text-white" : "text-ink";
  const muted = tagTone === "dark" ? "text-white/65" : "text-brand";

  if (compact && !showTag) {
    return (
      <span className={`font-display font-semibold tracking-tight leading-none ${nameSize} ${tone}`}>
        {BRAND_EN}
      </span>
    );
  }

  return (
    <div className={`flex flex-col min-w-0 ${compact ? "gap-0.5" : "gap-1"}`}>
      <span className={`font-display font-semibold tracking-tight leading-none ${nameSize} ${tone}`}>
        {BRAND_EN}
      </span>
      {showTag && (
        <span className={`text-[10px] uppercase tracking-[0.2em] font-semibold ${muted}`}>
          {BRAND_TAG}
          {!compact ? ` · ${BRAND_HI}` : ""}
        </span>
      )}
      {showTag && compact && (
        <span className={`text-[10px] uppercase tracking-[0.16em] font-medium ${muted}`}>{BRAND_HI}</span>
      )}
    </div>
  );
}

export function BrandLink({
  to = "/",
  tagTone = "light",
}: {
  to?: string;
  tagTone?: "light" | "dark";
}) {
  return (
    <Link to={to} className="inline-flex items-center gap-2.5" aria-label="Sharnam home">
      <BrandMark size="md" tagTone={tagTone} />
    </Link>
  );
}

/** Login / lockup — letter brand only */
export function BrandLockup({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-start ${className}`}>
      <div
        className={`font-display tracking-tight text-ink font-semibold ${
          compact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"
        }`}
      >
        {BRAND_EN}
      </div>
      <p
        className={`uppercase tracking-[0.22em] font-semibold text-brand ${
          compact ? "text-xs mt-1.5" : "text-sm mt-2"
        }`}
      >
        {BRAND_TAG}
      </p>
      <p className="text-[11px] tracking-[0.14em] text-steel-muted font-semibold mt-1.5">{BRAND_HI}</p>
    </div>
  );
}

export { BRAND_EN, BRAND_HI, BRAND_TAG };
