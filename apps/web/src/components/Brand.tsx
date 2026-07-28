import { Link } from "react-router-dom";

const BRAND_EN = "Sharnam";
const BRAND_HI = "शरणम्";
const BRAND_TAG = "Project Development Consultants & Co.";

/** Clean logo — white plate so the mark sits properly on light or dark chrome */
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
  const pads = { sm: "p-1", md: "p-1.5", lg: "p-2", xl: "p-2.5" };
  const tone = tagTone === "dark" ? "text-white" : "text-ink";
  return (
    <div className={`flex items-center min-w-0 ${compact ? "gap-2.5" : "gap-3"}`}>
      <div className={`shrink-0 rounded-lg bg-white shadow-sm border border-black/5 ${pads[size]}`}>
        <img
          src="/logo.png"
          alt={`${BRAND_HI} ${BRAND_EN}`}
          className={`${heights[size]} w-auto max-w-[160px] object-contain object-left block`}
        />
      </div>
      {showTag && !compact && (
        <div className={tone}>
          <div className="font-display text-base tracking-tight leading-none">{BRAND_EN}</div>
          <div className={`text-[10px] uppercase tracking-[0.18em] mt-1 font-medium ${tagTone === "dark" ? "text-white/60" : "text-steel-muted"}`}>
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

/** Compact logo for login — scales down on small screens */
export function BrandLockup({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-start ${className}`}>
      <img
        src="/logo.png"
        alt={`${BRAND_HI} ${BRAND_EN}`}
        className={`${compact ? "h-9 sm:h-11 max-w-[160px]" : "h-10 sm:h-12 max-w-[180px]"} w-auto object-contain object-left block`}
      />
      <div className={compact ? "mt-2" : "mt-3"}>
        <div className={`font-display tracking-tight text-ink ${compact ? "text-lg" : "text-xl sm:text-2xl"}`}>{BRAND_EN}</div>
        <p className="text-xs sm:text-sm text-steel-muted mt-0.5 leading-snug">{BRAND_TAG}</p>
      </div>
    </div>
  );
}

export { BRAND_EN, BRAND_HI, BRAND_TAG };
