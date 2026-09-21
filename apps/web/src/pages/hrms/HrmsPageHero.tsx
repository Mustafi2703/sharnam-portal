import type { ReactNode } from "react";
import { PageHeader } from "../../components/ui";
import { formatUiText } from "../../lib/formatUiText";
import { HRMS_ACCENT } from "./hrmsNav";

/** Consistent page hero — matches project module hub / CRM desk pattern. */
export default function HrmsPageHero({
  eyebrow,
  title,
  subtitle,
  workflow,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  workflow?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="module-hub__hero border border-line bg-paper rounded-xl overflow-hidden">
      <div className="module-hub__hero-bar h-1" style={{ background: HRMS_ACCENT }} aria-hidden />
      <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-start gap-4">
        <span
          className="module-hub__icon h-12 w-12 rounded-xl grid place-items-center text-white text-base font-display shrink-0 shadow-sm"
          style={{ background: HRMS_ACCENT }}
        >
          HR
        </span>
        <div className="min-w-0 flex-1">
          <PageHeader eyebrow={eyebrow} title={title} subtitle={formatUiText(subtitle)} />
          {children}
        </div>
      </div>
      {workflow ? (
        <div className="module-hub__workflow border-t border-line bg-sand/80 px-5 sm:px-6 py-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-steel-muted">
          {workflow}
        </div>
      ) : null}
    </div>
  );
}
