import { Link } from "react-router-dom";

export function BrandMark({
  size = "md",
  showTag = true,
  tagTone = "light",
}: {
  size?: "sm" | "md" | "lg";
  showTag?: boolean;
  /** Tag text color relative to surrounding surface */
  tagTone?: "light" | "dark";
}) {
  const heights = { sm: "h-10", md: "h-12", lg: "h-[4.25rem]" };
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="rounded-xl overflow-hidden ring-1 ring-black/20 shadow-md bg-black shrink-0">
        <img src="/logo.png" alt="शरणम्" className={`${heights[size]} w-auto object-contain block`} />
      </div>
      {showTag && (
        <div className={tagTone === "dark" ? "text-white" : "text-ink"}>
          <div className="font-mono text-[10px] uppercase tracking-[0.28em] opacity-55">Site Command</div>
        </div>
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
