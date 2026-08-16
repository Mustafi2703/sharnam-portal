import type { ReactNode } from "react";
import { formatUiText } from "../lib/formatUiText";

/** Renders UI copy with consistent title casing (preserves PDF, GFC, etc.). */
export function UiText({
  children,
  as: Tag = "span",
  className = "",
  preserve = false,
}: {
  children: ReactNode;
  as?: "span" | "p" | "div" | "label";
  className?: string;
  /** Skip formatting (user input, codes, file names). */
  preserve?: boolean;
}) {
  if (preserve || typeof children !== "string") {
    return <Tag className={className}>{children}</Tag>;
  }
  return <Tag className={className}>{formatUiText(children)}</Tag>;
}

export { formatUiText };
