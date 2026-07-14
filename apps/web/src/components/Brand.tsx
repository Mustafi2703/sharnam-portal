import { Link } from "react-router-dom";

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
  const heights = { sm: "h-7", md: "h-10", lg: "h-14", xl: "h-20 sm:h-24" };
  return (
    <div className={`flex items-center min-w-0 ${compact ? "gap-2" : "gap-3"}`}>
      <div className={`logo-plate shrink-0 ${compact ? "rounded-sm" : "rounded"}`}>
        <img src="/logo.png" alt="शरणम्" className={`${heights[size]} w-auto object-contain block`} />
      </div>
      {showTag && !compact && (
        <div className={tagTone === "dark" ? "text-white" : "text-ink"}>
          <div className="text-[10px] uppercase tracking-[0.28em] opacity-55 font-medium">Portal</div>
          <div className="font-display text-sm tracking-tight leading-none mt-0.5">शरणम्</div>
        </div>
      )}
      {showTag && compact && (
        <span className={`text-sm font-display tracking-tight ${tagTone === "dark" ? "text-white" : "text-ink"}`}>
          शरणम्
        </span>
      )}
    </div>
  );
}

export function BrandLink({
  to = "/",
  tagTone = "dark",
}: {
  to?: string;
  tagTone?: "light" | "dark";
}) {
  return (
    <Link to={to} className="inline-flex items-center gap-3">
      <BrandMark size="md" tagTone={tagTone} />
    </Link>
  );
}

/** Large logo stage for heroes — the brand dominates the first viewport */
export function BrandHero({ className = "" }: { className?: string }) {
  return (
    <div className={`brand-frame inline-flex flex-col items-center ${className}`}>
      <div className="logo-plate rounded-lg p-4 sm:p-6 shadow-2xl shadow-black/50">
        <img src="/logo.png" alt="शरणम्" className="h-16 sm:h-24 md:h-28 w-auto object-contain" />
      </div>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.35em] text-white/70">
        Project Development Consultants
      </p>
    </div>
  );
}
