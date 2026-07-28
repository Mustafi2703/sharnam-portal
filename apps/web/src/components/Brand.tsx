import { Link } from "react-router-dom";

const BRAND_EN = "Sharnam";
const BRAND_HI = "शरणम्";
const BRAND_TAG = "Project Development Consultants & Co.";

/** Logo without white plate — sits cleanly on light chrome */
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
  const heights = { sm: "h-7", md: "h-9", lg: "h-11", xl: "h-14 sm:h-16" };
  const tone = tagTone === "dark" ? "text-white" : "text-ink";
  return (
    <div className={`flex items-center min-w-0 ${compact ? "gap-2" : "gap-2.5"}`}>
      <img
        src="/logo.png"
        alt={`${BRAND_HI} ${BRAND_EN}`}
        className={`${heights[size]} w-auto max-w-[140px] object-contain object-left block shrink-0`}
      />
      {showTag && !compact && (
        <div className={tone}>
          <div className="font-display text-base tracking-tight leading-none">{BRAND_EN}</div>
          <div
            className={`text-[10px] uppercase tracking-[0.18em] mt-1 font-medium ${
              tagTone === "dark" ? "text-white/60" : "text-brand"
            }`}
          >
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
    <Link to={to} className="inline-flex items-center gap-2.5" aria-label="Sharnam home">
      <BrandMark size="md" tagTone={tagTone} />
    </Link>
  );
}

/** Login lockup — no box, clear brand colour */
export function BrandLockup({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-start ${className}`}>
      <img
        src="/logo.png"
        alt={`${BRAND_HI} ${BRAND_EN}`}
        className={`${compact ? "h-11 sm:h-12 max-w-[190px]" : "h-12 sm:h-14 max-w-[210px]"} w-auto object-contain object-left block`}
      />
      <div className={compact ? "mt-2.5" : "mt-3.5"}>
        <div className={`font-display tracking-tight text-ink ${compact ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"}`}>
          {BRAND_EN}
        </div>
        <p className="text-sm text-steel-muted mt-1 leading-snug">{BRAND_TAG}</p>
        <p className="text-[11px] uppercase tracking-[0.18em] text-brand font-semibold mt-1.5">{BRAND_HI}</p>
      </div>
    </div>
  );
}

export { BRAND_EN, BRAND_HI, BRAND_TAG };
