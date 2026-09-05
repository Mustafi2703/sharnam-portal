import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Button } from "./ui";

type Props = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

/** Read-only list modal — scroll stays inside the panel; page behind does not lock. */
export function DashboardListModal({ open, title, subtitle, onClose, children, footer }: Props) {
  if (!open) return null;
  return createPortal(
    <div className="register-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="register-modal__panel register-modal__panel--lg" onClick={(e) => e.stopPropagation()}>
        <div className="register-modal__head">
          <div className="min-w-0">
            <h3 className="font-semibold text-ink text-base sm:text-lg">{title}</h3>
            {subtitle && <p className="text-xs text-steel-muted mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            className="text-steel-muted hover:text-ink text-2xl leading-none px-2"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="register-modal__body !p-0 max-h-[min(70vh,640px)] overflow-y-auto overscroll-contain">
          {children}
        </div>
        {footer && <div className="register-modal__foot">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function DashboardListModalFoot({ onClose, href, hrefLabel }: { onClose: () => void; href?: string; hrefLabel?: string }) {
  return (
    <>
      <Button type="button" variant="secondary" onClick={onClose}>
        Close
      </Button>
      {href && hrefLabel && (
        <Link to={href}>
          <Button type="button">{hrefLabel}</Button>
        </Link>
      )}
    </>
  );
}
