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
  const heights = { sm: "h-9", md: "h-11", lg: "h-14", xl: "h-16 sm:h-20" };
  const pads = { sm: "p-1.5", md: "p-2", lg: "p-2.5", xl: "p-3" };
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

/** Large logo on white login panels — sits directly on white so the mark blends cleanly */
export function BrandLockup({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-start ${className}`}>
      <img
        src="/logo.png"
        alt={`${BRAND_HI} ${BRAND_EN}`}
        className="h-14 sm:h-[4.5rem] w-auto max-w-[240px] object-contain object-left block"
      />
      <div className="mt-5">
        <div className="font-display text-2xl text-ink tracking-tight">{BRAND_EN}</div>
        <p className="text-sm text-steel-muted mt-1 leading-snug">{BRAND_TAG}</p>
        <p className="text-[11px] uppercase tracking-[0.2em] text-steel-muted/80 mt-2 font-medium">{BRAND_HI}</p>
      </div>
    </div>
  );
}

export { BRAND_EN, BRAND_HI, BRAND_TAG };
