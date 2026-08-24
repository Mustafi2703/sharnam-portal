import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  /** Taller chrome above sheet (QAP/Cube brand header + filters). */
  tall?: boolean;
};

/**
 * Bounded scroll region for register tables — max-height from viewport so tbody scrolls.
 */
export function RegisterScrollArea({ children, className = "", tall = false }: Props) {
  return (
    <div
      className={`register-scroll-area flex-1 min-h-0 basis-0 h-0 ${className}`.trim()}
      data-register-scroll={tall ? "tall" : "default"}
    >
      {children}
    </div>
  );
}
