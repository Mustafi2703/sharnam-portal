import { Link } from "react-router-dom";

const BRAND_EN = "Sharnam";
const BRAND_HI = "शरणम्";
const BRAND_TAG = "Project Development Consultants & Co.";

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
  const heights = { sm: "h-8", md: "h-11", lg: "h-14", xl: "h-20 sm:h-24" };
  const tone = tagTone === "dark" ? "text-white" : "text-ink";
  return (
    <div className={`flex items-center min-w-0 ${compact ? "gap-2" : "gap-3"}`}>
      <div className={`logo-plate shrink-0 rounded-md ${compact ? "" : "brand-frame"}`}>
        <img src="/logo.png" alt={`${BRAND_HI} ${BRAND_EN}`} className={`${heights[size]} w-auto object-contain block`} />
      </div>
      {showTag && !compact && (
        <div className={tone}>
          <div className="font-display text-base tracking-tight leading-none">{BRAND_EN}</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-steel-muted mt-1 font-medium">
            {BRAND_HI} · PMC
          </div>
        </div>
      )}
      {showTag && compact && (
        <span className={`text-sm font-display tracking-tight ${tone}`}>{BRAND_EN}</span>
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
    <Link to={to} className="inline-flex items-center gap-3" aria-label="Sharnam home">
      <BrandMark size="md" tagTone={tagTone} />
    </Link>
  );
}

export function BrandHero({ className = "", light = false }: { className?: string; light?: boolean }) {
  return (
    <div className={`inline-flex flex-col items-start ${className}`}>
      <div className="logo-plate brand-frame rounded-xl p-5 sm:p-6">
        <img src="/logo.png" alt={`${BRAND_HI} ${BRAND_EN}`} className="h-14 sm:h-20 w-auto object-contain" />
      </div>
      <h1 className={`mt-5 font-display text-3xl sm:text-4xl tracking-tight ${light ? "text-ink" : "text-white"}`}>
        {BRAND_EN}
      </h1>
      <p className={`mt-1 font-mono text-[10px] uppercase tracking-[0.28em] ${light ? "text-steel-muted" : "text-white/75"}`}>
        {BRAND_HI} · {BRAND_TAG}
      </p>
    </div>
  );
}

export { BRAND_EN, BRAND_HI, BRAND_TAG };
