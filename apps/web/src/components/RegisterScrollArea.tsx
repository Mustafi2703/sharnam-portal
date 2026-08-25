import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  /** Reserved for taller chrome above sheet (QAP/Cube). */
  tall?: boolean;
};

/** Horizontal scroll wrapper for wide register tables; vertical scroll is the tool outlet. */
export function RegisterScrollArea({ children, className = "", tall = false }: Props) {
  return (
    <div
      className={`register-scroll-area${tall ? " register-scroll-area--tall" : ""} ${className}`.trim()}
      data-register-scroll={tall ? "tall" : "default"}
    >
      {children}
    </div>
  );
}
