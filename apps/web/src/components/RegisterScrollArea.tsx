import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  /** Taller chrome above sheet (QAP/Cube brand header + filters). */
  tall?: boolean;
};

/**
 * Scroll region for register tables — absolutely fills `.register-sheet-shell`.
 */
export function RegisterScrollArea({ children, className = "", tall = false }: Props) {
  return (
    <div
      className={`register-scroll-area ${className}`.trim()}
      data-register-scroll={tall ? "tall" : "default"}
    >
      {children}
    </div>
  );
}
