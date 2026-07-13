import { Link } from "react-router-dom";

export function BrandMark({
  size = "md",
  showTag = true,
  tagTone = "light",
  compact = false,
}: {
  size?: "sm" | "md" | "lg";
  showTag?: boolean;
  tagTone?: "light" | "dark";
  compact?: boolean;
}) {
  const heights = { sm: "h-7", md: "h-10", lg: "h-14" };
  return (
    <div className={`flex items-center min-w-0 ${compact ? "gap-2" : "gap-3"}`}>
      <div className={`overflow-hidden ring-1 ring-black/20 bg-black shrink-0 ${compact ? "rounded" : "rounded-lg"}`}>
        <img src="/logo.png" alt="शरणम्" className={`${heights[size]} w-auto object-contain block`} />
      </div>
      {showTag && !compact && (
        <div className={tagTone === "dark" ? "text-white" : "text-ink"}>
          <div className="text-[10px] uppercase tracking-[0.2em] opacity-55 font-medium">शरणम् Portal</div>
        </div>
      )}
      {showTag && compact && (
        <span className={`text-sm font-semibold tracking-tight ${tagTone === "dark" ? "text-white" : "text-ink"}`}>
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
