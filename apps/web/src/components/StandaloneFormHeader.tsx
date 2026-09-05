import type { ReactNode } from "react";

type Props = {
  variant?: "light" | "navy";
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  metaRight?: ReactNode;
  actions?: ReactNode;
};

/** Branded chrome for standalone fill windows — logo + SPDC wordmark. */
export function StandaloneFormHeader({
  variant = "light",
  eyebrow,
  title,
  subtitle,
  metaRight,
  actions,
}: Props) {
  const navy = variant === "navy";

  return (
    <header className={`standalone-form-header ${navy ? "standalone-form-header--navy" : ""}`}>
      <div className="standalone-form-header__inner">
        <div className="standalone-form-header__brand min-w-0">
          <img
            src="/logo-transparent.png"
            alt="शरणम् — Sharnam Project Management Consultants"
            className="standalone-form-header__logo"
            width={140}
            height={68}
          />
          <div className="min-w-0">
            <div className="standalone-form-header__org">Sharnam Project Development Consultants</div>
            <div className="standalone-form-header__tag">शरणम् · SPDC Portal</div>
            {eyebrow ? <div className="standalone-form-header__eyebrow">{eyebrow}</div> : null}
            {title ? <div className="standalone-form-header__title">{title}</div> : null}
            {subtitle ? <div className="standalone-form-header__subtitle">{subtitle}</div> : null}
          </div>
        </div>
        {(metaRight || actions) && (
          <div className="standalone-form-header__actions shrink-0">
            {metaRight}
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
