import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  /** Reserved for taller chrome above sheet (QAP/Cube). */
  tall?: boolean;
};

/** Horizontal + vertical scroll wrapper for register tables. */
export function RegisterScrollArea({ children, className = "", tall = false }: Props) {
  return (
    <div
      className={`register-scroll-area register-sheet-viewport min-w-0 min-h-0${tall ? " register-scroll-area--tall" : ""} ${className}`.trim()}
      data-register-scroll={tall ? "tall" : "default"}
    >
      {children}
    </div>
  );
}
